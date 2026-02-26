import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { db } from 'src/db';
import { eq } from 'drizzle-orm';
import type { InferInsertModel } from 'drizzle-orm';
import {
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
  zuvyMentorSlotManagement,
} from 'drizzle/schema';

@Injectable()
export class MentorSlotService {
  private readonly logger = new Logger(MentorSlotService.name);

  async createProfile(payload: any) {
    const insertObj = {
      mentorUserId: payload.mentorUserId,
      organizationId: payload.organizationId,
      mentorType: payload.mentorType ?? 'instructor',
      totalAvailableSlots: payload.totalAvailableSlots ?? 0,
      totalBookedSlots: payload.totalBookedSlots ?? 0,
      totalCancelledSlots: payload.totalCancelledSlots ?? 0,
      status: payload.status ?? 'active',
      expertise: payload.expertise ?? null,
      version: payload.version ?? null,
      title: payload.title ?? null,
      bio: payload.bio ?? null,
      isVerified: payload.isVerified ?? false,
      acceptsNewMentees: payload.acceptsNewMentees ?? true,
    } as unknown as InferInsertModel<typeof zuvyMentorSlotManagement>;

    const [result] = await db
      .insert(zuvyMentorSlotManagement)
      .values(insertObj)
      .returning();
    return result ?? null;
  }

  async getProfileById(id: number) {
    const [result] = await db
      .select()
      .from(zuvyMentorSlotManagement)
      .where((m) => eq(m.id, id))
      .limit(1);
    return result ?? null;
  }

  async createSlot(payload: any) {
    const [result] = await db
      .insert(zuvyMentorSlotAvailability)
      .values({
        mentorSlotManagementId: payload.mentorSlotManagementId,
        slotStartDateTime: payload.slotStartDateTime,
        slotEndDateTime: payload.slotEndDateTime,
        durationMinutes: payload.durationMinutes,
        maxCapacity: payload.maxCapacity ?? 1,
        currentBookedCount: 0,
        topic: payload.topic ?? null,
        description: payload.description ?? null,
        slotType: payload.slotType ?? 'one-on-one',
        meetingLink: payload.meetingLink ?? null,
        meetingType: payload.meetingType ?? 'video',
        location: payload.location ?? null,
        status: payload.status ?? 'available',
        isRecurring: payload.isRecurring ?? false,
        recurrencePattern: payload.recurrencePattern ?? null,
        isPublic: payload.isPublic ?? true,
      } as unknown as InferInsertModel<typeof zuvyMentorSlotAvailability>)
      .returning();
    return result ?? null;
  }

  async listSlots(query: { mentorUserId?: number; organizationId?: number }) {
    if (query.mentorUserId) {
      const result = await db
        .select()
        .from(zuvyMentorSlotAvailability)
        .innerJoin(
          zuvyMentorSlotManagement,
          eq(
            zuvyMentorSlotManagement.id,
            zuvyMentorSlotAvailability.mentorSlotManagementId,
          ),
        )
        .where(
          eq(zuvyMentorSlotManagement.mentorUserId, BigInt(query.mentorUserId)),
        )
        .orderBy(zuvyMentorSlotAvailability.slotStartDateTime);
      return result?.map((r) => r.zuvy_mentor_slot_availability) ?? [];
    }
    if (query.organizationId) {
      const result = await db
        .select()
        .from(zuvyMentorSlotAvailability)
        .innerJoin(
          zuvyMentorSlotManagement,
          eq(
            zuvyMentorSlotManagement.id,
            zuvyMentorSlotAvailability.mentorSlotManagementId,
          ),
        )
        .where(
          eq(zuvyMentorSlotManagement.organizationId, query.organizationId),
        )
        .orderBy(zuvyMentorSlotAvailability.slotStartDateTime);
      return result?.map((r) => r.zuvy_mentor_slot_availability) ?? [];
    }
    const result = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .orderBy(zuvyMentorSlotAvailability.slotStartDateTime);
    return result ?? [];
  }

  async bookSlot(payload: {
    slotAvailabilityId: number;
    studentUserId: bigint | number;
    mentorUserId?: bigint | number;
    organizationId?: number;
  }) {
    return await db.transaction(async (tx) => {
      // fetch slot
      const [slot] = await tx
        .select()
        .from(zuvyMentorSlotAvailability)
        .where(eq(zuvyMentorSlotAvailability.id, payload.slotAvailabilityId))
        .limit(1);
      if (!slot) throw new NotFoundException('Slot not found');

      if (slot.status === 'cancelled' || slot.status === 'archived') {
        throw new BadRequestException('Slot not available for booking');
      }

      if (slot.currentBookedCount >= slot.maxCapacity) {
        throw new BadRequestException('Slot capacity reached');
      }

      // fetch mentor slot management
      const [mentorSlot] = await tx
        .select()
        .from(zuvyMentorSlotManagement)
        .where(eq(zuvyMentorSlotManagement.id, slot.mentorSlotManagementId))
        .limit(1);

      // Insert booking
      const insertBooking = {
        slotAvailabilityId: payload.slotAvailabilityId,
        studentUserId: BigInt(payload.studentUserId),
        mentorUserId: payload.mentorUserId
          ? BigInt(payload.mentorUserId)
          : mentorSlot?.mentorUserId ?? null,
        organizationId:
          payload.organizationId ?? mentorSlot?.organizationId ?? null,
        status: 'pending',
      } as unknown as InferInsertModel<typeof zuvyMentorSlotBooking>;

      const [inserted] = await tx
        .insert(zuvyMentorSlotBooking)
        .values(insertBooking)
        .returning();

      // increment currentBookedCount
      await tx
        .update(zuvyMentorSlotAvailability)
        .set({ currentBookedCount: (slot.currentBookedCount ?? 0) + 1 } as any)
        .where(eq(zuvyMentorSlotAvailability.id, payload.slotAvailabilityId));

      // increment totalBookedSlots
      await tx
        .update(zuvyMentorSlotManagement)
        .set({
          totalBookedSlots: (mentorSlot?.totalBookedSlots ?? 0) + 1,
        } as any)
        .where(eq(zuvyMentorSlotManagement.id, slot.mentorSlotManagementId));

      return inserted ?? null;
    });
  }
}
