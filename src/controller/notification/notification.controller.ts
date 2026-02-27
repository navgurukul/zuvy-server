import { Controller, Get, Post, Param, ParseIntPipe } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ApiTags } from '@nestjs/swagger';

@Controller('notifications')
@ApiTags('Notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /* ==========================================================================
     GET USER NOTIFICATIONS
  ========================================================================== */

  @Get(':userId')
  async getUserNotifications(@Param('userId', ParseIntPipe) userId: number) {
    return this.notificationService.getUserNotifications(BigInt(userId));
  }

  /* ==========================================================================
     MARK NOTIFICATION AS READ
  ========================================================================== */

  @Post(':notificationId/read')
  async markAsRead(
    @Param('notificationId', ParseIntPipe)
    notificationId: number,
  ) {
    return this.notificationService.markAsRead(notificationId);
  }
}
