import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /* ==========================================================================
       GET USER NOTIFICATIONS
    ========================================================================== */

  @Get()
  async getMyNotifications(@Req() req) {
    return this.notificationService.getUserNotifications(
      BigInt(req.user[0].id),
      req.user[0].orgId ? Number(req.user[0].orgId) : undefined,
    );
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
