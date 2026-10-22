import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies Cloudflare Turnstile tokens on the server. The frontend widget
 * only produces a token; without this check anyone could call the sign-up
 * API directly. Turnstile judges each browser, not the IP, so a whole class
 * on one school Wi-Fi passes individually.
 *
 * Env:
 *   TURNSTILE_SECRET_KEY         required unless CAPTCHA_DISABLED=true
 *   TURNSTILE_ALLOWED_HOSTNAMES  optional, comma-separated site hostnames
 *   CAPTCHA_DISABLED=true        dev/testing only; ignored on production
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  async verify(token: string | undefined, remoteIp?: string): Promise<void> {
    if (this.isDisabled()) return;

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      this.logger.error(
        'TURNSTILE_SECRET_KEY is not set; Student ID sign-up is rejected',
      );
      throw new ServiceUnavailableException(
        'Sign-up is temporarily unavailable. Please try again later.',
      );
    }
    if (!token) {
      throw new BadRequestException('Captcha is required');
    }

    let result: any;
    try {
      const { data } = await axios.post(
        TURNSTILE_VERIFY_URL,
        { secret, response: token, remoteip: remoteIp },
        { timeout: 5000 },
      );
      result = data;
    } catch (error) {
      this.logger.error(`Turnstile request failed: ${error?.message}`);
      throw new ServiceUnavailableException(
        'Could not verify the captcha. Please try again.',
      );
    }

    if (!result?.success) {
      this.logger.warn(
        `Captcha rejected: ${(result?.['error-codes'] || []).join(', ')}`,
      );
      throw new BadRequestException(
        'Captcha verification failed. Please try again.',
      );
    }

    const allowedHostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || '')
      .split(',')
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean);
    const hostname = String(result.hostname || '').toLowerCase();
    if (allowedHostnames.length && !allowedHostnames.includes(hostname)) {
      this.logger.warn(`Captcha solved on unexpected hostname: ${hostname}`);
      throw new BadRequestException(
        'Captcha verification failed. Please try again.',
      );
    }
  }

  private isDisabled(): boolean {
    if (process.env.CAPTCHA_DISABLED !== 'true') return false;
    // Same production marker main.ts uses to hide Swagger.
    if ((process.env.BASE_URL || '').includes('main-api')) {
      this.logger.warn('CAPTCHA_DISABLED is ignored on production');
      return false;
    }
    return true;
  }
}
