import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrgDto {
  @ApiPropertyOptional({
    type: String,
    example: 'The title of the organization',
  })
  @IsString()
  @IsOptional()
  @MaxLength(30, {
    message: 'Organization name is too long. Maximum length is 30 characters',
  })
  title?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'The display name of the organization',
  })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'https://example.com/logo.png',
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

  @ApiPropertyOptional({ type: String, example: 'john.doe@example.com' })
  @IsEmail()
  @IsOptional()
  pocEmail?: string;

  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description: 'Whether the organization is managed by Zuvy',
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
