import { IsString, MinLength, IsEnum } from 'class-validator';

export class CancelBookingDto {
  @IsString()
  @MinLength(10)
  reason: string;

  @IsEnum(['mentor', 'student'])
  cancelledBy: 'mentor' | 'student';
}
