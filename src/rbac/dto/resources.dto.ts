// create-resource.dto.ts
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateResourceDto {
  // @ApiProperty({
  //   description: 'Name of the resource (must be unique)',
  //   example: 'course',
  //   maxLength: 100
  // })
  // @IsString()
  // @IsNotEmpty()
  // @MaxLength(100)
  // name: string;

  @ApiProperty({
    description: 'Role ID of the resource',
    example: 1,
    required: true
  })
  @IsNumber()
  @IsNotEmpty()
  roleId: number;
  
  @ApiProperty({
    description: 'Description of the resource',
    example: 'Manages course-related operations',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Key of the resource',
    example: 'course',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  key: string;  

  @ApiProperty({
    description: 'Display name of the resource',
    example: 'Course',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  displayName: string;
}

export class resourceActionDto {
  @ApiProperty({
    description: 'Action of the resource',
    example: 'view',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({
    description: 'Description of the resource',
    example: 'Manages course-related operations',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'resourceId of the resource action',
    example: true,
    required: true
  })
  @IsNumber()
  @IsNotEmpty()
  resourceId: number;
}