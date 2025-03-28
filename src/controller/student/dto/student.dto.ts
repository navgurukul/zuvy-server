import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsNumber,
  IsBoolean,
} from 'class-validator';


export class ApplyFormData {
  @ApiProperty({
    type: String,
    example: 'prem',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    type: Number,
    example: '6301424989',
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  phoneNo: number;

  @ApiProperty({
    type: String,
    example: 'email@gmail.com',
    required: true,
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    type: String,
    example: '2022',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  year: string;

  @ApiProperty({
    type: Boolean,
    example: true,
    required: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  familyIncomeUnder3Lakhs: boolean;
}