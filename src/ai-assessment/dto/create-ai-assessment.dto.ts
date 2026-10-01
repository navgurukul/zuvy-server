import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PoolTopicDto {
  @IsInt()
  @Min(1)
  id: number;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateAiAssessmentDto {
  @IsInt()
  @Min(1)
  bootcampId: number;

  @IsInt()
  @Min(1)
  chapterId: number;

  /**
   * Required when chapterIds is non-empty (legacy tag resolve needs it).
   * Optional when mapping from poolTopics only.
   */
  @ValidateIf((o) => Array.isArray(o.chapterIds) && o.chapterIds.length > 0)
  @IsInt()
  @Min(1)
  moduleId?: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  objective: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  audience?: any | null;

  @IsOptional()
  @IsString()
  expectedOutcomes?: string;

  @IsInt()
  @Min(1)
  totalNumberOfQuestions: number;

  /** When set, moduleId is required so chapter tags can be resolved. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  chapterIds?: number[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PoolTopicDto)
  poolTopics: PoolTopicDto[];
}

export class ScheduleAssessmentDto {
  @IsDateString()
  startDatetime: string;

  @IsOptional()
  @IsDateString()
  endDatetime?: string;
}

export class PublishAssessmentDto {
  @IsOptional()
  @IsDateString()
  endDatetime?: string;
}

export class SelectedAnswerByStudentDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;

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
class QuestionAnswerDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsOptional()
  topic?: string;

  @IsString()
  @IsOptional()
  difficulty?: string;

  @ValidateNested()
  @Type(() => SelectedAnswerByStudentDto)
  options: SelectedAnswerByStudentDto;

  @ValidateNested()
  @Type(() => SelectedAnswerByStudentDto)
  selectedAnswerByStudent: SelectedAnswerByStudentDto;

  @IsString()
  @IsOptional()
  language?: string;
}

export class SubmitAssessmentDto {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => QuestionAnswerDto)
  answers: QuestionAnswerDto[];

  @IsNumber()
  aiAssessmentId: number;
}

export class GenerateAssessmentDto {
  @IsNumber()
  @IsNotEmpty()
  aiAssessmentId: number;

  @IsNumber()
  @IsNotEmpty()
  bootcampId: number;
}

export class ScoreQuestionItemDto {
  @IsInt()
  @Min(1)
  questionId: number;

  @IsInt()
  @Min(1)
  position: number;

  @IsString()
  question: string;

  options: Record<string, string>;

  @IsString()
  difficulty: string;

  @IsString()
  topic: string;

  @IsString()
  language: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  correctOptionSelectedByStudents?: number;
}

export class ScoreSubmitDto {
  @IsInt()
  @Min(1)
  assessmentId: number;

  @IsInt()
  @Min(1)
  courseId: number;

  @IsInt()
  @Min(1)
  moduleId: number;

  @IsInt()
  @Min(1)
  chapterId: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScoreQuestionItemDto)
  questions: ScoreQuestionItemDto[];
}
