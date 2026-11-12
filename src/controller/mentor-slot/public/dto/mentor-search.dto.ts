import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

// Query-string DTO. Every field needs a class-validator decorator because the
// student mentor controller runs ValidationPipe with `whitelist: true`, which
// strips any property that has none. Numeric fields use @Type so the query
// strings are converted before validation.
export class MentorSearchDto {
  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  limit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expertise?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  organizationId?: number;
}
