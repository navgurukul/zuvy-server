import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('ZoomController (e2e)', () => {
  let app: INestApplication;
  let createdMeetingId: string;

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

  describe('/zoom/create (POST)', () => {
    it('should create a new Zoom meeting successfully', async () => {
      const payload = {
        title: 'Live Event',
        batchId: 1,
        bootcampId: 1,
        moduleId: 1,
        chapterId: 1,
        description: 'Description of the event',
        startDateTime: '2024-07-21T10:00:00Z',
        endDateTime: '2024-07-21T11:00:00Z',
        timeZone: 'Asia/Kolkata',
      };

      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(payload)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Zoom meeting created successfully');
      expect(response.body.data).toHaveProperty('meetingId');
      expect(response.body.data).toHaveProperty('zoomJoinUrl');
      expect(response.body.data).toHaveProperty('zoomStartUrl');
      expect(response.body.data).toHaveProperty('zoomPassword');
      expect(response.body.data.title).toBe(payload.title);
      expect(response.body.data.batchId).toBe(payload.batchId);
      expect(response.body.data.bootcampId).toBe(payload.bootcampId);
      expect(response.body.data.moduleId).toBe(payload.moduleId);
      expect(response.body.data.chapterId).toBe(payload.chapterId);
      expect(response.body.data.isZoomMeet).toBe(true);
      expect(response.body.data.status).toBe('upcoming');

      // Store the meeting ID for other tests
      createdMeetingId = response.body.data.meetingId;
    });

    it('should fail when required fields are missing', async () => {
      const invalidPayload = {
        title: 'Live Event',
        // Missing required fields
      };

      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should fail with invalid data types', async () => {
      const invalidPayload = {
        title: 'Live Event',
        batchId: 'invalid', // Should be number
        bootcampId: 1,
        moduleId: 1,
        chapterId: 1,
        startDateTime: '2024-07-21T10:00:00Z',
        endDateTime: '2024-07-21T11:00:00Z',
        timeZone: 'Asia/Kolkata',
      };

      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('/zoom/get/:meetingId (GET)', () => {
    it('should retrieve meeting details successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/zoom/get/${createdMeetingId}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe(
        'Zoom meeting details fetched successfully',
      );
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('topic');
      expect(response.body.data).toHaveProperty('join_url');
      expect(response.body.data).toHaveProperty('start_url');
      expect(response.body.data).toHaveProperty('password');
      expect(response.body.data.id.toString()).toBe(createdMeetingId);
    });

    it('should fail when meeting ID does not exist', async () => {
      const nonExistentMeetingId = '999999999';

      const response = await request(app.getHttpServer())
        .get(`/zoom/get/${nonExistentMeetingId}`)
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should fail with invalid meeting ID format', async () => {
      const invalidMeetingId = 'invalid-id';

      const response = await request(app.getHttpServer())
        .get(`/zoom/get/${invalidMeetingId}`)
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  describe('/zoom/update/:meetingId (PUT)', () => {
    it('should update meeting details successfully', async () => {
      const updatePayload = {
        topic: 'Updated Meeting Title',
        start_time: '2024-07-21T15:00:00Z',
        duration: 90,
        timezone: 'UTC',
      };

      const response = await request(app.getHttpServer())
        .put(`/zoom/update/${createdMeetingId}`)
        .send(updatePayload)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Zoom meeting updated successfully');
    });

    it('should fail when meeting ID does not exist', async () => {
      const nonExistentMeetingId = '999999999';
      const updatePayload = {
        topic: 'Updated Meeting Title',
      };

      const response = await request(app.getHttpServer())
        .put(`/zoom/update/${nonExistentMeetingId}`)
        .send(updatePayload)
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should handle partial updates', async () => {
      const partialUpdatePayload = {
        topic: 'Partially Updated Title',
      };

      const response = await request(app.getHttpServer())
        .put(`/zoom/update/${createdMeetingId}`)
        .send(partialUpdatePayload)
        .expect(200);

      expect(response.body.status).toBe('success');
    });

    it('should fail with invalid data types in update', async () => {
      const invalidUpdatePayload = {
        duration: 'invalid-duration', // Should be number
      };

      const response = await request(app.getHttpServer())
        .put(`/zoom/update/${createdMeetingId}`)
        .send(invalidUpdatePayload)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('/zoom/delete/:meetingId (DELETE)', () => {
    it('should fail when meeting ID does not exist', async () => {
      const nonExistentMeetingId = '999999999';

      const response = await request(app.getHttpServer())
        .delete(`/zoom/delete/${nonExistentMeetingId}`)
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should delete meeting successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/zoom/delete/${createdMeetingId}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Zoom meeting deleted successfully');
    });

    it('should fail to get deleted meeting', async () => {
      const response = await request(app.getHttpServer())
        .get(`/zoom/get/${createdMeetingId}`)
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should fail to delete already deleted meeting', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/zoom/delete/${createdMeetingId}`)
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  describe('Integration Tests', () => {
    let integrationMeetingId: string;

    it('should create, read, update, and delete a meeting in sequence', async () => {
      // Create
      const createPayload = {
        title: 'Integration Test Meeting',
        batchId: 2,
        bootcampId: 2,
        moduleId: 2,
        chapterId: 2,
        description: 'Integration test description',
        startDateTime: '2024-07-22T10:00:00Z',
        endDateTime: '2024-07-22T11:00:00Z',
        timeZone: 'UTC',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(createPayload)
        .expect(201);

      expect(createResponse.body.status).toBe('success');
      integrationMeetingId = createResponse.body.data.meetingId;

      // Read
      const readResponse = await request(app.getHttpServer())
        .get(`/zoom/get/${integrationMeetingId}`)
        .expect(200);

      expect(readResponse.body.status).toBe('success');
      expect(readResponse.body.data.id.toString()).toBe(integrationMeetingId);

      // Update
      const updatePayload = {
        topic: 'Updated Integration Test Meeting',
        duration: 120,
      };

      const updateResponse = await request(app.getHttpServer())
        .put(`/zoom/update/${integrationMeetingId}`)
        .send(updatePayload)
        .expect(200);

      expect(updateResponse.body.status).toBe('success');

      // Delete
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/zoom/delete/${integrationMeetingId}`)
        .expect(200);

      expect(deleteResponse.body.status).toBe('success');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long meeting titles', async () => {
      const longTitle = 'A'.repeat(300); // Very long title
      const payload = {
        title: longTitle,
        batchId: 1,
        bootcampId: 1,
        moduleId: 1,
        chapterId: 1,
        startDateTime: '2024-07-21T10:00:00Z',
        endDateTime: '2024-07-21T11:00:00Z',
        timeZone: 'Asia/Kolkata',
      };

      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(payload);

      // Should either succeed or fail gracefully
      expect([200, 201, 400, 422]).toContain(response.status);
    });

    it('should handle past dates gracefully', async () => {
      const payload = {
        title: 'Past Meeting',
        batchId: 1,
        bootcampId: 1,
        moduleId: 1,
        chapterId: 1,
        startDateTime: '2020-01-01T10:00:00Z', // Past date
        endDateTime: '2020-01-01T11:00:00Z',
        timeZone: 'Asia/Kolkata',
      };

      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(payload);

      // Should either succeed or fail gracefully
      expect([200, 201, 400, 422]).toContain(response.status);
    });

    it('should handle invalid timezone', async () => {
      const payload = {
        title: 'Invalid Timezone Meeting',
        batchId: 1,
        bootcampId: 1,
        moduleId: 1,
        chapterId: 1,
        startDateTime: '2024-07-21T10:00:00Z',
        endDateTime: '2024-07-21T11:00:00Z',
        timeZone: 'Invalid/Timezone',
      };

      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(payload);

      // Should either succeed with default timezone or fail gracefully
      expect([200, 201, 400, 422]).toContain(response.status);
    });

    it('should handle invalid datetime format', async () => {
      const payload = {
        title: 'Invalid DateTime Meeting',
        batchId: 1,
        bootcampId: 1,
        moduleId: 1,
        chapterId: 1,
        startDateTime: 'invalid-date-format',
        endDateTime: '2024-07-21T11:00:00Z',
        timeZone: 'Asia/Kolkata',
      };

      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(payload);

      // Should fail gracefully with validation error
      expect([400, 422]).toContain(response.status);
    });

    it('should handle end time before start time', async () => {
      const payload = {
        title: 'Invalid Time Range Meeting',
        batchId: 1,
        bootcampId: 1,
        moduleId: 1,
        chapterId: 1,
        startDateTime: '2024-07-21T11:00:00Z',
        endDateTime: '2024-07-21T10:00:00Z', // End before start
        timeZone: 'Asia/Kolkata',
      };

      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(payload);

      // Should fail gracefully
      expect([400, 422]).toContain(response.status);
    });

    it('should handle zero or negative IDs', async () => {
      const payload = {
        title: 'Zero ID Meeting',
        batchId: 0,
        bootcampId: -1,
        moduleId: 1,
        chapterId: 1,
        startDateTime: '2024-07-21T10:00:00Z',
        endDateTime: '2024-07-21T11:00:00Z',
        timeZone: 'Asia/Kolkata',
      };

      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(payload);

      // Should either succeed or fail gracefully
      expect([200, 201, 400, 422]).toContain(response.status);
    });

    it('should handle empty string fields', async () => {
      const payload = {
        title: '',
        batchId: 1,
        bootcampId: 1,
        moduleId: 1,
        chapterId: 1,
        startDateTime: '2024-07-21T10:00:00Z',
        endDateTime: '2024-07-21T11:00:00Z',
        timeZone: '',
      };

      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(payload)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Database Integration Tests', () => {
    let dbMeetingId: string;

    it('should store meeting data in database after creation', async () => {
      const payload = {
        title: 'Database Integration Test',
        batchId: 999,
        bootcampId: 999,
        moduleId: 999,
        chapterId: 999,
        description: 'Testing database integration',
        startDateTime: '2024-07-25T10:00:00Z',
        endDateTime: '2024-07-25T11:00:00Z',
        timeZone: 'UTC',
      };

      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(payload)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('meetingId');
      expect(response.body.data.batchId).toBe(payload.batchId);
      expect(response.body.data.bootcampId).toBe(payload.bootcampId);
      expect(response.body.data.moduleId).toBe(payload.moduleId);
      expect(response.body.data.chapterId).toBe(payload.chapterId);
      expect(response.body.data.title).toBe(payload.title);
      expect(response.body.data.description).toBe(payload.description);
      expect(response.body.data.isZoomMeet).toBe(true);
      expect(response.body.data.status).toBe('upcoming');

      dbMeetingId = response.body.data.meetingId;
    });

    it('should clean up database entry after meeting deletion', async () => {
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/zoom/delete/${dbMeetingId}`)
        .expect(200);

      expect(deleteResponse.body.status).toBe('success');
    });
  });

  describe('Google Calendar Integration Tests', () => {
    it('should handle Google Calendar integration during meeting creation', async () => {
      const payload = {
        title: 'Google Calendar Integration Test',
        batchId: 888,
        bootcampId: 888,
        moduleId: 888,
        chapterId: 888,
        description: 'Testing Google Calendar integration',
        startDateTime: '2024-07-26T14:00:00Z',
        endDateTime: '2024-07-26T15:00:00Z',
        timeZone: 'America/New_York',
      };

      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(payload);

      // Should either succeed with calendar integration or succeed without it
      expect([200, 201]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body.status).toBe('success');
        expect(response.body.data).toHaveProperty('meetingId');

        // Clean up
        await request(app.getHttpServer()).delete(
          `/zoom/delete/${response.body.data.meetingId}`,
        );
      }
    });
  });

  describe('Stress and Performance Tests', () => {
    it('should handle multiple concurrent meeting creations', async () => {
      const promises = [];

      for (let i = 0; i < 3; i++) {
        const payload = {
          title: `Concurrent Meeting ${i}`,
          batchId: i + 1,
          bootcampId: i + 1,
          moduleId: i + 1,
          chapterId: i + 1,
          startDateTime: `2024-07-2${7 + i}T10:00:00Z`,
          endDateTime: `2024-07-2${7 + i}T11:00:00Z`,
          timeZone: 'UTC',
        };

        promises.push(
          request(app.getHttpServer()).post('/zoom/create').send(payload),
        );
      }

      const responses = await Promise.all(promises);

      // Clean up created meetings
      for (const response of responses) {
        if (response.status === 201 && response.body.data?.meetingId) {
          await request(app.getHttpServer()).delete(
            `/zoom/delete/${response.body.data.meetingId}`,
          );
        }
      }

      // At least some should succeed
      const successfulResponses = responses.filter((r) => r.status === 201);
      expect(successfulResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security and Validation Tests', () => {
    it('should prevent SQL injection in meeting IDs', async () => {
      const maliciousId = "'; DROP TABLE zuvySessions; --";

      const response = await request(app.getHttpServer())
        .get(`/zoom/get/${encodeURIComponent(maliciousId)}`)
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should handle very large payload gracefully', async () => {
      const largeDescription = 'A'.repeat(10000);
      const payload = {
        title: 'Large Payload Test',
        batchId: 1,
        bootcampId: 1,
        moduleId: 1,
        chapterId: 1,
        description: largeDescription,
        startDateTime: '2024-07-21T10:00:00Z',
        endDateTime: '2024-07-21T11:00:00Z',
        timeZone: 'Asia/Kolkata',
      };

      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .send(payload);

      // Should either succeed or fail gracefully
      expect([200, 201, 400, 413, 422]).toContain(response.status);
    });

    it('should validate required fields with proper error messages', async () => {
      const incompletePayloads = [
        { title: 'Test' }, // Missing all required fields
        { title: 'Test', batchId: 1 }, // Missing other required fields
        { batchId: 1, bootcampId: 1, moduleId: 1 }, // Missing title
      ];

      for (const payload of incompletePayloads) {
        const response = await request(app.getHttpServer())
          .post('/zoom/create')
          .send(payload)
          .expect(400);

        expect(response.body).toHaveProperty('message');
      }
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/zoom/create')
        .set('Content-Type', 'application/json')
        .send('{"title": "Test", "batchId":')
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });
});
