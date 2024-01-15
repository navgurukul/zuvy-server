import { IsString, IsNotEmpty, IsArray, ValidateNested, IsEmail, IsNumber } from 'class-validator';
import { ApiProperty, ApiResponseProperty,ApiResponse } from '@nestjs/swagger';

// @ApiResponse({ status: 200, description: 'The fetch operation' })
export class BatchDto {
  @ApiProperty({
    description: 'The name of the bootcamp',
    type: String,
    example: 'bootcamp name',
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
    description: 'The id of the instructor',
    type: Number,
    example: 20230,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  bootcampId: number;
}
