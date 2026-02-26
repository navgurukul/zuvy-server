import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMentorProfileDto {
  @IsNotEmpty()
  @IsInt()
  mentorUserId: number;

  @IsNotEmpty()
  @IsInt()
  organizationId: number;

  @IsOptional() @IsString() mentorType?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsInt() totalAvailableSlots?: number;
}
