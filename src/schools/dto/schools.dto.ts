import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

const trim = ({ value }) => (typeof value === 'string' ? value.trim() : value);

export class CitiesQueryDto {
  @ApiProperty({
    description: 'State, as returned by GET /schools/states (any letter case)',
    example: 'Telangana',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  state: string;
}

export class SchoolsQueryDto extends CitiesQueryDto {
  @ApiProperty({
    description:
      'City (UDISE district), as returned by GET /schools/cities (any letter case)',
    example: 'Hyderabad',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  city: string;

  @ApiPropertyOptional({
    description:
      'Words to look for. Each word must appear in the school name, village or block, or start the UDISE code or pincode.',
    example: 'govt high',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
