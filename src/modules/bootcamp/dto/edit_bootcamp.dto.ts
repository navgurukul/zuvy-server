// edit-bootcamp.dto.ts
import { IsString, IsNotEmpty,IsEmail } from 'class-validator';

export class EditBootcampDto {
  @IsNotEmpty()
  coverImage: string;

  @IsNotEmpty()
  @IsString()
  bootcampName: string;

  @IsNotEmpty()
  @IsString()
  bootcampTopic: string;

  @IsNotEmpty()
  @IsString()
  language: string;

  @IsNotEmpty()
  capEnrollment: number;

  @IsNotEmpty()
  @IsEmail()
  instractor_email: string;
}
