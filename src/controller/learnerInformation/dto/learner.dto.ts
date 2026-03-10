import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
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

export class ProjectDto {
  @ApiProperty({ example: 'E-commerce Platform' })
  @IsString()
  @Length(1, 255)
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
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'https://github.com/username/repo' })
  @IsOptional()
  @IsString()
  githubUrl?: string;

  @ApiPropertyOptional({ example: 'https://project-demo.com' })
  @IsOptional()
  @IsString()
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
  title?: string;

  @ApiPropertyOptional({ example: 'Google' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'Worked on search optimization' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}

export class SaveCompleteProfileDto {
  // ─── PAGE 1: BASICS (Personal Details + Education) ──────────────
  @ApiPropertyOptional({ example: 'Aditya Kumar' })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  fullName?: string;

  @ApiPropertyOptional({ example: '9999999999' })
  @IsOptional()
  @IsString()
  @Length(7, 20)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'aditya.student@zuvy.org' })
  @IsOptional()
  @IsString()
  @Length(5, 255)
  email?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/yourname' })
  @IsOptional()
  @IsString()
  @Length(5, 500)
  linkedinProfile?: string;

  @ApiPropertyOptional({ example: 'IIT Bombay' })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  collegeName?: string;

  @ApiPropertyOptional({ example: 'My Custom College' })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  otherCollegeName?: string;

  @ApiPropertyOptional({ example: 'B.Tech' })
  @IsOptional()
  @IsString()
  degree?: string;

  @ApiPropertyOptional({ example: 'Computer Science' })
  @IsOptional()
  @IsString()
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
  collegeStream?: string;

  @ApiPropertyOptional({ example: '8.5' })
  @IsOptional()
  @IsString()
  collegeScore?: string;

  @ApiPropertyOptional({ example: 'CGPA', enum: ['CGPA', '%'] })
  @IsOptional()
  @IsString()
  @IsEnum(['CGPA', '%'])
  collegeScoreType?: string;

  @ApiPropertyOptional({ example: 'CBSE' })
  @IsOptional()
  @IsString()
  class12Board?: string;

  @ApiPropertyOptional({ example: '90' })
  @IsOptional()
  @IsString()
  class12Score?: string;

  @ApiPropertyOptional({ example: '%', enum: ['CGPA', '%'] })
  @IsOptional()
  @IsString()
  @IsEnum(['CGPA', '%'])
  class12ScoreType?: string;

  @ApiPropertyOptional({ example: 'CBSE' })
  @IsOptional()
  @IsString()
  class10Board?: string;

  @ApiPropertyOptional({ example: '85' })
  @IsOptional()
  @IsString()
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
  leetcodeUsername?: string;

  @ApiPropertyOptional({ example: 'john_doe' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  codechefUsername?: string;

  @ApiPropertyOptional({ example: 'john_doe' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
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
  internshipStipend?: string;

  @ApiPropertyOptional({ example: '₹7-10 LPA' })
  @IsOptional()
  @IsString()
  fullTimeCtc?: string;

  @ApiPropertyOptional({ example: ['Email', 'Whatsapp'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredContactMethods?: string[];

  // ─── PAGE 5: REVIEW ────────────────────────────────────────────
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  reviewCompleted?: boolean;

  // ─── PAGE NUMBER (which page is being saved) ───────────────────
  @ApiProperty({ example: 1, description: 'Page number being saved (1-5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  pageNumber: number;
}
