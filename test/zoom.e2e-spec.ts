import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('ZoomController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/zoom/create (POST)', async () => {
    const payload = {
      title: 'Live Event',
      batchId: 1,
      bootcampId: 1,
      moduleId: 1,
      description: 'Description of the event',
      startDateTime: '2024-07-21T00:00:00Z',
      endDateTime: '2024-07-21T01:00:00Z',
      timeZone: 'Asia/Kolkata',
    };

    const response = await request(app.getHttpServer())
      .post('/zoom/create')
      .send(payload)
      .expect(201);

    expect(response.body.status).toBe('success');
    expect(response.body.data).toHaveProperty('meetingId');
  });
});
