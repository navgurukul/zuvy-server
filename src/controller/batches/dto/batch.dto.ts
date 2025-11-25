import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsEmail, IsNumber, IsBoolean, ArrayNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty, ApiResponseProperty, ApiResponse } from '@nestjs/swagger';

export class BatchDto {
  @ApiProperty({
    type: String,
    example: 'batch name',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
    example: 20230,
    required: true,
  })
  @IsNotEmpty()
  @IsEmail()
  instructorEmail: string;

  @ApiProperty({
    type: Number,
    example: 20230,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  bootcampId: number;

  @ApiProperty({
    type: Number,
    example: 500,
    required: true,
  })
  @IsNotEmpty({ message: 'capEnrollment is required' })
  @IsNumber()
  capEnrollment: number;

  @ApiProperty({
    type: String,
    example: '2025-09-20',
    required: false,
    description: 'Optional start date for the batch (ISO date string)'
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    type: String,
    example: '2025-12-20',
    required: false,
    description: 'Optional end date for the batch (ISO date string)'
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    type: Boolean,
    example: true,
    required: true,
  })
  @IsNotEmpty({ message: 'assignAll is required' })
  @IsBoolean()
  assignAll: boolean;

  @ApiProperty({
    type: String,
    example: 'Ongoing',
    required: false,
    description: 'Optional status of the batch (e.g. Ongoing, Completed)'
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    type: [Number],
    example: [101, 102, 103],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  studentIds?: number[];
}

export class PatchBatchDto {
  @ApiProperty({
    type: String,
    example: 'batch name',
  })
  @IsOptional()
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
    example: 'giribabu@gmail.com',
  })
  @IsOptional()
  @IsEmail()
  instructorEmail: string;

  @ApiProperty({
    type: Number,
    example: 500,
    required: true,
  })
  @IsOptional()
  @IsNumber()
  capEnrollment: number;

  @ApiProperty({
    type: String,
    example: '2025-09-20',
    required: false,
    description: 'Optional start date for the batch (ISO date string)'
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    type: String,
    example: '2025-12-20',
    required: false,
    description: 'Optional end date for the batch (ISO date string)'
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    type: String,
    example: 'Ongoing',
    required: false,
    description: 'Optional status of the batch (e.g. Ongoing, Completed)'
  })
  @IsOptional()
  @IsString()
  status?: string;
}