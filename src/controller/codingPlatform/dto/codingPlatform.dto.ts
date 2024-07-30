import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsArray, ArrayNotEmpty, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
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


class Parameter {
  @ApiProperty({ type: 'string', example: 'str' })
  @IsString()
  parameterType: string;

  @ApiProperty({ type: 'any', example: '"example input"' })
  parameterValue: any;
}

export class TestCaseDto {
  @ApiProperty({
    type: 'object',
    example: {
      key1: { parameterType: 'str', parameterValue: '"example input 1"' },
      key2: { parameterType: 'str', parameterValue: '"example input 2"' },
    },
    required: true,
  })
  @IsArray()
  inputs: { [key: string]: Parameter };

  @ApiProperty({
    type: 'object',
    example: { expectedOutputType: 'str', expectedOutputValue: '"expected output"' },
    required: true,
  })
  @IsObject()
  expected_output: Parameter;
}

export class CreateProblemDto {
  @ApiProperty({ type: String, example: 'Add two numbers', required: true })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ type: String, example: 'Write a program to add two float values', required: true })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ type: String, example: 'Easy', required: true })
  @IsNotEmpty()
  @IsString()
  difficulty: 'Easy' | 'Medium' | 'Hard';

  @ApiProperty({ type: Number, example: 2 })
  @IsNumber()
  tagId: number;

  // @ApiProperty({ type: String, example: '10 < number < 1000', required: true })
  // @IsNotEmpty()
  // @IsString()
  // constraints: string;

  // @ApiProperty({ type: Number, example: 45499 })
  // @IsNumber()
  // authorId: number;

  @ApiProperty({
    type: [TestCaseDto],
    example: [
      {
        inputs: [{ parameterType: 'int', parameterValue: 5 , parameterName: 'a'},{ parameterType: 'int', parameterValue: 5 , parameterName: 'b'}],
        expected_output: { parameterType: 'int', parameterValue: 10 },
      },
    ],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases: TestCaseDto[];

  // @ApiProperty({ type: String, example: 'solution of the coding question', required: true })
  // @IsNotEmpty()
  // @IsString()
  // solution: string;

  @ApiProperty({ type: String, example: '2024-03-01T00:00:00Z', required: true })
  @IsString()
  createdAt: string;

  @ApiProperty({ type: String, example: '2024-03-01T00:00:00Z', required: true })
  @IsString()
  updatedAt: string;
}