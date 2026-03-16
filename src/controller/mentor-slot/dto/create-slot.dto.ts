import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateSlotDto {
  @IsString()
  slotStartDateTime: string;

  @IsString()
  slotEndDateTime: string;

  @IsOptional()
  @IsNumber()
  maxCapacity?: number;

  @IsOptional()
  @IsString()
  topic?: string;
}
