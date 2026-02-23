import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrgDto {
  @ApiProperty({
    type: String,
    example: 'The title of the organization',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    type: String,
    example: 'The display name of the organization',
    required: false,
  })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'https://example.com/logo.png',
    required: false,
  })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'John Doe',
    description: 'Name of the Point of Contact',
  })
  @IsString()
  @IsOptional()
  pocName?: string;

  @ApiProperty({
    type: String,
    example: 'john.doe@example.com',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  pocEmail: string;

  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description: 'Whether the organization is managed by Zuvy',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isManagedByZuvy?: boolean;

  @ApiPropertyOptional({
    type: String,
    example: 'zuvy.poc@example.com',
    description: 'Zuvy Point of Contact Email',
  })
  @IsEmail()
  @IsOptional()
  zuvyPocEmail?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Zuvy POC Name',
    description: 'Zuvy Point of Contact Name',
  })
  @IsString()
  @IsOptional()
  zuvyPocName?: string;
}
