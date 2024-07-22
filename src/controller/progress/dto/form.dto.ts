import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty,IsDate, IsArray,IsObject, ValidateNested,IsOptional, IsEmail, IsNumber,IsDateString } from 'class-validator';
import { Type } from 'class-transformer';


export class QuestionCreateDto {
    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    questionId: number;

    @ApiProperty({
        type: [Number],
        example: [1, 2],
    })
    @IsOptional()
    @IsArray()
    chosenOptions: number[];

    @ApiProperty({
        type: String,
        example: 'Here is my answer',
      })
    @IsOptional()
    @IsString()
    answer: string;
}

export class PutQuestionDto {
    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    questionId: number;
    
    @ApiProperty({
        type: [Number],
        example: [1, 2],
    })
    @IsOptional()
    @IsArray()
    chosenOptions: number[];

    @ApiProperty({
        type: String,
        example: 'Here is my answer',
      })
    @IsOptional()
    @IsString()
    answer: string;

    @ApiProperty({
        type: String,
        example: 'pending',
        required: true,
    })
    @IsNotEmpty()
    @IsString()
    status: string;

    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    attemptCount: number;
}

export class CreateFormDto {
    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    userId: number;
    
    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    bootcampId: number;
    
    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    moduleId: number;


    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    formId: number;

    @ApiProperty({
        type: [QuestionCreateDto],
        required: true,
    })
    @IsNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => QuestionCreateDto)
    form: QuestionCreateDto[];
}

export class PutFormDto {
    @ApiProperty({
        type: [PutQuestionDto],
        required: true,
    })
    @IsNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => PutQuestionDto)
    form: PutQuestionDto[];
}

export class SubmitFormBodyDto {
    
    @ApiProperty({ type: [QuestionCreateDto] })
    @IsOptional()
    @ValidateNested()
    @Type(() => QuestionCreateDto)
    submitForm: QuestionCreateDto[];
    
  }