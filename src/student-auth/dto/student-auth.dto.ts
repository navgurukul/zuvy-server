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

const trim = ({ value }) => (typeof value === 'string' ? value.trim() : value);
const toStudentId = ({ value }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

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
    description: 'Student ID given at sign-up',
    example: 'ZV7K3M9Q',
  })
  @Transform(toStudentId)
  @IsString()
  @IsNotEmpty()
  @Length(4, 16)
  studentId: string;

  @ApiProperty({ description: 'Password', example: 'riya@2026' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  password: string;
}

export class ResetStudentPasswordDto {
  @ApiProperty({ example: 'ZV7K3M9Q' })
  @Transform(toStudentId)
  @IsString()
  @IsNotEmpty()
  @Length(4, 16)
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
  @ApiProperty({ example: 'ZV7K3M9Q' })
  @Transform(toStudentId)
  @IsString()
  @IsNotEmpty()
  @Length(4, 16)
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
  @ApiPropertyOptional({ description: 'Exact Student ID', example: 'ZV7K3M9Q' })
  @IsOptional()
  @Transform(toStudentId)
  @IsString()
  @Matches(/^[A-Z0-9]{4,16}$/)
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
