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
import { and, eq, sql } from 'drizzle-orm';
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

    await db.transaction(async (trx) => {
      /* Conflict Detection */
      for (const slot of generatedSlots) {
        const conflicts = await trx
          .select({ id: zuvyMentorSlotAvailability.id })
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
              sql`${zuvyMentorSlotAvailability.slotStartDateTime} < ${slot.slotEndDateTime}`,
              sql`${zuvyMentorSlotAvailability.slotEndDateTime} > ${slot.slotStartDateTime}`,
            ),
          );

        if (conflicts.length > 0) {
          throw new BadRequestException(
            'Recurring slot conflicts with existing mentor availability.',
          );
        }
      }

      const licenseIds: number[] = [];

      for (const slot of generatedSlots) {
        const licenseId = await this.zoomLicenseService.assignLicense(trx, {
          instructorId: Number(mentorProfile.mentorUserId),
          startTime: slot.slotStartDateTime,
          endTime: slot.slotEndDateTime,
        });

        licenseIds.push(licenseId);
      }

      const createdSlots = await trx
        .insert(zuvyMentorSlotAvailability)
        .values(
          generatedSlots as (typeof zuvyMentorSlotAvailability.$inferInsert)[],
        )
        .returning();

      for (let index = 0; index < createdSlots.length; index += 1) {
        const createdSlot = createdSlots[index];

        await this.zoomLicenseService.createLicenseAssignment(trx, {
          licenseId: licenseIds[index],
          instructorId: Number(mentorProfile.mentorUserId),
          mentorSlotAvailabilityId: createdSlot.id,
          sourceType: 'mentor_slot',
          startTime: new Date(createdSlot.slotStartDateTime),
          endTime: new Date(createdSlot.slotEndDateTime),
        });
      }
    });

    return { message: 'Recurring slots created successfully.' };
  }
}
