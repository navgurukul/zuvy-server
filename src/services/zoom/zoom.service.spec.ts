import axios from 'axios';

jest.mock('axios');
// zoom.service.ts pulls in `db`, which opens a real Postgres connection at
// import time (`client.connect()` in src/db/index.ts). Stub it out so these
// tests never touch a live database.
jest.mock('../../db', () => ({ db: {} }));

const mockedAxios = axios as jest.Mocked<typeof axios>;

type PatchCall = [string, any, any?];
type PostCall = [string, any, any?];

function findCall(calls: PatchCall[] | PostCall[], urlIncludes: string) {
  return calls.find(([url]) => url.includes(urlIncludes));
}

describe('ZoomService — waiting room "invited only" policy', () => {
  let ZoomServiceCtor: typeof import('./zoom.service').ZoomService;
  let service: InstanceType<typeof import('./zoom.service').ZoomService>;

  beforeAll(() => {
    process.env.ZOOM_CLIENT_ID = 'test-client-id';
    process.env.ZOOM_CLIENT_SECRET = 'test-client-secret';
    process.env.ZOOM_ACCOUNT_ID = 'test-account-id';
    // Imported once after env + mocks are in place.
    ZoomServiceCtor = require('./zoom.service').ZoomService;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockedAxios.post.mockImplementation(((url: string) => {
      if (url.includes('oauth/token')) {
        return Promise.resolve({
          data: { access_token: 'fake-token', expires_in: 3600 },
        });
      }
      return Promise.resolve({
        data: {
          id: 999,
          host_email: 'me',
          join_url: 'https://zoom.us/j/999',
          start_url: 'https://zoom.us/s/999',
        },
      });
    }) as any);

    mockedAxios.patch.mockResolvedValue({ status: 204, data: {} } as any);

    service = new ZoomServiceCtor();
  });

  describe('applyLicensedUserSettings (User-level API — the only place this can actually be enforced)', () => {
    it('sets participants_to_place_in_waiting_room to 2 ("not in account and not invited"), not 3 ("No one")', async () => {
      await service.applyLicensedUserSettings('instructor@example.com');

      const call = findCall(
        mockedAxios.patch.mock.calls as PatchCall[],
        '/users/instructor%40example.com/settings',
      );
      expect(call).toBeDefined();
      const payload = call![1];

      expect(payload.in_meeting.waiting_room).toBe(true);
      expect(payload.in_meeting.participants_to_place_in_waiting_room).toBe(2);
      expect(
        payload.in_meeting.waiting_room_settings
          .participants_to_place_in_waiting_room,
      ).toBe(2);
      // Regression guard: 3 ("No one") placed nobody in the waiting room and
      // silently defeated the whole feature.
      expect(payload.in_meeting.participants_to_place_in_waiting_room).not.toBe(
        3,
      );
    });
  });

  describe('createMeeting (team/"me"-hosted meetings)', () => {
    it('enables meeting-level waiting_room with custom mode + users_not_on_invite, and re-applies the "me" user policy', async () => {
      const result = await service.createMeeting({
        topic: 'Team meeting',
        type: 2,
        start_time: '2026-01-01T00:00:00Z',
        duration: 30,
        timezone: 'UTC',
      } as any);

      expect(result.success).toBe(true);

      const createPost = findCall(
        mockedAxios.post.mock.calls as PostCall[],
        '/users/me/meetings',
      );
      expect(createPost![1].settings.waiting_room).toBe(true);
      // `mode: 'custom'` is required or Zoom ignores who_goes_to_waiting_room
      // entirely (verified via Zoom's own API validation error).
      expect(createPost![1].settings.waiting_room_options).toEqual({
        mode: 'custom',
        who_goes_to_waiting_room: 'users_not_on_invite',
      });

      const meetingPatch = findCall(
        mockedAxios.patch.mock.calls as PatchCall[],
        '/meetings/999',
      );
      expect(meetingPatch![1]).toEqual({
        settings: {
          waiting_room: true,
          waiting_room_options: {
            mode: 'custom',
            who_goes_to_waiting_room: 'users_not_on_invite',
          },
        },
      });

      const userSettingsPatch = findCall(
        mockedAxios.patch.mock.calls as PatchCall[],
        '/users/me/settings',
      );
      expect(
        userSettingsPatch![1].in_meeting.participants_to_place_in_waiting_room,
      ).toBe(2);
    });
  });

  describe('createMeetingForUser (instructor/mentor-hosted meetings — the actual bug)', () => {
    const hostEmail = 'jane.instructor@example.com';

    beforeEach(() => {
      mockedAxios.post.mockImplementation(((url: string) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve({
            data: { access_token: 'fake-token', expires_in: 3600 },
          });
        }
        return Promise.resolve({
          data: {
            id: 555,
            host_email: hostEmail,
            join_url: 'https://zoom.us/j/555',
            start_url: 'https://zoom.us/s/555',
          },
        });
      }) as any);
    });

    it('applies the waiting-room policy to the ACTUAL host, not "me" (regression: previously only worked for own meetings)', async () => {
      const result = await service.createMeetingForUser(hostEmail, {
        topic: 'Live class',
        type: 2,
        start_time: '2026-01-01T00:00:00Z',
        duration: 60,
        timezone: 'UTC',
        settings: {
          meeting_invitees: [{ email: 'student@example.com' }],
        },
      } as any);

      expect(result.success).toBe(true);

      const hostSettingsPatch = findCall(
        mockedAxios.patch.mock.calls as PatchCall[],
        `/users/${encodeURIComponent(hostEmail)}/settings`,
      );
      expect(hostSettingsPatch).toBeDefined();
      expect(
        hostSettingsPatch![1].in_meeting.participants_to_place_in_waiting_room,
      ).toBe(2);

      // Must NOT have patched 'me' instead of the real host.
      const meSettingsPatch = findCall(
        mockedAxios.patch.mock.calls as PatchCall[],
        '/users/me/settings',
      );
      expect(meSettingsPatch).toBeUndefined();
    });

    it('still enables meeting-level waiting_room with custom mode + users_not_on_invite', async () => {
      await service.createMeetingForUser(hostEmail, {
        topic: 'Live class',
        type: 2,
        start_time: '2026-01-01T00:00:00Z',
        duration: 60,
        timezone: 'UTC',
      } as any);

      const createPost = findCall(
        mockedAxios.post.mock.calls as PostCall[],
        `/users/${encodeURIComponent(hostEmail)}/meetings`,
      );
      expect(createPost![1].settings.waiting_room).toBe(true);
      expect(createPost![1].settings.waiting_room_options).toEqual({
        mode: 'custom',
        who_goes_to_waiting_room: 'users_not_on_invite',
      });

      const meetingPatch = findCall(
        mockedAxios.patch.mock.calls as PatchCall[],
        '/meetings/555',
      );
      expect(meetingPatch![1]).toEqual({
        settings: {
          waiting_room: true,
          waiting_room_options: {
            mode: 'custom',
            who_goes_to_waiting_room: 'users_not_on_invite',
          },
        },
      });
    });

    it('still fails fast on host mismatch (unrelated safeguard must survive the refactor)', async () => {
      mockedAxios.post.mockImplementation(((url: string) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve({
            data: { access_token: 'fake-token', expires_in: 3600 },
          });
        }
        return Promise.resolve({
          data: {
            id: 1,
            host_email: 'someone-else@example.com',
            join_url: 'https://zoom.us/j/1',
            start_url: 'https://zoom.us/s/1',
          },
        });
      }) as any);

      const result = await service.createMeetingForUser(
        'expected@example.com',
        {
          topic: 'Live class',
          type: 2,
          start_time: '2026-01-01T00:00:00Z',
          duration: 30,
          timezone: 'UTC',
        } as any,
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/host mismatch/i);
    });
  });

  it('always sends waiting_room_options with mode:custom — omitting mode makes Zoom silently ignore who_goes_to_waiting_room', async () => {
    await service.createMeeting({
      topic: 't1',
      type: 2,
      start_time: '2026-01-01T00:00:00Z',
      duration: 30,
      timezone: 'UTC',
    } as any);
    await service.createMeetingForUser('host2@example.com', {
      topic: 't2',
      type: 2,
      start_time: '2026-01-01T00:00:00Z',
      duration: 30,
      timezone: 'UTC',
    } as any);

    const allSettingsObjects = [
      ...mockedAxios.post.mock.calls
        .filter(
          ([url]: any) => typeof url === 'string' && url.includes('/meetings'),
        )
        .map(([, body]: any) => body.settings),
      ...mockedAxios.patch.mock.calls
        .filter(
          ([url]: any) => typeof url === 'string' && url.includes('/meetings/'),
        )
        .map(([, body]: any) => body.settings),
    ];

    expect(allSettingsObjects.length).toBeGreaterThan(0);
    for (const settings of allSettingsObjects) {
      expect(settings.waiting_room_options.mode).toBe('custom');
      expect(settings.waiting_room_options.who_goes_to_waiting_room).toBe(
        'users_not_on_invite',
      );
    }
  });
});
