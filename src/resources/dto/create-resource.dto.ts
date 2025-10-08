import { IsString, IsNotEmpty, MaxLength, IsOptional, IsNumber, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ResourceKey, ResourceKeys } from 'src/rbac/utility';

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

  @ApiProperty({ description: 'Resource key', enum: ResourceKeys, example: 'Course' })
  @IsString() @IsIn(ResourceKeys)
  key: ResourceKey;
  
  @ApiProperty({
    description: 'Description of the resource',
    example: 'Manages course-related operations',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;
}