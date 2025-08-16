import { IsEmail, IsInt, IsOptional, IsString, IsISO8601, Min, MaxLength, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// --- User DTOs ---
export class ZoomEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class CreateZoomUserDto extends ZoomEmailDto {
  @ApiPropertyOptional({ example: 'Jane', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;
}

export class SetZoomLicenseDto extends ZoomEmailDto {
  @ApiProperty({ enum: [1,2,3], example: 2, description: '1=Basic 2=Licensed 3=On-Prem' })
  @IsInt()
  @IsIn([1,2,3])
  type: 1 | 2 | 3; // 1 Basic, 2 Licensed, 3 On-Prem
}

export class UpdateZoomUserDto extends ZoomEmailDto {
  @ApiPropertyOptional({ example: 'Jane', maxLength: 50 })
  @IsOptional() @IsString() @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', maxLength: 50 })
  @IsOptional() @IsString() @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Jane D.' })
  @IsOptional() @IsString() @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ example: '+91 9876543210' })
  @IsOptional() @IsString() @MaxLength(30)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional() @IsString() @MaxLength(60)
  timezone?: string;

  @ApiPropertyOptional({ enum: [1,2,3], description: 'Optional license/type change while updating' })
  @IsOptional() @IsInt() @IsIn([1,2,3])
  type?: 1 | 2 | 3;
}

// --- Meeting DTOs ---
class ZoomMeetingSettingsDto {
  @ApiPropertyOptional({ example: true }) @IsOptional() host_video?: boolean;
  @ApiPropertyOptional({ example: true }) @IsOptional() participant_video?: boolean;
  @ApiPropertyOptional({ example: false }) @IsOptional() join_before_host?: boolean;
  @ApiPropertyOptional({ example: true }) @IsOptional() mute_upon_entry?: boolean;
  @ApiPropertyOptional({ example: true }) @IsOptional() waiting_room?: boolean;
  @ApiPropertyOptional({ example: 'both' }) @IsOptional() @IsString() audio?: string;
  @ApiPropertyOptional({ example: 'cloud', description: 'local | cloud | none' }) @IsOptional() @IsString() auto_recording?: string; // local|cloud|none
  @ApiPropertyOptional({ example: true }) @IsOptional() attendance_reporting?: boolean;
  @ApiPropertyOptional({ example: true }) @IsOptional() end_on_auto_off?: boolean;
  @ApiPropertyOptional({ example: true }) @IsOptional() allow_multiple_devices?: boolean;
  @ApiPropertyOptional({ example: true }) @IsOptional() show_share_button?: boolean;
  @ApiPropertyOptional({ example: true }) @IsOptional() alternative_hosts_email_notification?: boolean;
  @ApiPropertyOptional({ example: 'instructor@example.com;cohost@example.com', description: 'Semicolon separated emails' }) @IsOptional() @IsString() alternative_hosts?: string; // semicolon list
}

export class CreateZoomMeetingDto {
  @ApiProperty({ example: 'Weekly Live Class' }) @IsString() topic: string;
  @ApiPropertyOptional({ example: 'Overview of module 1' }) @IsOptional() @IsString() agenda?: string;
  @ApiProperty({ example: '2025-08-20T10:00:00Z' }) @IsISO8601() start_time: string; // ISO
  @ApiProperty({ example: 60, description: 'Duration in minutes' }) @IsInt() @Min(1) duration: number; // minutes
  @ApiPropertyOptional({ example: 'Asia/Kolkata' }) @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional({ example: 2, description: 'Zoom meeting type (2=scheduled)' }) @IsOptional() type?: number; // default 2
  @ApiPropertyOptional({ type: () => ZoomMeetingSettingsDto }) @IsOptional() @ValidateNested() @Type(() => ZoomMeetingSettingsDto) settings?: ZoomMeetingSettingsDto;
}

export class UpdateZoomMeetingDto {
  @ApiPropertyOptional({ example: 'Updated Live Class Name' }) @IsOptional() @IsString() topic?: string;
  @ApiPropertyOptional({ example: 'Updated agenda notes' }) @IsOptional() @IsString() agenda?: string;
  @ApiPropertyOptional({ example: '2025-08-20T11:00:00Z' }) @IsOptional() @IsISO8601() start_time?: string;
  @ApiPropertyOptional({ example: 90 }) @IsOptional() @IsInt() @Min(1) duration?: number;
  @ApiPropertyOptional({ example: 'Asia/Kolkata' }) @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional({ example: 2 }) @IsOptional() type?: number;
  @ApiPropertyOptional({ type: () => ZoomMeetingSettingsDto }) @IsOptional() @ValidateNested() @Type(() => ZoomMeetingSettingsDto) settings?: ZoomMeetingSettingsDto;
}
// Reuse CreateZoomUserDto for ensure-licensed and ZoomEmailDto for downgrade endpoints.
