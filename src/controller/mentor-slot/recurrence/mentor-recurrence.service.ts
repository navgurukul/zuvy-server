import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RRule } from 'rrule';
import { db } from '../../../db';
import {
  zuvyMentorSlotAvailability,
  zuvyMentorSlotManagement,
} from '../../../../drizzle/schema';
import { and, eq, lt, gt } from 'drizzle-orm';
import { ZoomLicenseService } from '../../zoom-license/zoom-license.service';

@Injectable()
export class MentorRecurrenceService {
  constructor(private readonly zoomLicenseService: ZoomLicenseService) {}

  /* ==========================================================================
     GENERATE RECURRING SLOTS
  ========================================================================== */

  async generateRecurringSlots(
    params: {
      mentorSlotManagementId: number;
      slotStart: Date;
      slotEnd: Date;
      recurrenceRule: string;
      recurrenceEndDate: Date;
      previewOnly?: boolean;
    },
    mentorUserId?: number,
  ) {
    const {
      mentorSlotManagementId,
      slotStart,
      slotEnd,
      recurrenceRule,
      recurrenceEndDate,
      previewOnly,
    } = params;

    if (!recurrenceRule) throw new BadRequestException('RRULE is required');

    await this.zoomLicenseService.syncLicensedUsersFromZoom();

    const [mentorProfile] = await db
      .select()
      .from(zuvyMentorSlotManagement)
      .where(eq(zuvyMentorSlotManagement.id, mentorSlotManagementId))
      .limit(1);

    if (!mentorProfile) {
      throw new NotFoundException('Mentor profile not found.');
    }

    if (mentorUserId) {
      if (mentorProfile.mentorUserId !== BigInt(mentorUserId)) {
        throw new ForbiddenException('You do not own this mentor profile.');
      }
    }

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

    // Two ranges [aStart,aEnd) and [bStart,bEnd) overlap iff aStart < bEnd
    // AND aEnd > bStart.
    const overlaps = (
      aStart: Date,
      aEnd: Date,
      bStart: Date,
      bEnd: Date,
    ): boolean => aStart < bEnd && aEnd > bStart;

    // Occurrences generated in THIS call were never checked against each
    // other before — only against rows already in the DB — so a cadence
    // shorter than the slot duration (e.g. a daily RRULE with 2h slots and
    // <2h between occurrences) could self-overlap undetected. See MDA-17.
    for (let i = 0; i < generatedSlots.length; i += 1) {
      for (let j = i + 1; j < generatedSlots.length; j += 1) {
        if (
          overlaps(
            generatedSlots[i].slotStartDateTime,
            generatedSlots[i].slotEndDateTime,
            generatedSlots[j].slotStartDateTime,
            generatedSlots[j].slotEndDateTime,
          )
        ) {
          throw new BadRequestException(
            'Recurring slots overlap each other — check the recurrence cadence against the slot duration.',
          );
        }
      }
    }

    await db.transaction(async (trx) => {
      /* Conflict Detection — one query covering the whole affected window
         instead of one query per occurrence (up to 200 round trips before
         this fix). See MDA-16. */
      const windowStart = new Date(
        Math.min(...generatedSlots.map((s) => s.slotStartDateTime.getTime())),
      );
      const windowEnd = new Date(
        Math.max(...generatedSlots.map((s) => s.slotEndDateTime.getTime())),
      );

      const existingSlotsInWindow = await trx
        .select({
          slotStartDateTime: zuvyMentorSlotAvailability.slotStartDateTime,
          slotEndDateTime: zuvyMentorSlotAvailability.slotEndDateTime,
        })
        .from(zuvyMentorSlotAvailability)
        .innerJoin(
          zuvyMentorSlotManagement,
          eq(
            zuvyMentorSlotAvailability.mentorSlotManagementId,
            zuvyMentorSlotManagement.id,
          ),
        )
        .where(
          and(
            eq(
              zuvyMentorSlotManagement.mentorUserId,
              mentorProfile.mentorUserId,
            ),
            lt(zuvyMentorSlotAvailability.slotStartDateTime, windowEnd),
            gt(zuvyMentorSlotAvailability.slotEndDateTime, windowStart),
          ),
        );

      const hasConflict = generatedSlots.some((slot) =>
        existingSlotsInWindow.some((existing) =>
          overlaps(
            new Date(existing.slotStartDateTime),
            new Date(existing.slotEndDateTime),
            slot.slotStartDateTime,
            slot.slotEndDateTime,
          ),
        ),
      );

      if (hasConflict) {
        throw new BadRequestException(
          'Recurring slot conflicts with existing mentor availability.',
        );
      }

      // Open slots don't hold a Zoom licence (one is reserved only when a
      // student books), but every slot time must have a licence free, so a
      // student can book any open slot. The check reserves nothing and runs
      // under the licence-pool lock. One mentor's slots in this batch never
      // overlap each other, so they can't compete for licences.
      const unavailable: string[] = [];

      for (const slot of generatedSlots) {
        const licence = await this.zoomLicenseService.checkLicenseAvailability(
          trx,
          {
            instructorId: Number(mentorProfile.mentorUserId),
            startTime: slot.slotStartDateTime,
            endTime: slot.slotEndDateTime,
          },
        );

        if (!licence.available) {
          unavailable.push(
            new Intl.DateTimeFormat('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZone: 'Asia/Kolkata',
            }).format(slot.slotStartDateTime),
          );
        }
      }

      if (unavailable.length > 0) {
        throw new BadRequestException(
          `No Zoom licence is free for ${unavailable.length} of these slot times: ${unavailable.join(', ')}. Remove those times and try again.`,
        );
      }

      await trx
        .insert(zuvyMentorSlotAvailability)
        .values(
          generatedSlots as (typeof zuvyMentorSlotAvailability.$inferInsert)[],
        );
    });

    return { message: 'Recurring slots created successfully.' };
  }
}
