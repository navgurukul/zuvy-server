import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { helperVariable } from 'src/constants/helper';
import { eq, sql, inArray, and, desc} from 'drizzle-orm';
import * as _ from 'lodash';
import {
  zuvyBatches,
  zuvySessions,
  NotificationSchema
} from 'drizzle/schema';
import { STATUS_CODES } from 'src/helpers';


const { ZUVY_CONTENT_URL, ZUVY_CONTENTS_API_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT



@Injectable()
export class NotificationsService {
  async getUserNotifications(userId: number): Promise<any> {
    try {
      const notifications = await db
        .select()
        .from(NotificationSchema)
        .where(eq(NotificationSchema.userId, userId))
        .orderBy(desc(NotificationSchema.createdAt));

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

  async createNotification(createNotificationDto: any): Promise<any> {
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

  async markNotificationAsRead(id: number): Promise<any> {
    try {
      const result = await db
        .update(NotificationSchema)
        .set({
          [NotificationSchema.isRead.name]: true, 
        })
        .where(eq(NotificationSchema.id, id))
        .returning({
          id: NotificationSchema.id, 
        });
  
      if (result.length > 0) {
        return [
          null,
          {
            message: 'Notification marked as read.',
            statusCode: STATUS_CODES.OK,
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
