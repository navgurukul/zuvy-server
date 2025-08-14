import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ZoomController } from './zoom.controller';
import { ZoomService } from './zoom.service';

describe('ZoomController', () => {
  let controller: ZoomController;

  // Create a strict mock for ZoomService so we control all interactions.
  const mockZoomService = {
    createMeeting: jest.fn(),
    getMeeting: jest.fn(),
    deleteMeeting: jest.fn(),
    listMeetings: jest.fn(),
    updateMeeting: jest.fn(),
    addRegistrant: jest.fn(),
    listRegistrants: jest.fn(),
    removeRegistrant: jest.fn(),
    generateJoinToken: jest.fn(),
    refreshAccessToken: jest.fn(),
  } as unknown as jest.Mocked<ZoomService> & Record<string, jest.Mock>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ZoomController],
      providers: [
        { provide: ZoomService, useValue: mockZoomService },
      ],
    }).compile();

    controller = module.get<ZoomController>(ZoomController);
  });

  describe('createMeeting', () => {
    it('should create a meeting and return its details (happy path)', async () => {
      const dto = { topic: 'Standup', start_time: '2025-08-14T10:00:00Z', duration: 15, password: '123456' };
      const result = { id: '987654321', join_url: 'https://zoom.example/j/987654321', start_url: 'https://zoom.example/s/987654321' };
      (mockZoomService.createMeeting as jest.Mock).mockResolvedValueOnce(result);

      const response = await (controller as any).createMeeting(dto);

      expect(mockZoomService.createMeeting).toHaveBeenCalledWith(dto);
      expect(response).toEqual(result);
    });

    it('should validate and handle missing topic gracefully (edge case)', async () => {
      const dto: any = { start_time: '2025-08-14T10:00:00Z', duration: 15 };
      (mockZoomService.createMeeting as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('Invalid topic'), { status: HttpStatus.BAD_REQUEST }));

      await expect((controller as any).createMeeting(dto)).rejects.toThrow('Invalid topic');
      expect(mockZoomService.createMeeting).toHaveBeenCalledWith(dto);
    });

    it('should surface service errors (failure path)', async () => {
      const dto = { topic: 'Sprint Planning', start_time: 'bad-date', duration: 60 };
      (mockZoomService.createMeeting as jest.Mock).mockRejectedValueOnce(new Error('Zoom API error: invalid start_time'));

      await expect((controller as any).createMeeting(dto)).rejects.toThrow('Zoom API error: invalid start_time');
    });
  });

  describe('getMeeting', () => {
    it('should return meeting details by id', async () => {
      const meetingId = '123456789';
      const details = { id: meetingId, topic: 'Demo', start_time: '2025-08-14T10:00:00Z' };
      (mockZoomService.getMeeting as jest.Mock).mockResolvedValueOnce(details);

      const res = await (controller as any).getMeeting(meetingId);

      expect(mockZoomService.getMeeting).toHaveBeenCalledWith(meetingId);
      expect(res).toEqual(details);
    });

    it('should throw when meeting not found', async () => {
      const meetingId = 'missing';
      (mockZoomService.getMeeting as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: HttpStatus.NOT_FOUND }));

      await expect((controller as any).getMeeting(meetingId)).rejects.toThrow('Not Found');
      expect(mockZoomService.getMeeting).toHaveBeenCalledWith(meetingId);
    });
  });

  describe('deleteMeeting', () => {
    it('should delete meeting and return void/ack', async () => {
      const meetingId = 'to-del';
      (mockZoomService.deleteMeeting as jest.Mock).mockResolvedValueOnce(undefined);

      const res = await (controller as any).deleteMeeting(meetingId);

      expect(mockZoomService.deleteMeeting).toHaveBeenCalledWith(meetingId);
      expect(res).toBeUndefined();
    });

    it('should surface service deletion errors', async () => {
      const meetingId = 'to-del';
      (mockZoomService.deleteMeeting as jest.Mock).mockRejectedValueOnce(new Error('Delete failed'));

      await expect((controller as any).deleteMeeting(meetingId)).rejects.toThrow('Delete failed');
    });
  });

  describe('listMeetings', () => {
    it('should list meetings for a user with pagination', async () => {
      const userId = 'user_1';
      const query = { page_size: 30, next_page_token: 'abc' };
      const result = { meetings: [{ id: '1' }, { id: '2' }], next_page_token: 'def' };
      (mockZoomService.listMeetings as jest.Mock).mockResolvedValueOnce(result);

      const res = await (controller as any).listMeetings(userId, query as any);

      expect(mockZoomService.listMeetings).toHaveBeenCalledWith(userId, query);
      expect(res).toEqual(result);
    });

    it('should handle empty results', async () => {
      const userId = 'user_2';
      const query = { page_size: 30 };
      const result = { meetings: [], next_page_token: undefined };
      (mockZoomService.listMeetings as jest.Mock).mockResolvedValueOnce(result);

      const res = await (controller as any).listMeetings(userId, query as any);

      expect(res).toEqual(result);
    });
  });

  describe('updateMeeting', () => {
    it('should update meeting settings', async () => {
      const meetingId = 'm1';
      const dto = { topic: 'Updated', duration: 45 };
      const result = { id: meetingId, topic: 'Updated', duration: 45 };
      (mockZoomService.updateMeeting as jest.Mock).mockResolvedValueOnce(result);

      const res = await (controller as any).updateMeeting(meetingId, dto);

      expect(mockZoomService.updateMeeting).toHaveBeenCalledWith(meetingId, dto);
      expect(res).toEqual(result);
    });

    it('should surface validation errors', async () => {
      const meetingId = 'm1';
      const dto = { duration: -10 };
      (mockZoomService.updateMeeting as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('Invalid duration'), { status: HttpStatus.BAD_REQUEST }));

      await expect((controller as any).updateMeeting(meetingId, dto)).rejects.toThrow('Invalid duration');
    });
  });

  describe('registrants', () => {
    it('should add a registrant', async () => {
      const meetingId = 'm1';
      const dto = { email: 'a@example.com', first_name: 'A', last_name: 'B' };
      const result = { id: 'reg-1', status: 'approved' };
      (mockZoomService.addRegistrant as jest.Mock).mockResolvedValueOnce(result);

      const res = await (controller as any).addRegistrant(meetingId, dto);

      expect(mockZoomService.addRegistrant).toHaveBeenCalledWith(meetingId, dto);
      expect(res).toEqual(result);
    });

    it('should list registrants', async () => {
      const meetingId = 'm1';
      const result = { registrants: [{ id: 'r1' }], page_size: 30 };
      (mockZoomService.listRegistrants as jest.Mock).mockResolvedValueOnce(result);

      const res = await (controller as any).listRegistrants(meetingId, { page_size: 30 } as any);

      expect(mockZoomService.listRegistrants).toHaveBeenCalledWith(meetingId, { page_size: 30 });
      expect(res).toEqual(result);
    });

    it('should remove registrant', async () => {
      const meetingId = 'm1';
      const registrantId = 'r1';
      (mockZoomService.removeRegistrant as jest.Mock).mockResolvedValueOnce(undefined);

      const res = await (controller as any).removeRegistrant(meetingId, registrantId);

      expect(mockZoomService.removeRegistrant).toHaveBeenCalledWith(meetingId, registrantId);
      expect(res).toBeUndefined();
    });
  });

  describe('tokens', () => {
    it('should generate a join token for meeting and participant', async () => {
      const meetingId = 'm1';
      const participantId = 'p1';
      const token = 'jwt-token';
      (mockZoomService.generateJoinToken as jest.Mock).mockResolvedValueOnce({ token, expires_in: 3600 });

      const res = await (controller as any).generateJoinToken(meetingId, participantId);

      expect(mockZoomService.generateJoinToken).toHaveBeenCalledWith(meetingId, participantId);
      expect(res).toEqual({ token, expires_in: 3600 });
    });

    it('should refresh access token', async () => {
      (mockZoomService.refreshAccessToken as jest.Mock).mockResolvedValueOnce({ access_token: 'new-access', expires_in: 3600 });

      const res = await (controller as any).refreshAccessToken();

      expect(mockZoomService.refreshAccessToken).toHaveBeenCalled();
      expect(res).toEqual({ access_token: 'new-access', expires_in: 3600 });
    });
  });

  // Defensive checks for unexpected inputs. Controller should pass through and let service validate.
  describe('defensive inputs', () => {
    it('should pass nullish meeting id to service and let it throw', async () => {
      (mockZoomService.getMeeting as jest.Mock).mockRejectedValueOnce(new Error('Invalid id'));
      await expect((controller as any).getMeeting(undefined)).rejects.toThrow('Invalid id');
      expect(mockZoomService.getMeeting).toHaveBeenCalledWith(undefined);
    });

    it('should pass empty body to createMeeting and surface error', async () => {
      (mockZoomService.createMeeting as jest.Mock).mockRejectedValueOnce(new Error('Invalid payload'));
      await expect((controller as any).createMeeting({})).rejects.toThrow('Invalid payload');
      expect(mockZoomService.createMeeting).toHaveBeenCalledWith({});
    });
  });
});