// create-resource.dto.ts
import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateResourceDto {
  @ApiProperty({
    description: 'Name of the resource (must be unique)',
    example: 'course',
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Description of the resource',
    example: 'Manages course-related operations',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;
}