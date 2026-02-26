import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSlotDto {
  @IsNotEmpty()
  @IsInt()
  mentorSlotManagementId: number;

  @IsNotEmpty()
  @IsISO8601()
  slotStartDateTime: string;

  @IsNotEmpty()
  @IsISO8601()
  slotEndDateTime: string;

  @IsNotEmpty()
  @IsInt()
  durationMinutes: number;

  @IsOptional() @IsInt() maxCapacity?: number;
  @IsOptional() @IsString() topic?: string;
  @IsOptional() @IsString() slotType?: string;
}
