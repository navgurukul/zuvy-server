import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAiAssessmentDto {}
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

  @IsObject()
  @IsNotEmpty()
  options: Record<string, string>;

  @IsNumber()
  @IsNotEmpty()
  correctOption: number;

  @IsNumber()
  @IsNotEmpty()
  selectedAnswerByStudent: number;

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
}
