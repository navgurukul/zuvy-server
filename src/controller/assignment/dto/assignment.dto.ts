import { IsString, IsNotEmpty, IsArray, ValidateNested, IsEmail, IsNumber } from 'class-validator';
import { ApiProperty, ApiResponseProperty,ApiResponse } from '@nestjs/swagger';

export class AssignmentDto {
  @ApiProperty({
    description: 'The name of the assignment',
    type: String,
    example: 'assignment name',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The Deadline of the assignment',
    type: String,
    example: '2023-12-12',
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  deadline: string;

  @ApiProperty({
    description: 'The id of the assignment',
    type: Number,
    example: 20230,
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  bootcampId: number;

  @ApiProperty({
    description: 'The description',
    type: String,
    example: 'assignment description',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  description: string;
}
