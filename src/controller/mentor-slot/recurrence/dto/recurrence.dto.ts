import { IsNumber, IsString, IsOptional, IsBoolean } from 'class-validator';

export class RecurrenceDto {
  @IsNumber()
  mentorSlotManagementId: number;

  @IsString()
  slotStart: string;

  @IsString()
  slotEnd: string;

  @IsString()
  recurrenceRule: string;

  @IsString()
  recurrenceEndDate: string;

  @IsOptional()
  @IsBoolean()
  previewOnly?: boolean;
}
