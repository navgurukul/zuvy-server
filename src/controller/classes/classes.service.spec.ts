// Stub `db` before anything imports it — ClassesService, ZoomService, and
// ZoomLicenseService all import it, and the real module opens a live
// Postgres connection at import time (`client.connect()`).
jest.mock('../../db', () => ({ db: { select: jest.fn() } }));

import { db } from '../../db';
import { ClassesService } from './classes.service';

// Builds a chainable stand-in for drizzle's query builder. Every method
// (`from`/`where`) just returns the same object, which is itself thenable so
// `await` resolves at whichever point the real code stops chaining.
function makeChain(result: any[]) {
  const chain: any = {};
  chain.from = jest.fn(() => chain);
  chain.where = jest.fn(() => chain);
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe('ClassesService.updateZoomMeetingInvitees (private) — waiting room regression', () => {
  function buildService(
    overrides?: Partial<{ getMeeting: any; updateMeeting: any }>,
  ) {
    const zoomServiceMock = {
      getMeeting:
        overrides?.getMeeting ??
        jest.fn().mockResolvedValue({ success: true, data: {} }),
      updateMeeting:
        overrides?.updateMeeting ?? jest.fn().mockResolvedValue(undefined),
    };

    const service = new (ClassesService as any)(
      zoomServiceMock,
      {} /* ZoomLicenseService */,
      {} /* AttendanceCalculationService */,
    );

    return { service, zoomServiceMock };
  }

  it('keeps waiting_room=true when syncing invitees (regression: this used to hard-code false, disabling the waiting room on every sync)', async () => {
    const { service, zoomServiceMock } = buildService();

    await (service as any).updateZoomMeetingInvitees('123456789', [
      { email: 'student1@example.com', name: 'Student One' },
      { email: 'student2@example.com', name: 'Student Two' },
    ]);

    expect(zoomServiceMock.updateMeeting).toHaveBeenCalledTimes(1);
    const [meetingId, updateData] = zoomServiceMock.updateMeeting.mock.calls[0];

    expect(meetingId).toBe('123456789');
    expect(updateData.settings.waiting_room).toBe(true);
    // mode:'custom' is required or Zoom ignores who_goes_to_waiting_room and
    // falls back to the account/group default instead of this invite list.
    expect(updateData.settings.waiting_room_options).toEqual({
      mode: 'custom',
      who_goes_to_waiting_room: 'users_not_on_invite',
    });
    expect(updateData.settings.meeting_invitees).toEqual([
      { email: 'student1@example.com', name: 'Student One' },
      { email: 'student2@example.com', name: 'Student Two' },
    ]);
  });

  it('propagates the error and never calls updateMeeting if the meeting cannot be fetched first', async () => {
    const { service, zoomServiceMock } = buildService({
      getMeeting: jest
        .fn()
        .mockResolvedValue({ success: false, error: 'not found' }),
    });

    await expect(
      (service as any).updateZoomMeetingInvitees('999', [
        { email: 'a@example.com', name: 'A' },
      ]),
    ).rejects.toThrow(/Failed to get current Zoom meeting/);

    expect(zoomServiceMock.updateMeeting).not.toHaveBeenCalled();
  });
});

describe('ClassesService.reaffirmWaitingRoomPolicyForActiveSessions — fallback drift guard', () => {
  function buildService(
    sessionsResult: any[],
    overrides?: Partial<{ reaffirmMeetingWaitingRoomSettings: any }>,
  ) {
    (db.select as jest.Mock).mockImplementation(() =>
      makeChain(sessionsResult),
    );

    const zoomServiceMock = {
      reaffirmMeetingWaitingRoomSettings:
        overrides?.reaffirmMeetingWaitingRoomSettings ??
        jest.fn().mockResolvedValue(undefined),
    };

    const service = new (ClassesService as any)(
      zoomServiceMock,
      {} /* ZoomLicenseService */,
      {} /* AttendanceCalculationService */,
    );

    return { service, zoomServiceMock };
  }

  it('delegates to ZoomService.reaffirmMeetingWaitingRoomSettings for a session whose Zoom meeting already exists', async () => {
    const { service, zoomServiceMock } = buildService([
      { id: 1, meetingId: '999999' },
    ]);

    await service.reaffirmWaitingRoomPolicyForActiveSessions();

    // Regression guard: the old design also called applyLicensedUserSettings
    // (a large account-wide PATCH) here directly — that's gone. This method
    // now only delegates the cheap, meeting-scoped, drift-checked correction
    // to ZoomService; it no longer knows about hosts or user-level settings
    // at all.
    expect(
      zoomServiceMock.reaffirmMeetingWaitingRoomSettings,
    ).toHaveBeenCalledWith('999999');
    expect(
      zoomServiceMock.reaffirmMeetingWaitingRoomSettings,
    ).toHaveBeenCalledTimes(1);
  });

  it('skips sessions whose Zoom meeting has not been created yet (still pending) — activateScheduledZoomSessions owns those', async () => {
    const { service, zoomServiceMock } = buildService([
      { id: 2, meetingId: 'pending-zoom-session-abc' },
    ]);

    await service.reaffirmWaitingRoomPolicyForActiveSessions();

    expect(
      zoomServiceMock.reaffirmMeetingWaitingRoomSettings,
    ).not.toHaveBeenCalled();
  });

  it('skips sessions with no meetingId at all', async () => {
    const { service, zoomServiceMock } = buildService([
      { id: 3, meetingId: null },
    ]);

    await expect(
      service.reaffirmWaitingRoomPolicyForActiveSessions(),
    ).resolves.not.toThrow();

    expect(
      zoomServiceMock.reaffirmMeetingWaitingRoomSettings,
    ).not.toHaveBeenCalled();
  });

  it('logs and continues if one session fails, so one bad session cannot block the rest', async () => {
    const { service, zoomServiceMock } = buildService(
      [
        { id: 4, meetingId: '444444' },
        { id: 5, meetingId: '555555' },
      ],
      {
        reaffirmMeetingWaitingRoomSettings: jest
          .fn()
          .mockRejectedValueOnce(new Error('Zoom rate limited'))
          .mockResolvedValueOnce(undefined),
      },
    );

    await expect(
      service.reaffirmWaitingRoomPolicyForActiveSessions(),
    ).resolves.not.toThrow();

    expect(
      zoomServiceMock.reaffirmMeetingWaitingRoomSettings,
    ).toHaveBeenCalledTimes(2);
    expect(
      zoomServiceMock.reaffirmMeetingWaitingRoomSettings,
    ).toHaveBeenNthCalledWith(1, '444444');
    expect(
      zoomServiceMock.reaffirmMeetingWaitingRoomSettings,
    ).toHaveBeenNthCalledWith(2, '555555');
  });
});
