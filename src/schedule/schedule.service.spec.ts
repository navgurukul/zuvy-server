// Stub `db` before anything imports it — ScheduleService, ClassesService, and
// ZoomService all import it, and the real module opens a live Postgres
// connection at import time (`client.connect()`).
jest.mock('../db/index', () => ({ db: { select: jest.fn() } }));

import { db } from '../db/index';
import { ScheduleService } from './schedule.service';

// Chainable stand-in for drizzle's query builder — every method returns the
// same object, which is itself thenable so `await` resolves wherever the
// real code stops chaining (this query ends at `.where()`).
function makeChain(result: any[]) {
  const chain: any = {};
  chain.from = jest.fn(() => chain);
  chain.innerJoin = jest.fn(() => chain);
  chain.where = jest.fn(() => chain);
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe('ScheduleService.reaffirmMentorSessionWaitingRoomPolicy — fallback drift guard for mentor bookings', () => {
  function buildService(
    bookingsResult: any[],
    overrides?: Partial<{ reaffirmMeetingWaitingRoomSettings: any }>,
  ) {
    (db.select as jest.Mock).mockImplementation(() =>
      makeChain(bookingsResult),
    );

    const zoomServiceMock = {
      reaffirmMeetingWaitingRoomSettings:
        overrides?.reaffirmMeetingWaitingRoomSettings ??
        jest.fn().mockResolvedValue(undefined),
    };

    const service = new (ScheduleService as any)(
      {} /* ClassesService */,
      zoomServiceMock,
      {} /* AttendanceWorkerTriggerService */,
    );

    return { service, zoomServiceMock };
  }

  it('re-affirms the meeting-level waiting room policy for a due mentor booking', async () => {
    const { service, zoomServiceMock } = buildService([
      { id: 1, zoomMeetingId: '888888' },
    ]);

    await (service as any).reaffirmMentorSessionWaitingRoomPolicy();

    expect(
      zoomServiceMock.reaffirmMeetingWaitingRoomSettings,
    ).toHaveBeenCalledWith('888888');
  });

  it('skips bookings with no Zoom meeting yet', async () => {
    const { service, zoomServiceMock } = buildService([
      { id: 2, zoomMeetingId: null },
    ]);

    await (service as any).reaffirmMentorSessionWaitingRoomPolicy();

    expect(
      zoomServiceMock.reaffirmMeetingWaitingRoomSettings,
    ).not.toHaveBeenCalled();
  });

  it('logs and continues if one booking fails, so one bad booking cannot block the rest', async () => {
    const { service, zoomServiceMock } = buildService(
      [
        { id: 3, zoomMeetingId: '333333' },
        { id: 4, zoomMeetingId: '444444' },
      ],
      {
        reaffirmMeetingWaitingRoomSettings: jest
          .fn()
          .mockRejectedValueOnce(new Error('Zoom rate limited'))
          .mockResolvedValueOnce(undefined),
      },
    );

    await expect(
      (service as any).reaffirmMentorSessionWaitingRoomPolicy(),
    ).resolves.not.toThrow();

    expect(
      zoomServiceMock.reaffirmMeetingWaitingRoomSettings,
    ).toHaveBeenCalledTimes(2);
  });
});
