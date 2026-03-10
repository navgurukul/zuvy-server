import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { db } from '../../db';
import {
  zuvyMentorSlotBooking,
  zuvyMentorSlotAvailability,
} from '../../../drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationJob {
  constructor(private readonly notificationService: NotificationService) {}

  /* 24H Reminder */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async send24HourReminders() {
    const now = new Date();
    const targetStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const windowEnd = new Date(targetStart.getTime() + 10 * 60 * 1000);

    const bookings = await db
      .select({
        bookingId: zuvyMentorSlotBooking.id,
        studentId: zuvyMentorSlotBooking.studentUserId,
      })
      .from(zuvyMentorSlotBooking)
      .innerJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotBooking.slotAvailabilityId,
          zuvyMentorSlotAvailability.id,
        ),
      )
      .where(
        and(
          eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
          eq(zuvyMentorSlotBooking.reminder24hSent, false),
          sql`${zuvyMentorSlotAvailability.slotStartDateTime} BETWEEN ${targetStart} AND ${windowEnd}`,
        ),
      );

    for (const booking of bookings) {
      await this.notificationService.createNotification({
        userId: booking.studentId,
        type: 'SESSION_REMINDER_24H',
        title: 'Upcoming Session Reminder',
        message: 'Your session is scheduled in 24 hours.',
        referenceId: booking.bookingId,
        referenceType: 'booking',
      });

      await db
        .update(zuvyMentorSlotBooking)
        .set({ reminder24hSent: true } as Partial<
          typeof zuvyMentorSlotBooking.$inferInsert
        >)
        .where(eq(zuvyMentorSlotBooking.id, booking.bookingId));
    }
  }

  /* 1H Reminder */
  @Cron(CronExpression.EVERY_MINUTE)
  async send1HourReminders() {
    const now = new Date();
    const targetStart = new Date(now.getTime() + 60 * 60 * 1000);
    const windowEnd = new Date(targetStart.getTime() + 60 * 1000);

    const bookings = await db
      .select({
        bookingId: zuvyMentorSlotBooking.id,
        studentId: zuvyMentorSlotBooking.studentUserId,
      })
      .from(zuvyMentorSlotBooking)
      .innerJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotBooking.slotAvailabilityId,
          zuvyMentorSlotAvailability.id,
        ),
      )
      .where(
        and(
          eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
          eq(zuvyMentorSlotBooking.reminder1hSent, false),
          sql`${zuvyMentorSlotAvailability.slotStartDateTime} BETWEEN ${targetStart} AND ${windowEnd}`,
        ),
      );

    for (const booking of bookings) {
      await this.notificationService.createNotification({
        userId: booking.studentId,
        type: 'SESSION_REMINDER_1H',
        title: 'Session Starting Soon',
        message: 'Your session starts in 1 hour.',
        referenceId: booking.bookingId,
        referenceType: 'booking',
      });

      await db
        .update(zuvyMentorSlotBooking)
        .set({ reminder1hSent: true } as Partial<
          typeof zuvyMentorSlotBooking.$inferInsert
        >)
        .where(eq(zuvyMentorSlotBooking.id, booking.bookingId));
    }
  }
}
