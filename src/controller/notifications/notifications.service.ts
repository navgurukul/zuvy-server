import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, desc } from 'drizzle-orm';
import { NotificationSchema } from 'drizzle/schema';
import { STATUS_CODES } from 'src/helpers';
import { CreateNotificationDto, UpdateNotificationDto } from './dto/notifications.dto';

@Injectable()
export class NotificationsService {

  private formatTime(createdAt: Date): string {
    const now = new Date();
    const diff = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 1000);

    if (diff < 60) return `${diff} secs ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hrs ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  }

  async getUserNotifications(userId: number): Promise<any> {
    try {
      const notifications = await db
        .select()
        .from(NotificationSchema)
        .where(eq(NotificationSchema.userId, userId))
        .orderBy(desc(NotificationSchema.createdAt));

        const formattedNotifications = notifications.map((n) => ({
          id: n.id,
          message: n.message,
          time: this.formatTime(new Date(n.createdAt)),
          read: n.isRead,
        }));

      if (notifications.length > 0) {
        return [
          null,
          {
            message: 'Notifications fetched successfully.',
            statusCode: STATUS_CODES.OK,
            data: notifications,
          },
        ];
      } else {
        return [
          { message: 'No notifications found.', statusCode: STATUS_CODES.NO_CONTENT },
          null,
        ];
      }
    } catch (error) {
      Logger.error(`Error fetching notifications: ${error.message}`);
      return [
        { message: error.message, statusCode: STATUS_CODES.BAD_REQUEST },
        null,
      ];
    }
  }

  async createNotification(createNotificationDto: CreateNotificationDto): Promise<any> {
    try {
      const newNotification = {
        userId: createNotificationDto.userId,
        message: createNotificationDto.message,
        type: createNotificationDto.type,
        isRead: false,
        createdAt: new Date(),
      };
      const result = await db
        .insert(NotificationSchema)
        .values(newNotification)
        .returning();

      return [
        null,
        {
          message: 'Notification created successfully.',
          statusCode: STATUS_CODES.CREATED,
          data: result[0],
        },
      ];
    } catch (error) {
      Logger.error(`Error creating notification: ${error.message}`);
      return [
        { message: error.message, statusCode: STATUS_CODES.BAD_REQUEST },
        null,
      ];
    }
  }

  // async updateNotification(id: number, updateNotificationDto: UpdateNotificationDto): Promise<any> {
  //   try {
  //     const result = await db
  //       .update(NotificationSchema)
  //       .set({
  //         ...(updateNotificationDto.message && { message: updateNotificationDto.message }),
  //         ...(updateNotificationDto.type && { type: updateNotificationDto.type }),
  //         ...(updateNotificationDto.isRead !== undefined && { isRead: updateNotificationDto.isRead }),
  //       })
  //       .where(eq(NotificationSchema.id, id))
  //       .returning();

  //     if (result.length > 0) {
  //       return [
  //         null,
  //         {
  //           message: 'Notification updated successfully.',
  //           statusCode: STATUS_CODES.OK,
  //           data: result[0],
  //         },
  //       ];
  //     } else {
  //       return [
  //         { message: 'Notification not found.', statusCode: STATUS_CODES.NOT_FOUND },
  //         null,
  //       ];
  //     }
  //   } catch (error) {
  //     Logger.error(`Error updating notification: ${error.message}`);
  //     return [
  //       { message: error.message, statusCode: STATUS_CODES.BAD_REQUEST },
  //       null,
  //     ];
  //   }
  // }

  async markNotificationAsRead(id: number): Promise<any> {
    try {
      const result = await db
        .update(NotificationSchema)
        .set({
          [NotificationSchema.isRead.name]: true,
        })
        .where(eq(NotificationSchema.id, id))
        .returning();

      if (result.length > 0) {
        return [
          null,
          {
            message: 'Notification marked as read.',
            statusCode: STATUS_CODES.OK,
            data: result[0],
          },
        ];
      } else {
        return [
          { message: 'Notification not found.', statusCode: STATUS_CODES.NOT_FOUND },
          null,
        ];
      }
    } catch (error) {
      Logger.error(`Error marking notification as read: ${error.message}`);
      return [
        { message: error.message, statusCode: STATUS_CODES.BAD_REQUEST },
        null,
      ];
    }
  }
}


