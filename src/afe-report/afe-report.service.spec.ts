// The service must never reach a real database in tests.
jest.mock('src/db', () => ({ db: {} }));

import { BadRequestException } from '@nestjs/common';
import { AfeReportService } from './afe-report.service';
import { AfeReportRepository } from './afe-report.repository';
import { AfeReportMailer } from './afe-report.mailer';
import { REPORT_EPOCH } from './afe-report.excel';
import { RunSummary } from './afe-report.config';

const ist = (s: string) => new Date(`${s.replace(' ', 'T')}:00+05:30`);

function makeRepo(
  over: Partial<Record<keyof AfeReportRepository, jest.Mock>> = {},
) {
  return {
    loadTours: jest.fn().mockResolvedValue({ tours: new Map(), skipped: [] }),
    loadFinishes: jest.fn().mockResolvedValue([]),
    loadLearners: jest.fn().mockResolvedValue(new Map()),
    loadAnswers: jest.fn().mockResolvedValue(new Map()),
    loadWatchedVideos: jest.fn().mockResolvedValue(new Set()),
    loadSessions: jest.fn().mockResolvedValue(new Map()),
    latestSent: jest.fn().mockResolvedValue(null),
    latestAttempt: jest.fn().mockResolvedValue(null),
    abandonStale: jest.fn().mockResolvedValue(0),
    claim: jest.fn().mockResolvedValue(42),
    markSent: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe('AfeReportService.sendIfDue', () => {
  const env = { ...process.env };
  let repo: ReturnType<typeof makeRepo>;
  let mailer: { send: jest.Mock };
  let service: AfeReportService;

  beforeEach(() => {
    Object.assign(process.env, {
      AFE_REPORT_ENABLED: 'true',
      AFE_REPORT_ORG_ID: '7',
      AFE_REPORT_TO: 'join-zuvy@navgurukul.org',
      SES_ACCESS_KEY_ID: 'k',
      SES_SECRET_ACCESS_KEY: 's',
      AWS_REGION: 'ap-south-1',
      SES_FROM_EMAIL: 'noreply@zuvy.org',
    });
    delete process.env.AFE_REPORT_START;
    repo = makeRepo();
    mailer = { send: jest.fn().mockResolvedValue('msg-1') };
    service = new AfeReportService(
      repo as unknown as AfeReportRepository,
      mailer as unknown as AfeReportMailer,
    );
  });
  afterAll(() => {
    process.env = env;
  });

  it('does nothing when off', async () => {
    process.env.AFE_REPORT_ENABLED = 'false';
    expect(await service.sendIfDue(ist('2026-11-20 09:05'))).toBe('off');
    expect(repo.latestSent).not.toHaveBeenCalled();
  });

  it('does nothing without an organisation id', async () => {
    delete process.env.AFE_REPORT_ORG_ID;
    expect(await service.sendIfDue(ist('2026-11-20 09:05'))).toBe(
      'misconfigured',
    );
    expect(repo.claim).not.toHaveBeenCalled();
  });

  it('first report without a start: everything up to the last Monday 9 AM', async () => {
    const now = ist('2026-11-20 09:05'); // a Friday
    const monday = ist('2026-11-16 09:00');
    expect(await service.sendIfDue(now)).toBe('sent');
    expect(repo.claim).toHaveBeenCalledWith(REPORT_EPOCH, monday);
    expect(repo.loadTours).toHaveBeenCalledWith(7);
    expect(repo.loadFinishes).toHaveBeenCalledWith(
      expect.any(Map),
      REPORT_EPOCH,
      monday,
    );
    const mail = mailer.send.mock.calls[0][0];
    expect(mail.to).toEqual(['join-zuvy@navgurukul.org']);
    expect(mail.attachment.filename).toBe(
      'AFE-Career-Tours-report_up-to_2026-11-16.xlsx',
    );
    expect(mail.attachment.content.subarray(0, 2).toString()).toBe('PK'); // an xlsx (zip) file
    expect(repo.markSent).toHaveBeenCalledWith(42, 0, [
      'join-zuvy@navgurukul.org',
    ]);
  });

  it('next report starts exactly where the last sent one ended', async () => {
    const lastEnd = ist('2026-11-20 09:05');
    const last: RunSummary = {
      status: 'sent',
      windowEnd: lastEnd,
      createdAt: lastEnd,
    };
    repo.latestSent.mockResolvedValue(last);
    repo.latestAttempt.mockResolvedValue(last);
    expect(await service.sendIfDue(ist('2026-11-23 09:05'))).toBe('sent');
    expect(repo.claim).toHaveBeenCalledWith(lastEnd, ist('2026-11-23 09:00'));
  });

  it('with AFE_REPORT_START, the first automatic report starts there', async () => {
    process.env.AFE_REPORT_START = '2026-11-20T15:00:00+05:30';
    expect(await service.sendIfDue(ist('2026-11-22 09:05'))).toBe('not due');
    expect(await service.sendIfDue(ist('2026-11-23 09:05'))).toBe('sent');
    expect(repo.claim).toHaveBeenCalledWith(
      ist('2026-11-20 15:00'),
      ist('2026-11-23 09:00'),
    );
  });

  it('not due yet: no claim, no email', async () => {
    const lastEnd = ist('2026-11-20 09:05');
    repo.latestSent.mockResolvedValue({
      status: 'sent',
      windowEnd: lastEnd,
      createdAt: lastEnd,
    });
    expect(await service.sendIfDue(ist('2026-11-22 09:05'))).toBe('not due');
    expect(repo.claim).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('another server claimed it: no email', async () => {
    repo.claim.mockResolvedValue(null);
    expect(await service.sendIfDue(ist('2026-11-20 09:05'))).toBe(
      'claimed elsewhere',
    );
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('email failure marks the run failed and is not marked sent', async () => {
    mailer.send.mockRejectedValue(
      new Error('not authorized to perform ses:SendRawEmail'),
    );
    expect(await service.sendIfDue(ist('2026-11-20 09:05'))).toBe('failed');
    expect(repo.markFailed).toHaveBeenCalledWith(
      42,
      'not authorized to perform ses:SendRawEmail',
    );
    expect(repo.markSent).not.toHaveBeenCalled();
  });

  it('a query failure marks the run failed too', async () => {
    repo.loadFinishes.mockRejectedValue(new Error('relation does not exist'));
    expect(await service.sendIfDue(ist('2026-11-20 09:05'))).toBe('failed');
    expect(repo.markFailed).toHaveBeenCalledWith(42, 'relation does not exist');
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('cleans up runs abandoned by a dead server first', async () => {
    const now = ist('2026-11-20 09:05');
    await service.sendIfDue(now);
    expect(repo.abandonStale).toHaveBeenCalledWith(now);
  });
});

describe('AfeReportService.resolvePeriod', () => {
  const service = new AfeReportService({} as any, {} as any);
  const now = ist('2026-11-20 15:00');

  it('whole Indian days, "to" included', () => {
    const { from, to } = service.resolvePeriod('2026-11-17', '2026-11-19', now);
    expect(from.toISOString()).toBe('2026-11-16T18:30:00.000Z');
    expect(to.toISOString()).toBe('2026-11-19T18:30:00.000Z');
  });

  it('defaults: from the start, until now; never past now', () => {
    expect(service.resolvePeriod(undefined, undefined, now)).toEqual({
      from: REPORT_EPOCH,
      to: now,
    });
    expect(service.resolvePeriod('2026-11-20', '2026-11-20', now).to).toEqual(
      now,
    );
  });

  it('rejects bad periods with 400', () => {
    expect(() =>
      service.resolvePeriod('2026-11-19', '2026-11-17', now),
    ).toThrow(BadRequestException);
    expect(() => service.resolvePeriod('2026-02-30', undefined, now)).toThrow(
      BadRequestException,
    );
  });
});
