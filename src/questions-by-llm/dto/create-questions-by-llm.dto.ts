import { IsArray, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateQuestionsByLlmDto {
  @IsArray()
  @IsNotEmpty()
  questions: {
    question: string;
    options: string[];
    correctOption: number;
    difficulty?: string;
    topic?: string;
    language?: string;
  }[];

  @IsString()
  @IsOptional()
  levelId?: string;
}
