import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, MinLength } from 'class-validator';

export class ProposeRescheduleDto {
  @ApiProperty({
    example: 'I have a scheduling conflict and need a different time.',
    description: 'Reason for requesting the reschedule',
  })
  @IsString()
  @MinLength(10)
  reason: string;
}
