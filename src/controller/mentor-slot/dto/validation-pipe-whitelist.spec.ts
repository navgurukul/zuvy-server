// The controllers are imported only to read their decorator metadata. Their
// services, guards and interceptor are stubbed so jest doesn't load the full
// import graph, which reaches rbac.permission.service.ts and its unrelated
// pre-existing type errors.
jest.mock('../mentor-slot.service', () => ({ MentorSlotService: class {} }));
jest.mock('../session/session.service', () => ({ SessionService: class {} }));
jest.mock('../metrics/mentor-metrics.service', () => ({
  MentorMetricsService: class {},
}));
jest.mock('../recurrence/mentor-recurrence.service', () => ({
  MentorRecurrenceService: class {},
}));
jest.mock('../public/mentor-public.service', () => ({
  MentorPublicService: class {},
}));
jest.mock('src/auth/guards/jwt-auth.guard', () => ({ JwtAuthGuard: class {} }));
jest.mock('src/rbac/guards/permissions.guard', () => ({
  PermissionsGuard: class {},
}));
jest.mock('src/trackinglog/interceptors/track-action.interceptor', () => ({
  TrackActionInterceptor: class {},
}));

import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { PIPES_METADATA } from '@nestjs/common/constants';
import { UpdateMentorProfileDto } from './update-mentor-profile.dto';
import { CreateSlotDto } from './create-slot.dto';
import { MentorSearchDto } from '../public/dto/mentor-search.dto';
import { MentorSlotController } from '../mentor-slot.controller';
import { InstructorMentorSlotController } from '../instructor-mentor-slot.controller';
import { StudentMentorSlotController } from '../student-mentor-slot.controller';

// The mentor controllers run ValidationPipe({ whitelist: true }) at class
// level, which strips any DTO property without a class-validator decorator.
// These DTOs used to have none (only Swagger @ApiProperty), so turning the
// pipe on would have silently emptied profile updates and mentor searches.
// These tests pin the fields the services actually read.
const pipe = new ValidationPipe({ whitelist: true });
const body = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype });
const query = (metatype: any): ArgumentMetadata => ({
  type: 'query',
  metatype,
});

describe('Mentor controllers ValidationPipe (whitelist) — DTO field safety', () => {
  it('keeps every UpdateMentorProfileDto field the service reads', async () => {
    const payload = {
      bio: 'Backend engineer',
      expertise: ['Node.js', 'Postgres'],
      title: 'Senior Engineer',
      pastExperiences: 'Built payments infra',
    };
    const result = await pipe.transform(payload, body(UpdateMentorProfileDto));
    expect(result).toEqual(payload);
  });

  it('accepts a partial profile update (PATCH sends a subset)', async () => {
    const result = await pipe.transform(
      { title: 'Staff Engineer' },
      body(UpdateMentorProfileDto),
    );
    expect(result).toEqual({ title: 'Staff Engineer' });
  });

  it('rejects a non-array expertise', async () => {
    await expect(
      pipe.transform({ expertise: 'Node.js' }, body(UpdateMentorProfileDto)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps CreateSlotDto.maxCapacity and strips undeclared fields', async () => {
    const result = await pipe.transform(
      {
        slotStartDateTime: '2027-05-10T10:00:00.000Z',
        slotEndDateTime: '2027-05-10T10:30:00.000Z',
        durationMinutes: 30,
        maxCapacity: 3,
      },
      body(CreateSlotDto),
    );
    expect(result.maxCapacity).toBe(3);
    // The service computes duration from start/end itself, so dropping the
    // client's durationMinutes is harmless.
    expect(result.durationMinutes).toBeUndefined();
  });

  it('rejects a maxCapacity below 1', async () => {
    await expect(
      pipe.transform(
        {
          slotStartDateTime: '2027-05-10T10:00:00.000Z',
          slotEndDateTime: '2027-05-10T10:30:00.000Z',
          maxCapacity: 0,
        },
        body(CreateSlotDto),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps MentorSearchDto query fields and converts numeric strings', async () => {
    const result = await pipe.transform(
      { limit: '20', offset: '40', search: 'akhil', organizationId: '9' },
      query(MentorSearchDto),
    );
    expect(result).toEqual({
      limit: 20,
      offset: 40,
      search: 'akhil',
      organizationId: 9,
    });
  });

  it('leaves absent MentorSearchDto fields undefined so service defaults apply', async () => {
    const result = await pipe.transform({}, query(MentorSearchDto));
    expect(result.limit).toBeUndefined();
    expect(result.offset).toBeUndefined();
  });

  it('rejects a non-numeric limit', async () => {
    await expect(
      pipe.transform({ limit: 'abc' }, query(MentorSearchDto)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['MentorSlotController', MentorSlotController],
    ['InstructorMentorSlotController', InstructorMentorSlotController],
    ['StudentMentorSlotController', StudentMentorSlotController],
  ])('%s applies a class-level ValidationPipe', (_name, controller) => {
    const pipes = Reflect.getMetadata(PIPES_METADATA, controller) ?? [];
    expect(pipes.some((p: unknown) => p instanceof ValidationPipe)).toBe(true);
  });
});
