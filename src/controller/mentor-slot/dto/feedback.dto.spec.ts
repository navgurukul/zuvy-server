import {
  ValidationPipe,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import { FeedbackDto } from './feedback.dto';

// MDA-19: rating had no @Min/@Max, so any number (negative, 999, etc.)
// skewed averaged ratings. This exercises the real ValidationPipe wired onto
// the submit-feedback routes against the real DTO.
//
// Also guards the whitelist gotcha this fix nearly introduced: `feedback`
// has no type-validator (it's `any`, free-form text), so with
// `whitelist: true` it needs at least @IsOptional() or ValidationPipe
// silently strips it from every submission — not just an edge case, a
// regression that would've shipped with this exact fix.
describe('FeedbackDto validation (MDA-19)', () => {
  // Same options as the class-level pipe on the mentor controllers.
  const pipe = new ValidationPipe({ whitelist: true });
  const metadata: ArgumentMetadata = { type: 'body', metatype: FeedbackDto };

  it('accepts a rating within 1-5 and keeps the feedback text', async () => {
    const result = await pipe.transform(
      { feedback: 'Great session, very helpful.', rating: 4 },
      metadata,
    );
    expect(result.rating).toBe(4);
    expect(result.feedback).toBe('Great session, very helpful.');
  });

  it('rejects a rating above 5', async () => {
    await expect(
      pipe.transform({ feedback: 'ok', rating: 999 }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a rating below 1', async () => {
    await expect(
      pipe.transform({ feedback: 'ok', rating: -1 }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows omitting rating entirely', async () => {
    const result = await pipe.transform(
      { feedback: 'no rating given' },
      metadata,
    );
    expect(result.rating).toBeUndefined();
    expect(result.feedback).toBe('no rating given');
  });
});
