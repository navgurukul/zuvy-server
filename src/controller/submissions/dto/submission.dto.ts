import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty,IsDate, IsArray,IsObject, ValidateNested,IsOptional, IsEmail, IsNumber,IsDateString } from 'class-validator';
import { Type } from 'class-transformer';


export class CreateOpenendedQuestionDto {
    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    questionId: number;

    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsOptional()
    @IsNumber()
    assessmentId: number;

    @ApiProperty({
        type: String,
        example: 'fail',
        required: true,
    })
    @IsString()
    answer: string;
}

export class PatchOpenendedQuestionDto {
    @ApiProperty({
        type: String,
        example: 'fail',
        required: true,
    })
    @IsString()
    answer: string;
}

export class InstructorFeedbackDto {
    @ApiProperty({
        type: String,
        example: 'fail',
        required: true,
    })
    @IsString()
    feedback: string;

    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    marks: number;
}

export class StartAssessmentDto{
    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    assessmentId: number;

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
    moduleId: number;

    @ApiProperty({
        type: String,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsDateString()
    startedAt: string;
}


export class SubmissionassessmentDto{
    @ApiProperty({
        type: Number,
        example: 2,
        required: true,
    })
    @IsNotEmpty()
    tabChange: number;
    @ApiProperty({
        type: Number,
        example: 2,
        required: true,
    })
    @IsNotEmpty()
    copyPaste: number;
    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    embeddedGoogleSearch: number;

     // typeOfsubmission
    @ApiProperty({
        type: String,
        example: 'typeOfsubmission',
        required: false,
    })
    @IsOptional()
    @IsString()
    typeOfsubmission: string;
}
export class QuizSubmissionDto {
    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    questionId: number;

    //attempted
    @ApiProperty({
        type: Number,
        example: 2,
        required: true,
    })
    @IsNumber()
    @IsNotEmpty()
    attemptCount: number;

    @ApiProperty({
        type: Number,
        example: 2,
        required: true,
    })
    @IsNumber()
    @IsNotEmpty()
    chosenOption: number;
}

export class QuizSubmissionDtoList {
    @ApiProperty({
        type: [QuizSubmissionDto],
        required: true,
    })
    @IsNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => QuizSubmissionDto)
    quizSubmissionDto: QuizSubmissionDto[];
}

export class OpenEndedQuestionSubmissionDto{
    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    questionId: number;

    @ApiProperty({
        type: String,
        example: 'fail',
        required: true,
    })
    @IsString()
    answer: string;
}

  export class OpenEndedQuestionSubmissionDtoList {
    @ApiProperty({
      type: [OpenEndedQuestionSubmissionDto],
      required: true,
    })
    @IsNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => OpenEndedQuestionSubmissionDto)
    openEndedQuestionSubmissionDto: OpenEndedQuestionSubmissionDto[];
  }
// list of QuizSubmissionDto


