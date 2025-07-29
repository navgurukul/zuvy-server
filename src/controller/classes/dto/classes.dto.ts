import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDate,
  IsArray,
  IsObject,
  ValidateNested,
  IsOptional,
  IsEmail,
  IsNumber,
  IsDateString,
  IsBoolean
} from 'class-validator';
import { Type } from 'class-transformer';
/*
{
  "title": "Live  Event test from backend",
  "batchId": 327,
  "moduleId": 602,
  "description": "Description of the event",
  "startDateTime": "2025-08-21T00:00:00Z",
  "endDateTime": "2025-08-21T00:00:00Z",
  "timeZone": "Asia/Kolkata",
  "isZoomMeet": true
}
 */
export class CreateDto {
  @ApiProperty({
    description: 'The name of the bootcamp',
    type: String,
    example: 'bootcamp name',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;
}

export class DTOsessionRecordViews {
  @ApiProperty({
    description: 'The session id',
    type: Number,
    example: 1,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  sessionId: number;
}

export class ScheduleDto {
  @ApiProperty({
    description: 'The schedule start time',
    type: String,
    format: 'date-time',
    example: '2022-03-01T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  startTime: String;

  @ApiProperty({
    description: 'The schedule end time',
    type: String,
    format: 'date-time',
    example: '2022-03-01T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  endTime: String;

  @ApiProperty({
    description: 'The schedule day',
    type: String,
    example: 'The schedule day',
    required: true,
  })
  @IsNotEmpty()
  day: string;
}

export class CreateSessionDto {
  @ApiProperty({
    description: 'The summary of the live  event',
    type: String,
    example: 'Live  Event test from backend',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'The batchId of the live  ',
    type: Number,
    example: 327,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  batchId: number;

  @ApiProperty({
    description: 'The module ID to associate with this session',
    type: Number,
    example: 602,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  moduleId: number;

  @ApiProperty({
    description: 'The description of the live  event',
    type: String,
    example: 'Description of the event',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'The start time of the live  event',
    type: String,
    format: 'date-time',
    example: '2025-08-21T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsDateString()
  startDateTime: string;

  @ApiProperty({
    description: 'The end time of the live  event',
    type: String,
    format: 'date-time',
    example: '2025-08-21T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsDateString()
  endDateTime: string;

  @ApiProperty({
    description: 'The timezone for the live  event',
    type: String,
    example: 'Asia/Kolkata',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  timeZone: string;

  @ApiProperty({
    description: 'Whether this session uses Zoom meeting (alias for useZoom for consistency with database schema)',
    type: Boolean,
    example: true,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isZoomMeet?: boolean;
}

export class reloadDto {
  @ApiProperty({
    description: 'meetingid of the live classes',
    type: Array,
    example: "['afadfasdadadfadf','asfafasfasfdas']",
    required: true,
  })
  @IsNotEmpty()
  @IsArray()
  meetingIds: string[];
}

export class updateSessionDto {
  @ApiProperty({
    description: 'title of the live classes',
    type: String,
    example: 'python class',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'The description of the live  event',
    type: String,
    example: 'Description of the event',
    required: true,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'The start time of the live  event',
    type: String,
    format: 'date-time',
    example: '2022-03-01T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsDateString()
  startDateTime: string;

  @ApiProperty({
    description: 'The end time of the live  event',
    type: String,
    format: 'date-time',
    example: '2022-03-01T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsDateString()
  endDateTime: string;
}

export class AddLiveClassesAsChaptersDto {
  @ApiProperty({
    description: 'Array of session IDs to be added as chapters',
    type: [Number],
    example: [1, 2, 3]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  sessionIds: number[];

  @ApiProperty({
    description: 'Module ID where the live classes will be added as chapters',
    type: Number,
    example: 1
  })
  @IsNumber()
  moduleId: number;
}
