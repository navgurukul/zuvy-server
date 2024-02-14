import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty,IsDate, IsArray,IsObject, ValidateNested,IsOptional, IsEmail, IsNumber,IsDateString } from 'class-validator';
import { Type } from 'class-transformer';


export class McqCreateDto {
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
    moduleId: number;

    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    quizId: number;

    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    mcqId: number;

    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    chossenOption: number;

    @ApiProperty({
        type: String,
        example: 'fail',
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

export class PutMcqDto {
    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    chossenOption: number;

    @ApiProperty({
        type: String,
        example: 'fail',
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

export class CreateQuizDto {
    @ApiProperty({
      type: [McqCreateDto],
      required: true,
    })
    @IsNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => McqCreateDto)
    quiz: McqCreateDto[];
}

export class PutQuizDto {
    @ApiProperty({
      type: [PutMcqDto],
      required: true,
    })
    @IsNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => PutMcqDto)
    quiz: PutMcqDto[];
}