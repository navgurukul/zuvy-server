import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class AddSuperAdminDto {
  @ApiProperty({
    description: 'Email of the user to be added as Super Admin',
    example: 'admin@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
