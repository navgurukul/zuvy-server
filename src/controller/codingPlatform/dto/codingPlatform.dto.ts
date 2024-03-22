import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, ValidateNested, IsNumber, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitCodeDto {
    @ApiProperty({
    type: String,
    example: 'Submit code',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  sourceCode: string;

  @ApiProperty({
    type: String,
    example: 'Standard input',
    required: false,
  })
  @IsNotEmpty()
  @IsString()
  stdInput: string;

  @ApiProperty({
    type: String,
    example: 'Expected output',
    required: false,
  })
  @IsOptional()
  @IsString()
  expectedOutput: string;

}