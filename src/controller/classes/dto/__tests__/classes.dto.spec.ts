import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateDto,
  DTOsessionRecordViews,
  ScheduleDto,
  CreateSessionDto,
  reloadDto,
  updateSessionDto,
  AddLiveClassesAsChaptersDto,
  MergeClassesDto,
} from '../classes.dto.spec'; // The DTO file is misnamed with .spec.ts; import path adjusted accordingly

/**
 * Test Framework and Library:
 * - Framework: Jest (common in NestJS projects)
 * - Validation: class-validator
 * - Transformation: class-transformer
 *
 * These tests focus on DTO validation rules, covering happy paths, edge cases, and failures.
 */

describe('DTO Validation', () => {
  describe('CreateDto', () => {
    it('should pass with valid name', async () => {
      const dto = plainToInstance(CreateDto, { name: 'bootcamp name' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when name is missing', async () => {
      const dto = plainToInstance(CreateDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('name');
    });

    it('should fail when name is not a string', async () => {
      const dto = plainToInstance(CreateDto, { name: 123 });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'name')).toBe(true);
    });
  });

  describe('DTOsessionRecordViews', () => {
    it('should pass with valid sessionId', async () => {
      const dto = plainToInstance(DTOsessionRecordViews, { sessionId: 1 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when sessionId is missing', async () => {
      const dto = plainToInstance(DTOsessionRecordViews, {});
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'sessionId')).toBe(true);
    });

    it('should fail when sessionId is not a number', async () => {
      const dto = plainToInstance(DTOsessionRecordViews, { sessionId: '1' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'sessionId')).toBe(true);
    });
  });

  describe('ScheduleDto', () => {
    it('should pass with valid fields', async () => {
      const dto = plainToInstance(ScheduleDto, {
        startTime: '2022-03-01T00:00:00Z',
        endTime: '2022-03-01T01:00:00Z',
        day: 'Monday',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when startTime is missing', async () => {
      const dto = plainToInstance(ScheduleDto, {
        endTime: '2022-03-01T01:00:00Z',
        day: 'Monday',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'startTime')).toBe(true);
    });

    it('should fail when endTime is not a string', async () => {
      const dto = plainToInstance(ScheduleDto, {
        startTime: '2022-03-01T00:00:00Z',
        endTime: 123,
        day: 'Monday',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'endTime')).toBe(true);
    });

    it('should fail when day is empty', async () => {
      const dto = plainToInstance(ScheduleDto, {
        startTime: '2022-03-01T00:00:00Z',
        endTime: '2022-03-01T01:00:00Z',
        day: '',
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'day')).toBe(true);
    });
  });

  describe('CreateSessionDto', () => {
    const valid = {
      title: 'Live Event test from backend',
      batchId: 327,
      moduleId: 602,
      description: 'Description of the event',
      startDateTime: '2025-08-21T00:00:00Z',
      endDateTime: '2025-08-21T01:00:00Z',
      timeZone: 'Asia/Kolkata',
      isZoomMeet: true,
    };

    it('should pass with all valid fields', async () => {
      const dto = plainToInstance(CreateSessionDto, valid);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass when optional description and isZoomMeet are omitted', async () => {
      const { description, isZoomMeet, ...rest } = valid;
      const dto = plainToInstance(CreateSessionDto, rest);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      // Ensure optional field absence doesn't error
      expect((dto as any).description).toBeUndefined();
      expect((dto as any).isZoomMeet).toBeUndefined();
    });

    it('should fail when title is empty string', async () => {
      const dto = plainToInstance(CreateSessionDto, { ...valid, title: '' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'title')).toBe(true);
    });

    it('should fail when batchId is not a number', async () => {
      const dto = plainToInstance(CreateSessionDto, { ...valid, batchId: '327' as any });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'batchId')).toBe(true);
    });

    it('should fail when moduleId is missing', async () => {
      const { moduleId, ...rest } = valid;
      const dto = plainToInstance(CreateSessionDto, rest);
      // overriding: ensure missing moduleId triggers error
      (dto as any).moduleId = undefined;
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'moduleId')).toBe(true);
    });

    it('should fail when startDateTime is not an ISO date string', async () => {
      const dto = plainToInstance(CreateSessionDto, { ...valid, startDateTime: 'not-a-date' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'startDateTime')).toBe(true);
    });

    it('should fail when endDateTime is not an ISO date string', async () => {
      const dto = plainToInstance(CreateSessionDto, { ...valid, endDateTime: '2025/08/21' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'endDateTime')).toBe(true);
    });

    it('should fail when timeZone is empty', async () => {
      const dto = plainToInstance(CreateSessionDto, { ...valid, timeZone: '' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'timeZone')).toBe(true);
    });

    it('should fail when isZoomMeet is not a boolean', async () => {
      const dto = plainToInstance(CreateSessionDto, { ...valid, isZoomMeet: 'true' as any });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'isZoomMeet')).toBe(true);
    });
  });

  describe('reloadDto', () => {
    it('should pass with a non-empty array of meetingIds (strings)', async () => {
      const dto = plainToInstance(reloadDto, { meetingIds: ['id1', 'id2'] });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when meetingIds is missing', async () => {
      const dto = plainToInstance(reloadDto, {});
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'meetingIds')).toBe(true);
    });

    it('should fail when meetingIds is not an array', async () => {
      const dto = plainToInstance(reloadDto, { meetingIds: 'id1' as any });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'meetingIds')).toBe(true);
    });
  });

  describe('updateSessionDto', () => {
    const valid = {
      title: 'python class',
      description: 'Description of the event',
      startDateTime: '2022-03-01T00:00:00Z',
      endDateTime: '2022-03-01T01:00:00Z',
    };

    it('should pass with all valid fields', async () => {
      const dto = plainToInstance(updateSessionDto, valid);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass when optional description is omitted', async () => {
      const { description, ...rest } = valid;
      const dto = plainToInstance(updateSessionDto, rest);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when title is missing', async () => {
      const { title, ...rest } = valid;
      const dto = plainToInstance(updateSessionDto, rest as any);
      (dto as any).title = undefined;
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'title')).toBe(true);
    });

    it('should fail when startDateTime is invalid', async () => {
      const dto = plainToInstance(updateSessionDto, { ...valid, startDateTime: 'bad' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'startDateTime')).toBe(true);
    });

    it('should fail when endDateTime is invalid', async () => {
      const dto = plainToInstance(updateSessionDto, { ...valid, endDateTime: '03/01/2022' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'endDateTime')).toBe(true);
    });
  });

  describe('AddLiveClassesAsChaptersDto', () => {
    it('should pass with numeric sessionIds array and moduleId', async () => {
      const dto = plainToInstance(AddLiveClassesAsChaptersDto, {
        sessionIds: [1, 2, 3],
        moduleId: 10,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when sessionIds contains non-numeric values', async () => {
      const dto = plainToInstance(AddLiveClassesAsChaptersDto, {
        sessionIds: [1, '2', 3] as any,
        moduleId: 10,
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'sessionIds')).toBe(true);
    });

    it('should fail when moduleId is not a number', async () => {
      const dto = plainToInstance(AddLiveClassesAsChaptersDto, {
        sessionIds: [1, 2],
        moduleId: '10' as any,
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'moduleId')).toBe(true);
    });
  });

  describe('MergeClassesDto', () => {
    it('should pass with valid childSessionId and parentSessionId', async () => {
      const dto = plainToInstance(MergeClassesDto, {
        childSessionId: 100,
        parentSessionId: 200,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when childSessionId is missing', async () => {
      const dto = plainToInstance(MergeClassesDto, {
        parentSessionId: 200,
      } as any);
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'childSessionId')).toBe(true);
    });

    it('should fail when parentSessionId is missing', async () => {
      const dto = plainToInstance(MergeClassesDto, {
        childSessionId: 100,
      } as any);
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'parentSessionId')).toBe(true);
    });

    it('should fail when ids are not numbers', async () => {
      const dto = plainToInstance(MergeClassesDto, {
        childSessionId: '100' as any,
        parentSessionId: '200' as any,
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'childSessionId')).toBe(true);
      expect(errors.some(e => e.property === 'parentSessionId')).toBe(true);
    });
  });
});