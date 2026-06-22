import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import {
  users,
  zuvyMentorSlotBooking,
  zuvyMentorSlotAvailability,
  zuvyNotifications,
} from '../../../drizzle/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { NotificationType } from './notification.types';

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

    const bookingReferenceIds = notifications
      .filter((item) => item.referenceType === 'booking' && item.referenceId)
      .map((item) => item.referenceId);

    let bookingMap = new Map<number, any>();
    if (bookingReferenceIds.length > 0) {
      const bookings = await db
        .select({
          bookingId: zuvyMentorSlotBooking.id,
          mentorUserId: zuvyMentorSlotBooking.mentorUserId,
          studentUserId: zuvyMentorSlotBooking.studentUserId,
          slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
          slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
          referenceId: zuvyMentorSlotBooking.id,
        })
        .from(zuvyMentorSlotBooking)
        .leftJoin(
          zuvyMentorSlotAvailability,
          eq(
            zuvyMentorSlotAvailability.id,
            zuvyMentorSlotBooking.slotAvailabilityId,
          ),
        )
        .where(inArray(zuvyMentorSlotBooking.id, bookingReferenceIds));

      const userIds = [
        ...new Set(
          bookings.flatMap((booking) => [
            booking.mentorUserId,
            booking.studentUserId,
          ]),
        ),
      ];

      const usersById = userIds.length
        ? await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(inArray(users.id, userIds))
        : [];

      const userMap = new Map<bigint, string>(
        usersById.map((user) => [user.id, user.name] as [bigint, string]),
      );

      bookings.forEach((booking) => {
        bookingMap.set(booking.referenceId, {
          ...booking,
          mentorName: userMap.get(booking.mentorUserId) ?? null,
          studentName: userMap.get(booking.studentUserId) ?? null,
        });
      });
    }

    const enrichedNotifications = notifications.map((notification) => {
      const booking = bookingMap.get(notification.referenceId);

      const mentorName = booking?.mentorName;
      const studentName = booking?.studentName;

      const start = booking?.slotStart ? new Date(booking.slotStart) : null;

      const end = booking?.slotEnd ? new Date(booking.slotEnd) : null;

      const sessionTime =
        start && end
          ? `${start.toLocaleDateString('en-IN')} ${start.toLocaleTimeString(
              'en-IN',
              {
                hour: 'numeric',
                minute: '2-digit',
              },
            )} - ${end.toLocaleTimeString('en-IN', {
              hour: 'numeric',
              minute: '2-digit',
            })}`
          : null;

      let message = notification.message;

      switch (notification.type) {
        case NotificationType.BOOKING_CREATED:
          message =
            studentName && sessionTime
              ? `${studentName} booked a mentorship session with you on ${sessionTime}.`
              : message;
          break;

        case NotificationType.BOOKING_CONFIRMED:
          message =
            mentorName && sessionTime
              ? `Your mentorship session with ${mentorName} is confirmed for ${sessionTime}.`
              : message;
          break;

        case NotificationType.BOOKING_CANCELLED:
          message = sessionTime
            ? `Your mentorship session scheduled for ${sessionTime} has been cancelled.`
            : message;
          break;

        case NotificationType.RESCHEDULE_REQUEST:
          message = studentName
            ? `${studentName} requested to reschedule this mentorship session.`
            : message;
          break;

        case NotificationType.RESCHEDULE_ACCEPTED:
          message = sessionTime
            ? `Your reschedule request has been accepted. New session: ${sessionTime}.`
            : message;
          break;

        case NotificationType.RESCHEDULE_DECLINED:
          message = mentorName
            ? `${mentorName} declined your reschedule request.`
            : message;
          break;

        case NotificationType.FEEDBACK_SUBMITTED:
          message = 'Feedback has been submitted for this session.';
          break;
      }

      return {
        ...notification,
        message,
        studentName,
        mentorName,
        sessionStart: booking?.slotStart ?? null,
        sessionEnd: booking?.slotEnd ?? null,
        eventType: notification.type,
      };
    });

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
      total: enrichedNotifications.length,
      data: enrichedNotifications,
    };
  }
}
