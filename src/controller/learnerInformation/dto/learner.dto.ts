import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';

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

export class UpsertLearnerEducationMasterDataDto {
  @ApiProperty({
    type: [String],
    example: [
      'Indian Institute of Technology (IIT) Bombay',
      'Indian Institute of Technology (IIT) Delhi',
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  colleges: string[];

  @ApiProperty({
    type: [String],
    example: ['B.Tech', 'Diploma'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  programTypes: string[];

  @ApiProperty({
    type: [String],
    example: ['Computer Science', 'Electronics'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  branches: string[];
}

export class UpdateLearnerEducationMasterDataByIdDto {
  @ApiPropertyOptional({ type: String, example: 'IIT Bombay' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  collegeName?: string;

  @ApiPropertyOptional({ type: String, example: 'B.Tech' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  degreeProgram?: string;

  @ApiPropertyOptional({ type: String, example: 'Computer Science' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  branchName?: string;
}

export class LearnerEducationMasterDataItemDto {
  @ApiProperty({ type: Number, example: 1 })
  id: number;

  @ApiProperty({ type: String, example: 'IIT Madras' })
  name: string;
}

export class LearnerEducationMasterDataResponseDto {
  @ApiProperty({ type: [LearnerEducationMasterDataItemDto] })
  colleges: LearnerEducationMasterDataItemDto[];

  @ApiProperty({ type: [LearnerEducationMasterDataItemDto] })
  programTypes: LearnerEducationMasterDataItemDto[];

  @ApiProperty({ type: [LearnerEducationMasterDataItemDto] })
  branches: LearnerEducationMasterDataItemDto[];
}

export class CreateLearnerEducationMasterDataApiResponseDto {
  @ApiProperty({ type: Boolean, example: true })
  success: boolean;

  @ApiProperty({ type: LearnerEducationMasterDataResponseDto })
  data: LearnerEducationMasterDataResponseDto;
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
