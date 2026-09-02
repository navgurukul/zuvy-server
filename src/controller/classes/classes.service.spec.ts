// Stub `db` before anything imports it — ClassesService, ZoomService, and
// ZoomLicenseService all import it, and the real module opens a live
// Postgres connection at import time (`client.connect()`).
jest.mock('../../db', () => ({ db: { select: jest.fn() } }));

import { db } from '../../db';
import { zuvyBatches } from '../../../drizzle/schema';
import { ClassesService } from './classes.service';

// Builds a chainable stand-in for drizzle's query builder. Every method
// (`from`/`where`/`leftJoin`/`limit`) just returns the same object, which is
// itself thenable so `await` resolves at whichever point the real code stops
// chaining — mirrors both call shapes used here (session query ends at
// `.where()`, instructor lookup ends at `.limit()`).
function makeChain(result: any[]) {
  const chain: any = {};
  chain.where = jest.fn(() => chain);
  chain.leftJoin = jest.fn(() => chain);
  chain.limit = jest.fn(() => Promise.resolve(result));
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

describe('ClassesService.reaffirmWaitingRoomPolicyForActiveSessions — drift guard', () => {
  function buildService(
    sessionsResult: any[],
    batchResult: any[],
    overrides?: Partial<{ applyLicensedUserSettings: any; updateMeeting: any }>,
  ) {
    (db.select as jest.Mock).mockImplementation(() => ({
      from: jest.fn((table: any) =>
        table === zuvyBatches
          ? makeChain(batchResult)
          : makeChain(sessionsResult),
      ),
    }));

    const zoomServiceMock = {
      applyLicensedUserSettings:
        overrides?.applyLicensedUserSettings ??
        jest.fn().mockResolvedValue({ success: true }),
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

  it('re-applies the host policy and meeting-level waiting_room for a session whose Zoom meeting already exists', async () => {
    const { service, zoomServiceMock } = buildService(
      [{ id: 1, batchId: 10, meetingId: '999999' }],
      [
        {
          instructorId: 5,
          instructorEmail: 'instructor@example.com',
          instructorName: 'Jane',
        },
      ],
    );

    await service.reaffirmWaitingRoomPolicyForActiveSessions();

    expect(zoomServiceMock.applyLicensedUserSettings).toHaveBeenCalledWith(
      'instructor@example.com',
    );
    expect(zoomServiceMock.updateMeeting).toHaveBeenCalledWith('999999', {
      settings: {
        waiting_room: true,
        waiting_room_options: {
          mode: 'custom',
          who_goes_to_waiting_room: 'users_not_on_invite',
        },
      },
    });
  });

  it('skips sessions whose Zoom meeting has not been created yet (still pending) — activateScheduledZoomSessions owns those', async () => {
    const { service, zoomServiceMock } = buildService(
      [{ id: 2, batchId: 10, meetingId: 'pending-zoom-session-abc' }],
      [
        {
          instructorId: 5,
          instructorEmail: 'instructor@example.com',
          instructorName: 'Jane',
        },
      ],
    );

    await service.reaffirmWaitingRoomPolicyForActiveSessions();

    expect(zoomServiceMock.applyLicensedUserSettings).not.toHaveBeenCalled();
    expect(zoomServiceMock.updateMeeting).not.toHaveBeenCalled();
  });

  it('does not throw and skips Zoom calls when no instructor is assigned to the batch', async () => {
    const { service, zoomServiceMock } = buildService(
      [{ id: 3, batchId: 11, meetingId: '111111' }],
      [],
    );

    await expect(
      service.reaffirmWaitingRoomPolicyForActiveSessions(),
    ).resolves.not.toThrow();

    expect(zoomServiceMock.applyLicensedUserSettings).not.toHaveBeenCalled();
    expect(zoomServiceMock.updateMeeting).not.toHaveBeenCalled();
  });

  it('logs and continues if one session fails, so one bad session cannot block the rest', async () => {
    const { service, zoomServiceMock } = buildService(
      [
        { id: 4, batchId: 10, meetingId: '444444' },
        { id: 5, batchId: 10, meetingId: '555555' },
      ],
      [
        {
          instructorId: 5,
          instructorEmail: 'instructor@example.com',
          instructorName: 'Jane',
        },
      ],
      {
        applyLicensedUserSettings: jest
          .fn()
          .mockRejectedValueOnce(new Error('Zoom rate limited'))
          .mockResolvedValueOnce({ success: true }),
      },
    );

    await expect(
      service.reaffirmWaitingRoomPolicyForActiveSessions(),
    ).resolves.not.toThrow();

    expect(zoomServiceMock.applyLicensedUserSettings).toHaveBeenCalledTimes(2);
    // Only the second (successful) session should reach the meeting patch.
    expect(zoomServiceMock.updateMeeting).toHaveBeenCalledTimes(1);
    expect(zoomServiceMock.updateMeeting).toHaveBeenCalledWith('555555', {
      settings: {
        waiting_room: true,
        waiting_room_options: {
          mode: 'custom',
          who_goes_to_waiting_room: 'users_not_on_invite',
        },
      },
    });
  });
});
