import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsNumber,
  isArray,
  IsEmail,
  IsObject,
  ArrayNotEmpty,
  isString,
  IsArray,
  isNumber,
} from 'class-validator';
import { truncateSync } from 'fs';
import { Type } from 'class-transformer';
import { difficulty } from 'drizzle/schema';

export class moduleDto {
  @ApiProperty({
    type: String,
    example: 'Introduction to Python',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
    example: 'Python is a programming language',
  })
  @IsString()
  description: string;

  @ApiProperty({
    type: Number,
    example: 120900,
  })
  @IsNumber()
  timeAlloted: number;
}

export class chapterDto {
  @ApiProperty({
    type: String,
    example: 'Any thing like article or video or quiz',
    required: true,
  })
  @IsString()
  title: string;

  @ApiProperty({
    type: String,
    example: 'Any description to the chapter',
  })
  @IsString()
  description: string;

  @ApiProperty({
    type: String,
    example: '2023-03-01T00:00:00Z',
    required: true,
  })
  @IsString()
  @IsOptional()
  completionDate: string;

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsOptional()
  @IsArray()
  quizQuestions: number[];
}

export class quizDto {
  @ApiProperty({
    type: String,
    example: 'What is the national animal of India',
    required: true,
  })
  @IsString()
  question: string;

  @ApiProperty({
    type: 'object',
    example: {
      option1: 'Option 1',
      option2: 'Option 2',
      option3: 'Option 3',
      option4: 'Option 4',
    },
    required: true,
  })
  @IsObject()
  options: object;

  @ApiProperty({
    type: String,
    example: 'Option 2',
    required: true,
  })
  @IsString()
  correctOption: string;

  @ApiProperty({
    type: Number,
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  mark: number;

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  tagId: number;

  @ApiProperty({
    type: difficulty,
    example: 'Easy',
    required: true,
  })
  @IsString()
  @IsOptional()
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export class quizBatchDto {
  @ApiProperty({
    type: [quizDto],
    example: [
      {
        question: 'What is the national animal of India?',
        options: {
          option1: 'Option 1',
          option2: 'Option 2',
          option3: 'Option 3',
          option4: 'Option 4',
        },
        correctOption: 'Option 2',
        mark: 1,
        tagId: 2,
        difficulty: 'Easy',
      },
      {
        question: 'What is the capital of France?',
        options: {
          option1: 'Paris',
          option2: 'London',
          option3: 'Berlin',
          option4: 'Rome',
        },
        correctOption: 'Paris',
        mark: 1,
        tagId: 2,
        difficulty: 'Easy',
      },
    ],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => quizDto)
  questions: quizDto[];

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  quizQuestionIds: number[];
}

export class reOrderDto {
  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  newOrder: number;
}

export class ReOrderModuleBody {
  @ApiProperty({ type: moduleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => moduleDto)
  moduleDto: moduleDto;

  @ApiProperty({ type: reOrderDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => reOrderDto)
  reOrderDto: reOrderDto;
}

export class EditChapterDto {
  @ApiProperty({
    type: String,
    example: 'Any thing like article or video or quiz',
  })
  @IsString()
  @IsOptional()
  title: string;

  @ApiProperty({
    type: String,
    example: 'Any description to the chapter',
  })
  @IsString()
  @IsOptional()
  description: string;

  @ApiProperty({
    type: String,
    example: '2023-03-01T00:00:00Z',
  })
  @IsString()
  @IsOptional()
  completionDate: string;

  @ApiProperty({
    type: [String],
    example: ['https://www.google.com'],
  })
  @IsArray()
  @IsOptional()
  links: any[];

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  quizQuestions: any[];

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  codingQuestions: any[];

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  newOrder: number;
}

export class openEndedDto {
  @ApiProperty({
    type: String,
    example: 'What is the national animal of India',
    required: true,
  })
  @IsString()
  question: string;

  @ApiProperty({
    type: String,
    example: 'Tiger is the national animal of India',
    required: true,
  })
  @IsString()
  answer: string;

  @ApiProperty({
    type: Number,
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  marks: number;

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  tagId: number;

  @ApiProperty({
    type: difficulty,
    example: 'Easy',
    required: true,
  })
  @IsString()
  @IsOptional()
  difficulty: 'Easy' | 'Medium' | 'Hard';
}
export class CreateAssessmentBody {
  @ApiProperty({
    type: String,
    example: 'Assessment:Intro to Python',
  })
  @IsString()
  @IsOptional()
  title: string;

  @ApiProperty({
    type: String,
    example: 'This assessment has 2 dsa problems,5 mcq and 3 theory questions',
  })
  @IsString()
  @IsOptional()
  description: string;

  @ApiProperty({
    type: [Object],
    example: [{ 1: 2 }, { 2: 3 }],
  })
  @IsArray()
  @IsOptional()
  codingProblems: object[];

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  mcq: number[];

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  openEndedQuestions: number[];

  @ApiProperty({
    type: Number,
    example: 129304,
    required: true,
  })
  @IsNumber()
  timeLimit: number;
}
