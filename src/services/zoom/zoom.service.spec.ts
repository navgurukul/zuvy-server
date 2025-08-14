import axios, { AxiosResponse } from 'axios';
import { Test } from '@nestjs/testing';
import { ZoomService, ZoomMeetingRequest, ZoomAttendanceResponse } from './zoom.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ZoomService', () => {
  let service: ZoomService;

  // Silence NestJS Logger methods to keep test output clean
  const originalLog = console.log;
  const originalError = console.error;
  beforeAll(() => {
    console.log = jest.fn() as any;
    console.error = jest.fn() as any;
  });
  afterAll(() => {
    console.log = originalLog;
    console.error = originalError;
  });

  beforeEach(async () => {
    // Set environment variables used by Zoom token generation
    process.env.ZOOM_CLIENT_ID = 'client_id';
    process.env.ZOOM_CLIENT_SECRET = 'client_secret';
    process.env.ZOOM_ACCOUNT_ID = 'account_id';

    const moduleRef = await Test.createTestingModule({
      providers: [ZoomService],
    }).compile();

    service = moduleRef.get(ZoomService);

    // For most tests, avoid running the real token request on construction
    // by stubbing generateAccessToken and setting a dummy token.
    (service as any).generateAccessToken = jest.fn().mockResolvedValue(undefined);
    (service as any).accessToken = 'test-access-token';
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should set accessToken on success', async () => {
      // Restore the real method for this test
      const moduleRef = await Test.createTestingModule({
        providers: [ZoomService],
      }).compile();
      const realService = moduleRef.get(ZoomService);
      // Stub axios.post to return a fake token
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'new-token' },
      } as any as AxiosResponse);

      await (realService as any).generateAccessToken();

      expect((realService as any).accessToken).toBe('new-token');
      // ensure Authorization header would be formed with the new token
      const headers = (realService as any).getHeaders();
      expect(headers.Authorization).toBe('Bearer new-token');
    });

    it('should throw on failure and log error', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [ZoomService],
      }).compile();
      const realService = moduleRef.get(ZoomService);
      const error = Object.assign(new Error('boom'), {
        response: { data: { message: 'invalid credentials' } },
      });
      mockedAxios.post.mockRejectedValueOnce(error);

      await expect((realService as any).generateAccessToken()).rejects.toThrow(
        'Failed to generate Zoom access token.',
      );
    });
  });

  describe('getHeaders', () => {
    it('should return authorization and content-type headers', () => {
      (service as any).accessToken = 'abc123';
      const headers = (service as any).getHeaders();
      expect(headers).toEqual({
        Authorization: 'Bearer abc123',
        'Content-Type': 'application/json',
      });
    });
  });

  describe('createMeeting', () => {
    const baseUrl = 'https://api.zoom.us/v2';

    it('should create meeting and return success with data', async () => {
      const req: ZoomMeetingRequest = {
        topic: 'Test',
        type: 2,
        start_time: '2025-01-01T10:00:00Z',
        duration: 60,
        timezone: 'UTC',
      };

      const respData = {
        id: 12345,
        uuid: 'uuid',
        host_id: 'host',
        host_email: 'host@example.com',
        topic: 'Test',
        type: 2,
        status: 'waiting',
        start_time: req.start_time,
        duration: req.duration,
        timezone: req.timezone,
        agenda: '',
        created_at: '2025-01-01T00:00:00Z',
        start_url: 'start-url',
        join_url: 'join-url',
        password: 'pwd',
        h323_password: '',
        pstn_password: '',
        encrypted_password: '',
      };

      mockedAxios.post.mockResolvedValueOnce({ data: respData } as any as AxiosResponse);

      const result = await service.createMeeting(req);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseUrl}/users/me/meetings`,
        req,
        { headers: (service as any).getHeaders() },
      );
      expect(result).toEqual({ success: true, data: respData });
    });

    it('should handle axios error and return failure with message', async () => {
      const req: ZoomMeetingRequest = {
        topic: 'Test',
        type: 2,
        start_time: '2025-01-01T10:00:00Z',
        duration: 60,
        timezone: 'UTC',
      };
      const error = Object.assign(new Error('bad request'), {
        response: { data: { message: 'Invalid payload' } },
      });
      mockedAxios.post.mockRejectedValueOnce(error);

      const result = await service.createMeeting(req);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create Zoom meeting');
      expect(result.error).toContain('Invalid payload');
    });
  });

  describe('updateMeeting', () => {
    it('should patch meeting successfully', async () => {
      mockedAxios.patch.mockResolvedValueOnce({ status: 204 } as any);

      await expect(service.updateMeeting('meeting-1', { topic: 'New Topic' })).resolves.toBeUndefined();

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        'https://api.zoom.us/v2/meetings/meeting-1',
        { topic: 'New Topic' },
        { headers: (service as any).getHeaders() },
      );
    });

    it('should throw on failure and include message', async () => {
      const error = Object.assign(new Error('not found'), {
        response: { data: { message: 'Meeting not found' } },
      });
      mockedAxios.patch.mockRejectedValueOnce(error);

      await expect(service.updateMeeting('missing', { topic: 'X' })).rejects.toThrow(
        'Failed to update Zoom meeting: Meeting not found',
      );
    });
  });

  describe('deleteMeeting', () => {
    it('should delete meeting successfully', async () => {
      mockedAxios.delete.mockResolvedValueOnce({ status: 204 } as any);

      await expect(service.deleteMeeting('meeting-1')).resolves.toBeUndefined();

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        'https://api.zoom.us/v2/meetings/meeting-1',
        { headers: (service as any).getHeaders() },
      );
    });

    it('should throw on failure and include message', async () => {
      const error = Object.assign(new Error('not found'), {
        response: { data: { message: 'Meeting not found' } },
      });
      mockedAxios.delete.mockRejectedValueOnce(error);

      await expect(service.deleteMeeting('missing')).rejects.toThrow(
        'Failed to delete Zoom meeting: Meeting not found',
      );
    });
  });

  describe('getMeeting', () => {
    it('should return meeting data on success', async () => {
      const resp = { data: { id: 1 } } as any as AxiosResponse;
      mockedAxios.get.mockResolvedValueOnce(resp);

      const result = await service.getMeeting('1');
      expect(result).toEqual({ success: true, data: resp.data });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.zoom.us/v2/meetings/1',
        { headers: (service as any).getHeaders() },
      );
    });

    it('should return failure object on error', async () => {
      const error = Object.assign(new Error('nah'), {
        response: { data: { message: 'Nope' } },
      });
      mockedAxios.get.mockRejectedValueOnce(error);

      const result = await service.getMeeting('2');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch Zoom meeting: Nope');
    });
  });

  describe('getMeetingParticipants', () => {
    it('should URL-encode UUID and return attendance data', async () => {
      const uuid = 'abc/def==';
      const encoded = encodeURIComponent(uuid);
      const data: ZoomAttendanceResponse = {
        uuid: 'x',
        id: 1,
        topic: 't',
        host: 'h',
        email: 'e',
        user_type: 'u',
        start_time: 's',
        end_time: 'e',
        duration: 10,
        participants: [
          {
            id: 'p1',
            user_id: 'u1',
            name: 'n1',
            user_email: 'a@b.com',
            join_time: 'jt',
            leave_time: 'lt',
            duration: 10,
            attentiveness_score: '100',
          },
        ],
      };
      mockedAxios.get.mockResolvedValueOnce({ data } as any as AxiosResponse);

      const result = await service.getMeetingParticipants(uuid);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `https://api.zoom.us/v2/report/meetings/${encoded}/participants`,
        { headers: (service as any).getHeaders() },
      );
      expect(result).toBe(data);
    });

    it('should throw on error with message', async () => {
      const error = Object.assign(new Error('boom'), {
        response: { data: { message: 'Failed' } },
      });
      mockedAxios.get.mockRejectedValueOnce(error);

      await expect(service.getMeetingParticipants('uuid')).rejects.toThrow(
        'Failed to fetch Zoom meeting participants: Failed',
      );
    });
  });

  describe('getMeetingRecordings', () => {
    it('should return recordings data on success', async () => {
      const data = { recording_files: [] };
      mockedAxios.get.mockResolvedValueOnce({ data } as any as AxiosResponse);

      const result = await service.getMeetingRecordings('123');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.zoom.us/v2/meetings/123/recordings',
        { headers: (service as any).getHeaders() },
      );
      expect(result).toBe(data);
    });

    it('should throw on error', async () => {
      const error = Object.assign(new Error('boom'), {
        response: { data: { message: 'access denied' } },
      });
      mockedAxios.get.mockRejectedValueOnce(error);

      await expect(service.getMeetingRecordings('123')).rejects.toThrow(
        'Failed to fetch Zoom meeting recordings: access denied',
      );
    });
  });

  describe('createRecurringMeetings', () => {
    it('should map days to zoom weekly_days and create a recurring meeting', async () => {
      const base: ZoomMeetingRequest = {
        topic: 'Class',
        type: 2,
        start_time: '2025-01-01T12:00:00Z',
        duration: 45,
        timezone: 'UTC',
      };
      // Spy on createMeeting to validate payload and return success
      const spy = jest.spyOn(service, 'createMeeting').mockResolvedValue({
        success: true,
        data: {
          uuid: 'u',
          id: 1,
          host_id: 'h',
          host_email: 'e',
          topic: base.topic,
          type: 8,
          status: 'waiting',
          start_time: base.start_time,
          duration: base.duration,
          timezone: base.timezone,
          agenda: '',
          created_at: 'now',
          start_url: 'start',
          join_url: 'join',
          password: '',
          h323_password: '',
          pstn_password: '',
          encrypted_password: '',
        },
      });

      const result = await service.createRecurringMeetings(base, ['Monday', 'Wednesday', 'Friday'], 10);

      expect(spy).toHaveBeenCalledTimes(1);
      const payload = spy.mock.calls[0][0];
      expect(payload.type).toBe(8);
      expect(payload.recurrence).toEqual({
        type: 2,
        repeat_interval: 1,
        weekly_days: '2,4,6',
        end_times: 10,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should throw if createMeeting returns failure', async () => {
      jest.spyOn(service, 'createMeeting').mockResolvedValue({
        success: false,
        error: 'network error',
      });

      await expect(
        service.createRecurringMeetings(
          {
            topic: 'X',
            type: 2,
            start_time: '2025-01-01T00:00:00Z',
            duration: 30,
            timezone: 'UTC',
          },
          ['Sunday'],
          1,
        ),
      ).rejects.toThrow('network error');
    });
  });

  describe('calculateAttendance', () => {
    it('should return empty array when participants is undefined or empty', () => {
      // @ts-expect-error testing input guard
      expect(service.calculateAttendance(undefined)).toEqual([]);
      expect(service.calculateAttendance([])).toEqual([]);
    });

    it('should mark participants present/absent based on threshold (default 0.75)', () => {
      const participants: ZoomAttendanceResponse['participants'] = [
        { id: '1', user_id: '1', name: 'Host', user_email: 'host@x.com', join_time: '', leave_time: '', duration: 100, attentiveness_score: '100' },
        { id: '2', user_id: '2', name: 'A', user_email: 'a@x.com', join_time: '', leave_time: '', duration: 75, attentiveness_score: '80' },
        { id: '3', user_id: '3', name: 'B', user_email: 'b@x.com', join_time: '', leave_time: '', duration: 74, attentiveness_score: '90' },
      ];

      const result = service.calculateAttendance(participants);
      const byEmail = Object.fromEntries(result.map(r => [r.email, r]));

      expect(byEmail['host@x.com'].attendance).toBe('present'); // max
      expect(byEmail['a@x.com'].attendance).toBe('present'); // 75 >= 100 * 0.75
      expect(byEmail['b@x.com'].attendance).toBe('absent');  // 74 < 75
    });

    it('should respect a custom duration threshold', () => {
      const participants: ZoomAttendanceResponse['participants'] = [
        { id: '1', user_id: '1', name: 'Host', user_email: 'host@x.com', join_time: '', leave_time: '', duration: 40, attentiveness_score: '100' },
        { id: '2', user_id: '2', name: 'A', user_email: 'a@x.com', join_time: '', leave_time: '', duration: 20, attentiveness_score: '50' },
      ];

      const result = service.calculateAttendance(participants, 0.5);
      expect(result.find(r => r.email === 'a@x.com')!.attendance).toBe('present'); // 20 >= 40 * 0.5
    });
  });
});