import { ApiPropertyOptional } from '@nestjs/swagger';

export class MentorSearchDto {
  @ApiPropertyOptional()
  page?: number;

  @ApiPropertyOptional()
  limit?: number;

  @ApiPropertyOptional()
  role?: string;

  @ApiPropertyOptional()
  expertise?: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  search?: string;
}
