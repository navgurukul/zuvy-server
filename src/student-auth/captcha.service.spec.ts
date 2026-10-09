import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import { CaptchaService } from './captcha.service';

jest.mock('axios');
const mockedPost = axios.post as jest.Mock;

describe('CaptchaService', () => {
  const service = new CaptchaService();
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TURNSTILE_SECRET_KEY: 'secret',
      BASE_URL: 'https://dev-api.zuvy.org',
    };
    delete process.env.CAPTCHA_DISABLED;
    delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;
    mockedPost.mockReset();
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepts a token Cloudflare confirms', async () => {
    mockedPost.mockResolvedValue({
      data: { success: true, hostname: 'app.zuvy.org' },
    });
    await expect(service.verify('token', '1.2.3.4')).resolves.toBeUndefined();
    expect(mockedPost).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { secret: 'secret', response: 'token', remoteip: '1.2.3.4' },
      { timeout: 5000 },
    );
  });

  it('rejects a token Cloudflare refuses', async () => {
    mockedPost.mockResolvedValue({
      data: { success: false, 'error-codes': ['invalid-input-response'] },
    });
    await expect(service.verify('bad')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires a token', async () => {
    await expect(service.verify(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('rejects tokens solved on another hostname when hostnames are configured', async () => {
    process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'app.zuvy.org, dev.zuvy.org';
    mockedPost.mockResolvedValue({
      data: { success: true, hostname: 'evil.example' },
    });
    await expect(service.verify('token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns 503 when Cloudflare cannot be reached', async () => {
    mockedPost.mockRejectedValue(new Error('timeout'));
    await expect(service.verify('token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns 503 when the secret key is not configured', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    await expect(service.verify('token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('skips the check when CAPTCHA_DISABLED=true on a dev server', async () => {
    process.env.CAPTCHA_DISABLED = 'true';
    await expect(service.verify(undefined)).resolves.toBeUndefined();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('ignores CAPTCHA_DISABLED on production', async () => {
    process.env.CAPTCHA_DISABLED = 'true';
    process.env.BASE_URL = 'https://main-api.zuvy.org';
    await expect(service.verify(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
