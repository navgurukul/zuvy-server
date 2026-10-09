// Keep the controller test off the real database.
jest.mock('src/db', () => ({ db: {} }));

import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { TRUST_PROXY } from 'src/config/trust-proxy';
import { StudentAuthController } from './student-auth.controller';
import { StudentAuthService } from './student-auth.service';
import { studentAuthThrottlerOptions } from './student-auth.throttle';

describe('Student ID rate limits behind nginx', () => {
  let app: INestApplication;
  const signupBody = { name: 'Test Student', password: 'test@123' };
  const loginBody = { studentId: 'ZVABC234', password: 'test@123' };
  const service = {
    signup: jest.fn().mockResolvedValue({ studentId: 'ZVABC234' }),
    login: jest.fn().mockResolvedValue({ studentId: 'ZVABC234' }),
    findStudents: jest.fn().mockResolvedValue({ status: 'success', data: [] }),
  };

  beforeAll(async () => {
    process.env.SIGNUP_LIMIT_PER_MINUTE = '3';
    process.env.LOGIN_LIMIT_PER_15_MINUTES = '2';
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(studentAuthThrottlerOptions())],
      controllers: [StudentAuthController],
      providers: [{ provide: StudentAuthService, useValue: service }],
    }).compile();
    const expressApp =
      moduleRef.createNestApplication<NestExpressApplication>();
    expressApp.set('trust proxy', TRUST_PROXY); // same as main.ts
    // Stand-in for the global auth guard on the admin route.
    expressApp.use((req, _res, next) => {
      req.user = [{ id: 1 }];
      next();
    });
    app = expressApp;
    await app.init();
  });
  afterAll(async () => {
    delete process.env.SIGNUP_LIMIT_PER_MINUTE;
    delete process.env.LOGIN_LIMIT_PER_15_MINUTES;
    await app.close();
  });

  // supertest connects from 127.0.0.1 (trusted, like nginx); the header
  // carries the client IP the way nginx's $proxy_add_x_forwarded_for does.
  const signupFrom = (forwardedFor: string) =>
    request(app.getHttpServer())
      .post('/auth/student/signup')
      .set('X-Forwarded-For', forwardedFor)
      .send(signupBody);

  it('limits sign-ups per real client IP and passes that IP to the service', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await signupFrom('203.0.113.10')).status).toBe(201);
    }
    const blocked = await signupFrom('203.0.113.10');
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toContain(
      'Too many requests from this network',
    );
    expect(service.signup).toHaveBeenLastCalledWith(
      'Test Student',
      'test@123',
      undefined,
      '203.0.113.10',
    );
  });

  it('does not block other networks when one network hits the limit', async () => {
    expect((await signupFrom('198.51.100.20')).status).toBe(201);
  });

  it('ignores X-Forwarded-For values the client sends itself', async () => {
    // nginx appends the real address last; a spoofed left part must not
    // create a fresh bucket.
    for (let i = 0; i < 3; i++) {
      expect((await signupFrom(`10.9.9.${i}, 192.0.2.30`)).status).toBe(201);
    }
    expect((await signupFrom('8.8.8.8, 192.0.2.30')).status).toBe(429);
  });

  it('counts logins separately from sign-ups', async () => {
    const loginFrom = () =>
      request(app.getHttpServer())
        .post('/auth/student/login')
        .set('X-Forwarded-For', '203.0.113.10')
        .send(loginBody);
    expect((await loginFrom()).status).toBe(200);
    expect((await loginFrom()).status).toBe(200);
    expect((await loginFrom()).status).toBe(429);
  });

  it('does not rate-limit the admin routes', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer())
        .get('/auth/admin/students?name=test')
        .set('X-Forwarded-For', '203.0.113.10');
      expect(res.status).toBe(200);
    }
  });
});
