import { IsNumber } from 'class-validator';

export class BookSlotDto {
  @IsNumber()
  slotId: number;
}
