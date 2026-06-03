import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import {
  zuvyMentorSlotBooking,
  zuvyNotifications,
} from '../../../drizzle/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

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

  async getUserNotifications(userId: bigint, organizationId?: number) {
    const filters = [eq(zuvyNotifications.userId, userId)];

    if (organizationId !== undefined) {
      filters.push(sql`(
        ${zuvyNotifications.referenceType} IS DISTINCT FROM 'booking'
        OR ${zuvyNotifications.referenceId} IN (
          SELECT ${zuvyMentorSlotBooking.id}
          FROM ${zuvyMentorSlotBooking}
          WHERE ${zuvyMentorSlotBooking.organizationId} = ${organizationId}
        )
      )`);
    }

    const notifications = await db
      .select()
      .from(zuvyNotifications)
      .where(and(...filters))
      .orderBy(desc(zuvyNotifications.createdAt));

    const unreadResult = await db
      .select({
        unread: sql<number>`
        COUNT(*) FILTER (WHERE ${zuvyNotifications.isRead} = false)
      `,
      })
      .from(zuvyNotifications)
      .where(and(...filters));

    return {
      unreadCount: Number(unreadResult[0].unread),
      total: notifications.length,
      data: notifications,
    };
  }
}
