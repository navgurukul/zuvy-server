import { IsInt, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateBookingDto {
  @IsNotEmpty()
  @IsInt()
  slotAvailabilityId: number;

  @IsNotEmpty()
  @IsInt()
  studentUserId: number;

  @IsOptional()
  @IsInt()
  mentorUserId?: number;

  @IsOptional()
  @IsInt()
  organizationId?: number;
}
