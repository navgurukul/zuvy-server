import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBootcampDto {
  @ApiProperty({
    description: 'The name of the bootcamp',
    type: String,
    example: 'bootcamp name',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;
}

class ScheduleDto {
  @ApiProperty({
    description: 'The schedule start time',
    type: String,
    format: 'date-time',
    example: '2022-03-01T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  startTime: String;

  @ApiProperty({
    description: 'The schedule end time',
    type: String,
    format: 'date-time',
    example: '2022-03-01T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  endTime: String;
  
  @ApiProperty({
    description: 'The schedule day',
    type: String,
    example: 'The schedule day',
    required: true,
  })
  @IsNotEmpty()
  day: string;
}

export class EditBootcampDto{
  @ApiProperty({
    description: 'The cover image of the bootcamp',
    type: String,
    example: 'The bootcamp cover image',
    required: true,
  })
  @IsNotEmpty()
  coverImage: string;

  @ApiProperty({
    description: 'The name of the bootcamp',
    type: String,
    example: 'The bootcamp name',
    required: true,
  })
  @IsNotEmpty({message: 'name is required'})
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The topic of the bootcamp',
    type: String,
    example: 'The bootcamp topic',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  bootcampTopic: string;

  @ApiProperty({
    description: 'The duration of the bootcamp',
    type: String,
    example: '3 months',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  duration: string;

  @ApiProperty({
    description: 'The start time of the bootcamp',
    type: String, 
    example: '2023-03-01T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  startTime: string;

  @ApiProperty({
    description: 'The language of the bootcamp',
    type: String,
    example: 'The bootcamp language',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  language: string;

  @ApiProperty({
    description: 'The cap enrollment of the bootcamp',
    type: Number,
    example: 500,
    required: true,
  })
  @IsNotEmpty({message: 'capEnrollment is required'})
  @IsNumber()
  capEnrollment: number;
}

export class PatchBootcampDto{
  @ApiProperty({
    description: 'The cover image of the bootcamp',
    type: String,
    example: 'The bootcamp cover image',
  })
  @IsOptional()
  coverImage: string;

  @ApiProperty({
    description: 'The name of the bootcamp',
    type: String,
    example: 'The bootcamp name',
  })
  @IsString()
  @IsOptional()
  name: string;

  @ApiProperty({
    description: 'The topic of the bootcamp',
    type: String,
    example: 'The bootcamp topic',
  })
  @IsOptional()
  @IsString()
  bootcampTopic: string;

  @ApiProperty({
    description: 'The duration of the bootcamp',
    type: String,
    example: '3 months',
    required: true,
  })
  @IsString()
  @IsOptional()
  duration: string;

  @ApiProperty({
    description: 'The start time of the bootcamp',
    type: String, 
    example: '2023-03-01T00:00:00Z',
    required: true,
  })
  @IsString()
  @IsOptional()
  startTime: string;

  @ApiProperty({
    description: 'The language of the bootcamp',
    type: String,
    example: 'The bootcamp language',
  })
  @IsOptional()
  @IsString()
  language: string;

  @ApiProperty({
    description: 'The cap enrollment of the bootcamp',
    type: Number,
    example: 500,
  })
  @IsOptional()
  @IsNumber()
  capEnrollment: number;
}
class studentEmail {
  @ApiProperty({
    description: 'The students email',
    type: String,
    example: 'The students email',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({
    description: 'The students name',
    type: String,
    example: 'The students name',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;
}
export class studentDataDto {
  @ApiProperty({
    description: 'Array of student data',
    type: [studentEmail],
    required: true,
  })
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => studentEmail)
  students: studentEmail[];
}