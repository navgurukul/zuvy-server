// notifications.dto.ts
export class CreateNotificationDto {
    userId: string;
    message: string;
    type: string; // e.g., 'info', 'success', 'error'
  }