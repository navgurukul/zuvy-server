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
  IsArray
} from 'class-validator';
import { truncateSync } from 'fs';
import { Type } from 'class-transformer';

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
}

export class chapterDto {
  @ApiProperty({
    type: String,
    example: 'Any thing like article or video or quiz',
    required: true
  })
  @IsString()
  title: string;

  @ApiProperty({
    type: String,
    example: 'Any description to the chapter',
  })
  @IsString()
  description: string;
}

export class quizDto {
    @ApiProperty({
        type: String,
        example: 'name',
      })
      @IsString()
      name: string;
      
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
      options:object;

      @ApiProperty({
        type: String,
        example: 'Option 2',
        required:true
      })
      @IsString()
      correctOption:string;

      @ApiProperty({
        type:Number,
        example: 1
      })
      @IsNumber()
      order:number
}

export class quizBatchDto {

    @ApiProperty({
      type: [quizDto],
      example: [
        {
          name: 'Quiz 1',
          question: 'What is the national animal of India?',
          options: {
            option1: 'Option 1',
            option2: 'Option 2',
            option3: 'Option 3',
            option4: 'Option 4',
          },
          correctOption: 'Option 2',
          order: 1,
        },
        {
          name: 'Quiz 2',
          question: 'What is the capital of France?',
          options: {
            option1: 'Paris',
            option2: 'London',
            option3: 'Berlin',
            option4: 'Rome',
          },
          correctOption: 'Paris',
          order: 1,
        },
      ],
      required: true,
    })
    
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => quizDto)
    questions: quizDto[];
  }

  export class reOrderDto {
    @ApiProperty({
        type: Number,
        example: 10,
      })
      @IsNumber()
      moduleId: number;

      @ApiProperty({
        type: Number,
        example: 2,
      })
      @IsNumber()
      newOrder: number;
  }
