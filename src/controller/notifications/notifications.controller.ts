import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    ValidationPipe,
    UsePipes,
    Optional,
    Query,
    BadRequestException,
    Req,
    Res,
    ParseArrayPipe
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiBody,
    ApiOperation,
    ApiQuery,
  } from '@nestjs/swagger';
  import { ApiBearerAuth } from '@nestjs/swagger';
  import { difficulty, questionType } from 'drizzle/schema';
  import { ClassesService } from '../classes/classes.service';
import { ErrorResponse, SuccessResponse } from 'src/errorHandler/handler';
// notifications.controller.ts
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/notifications.dto';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server } from 'socket.io';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get(':userId')
  getNotifications(@Param('userId') userId: string) {
    return this.notificationsService.getUserNotifications(userId);
  }

  @Post()
  createNotification(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.createNotification(createNotificationDto);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markNotificationAsRead(id);
  }
}

@WebSocketGateway({
  cors: { origin: '*' },
})
export class NotificationsGateway {
  @WebSocketServer() server: Server;

  sendToUser(userId: string, notification: any) {
    this.server.to(userId).emit('notification', notification);
  }

  sendToBatch(userIds: string[], notification: any) {
    userIds.forEach((id) => this.server.to(id).emit('notification', notification));
  }

  @SubscribeMessage('join')
  handleJoin(@MessageBody() userId: string) {
    console.log(`User ${userId} joined`);
    this.server.socketsJoin(userId);
  }
}
