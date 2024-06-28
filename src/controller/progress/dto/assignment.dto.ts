import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty,IsOptional,IsNumber, IsDate, ValidateNested } from 'class-validator';
import { McqCreateDto } from './quiz.dto';
import { Type } from 'class-transformer';

export class CreateAssignmentDto {
    @ApiProperty({
        type: String,
        example: 'https:://github.com/',
        required: true,
    })
    @IsOptional()
    @IsString()
    projectUrl: string;
}

export class PatchAssignmentDto {
    @ApiProperty({
        type: String,
        example: 'https:://github.com/',
        required: true,
    })
    @IsOptional()
    @IsString()
    projectUrl: string;
}

export class TimeLineAssignmentDto { 
    @ApiProperty({
        type: String,
        example: 'https:://github.com/',
        required: true,
    })
    @IsOptional()
    @IsString()
    projectUrl: string;

    @ApiProperty({
        type: String, 
        example: '2023-03-01T00:00:00Z',
        required: true,
      })
      @IsNotEmpty()
      @IsString()
      timeLimit: string;
}

export class SubmitBodyDto {
    @ApiProperty({ type: TimeLineAssignmentDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => TimeLineAssignmentDto)
    submitAssignment: TimeLineAssignmentDto;
  
    @ApiProperty({ type: [McqCreateDto] })
    @IsOptional()
    @ValidateNested()
    @Type(() => McqCreateDto)
    submitQuiz: McqCreateDto[];
  }

