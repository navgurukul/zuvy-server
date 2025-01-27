// import { ApiProperty } from '@nestjs/swagger';
// import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional } from 'class-validator';

// export class CreateNotificationDto {
//   @ApiProperty({
//     type: Number,
//     example: 1,
//     description: 'ID of the user to whom the notification belongs',
//     required: true,
//   })
//   @IsNotEmpty()
//   @IsNumber()
//   userId: number;

//   @ApiProperty({
//     type: String,
//     example: 'Your task has been completed successfully.',
//     description: 'The message content of the notification',
//     required: true,
//   })
//   @IsNotEmpty()
//   @IsString()
//   message: string;

//   @ApiProperty({
//     type: String,
//     example: 'info',
//     description: 'The type of notification (e.g., info, success, error)',
//     required: true,
//   })
//   @IsNotEmpty()
//   @IsString()
//   type: string;

//   @ApiProperty({
//     type: Boolean,
//     example: false,
//     description: 'Whether the notification has been read or not',
//     required: false,
//   })
//   @IsOptional()
//   @IsBoolean()
//   isRead?: boolean;
// }

// export class UpdateNotificationDto {
//   @ApiProperty({
//     type: String,
//     example: 'Updated notification message.',
//     description: 'The updated message content of the notification',
//     required: false,
//   })
//   @IsOptional()
//   @IsString()
//   message?: string;

//   @ApiProperty({
//     type: String,
//     example: 'success',
//     description: 'The updated type of notification (e.g., info, success, error)',
//     required: false,
//   })
//   @IsOptional()
//   @IsString()
//   type?: string;

//   @ApiProperty({
//     type: Boolean,
//     example: true,
//     description: 'Whether the notification has been read or not',
//     required: false,
//   })
//   @IsOptional()
//   @IsBoolean()
//   isRead?: boolean;
// }

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ type: Number, example: 1, description: 'User ID of the notification recipient' })
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @ApiProperty({ type: String, example: 'Your task is due tomorrow.', description: 'Notification message' })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiProperty({ type: String, example: 'info', description: 'Notification type (e.g., info, success)' })
  @IsNotEmpty()
  @IsString()
  type: string;
}

export class UpdateNotificationDto {
  @ApiProperty({ type: Boolean, example: true, description: 'Whether the notification has been read' })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}
