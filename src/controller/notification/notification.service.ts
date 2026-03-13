import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { zuvyNotifications } from '../../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class NotificationService {
  async createNotification(params: {
    userId: bigint;
    type: string;
    title: string;
    message: string;
    referenceId?: number;
    referenceType?: string;
  }) {
    await db.insert(zuvyNotifications).values({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      sentAt: new Date(),
    } as typeof zuvyNotifications.$inferInsert);
  }

  async markAsRead(notificationId: number) {
    await db
      .update(zuvyNotifications)
      .set({ isRead: true } as Partial<typeof zuvyNotifications.$inferInsert>)
      .where(eq(zuvyNotifications.id, notificationId));
  }

  async getUserNotifications(userId: bigint) {
    return db
      .select()
      .from(zuvyNotifications)
      .where(eq(zuvyNotifications.userId, userId))
      .orderBy(desc(zuvyNotifications.createdAt));
  }
}
