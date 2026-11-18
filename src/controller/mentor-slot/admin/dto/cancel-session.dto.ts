import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

import { ADMIN_CANCEL_REASON_MIN_LENGTH } from '../admin-mentor-session.service';

export class AdminCancelSessionDto {
  @ApiProperty({
    description:
      'Why Ops is cancelling. Shown to the student and mentor. At least 10 characters.',
    minLength: ADMIN_CANCEL_REASON_MIN_LENGTH,
    example: 'Mentor emailed team@zuvy.org: family emergency.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(ADMIN_CANCEL_REASON_MIN_LENGTH, {
    message: `reason must be at least ${ADMIN_CANCEL_REASON_MIN_LENGTH} characters`,
  })
  reason: string;
}
