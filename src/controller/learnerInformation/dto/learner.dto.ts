import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export const YEAR_OF_STUDY_OPTIONS = ['1st', '2nd', '3rd', '4th'] as const;
export const CURRENT_STATUS_OPTIONS = [
  'Learning',
  'Looking for Job',
  'Working',
] as const;
export const DEGREE_PROGRAM_OPTIONS = [
  'B.Tech',
  'B.E',
  'Diploma',
  'M.Tech',
  'B.Sc',
  'M.Sc',
] as const;
export const ENGINEERING_BRANCH_OPTIONS = [
  'Computer Science',
  'Information Technology',
  'Electronics and Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Aerospace Engineering',
  'Biotechnology',
  'Data Science',
  'Artificial Intelligence',
  'Cyber Security',
  'Robotics',
  'Mechatronics',
  'Industrial Engineering',
  'Other',
] as const;

export class UpsertLearnerInformationDto {
  @ApiPropertyOptional({
    type: String,
    example: 'IIT Bombay',
    description:
      'College name (select from dropdown, use Other for manual entry)',
  })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  collegeName?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'My Custom College Name',
    description: 'Required when collegeName is Other',
  })
  @ValidateIf(
    (o) =>
      typeof o.collegeName === 'string' &&
      o.collegeName.trim().toLowerCase() === 'other',
  )
  @IsOptional()
  @IsString()
  @Length(3, 100)
  otherCollegeName?: string;

  @ApiPropertyOptional({
    type: String,
    enum: DEGREE_PROGRAM_OPTIONS,
    example: 'B.Tech',
  })
  @IsOptional()
  @IsString()
  @IsIn(DEGREE_PROGRAM_OPTIONS)
  degreeProgram?: string;

  @ApiPropertyOptional({
    type: String,
    enum: ENGINEERING_BRANCH_OPTIONS,
    example: 'Computer Science',
  })
  @IsOptional()
  @IsString()
  @IsIn(ENGINEERING_BRANCH_OPTIONS)
  branchSpecialisation?: string;

  @ApiPropertyOptional({
    type: String,
    enum: YEAR_OF_STUDY_OPTIONS,
    example: '3rd',
  })
  @IsOptional()
  @IsString()
  @IsIn(YEAR_OF_STUDY_OPTIONS)
  yearOfStudy?: (typeof YEAR_OF_STUDY_OPTIONS)[number];

  @ApiPropertyOptional({
    type: Number,
    example: 6,
    description: 'Expected graduation month (1-12)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  expectedGraduationMonth?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 2027,
    description: 'Expected graduation year',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  expectedGraduationYear?: number;

  @ApiPropertyOptional({
    type: String,
    enum: CURRENT_STATUS_OPTIONS,
    example: 'Learning',
  })
  @IsOptional()
  @IsString()
  @IsIn(CURRENT_STATUS_OPTIONS)
  currentStatus?: (typeof CURRENT_STATUS_OPTIONS)[number];
}

export class LearnerInformationResponseDto {
  @ApiProperty({ type: Number, example: 1 })
  id: number;

  @ApiProperty({ type: Number, example: 23 })
  userId: number;

  @ApiPropertyOptional({ type: String, example: 'IIT Bombay' })
  collegeName?: string | null;

  @ApiPropertyOptional({ type: String, example: null })
  otherCollegeName?: string | null;

  @ApiPropertyOptional({ type: String, example: 'B.Tech' })
  degreeProgram?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Computer Science' })
  branchSpecialisation?: string | null;

  @ApiPropertyOptional({
    type: String,
    enum: YEAR_OF_STUDY_OPTIONS,
    example: '3rd',
  })
  yearOfStudy?: string | null;

  @ApiPropertyOptional({ type: Number, example: 6 })
  expectedGraduationMonth?: number | null;

  @ApiPropertyOptional({ type: Number, example: 2027 })
  expectedGraduationYear?: number | null;

  @ApiPropertyOptional({
    type: String,
    enum: CURRENT_STATUS_OPTIONS,
    example: 'Learning',
  })
  currentStatus?: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2024-06-15T10:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2024-06-15T10:30:00.000Z',
  })
  updatedAt: string;
}

export class UpsertLearnerPersonalDetailsDto {
  @ApiProperty({
    type: String,
    example: 'Aditya Kumar',
    description: 'Learner full name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Enter your full name' })
  @Matches(/.*\S.*/, {
    message: 'Enter your full name',
  })
  @Length(2, 255)
  fullName: string;

  @ApiProperty({
    type: String,
    example: 'aditya.student@zuvy.org',
    description: 'Learner email address',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @Length(5, 255)
  email: string;

  @ApiProperty({
    type: String,
    example: '+91 9999999999',
    description:
      'Learner phone number (10-digit Indian number starting with 6-9, optional +91 prefix)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:\+91)?[6-9]\d{9}$/, {
    message:
      'phoneNumber must be a valid Indian mobile number (starts with 6-9, optional +91 prefix).',
  })
  phoneNumber: string;
}

export class LearnerPersonalDetailsResponseDto {
  @ApiProperty({ type: Number, example: 1 })
  id: number;

  @ApiProperty({ type: Number, example: 23 })
  userId: number;

  @ApiProperty({ type: String, example: 'Aditya Kumar' })
  fullName: string;

  @ApiProperty({ type: String, example: 'aditya.student@zuvy.org' })
  email: string;

  @ApiProperty({ type: String, example: '+91 9999999999' })
  phoneNumber: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2024-06-15T10:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2024-06-15T10:30:00.000Z',
  })
  updatedAt: string;
}
