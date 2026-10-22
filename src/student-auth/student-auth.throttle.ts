import { ThrottlerModuleOptions } from '@nestjs/throttler';

// Per-IP ceilings for the Student ID routes only. A school lab shares one
// public IP, so these are sized for a whole lab signing up together; the
// per-person protection is the captcha (sign-up) and the account lockout
// (login). Tune with the env vars below without a code change.
export const SIGNUP_PER_MINUTE = 'signupPerMinute';
export const SIGNUP_PER_HOUR = 'signupPerHour';
export const LOGIN_PER_15_MINUTES = 'loginPer15Minutes';

const MINUTE = 60 * 1000;

const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const studentAuthThrottlerOptions = (): ThrottlerModuleOptions => ({
  errorMessage:
    'Too many requests from this network. Please wait a few minutes and try again.',
  throttlers: [
    {
      name: SIGNUP_PER_MINUTE,
      ttl: MINUTE,
      limit: positiveInt(process.env.SIGNUP_LIMIT_PER_MINUTE, 60),
    },
    {
      name: SIGNUP_PER_HOUR,
      ttl: 60 * MINUTE,
      limit: positiveInt(process.env.SIGNUP_LIMIT_PER_HOUR, 300),
    },
    {
      name: LOGIN_PER_15_MINUTES,
      ttl: 15 * MINUTE,
      limit: positiveInt(process.env.LOGIN_LIMIT_PER_15_MINUTES, 600),
    },
  ],
});
