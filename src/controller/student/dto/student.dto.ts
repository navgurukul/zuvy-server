import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsNumber,
  IsBoolean,
} from 'class-validator';


export class ApplyFormData {
  // name: string, email: string, phone: string, year:string, familyIncomeUnder3Lakhs: string 

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
    type: Number,
    example: '2022',
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  year: number;

  @ApiProperty({
    type: Boolean,
    example: 'TRUE',
    required: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  familyIncomeUnder3Lakhs: boolean;
}