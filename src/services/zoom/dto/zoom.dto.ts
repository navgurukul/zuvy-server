import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateAndStoreZoomMeetingDto {
  @ApiProperty({ example: 'Live Event' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  batchId: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  bootcampId: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  moduleId: number;

  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @IsOptional()
  chapterId?: number; // Optional, will default to 1 if not provided

  @ApiProperty({ example: 'Description of the event', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2024-07-21T00:00:00Z' })
  @IsString()
  @IsNotEmpty()
  startDateTime: string;

  @ApiProperty({ example: '2024-07-21T01:00:00Z' })
  @IsString()
  @IsNotEmpty()
  endDateTime: string;

  @ApiProperty({ example: 'Asia/Kolkata' })
  @IsString()
  @IsNotEmpty()
  timeZone: string;
}

export class UpdateMeetingDto {
  @ApiProperty({ example: 'Updated Team Meeting', required: false })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiProperty({ example: '2025-07-24T12:00:00Z', required: false })
  @IsString()
  @IsOptional()
  start_time?: string;

  @ApiProperty({ example: 90, description: 'Updated duration in minutes', required: false })
  @IsNumber()
  @IsOptional()
  duration?: number;

  @ApiProperty({ example: 'PST', required: false })
  @IsString()
  @IsOptional()
  timezone?: string;
}
