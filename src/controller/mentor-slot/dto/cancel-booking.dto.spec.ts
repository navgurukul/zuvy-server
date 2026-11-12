import {
  ValidationPipe,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import { CancelBookingDto } from './cancel-booking.dto';

// MDA-15: cancelBooking's controllers had no ValidationPipe wired in, so
// CancelBookingDto's @IsEnum on cancelledBy never ran — an invalid value
// (neither 'mentor' nor 'student') matched neither branch of the service's
// ownership check and silently bypassed it. This exercises the exact pipe
// now applied on those routes against the real DTO, with no Nest app/module
// bootstrap needed.
describe('CancelBookingDto validation (MDA-15)', () => {
  // Same options as the class-level pipe on the mentor controllers.
  const pipe = new ValidationPipe({ whitelist: true });
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: CancelBookingDto,
  };

  it('accepts a valid cancelledBy value', async () => {
    const result = await pipe.transform(
      { reason: 'Changed my availability', cancelledBy: 'mentor' },
      metadata,
    );
    expect(result.cancelledBy).toBe('mentor');
  });

  it('rejects a cancelledBy value outside the enum instead of silently passing through', async () => {
    await expect(
      pipe.transform(
        { reason: 'Changed my availability', cancelledBy: 'someone-else' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a reason shorter than 10 characters', async () => {
    await expect(
      pipe.transform({ reason: 'too short', cancelledBy: 'mentor' }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
