import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, ValidateNested, IsNumber, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitCodeDto {
   
    @ApiProperty({
    type: Number,
    example: 1,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  languageId: number;
    

    @ApiProperty({
    type: String,
    example: 'Submit code',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  sourceCode: string;

}