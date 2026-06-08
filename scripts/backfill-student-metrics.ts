import { db } from '../src/db';
import {
  zuvyMentorSlotBooking,
  zuvyStudentBookingMetrics,
} from '../drizzle/schema';
import { eq, sql, and, gte, lte } from 'drizzle-orm';

async function backfillStudentMetrics() {
  console.log('Starting backfill of student booking metrics...');

  // Get all unique student user IDs from bookings
  const students = await db
    .selectDistinct({
      userId: zuvyMentorSlotBooking.studentUserId,
    })
    .from(zuvyMentorSlotBooking);

  console.log(`Found ${students.length} students with bookings`);

  for (const student of students) {
    const userId = student.userId;

    // Get quota window
    const now = new Date();
    const year = now.getUTCFullYear();
    let quotaStart = new Date(Date.UTC(year, 3, 15)); // April 15
    let quotaEnd = new Date(Date.UTC(year + 1, 3, 14, 23, 59, 59));

    if (now < quotaStart) {
      quotaStart = new Date(Date.UTC(year - 1, 3, 15));
      quotaEnd = new Date(Date.UTC(year, 3, 14, 23, 59, 59));
    }

    // Count total bookings
    const [{ count: totalBookings }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.studentUserId, userId));

    // Count quota used in current window
    const [{ count: quotaUsed }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(zuvyMentorSlotBooking)
      .where(
        and(
          eq(zuvyMentorSlotBooking.studentUserId, userId),
          sql`${zuvyMentorSlotBooking.confirmedAt} >= ${quotaStart}`,
          sql`${zuvyMentorSlotBooking.confirmedAt} <= ${quotaEnd}`,
        ),
      );

    // Get last booking date
    const [lastBooking] = await db
      .select({ confirmedAt: zuvyMentorSlotBooking.confirmedAt })
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.studentUserId, userId))
      .orderBy(sql`${zuvyMentorSlotBooking.confirmedAt} DESC`)
      .limit(1);

    const lastBookingDate = lastBooking?.confirmedAt;
    const cooldownEndDate = lastBookingDate
      ? new Date(lastBookingDate.getTime() + 21 * 24 * 60 * 60 * 1000)
      : null;

    // Insert or update metrics
    await db
      .insert(zuvyStudentBookingMetrics)
      .values({
        userId,
        totalBookings: totalBookings || 0,
        quotaUsed: quotaUsed || 0,
        lastBookingDate,
        quotaResetDate: quotaEnd,
        cooldownEndDate,
        isQuotaExhausted: (quotaUsed || 0) >= 3,
      } as typeof zuvyStudentBookingMetrics.$inferInsert)
      .onConflictDoUpdate({
        target: zuvyStudentBookingMetrics.userId,
        set: {
          totalBookings: totalBookings || 0,
          quotaUsed: quotaUsed || 0,
          lastBookingDate: lastBookingDate || null,
          quotaResetDate: quotaEnd,
          cooldownEndDate: cooldownEndDate || null,
          isQuotaExhausted: (quotaUsed || 0) >= 3,
          updatedAt: new Date(),
        } as Partial<typeof zuvyStudentBookingMetrics.$inferInsert>,
      });

    console.log(
      `Backfilled metrics for user ${userId}: total=${totalBookings}, quotaUsed=${quotaUsed}`,
    );
  }

  console.log('Backfill completed');
}

backfillStudentMetrics().catch(console.error);
