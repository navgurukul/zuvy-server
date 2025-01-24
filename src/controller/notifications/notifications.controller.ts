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
import { ErrorResponse, SuccessResponse } from 'src/errorHandler/handler';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/notifications.dto';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server } from 'socket.io';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  @Get(':userId')
  @ApiOperation({ summary: 'Get notifications for a specific user' })
  @ApiQuery({
    name: 'userId',
    required: true,
    type: Number,
    description: 'ID of the user to fetch notifications for',
  })
  @ApiBearerAuth()
  async getNotifications(@Param('userId') userId: number, @Req() req, @Res() res) {
    try {
      const [err, success] = await this.notificationsService.getUserNotifications(userId);
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiBody({ type: CreateNotificationDto })
  @ApiBearerAuth()
  async createNotification(@Body() createNotificationDto: CreateNotificationDto, @Res() res) {
    try {
      const [err, success] = await this.notificationsService.createNotification(createNotificationDto);
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiQuery({
    name: 'id',
    required: true,
    type: Number,
    description: 'ID of the notification to mark as read',
  })
  @ApiBearerAuth()
  async markAsRead(@Param('id') id: number, @Res() res) {
    try {
      const [err, success] = await this.notificationsService.markNotificationAsRead(id);
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
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
