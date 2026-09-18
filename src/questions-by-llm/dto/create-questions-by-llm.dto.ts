import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class DifficultyDistributionDto {
  @ApiProperty({ example: 11 })
  @IsNumber()
  @Min(0)
  easy: number;

  @ApiProperty({ example: 44 })
  @IsNumber()
  @Min(0)
  medium: number;

  @ApiProperty({ example: 45 })
  @IsNumber()
  @Min(0)
  hard: number;
}

class QuestionTopicConfigurationDto {
  @ApiProperty({ example: 'REST APIs' })
  @IsString()
  @IsNotEmpty()
  topicName: string;

  @ApiProperty({ example: 'Async and Await calls' })
  @IsString()
  @IsNotEmpty()
  topicDescription: string;

  @ApiProperty({ example: ['Async/Await', 'Error Handling'] })
  @IsArray()
  @IsString({ each: true })
  subtopics: string[];

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  totalQuestions: number;

  @ApiProperty({
    example: { easy: 1, medium: 2, hard: 2 },
    type: DifficultyDistributionDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => DifficultyDistributionDto)
  questionCounts: DifficultyDistributionDto;
}

export class GenerateQuestionsDto {
  @ApiProperty({ example: 'REST APIs' })
  @IsString()
  @IsNotEmpty()
  topicName: string;

  @ApiProperty({ example: 'Async and Await calls' })
  @IsString()
  @IsNotEmpty()
  topicDescription: string;

  @ApiProperty({ example: ['Async/Await', 'Error Handling'] })
  @IsArray()
  @IsString({ each: true })
  subtopics: string[];

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  numberOfQuestions: number;

  @ApiProperty({ example: 'To understand asynchronous API calls' })
  @IsString()
  @IsNotEmpty()
  learningObjectives: string;

  @ApiProperty({ example: 'Beginner students' })
  @IsString()
  @IsNotEmpty()
  targetAudience: string;

  @ApiProperty({ example: 'Focus on calling REST APIs' })
  @IsString()
  @IsNotEmpty()
  focusAreas: string;

  @ApiProperty({ example: 'apply' })
  @IsString()
  @IsNotEmpty()
  bloomsLevel: string;

  @ApiProperty({ example: 'practical' })
  @IsString()
  @IsNotEmpty()
  questionStyle: string;

  @ApiProperty({
    example: { easy: 11, medium: 44, hard: 45 },
    type: DifficultyDistributionDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => DifficultyDistributionDto)
  difficultyDistribution: DifficultyDistributionDto;

  @ApiProperty({
    example: { easy: 1, medium: 2, hard: 2 },
    type: DifficultyDistributionDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => DifficultyDistributionDto)
  questionCounts: DifficultyDistributionDto;

  @ApiProperty({ example: { node: 5 } })
  @IsObject()
  topics: Record<string, number>;

  @ApiProperty({ type: [QuestionTopicConfigurationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionTopicConfigurationDto)
  topicConfigurations: QuestionTopicConfigurationDto[];

  @ApiProperty({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  levelId: string | null;
}

export class CreateQuestionsByLlmDto {
  @IsArray()
  @IsNotEmpty()
  questions: {
    question: string;
    options: object;
    correctOption: number;
    difficulty?: string;
    topic?: string;
    language?: string;
  }[];

  @IsString()
  @IsOptional()
  levelId?: string;
}

export class CreateMcqQuestionOptionDto {
  @IsNumber()
  @IsNotEmpty()
  questionId: number;

  @IsString()
  @IsNotEmpty()
  optionText: string;

  @IsNumber()
  @IsNotEmpty()
  optionNumber: number;
}

export class CreateCorrectAnswerDto {
  @IsNumber()
  @IsNotEmpty()
  questionId: number;

  @IsNumber()
  @IsNotEmpty()
  correctOptionId: number;
}
