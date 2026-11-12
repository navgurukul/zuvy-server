import { IsOptional, IsNumber, Min, Max } from 'class-validator';

export class FeedbackDto {
  // `whitelist: true` on the ValidationPipe now wired onto the submit-
  // feedback routes strips any property with zero decorators — this needs
  // @IsOptional() (even with no type constraint) or it would silently drop
  // the feedback text from every submission. See MDA-19/MDA-15.
  @IsOptional()
  feedback: any;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;
}
