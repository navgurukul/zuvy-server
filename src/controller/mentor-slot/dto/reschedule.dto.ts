import { IsNumber, IsString, MinLength } from 'class-validator';

export class ProposeRescheduleDto {
  @IsNumber()
  newSlotId: number;

  @IsString()
  @MinLength(10)
  reason: string;
}
