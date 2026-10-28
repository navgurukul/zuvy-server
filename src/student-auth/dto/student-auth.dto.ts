import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  UDISE_CODE_PATTERN,
  normalizeUdiseCode,
} from 'src/schools/school-rows';

const trim = ({ value }) => (typeof value === 'string' ? value.trim() : value);
const toUdiseCode = ({ value }) =>
  typeof value === 'string' ? normalizeUdiseCode(value) : value;
// Student IDs are stored lowercase (e.g. aruneshdharct1); accept any case.
const toStudentId = ({ value }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const STUDENT_ID_PATTERN = /^[a-z0-9]{3,40}$/;
const STUDENT_ID_MESSAGE =
  'studentId must be 3 to 40 letters and numbers, e.g. aruneshdharct1';

export class StudentSignupDto {
  @ApiProperty({
    description: 'Full name of the student',
    example: 'Riya Sharma',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @ApiProperty({
    description: 'Password, 6 to 64 characters',
    example: 'riya@2026',
  })
  @IsString()
  @Length(6, 64)
  password: string;

  @ApiProperty({
    description: 'State, from GET /schools/states (any letter case)',
    example: 'Telangana',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  state: string;

  @ApiProperty({
    description:
      'City (UDISE district), from GET /schools/cities (any letter case)',
    example: 'Hyderabad',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  city: string;

  @ApiProperty({
    description:
      'UDISE code of the school picked from GET /schools (11 characters, normally digits). The school name is taken from our school list.',
    example: '36070700101',
  })
  @Transform(toUdiseCode)
  @IsString()
  @Matches(UDISE_CODE_PATTERN, {
    message: 'udiseCode must be the 11-character UDISE code of the school',
  })
  udiseCode: string;

  @ApiPropertyOptional({
    description:
      'Cloudflare Turnstile token from the sign-up page. Required unless CAPTCHA_DISABLED=true on a dev server.',
    example: 'XXXX.DUMMY.TOKEN.XXXX',
  })
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  captchaToken?: string;
}

export class StudentLoginDto {
  @ApiProperty({
    description: 'Student ID given at sign-up (any case)',
    example: 'aruneshdharct1',
  })
  @Transform(toStudentId)
  @IsString()
  @IsNotEmpty()
  @Matches(STUDENT_ID_PATTERN, { message: STUDENT_ID_MESSAGE })
  studentId: string;

  @ApiProperty({ description: 'Password', example: 'riya@2026' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  password: string;
}

export class ResetStudentPasswordDto {
  @ApiProperty({ example: 'aruneshdharct1' })
  @Transform(toStudentId)
  @IsString()
  @IsNotEmpty()
  @Matches(STUDENT_ID_PATTERN, { message: STUDENT_ID_MESSAGE })
  studentId: string;

  @ApiPropertyOptional({
    description:
      'New password (6 to 64 characters). Leave empty to generate one.',
    example: 'newpass123',
  })
  @IsOptional()
  @IsString()
  @Length(6, 64)
  newPassword?: string;
}

export class EnrollStudentByIdDto {
  @ApiProperty({ example: 'aruneshdharct1' })
  @Transform(toStudentId)
  @IsString()
  @IsNotEmpty()
  @Matches(STUDENT_ID_PATTERN, { message: STUDENT_ID_MESSAGE })
  studentId: string;

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bootcampId: number;

  @ApiPropertyOptional({ example: 34 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchId?: number;
}

export class FindStudentsQueryDto {
  @ApiPropertyOptional({
    description: 'Exact Student ID (any case)',
    example: 'aruneshdharct1',
  })
  @IsOptional()
  @Transform(toStudentId)
  @IsString()
  @Matches(STUDENT_ID_PATTERN, { message: STUDENT_ID_MESSAGE })
  studentId?: string;

  @ApiPropertyOptional({
    description: 'Part of the student name',
    example: 'riya',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
