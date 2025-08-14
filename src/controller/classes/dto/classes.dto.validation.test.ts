import 'reflect-metadata';
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
} from './classes.dto.spec'; // Importing from the provided file which contains the DTO classes

// Testing library and framework in use: Jest with ts-jest (NestJS standard).
// These tests validate class-validator rules across DTOs, covering happy paths, edge cases, and failure conditions.

describe('DTO Validation', () => {
  describe('CreateDto', () => {
    it('valid when name is a non-empty string', async () => {
      const dto = new CreateDto();
      dto.name = 'bootcamp name';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('invalid when name is missing', async () => {
      const dto = new CreateDto();
      // @ts-expect-error testing missing prop
      dto.name = undefined;
      const errors = await validate(dto);
      expect(errors).not.toHaveLength(0);
      expect(errors[0].constraints).toMatchObject({ isNotEmpty: expect.any(String), isString: expect.any(String) });
    });

    it('invalid when name is empty string', async () => {
      const dto = new CreateDto();
      // @ts-ignore
      dto.name = '';
      const errors = await validate(dto);
      expect(errors).not.toHaveLength(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('invalid when name is not a string', async () => {
      const dto = new CreateDto();
      // @ts-ignore
      dto.name = 123 as any;
      const errors = await validate(dto);
      expect(errors).not.toHaveLength(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('DTOsessionRecordViews', () => {
    it('valid when sessionId is a number', async () => {
      const dto = new DTOsessionRecordViews();
      dto.sessionId = 1;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('invalid when sessionId missing', async () => {
      const dto = new DTOsessionRecordViews();
      const errors = await validate(dto);
      expect(errors).not.toHaveLength(0);
      expect(errors[0].constraints).toMatchObject({ isNotEmpty: expect.any(String), isNumber: expect.any(String) });
    });

    it('invalid when sessionId is not a number', async () => {
      const dto = new DTOsessionRecordViews();
      // @ts-ignore
      dto.sessionId = '1';
      const errors = await validate(dto);
      expect(errors).not.toHaveLength(0);
      expect(errors[0].constraints).toHaveProperty('isNumber');
    });
  });

  describe('ScheduleDto', () => {
    it('valid when all fields provided appropriately', async () => {
      const dto = new ScheduleDto();
      dto.startTime = '2022-03-01T00:00:00Z' as any;
      dto.endTime = '2022-03-01T01:00:00Z' as any;
      dto.day = 'Monday';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('invalid when startTime missing', async () => {
      const dto = new ScheduleDto();
      // @ts-ignore
      dto.endTime = '2022-03-01T01:00:00Z';
      dto.day = 'Monday';
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'startTime');
      expect(prop?.constraints).toMatchObject({ isNotEmpty: expect.any(String), isString: expect.any(String) });
    });

    it('invalid when endTime missing', async () => {
      const dto = new ScheduleDto();
      dto.startTime = '2022-03-01T00:00:00Z' as any;
      dto.day = 'Monday';
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'endTime');
      expect(prop?.constraints).toMatchObject({ isNotEmpty: expect.any(String), isString: expect.any(String) });
    });

    it('invalid when day missing', async () => {
      const dto = new ScheduleDto();
      dto.startTime = '2022-03-01T00:00:00Z' as any;
      dto.endTime = '2022-03-01T01:00:00Z' as any;
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'day');
      expect(prop?.constraints).toHaveProperty('isNotEmpty');
    });

    it('invalid when startTime is not a string', async () => {
      const dto = new ScheduleDto();
      // @ts-ignore
      dto.startTime = 123 as any;
      dto.endTime = '2022-03-01T01:00:00Z' as any;
      dto.day = 'Tuesday';
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'startTime');
      expect(prop?.constraints).toHaveProperty('isString');
    });
  });

  describe('CreateSessionDto', () => {
    const validBase = () => {
      const dto = new CreateSessionDto();
      dto.title = 'Live Event';
      dto.moduleId = 602;
      dto.startDateTime = '2025-08-21T00:00:00Z';
      dto.endDateTime = '2025-08-21T01:00:00Z';
      dto.timeZone = 'Asia/Kolkata';
      return dto;
    };

    it('valid minimal payload with single batchId', async () => {
      const dto = validBase();
      dto.batchId = 327;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('valid minimal payload with batchIds array', async () => {
      const dto = validBase();
      dto.batchIds = [327, 328];
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('valid when both batchId and batchIds are omitted (validators do not enforce mutual requirement here)', async () => {
      const dto = validBase();
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('invalid when title missing', async () => {
      const dto = validBase();
      // @ts-ignore
      dto.title = undefined;
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'title');
      expect(prop?.constraints).toMatchObject({ isNotEmpty: expect.any(String), isString: expect.any(String) });
    });

    it('invalid when moduleId missing', async () => {
      const dto = validBase();
      // @ts-ignore
      dto.moduleId = undefined;
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'moduleId');
      expect(prop?.constraints).toMatchObject({ isNotEmpty: expect.any(String), isNumber: expect.any(String) });
    });

    it('invalid when startDateTime is not an ISO date string', async () => {
      const dto = validBase();
      dto.startDateTime = 'not-a-date';
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'startDateTime');
      expect(prop?.constraints).toHaveProperty('isDateString');
    });

    it('invalid when endDateTime is not an ISO date string', async () => {
      const dto = validBase();
      dto.endDateTime = '1234';
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'endDateTime');
      expect(prop?.constraints).toHaveProperty('isDateString');
    });

    it('invalid when timeZone missing', async () => {
      const dto = validBase();
      // @ts-ignore
      dto.timeZone = undefined;
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'timeZone');
      expect(prop?.constraints).toMatchObject({ isNotEmpty: expect.any(String), isString: expect.any(String) });
    });

    it('invalid when batchId is not a number', async () => {
      const dto = validBase();
      // @ts-ignore
      dto.batchId = '327';
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'batchId');
      expect(prop?.constraints).toHaveProperty('isNumber');
    });

    it('invalid when batchIds contains non-number', async () => {
      const dto = validBase();
      // @ts-ignore
      dto.batchIds = [327, 'x' as any];
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'batchIds');
      expect(prop?.children?.[1]?.constraints).toHaveProperty('isNumber');
    });

    it('valid when secondBatchId provided as number', async () => {
      const dto = validBase();
      dto.secondBatchId = 555;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('invalid when isZoomMeet set to a non-boolean', async () => {
      const dto = validBase();
      // @ts-ignore
      dto.isZoomMeet = 'true' as any;
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'isZoomMeet');
      expect(prop?.constraints).toHaveProperty('isBoolean');
    });
  });

  describe('reloadDto', () => {
    it('valid when meetingIds is a non-empty array (not enforcing non-empty via validators though)', async () => {
      const dto = new reloadDto();
      dto.meetingIds = ['id1', 'id2'];
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('invalid when meetingIds missing', async () => {
      const dto = new reloadDto();
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'meetingIds');
      expect(prop?.constraints).toMatchObject({ isNotEmpty: expect.any(String), isArray: expect.any(String) });
    });

    it('invalid when meetingIds is not array', async () => {
      const dto = new reloadDto();
      // @ts-ignore
      dto.meetingIds = 'not-array' as any;
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'meetingIds');
      expect(prop?.constraints).toHaveProperty('isArray');
    });
  });

  describe('updateSessionDto', () => {
    const validBase = () => {
      const dto = new updateSessionDto();
      dto.title = 'python class';
      dto.description = 'Description of the event';
      dto.startDateTime = '2022-03-01T00:00:00Z';
      dto.endDateTime = '2022-03-01T01:00:00Z';
      return dto;
    };

    it('valid when all required fields are present', async () => {
      const dto = validBase();
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('invalid when title missing', async () => {
      const dto = validBase();
      // @ts-ignore
      dto.title = undefined;
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'title');
      expect(prop?.constraints).toMatchObject({ isNotEmpty: expect.any(String), isString: expect.any(String) });
    });

    it('description is optional and may be undefined', async () => {
      const dto = validBase();
      dto.description = undefined;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('invalid when startDateTime is not a date string', async () => {
      const dto = validBase();
      dto.startDateTime = 'bad';
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'startDateTime');
      expect(prop?.constraints).toHaveProperty('isDateString');
    });

    it('invalid when endDateTime is not a date string', async () => {
      const dto = validBase();
      dto.endDateTime = 'bad';
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'endDateTime');
      expect(prop?.constraints).toHaveProperty('isDateString');
    });
  });

  describe('AddLiveClassesAsChaptersDto', () => {
    it('valid when sessionIds number[] and moduleId number', async () => {
      const dto = new AddLiveClassesAsChaptersDto();
      dto.sessionIds = [1, 2, 3];
      dto.moduleId = 10;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('invalid when sessionIds contains non-number', async () => {
      const dto = new AddLiveClassesAsChaptersDto();
      // @ts-ignore
      dto.sessionIds = [1, 'a', 3] as any;
      dto.moduleId = 10;
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'sessionIds');
      // children index 1 corresponds to the offending element 'a'
      expect(prop?.children?.[1]?.constraints).toHaveProperty('isNumber');
    });

    it('invalid when moduleId is not a number', async () => {
      const dto = new AddLiveClassesAsChaptersDto();
      dto.sessionIds = [1, 2, 3];
      // @ts-ignore
      dto.moduleId = '10' as any;
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'moduleId');
      expect(prop?.constraints).toHaveProperty('isNumber');
    });
  });

  describe('MergeClassesDto', () => {
    it('valid when both childSessionId and parentSessionId are numbers', async () => {
      const dto = new MergeClassesDto();
      dto.childSessionId = 123;
      dto.parentSessionId = 456;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('invalid when childSessionId missing', async () => {
      const dto = new MergeClassesDto();
      // @ts-ignore
      dto.parentSessionId = 456;
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'childSessionId');
      expect(prop?.constraints).toMatchObject({ isNotEmpty: expect.any(String), isNumber: expect.any(String) });
    });

    it('invalid when parentSessionId missing', async () => {
      const dto = new MergeClassesDto();
      // @ts-ignore
      dto.childSessionId = 123;
      const errors = await validate(dto);
      const prop = errors.find(e => e.property === 'parentSessionId');
      expect(prop?.constraints).toMatchObject({ isNotEmpty: expect.any(String), isNumber: expect.any(String) });
    });

    it('invalid when either id is not a number', async () => {
      const dto = new MergeClassesDto();
      // @ts-ignore
      dto.childSessionId = 'x' as any;
      // @ts-ignore
      dto.parentSessionId = 'y' as any;
      const errors = await validate(dto);
      const child = errors.find(e => e.property === 'childSessionId');
      const parent = errors.find(e => e.property === 'parentSessionId');
      expect(child?.constraints).toHaveProperty('isNumber');
      expect(parent?.constraints).toHaveProperty('isNumber');
    });
  });
});