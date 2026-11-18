import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
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

  // createSlot reads dto.maxCapacity (defaulting to 1). It must be declared
  // here, or ValidationPipe's `whitelist: true` strips it before it arrives.
  @ApiPropertyOptional({
    description: 'How many students can book this slot (defaults to 1)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCapacity?: number;
}
