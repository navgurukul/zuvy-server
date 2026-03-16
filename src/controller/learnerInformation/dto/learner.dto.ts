/* eslint-disable prettier/prettier */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';

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
    example: 'B.Tech',
  })
  @IsOptional()
  @IsString()
  degreeProgram?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Computer Science',
  })
  @IsOptional()
  @IsString()
  branchSpecialisation?: string;
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

export class UpsertTechnicalSkillsDto {
  @ApiProperty({
    type: [String],
    example: ['React', 'JavaScript'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  skills: string[];
}

export class UpdateTechnicalSkillByIdDto {
  @ApiProperty({ type: String, example: 'React Native' })
  @IsString()
  @Length(1, 100)
  name: string;
}

export class TechnicalSkillItemDto {
  @ApiProperty({ type: Number, example: 1 })
  id: number;

  @ApiProperty({ type: String, example: 'React' })
  name: string;
}

export class TechnicalSkillsResponseDto {
  @ApiProperty({ type: [TechnicalSkillItemDto] })
  skills: TechnicalSkillItemDto[];
}

export class TechnicalSkillsApiResponseDto {
  @ApiProperty({ type: Boolean, example: true })
  success: boolean;

  @ApiProperty({ type: TechnicalSkillsResponseDto })
  data: TechnicalSkillsResponseDto;
}

export class UpsertLearnerDegreesDto {
  @ApiProperty({
    type: [String],
    example: ['B.Tech', 'B.E'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  degrees: string[];
}

export class UpdateLearnerDegreeByIdDto {
  @ApiProperty({ type: String, example: 'B.Tech' })
  @IsString()
  @Length(1, 100)
  name: string;
}

export class LearnerDegreeItemDto {
  @ApiProperty({ type: Number, example: 1 })
  id: number;

  @ApiProperty({ type: String, example: 'B.Tech' })
  name: string;
}

export class LearnerDegreesResponseDto {
  @ApiProperty({ type: [LearnerDegreeItemDto] })
  degrees: LearnerDegreeItemDto[];
}

export class UpsertLearnerEducationBranchesDto {
  @ApiProperty({
    type: [String],
    example: ['Computer Science', 'Electronics'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  branches: string[];
}

export class UpdateLearnerEducationBranchByIdDto {
  @ApiProperty({ type: String, example: 'Computer Science' })
  @IsString()
  @Length(1, 100)
  name: string;
}

export class LearnerEducationBranchItemDto {
  @ApiProperty({ type: Number, example: 1 })
  id: number;

  @ApiProperty({ type: String, example: 'Computer Science' })
  name: string;
}

export class LearnerEducationBranchesResponseDto {
  @ApiProperty({ type: [LearnerEducationBranchItemDto] })
  branches: LearnerEducationBranchItemDto[];
}

export class UpsertLearnerBoardsDto {
  @ApiProperty({
    type: [String],
    example: ['CBSE', 'ICSE', 'ISC', 'AP Board'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  boards: string[];
}

export class UpdateLearnerBoardByIdDto {
  @ApiProperty({ type: String, example: 'CBSE' })
  @IsString()
  @Length(1, 100)
  name: string;
}

export class LearnerBoardItemDto {
  @ApiProperty({ type: Number, example: 1 })
  id: number;

  @ApiProperty({ type: String, example: 'CBSE' })
  name: string;
}

export class LearnerBoardsResponseDto {
  @ApiProperty({ type: [LearnerBoardItemDto] })
  boards: LearnerBoardItemDto[];
}

export class UpsertLearnerRolesDto {
  @ApiProperty({
    type: [String],
    example: ['Software Development Engineer (SDE)', 'Full Stack Developer'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roles: string[];
}

export class UpdateLearnerRoleByIdDto {
  @ApiProperty({ type: String, example: 'Backend Developer' })
  @IsString()
  @Length(1, 100)
  name: string;
}

export class LearnerRoleItemDto {
  @ApiProperty({ type: Number, example: 1 })
  id: number;

  @ApiProperty({ type: String, example: 'Software Development Engineer (SDE)' })
  name: string;
}

export class LearnerRolesResponseDto {
  @ApiProperty({ type: [LearnerRoleItemDto] })
  roles: LearnerRoleItemDto[];
}

export class UpsertLearnerRemoteLocationsDto {
  @ApiProperty({
    type: [String],
    example: ['Work From Home', 'Mumbai', 'Bengaluru'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  remoteLocations: string[];
}

export class UpdateLearnerRemoteLocationByIdDto {
  @ApiProperty({ type: String, example: 'Pune' })
  @IsString()
  @Length(1, 100)
  name: string;
}

export class LearnerRemoteLocationItemDto {
  @ApiProperty({ type: Number, example: 1 })
  id: number;

  @ApiProperty({ type: String, example: 'Work From Home' })
  name: string;
}

export class LearnerRemoteLocationsResponseDto {
  @ApiProperty({ type: [LearnerRemoteLocationItemDto] })
  remoteLocations: LearnerRemoteLocationItemDto[];
}

export class ResumeResponseDto {
  @ApiProperty({ type: String, example: 'John Doe' })
  name: string;

  @ApiProperty({ type: String, example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ type: String, example: '+91 9876543210' })
  phone: string;

  @ApiProperty({
    type: String,
    example: 'https://www.linkedin.com/in/john-doe',
  })
  linkedin: string;

  @ApiProperty({
    type: String,
    example: 'https://github.com/johndoe',
  })
  github: string;

  @ApiProperty({
    type: [String],
    example: ['TypeScript', 'NestJS', 'PostgreSQL'],
  })
  skills: string[];

  @ApiProperty({ type: [String], example: ['B.Tech', 'M.Tech'] })
  education: string[];
}

// ─── COMPLETE PROFILE DTOs ─────────────────────────────────────────

@ValidatorConstraint({ name: 'EndDateAfterStartDate', async: false })
class EndDateAfterStartDate implements ValidatorConstraintInterface {
  validate(endDate: string, args: ValidationArguments) {
    const dto = args.object as any;
    if (!endDate || !dto.startDate) return true;
    return new Date(endDate) >= new Date(dto.startDate);
  }

  defaultMessage() {
    return 'endDate must not be before startDate';
  }
}

export class ProjectDto {
  @ApiProperty({ example: 'E-commerce Platform' })
  @IsString()
  @Length(1, 255)
  @Matches(/^[a-zA-Z0-9\s\-_.,()&]+$/, {
    message:
      'title must contain only letters, numbers, spaces, and basic punctuation',
  })
  title: string;

  @ApiPropertyOptional({ example: 'A short summary of what it does...' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;

  @ApiPropertyOptional({
    example: ['React', 'Node.js', 'PostgreSQL'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  @ApiPropertyOptional({ example: 'Solo', enum: ['Solo', 'Team'] })
  @IsOptional()
  @IsString()
  @IsEnum(['Solo', 'Team'])
  projectType?: string;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be in YYYY-MM-DD format',
  })
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be in YYYY-MM-DD format',
  })
  @Validate(EndDateAfterStartDate)
  endDate?: string;

  @ApiPropertyOptional({ example: 'https://github.com/username/repo' })
  @IsOptional()
  @IsUrl({}, { message: 'githubUrl must be a valid URL' })
  githubUrl?: string;

  @ApiPropertyOptional({ example: 'https://project-demo.com' })
  @IsOptional()
  @IsUrl({}, { message: 'demoUrl must be a valid URL' })
  demoUrl?: string;

  @ApiPropertyOptional({
    example: 'Explain key features, challenges faced, and architecture...',
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  detailedDescription?: string;
}

export class WorkExperienceDto {
  @ApiPropertyOptional({ example: 'Software Intern' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-zA-Z\s\-.,()&]+$/, {
    message: 'title must contain only letters, spaces, and basic punctuation',
  })
  title?: string;

  @ApiPropertyOptional({ example: 'Google' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-zA-Z0-9\s\-.,()&]+$/, {
    message:
      'company must contain only letters, numbers, spaces, and basic punctuation',
  })
  company?: string;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be in YYYY-MM-DD format',
  })
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be in YYYY-MM-DD format',
  })
  @Validate(EndDateAfterStartDate)
  endDate?: string;

  @ApiPropertyOptional({ example: 'Worked on search optimization' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}

@ValidatorConstraint({ name: 'FutureGraduationDate', async: false })
class FutureGraduationDate implements ValidatorConstraintInterface {
  validate(year: number, args: ValidationArguments) {
    const dto = args.object as any;
    const month = dto.graduationMonth;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (!year) return true;
    if (year > currentYear) return true;
    if (year === currentYear && month && month >= currentMonth) return true;
    return false;
  }

  defaultMessage() {
    return 'Expected graduation date must be in the future';
  }
}

export class SaveCompleteProfileDto {
  // ─── PAGE 1: BASICS (Personal Details + Education) ──────────────
  @ApiPropertyOptional({ example: 'Aditya Kumar' })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  @Matches(/^[a-zA-Z\s.'-]+$/, {
    message:
      'fullName must contain only letters, spaces, dots, apostrophes, and hyphens',
  })
  fullName?: string;

  @ApiPropertyOptional({ example: '9999999999' })
  @IsOptional()
  @IsString()
  @Matches(/^(\+91)?[6-9]\d{9}$/, {
    message:
      'phoneNumber must be a valid 10-digit Indian number starting with 6-9 (optional +91 prefix)',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'aditya.student@zuvy.org' })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  email?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/yourname' })
  @IsOptional()
  @IsUrl({}, { message: 'linkedinProfile must be a valid URL' })
  linkedinProfile?: string;

  @ApiPropertyOptional({ example: 'IIT Bombay' })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  @Matches(/^[a-zA-Z0-9\s\-.,()&']+$/, {
    message:
      'collegeName must contain only letters, numbers, spaces, and basic punctuation',
  })
  collegeName?: string;

  @ApiPropertyOptional({ example: 'My Custom College' })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[a-zA-Z0-9\s\-.,()&']+$/, {
    message:
      'otherCollegeName must contain only letters, numbers, spaces, and basic punctuation',
  })
  otherCollegeName?: string;

  @ApiPropertyOptional({ example: 'B.Tech' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  degree?: string;

  @ApiPropertyOptional({ example: 'Computer Science' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  branch?: string;

  @ApiPropertyOptional({ example: '1st', enum: ['1st', '2nd', '3rd', '4th'] })
  @IsOptional()
  @IsString()
  @IsEnum(['1st', '2nd', '3rd', '4th'])
  yearOfStudy?: string;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  graduationMonth?: number;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2050)
  @Validate(FutureGraduationDate)
  graduationYear?: number;

  @ApiPropertyOptional({
    example: 'Learning',
    enum: ['Learning', 'Looking for Job', 'Working'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['Learning', 'Looking for Job', 'Working'])
  currentStatus?: string;

  // ─── PAGE 2: SKILLS & PROJECTS ──────────────────────────────────
  @ApiPropertyOptional({
    example: ['React', 'JavaScript', 'TypeScript'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technicalSkills?: string[];

  @ApiPropertyOptional({ type: [ProjectDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectDto)
  projects?: ProjectDto[];

  // ─── PAGE 3: EDUCATION & EXPERIENCE ─────────────────────────────
  @ApiPropertyOptional({ example: 'Computer Science' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  collegeStream?: string;

  @ApiPropertyOptional({ example: '8.5' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}(\.\d{1,2})?$/, {
    message: 'collegeScore must be a valid numeric score (e.g., 8.5 or 85)',
  })
  collegeScore?: string;

  @ApiPropertyOptional({ example: 'CGPA', enum: ['CGPA', '%'] })
  @IsOptional()
  @IsString()
  @IsEnum(['CGPA', '%'])
  collegeScoreType?: string;

  @ApiPropertyOptional({ example: 'CBSE' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  class12Board?: string;

  @ApiPropertyOptional({ example: '90' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}(\.\d{1,2})?$/, {
    message: 'class12Score must be a valid numeric score (e.g., 90 or 9.5)',
  })
  class12Score?: string;

  @ApiPropertyOptional({ example: '%', enum: ['CGPA', '%'] })
  @IsOptional()
  @IsString()
  @IsEnum(['CGPA', '%'])
  class12ScoreType?: string;

  @ApiPropertyOptional({ example: 'CBSE' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  class10Board?: string;

  @ApiPropertyOptional({ example: '85' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}(\.\d{1,2})?$/, {
    message: 'class10Score must be a valid numeric score (e.g., 85 or 9.2)',
  })
  class10Score?: string;

  @ApiPropertyOptional({ example: '%', enum: ['CGPA', '%'] })
  @IsOptional()
  @IsString()
  @IsEnum(['CGPA', '%'])
  class10ScoreType?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  hasWorkExperience?: boolean;

  @ApiPropertyOptional({ type: [WorkExperienceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkExperienceDto)
  workExperiences?: WorkExperienceDto[];

  @ApiPropertyOptional({ example: 'john_doe' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  @Matches(/^[a-zA-Z0-9_\-]*$/, {
    message:
      'leetcodeUsername must contain only letters, numbers, underscores, and hyphens',
  })
  leetcodeUsername?: string;

  @ApiPropertyOptional({ example: 'john_doe' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  @Matches(/^[a-zA-Z0-9_\-]*$/, {
    message:
      'codechefUsername must contain only letters, numbers, underscores, and hyphens',
  })
  codechefUsername?: string;

  @ApiPropertyOptional({ example: 'john_doe' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  @Matches(/^[a-zA-Z0-9_\-]*$/, {
    message:
      'codeforcesUsername must contain only letters, numbers, underscores, and hyphens',
  })
  codeforcesUsername?: string;

  // ─── PAGE 4: PREFERENCES ───────────────────────────────────────
  @ApiPropertyOptional({
    example: ['Full Stack Developer', 'Frontend Developer'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetRoles?: string[];

  @ApiPropertyOptional({
    example: ['Bangalore', 'Hyderabad', 'Pune'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredLocations?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  openToRemote?: boolean;

  @ApiPropertyOptional({ example: '₹20-30k' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  internshipStipend?: string;

  @ApiPropertyOptional({ example: '₹7-10 LPA' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  fullTimeCtc?: string;

  @ApiPropertyOptional({ example: ['Email', 'Whatsapp'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredContactMethods?: string[];
}
