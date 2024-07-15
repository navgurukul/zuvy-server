import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty,IsDate, IsArray,IsObject, ValidateNested,IsOptional, IsEmail, IsNumber,IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

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

export class CreateLiveBroadcastDto {
  @ApiProperty({
    description: 'The summary of the live broadcast event',
    type: String,
    example: 'Live Broadcast Event',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'The batchId of the live broadcast ',
    type: Number,
    example: 1,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  batchId: number;

  @ApiProperty({
    description: 'Bootcamp Id',
    type: Number,
    example: 9,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  bootcampId: number;

  @ApiProperty({
    description: 'The description of the live broadcast event',
    type: String,
    example: 'Description of the event',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'The start time of the live broadcast event',
    type: String,
    format: 'date-time',
    example: '2022-03-01T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsDateString()
  startDateTime: string;

  @ApiProperty({
    description: 'The end time of the live broadcast event',
    type: String,
    format: 'date-time',
    example: '2022-03-01T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsDateString()
  endDateTime: string;

  @ApiProperty({
    description: 'The timezone for the live broadcast event',
    type: String,
    example: 'Asia/Kolkata',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  timeZone: string;
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
    description: 'The description of the live broadcast event',
    type: String,
    example: 'Description of the event',
    required: true,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'The start time of the live broadcast event',
    type: String,
    format: 'date-time',
    example: '2022-03-01T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsDateString()
  startDateTime: string;

  @ApiProperty({
    description: 'The end time of the live broadcast event',
    type: String,
    format: 'date-time',
    example: '2022-03-01T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsDateString()
  endDateTime: string;
}