import { ApiPropertyOptional } from '@nestjs/swagger';

export class MentorSearchDto {
  @ApiPropertyOptional({ example: 10 })
  limit?: number;

  @ApiPropertyOptional({ example: 0 })
  offset?: number;

  @ApiPropertyOptional()
  role?: string;

  @ApiPropertyOptional()
  expertise?: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  search?: string;

  @ApiPropertyOptional({ example: 12 })
  organizationId?: number;
}
