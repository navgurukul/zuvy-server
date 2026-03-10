import { IsString } from 'class-validator';

export class AttendanceDto {
  @IsString()
  joinedAt: string;

  @IsString()
  leftAt: string;
}
