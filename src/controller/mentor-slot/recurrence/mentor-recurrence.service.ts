import { Injectable, BadRequestException } from '@nestjs/common';
import { RRule } from 'rrule';
import { db } from '../../../db';
import { zuvyMentorSlotAvailability } from '../../../../drizzle/schema';
import { and, eq, sql } from 'drizzle-orm';

@Injectable()
export class MentorRecurrenceService {
  /* ==========================================================================
     GENERATE RECURRING SLOTS
  ========================================================================== */

  async generateRecurringSlots(params: {
    mentorSlotManagementId: number;
    slotStart: Date;
    slotEnd: Date;
    recurrenceRule: string;
    recurrenceEndDate: Date;
    previewOnly?: boolean;
  }) {
    const {
      mentorSlotManagementId,
      slotStart,
      slotEnd,
      recurrenceRule,
      recurrenceEndDate,
      previewOnly,
    } = params;

    if (!recurrenceRule) throw new BadRequestException('RRULE is required');

    const rule = RRule.fromString(recurrenceRule);

    const occurrences = rule.between(slotStart, recurrenceEndDate, true);

    if (occurrences.length > 200)
      throw new BadRequestException('Too many recurring slots. Limit is 200.');

    const duration = slotEnd.getTime() - slotStart.getTime();

    const generatedSlots = occurrences.map((date) => ({
      mentorSlotManagementId,
      slotStartDateTime: date,
      slotEndDateTime: new Date(date.getTime() + duration),
      durationMinutes: duration / (1000 * 60),
      isRecurring: true,
      recurrenceRule,
      recurrenceEndDate,
      status: 'available',
    }));

    if (previewOnly) {
      return generatedSlots;
    }

    /* Conflict Detection */
    for (const slot of generatedSlots) {
      const conflicts = await db
        .select({ id: zuvyMentorSlotAvailability.id })
        .from(zuvyMentorSlotAvailability)
        .where(
          and(
            eq(
              zuvyMentorSlotAvailability.mentorSlotManagementId,
              mentorSlotManagementId,
            ),
            sql`${zuvyMentorSlotAvailability.slotStartDateTime} < ${slot.slotEndDateTime}`,
            sql`${zuvyMentorSlotAvailability.slotEndDateTime} > ${slot.slotStartDateTime}`,
          ),
        );

      if (conflicts.length > 0) {
        throw new BadRequestException(
          'Recurring slot conflicts with existing availability.',
        );
      }
    }

    await db
      .insert(zuvyMentorSlotAvailability)
      .values(
        generatedSlots as (typeof zuvyMentorSlotAvailability.$inferInsert)[],
      );

    return { message: 'Recurring slots created successfully.' };
  }
}
