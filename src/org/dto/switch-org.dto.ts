import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class SwitchOrgDto {
  @ApiProperty({
    example: 1,
    description: 'The ID of the organization to switch to',
  })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  orgId: number;

  @ApiProperty({ description: 'The current refresh token' })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
