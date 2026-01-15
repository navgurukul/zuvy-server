import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateOrgDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  pocName?: string;

  @IsEmail()
  @IsNotEmpty()
  pocEmail: string;

  @IsBoolean()
  @IsOptional()
  isManagedByZuvy?: boolean;

  @IsEmail()
  @IsOptional()
  zuvyPocEmail?: string;

  @IsString()
  @IsOptional()
  zuvyPocName?: string;
}
