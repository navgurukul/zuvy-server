import { IsString, IsNotEmpty,IsOptional,  IsArray, ValidateNested, IsEmail, IsNumber } from 'class-validator';
import { ApiProperty, ApiResponseProperty,ApiResponse } from '@nestjs/swagger';

// @ApiResponse({ status: 200, description: 'The fetch operation' })
export class BatchDto {
  @ApiProperty({
    description: 'The name of the batch',
    type: String,
    example: 'batch name',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The id of the instructor',
    type: Number,
    example: 20230,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  instructorId: number;

  @ApiProperty({
    description: 'The id of the bootcampId',
    type: Number,
    example: 20230,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  bootcampId: number;
}

export class PatchBatchDto {
  @ApiProperty({
    description: 'The name of the batch',
    type: String,
    example: 'batch name',
  })
  @IsOptional()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The id of the instructor',
    type: Number,
    example: 20230,
  })
  @IsOptional()
  @IsNumber()
  instructorId: number;
}
