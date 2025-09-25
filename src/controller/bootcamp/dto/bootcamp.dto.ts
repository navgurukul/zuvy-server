import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsNumber,
  IsEmail,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBootcampDto {
  @ApiProperty({
    type: String,
    example: 'bootcamp name',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
    example: 'Collaboration Name or https://example.com/logo.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  collaborator?: string;

  @ApiProperty({
    type: String,
    example: 'Bootcamp description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: Number,
    example: 12,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  duration?: number;
}

export class EditBootcampDto {
  @ApiProperty({
    type: String,
    example: 'The bootcamp cover image',
    required: true,
  })
  @IsNotEmpty()
  coverImage: string;

  @ApiProperty({
    type: String,
    example: 'The bootcamp name',
    required: true,
  })
  @IsNotEmpty({ message: 'name is required' })
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
    example: 'Bootcamp description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: String,
    example: 'Collaboration Name or https://example.com/logo.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  collaborator?: string;

  @ApiProperty({
    type: String,
    example: 'The bootcamp topic',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  bootcampTopic: string;

  @ApiProperty({
    type: Number,
    example: 12,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  duration: number;

  @ApiProperty({
    type: String,
    example: '2023-03-01T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  startTime: string;

  @ApiProperty({
    type: String,
    example: 'The bootcamp language',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  language: string;
}

export class PatchBootcampSettingDto {
  @ApiProperty({
    type: String,
    example: 'The bootcamp type',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['Public', 'Private'], {
    message: 'type must be either "Public" or "Private"',
  })
  type?: string;

  @ApiProperty({
    type: Boolean,
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isModuleLocked?: boolean;
}

export class PatchBootcampDto {
  @ApiProperty({
    type: String,
    example: 'https://example.com/image.jpg',
  })
  @IsOptional()
  coverImage: string;

  @ApiProperty({
    type: String,
    example: 'The bootcamp name',
  })
  @IsString()
  @IsOptional()
  name: string;

  @ApiProperty({
    type: String,
    example: 'Bootcamp description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: String,
    example: 'Collaboration Name or https://example.com/logo.png',
  })
  @IsOptional()
  @IsString()
  collaborator?: string;

  @ApiProperty({
    type: String,
    example: 'The bootcamp topic',
  })
  @IsOptional()
  @IsString()
  bootcampTopic: string;

  @ApiProperty({
    type: Number,
    example: 12,
    required: true,
  })
  @IsNumber()
  @IsOptional()
  duration: number;

  @ApiProperty({
    type: String,
    example: '2023-03-01T00:00:00Z',
    required: true,
  })
  @IsString()
  @IsOptional()
  startTime: string;

  @ApiProperty({
    type: String,
    example: 'english',
  })
  @IsOptional()
  @IsString()
  language: string;
}
class studentEmail {
  @ApiProperty({
    type: String,
    example: 'example@gmail.com',
    required: true,
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    type: String,
    example: 'example',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;
}
export class studentDataDto {
  @ApiProperty({
    type: [studentEmail],
    required: true,
  })
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => studentEmail)
  students: studentEmail[];
}

export class editUserDetailsDto {
  @ApiProperty({
    type: String,
    example: 'example@gmail.com',
    required: false,
  })
  @IsOptional() // Marks the field as optional
  @IsEmail({}, { message: 'Invalid email format' }) // Ensures email is valid if provided
  email?: string;

  @ApiProperty({
    type: String,
    example: 'example',
    required: false,
  })
  @IsOptional() // Marks the field as optional
  @IsString({ message: 'Name must be a string' }) // Ensures name is a string if provided
  name?: string;

  @ApiProperty({
    type: String,
    required: false,
    example: 'active',
    enum: ['active', 'graduate', 'dropout'],
  })
  @IsOptional()
  @IsIn(['active', 'graduate', 'dropout'])
  status?: 'active' | 'graduate' | 'dropout';

  @ApiProperty({ type: Number, required: true, example: 456 })
  @IsOptional() // Marks the field as optional
  batchId: number;
}

export class AttendanceMarkDto {
  @ApiProperty({ type: Number, required: true, example: 123 })
  sessionId: number;

  @ApiProperty({ type: Number, required: true, example: 456 })
  userId: number;

  @ApiProperty({ type: String, required: true, example: 'present' })
  status: 'present' | 'absent';

  @ApiProperty({ type: Number, required: false, example: 45 })
  @IsOptional()
  duration?: number; // in minutes (or agreed unit)
}

export class UpdateAttendanceStatusDto {
  @ApiProperty({
    type: String,
    example: 'present',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  status: string;
}