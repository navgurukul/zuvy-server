import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../../db';
import {
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
  zuvyMentorSlotManagement,
  zuvyMentorProfile,
  zuvyUserRolesAssigned,
  zuvyUserRoles,
  zuvyBatches,
  zuvyBatchEnrollments,
  zuvyBootcampType,
  zuvyBootcamps,
  zuvyMentorSessionRecordings,
  zuvyMentorSessionAttendance,
  zuvyOrganizations,
  users,
  zuvyStudentBookingMetrics,
  licenseAssignments,
} from '../../../drizzle/schema';

import {
  and,
  or,
  eq,
  lt,
  gt,
  sql,
  desc,
  count,
  ne,
  gte,
  lte,
  inArray,
  isNull,
  notExists,
} from 'drizzle-orm';
import { CreateSlotDto } from './dto/create-slot.dto';
import { withoutHostZoomFields } from './booking-response.util';
import { GoogleCalendarService } from 'src/integrations/google/google-calendar.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { ZoomService } from 'src/services/zoom/zoom.service';
import { NotificationEmailService } from 'src/notification/email/email.service';
import { ZoomLicenseService } from '../zoom-license/zoom-license.service';
import {
  MentorshipConfig,
  MentorshipConfigService,
} from './mentorship-rules/mentorship-config.service';
import { CreditService } from './mentorship-rules/credit.service';
import {
  CreditState,
  assertCreditsAllowBooking,
  assertSlotHasNotice,
  computeCreditState,
  creditData,
  earliestBookableStart,
  gapEndsAfter,
} from './mentorship-rules/mentorship-rules';

// A booking still without its join link this long after it was made is
// treated as abandoned between bookSlot's steps: the abandoned-booking job
// releases it, and it can't be rescheduled.
export const ABANDONED_BOOKING_MINUTES = 15;

