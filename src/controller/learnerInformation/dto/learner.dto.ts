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
  @ApiProperty({
    type: String,
    example: 'Ananya',
    description: 'First name',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  firstName: string;

  @ApiProperty({
    type: String,
    example: 'Sharma',
    description: 'Last name',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  lastName: string;

  @ApiProperty({
    type: String,
    example: 'ananya@example.com',
    description: 'Email address',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    type: String,
    example: '+919876543210',
    description:
      'Phone Number in Indian format. Accepts 10 digits starting with 6-9 and optional +91 prefix.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '') : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:\+91)?[6-9]\d{9}$/, {
    message:
      'phoneNumber must be a valid Indian number (10 digits starting with 6-9) with optional +91 prefix',
  })
  phoneNumber: string;

  @ApiProperty({
    type: String,
    example: 'IIT Bombay',
    description:
      'College name (select from dropdown, use Other for manual entry)',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  collegeName: string;

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
  @IsString()
  @IsNotEmpty()
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

  @ApiProperty({
    type: String,
    enum: ENGINEERING_BRANCH_OPTIONS,
    example: 'Computer Science',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(ENGINEERING_BRANCH_OPTIONS)
  branchSpecialisation: string;

  @ApiProperty({
    type: String,
    enum: YEAR_OF_STUDY_OPTIONS,
    example: '3rd',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(YEAR_OF_STUDY_OPTIONS)
  yearOfStudy: (typeof YEAR_OF_STUDY_OPTIONS)[number];

  @ApiProperty({
    type: Number,
    example: 6,
    description: 'Expected graduation month (1-12)',
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Max(12)
  expectedGraduationMonth: number;

  @ApiProperty({
    type: Number,
    example: 2027,
    description: 'Expected graduation year',
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(2020)
  expectedGraduationYear: number;

  @ApiProperty({
    type: String,
    enum: CURRENT_STATUS_OPTIONS,
    example: 'Learning',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(CURRENT_STATUS_OPTIONS)
  currentStatus: (typeof CURRENT_STATUS_OPTIONS)[number];
}

export class LearnerInformationResponseDto {
  @ApiProperty({ type: Number, example: 1 })
  id: number;

  @ApiProperty({ type: Number, example: 23 })
  userId: number;

  @ApiProperty({ type: String, example: 'Ananya' })
  firstName: string;

  @ApiProperty({ type: String, example: 'Sharma' })
  lastName: string;

  @ApiProperty({ type: String, example: 'Ananya Sharma' })
  fullName: string;

  @ApiProperty({ type: String, example: 'ananya@example.com' })
  email: string;

  @ApiProperty({ type: String, example: '9876543210' })
  phoneNumber: string;

  @ApiProperty({ type: String, example: 'IIT Bombay' })
  collegeName: string;

  @ApiPropertyOptional({ type: String, example: null })
  otherCollegeName?: string | null;

  @ApiPropertyOptional({ type: String, example: 'B.Tech' })
  degreeProgram?: string | null;

  @ApiProperty({ type: String, example: 'Computer Science' })
  branchSpecialisation: string;

  @ApiProperty({ type: String, enum: YEAR_OF_STUDY_OPTIONS, example: '3rd' })
  yearOfStudy: string;

  @ApiProperty({ type: Number, example: 6 })
  expectedGraduationMonth: number;

  @ApiProperty({ type: Number, example: 2027 })
  expectedGraduationYear: number;

  @ApiProperty({
    type: String,
    enum: CURRENT_STATUS_OPTIONS,
    example: 'Learning',
  })
  currentStatus: string;

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
