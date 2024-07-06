// src/dto/create-feedback.dto.ts

import {
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class SectionDto {
  @IsString()
  type: string;

  @IsString()
  question: string;

  @IsArray()
  @IsOptional()
  options: string[];

  @IsString({ each: true })
  @IsArray()
  answer: string | string[];
}

export class CreateFeedbackDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @ValidateNested({ each: true })
  @Type(() => SectionDto)
  @ArrayMinSize(1)
  section: SectionDto[];
}
