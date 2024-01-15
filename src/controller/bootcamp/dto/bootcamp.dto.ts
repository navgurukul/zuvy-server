import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty,IsDate, IsArray,IsObject, ValidateNested, IsEmail, IsNumber } from 'class-validator';
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
    description: 'The id of the instractor',
    type: Number,
    example: 20230,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  instractorId: number;

  @ApiProperty({
    description: 'The schedules of the bootcamp',
    type: [ScheduleDto], // Indicate that this is an array of ScheduleDto objects
    example: 
      [{
        startTime: new Date(),
        endTime: new Date(),
        day: 'The schedule day',
      }],
    required: true,
  })
  @ValidateNested({ each: true })
  @Type(() => ScheduleDto) // This decorator is needed to instantiate ScheduleDto objects
  schedules: ScheduleDto[];

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
