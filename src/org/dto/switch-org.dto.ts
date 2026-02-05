import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SwitchOrgDto {
  @ApiProperty({
    example: 1,
    description: 'The ID of the organization to switch to',
  })
  @IsNumber()
  @IsNotEmpty()
  orgId: number;

  @ApiProperty({ description: 'The current refresh token' })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
