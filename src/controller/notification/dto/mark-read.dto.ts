import { IsNumber } from 'class-validator';

export class MarkReadDto {
  @IsNumber()
  notificationId: number;
}
