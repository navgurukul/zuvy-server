import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { helperVariable } from 'src/constants/helper';
import { eq, sql, inArray, and} from 'drizzle-orm';
import * as _ from 'lodash';
import {
  zuvyBatches,
  zuvySessions
} from 'drizzle/schema';
import { STATUS_CODES } from 'src/helpers';


const { ZUVY_CONTENT_URL, ZUVY_CONTENTS_API_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

//service.ts
import { drizzle } from '@drizzle-orm/node';
import { CreateNotificationDto } from './dto/notifications.dto';
import { NotificationSchema } from './notification.schema';

@Injectable()
export class NotificationsService {
  private db = drizzle();

  async getUserNotifications(userId: string) {
    return this.db.select().from(NotificationSchema).where(eq(NotificationSchema.userId, userId)).orderBy(NotificationSchema.createdAt, 'desc');
  }

  async createNotification(createNotificationDto: CreateNotificationDto) {
    const newNotification = {
      userId: createNotificationDto.userId,
      message: createNotificationDto.message,
      type: createNotificationDto.type,
      isRead: false,
      createdAt: new Date(),
    };
    await this.db.insert(NotificationSchema).values(newNotification);
    return newNotification;
  }

  async markNotificationAsRead(id: string) {
    return this.db.update(NotificationSchema).set({ isRead: true }).where(eq(NotificationSchema.id, id));
  }
}