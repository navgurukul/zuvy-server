import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsArray, ArrayNotEmpty, ValidateNested, IsObject, IsOptional } from 'class-validator';
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


class OutputParameter {
  @ApiProperty({ type: 'string', example: 'str' })
  @IsString()
  parameterType: string;

  @ApiProperty({ type: 'any', example: '"example input"' })
  @IsString()
  parameterValue: any;
}

class InputsParameter {
  @ApiProperty({ type: 'string', example: 'str' })
  @IsString()
  parameterType: string;

  @ApiProperty({ type: 'any', example: '"example input"' })
  @IsString()
  parameterValue: any;

  @ApiProperty({ type: 'string', example: 'a' })
  @IsString()
  parameterName: string;
}

export class TestCaseDto {
  @ApiProperty({
    type: 'array',
    example: [
      { parameterType: 'str', parameterValue: 'example input 1', parameterName: 'a' },
      { parameterType: 'str', parameterValue: 'example input 2', parameterName: 'b' },
    ],
    required: true,
  })
  @IsArray()
  inputs: { [key: string]: InputsParameter };

  @ApiProperty({
    type: 'object',
    example: { expectedOutputType: 'str', expectedOutputValue: 'expected output' },
    required: true,
  })
  @IsObject()
  expectedOutput: OutputParameter;
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

  @ApiProperty({
    type: [TestCaseDto],
    example: [
      {
        inputs: [{ parameterType: 'int', parameterValue: 5 , parameterName: 'a'},{ parameterType: 'int', parameterValue: 5 , parameterName: 'b'}],
        expectedOutput: { parameterType: 'int', parameterValue: 10 },
      },
    ],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases: TestCaseDto[];

  @ApiProperty({ type: String, example: '2024-03-01T00:00:00Z', required: true })
  @IsString()
  createdAt: string;

  @ApiProperty({ type: String, example: '2024-03-01T00:00:00Z', required: true })
  @IsString()
  updatedAt: string;

  @ApiProperty({ type: String, example: `2 <= nums.length <= 104
-109 <= nums[i] <= 109
-109 <= target <= 109`, required: true })
  @IsString()
  constraints: string;

  @ApiProperty({ type: Object, example: {"data":"about question"}, required: false })
  @IsObject()
  content: object
}




export class updateTestCaseDto {
  @ApiProperty({ type: Number, example: 2 })
  @IsNumber()
  @IsOptional()
  id: number;

  @ApiProperty({
    type: 'array',
    example: [
      { parameterType: 'str', parameterValue: 'example input 1', parameterName: 'a' },
      { parameterType: 'str', parameterValue: 'example input 2', parameterName: 'b' },
    ],
    required: true,
  })
  @IsArray()
  inputs: { [key: string]: InputsParameter };

  @ApiProperty({
    type: 'object',
    example: { expectedOutputType: 'str', expectedOutputValue: 'expected output' },
    required: true,
  })
  @IsObject()
  expectedOutput: OutputParameter;
}

export class updateProblemDto {
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

  @ApiProperty({
    type: [updateTestCaseDto],
    example: [
      {
        id: 1,
        inputs: [
          { parameterType: 'int', parameterValue: 5 , parameterName: 'a'},
          { parameterType: 'int', parameterValue: 5 , parameterName: 'b'}
        ],
        expectedOutput: { parameterType: 'int', parameterValue: 10 },
      },
    ],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => updateTestCaseDto)
  testCases: updateTestCaseDto[];

  @ApiProperty({ type: String, example: '2024-03-01T00:00:00Z', required: true })
  @IsString()
  updatedAt: string;

  @ApiProperty({ type: String, example: `2 <= nums.length <= 104
    -109 <= nums[i] <= 109
    -109 <= target <= 109`, required: false })
  @IsString()
  constraints: string;

  @ApiProperty({ type: Object, example: 'python', required: false })
  @IsObject()
  @IsOptional()
  content: object
}