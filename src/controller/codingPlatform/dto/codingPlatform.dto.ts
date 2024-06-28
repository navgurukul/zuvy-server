import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsNumber,
  IsEmail,
  isString,
  IsObject,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { difficulty } from 'drizzle/schema';
export class SubmitCodeDto {
  @ApiProperty({
    type: Number,
    example: 1,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  languageId: number;

  @ApiProperty({
    type: String,
    example: 'Submit code',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  sourceCode: string;
}

export class testCaseDto {
  @ApiProperty({
    type: 'object',
    example: {
      input: [2, 3],
      output: [5],
    },
    required: true,
  })
  @IsObject()
  inputs: object;
}

export class CreateProblemDto {
  @ApiProperty({
    type: String,
    example: 'Add two numbers',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    type: String,
    example: 'Write a program to add two float values',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    type: difficulty,
    example: 'Easy',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  difficulty: 'Easy' | 'Medium' | 'Hard';

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  tags: number;

  @ApiProperty({
    type: String,
    example: ' 10 <number < 1000',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  constraints: string;

  @ApiProperty({
    type: Number,
    example: 45499,
  })
  @IsNumber()
  authorId: number;

  @ApiProperty({
    type: [testCaseDto],
    example: [
      {
        inputs: {
          input: [2, 3],
          output: [5],
        },
      },
    ],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => testCaseDto)
  examples: testCaseDto[];

  @ApiProperty({
    type: [testCaseDto],
    example: [
      {
        inputs: {
          input: [2, 3],
          output: [5],
        },
      },
      {
        inputs: {
          input: [5, 6],
          output: [11],
        },
      },
    ],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => testCaseDto)
  testCases: testCaseDto[];

  @ApiProperty({
    type: [Number, String],
    examples: [5, 'hello', 11],
  })
  @IsArray()
  @ArrayNotEmpty()
  expectedOutput: any[];

  @ApiProperty({
    type: String,
    example: 'solution of the coding question',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  solution: string;

  @ApiProperty({
    type: String,
    example: '2023-03-01T00:00:00Z',
    required: true,
  })
  @IsString()
  @IsOptional()
  createdAt: string;

  @ApiProperty({
    type: String,
    example: '2023-03-01T00:00:00Z',
    required: true,
  })
  @IsString()
  @IsOptional()
  updatedAt: string;

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  codingQuestionIds: number[];
}

