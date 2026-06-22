import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateSlotDto {
  @ApiProperty({
    description: 'Slot start time in ISO format with timezone',
    example: '2026-05-10T10:00:00+05:30',
  })
  @IsDateString()
  slotStartDateTime: string;

  @ApiProperty({
    description: 'Slot end time in ISO format with timezone',
    example: '2026-05-10T10:30:00+05:30',
  })
  @IsDateString()
  slotEndDateTime: string;

  @ApiPropertyOptional({
    description: 'Optional topic for the mentoring session',
    example: 'React Performance Optimization',
  })
  @IsOptional()
  @IsString()
  topic?: string;
}
