import { IsOptional, IsNumber } from 'class-validator';

export class FeedbackDto {
  feedback: any;

  @IsOptional()
  @IsNumber()
  rating?: number;
}