@Injectable()
export class MentorSlotService {
  private readonly logger = new Logger(MentorSlotService.name);

  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly notificationService: NotificationService,
    private readonly zoomService: ZoomService,
    private readonly emailService: NotificationEmailService,
    private readonly zoomLicenseService: ZoomLicenseService,
    private readonly mentorshipConfig: MentorshipConfigService,
    private readonly creditService: CreditService,
  ) {}

  private mapMeetingLink(booking: any, userId: bigint) {
    if (booking.mentorUserId === userId) {
      return booking.zoomStartUrl;
    }
    return booking.meetingLink;
  }

  private async syncZoomLicenseState() {
    await this.zoomLicenseService.syncLicensedUsersFromZoom();
  }

  private async resolveInstructorOrganization(
    userId: number,
    preferredOrganizationId?: number,
  ) {
    const userIdBigInt = BigInt(userId);
    const roleAssignments = await db
      .select({
        organizationId: zuvyUserRolesAssigned.organizationId,
      })
      .from(zuvyUserRolesAssigned)
      .innerJoin(
        zuvyUserRoles,
        eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
      )
      .where(
        and(
          eq(zuvyUserRolesAssigned.userId, userIdBigInt),
          eq(zuvyUserRoles.name, 'instructor'),
        ),
      );

    const validOrganizationIds = roleAssignments
      .map((assignment) => assignment.organizationId)
      .filter((organizationId): organizationId is number => !!organizationId);

    if (!validOrganizationIds.length) {
      throw new BadRequestException(
        'User is not an instructor or organization not assigned.',
      );
    }

    if (preferredOrganizationId !== undefined) {
      if (!validOrganizationIds.includes(preferredOrganizationId)) {
        throw new ForbiddenException(
          'Instructor is not assigned to the selected organization.',
        );
      }

      return preferredOrganizationId;
    }

    return validOrganizationIds[0];
  }

  private async getOrCreateSharedMentorProfile(userId: number) {
    const userIdBigInt = BigInt(userId);
    const [userRow] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userIdBigInt))
      .limit(1);

    if (!userRow) {
      throw new NotFoundException('Mentor user not found');
    }

    let profile = await db.query.zuvyMentorProfile.findFirst({
      where: eq(zuvyMentorProfile.mentorUserId, userIdBigInt),
    });

    if (!profile) {
      const [createdProfile] = await db
        .insert(zuvyMentorProfile)
        .values({
          mentorUserId: userIdBigInt,
          email: userRow.email,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as typeof zuvyMentorProfile.$inferInsert)
        .returning();

      profile = createdProfile;
    } else if (profile.email !== userRow.email) {
      const [updatedProfile] = await db
        .update(zuvyMentorProfile)
        .set({
          email: userRow.email,
          updatedAt: new Date(),
        } as Partial<typeof zuvyMentorProfile.$inferInsert>)
        .where(eq(zuvyMentorProfile.id, profile.id))
        .returning();

      profile = updatedProfile;
    }

    return profile;
  }

  async getOrCreateMentorProfile(userId: number, organizationId?: number) {
    const userIdBigInt = BigInt(userId);
    await this.getOrCreateSharedMentorProfile(userId);
    const resolvedOrganizationId = await this.resolveInstructorOrganization(
      userId,
      organizationId,
    );

    /* ========================================
       2. CHECK IF MENTOR EXISTS
    ======================================== */

    let mentor = await db.query.zuvyMentorSlotManagement.findFirst({
      where: and(
        eq(zuvyMentorSlotManagement.mentorUserId, userIdBigInt),
        eq(zuvyMentorSlotManagement.organizationId, resolvedOrganizationId),
      ),
    });

    /* ========================================
       3. CREATE IF NOT EXISTS
    ======================================== */

    if (!mentor) {
      const [created] = await db
        .insert(zuvyMentorSlotManagement)
        .values({
          mentorUserId: userIdBigInt,
          organizationId: resolvedOrganizationId,
          mentorType: 'instructor',
          status: 'active',
          isVerified: false,
          acceptsNewMentees: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as typeof zuvyMentorSlotManagement.$inferInsert)
        .returning();

      mentor = created;
    }

    return mentor;
  }

  private async ensureUserIsMentor(userId: number) {
    if (!userId || Number.isNaN(userId)) {
      throw new ForbiddenException('Invalid user');
    }

    const userIdBigInt = BigInt(userId);

    const [role] = await db
      .select()
      .from(zuvyUserRolesAssigned)
      .innerJoin(
        zuvyUserRoles,
        eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
      )
      .where(
        and(
          eq(zuvyUserRolesAssigned.userId, userIdBigInt),
          eq(zuvyUserRoles.name, 'instructor'),
        ),
      )
      .limit(1);

    if (!role) {
      throw new ForbiddenException(
        'User has no role assigned. Cannot create mentor profile.',
      );
    }

    if (role.zuvy_user_roles.name !== 'instructor') {
      throw new ForbiddenException(
        'Only instructors can create mentor profiles.',
      );
    }

    return true;
  }

  private async ensureMentorOwnsBooking(
    userId: number,
    bookingId: number,
    organizationId?: number,
  ) {
    await this.ensureUserIsMentor(userId);

    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (booking.mentorUserId !== BigInt(userId)) {
      throw new ForbiddenException('You do not own this booking.');
    }

    if (
      organizationId !== undefined &&
      booking.organizationId !== organizationId
    ) {
      throw new ForbiddenException(
        'You do not own this booking in the selected organization.',
      );
    }

    return booking;
  }

  // Shared by markAttendance/completeSession: both need the booking row
  // either way (to check it isn't cancelled), but only need the ownership
  // check when a mentorUserId was actually supplied.
  private async loadBookingForOwnedAction(
    bookingId: number,
    mentorUserId?: number,
  ) {
    if (mentorUserId) {
      return this.ensureMentorOwnsBooking(mentorUserId, bookingId);
    }

    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    return booking;
  }

  private async ensureUserOwnsBooking(userId: number, bookingId: number) {
    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    const userIdBigInt = BigInt(userId);
    if (
      booking.mentorUserId !== userIdBigInt &&
      booking.studentUserId !== userIdBigInt
    ) {
      throw new ForbiddenException('You do not own this booking.');
    }

    return booking;
  }

  private async ensureMentorZoomAccountActive(
    userId: number,
    organizationId?: number,
  ) {
    const mentorProfile = await this.getOrCreateMentorProfile(
      userId,
      organizationId,
    );

    const [userRow] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, BigInt(userId)))
      .limit(1);

    if (!userRow?.email) {
      throw new NotFoundException('Mentor user not found');
    }

    const zoomResponse = await this.zoomService.getUser(userRow.email);

    if (!zoomResponse.success || zoomResponse.data?.status !== 'active') {
      await db
        .update(zuvyMentorSlotManagement)
        .set({
          isVerified: false,
          updatedAt: new Date(),
        } as Partial<typeof zuvyMentorSlotManagement.$inferInsert>)
        .where(eq(zuvyMentorSlotManagement.id, mentorProfile.id));

      throw new BadRequestException(
        'Mentor Zoom account is disconnected or inactive. Please reconnect Zoom before creating mentor slots.',
      );
    }

    await db
      .update(zuvyMentorSlotManagement)
      .set({
        isVerified: true,
        updatedAt: new Date(),
      } as Partial<typeof zuvyMentorSlotManagement.$inferInsert>)
      .where(eq(zuvyMentorSlotManagement.id, mentorProfile.id));

    return {
      email: userRow.email,
      zoomUser: zoomResponse.data,
    };
  }

  private async ensureMentorSlotLicenseAssignment(
    trx: any,
    slot: any,
    mentorProfile: any,
  ) {
    const [existingAssignment] = await trx
      .select({ id: licenseAssignments.id })
      .from(licenseAssignments)
      .where(
        and(
          eq(licenseAssignments.sourceType, 'mentor_slot'),
          eq(licenseAssignments.mentorSlotAvailabilityId, slot.id),
        ),
      )
      .limit(1);

    if (existingAssignment) {
      return;
    }

    const start = new Date(slot.slotStartDateTime);
    const end = new Date(slot.slotEndDateTime);

    const licenseId = await this.zoomLicenseService.assignLicense(trx, {
      instructorId: Number(mentorProfile.mentorUserId),
      startTime: start,
      endTime: end,
    });

    await this.zoomLicenseService.createLicenseAssignment(trx, {
      licenseId,
      instructorId: Number(mentorProfile.mentorUserId),
      mentorSlotAvailabilityId: slot.id,
      sourceType: 'mentor_slot',
      startTime: start,
      endTime: end,
    });
  }

  private async validateMentorProfileComplete(
    userId: number,
    organizationId?: number,
  ) {
    const mentorProfile = await this.getOrCreateMentorProfile(
      userId,
      organizationId,
    );
    const sharedProfile = await this.getOrCreateSharedMentorProfile(userId);

    const [profile] = await db
      .select({
        bio: zuvyMentorProfile.bio,
        expertise: zuvyMentorProfile.expertise,
        pastExperiences: zuvyMentorProfile.pastExperiences,
      })
      .from(zuvyMentorProfile)
      .innerJoin(
        zuvyMentorSlotManagement,
        eq(
          zuvyMentorSlotManagement.mentorUserId,
          zuvyMentorProfile.mentorUserId,
        ),
      )
      .where(
        and(
          eq(zuvyMentorProfile.id, sharedProfile.id),
          eq(zuvyMentorSlotManagement.id, mentorProfile.id),
        ),
      )
      .limit(1);

    if (!profile) {
      throw new NotFoundException('Mentor profile not found.');
    }

    if (!profile.bio || !profile.expertise || !profile.pastExperiences) {
      throw new ForbiddenException(
        'Complete your mentor profile (bio, expertise, past experiences) before creating slots.',
      );
    }

    if (Array.isArray(profile.expertise) && profile.expertise.length === 0) {
      throw new ForbiddenException('Add at least one skill in expertise.');
    }

    if (
      !profile.pastExperiences ||
      profile.pastExperiences.trim().length === 0
    ) {
      throw new ForbiddenException(
        'Add past experiences before creating slots.',
      );
    }

    return true;
  }

  private async ensureMentorHasMentorshipEnabledBootcamp(
    userId: number,
    organizationId?: number,
  ) {
    const resolvedOrganizationId = await this.resolveInstructorOrganization(
      userId,
      organizationId,
    );

    const eligibleBootcamps = await db
      .select({
        bootcampId: zuvyBatches.bootcampId,
      })
      .from(zuvyBatches)
      .innerJoin(zuvyBootcamps, eq(zuvyBatches.bootcampId, zuvyBootcamps.id))
      .innerJoin(
        zuvyBootcampType,
        eq(zuvyBootcampType.bootcampId, zuvyBootcamps.id),
      )
      .where(
        and(
          eq(zuvyBatches.instructorId, userId),
          eq(zuvyBootcamps.organizationId, resolvedOrganizationId),
          eq(zuvyBootcampType.mentorshipEnabled, true),
        ),
      )
      .limit(1);

    if (!eligibleBootcamps.length || !eligibleBootcamps[0].bootcampId) {
      throw new ForbiddenException(
        'You are not assigned to any mentorship-enabled bootcamp in this organization.',
      );
    }

    const mentorProfile = await this.getOrCreateMentorProfile(
      userId,
      resolvedOrganizationId,
    );

    if (!mentorProfile.bootcampId) {
      await db
        .update(zuvyMentorSlotManagement)
        .set({
          bootcampId: eligibleBootcamps[0].bootcampId,
          updatedAt: new Date(),
        } as Partial<typeof zuvyMentorSlotManagement.$inferInsert>)
        .where(eq(zuvyMentorSlotManagement.id, mentorProfile.id));
    }

    return eligibleBootcamps[0].bootcampId;
  }
  /* ========================================================================== 
        UTILITY - FEEDBACK DATE FILTER
  ========================================================================== */
  private getFeedbackDateFilter(filter: '30days' | '3months' | 'all') {
    const now = new Date();

    switch (filter) {
      case '30days':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      case '3months':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      default:
        return null;
    }
  }

  /**
   * A slot holds a Zoom licence only while someone is booked on it. Once its
   * last active booking is gone (cancel, or moved by a reschedule), the
   * licence goes back to the pool so classes and other slots can use it.
   * Run inside the caller's transaction, after the booking change.
   */
  private async releaseSlotLicenceIfUnbooked(trx: any, slotId: number) {
    const [{ count: activeBookings }] = await trx
      .select({ count: count() })
      .from(zuvyMentorSlotBooking)
      .where(
        and(
          eq(zuvyMentorSlotBooking.slotAvailabilityId, slotId),
          ne(zuvyMentorSlotBooking.status, 'cancelled'),
        ),
      );

    if (Number(activeBookings) === 0) {
      await this.zoomLicenseService.releaseMentorSlotAssignment(trx, slotId);
    }
  }

  // True once the slot's start time has passed. `executor` is db or the
  // caller's transaction.
  private async slotHasStarted(
    executor: any,
    slotId: number,
  ): Promise<boolean> {
    const [slot] = await executor
      .select({
        slotStartDateTime: zuvyMentorSlotAvailability.slotStartDateTime,
      })
      .from(zuvyMentorSlotAvailability)
      .where(eq(zuvyMentorSlotAvailability.id, slotId))
      .limit(1);
    return !!slot && new Date(slot.slotStartDateTime) <= new Date();
  }

  /**
   * Recounts a student's credits and gap from their bookings (CreditService)
   * and stores the result in zuvy_student_booking_metrics, which is only a
   * cache of it. Takes the student's credit lock first, so it waits for any
   * booking or cancel of the same student in progress. Run inside the
   * caller's transaction, after its booking change; returns the new state.
   */
  async recomputeStudentBookingMetrics(
    trx: any,
    studentUserId: bigint,
    config?: MentorshipConfig,
  ): Promise<CreditState> {
    const rules = config ?? (await this.mentorshipConfig.get());
    await this.creditService.lockStudent(
      trx,
      studentUserId,
      rules.creditsCountedFrom,
    );
    const usage = await this.creditService.loadUsage(trx, studentUserId, rules);
    const state = computeCreditState(usage, rules, new Date());

    const [lastBooking] = await trx
      .select({ confirmedAt: zuvyMentorSlotBooking.confirmedAt })
      .from(zuvyMentorSlotBooking)
      .where(
        and(
          eq(zuvyMentorSlotBooking.studentUserId, studentUserId),
          ne(zuvyMentorSlotBooking.status, 'cancelled'),
        ),
      )
      .orderBy(desc(zuvyMentorSlotBooking.confirmedAt))
      .limit(1);

    await trx
      .update(zuvyStudentBookingMetrics)
      .set({
        totalBookings: usage.creditsUsed,
        quotaUsed: state.creditsUsed,
        lastBookingDate: lastBooking?.confirmedAt ?? null,
        // When the gap ends (past or future); null with no session.
        cooldownEndDate: gapEndsAfter(usage.latestSessionStart, rules),
        // No yearly reset any more: the date credits are counted from.
        quotaResetDate: rules.creditsCountedFrom,
        isQuotaExhausted: state.creditsLeft === 0,
        updatedAt: new Date(),
      } as Partial<typeof zuvyStudentBookingMetrics.$inferInsert>)
      .where(eq(zuvyStudentBookingMetrics.userId, studentUserId));

    return state;
  }

  /**
   * The student's credits, the rules' numbers and the server's clock, for
   * the booking banner and drawer (GET /student/mentorship/eligibility).
   * Read only.
   */
  async getBookingEligibility(studentId: number) {
    const config = await this.mentorshipConfig.get();
    const now = new Date();
    const credits = await this.creditService.getState(
      BigInt(studentId),
      config,
      db,
      now,
    );
    return {
      credits: creditData(credits),
      rules: {
        totalCredits: config.totalCredits,
        gapDays: config.gapDays,
        noticeHours: config.noticeHours,
        joinOpenMinutes: config.joinOpenMinutes,
      },
      earliestBookableStart: earliestBookableStart(now, config),
      serverTime: now,
    };
  }

  /* ==========================================================================
     ENSURE MENTORSHIP IS ENABLED
  ========================================================================== */
  private async ensureMentorshipEnabled(studentUserId: bigint) {
    const enrollments = await db
      .select({
        mentorshipEnabled: zuvyBootcampType.mentorshipEnabled,
      })
      .from(zuvyBatchEnrollments)
      .innerJoin(
        zuvyBootcampType,
        eq(zuvyBatchEnrollments.bootcampId, zuvyBootcampType.bootcampId),
      )
      .where(
        and(
          eq(zuvyBatchEnrollments.userId, studentUserId),
          eq(zuvyBatchEnrollments.status, 'active'),
        ),
      );

    if (enrollments.length === 0) {
      throw new ForbiddenException(
        'You are not enrolled in a course with mentorship access.',
      );
    }

    const hasMentorship = enrollments.some((e) => e.mentorshipEnabled === true);

    if (!hasMentorship) {
      throw new ForbiddenException(
        'One-on-one mentorship is not available for your current programme.',
      );
    }
  }

  /* ==========================================================================
     DERIVE SESSION LIFECYCLE STATE
  ========================================================================== */

  private deriveLifecycleState(booking: any, slot: any): string {
    const now = new Date();
    const slotEnd = new Date(slot.slotEndDateTime);

    if (booking.status === 'cancelled') {
      throw new BadRequestException(
        'Cancelled bookings cannot be rescheduled.',
      );
    }

    if (booking.rescheduleStatus === 'pending') return 'RESCHEDULE_PENDING';

    if (booking.completedAt) return 'COMPLETED';

    if (booking.joinedAt && !booking.completedAt) return 'IN_PROGRESS';

    if (now.getTime() > slotEnd.getTime() && !booking.joinedAt) return 'MISSED';

    return 'SCHEDULED';
  }

  /* ==========================================================================
     BOOK SLOT (CONCURRENCY SAFE)
  ========================================================================== */

  async bookSlot(studentId: number, slotId: number) {
    await this.ensureMentorshipEnabled(BigInt(studentId));
    const config = await this.mentorshipConfig.get();
    // Fails fast, before any lock or licence work. Checked again below under
    // the student's credit lock, which is the check that counts.
    assertCreditsAllowBooking(
      await this.creditService.getState(BigInt(studentId), config),
      config,
    );
    await this.syncZoomLicenseState();

    /* ========================================
       STEP 1: RESERVE (short transaction)
       Slot seat, Zoom licence, booking row, credit. Commits before any Zoom
       call, so the licence-pool lock and the DB connection are not held
       while Zoom answers.
    ======================================== */

    const reserved = await db.transaction(async (trx) => {
      const [slot] = await trx
        .select()
        .from(zuvyMentorSlotAvailability)
        .where(eq(zuvyMentorSlotAvailability.id, slotId))
        .for('update');

      if (!slot) throw new NotFoundException('Slot not found.');

      if (!slot.slotStartDateTime || !slot.slotEndDateTime) {
        throw new BadRequestException('Slot time is missing.');
      }

      if (slot.status !== 'available')
        throw new BadRequestException('Slot not available.');

      if (slot.currentBookedCount >= slot.maxCapacity) {
        throw new BadRequestException('Slot is full.');
      }

      // An unbooked slot's status never auto-expires (it stays 'available'
      // forever once its start time passes, since nothing ever re-checks
      // it), so this explicit check is the only thing standing between a
      // student and booking a slot that's already in the past. See MDA-13.
      if (new Date(slot.slotStartDateTime) <= new Date()) {
        throw new BadRequestException('This slot has already passed.');
      }

      // Only slots starting at least notice_hours from now (exactly the
      // notice is allowed). The slots API hides the others.
      assertSlotHasNotice(new Date(slot.slotStartDateTime), new Date(), config);

      const [mentorProfile] = await trx
        .select()
        .from(zuvyMentorSlotManagement)
        .where(eq(zuvyMentorSlotManagement.id, slot.mentorSlotManagementId))
        .limit(1);

      if (!mentorProfile) {
        throw new NotFoundException('Mentor not found.');
      }

      /* Buffer check */
      if (mentorProfile?.isBufferEnabled && mentorProfile.bufferMinutes > 0) {
        const bufferMs = mentorProfile.bufferMinutes * 60 * 1000;

        const slotStart = new Date(slot.slotStartDateTime).getTime();
        const slotEnd = new Date(slot.slotEndDateTime).getTime();

        const bufferedStart = new Date(slotStart - bufferMs);
        const bufferedEnd = new Date(slotEnd + bufferMs);

        const conflictingBookings = await trx
          .select({
            id: zuvyMentorSlotBooking.id,
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
              eq(
                zuvyMentorSlotBooking.mentorUserId,
                mentorProfile.mentorUserId,
              ),
              eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
              lt(zuvyMentorSlotAvailability.slotStartDateTime, bufferedEnd),
              gt(zuvyMentorSlotAvailability.slotEndDateTime, bufferedStart),
            ),
          );

        if (conflictingBookings.length > 0) {
          throw new BadRequestException(
            `Buffer time violation. Mentor requires ${mentorProfile.bufferMinutes} minutes between sessions.`,
          );
        }
      }

      /* Duplicate booking check */
      const existingBooking = await trx
        .select()
        .from(zuvyMentorSlotBooking)
        .where(
          and(
            eq(zuvyMentorSlotBooking.studentUserId, BigInt(studentId)),
            eq(zuvyMentorSlotBooking.slotAvailabilityId, slotId),
            eq(zuvyMentorSlotBooking.status, 'confirmed'),
          ),
        )
        .limit(1);

      if (existingBooking.length > 0) {
        throw new BadRequestException('You already booked this slot.');
      }

      const [mentorUser] = await trx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, mentorProfile.mentorUserId))
        .limit(1);

      const [studentUser] = await trx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, BigInt(studentId)))
        .limit(1);

      if (!mentorUser?.email) {
        throw new BadRequestException('Mentor email not found.');
      }

      // The slot's Zoom licence is reserved now, at booking, not when the
      // slot was created. Slot creation already checked a licence was free,
      // but a class scheduled since then can have taken it.
      try {
        await this.ensureMentorSlotLicenseAssignment(trx, slot, mentorProfile);
      } catch (error: any) {
        if (this.isNoLicenceError(error)) {
          this.logger.warn(
            `Booking slot ${slotId} refused, no Zoom licence free: ${error.message}`,
          );
          throw new BadRequestException(
            "This slot can't be booked right now because no meeting licence is free at that time. Please pick another slot.",
          );
        }
        throw error;
      }

      /* Credits and gap, under the student's credit lock: a second booking
         sent at the same moment waits here, then sees this one. */
      await this.creditService.lockStudent(
        trx,
        BigInt(studentId),
        config.creditsCountedFrom,
      );
      assertCreditsAllowBooking(
        await this.creditService.getState(BigInt(studentId), config, trx),
        config,
      );

      /* Slot capacity */
      if (slot.currentBookedCount >= slot.maxCapacity)
        throw new BadRequestException('Slot is full.');

      const newCount = slot.currentBookedCount + 1;
      const newStatus = newCount >= slot.maxCapacity ? 'full' : 'available';

      await trx
        .update(zuvyMentorSlotAvailability)
        .set({
          currentBookedCount: newCount,
          status: newStatus,
        } as Partial<typeof zuvyMentorSlotAvailability.$inferInsert>)
        .where(eq(zuvyMentorSlotAvailability.id, slotId));

      /* Booking */
      const [createdBooking] = await trx
        .insert(zuvyMentorSlotBooking)
        .values({
          slotAvailabilityId: slotId,
          studentUserId: BigInt(studentId),
          mentorUserId: mentorProfile.mentorUserId,
          organizationId: mentorProfile.organizationId,
          status: 'confirmed',
          confirmedAt: new Date(),
          sessionLifecycleState: 'SCHEDULED',
        } as typeof zuvyMentorSlotBooking.$inferInsert)
        .returning();

      /* Student credit: the booking above now uses one; recount. */
      const credits = await this.recomputeStudentBookingMetrics(
        trx,
        BigInt(studentId),
        config,
      );

      return {
        createdBooking,
        slot,
        mentorProfile,
        mentorEmail: mentorUser.email as string,
        studentEmail: studentUser?.email as string | undefined,
        credits,
      };
    });

    const { createdBooking, slot, mentorProfile, mentorEmail, studentEmail } =
      reserved;
    const slotStartDateTime = new Date(slot.slotStartDateTime);
    const slotEndDateTime = new Date(slot.slotEndDateTime);

    /* ========================================
       STEP 2: ZOOM (no transaction, no lock)
       If this fails, step 1 is undone: booking removed, seat, licence and
       credit given back.
    ======================================== */

    let meeting: {
      joinUrl?: string;
      startUrl?: string;
      password?: string;
      meetingId?: string;
      uuid?: string;
    } = {};

    try {
      await this.zoomLicenseService.ensureHostLicensedForWindow(
        mentorEmail,
        slotStartDateTime,
        slotEndDateTime,
      );

      const zoomMeetingData = {
        topic: `Mentorship Session: ${mentorEmail} & ${studentEmail}`,
        type: 2, // Scheduled meeting
        start_time: slotStartDateTime.toISOString(),
        duration: slot.durationMinutes,
        timezone: 'UTC', // Adjust as needed
        password: Math.random().toString(36).substring(2, 8), // Generate random password
        agenda: 'One-on-one mentorship session',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          watermark: false,
          use_pmi: false,
          approval_type: 0,
          // Recognized by Zoom as "invited" for the host's waiting-room
          // policy (participants_to_place_in_waiting_room = 2), so the
          // student bypasses the waiting room instead of needing manual
          // admission.
          meeting_invitees: studentEmail ? [{ email: studentEmail }] : [],
          audio: 'both',
          auto_recording: 'cloud',
          waiting_room: true,
          // `mode: 'custom'` is required or Zoom ignores who_goes_to_waiting_room.
          // Lets the invited student (meeting_invitees below) bypass the
          // waiting room while everyone else waits.
          waiting_room_options: {
            mode: 'custom',
            who_goes_to_waiting_room: 'users_not_on_invite',
          },
          alternative_hosts: mentorEmail,
        },
      };

      const zoomResponse = await this.zoomService.createMeetingForUser(
        mentorEmail,
        zoomMeetingData,
      );

      if (!zoomResponse.success) {
        throw new Error(`Failed to create Zoom meeting: ${zoomResponse.error}`);
      }

      meeting = {
        joinUrl: zoomResponse.data.join_url,
        startUrl: zoomResponse.data.start_url,
        password: zoomResponse.data.password,
        meetingId: zoomResponse.data.id.toString(),
      };

      // A booking without a join link is useless to the student, and a saved
      // booking with no link is what the abandoned-booking job looks for, so
      // treat a missing link as a failed Zoom step.
      if (!meeting.joinUrl) {
        throw new Error('Zoom did not return a join link for the meeting');
      }

      // Record the meeting id on the booking at once (the booking is only
      // complete once step 3 saves the join link). If this request dies
      // before step 3, the abandoned-booking job finds the id here and
      // deletes the meeting along with the booking.
      await db
        .update(zuvyMentorSlotBooking)
        .set({ zoomMeetingId: meeting.meetingId } as Partial<
          typeof zuvyMentorSlotBooking.$inferInsert
        >)
        .where(
          and(
            eq(zuvyMentorSlotBooking.id, createdBooking.id),
            eq(zuvyMentorSlotBooking.status, 'confirmed'),
          ),
        );

      // Fetch UUID explicitly
      const meetingDetails = await this.zoomService.getMeeting(
        meeting.meetingId,
      );

      if (!meetingDetails.success || !meetingDetails.data?.uuid) {
        throw new Error('Failed to fetch Zoom meeting UUID');
      }

      meeting.uuid = meetingDetails.data.uuid;
    } catch (error: any) {
      this.logger.error(`Zoom meeting creation failed: ${error.message}`);
      await this.deleteZoomMeetingQuietly(meeting.meetingId, createdBooking.id);
      await this.undoReservedBooking(reserved);
      throw this.toBookingZoomError(error);
    }

    /* ========================================
       STEP 3: SAVE MEETING (short transaction)
    ======================================== */

    let saved: { cancelled: boolean };
    try {
      saved = await db.transaction(async (trx) => {
        // Same row lock cancelBooking takes: a cancel that landed while Zoom
        // was being called is seen here, not overwritten.
        const [current] = await trx
          .select({ status: zuvyMentorSlotBooking.status })
          .from(zuvyMentorSlotBooking)
          .where(eq(zuvyMentorSlotBooking.id, createdBooking.id))
          .for('update');

        if (!current || current.status === 'cancelled') {
          return { cancelled: true };
        }

        await trx
          .update(zuvyMentorSlotBooking)
          .set({
            meetingLink: meeting.joinUrl ?? null,
            isZoomMeet: true,
            zoomStartUrl: meeting.startUrl ?? null,
            zoomPassword: meeting.password ?? null,
            zoomMeetingId: meeting.meetingId ?? null,
            zoomMeetingUuid: meeting.uuid ?? null,
          } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
          .where(eq(zuvyMentorSlotBooking.id, createdBooking.id));

        await this.enqueueMentorRecordingJob(trx, {
          id: createdBooking.id,
          zoomMeetingId: meeting.meetingId ?? null,
          zoomMeetingUuid: meeting.uuid ?? null,
          isZoomMeet: true,
        });

        // Alerts only once the booking is complete, and in this transaction
        // so they roll back with it.
        await this.notificationService.createNotification(
          {
            userId: mentorProfile.mentorUserId,
            type: NotificationType.BOOKING_CREATED,
            title: 'New mentorship booking',
            message: ``,
            referenceId: createdBooking.id,
            referenceType: 'booking',
          },
          trx,
        );

        await this.notificationService.createNotification(
          {
            userId: BigInt(studentId),
            type: NotificationType.BOOKING_CONFIRMED,
            title: 'Session confirmed',
            message: ``,
            referenceId: createdBooking.id,
            referenceType: 'booking',
          },
          trx,
        );

        return { cancelled: false };
      });
    } catch (error: any) {
      this.logger.error(
        `Saving the Zoom meeting for booking ${createdBooking.id} failed: ${error.message}`,
      );
      // The error may have come after the COMMIT reached the database (the
      // acknowledgement was lost). Look before deleting anything.
      const outcome = await this.readStep3Outcome(
        createdBooking.id,
        meeting.meetingId,
      );
      if (outcome.state === 'saved') {
        // Step 3 did commit: the booking is complete.
        saved = { cancelled: false };
      } else if (outcome.state === 'not-saved') {
        await this.deleteZoomMeetingQuietly(
          meeting.meetingId,
          createdBooking.id,
        );
        await this.undoReservedBooking(reserved);
        throw new BadRequestException(
          'Unable to schedule session at the moment. Please try again later.',
        );
      } else {
        // Can't tell (the database is unreachable). Keep the meeting: if the
        // booking was saved it needs it; if not, the abandoned-booking job
        // undoes the booking later and deletes the meeting, whose id was
        // recorded on the booking right after Zoom created it.
        this.logger.error(
          `Booking ${createdBooking.id}: could not tell whether its Zoom meeting ${meeting.meetingId} was saved; left for the abandoned-booking job.`,
        );
        throw new BadRequestException(
          'Unable to schedule session at the moment. Please try again later.',
        );
      }
    }

    if (saved.cancelled) {
      // Cancelled while Zoom was being called: cancelBooking already gave the
      // seat, licence and credit back; only the new meeting is left over.
      await this.deleteZoomMeetingQuietly(meeting.meetingId, createdBooking.id);
      throw new BadRequestException(
        'This booking was cancelled while the session was being set up.',
      );
    }

    // This response goes to the student who booked, so it must not carry
    // the host start link (it used to, as `mentorJoinLink`).
    const { credits } = reserved;
    const bookingResponse = {
      ...withoutHostZoomFields(createdBooking),
      meetingLink: meeting.joinUrl,
      // Kept for existing screens; `credits` has the full picture.
      remainingCredits: credits.creditsLeft,
      nextEligible: credits.nextEligibleDate,
      credits: creditData(credits),
      serverTime: new Date(),
    };

    // Send notification email to team@zuvy after successful booking
    const slotDateOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    const slotTimeOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };
    const slotDate =
      new Date(slot.slotStartDateTime).toLocaleDateString(
        'en-IN',
        slotDateOptions,
      ) +
      ', ' +
      new Date(slot.slotStartDateTime).toLocaleTimeString(
        'en-IN',
        slotTimeOptions,
      ) +
      ' - ' +
      new Date(slot.slotEndDateTime).toLocaleTimeString(
        'en-IN',
        slotTimeOptions,
      );

    this.emailService
      .sendEmail(
        ['team@zuvy.org', 'join-zuvy@navgurukul.org'],
        '📅 New Mentorship Session Booked',
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 24px; border-radius: 8px;">
          <div style="background: #ffffff; padding: 16px 24px; border-radius: 6px 6px 0 0; border-bottom: 3px solid #4ade80;">
            <img src="https://dev.app.zuvy.org/_next/image?url=%2Fzuvy-logo-horizontal.png&w=256&q=75" alt="Zuvy" style="height: 40px; display: block;" />
          </div>
          <div style="background: #ffffff; padding: 28px 24px; border-radius: 0 0 6px 6px; border: 1px solid #e5e7eb;">
            <h3 style="color: #1a1a2e; margin: 0 0 6px;">New Session Booked</h3>
            <p style="color: #6B7280; margin: 0 0 24px; font-size: 14px;">A mentorship session has been confirmed. Here are the details:</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 12px 8px; color: #6B7280; font-size: 14px; width: 130px;">Student</td>
                <td style="padding: 12px 8px; color: #1a1a2e; font-weight: 600; font-size: 14px;">{{studentEmail}}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 12px 8px; color: #6B7280; font-size: 14px;">Mentor</td>
                <td style="padding: 12px 8px; color: #1a1a2e; font-weight: 600; font-size: 14px;">{{mentorEmail}}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 12px 8px; color: #6B7280; font-size: 14px;">Session Time</td>
                <td style="padding: 12px 8px; color: #1a1a2e; font-weight: 600; font-size: 14px;">{{slotDate}}</td>
              </tr>
              <tr>
                <td style="padding: 12px 8px; color: #6B7280; font-size: 14px;">Meeting Link</td>
                <td style="padding: 12px 8px;">
                  <a href="{{meetingLink}}" style="background: #4ade80; color: #1a1a2e; padding: 8px 18px; border-radius: 4px; text-decoration: none; font-size: 14px; font-weight: 700;">Join Zoom Meeting</a>
                </td>
              </tr>
            </table>
          </div>
          <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 16px;">© Zuvy by NavGurukul</p>
        </div>`,
        {
          studentEmail,
          mentorEmail,
          slotDate,
          meetingLink: meeting.joinUrl ?? 'N/A',
        },
      )
      .catch((err) => this.logger.error(`team email failed: ${err.message}`));

    return bookingResponse;
  }

  /**
   * After step 3 of bookSlot failed: did its transaction commit anyway? The
   * booking carries this meeting only if it did.
   */
  private async readStep3Outcome(
    bookingId: number,
    meetingId: string | undefined,
  ): Promise<{ state: 'saved' | 'not-saved' | 'unknown' }> {
    try {
      const [row] = await db
        .select({
          zoomMeetingId: zuvyMentorSlotBooking.zoomMeetingId,
          meetingLink: zuvyMentorSlotBooking.meetingLink,
        })
        .from(zuvyMentorSlotBooking)
        .where(eq(zuvyMentorSlotBooking.id, bookingId))
        .limit(1);
      if (
        row?.meetingLink &&
        row.zoomMeetingId &&
        row.zoomMeetingId === meetingId
      ) {
        return { state: 'saved' };
      }
      return { state: 'not-saved' };
    } catch {
      return { state: 'unknown' };
    }
  }

  private isNoLicenceError(error: any) {
    return (
      error instanceof BadRequestException &&
      /No Zoom licen|transferable Zoom/i.test(error.message || '')
    );
  }

  /** Same messages bookSlot gave before for a failed Zoom step. */
  private toBookingZoomError(error: any) {
    if (error instanceof BadRequestException) return error;
    const errMsg = error?.message || '';
    if (
      errMsg.includes('User does not exist') ||
      errMsg.includes('does not exist')
    ) {
      return new BadRequestException(
        'This mentor is not available for booking right now. Please try another mentor.',
      );
    }
    if (errMsg.includes('not licensed') || errMsg.includes('No permission')) {
      return new BadRequestException(
        'This mentor is not fully set up for sessions yet. Please choose another mentor.',
      );
    }
    return new BadRequestException(
      'Unable to schedule session at the moment. Please try again later.',
    );
  }

  private async deleteZoomMeetingQuietly(
    meetingId: string | undefined,
    bookingId: number,
  ) {
    if (!meetingId) return;
    try {
      await this.zoomService.deleteMeeting(meetingId);
    } catch (error: any) {
      this.logger.error(
        `Failed to delete Zoom meeting ${meetingId} for booking ${bookingId}: ${error.message}`,
      );
    }
  }

  /**
   * Undoes step 1 of bookSlot after the Zoom step failed (or never finished):
   * removes the booking and gives back the slot seat, the licence and the
   * credit. Does nothing if the booking was cancelled meanwhile
   * (cancelBooking already did this) or is complete by now (step 3 saved its
   * join link). Returns whether it undid the booking, and the Zoom meeting
   * id recorded on it, if any, for the caller to delete.
   */
  private async undoReservedBooking(reserved: {
    createdBooking: any;
  }): Promise<{ undone: boolean; zoomMeetingId: string | null }> {
    const notUndone = { undone: false, zoomMeetingId: null };
    const bookingId = reserved.createdBooking.id as number;
    const studentUserId = BigInt(reserved.createdBooking.studentUserId);
    try {
      return await db.transaction(async (trx) => {
        const [booking] = await trx
          .select({
            status: zuvyMentorSlotBooking.status,
            slotAvailabilityId: zuvyMentorSlotBooking.slotAvailabilityId,
            zoomMeetingId: zuvyMentorSlotBooking.zoomMeetingId,
            meetingLink: zuvyMentorSlotBooking.meetingLink,
          })
          .from(zuvyMentorSlotBooking)
          .where(eq(zuvyMentorSlotBooking.id, bookingId))
          .for('update');

        if (!booking || booking.status === 'cancelled') return notUndone;
        if (booking.meetingLink) return notUndone;
        const slotId = booking.slotAvailabilityId;

        await trx
          .delete(zuvyMentorSlotBooking)
          .where(eq(zuvyMentorSlotBooking.id, bookingId));

        await trx
          .update(zuvyMentorSlotAvailability)
          .set({
            currentBookedCount: sql`GREATEST(${zuvyMentorSlotAvailability.currentBookedCount} - 1, 0)`,
            status: sql`CASE WHEN ${zuvyMentorSlotAvailability.status} = 'full' THEN 'available' ELSE ${zuvyMentorSlotAvailability.status} END`,
          } as Partial<typeof zuvyMentorSlotAvailability.$inferInsert>)
          .where(eq(zuvyMentorSlotAvailability.id, slotId));

        await this.releaseSlotLicenceIfUnbooked(trx, slotId);

        // The credit comes back by itself: the booking is gone, so the
        // recount no longer counts it. If the recount fails, the whole undo
        // fails and the booking stays, so the abandoned-booking job retries
        // it (removing it without giving the credit back would leave the
        // student charged for nothing).
        await this.recomputeStudentBookingMetrics(trx, studentUserId);
        return {
          undone: true,
          zoomMeetingId: booking.zoomMeetingId ?? null,
        };
      });
    } catch (error: any) {
      this.logger.error(
        `Could not undo booking ${bookingId} after its Zoom step failed. Left for the abandoned-booking job (releaseAbandonedBookings) to retry: ${error.message}`,
      );
      return notUndone;
    }
  }

  /**
   * Bookings stuck between step 1 and step 3 of bookSlot: confirmed, but with
   * no join link long after they were made (the app restarted while Zoom was
   * being called, or the undo itself failed). Each is undone exactly like a
   * failed Zoom step: booking removed, seat, licence and credit given back.
   * Run by MentorSlotJob. Safe to run on several servers at once: each undo
   * re-checks the booking under a row lock.
   */
  async releaseAbandonedBookings(
    olderThanMinutes = ABANDONED_BOOKING_MINUTES,
  ): Promise<number> {
    const now = Date.now();
    const stuck = await db
      .select({
        id: zuvyMentorSlotBooking.id,
        slotAvailabilityId: zuvyMentorSlotBooking.slotAvailabilityId,
        studentUserId: zuvyMentorSlotBooking.studentUserId,
      })
      .from(zuvyMentorSlotBooking)
      .where(
        and(
          eq(zuvyMentorSlotBooking.status, 'confirmed'),
          isNull(zuvyMentorSlotBooking.meetingLink),
          isNull(zuvyMentorSlotBooking.googleEventId),
          lt(
            zuvyMentorSlotBooking.bookedAt,
            new Date(now - olderThanMinutes * 60_000),
          ),
          // Bounded look-back. Bookings made before this change can't
          // match: that code saved the booking and its meeting in one
          // transaction, so a saved booking always had its join link.
          gt(
            zuvyMentorSlotBooking.bookedAt,
            new Date(now - 7 * 24 * 60 * 60_000),
          ),
        ),
      )
      .limit(100);

    let released = 0;
    for (const booking of stuck) {
      const { undone, zoomMeetingId } = await this.undoReservedBooking({
        createdBooking: booking,
      });
      if (undone) {
        released += 1;
        await this.deleteZoomMeetingQuietly(
          zoomMeetingId ?? undefined,
          booking.id,
        );
        this.logger.warn(
          `Released abandoned booking ${booking.id} (no Zoom meeting ${olderThanMinutes}+ minutes after booking).`,
        );
      }
    }
    return released;
  }

  /* ==========================================================================
     CANCEL SESSION (PRD — MANDATORY REASON)
  ========================================================================== */

  async cancelBooking(
    bookingId: number,
    reason: string,
    cancelledBy: 'mentor' | 'student',
    actorUserId?: number,
  ) {
    await this.syncZoomLicenseState();

    if (!reason || reason.length < 10) {
      throw new BadRequestException(
        'Cancellation reason must be at least 10 characters.',
      );
    }

    if (actorUserId) {
      const booking = await this.ensureUserOwnsBooking(actorUserId, bookingId);
      const actorUserIdBigInt = BigInt(actorUserId);

      if (
        (cancelledBy === 'mentor' &&
          booking.mentorUserId !== actorUserIdBigInt) ||
        (cancelledBy === 'student' &&
          booking.studentUserId !== actorUserIdBigInt)
      ) {
        throw new ForbiddenException(
          `Only the ${cancelledBy} can cancel as ${cancelledBy}.`,
        );
      }
    }

    // Captured inside the transaction so the external Zoom/Google calls can
    // run strictly AFTER the DB transaction has durably committed — doing
    // these before commit meant a later failure inside the same transaction
    // (e.g. the quota/metrics upsert below) rolled the booking back to
    // 'scheduled' while the Zoom meeting stayed deleted, an unrecoverable
    // DB/Zoom split-brain.
    let externalCleanup: {
      googleEventId: string | null;
      googleRefreshToken: string | null;
      isZoomMeet: boolean;
      zoomMeetingId: string | null;
    } | null = null;

    const result = await db.transaction(async (trx) => {
      // FOR UPDATE serializes this against a concurrent cancelBooking or
      // acceptReschedule on the same booking (acceptReschedule takes the same
      // lock). Without it, two cancels could both read 'confirmed' and both
      // release slot capacity, or a cancel could release the pre-reschedule
      // slot after acceptReschedule had already moved the booking.
      const [booking] = await trx
        .select()
        .from(zuvyMentorSlotBooking)
        .where(eq(zuvyMentorSlotBooking.id, bookingId))
        .for('update');

      if (!booking) {
        throw new NotFoundException('Booking not found.');
      }

      /* Prevent double cancellation */

      if (booking.status === 'cancelled') {
        throw new BadRequestException('Booking already cancelled.');
      }

      // A live or finished session must never be cancelled: cancelBooking
      // deletes the Zoom meeting and refunds the student's credit, so doing
      // this on a session that has started would kick people out of a live
      // call, delete a meeting whose recording may still be processing, and
      // refund a credit for a session that already happened. The lifecycle
      // state alone isn't enough — the cron only advances it once a minute,
      // and never advances RESCHEDULE_PENDING — so the slot's own start time
      // is checked too.
      if (
        booking.sessionLifecycleState === 'IN_PROGRESS' ||
        booking.sessionLifecycleState === 'COMPLETED' ||
        booking.sessionLifecycleState === 'MISSED'
      ) {
        throw new BadRequestException(
          'This session has already started or finished and can no longer be cancelled.',
        );
      }

      if (await this.slotHasStarted(trx, booking.slotAvailabilityId)) {
        throw new BadRequestException(
          'This session has already started or finished and can no longer be cancelled.',
        );
      }

      /* Release slot capacity */
      await trx
        .update(zuvyMentorSlotAvailability)
        .set({
          currentBookedCount: sql`GREATEST(${zuvyMentorSlotAvailability.currentBookedCount} - 1, 0)`,
          status: 'available',
        } as Partial<typeof zuvyMentorSlotAvailability.$inferInsert>)
        .where(eq(zuvyMentorSlotAvailability.id, booking.slotAvailabilityId));

      /* Cancel booking */

      // A cancelled booking must never be revivable, so any pending
      // reschedule is cleared here too — otherwise a later
      // acceptReschedule/declineReschedule call (or the reschedule-expiry
      // job, once built) could flip sessionLifecycleState back to
      // 'SCHEDULED' on a booking the student/mentor already cancelled.
      const cancelled = await trx
        .update(zuvyMentorSlotBooking)
        .set({
          status: 'cancelled',
          sessionLifecycleState: 'CANCELLED',
          cancellationReason: reason,
          cancelledBy,
          cancelledAt: new Date(),
          rescheduleStatus: null,
          rescheduleRequestedAt: null,
          rescheduleProposedSlotId: null,
        } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
        .where(
          and(
            eq(zuvyMentorSlotBooking.id, bookingId),
            ne(zuvyMentorSlotBooking.status, 'cancelled'),
          ),
        )
        .returning({ id: zuvyMentorSlotBooking.id });

      if (cancelled.length === 0) {
        throw new BadRequestException('Booking already cancelled.');
      }

      await this.releaseSlotLicenceIfUnbooked(trx, booking.slotAvailabilityId);

      await this.notificationService.createNotification(
        {
          userId: booking.studentUserId,
          type: NotificationType.BOOKING_CANCELLED,
          title: 'Session cancelled',
          message: ``,
          referenceId: bookingId,
          referenceType: 'booking',
        },
        trx,
      );

      await this.notificationService.createNotification(
        {
          userId: booking.mentorUserId,
          type: NotificationType.BOOKING_CANCELLED,
          title: 'Session cancelled',
          message: ``,
          referenceId: bookingId,
          referenceType: 'booking',
        },
        trx,
      );

      const [mentorProfile] = await trx
        .select()
        .from(zuvyMentorSlotManagement)
        .where(eq(zuvyMentorSlotManagement.mentorUserId, booking.mentorUserId))
        .limit(1);

      externalCleanup = {
        googleEventId: booking.googleEventId,
        googleRefreshToken: mentorProfile?.googleRefreshToken ?? null,
        isZoomMeet: booking.isZoomMeet,
        zoomMeetingId: booking.zoomMeetingId,
      };

      await this.recomputeStudentBookingMetrics(trx, booking.studentUserId);

      return {
        message: 'Booking cancelled successfully.',
      };
    });

    // Best-effort, run only after the cancellation has durably committed:
    // the booking itself must stay cancelled even if Zoom/Google's API is
    // down right now, and the DB can never again roll back underneath an
    // already-applied Zoom/Google change.
    if (externalCleanup) {
      const { googleEventId, googleRefreshToken, isZoomMeet, zoomMeetingId } =
        externalCleanup;

      if (googleEventId && googleRefreshToken) {
        try {
          await this.googleCalendarService.deleteMeeting(
            googleEventId,
            googleRefreshToken,
          );
        } catch (error: any) {
          this.logger.error(
            `Failed to delete Google Calendar event ${googleEventId} for cancelled booking ${bookingId}: ${error.message}`,
          );
        }
      }

      if (isZoomMeet && zoomMeetingId) {
        try {
          await this.zoomService.deleteMeeting(zoomMeetingId);
        } catch (error: any) {
          this.logger.error(
            `Failed to delete Zoom meeting ${zoomMeetingId} for cancelled booking ${bookingId}: ${error.message}`,
          );
        }
      }
    }

    return result;
  }

  /* ==========================================================================
     RESCHEDULE WORKFLOW (PROPOSE)
  ========================================================================== */

  async proposeReschedule(
    bookingId: number,
    newSlotId: number,
    reason: string,
    studentUserId?: number,
  ) {
    await this.syncZoomLicenseState();

    if (!reason || reason.length < 10) {
      throw new BadRequestException(
        'Reschedule reason must be at least 10 characters.',
      );
    }

    /* ================================
       FETCH BOOKING
    ================================= */

    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (studentUserId && booking.studentUserId !== BigInt(studentUserId)) {
      throw new ForbiddenException('You do not own this booking.');
    }

    if (booking.status === 'cancelled') {
      throw new BadRequestException('Cancelled booking cannot be rescheduled.');
    }

    if (booking.rescheduleStatus === 'pending') {
      throw new BadRequestException('Reschedule already requested.');
    }

    if (booking.slotAvailabilityId === newSlotId) {
      throw new BadRequestException('Cannot reschedule to the same slot.');
    }

    // No join link yet: still between booking steps, or abandoned there (the
    // abandoned-booking job releases it after ABANDONED_BOOKING_MINUTES).
    // Moving it would leave the meeting at the old time, or move a booking
    // that has no meeting.
    if (booking.isZoomMeet && !booking.meetingLink && !booking.googleEventId) {
      // No booking time recorded: it can't be a booking in progress.
      const stillSettingUp =
        !!booking.bookedAt &&
        Date.now() - new Date(booking.bookedAt).getTime() <
          ABANDONED_BOOKING_MINUTES * 60_000;
      throw new BadRequestException(
        stillSettingUp
          ? 'This session is still being set up. Please try again in a minute.'
          : "This session's meeting was never set up, so it can't be rescheduled. Please cancel it and book again.",
      );
    }

    // Only a session that hasn't happened yet can be rescheduled. Without
    // this, a COMPLETED/MISSED/IN_PROGRESS booking could be moved into
    // RESCHEDULE_PENDING — which slips past cancelBooking's lifecycle guard
    // (refunding the credit and deleting the Zoom meeting) or lets an
    // accepted reschedule turn a finished session into a fresh one. The
    // slot time is checked as well because the cron only advances the
    // lifecycle state once a minute.
    if (booking.sessionLifecycleState !== 'SCHEDULED') {
      throw new BadRequestException(
        'Only an upcoming session can be rescheduled.',
      );
    }

    if (await this.slotHasStarted(db, booking.slotAvailabilityId)) {
      throw new BadRequestException(
        'This session has already started or finished and can no longer be rescheduled.',
      );
    }

    /* ================================
       FETCH SLOT
    ================================= */

    const [slot] = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(eq(zuvyMentorSlotAvailability.id, newSlotId))
      .limit(1);

    if (!slot) {
      throw new BadRequestException('Proposed slot not found.');
    }

    /* ================================
    SLOT VALIDATIONS
    ================================= */

    if (slot.status !== 'available') {
      throw new BadRequestException('Proposed slot is not available.');
    }

    if (slot.currentBookedCount >= slot.maxCapacity) {
      throw new BadRequestException('Proposed slot is full.');
    }

    // 12-hour reschedule notice is temporarily disabled for short-notice sessions.
    // this.enforceMinimumNotice(new Date(slot.slotStartDateTime));

    if (new Date(slot.slotStartDateTime) <= new Date()) {
      throw new BadRequestException('Cannot reschedule to past slot.');
    }

    /* ================================
       ENSURE SAME MENTOR
    ================================= */

    const [mentorProfile] = await db
      .select()
      .from(zuvyMentorSlotManagement)
      .where(
        and(
          eq(zuvyMentorSlotManagement.mentorUserId, booking.mentorUserId),
          eq(zuvyMentorSlotManagement.organizationId, booking.organizationId),
        ),
      )
      .limit(1);

    if (!mentorProfile || slot.mentorSlotManagementId !== mentorProfile.id) {
      throw new BadRequestException(
        'Cannot reschedule to a slot belonging to another mentor.',
      );
    }

    if (booking.organizationId !== mentorProfile.organizationId) {
      throw new BadRequestException(
        'Cannot reschedule outside the original booking organization.',
      );
    }

    /* ================================
       UPDATE BOOKING
    ================================= */

    // The eligibility checks above (status/rescheduleStatus) only prove
    // this booking was eligible AT THAT READ — a concurrent cancelBooking
    // landing after that read and before this write would otherwise still
    // get silently overwritten into RESCHEDULE_PENDING on an already
    // cancelled booking. Re-checking both conditions in this UPDATE's own
    // WHERE clause makes the write itself atomic against that race, the
    // same discipline applied to acceptReschedule.
    const proposed = await db
      .update(zuvyMentorSlotBooking)
      .set({
        rescheduleStatus: 'pending',
        rescheduleRequestedAt: new Date(),
        rescheduleProposedSlotId: newSlotId,
        sessionLifecycleState: 'RESCHEDULE_PENDING',
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(
        and(
          eq(zuvyMentorSlotBooking.id, bookingId),
          ne(zuvyMentorSlotBooking.status, 'cancelled'),
          eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
          // rescheduleStatus is NULL on every normal booking that's never
          // had a reschedule proposed — `ne(col, 'pending')` evaluates to
          // SQL NULL (not true) when col IS NULL, which would wrongly
          // exclude every such row. isNull(...) covers that case explicitly.
          or(
            isNull(zuvyMentorSlotBooking.rescheduleStatus),
            ne(zuvyMentorSlotBooking.rescheduleStatus, 'pending'),
          ),
        ),
      )
      .returning({ id: zuvyMentorSlotBooking.id });

    if (proposed.length === 0) {
      throw new BadRequestException(
        'This booking is no longer eligible for reschedule — it may have just been cancelled or already has a pending request.',
      );
    }

    /* ================================
       SEND NOTIFICATION
    ================================= */

    await this.notificationService.createNotification({
      userId: booking.mentorUserId,
      type: NotificationType.RESCHEDULE_REQUEST,
      title: 'Reschedule request',
      message: '',
      referenceId: bookingId,
      referenceType: 'booking',
    });

    return {
      message: 'Reschedule request submitted successfully.',
    };
  }

  async getRescheduleSlotsForBooking(studentUserId: number, bookingId: number) {
    await this.syncZoomLicenseState();

    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (booking.studentUserId !== BigInt(studentUserId)) {
      throw new ForbiddenException('You do not own this booking.');
    }

    if (booking.status === 'cancelled') {
      throw new BadRequestException('Cancelled booking cannot be rescheduled.');
    }

    const [mentorProfile] = await db
      .select({
        id: zuvyMentorSlotManagement.id,
        organizationId: zuvyMentorSlotManagement.organizationId,
      })
      .from(zuvyMentorSlotManagement)
      .where(
        and(
          eq(zuvyMentorSlotManagement.mentorUserId, booking.mentorUserId),
          eq(zuvyMentorSlotManagement.organizationId, booking.organizationId),
        ),
      )
      .limit(1);

    if (!mentorProfile) {
      throw new NotFoundException(
        'Mentor profile not found for the booking organization.',
      );
    }

    const slots = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(
        and(
          eq(
            zuvyMentorSlotAvailability.mentorSlotManagementId,
            mentorProfile.id,
          ),
          eq(zuvyMentorSlotAvailability.status, 'available'),
          eq(zuvyMentorSlotAvailability.isPublic, true),
          // Only slots at least notice_hours away (server clock).
          gte(
            zuvyMentorSlotAvailability.slotStartDateTime,
            earliestBookableStart(
              new Date(),
              await this.mentorshipConfig.get(),
            ),
          ),
          sql`${zuvyMentorSlotAvailability.currentBookedCount} < ${zuvyMentorSlotAvailability.maxCapacity}`,
          ne(zuvyMentorSlotAvailability.id, booking.slotAvailabilityId),
        ),
      );

    return slots.map((slot) => ({
      ...slot,
      organizationId: mentorProfile.organizationId,
    }));
  }

  /* ==========================================================================
     MENTOR RECEIVED FEEDBACKS
  ========================================================================== */

  async getMentorReceivedFeedbacks(
    mentorUserId: number,
    filter: '30days' | '3months' | 'all' = 'all',
    organizationId?: number,
  ) {
    await this.ensureUserIsMentor(mentorUserId);

    const conditions = [
      eq(zuvyMentorSlotBooking.mentorUserId, BigInt(mentorUserId)),
      sql`${zuvyMentorSlotBooking.studentFeedback} IS NOT NULL`,
    ];

    const since = this.getFeedbackDateFilter(filter);

    if (since) {
      conditions.push(
        gte(zuvyMentorSlotBooking.studentFeedbackSubmittedAt, since),
      );
    }

    const feedbacks = await db
      .select({
        bookingId: zuvyMentorSlotBooking.id,

        studentUserId: zuvyMentorSlotBooking.studentUserId,

        studentFeedback: zuvyMentorSlotBooking.studentFeedback,

        studentRating: zuvyMentorSlotBooking.studentRating,

        submittedAt: zuvyMentorSlotBooking.studentFeedbackSubmittedAt,

        sessionStatus: zuvyMentorSlotBooking.status,

        sessionLifecycle: zuvyMentorSlotBooking.sessionLifecycleState,

        slotStart: zuvyMentorSlotAvailability.slotStartDateTime,

        slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,

        topic: zuvyMentorSlotAvailability.topic,

        durationMinutes: zuvyMentorSlotAvailability.durationMinutes,

        studentName: users.name,
        studentEmail: users.email,
      })
      .from(zuvyMentorSlotBooking)
      .leftJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotAvailability.id,
          zuvyMentorSlotBooking.slotAvailabilityId,
        ),
      )
      .leftJoin(users, eq(users.id, zuvyMentorSlotBooking.studentUserId))
      .where(and(...conditions))
      .orderBy(desc(zuvyMentorSlotBooking.studentFeedbackSubmittedAt));

    return {
      total: feedbacks.length,

      averageRating:
        feedbacks.length > 0
          ? Number(
              (
                feedbacks.reduce(
                  (sum, item) => sum + (item.studentRating ?? 0),
                  0,
                ) / feedbacks.length
              ).toFixed(2),
            )
          : 0,

      data: feedbacks,
    };
  }

  /* ==========================================================================
     STUDENT RECEIVED FEEDBACKS
    ========================================================================== */
  async getStudentReceivedFeedbacks(
    studentUserId: number,
    filter: '30days' | '3months' | 'all' = 'all',
  ) {
    const conditions = [
      eq(zuvyMentorSlotBooking.studentUserId, BigInt(studentUserId)),
      sql`${zuvyMentorSlotBooking.mentorFeedback} IS NOT NULL`,
    ];

    const since = this.getFeedbackDateFilter(filter);

    if (since) {
      conditions.push(
        gte(zuvyMentorSlotBooking.mentorFeedbackSubmittedAt, since),
      );
    }

    const feedbacks = await db
      .select({
        bookingId: zuvyMentorSlotBooking.id,

        mentorUserId: zuvyMentorSlotBooking.mentorUserId,

        mentorFeedback: zuvyMentorSlotBooking.mentorFeedback,

        mentorRating: zuvyMentorSlotBooking.mentorRating,

        submittedAt: zuvyMentorSlotBooking.mentorFeedbackSubmittedAt,

        sessionStatus: zuvyMentorSlotBooking.status,

        sessionLifecycle: zuvyMentorSlotBooking.sessionLifecycleState,

        slotStart: zuvyMentorSlotAvailability.slotStartDateTime,

        slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,

        topic: zuvyMentorSlotAvailability.topic,

        durationMinutes: zuvyMentorSlotAvailability.durationMinutes,

        mentorName: users.name,
        mentorEmail: users.email,
      })
      .from(zuvyMentorSlotBooking)
      .leftJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotAvailability.id,
          zuvyMentorSlotBooking.slotAvailabilityId,
        ),
      )
      .leftJoin(users, eq(users.id, zuvyMentorSlotBooking.mentorUserId))
      .where(and(...conditions))
      .orderBy(desc(zuvyMentorSlotBooking.mentorFeedbackSubmittedAt));

    return {
      total: feedbacks.length,

      averageRating:
        feedbacks.length > 0
          ? Number(
              (
                feedbacks.reduce(
                  (sum, item) => sum + (item.mentorRating ?? 0),
                  0,
                ) / feedbacks.length
              ).toFixed(2),
            )
          : 0,

      data: feedbacks,
    };
  }

  /* ==========================================================================
     SUBMIT MENTOR FEEDBACK (PRD COMPLIANT)
  ========================================================================== */

  async submitMentorFeedback(
    bookingId: number,
    feedback: any,
    rating?: number,
    mentorUserId?: number,
  ) {
    if (mentorUserId) {
      await this.ensureMentorOwnsBooking(mentorUserId, bookingId);
    }

    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) throw new NotFoundException('Booking not found.');

    if (booking.mentorFeedbackLocked)
      throw new ForbiddenException('Feedback is locked after 24 hours.');

    return db
      .update(zuvyMentorSlotBooking)
      .set({
        mentorFeedback: feedback,
        mentorRating: rating,
        mentorFeedbackSubmittedAt: new Date(),
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(eq(zuvyMentorSlotBooking.id, bookingId));
  }

  /* ==========================================================================
     STUDENT FEEDBACK (PRD COMPLIANT)
  ========================================================================== */

  async submitStudentFeedback(
    bookingId: number,
    feedback: any,
    rating?: number,
    studentUserId?: number,
  ) {
    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (studentUserId && booking.studentUserId !== BigInt(studentUserId)) {
      throw new ForbiddenException('You do not own this booking.');
    }

    if (booking.studentFeedback) {
      throw new ForbiddenException('Feedback is locked after 24 hours.');
    }

    await db
      .update(zuvyMentorSlotBooking)
      .set({
        studentFeedback: feedback,
        studentRating: rating,
        studentFeedbackSubmittedAt: new Date(),
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(eq(zuvyMentorSlotBooking.id, bookingId));

    await this.notificationService.createNotification({
      userId: booking.mentorUserId,
      type: NotificationType.FEEDBACK_SUBMITTED,
      title: '',
      message: '',
      referenceId: bookingId,
      referenceType: 'booking',
    });

    return {
      message: 'Student feedback submitted successfully.',
    };
  }

  /* ==========================================================================
     DELETE EMPTY UPCOMING SLOT
  ========================================================================== */

  async removeSlot(userId: number, slotId: number, organizationId?: number) {
    await this.syncZoomLicenseState();
    await this.ensureUserIsMentor(userId);

    const mentorProfile = await this.getOrCreateMentorProfile(
      userId,
      organizationId,
    );

    const [slot] = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(eq(zuvyMentorSlotAvailability.id, slotId))
      .limit(1);

    if (!slot) {
      throw new NotFoundException('Slot not found.');
    }

    if (slot.mentorSlotManagementId !== mentorProfile.id) {
      throw new ForbiddenException('You do not own this slot.');
    }

    if (new Date(slot.slotStartDateTime) <= new Date()) {
      throw new BadRequestException('Only upcoming slots can be deleted.');
    }

    if (slot.currentBookedCount > 0) {
      throw new BadRequestException('Booked slots cannot be deleted.');
    }

    const [{ count: bookingCount }] = await db
      .select({ count: count() })
      .from(zuvyMentorSlotBooking)
      .where(
        and(
          eq(zuvyMentorSlotBooking.slotAvailabilityId, slotId),
          ne(zuvyMentorSlotBooking.status, 'cancelled'),
        ),
      );

    if (Number(bookingCount) > 0) {
      throw new BadRequestException('Booked slots cannot be deleted.');
    }

    // 12-hour deletion notice is temporarily disabled for short-notice slots.
    // this.enforceMinimumNotice(slot.slotStartDateTime);

    const result = await db.transaction(async (trx) => {
      await this.zoomLicenseService.releaseMentorSlotAssignment(trx, slotId);

      return trx
        .delete(zuvyMentorSlotAvailability)
        .where(eq(zuvyMentorSlotAvailability.id, slotId))
        .returning();
    });

    if (!result.length) {
      throw new NotFoundException('Slot not found or already deleted');
    }

    return {
      message: 'Slot deleted successfully',
    };
  }

  async acceptReschedule(
    bookingId: number,
    mentorUserId?: number,
    organizationId?: number,
  ) {
    await this.syncZoomLicenseState();

    if (mentorUserId) {
      await this.ensureMentorOwnsBooking(
        mentorUserId,
        bookingId,
        organizationId,
      );
    }

    // Captured inside the transaction so the external Zoom/Google calls run
    // strictly AFTER the DB transaction has durably committed — see the
    // identical note in cancelBooking.
    let externalUpdate: {
      isZoomMeet: boolean;
      zoomMeetingId: string | null;
      googleEventId: string | null;
      googleRefreshToken: string | null;
      proposedSlotStart: Date;
      proposedSlotEnd: Date;
      proposedDurationMinutes: number;
    } | null = null;

    const result = await db.transaction(async (trx) => {
      // Same row lock cancelBooking takes, so a concurrent accept and cancel
      // on one booking run one after the other instead of interleaving.
      const [booking] = await trx
        .select()
        .from(zuvyMentorSlotBooking)
        .where(eq(zuvyMentorSlotBooking.id, bookingId))
        .for('update');

      if (!booking) {
        throw new NotFoundException('Booking not found.');
      }

      // A cancelled booking must never be revivable through reschedule
      // accept, even though cancelBooking already clears rescheduleStatus
      // on cancel — this is defense in depth for any booking cancelled
      // before that fix was in place, and for the future reschedule-expiry
      // job.
      if (booking.status === 'cancelled') {
        throw new BadRequestException(
          'Cannot accept a reschedule on a cancelled booking.',
        );
      }

      if (booking.rescheduleStatus !== 'pending') {
        throw new BadRequestException('No pending reschedule.');
      }

      if (!booking.rescheduleProposedSlotId) {
        throw new BadRequestException('Invalid proposed slot.');
      }

      const [mentorProfile] = await trx
        .select({
          id: zuvyMentorSlotManagement.id,
          mentorUserId: zuvyMentorSlotManagement.mentorUserId,
          organizationId: zuvyMentorSlotManagement.organizationId,
          googleRefreshToken: zuvyMentorSlotManagement.googleRefreshToken,
        })
        .from(zuvyMentorSlotManagement)
        .where(
          and(
            eq(zuvyMentorSlotManagement.mentorUserId, booking.mentorUserId),
            eq(zuvyMentorSlotManagement.organizationId, booking.organizationId),
          ),
        )
        .limit(1);

      if (!mentorProfile) {
        throw new NotFoundException(
          'Mentor profile not found for the booking organization.',
        );
      }

      // Lock both slot rows now, lowest id first, before the licence-pool
      // lock below. bookSlot takes a slot row and then the licence-pool lock;
      // taking them in the same order here means an accept and a booking on
      // the old slot can't each hold one and wait for the other.
      await trx
        .select({ id: zuvyMentorSlotAvailability.id })
        .from(zuvyMentorSlotAvailability)
        .where(
          inArray(zuvyMentorSlotAvailability.id, [
            booking.slotAvailabilityId,
            booking.rescheduleProposedSlotId,
          ]),
        )
        .orderBy(zuvyMentorSlotAvailability.id)
        .for('update');

      const [proposedSlot] = await trx
        .select()
        .from(zuvyMentorSlotAvailability)
        .where(
          and(
            eq(zuvyMentorSlotAvailability.id, booking.rescheduleProposedSlotId),
            eq(
              zuvyMentorSlotAvailability.mentorSlotManagementId,
              mentorProfile.id,
            ),
          ),
        )
        .for('update');

      if (!proposedSlot) {
        throw new BadRequestException('Invalid proposed slot.');
      }

      if (new Date(proposedSlot.slotStartDateTime) <= new Date()) {
        throw new BadRequestException(
          'The proposed slot has already passed. Ask the student to propose a new time.',
        );
      }

      // Once the original session time has started, the session has either
      // happened or been missed — the booking still points at the original
      // Zoom meeting while a reschedule is pending, so it can run as normal.
      // Moving it now would hand the student a second session on the same
      // credit. A pending request has to be answered before the session.
      if (await this.slotHasStarted(trx, booking.slotAvailabilityId)) {
        throw new BadRequestException(
          'The original session time has already passed, so this reschedule can no longer be accepted.',
        );
      }

      // The proposed slot was open, so it holds no licence yet; it gets one
      // now. If a class has taken the last one since, say so plainly.
      try {
        await this.ensureMentorSlotLicenseAssignment(
          trx,
          proposedSlot,
          mentorProfile,
        );
      } catch (error: any) {
        if (this.isNoLicenceError(error)) {
          this.logger.warn(
            `Reschedule of booking ${bookingId} refused, no Zoom licence free: ${error.message}`,
          );
          throw new BadRequestException(
            "No meeting licence is free at the new time, so this reschedule can't be accepted. Decline it and the student can propose another time.",
          );
        }
        throw error;
      }

      /* Atomic capacity check + increment */

      // status is kept in step with the count the same way bookSlot does
      // ('full' once count reaches maxCapacity). Without it the new slot
      // stayed 'available' at full capacity and kept showing in listings.
      const updated = await trx
        .update(zuvyMentorSlotAvailability)
        .set({
          currentBookedCount: sql`${zuvyMentorSlotAvailability.currentBookedCount} + 1`,
          status: sql`CASE WHEN ${zuvyMentorSlotAvailability.currentBookedCount} + 1 >= ${zuvyMentorSlotAvailability.maxCapacity} THEN 'full' ELSE 'available' END`,
        } as Partial<typeof zuvyMentorSlotAvailability.$inferInsert>)
        .where(
          and(
            eq(zuvyMentorSlotAvailability.id, booking.rescheduleProposedSlotId),
            eq(
              zuvyMentorSlotAvailability.mentorSlotManagementId,
              mentorProfile.id,
            ),
            sql`${zuvyMentorSlotAvailability.currentBookedCount} < ${zuvyMentorSlotAvailability.maxCapacity}`,
          ),
        )
        .returning();

      if (updated.length === 0) {
        throw new BadRequestException('Proposed slot is full.');
      }

      /* Release old slot */

      // A slot that was 'full' goes back to 'available' now that a seat is
      // free — otherwise it stayed 'full' at zero bookings and bookSlot /
      // proposeReschedule rejected it forever. Any other status is left
      // as-is.
      await trx
        .update(zuvyMentorSlotAvailability)
        .set({
          currentBookedCount: sql`GREATEST(${zuvyMentorSlotAvailability.currentBookedCount} - 1, 0)`,
          status: sql`CASE WHEN ${zuvyMentorSlotAvailability.status} = 'full' THEN 'available' ELSE ${zuvyMentorSlotAvailability.status} END`,
        } as Partial<typeof zuvyMentorSlotAvailability.$inferInsert>)
        .where(eq(zuvyMentorSlotAvailability.id, booking.slotAvailabilityId));

      /* Move booking */

      // The initial read above (`booking.rescheduleStatus !== 'pending'` /
      // `booking.status === 'cancelled'`) only proves the booking was
      // eligible AT THAT MOMENT — a concurrent cancelBooking landing after
      // that read and before this write would otherwise still get silently
      // overwritten back to SCHEDULED. Re-checking both conditions in this
      // UPDATE's own WHERE clause makes the write itself atomic against
      // that race, not just the earlier read.
      const movedBooking = await trx
        .update(zuvyMentorSlotBooking)
        .set({
          slotAvailabilityId: booking.rescheduleProposedSlotId,
          rescheduleStatus: null,
          rescheduleRequestedAt: null,
          rescheduleProposedSlotId: null,
          sessionLifecycleState: 'SCHEDULED',
          updatedAt: new Date(),
        } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
        .where(
          and(
            eq(zuvyMentorSlotBooking.id, bookingId),
            eq(zuvyMentorSlotBooking.rescheduleStatus, 'pending'),
            ne(zuvyMentorSlotBooking.status, 'cancelled'),
          ),
        )
        .returning({ id: zuvyMentorSlotBooking.id });

      if (movedBooking.length === 0) {
        throw new BadRequestException(
          'This booking is no longer eligible for reschedule — it may have just been cancelled.',
        );
      }

      // The original slot is open again; its licence goes back to the pool.
      await this.releaseSlotLicenceIfUnbooked(trx, booking.slotAvailabilityId);

      await this.notificationService.createNotification(
        {
          userId: booking.studentUserId,
          type: NotificationType.RESCHEDULE_ACCEPTED,
          title: 'Reschedule accepted',
          message: '',
          referenceId: bookingId,
          referenceType: 'booking',
        },
        trx,
      );

      externalUpdate = {
        isZoomMeet: booking.isZoomMeet,
        zoomMeetingId: booking.zoomMeetingId,
        googleEventId: booking.googleEventId,
        googleRefreshToken: mentorProfile?.googleRefreshToken ?? null,
        proposedSlotStart: proposedSlot.slotStartDateTime,
        proposedSlotEnd: proposedSlot.slotEndDateTime,
        proposedDurationMinutes: proposedSlot.durationMinutes,
      };

      return { message: 'Reschedule accepted successfully.' };
    });

    // Best-effort, run only after the reschedule has durably committed —
    // see the identical note in cancelBooking.
    if (externalUpdate) {
      const {
        isZoomMeet,
        zoomMeetingId,
        googleEventId,
        googleRefreshToken,
        proposedSlotStart,
        proposedSlotEnd,
        proposedDurationMinutes,
      } = externalUpdate;

      if (isZoomMeet && zoomMeetingId) {
        try {
          await this.zoomService.updateMeeting(zoomMeetingId, {
            start_time: new Date(proposedSlotStart).toISOString(),
            duration: proposedDurationMinutes,
            timezone: 'UTC',
          });
        } catch (error: any) {
          this.logger.error(
            `Failed to move Zoom meeting ${zoomMeetingId} to its rescheduled time for booking ${bookingId}: ${error.message}`,
          );
        }
      }

      if (googleEventId && googleRefreshToken) {
        try {
          await this.googleCalendarService.updateMeeting(
            googleEventId,
            proposedSlotStart,
            proposedSlotEnd,
            googleRefreshToken,
          );
        } catch (error: any) {
          this.logger.error(
            `Failed to move Google Calendar event ${googleEventId} to its rescheduled time for booking ${bookingId}: ${error.message}`,
          );
        }
      }
    }

    return result;
  }

  async declineReschedule(
    bookingId: number,
    mentorUserId?: number,
    organizationId?: number,
  ) {
    await this.syncZoomLicenseState();

    if (mentorUserId) {
      await this.ensureMentorOwnsBooking(
        mentorUserId,
        bookingId,
        organizationId,
      );
    }

    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) throw new NotFoundException('Booking not found.');

    // See the identical check in acceptReschedule — a cancelled booking
    // must never be revivable through the reschedule flow.
    if (booking.status === 'cancelled') {
      throw new BadRequestException(
        'Cannot decline a reschedule on a cancelled booking.',
      );
    }

    if (booking.rescheduleStatus !== 'pending')
      throw new BadRequestException('No pending reschedule.');

    // Same atomic re-check as acceptReschedule/proposeReschedule: the
    // read-time guards above only prove eligibility at that moment, so this
    // write re-verifies it's still true.
    const declined = await db
      .update(zuvyMentorSlotBooking)
      .set({
        rescheduleStatus: null,
        rescheduleRequestedAt: null,
        rescheduleProposedSlotId: null,
        sessionLifecycleState: 'SCHEDULED',
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(
        and(
          eq(zuvyMentorSlotBooking.id, bookingId),
          eq(zuvyMentorSlotBooking.rescheduleStatus, 'pending'),
          ne(zuvyMentorSlotBooking.status, 'cancelled'),
        ),
      )
      .returning({ id: zuvyMentorSlotBooking.id });

    if (declined.length === 0) {
      throw new BadRequestException(
        'This booking is no longer eligible for reschedule — it may have just been cancelled.',
      );
    }

    await this.notificationService.createNotification({
      userId: booking.studentUserId,
      type: NotificationType.RESCHEDULE_DECLINED,
      title: 'Reschedule declined',
      message: '',
      referenceId: bookingId,
      referenceType: 'booking',
    });

    return { message: 'Reschedule declined.' };
  }

  async createSlot(userId: number, dto: any, organizationId?: number) {
    await this.syncZoomLicenseState();
    await this.ensureUserIsMentor(userId);
    await this.validateMentorProfileComplete(userId, organizationId);
    await this.ensureMentorHasMentorshipEnabledBootcamp(userId, organizationId);
    await this.ensureMentorZoomAccountActive(userId, organizationId);

    const mentorProfile = await this.getOrCreateMentorProfile(
      userId,
      organizationId,
    );

    const start = new Date(dto.slotStartDateTime);
    const end = new Date(dto.slotEndDateTime);

    if (end <= start) {
      throw new BadRequestException('Invalid time range.');
    }

    if (start.getTime() <= Date.now()) {
      throw new BadRequestException('Cannot create past slot.');
    }

    const durationMinutes = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60),
    );

    if (durationMinutes <= 0) {
      throw new BadRequestException('Invalid slot duration.');
    }

    /* ================================
       PLATFORM SLOT OVERLAP CHECK
    ================================= */

    const overlap = await db
      .select({
        slotId: zuvyMentorSlotAvailability.id,
        organizationId: zuvyMentorSlotManagement.organizationId,
        orgName: zuvyOrganizations.displayName,
      })
      .from(zuvyMentorSlotAvailability)
      .innerJoin(
        zuvyMentorSlotManagement,
        eq(
          zuvyMentorSlotAvailability.mentorSlotManagementId,
          zuvyMentorSlotManagement.id,
        ),
      )
      .innerJoin(
        zuvyOrganizations,
        eq(zuvyOrganizations.id, zuvyMentorSlotManagement.organizationId),
      )
      .where(
        and(
          eq(zuvyMentorSlotManagement.mentorUserId, BigInt(userId)),
          lt(zuvyMentorSlotAvailability.slotStartDateTime, end),
          gt(zuvyMentorSlotAvailability.slotEndDateTime, start),
        ),
      );

    if (overlap.length > 0) {
      const conflictingOrg = overlap[0].orgName;
      const orgMessage =
        conflictingOrg &&
        overlap[0].organizationId !== mentorProfile.organizationId
          ? ` in ${conflictingOrg}`
          : '';

      throw new BadRequestException(
        `This time overlaps with another mentor slot${orgMessage}. Please choose a different time.`,
      );
    }

    return db.transaction(async (trx) => {
      // An open slot doesn't hold a Zoom licence (that only happens when a
      // student books it, in ensureMentorSlotLicenseAssignment), so open
      // slots never block classes. The slot is still refused here if no
      // licence would be free at that time, so a student can book whatever
      // slot is open.
      const licence = await this.zoomLicenseService.checkLicenseAvailability(
        trx,
        { instructorId: userId, startTime: start, endTime: end },
      );

      if (!licence.available) {
        throw new BadRequestException(licence.message);
      }

      const createdSlots = await trx
        .insert(zuvyMentorSlotAvailability)
        .values({
          mentorSlotManagementId: mentorProfile.id,
          slotStartDateTime: start,
          slotEndDateTime: end,
          durationMinutes,
          maxCapacity: dto.maxCapacity ?? 1,
          topic: dto.topic ?? null,
          status: 'available',
          isPublic: true,
        } as typeof zuvyMentorSlotAvailability.$inferInsert)
        .returning();

      return createdSlots;
    });
  }

  /**
   * Lets the slot form check a time before saving: is a Zoom licence free for
   * this mentor then? Reserves nothing.
   */
  async checkSlotLicenceAvailability(
    userId: number,
    slotStartDateTime: string,
    slotEndDateTime: string,
  ) {
    await this.ensureUserIsMentor(userId);

    const start = new Date(slotStartDateTime);
    const end = new Date(slotEndDateTime);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      throw new BadRequestException('Invalid time range.');
    }

    // Read only: no transaction and no licence-pool lock, so this check never
    // queues behind, or holds up, a real allocation. Creating the slot runs
    // the same check again under the lock.
    const licence = await this.zoomLicenseService.checkLicenseAvailability(
      db,
      { instructorId: userId, startTime: start, endTime: end },
      { lock: false },
    );

    return {
      available: licence.available,
      nextAvailableAt: licence.nextAvailableAt,
      message: licence.message,
    };
  }

  async getMySlots(
    userId: number,
    weekOffset = 0,
    sort: 'asc' | 'desc' = 'desc',
    organizationId?: number,
  ) {
    await this.ensureUserIsMentor(userId);

    const mentorProfile = await this.getOrCreateMentorProfile(
      userId,
      organizationId,
    );

    if (!mentorProfile) {
      throw new NotFoundException('Mentor profile not found.');
    }

    // Listing a mentor's own slots is a read — it shouldn't depend on a live
    // Zoom API call (ensureMentorZoomAccountActive), which only matters when
    // actually creating a slot (see createSlot). This used to mean a mentor
    // couldn't even view their own availability if Zoom was slow or had
    // briefly marked their account inactive. See MDA-11.
    const now = new Date();

    /* ============================
       WEEK RANGE (MONDAY → SUNDAY)
    ============================ */

    const today = new Date();
    const day = today.getDay();

    const diffToMonday = day === 0 ? -6 : 1 - day;

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + diffToMonday + weekOffset * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    /* ==================================================
      DISPLAY END OF WEEK (SUNDAY 23:59:59)
    ================================================== */

    const displayWeekEnd = new Date(endOfWeek);
    displayWeekEnd.setMilliseconds(displayWeekEnd.getMilliseconds() - 1);

    /* ============================
       FETCH SLOTS
    ============================ */

    const slots = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(
        and(
          eq(
            zuvyMentorSlotAvailability.mentorSlotManagementId,
            mentorProfile.id,
          ),
          gte(zuvyMentorSlotAvailability.slotStartDateTime, startOfWeek),
          lt(zuvyMentorSlotAvailability.slotStartDateTime, endOfWeek),
        ),
      )
      .orderBy(
        sort === 'asc'
          ? zuvyMentorSlotAvailability.slotStartDateTime
          : desc(zuvyMentorSlotAvailability.slotStartDateTime),
      );

    /* ============================
       PROCESS STATUS + METRICS
    ============================ */

    let available = 0;
    let full = 0;
    let completed = 0;
    let closed = 0;
    let totalMinutes = 0;

    const processedSlots = slots.map((slot) => {
      const slotStart = new Date(slot.slotStartDateTime);

      let status: 'available' | 'full' | 'completed' | 'closed';

      if (slotStart < now) {
        if (slot.currentBookedCount > 0) {
          status = 'completed';
          completed++;
        } else {
          status = 'closed';
          closed++;
        }
      } else {
        if (slot.currentBookedCount >= slot.maxCapacity) {
          status = 'full';
          full++;
        } else {
          status = 'available';
          available++;
        }
      }

      totalMinutes += slot.durationMinutes;

      return {
        ...slot,
        status,
      };
    });

    /* ============================
       METRICS
    ============================ */

    const metrics = {
      totalSlots: slots.length,
      available,
      full,
      completed,
      closed,
      hours: Number((totalMinutes / 60).toFixed(2)),
    };

    return {
      weekStart: startOfWeek,
      weekEnd: displayWeekEnd,
      metrics,
      slots: processedSlots,
    };
  }

  async getSlotDetails(
    userId: number,
    slotId: number,
    organizationId?: number,
  ) {
    await this.ensureUserIsMentor(userId);

    const mentorProfile = await this.getOrCreateMentorProfile(
      userId,
      organizationId,
    );

    const [slot] = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(eq(zuvyMentorSlotAvailability.id, slotId))
      .limit(1);

    if (!slot) throw new NotFoundException('Slot not found.');

    if (slot.mentorSlotManagementId !== mentorProfile.id) {
      throw new ForbiddenException('You do not own this slot');
    }

    const bookings = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.slotAvailabilityId, slotId));

    const userIdBigInt = BigInt(userId);

    return {
      slot,
      bookings: bookings.map((b) => ({
        ...b,
        meetingLink: this.mapMeetingLink(b, userIdBigInt),
      })),
    };
  }

  async getBookingRecordings(userId: number, bookingId: number) {
    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const userIdBigInt = BigInt(userId);

    if (
      booking.mentorUserId !== userIdBigInt &&
      booking.studentUserId !== userIdBigInt
    ) {
      throw new ForbiddenException(
        'You do not have permission to view recordings for this booking.',
      );
    }

    const [slot] = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(eq(zuvyMentorSlotAvailability.id, booking.slotAvailabilityId))
      .limit(1);

    const recordings = await db
      .select()
      .from(zuvyMentorSessionRecordings)
      .where(eq(zuvyMentorSessionRecordings.mentorBookingId, bookingId))
      .orderBy(desc(zuvyMentorSessionRecordings.createdAt));

    // Shared by the student and mentor routes: only the mentor (the host)
    // may receive the host-only Zoom fields.
    const isMentor = booking.mentorUserId === userIdBigInt;

    return {
      booking: {
        ...(isMentor ? booking : withoutHostZoomFields(booking)),
        meetingLink: this.mapMeetingLink(booking, userIdBigInt),
      },
      slot,
      recordings: recordings.map((recording) => ({
        ...recording,
        youtubeVideoId: recording.driveFileId,
        youtubeUrl: recording.driveLink,
      })),
    };
  }

  async getStudentBookings(userId: number) {
    const userIdBigInt = BigInt(userId);

    const bookings = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.studentUserId, userIdBigInt));

    return bookings.map((b) => ({
      ...withoutHostZoomFields(b),
      meetingLink: b.meetingLink,
    }));
  }

  async getStudentMetrics(
    userId: number,
    filter: 'all' | '30d' | '3m' = 'all',
  ) {
    const userIdBigInt = BigInt(userId);
    const config = await this.mentorshipConfig.get();
    const now = new Date();
    const usage = await this.creditService.loadUsage(db, userIdBigInt, config);
    const credits = computeCreditState(usage, config, now);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    let fromDate: Date | null = null;

    if (filter === '30d') {
      fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
    }

    if (filter === '3m') {
      fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 3);
    }

    /* ==========================================
       GET SLOT IDS FOR FILTER WINDOW
    ========================================== */

    let filteredSlotIds: number[] = [];

    if (fromDate) {
      const upperBound = filter === 'all' ? null : endOfToday;

      const slots = await db
        .select({
          id: zuvyMentorSlotAvailability.id,
        })
        .from(zuvyMentorSlotAvailability)
        .where(
          upperBound
            ? and(
                gte(zuvyMentorSlotAvailability.slotStartDateTime, fromDate),
                lte(zuvyMentorSlotAvailability.slotStartDateTime, upperBound),
              )
            : gte(zuvyMentorSlotAvailability.slotStartDateTime, fromDate),
        );

      filteredSlotIds = slots.map((s) => s.id);
    }

    /* ==========================================
       SESSION COUNTS
    ========================================== */

    const bookingConditions: any[] = [
      eq(zuvyMentorSlotBooking.studentUserId, userIdBigInt),
    ];

    if (filteredSlotIds.length > 0) {
      bookingConditions.push(
        inArray(zuvyMentorSlotBooking.slotAvailabilityId, filteredSlotIds),
      );
    }

    const [sessionStats] = await db
      .select({
        totalSessions: sql<number>`COUNT(*)`,
        completedSessions: sql<number>`
        COUNT(*) FILTER (
          WHERE session_lifecycle_state = 'COMPLETED'
        )
      `,
        upcomingSessions: sql<number>`
        COUNT(*) FILTER (
          WHERE session_lifecycle_state = 'SCHEDULED'
        )
      `,
        cancelledSessions: sql<number>`
        COUNT(*) FILTER (
          WHERE session_lifecycle_state = 'CANCELLED'
        )
      `,
      })
      .from(zuvyMentorSlotBooking)
      .where(and(...bookingConditions));

    /* ==========================================
       UPCOMING SESSIONS
    ========================================== */

    const upcomingSlots = await db
      .select({
        id: zuvyMentorSlotAvailability.id,
      })
      .from(zuvyMentorSlotAvailability)
      .where(
        filter === 'all'
          ? gte(zuvyMentorSlotAvailability.slotStartDateTime, now)
          : and(
              gte(zuvyMentorSlotAvailability.slotStartDateTime, now),
              lte(zuvyMentorSlotAvailability.slotStartDateTime, endOfToday),
            ),
      );

    const upcomingSlotIds = upcomingSlots.map((slot) => slot.id);

    let upcomingCount = 0;

    if (upcomingSlotIds.length > 0) {
      const [upcoming] = await db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(zuvyMentorSlotBooking)
        .where(
          and(
            eq(zuvyMentorSlotBooking.studentUserId, userIdBigInt),
            eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
            inArray(zuvyMentorSlotBooking.slotAvailabilityId, upcomingSlotIds),
          ),
        );

      upcomingCount = Number(upcoming.count || 0);
    }

    // The cached row's other fields, as this response always carried them
    // (read only: nothing is created on read any more).
    const [cachedRow] = await db
      .select()
      .from(zuvyStudentBookingMetrics)
      .where(eq(zuvyStudentBookingMetrics.userId, userIdBigInt))
      .limit(1);

    return {
      id: cachedRow?.id ?? null,
      totalBookings: cachedRow?.totalBookings ?? 0,
      lastBookingDate: cachedRow?.lastBookingDate ?? null,
      quotaResetDate: config.creditsCountedFrom,
      createdAt: cachedRow?.createdAt ?? null,
      updatedAt: cachedRow?.updatedAt ?? null,
      userId: userIdBigInt,
      // The credit fields, worked out from bookings now (not the cache).
      quotaUsed: credits.creditsUsed,
      isQuotaExhausted: credits.creditsLeft === 0,
      cooldownEndDate: gapEndsAfter(usage.latestSessionStart, config),

      remainingCredits: credits.creditsLeft,
      canBook: credits.canBook,
      nextEligible: credits.nextEligibleDate,
      credits: creditData(credits),
      serverTime: now,

      sessions: {
        total: Number(sessionStats.totalSessions || 0),
        completed: Number(sessionStats.completedSessions || 0),
        cancelled: Number(sessionStats.cancelledSessions || 0),
        upcoming: upcomingCount,
      },

      filter,
    };
  }

  async markAttendance(
    bookingId: number,
    joinedAtStr: string,
    leftAtStr: string,
    mentorUserId?: number,
  ) {
    await this.syncZoomLicenseState();

    const booking = await this.loadBookingForOwnedAction(
      bookingId,
      mentorUserId,
    );

    // Neither this nor completeSession checked the booking wasn't already
    // cancelled, so either call could "revive" a cancelled booking. See
    // MDA-18.
    if (booking.status === 'cancelled') {
      throw new BadRequestException(
        'Cannot record attendance for a cancelled booking.',
      );
    }

    const joinedAt = new Date(joinedAtStr);
    const leftAt = new Date(leftAtStr);

    if (leftAt <= joinedAt) {
      throw new BadRequestException('Invalid attendance range.');
    }

    const duration = Math.floor(
      (leftAt.getTime() - joinedAt.getTime()) / (1000 * 60),
    );

    // Same atomic re-check applied across the reschedule flow: the read
    // above only proves this wasn't cancelled AT THAT MOMENT.
    const attendanceMarked = await db
      .update(zuvyMentorSlotBooking)
      .set({
        joinedAt,
        leftAt,
        durationAttended: duration,
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(
        and(
          eq(zuvyMentorSlotBooking.id, bookingId),
          ne(zuvyMentorSlotBooking.status, 'cancelled'),
        ),
      )
      // Only the fields this response needs — the full row would expose the
      // Zoom host link, the Zoom password and both parties' feedback.
      .returning({
        id: zuvyMentorSlotBooking.id,
        joinedAt: zuvyMentorSlotBooking.joinedAt,
        leftAt: zuvyMentorSlotBooking.leftAt,
        durationAttended: zuvyMentorSlotBooking.durationAttended,
      });

    if (attendanceMarked.length === 0) {
      throw new BadRequestException(
        'Cannot record attendance for a cancelled booking.',
      );
    }

    return { message: 'Attendance recorded.', ...attendanceMarked[0] };
  }

  async completeSession(bookingId: number, mentorUserId?: number) {
    await this.syncZoomLicenseState();

    const booking = await this.loadBookingForOwnedAction(
      bookingId,
      mentorUserId,
    );

    // See MDA-18.
    if (booking.status === 'cancelled') {
      throw new BadRequestException('Cannot complete a cancelled booking.');
    }

    // Once MentorAttendanceJob has recorded the outcome from Zoom's report,
    // that is what happened: marking it complete by hand could otherwise
    // show a no-show (credit already refunded) as a session that was held.
    const [recorded] = await db
      .select({ outcome: zuvyMentorSessionAttendance.outcome })
      .from(zuvyMentorSessionAttendance)
      .where(
        and(
          eq(zuvyMentorSessionAttendance.mentorBookingId, bookingId),
          eq(zuvyMentorSessionAttendance.status, 'RECORDED'),
        ),
      )
      .limit(1);

    if (recorded) {
      throw new BadRequestException(
        `Attendance for this session was already recorded from Zoom (${recorded.outcome}), so it can't be marked complete by hand.`,
      );
    }

    // Same atomic re-check as markAttendance above — the read-time guards
    // only prove these held at that moment, not at write time.
    const completed = await db
      .update(zuvyMentorSlotBooking)
      .set({
        completedAt: new Date(),
        sessionLifecycleState: 'COMPLETED',
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(
        and(
          eq(zuvyMentorSlotBooking.id, bookingId),
          ne(zuvyMentorSlotBooking.status, 'cancelled'),
          notExists(
            db
              .select({ id: zuvyMentorSessionAttendance.id })
              .from(zuvyMentorSessionAttendance)
              .where(
                and(
                  eq(
                    zuvyMentorSessionAttendance.mentorBookingId,
                    zuvyMentorSlotBooking.id,
                  ),
                  eq(zuvyMentorSessionAttendance.status, 'RECORDED'),
                ),
              ),
          ),
        ),
      )
      // Same as markAttendance: never return the full row.
      .returning({
        id: zuvyMentorSlotBooking.id,
        sessionLifecycleState: zuvyMentorSlotBooking.sessionLifecycleState,
        completedAt: zuvyMentorSlotBooking.completedAt,
      });

    if (completed.length === 0) {
      throw new BadRequestException(
        'This session can no longer be marked complete: it was cancelled, or its attendance was just recorded from Zoom.',
      );
    }

    return { message: 'Session marked as completed.', ...completed[0] };
  }

  async updateMentorProfile(userId: number, dto: any, organizationId?: number) {
    await this.ensureUserIsMentor(userId);

    await this.resolveInstructorOrganization(userId, organizationId);
    const sharedProfile = await this.getOrCreateSharedMentorProfile(userId);

    const updatePayload: Partial<typeof zuvyMentorProfile.$inferSelect> = {};

    if (dto.bio !== undefined) updatePayload.bio = dto.bio;
    if (dto.expertise !== undefined) updatePayload.expertise = dto.expertise;
    if (dto.title !== undefined) updatePayload.title = dto.title;
    if (dto.pastExperiences !== undefined)
      updatePayload.pastExperiences = dto.pastExperiences;

    // prevent empty update
    if (Object.keys(updatePayload).length === 0) {
      throw new BadRequestException('No fields provided for update');
    }

    await db
      .update(zuvyMentorProfile)
      .set({
        ...updatePayload,
        updatedAt: new Date(),
      } as Partial<typeof zuvyMentorProfile.$inferInsert>)
      .where(eq(zuvyMentorProfile.id, sharedProfile.id));
    return { message: ' Mentor profile updated successfully' };
  }

  async getMyMentorProfile(userId: number, organizationId?: number) {
    await this.ensureUserIsMentor(userId);
    await this.getOrCreateSharedMentorProfile(userId);

    const userIdBigInt = BigInt(userId);
    const resolvedOrganizationId = await this.resolveInstructorOrganization(
      userId,
      organizationId,
    );

    const [profile] = await db
      .select({
        mentorProfileId: zuvyMentorSlotManagement.id,
        mentorUserId: zuvyMentorSlotManagement.mentorUserId,
        organizationId: zuvyMentorSlotManagement.organizationId,
        orgName: zuvyOrganizations.displayName,

        mentorType: zuvyMentorSlotManagement.mentorType,
        timezone: zuvyMentorSlotManagement.timezone,

        title: zuvyMentorProfile.title,
        bio: zuvyMentorProfile.bio,
        expertise: zuvyMentorProfile.expertise,
        pastExperiences: zuvyMentorProfile.pastExperiences,
        bootcampId: zuvyMentorSlotManagement.bootcampId,

        status: zuvyMentorSlotManagement.status,
        isVerified: zuvyMentorSlotManagement.isVerified,
        acceptsNewMentees: zuvyMentorSlotManagement.acceptsNewMentees,

        createdAt: zuvyMentorSlotManagement.createdAt,
        updatedAt: zuvyMentorSlotManagement.updatedAt,
      })
      .from(zuvyMentorSlotManagement)
      .innerJoin(
        zuvyMentorProfile,
        eq(
          zuvyMentorProfile.mentorUserId,
          zuvyMentorSlotManagement.mentorUserId,
        ),
      )
      .innerJoin(
        zuvyOrganizations,
        eq(zuvyOrganizations.id, zuvyMentorSlotManagement.organizationId),
      )
      .where(
        and(
          eq(zuvyMentorSlotManagement.mentorUserId, userIdBigInt),
          eq(zuvyMentorSlotManagement.organizationId, resolvedOrganizationId),
        ),
      )
      .limit(1);

    if (!profile) {
      throw new NotFoundException('Mentor profile not found');
    }

    return profile;
  }

  // `trx` is required (not defaulted to the module-level `db`) because its
  // one caller runs inside bookSlot's open transaction — writing via a
  // separate connection there was a reference to a row that connection
  // can't yet see as committed. See MDA-22.
  private async enqueueMentorRecordingJob(
    trx: any,
    booking: {
      id: number;
      zoomMeetingId: string | null;
      zoomMeetingUuid?: string | null;
      isZoomMeet: boolean;
    },
  ) {
    if (!booking.isZoomMeet || !booking.zoomMeetingId) return;

    try {
      const recordingData = {
        mentorBookingId: booking.id,
        zoomMeetingId: booking.zoomMeetingId,
        zoomMeetingUuid: booking.zoomMeetingUuid ?? null,
        status: 'DISCOVERED',
      } as const;

      // Nested transaction = SAVEPOINT. In Postgres a failed statement aborts
      // the whole enclosing transaction, so without the savepoint a failed
      // insert here (swallowed by the catch below) would make bookSlot's next
      // query fail and roll the booking back after the Zoom meeting already
      // exists. The savepoint rolls back only this insert; the booking still
      // commits.
      await trx.transaction(async (sp: any) => {
        await sp
          .insert(zuvyMentorSessionRecordings)
          .values(recordingData)
          .onConflictDoNothing();
      });

      this.logger.log(
        `Recording job enqueued for mentor booking ${booking.id}, meetingId: ${booking.zoomMeetingId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue recording job for mentor booking ${booking.id}: ${error.message}`,
      );
    }
  }

  async createOrUpdateMentorProfile(
    userId: number,
    dto: any,
    organizationId?: number,
  ) {
    await this.ensureUserIsMentor(userId);

    const userIdBigInt = BigInt(userId);
    const resolvedOrganizationId = await this.resolveInstructorOrganization(
      userId,
      organizationId,
    );

    /* =========================================================
    FETCH EXISTING PROFILE
    ========================================================= */
    const existingProfile = await db.query.zuvyMentorSlotManagement.findFirst({
      where: and(
        eq(zuvyMentorSlotManagement.mentorUserId, userIdBigInt),
        eq(zuvyMentorSlotManagement.organizationId, resolvedOrganizationId),
      ),
    });
    const sharedProfile = await this.getOrCreateSharedMentorProfile(userId);

    /* =========================================================
    PREPARE PAYLOAD
    ========================================================= */
    const payload = {
      ...(dto.bio !== undefined && { bio: dto.bio }),
      ...(dto.expertise !== undefined && { expertise: dto.expertise }),
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.pastExperiences !== undefined && {
        pastExperiences: dto.pastExperiences,
      }),
    };

    /* =========================================================
    CREATE FLOW
    ========================================================= */
    if (!existingProfile) {
      const [newProfile] = await db
        .insert(zuvyMentorSlotManagement)
        .values({
          mentorUserId: userIdBigInt,
          organizationId: resolvedOrganizationId,

          mentorType: 'instructor',

          isBufferEnabled: false,
          bufferMinutes: 0,
          timezone: 'UTC',

          totalAvailableSlots: 0,
          totalBookedSlots: 0,
          totalCancelledSlots: 0,

          status: 'active',
          isVerified: false,
          acceptsNewMentees: true,

          createdAt: new Date(),
          updatedAt: new Date(),
        } as typeof zuvyMentorSlotManagement.$inferInsert)
        .returning();

      if (Object.keys(payload).length > 0) {
        await db
          .update(zuvyMentorProfile)
          .set({
            ...payload,
            updatedAt: new Date(),
          } as Partial<typeof zuvyMentorProfile.$inferInsert>)
          .where(eq(zuvyMentorProfile.id, sharedProfile.id));
      }

      return {
        message: 'Mentor profile created successfully',
        data: newProfile,
      };
    }

    /* =========================================================
    UPDATE FLOW
    ========================================================= */
    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('No fields provided for update');
    }

    const result = await db
      .update(zuvyMentorProfile)
      .set({
        ...payload,
        updatedAt: new Date(),
      } as Partial<typeof zuvyMentorProfile.$inferInsert>)
      .where(eq(zuvyMentorProfile.id, sharedProfile.id))
      .returning();

    if (!result.length) {
      throw new NotFoundException(
        'Mentor profile not found for this organization',
      );
    }

    return {
      message: 'Mentor profile updated successfully',
    };
  }
}
