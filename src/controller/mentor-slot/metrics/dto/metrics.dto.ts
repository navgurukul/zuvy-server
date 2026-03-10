import { IsNumber } from 'class-validator';

export class MentorMetricsDto {
  @IsNumber()
  mentorUserId: number;
}
