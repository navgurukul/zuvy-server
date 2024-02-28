import { IsString, IsNotEmpty,IsOptional,  IsArray, ValidateNested, IsEmail, IsNumber } from 'class-validator';
import { ApiProperty, ApiResponseProperty,ApiResponse } from '@nestjs/swagger';

export class DriveDto {
  @ApiProperty({
    type: String,
    example: 'GOLD DEMO (2024-02-16 20:30 GMT+5:30)',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
    example: "1xOwaOTs2xMlDLt9BB7oh4KJNLtxBz-Ey",
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  fileId: string;
 }

