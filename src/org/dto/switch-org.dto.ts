import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SwitchOrgDto {
  @ApiProperty({
    example: 1,
    description: 'The ID of the organization to switch to',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  orgId: number;

  @ApiProperty({ description: 'The current refresh token' })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
