// create-bootcamp.dto.ts
import { IsString, IsNotEmpty, IsArray, ValidateNested, IsEmail } from 'class-validator';

class ScheduleDto {
  @IsNotEmpty()
  startTime: string;

  @IsNotEmpty()
  endTime: string;
  
  @IsNotEmpty()
  day: string;
}

export class CreateBootcampDto {
  @IsNotEmpty()
  coverImage: string;

  @IsNotEmpty()
  @IsString()
  bootcampName: string;

  @IsNotEmpty()
  @IsString()
  bootcampTopic: string;

  @IsNotEmpty()
  @IsEmail()
  instractor_email: string;

  @ValidateNested({ each: true })
  @IsArray()
  schedules: ScheduleDto[];

  @IsNotEmpty()
  @IsString()
  language: string;

  @IsNotEmpty()
  capEnrollment: number;
}
