import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PerTopicCountsDto {
  @IsOptional()
  @IsInt()
  easy?: number;

  @IsOptional()
  @IsInt()
  medium?: number;

  @IsOptional()
  @IsInt()
  hard?: number;
}

export class TopicConfigurationDto {
  @IsString()
  topicName: string;

  @IsString()
  topicDescription: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subtopics?: string[];

  @IsInt()
  @Min(1)
  totalQuestions: number;

  @IsOptional()
  @IsObject()
  difficultyDistribution?: PerTopicCountsDto;

  @IsOptional()
  @IsObject()
  questionCounts?: PerTopicCountsDto;
}

export class GenerateQuestionsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topicNames?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subtopics?: string[];

  @IsInt()
  @Min(1)
  numberOfQuestions: number;

  @IsOptional()
  @IsString()
  learningObjectives?: string;

  @IsOptional()
  @IsString()
  targetAudience?: string;

  @IsOptional()
  @IsString()
  focusAreas?: string;

  @IsOptional()
  @IsString()
  bloomsLevel?: string;

  @IsOptional()
  @IsString()
  questionStyle?: string;

  @IsOptional()
  @IsObject()
  difficultyDistribution?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };

  @IsOptional()
  @IsObject()
  questionCounts?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };

  @IsOptional()
  @IsObject()
  topics?: Record<string, number>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopicConfigurationDto)
  topicConfigurations: TopicConfigurationDto[];

  @IsOptional()
  @IsString()
  @IsIn(['A+', 'A', 'B', 'C', 'D', 'E'])
  levelId?: 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | null;
}

export interface GenerateTopicBatchJobPayload {
  topic: string;
  count: number;
  requestedByUserId?: string;
  orgId?: number;
  levelId?: 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | null;
  topicName?: string;
  topicDescription?: string;
  subtopics?: string[];
  learningObjectives?: string;
  targetAudience?: string;
  focusAreas?: string;
  bloomsLevel?: string;
  questionStyle?: string;
  difficultyDistribution?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
  questionCounts?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
  batchQuestionCounts?: {
    easy: number;
    medium: number;
    hard: number;
  };
  batchIndex?: number;
  batchCount?: number;
  totalCount?: number;
}
