import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { MentorSlotController } from './mentor-slot.controller';
import { MentorSlotService } from './mentor-slot.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';

describe('MentorSlotController (unit)', () => {
  let app: INestApplication;

  const mockService = {
    createProfile: jest.fn((dto) => ({ id: 1, ...dto })),
    getProfileById: jest.fn((id) => ({ id, name: 'Test Mentor' })),
    createSlot: jest.fn((dto) => ({ id: 2, ...dto })),
    listSlots: jest.fn((q) => [{ id: 2, mentorUserId: q?.mentorUserId || 0 }]),
    bookSlot: jest.fn((dto) => ({ id: 3, ...dto })),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MentorSlotController],
      providers: [
        { provide: MentorSlotService, useValue: mockService },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
        { provide: RolesGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /mentor-slot/profiles -> createProfile', async () => {
    const payload = { name: 'Alice', bio: 'mentor' };
    await request(app.getHttpServer())
      .post('/mentor-slot/profiles')
      .send(payload)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: 1, name: 'Alice' });
      });
  });

  it('GET /mentor-slot/profiles/:id -> getProfileById', async () => {
    await request(app.getHttpServer())
      .get('/mentor-slot/profiles/1')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: 1, name: 'Test Mentor' });
      });
  });

  it('POST /mentor-slot/slots -> createSlot', async () => {
    const payload = { mentorUserId: 1, start: '2026-02-24T10:00:00Z' };
    await request(app.getHttpServer())
      .post('/mentor-slot/slots')
      .send(payload)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: 2, mentorUserId: 1 });
      });
  });

  it('GET /mentor-slot/slots -> listSlots', async () => {
    await request(app.getHttpServer())
      .get('/mentor-slot/slots')
      .query({ mentorUserId: '1' })
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body)).toBe(true);
        expect(body[0]).toMatchObject({ mentorUserId: 1 });
      });
  });

  it('POST /mentor-slot/bookings -> bookSlot', async () => {
    const payload = { slotId: 2, userId: 10 };
    await request(app.getHttpServer())
      .post('/mentor-slot/bookings')
      .send(payload)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: 3, slotId: 2, userId: 10 });
      });
  });
});
