import {
  Injectable,
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
  zuvyOrganizations,
  users,
  zuvyStudentBookingMetrics,
  licenseAssignments,
} from '../../../drizzle/schema';

import {
  and,
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
} from 'drizzle-orm';
import { CreateSlotDto } from './dto/create-slot.dto';
import { GoogleCalendarService } from 'src/integrations/google/google-calendar.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { ZoomService } from 'src/services/zoom/zoom.service';
import { NotificationEmailService } from 'src/notification/email/email.service';
import { ZoomLicenseService } from '../zoom-license/zoom-license.service';

@Injectable()
export class MentorSlotService {
  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly notificationService: NotificationService,
    private readonly zoomService: ZoomService,
    private readonly emailService: NotificationEmailService,
    private readonly zoomLicenseService: ZoomLicenseService,
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

  private async ensureMentorZoomVerified(
    userId: number,
    organizationId?: number,
  ) {
    const mentorProfile = await this.getOrCreateMentorProfile(
      userId,
      organizationId,
    );
    console.log(
      `Mentor profile for user ${userId}: isVerified=${mentorProfile?.isVerified}`,
    );

    const [userRow] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, BigInt(userId)))
      .limit(1);

    if (!userRow) {
      throw new NotFoundException('Mentor user not found');
    }

    console.log(`Checking Zoom user for email: ${userRow.email}`);

    const zoomResponse = await this.zoomService.getUser(userRow.email);
    console.log(
      `Zoom getUser response: success=${zoomResponse.success}, error=${zoomResponse.error}`,
    );

    if (!zoomResponse.success) {
      await db
        .update(zuvyMentorSlotManagement)
        .set({
          isVerified: false,
          updatedAt: new Date(),
        } as Partial<typeof zuvyMentorSlotManagement.$inferInsert>)
        .where(eq(zuvyMentorSlotManagement.id, mentorProfile.id));

      console.error(
        `Zoom user check failed for ${userRow.email}: ${zoomResponse.error}`,
      );
      throw new BadRequestException(
        'Mentor Zoom account is not available or not licensed',
      );
    }

    const userType = zoomResponse.data.type;
    const userStatus = zoomResponse.data.status;
    console.log(`Zoom user type=${userType}, status=${userStatus}`);

    if (userType !== 2 || userStatus !== 'active') {
      await db
        .update(zuvyMentorSlotManagement)
        .set({
          isVerified: false,
          updatedAt: new Date(),
        } as Partial<typeof zuvyMentorSlotManagement.$inferInsert>)
        .where(eq(zuvyMentorSlotManagement.id, mentorProfile.id));

      console.error(
        `Zoom user not licensed/active: type=${userType}, status=${userStatus}`,
      );
      throw new BadRequestException(
        'Mentor Zoom account must be an active licensed Zoom user',
      );
    }

    console.log(
      `Zoom verification successful for user ${userId}, updating profile`,
    );

    await db
      .update(zuvyMentorSlotManagement)
      .set({
        isVerified: true,
        updatedAt: new Date(),
      } as Partial<typeof zuvyMentorSlotManagement.$inferInsert>)
      .where(eq(zuvyMentorSlotManagement.id, mentorProfile.id));

    return true;
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
     UTILITY — 12 HOUR RULE ENFORCER
  ========================================================================== */

  private enforceMinimumNotice(slotStart: Date) {
    const now = new Date();
    const diffMs = slotStart.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 12) {
      throw new BadRequestException(
        'Booking must be made at least 12 hours in advance.',
      );
    }
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

  /* ==========================================================================
   QUOTA YEAR WINDOW (APRIL 15 → APRIL 14)
========================================================================== */

  private getQuotaWindow() {
    const now = new Date();
    const year = now.getUTCFullYear();

    let quotaStart = new Date(Date.UTC(year, 3, 15)); // April 15
    let quotaEnd = new Date(Date.UTC(year + 1, 3, 14, 23, 59, 59));

    if (now < quotaStart) {
      quotaStart = new Date(Date.UTC(year - 1, 3, 15));
      quotaEnd = new Date(Date.UTC(year, 3, 14, 23, 59, 59));
    }

    return { quotaStart, quotaEnd };
  }

  private getQuotaResetDate() {
    const { quotaEnd } = this.getQuotaWindow();
    return new Date(Date.UTC(quotaEnd.getUTCFullYear(), 3, 15));
  }

  private async resetStudentMetrics(studentUserId: bigint) {
    const resetDate = this.getQuotaResetDate();
    await db
      .update(zuvyStudentBookingMetrics)
      .set({
        quotaUsed: 0,
        isQuotaExhausted: false,
        quotaResetDate: resetDate,
        updatedAt: new Date(),
      } as Partial<typeof zuvyStudentBookingMetrics.$inferInsert>)
      .where(eq(zuvyStudentBookingMetrics.userId, studentUserId));
  }

  /* ==========================================================================
     VALIDATE LEARNER QUOTA + COOLDOWN
  ========================================================================== */

  private async validateLearnerBookingEligibility(studentUserId: bigint) {
    const [metrics] = await db
      .select()
      .from(zuvyStudentBookingMetrics)
      .where(eq(zuvyStudentBookingMetrics.userId, studentUserId))
      .limit(1);

    if (!metrics) {
      // Initialize if missing
      await this.initializeStudentMetrics(studentUserId);
      return; // Allow first booking
    }

    const now = new Date();
    if (metrics.quotaResetDate && now >= metrics.quotaResetDate) {
      await this.resetStudentMetrics(studentUserId);
      return;
    }

    // Check quota
    if (metrics.isQuotaExhausted || metrics.quotaUsed >= 3) {
      throw new ForbiddenException(
        `You have used all 3 sessions for this year. Your quota resets on ${metrics.quotaResetDate.toDateString()}.`,
      );
    }

    // Check cooldown
    if (metrics.cooldownEndDate && now < metrics.cooldownEndDate) {
      throw new ForbiddenException(
        `You can book your next session from ${metrics.cooldownEndDate.toDateString()}.`,
      );
    }
  }

  private async initializeStudentMetrics(userId: bigint) {
    const quotaResetDate = this.getQuotaResetDate();
    await db.insert(zuvyStudentBookingMetrics).values({
      userId,
      quotaResetDate,
    } as typeof zuvyStudentBookingMetrics.$inferInsert);
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
    await this.validateLearnerBookingEligibility(BigInt(studentId));
    await this.syncZoomLicenseState();

    return db.transaction(async (trx) => {
      /* ========================================
     LOCK SLOT (FOR UPDATE)
  ======================================== */

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

      // 12-hour booking notice is temporarily disabled for short-notice sessions.
      // this.enforceMinimumNotice(new Date(slot.slotStartDateTime));

      /* ========================================
       FETCH MENTOR PROFILE
    ======================================== */
      const [mentorProfile] = await trx
        .select()
        .from(zuvyMentorSlotManagement)
        .where(eq(zuvyMentorSlotManagement.id, slot.mentorSlotManagementId))
        .limit(1);

      if (!mentorProfile) {
        throw new NotFoundException('Mentor not found.');
      }

      /* ========================================
         BUFFER CHECK
      ======================================== */

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

      /* ========================================
           DUPLICATE BOOKING CHECK
        ======================================== */

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

      await this.ensureMentorSlotLicenseAssignment(trx, slot, mentorProfile);

      /* ========================================
         UPDATE SLOT CAPACITY (NO SQL)
      ======================================== */

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

      /* ========================================
         CREATE BOOKING
      ======================================== */

      const booking = await trx
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

      const createdBooking = booking[0];

      /* ========================================
     UPDATE STUDENT METRICS
  ======================================== */
      await trx
        .insert(zuvyStudentBookingMetrics)
        .values({
          userId: BigInt(studentId),
          totalBookings: 1,
          quotaUsed: 1,
          lastBookingDate: new Date(),
          cooldownEndDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days
          quotaResetDate: this.getQuotaResetDate(),
          isQuotaExhausted: false,
        } as typeof zuvyStudentBookingMetrics.$inferInsert)
        .onConflictDoUpdate({
          target: zuvyStudentBookingMetrics.userId,
          set: {
            totalBookings: sql`COALESCE(zuvy_student_booking_metrics.total_bookings, 0) + 1`,
            quotaUsed: sql`COALESCE(zuvy_student_booking_metrics.quota_used, 0) + 1`,
            lastBookingDate: new Date(),
            cooldownEndDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
            quotaResetDate: this.getQuotaResetDate(),
            isQuotaExhausted: sql`CASE WHEN COALESCE(zuvy_student_booking_metrics.quota_used, 0) + 1 >= 3 THEN true ELSE false END`,
          } as Partial<typeof zuvyStudentBookingMetrics.$inferInsert>,
        });

      await this.notificationService.createNotification({
        userId: mentorProfile.mentorUserId,
        type: NotificationType.BOOKING_CREATED,
        title: 'New mentorship booking',
        message: ``,
        referenceId: createdBooking.id,
        referenceType: 'booking',
      });

      await this.notificationService.createNotification({
        userId: BigInt(studentId),
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Session confirmed',
        message: ``,
        referenceId: createdBooking.id,
        referenceType: 'booking',
      });

      /* ========================================
   FETCH EMAILS (FIXED)
======================================== */

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

      const mentorEmail = mentorUser?.email;
      const studentEmail = studentUser?.email;

      if (!mentorEmail) {
        throw new BadRequestException('Mentor email not found.');
      }

      const refreshToken = mentorProfile.googleRefreshToken;

      const slotStartDateTime = new Date(slot.slotStartDateTime);
      const slotEndDateTime = new Date(slot.slotEndDateTime);

      /* ========================================
   CREATE ZOOM MEETING
======================================== */

      let meeting: {
        joinUrl?: string;
        startUrl?: string;
        password?: string;
        meetingId?: string;
        uuid?: string;
      } = {};

      /* Create Zoom Meeting */
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
          throw new Error(
            `Failed to create Zoom meeting: ${zoomResponse.error}`,
          );
        }

        // Fetch UUID explicitly
        const meetingDetails = await this.zoomService.getMeeting(
          zoomResponse.data.id.toString(),
        );

        if (!meetingDetails.success || !meetingDetails.data?.uuid) {
          throw new Error('Failed to fetch Zoom meeting UUID');
        }

        meeting = {
          joinUrl: zoomResponse.data.join_url,
          startUrl: zoomResponse.data.start_url,
          password: zoomResponse.data.password,
          meetingId: zoomResponse.data.id.toString(),
          uuid: meetingDetails.data.uuid,
        };
      } catch (error) {
        console.error('Zoom meeting creation failed:', error.message);

        const errMsg = error?.message || '';

        if (error instanceof BadRequestException) {
          throw error;
        }

        /* ========================================
           HANDLE ZOOM USER NOT FOUND / NOT LICENSED
        ======================================== */

        if (
          errMsg.includes('User does not exist') ||
          errMsg.includes('does not exist')
        ) {
          throw new BadRequestException(
            'This mentor is not available for booking right now. Please try another mentor.',
          );
        }

        if (
          errMsg.includes('not licensed') ||
          errMsg.includes('No permission')
        ) {
          throw new BadRequestException(
            'This mentor is not fully set up for sessions yet. Please choose another mentor.',
          );
        }

        /* ========================================
           FALLBACK ERROR
        ======================================== */

        throw new BadRequestException(
          'Unable to schedule session at the moment. Please try again later.',
        );
      }
      /* ========================================
    SAVE MEETING DATA
 ======================================== */

      await trx
        .update(zuvyMentorSlotBooking)
        .set({
          meetingLink: meeting?.joinUrl ?? null,
          isZoomMeet: true,
          zoomStartUrl: meeting?.startUrl ?? null,
          zoomPassword: meeting?.password ?? null,
          zoomMeetingId: meeting?.meetingId ?? null,
          zoomMeetingUuid: meeting?.uuid ?? null,
        } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
        .where(eq(zuvyMentorSlotBooking.id, createdBooking.id));

      // Enqueue recording job
      await this.enqueueMentorRecordingJob({
        id: createdBooking.id,
        zoomMeetingId: meeting?.meetingId ?? null,
        zoomMeetingUuid: meeting?.uuid ?? null,
        isZoomMeet: true,
      });

      // Fetch updated metrics for response
      const [updatedMetrics] = await trx
        .select()
        .from(zuvyStudentBookingMetrics)
        .where(eq(zuvyStudentBookingMetrics.userId, BigInt(studentId)))
        .limit(1);

      const bookingResponse = {
        ...createdBooking,
        // student-safe link
        meetingLink: meeting.joinUrl,
        // mentor-only link
        mentorJoinLink: meeting.startUrl,
        remainingCredits: updatedMetrics ? 3 - updatedMetrics.quotaUsed : 2,
        nextEligible: updatedMetrics?.cooldownEndDate,
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
          'team@zuvy.org',
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
        .catch((err) => console.error(`team email failed: ${err.message}`));

      return bookingResponse;
    });
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

    return db.transaction(async (trx) => {
      const [booking] = await trx
        .select()
        .from(zuvyMentorSlotBooking)
        .where(eq(zuvyMentorSlotBooking.id, bookingId))
        .limit(1);

      if (!booking) {
        throw new NotFoundException('Booking not found.');
      }

      /* Prevent double cancellation */

      if (booking.status === 'cancelled') {
        throw new BadRequestException('Booking already cancelled.');
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

      await trx
        .update(zuvyMentorSlotBooking)
        .set({
          status: 'cancelled',
          sessionLifecycleState: 'CANCELLED',
          cancellationReason: reason,
          cancelledBy,
          cancelledAt: new Date(),
        } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
        .where(eq(zuvyMentorSlotBooking.id, bookingId));

      await this.notificationService.createNotification({
        userId: booking.studentUserId,
        type: NotificationType.BOOKING_CANCELLED,
        title: 'Session cancelled',
        message: ``,
        referenceId: bookingId,
        referenceType: 'booking',
      });

      await this.notificationService.createNotification({
        userId: booking.mentorUserId,
        type: NotificationType.BOOKING_CANCELLED,
        title: 'Session cancelled',
        message: ``,
        referenceId: bookingId,
        referenceType: 'booking',
      });

      const [mentorProfile] = await trx
        .select()
        .from(zuvyMentorSlotManagement)
        .where(eq(zuvyMentorSlotManagement.mentorUserId, booking.mentorUserId))
        .limit(1);

      const refreshToken = mentorProfile?.googleRefreshToken;

      if (booking.googleEventId && refreshToken) {
        await this.googleCalendarService.deleteMeeting(
          booking.googleEventId,
          refreshToken,
        );
      }

      const { quotaStart, quotaEnd } = this.getQuotaWindow();

      const [{ count: totalBookings }] = await trx
        .select({ count: count() })
        .from(zuvyMentorSlotBooking)
        .where(
          and(
            eq(zuvyMentorSlotBooking.studentUserId, booking.studentUserId),
            ne(zuvyMentorSlotBooking.status, 'cancelled'),
          ),
        );

      if (Number(totalBookings) === 0) {
        await trx
          .delete(zuvyStudentBookingMetrics)
          .where(eq(zuvyStudentBookingMetrics.userId, booking.studentUserId));
      } else {
        const [{ count: quotaUsed }] = await trx
          .select({ count: count() })
          .from(zuvyMentorSlotBooking)
          .where(
            and(
              eq(zuvyMentorSlotBooking.studentUserId, booking.studentUserId),
              ne(zuvyMentorSlotBooking.status, 'cancelled'),
              gte(zuvyMentorSlotBooking.confirmedAt, quotaStart),
              lte(zuvyMentorSlotBooking.confirmedAt, quotaEnd),
            ),
          );

        const [lastBooking] = await trx
          .select({ confirmedAt: zuvyMentorSlotBooking.confirmedAt })
          .from(zuvyMentorSlotBooking)
          .where(
            and(
              eq(zuvyMentorSlotBooking.studentUserId, booking.studentUserId),
              ne(zuvyMentorSlotBooking.status, 'cancelled'),
            ),
          )
          .orderBy(desc(zuvyMentorSlotBooking.confirmedAt))
          .limit(1);

        const lastBookingDate = lastBooking?.confirmedAt;
        const cooldownEndDate = lastBookingDate
          ? new Date(lastBookingDate.getTime() + 21 * 24 * 60 * 60 * 1000)
          : null;

        await trx
          .insert(zuvyStudentBookingMetrics)
          .values({
            userId: booking.studentUserId,
            totalBookings: Number(totalBookings),
            quotaUsed: Number(quotaUsed),
            lastBookingDate,
            cooldownEndDate,
            quotaResetDate: this.getQuotaResetDate(),
            isQuotaExhausted: Number(quotaUsed) >= 3,
          } as typeof zuvyStudentBookingMetrics.$inferInsert)
          .onConflictDoUpdate({
            target: zuvyStudentBookingMetrics.userId,
            set: {
              totalBookings: Number(totalBookings),
              quotaUsed: Number(quotaUsed),
              lastBookingDate,
              cooldownEndDate,
              isQuotaExhausted: Number(quotaUsed) >= 3,
              updatedAt: new Date(),
            } as Partial<typeof zuvyStudentBookingMetrics.$inferInsert>,
          });
      }

      return {
        message: 'Booking cancelled successfully.',
      };
    });
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

    await db
      .update(zuvyMentorSlotBooking)
      .set({
        rescheduleStatus: 'pending',
        rescheduleRequestedAt: new Date(),
        rescheduleProposedSlotId: newSlotId,
        sessionLifecycleState: 'RESCHEDULE_PENDING',
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(eq(zuvyMentorSlotBooking.id, bookingId));

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
          sql`${zuvyMentorSlotAvailability.slotStartDateTime} > NOW()`,
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
     AUTO LOCK FEEDBACK (CALLED BY JOB)
  ========================================================================== */

  async lockExpiredFeedback() {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return db
      .update(zuvyMentorSlotBooking)
      .set({ mentorFeedbackLocked: true } as Partial<
        typeof zuvyMentorSlotBooking.$inferInsert
      >)
      .where(
        and(
          lt(zuvyMentorSlotBooking.mentorFeedbackSubmittedAt, cutoff),
          eq(zuvyMentorSlotBooking.mentorFeedbackLocked, false),
        ),
      );
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

    return db.transaction(async (trx) => {
      const [booking] = await trx
        .select()
        .from(zuvyMentorSlotBooking)
        .where(eq(zuvyMentorSlotBooking.id, bookingId))
        .limit(1);

      if (!booking) {
        throw new NotFoundException('Booking not found.');
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

      await this.ensureMentorSlotLicenseAssignment(
        trx,
        proposedSlot,
        mentorProfile,
      );

      /* Atomic capacity check + increment */

      const updated = await trx
        .update(zuvyMentorSlotAvailability)
        .set({
          currentBookedCount: sql`${zuvyMentorSlotAvailability.currentBookedCount} + 1`,
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

      await trx
        .update(zuvyMentorSlotAvailability)
        .set({
          currentBookedCount: sql`${zuvyMentorSlotAvailability.currentBookedCount} - 1`,
        } as Partial<typeof zuvyMentorSlotAvailability.$inferInsert>)
        .where(eq(zuvyMentorSlotAvailability.id, booking.slotAvailabilityId));

      /* Move booking */

      await trx
        .update(zuvyMentorSlotBooking)
        .set({
          slotAvailabilityId: booking.rescheduleProposedSlotId,
          rescheduleStatus: null,
          rescheduleRequestedAt: null,
          rescheduleProposedSlotId: null,
          sessionLifecycleState: 'SCHEDULED',
          updatedAt: new Date(),
        } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
        .where(eq(zuvyMentorSlotBooking.id, bookingId));

      await this.notificationService.createNotification({
        userId: booking.studentUserId,
        type: NotificationType.RESCHEDULE_ACCEPTED,
        title: 'Reschedule accepted',
        message: '',
        referenceId: bookingId,
        referenceType: 'booking',
      });

      /* Update Google meeting time */

      if (booking.googleEventId) {
        const [newSlot] = await trx
          .select()
          .from(zuvyMentorSlotAvailability)
          .where(
            eq(zuvyMentorSlotAvailability.id, booking.rescheduleProposedSlotId),
          )
          .limit(1);

        const refreshToken = mentorProfile?.googleRefreshToken;

        if (booking.googleEventId && refreshToken) {
          await this.googleCalendarService.updateMeeting(
            booking.googleEventId,
            newSlot.slotStartDateTime,
            newSlot.slotEndDateTime,
            refreshToken,
          );
        }
      }
      return { message: 'Reschedule accepted successfully.' };
    });
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

    if (booking.rescheduleStatus !== 'pending')
      throw new BadRequestException('No pending reschedule.');

    await db
      .update(zuvyMentorSlotBooking)
      .set({
        rescheduleStatus: null,
        rescheduleRequestedAt: null,
        rescheduleProposedSlotId: null,
        sessionLifecycleState: 'SCHEDULED',
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(eq(zuvyMentorSlotBooking.id, bookingId));

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
      const licenseId = await this.zoomLicenseService.assignLicense(trx, {
        instructorId: userId,
        startTime: start,
        endTime: end,
      });

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

      await this.zoomLicenseService.createLicenseAssignment(trx, {
        licenseId,
        instructorId: userId,
        mentorSlotAvailabilityId: createdSlots[0].id,
        sourceType: 'mentor_slot',
        startTime: start,
        endTime: end,
      });

      return createdSlots;
    });
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
    await this.ensureMentorZoomAccountActive(userId, organizationId);

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

    return {
      booking: {
        ...booking,
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
      ...b,
      meetingLink: b.meetingLink,
    }));
  }

  async getStudentMetrics(
    userId: number,
    filter: 'all' | '30d' | '3m' = 'all',
  ) {
    const userIdBigInt = BigInt(userId);

    let [metrics] = await db
      .select()
      .from(zuvyStudentBookingMetrics)
      .where(eq(zuvyStudentBookingMetrics.userId, userIdBigInt))
      .limit(1);

    if (!metrics) {
      await this.initializeStudentMetrics(userIdBigInt);

      [metrics] = await db
        .select()
        .from(zuvyStudentBookingMetrics)
        .where(eq(zuvyStudentBookingMetrics.userId, userIdBigInt))
        .limit(1);
    }

    const now = new Date();

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

    const remainingCredits = Math.max(0, 3 - (metrics?.quotaUsed ?? 0));

    const canBook =
      !metrics?.isQuotaExhausted &&
      (!metrics?.cooldownEndDate || now >= metrics.cooldownEndDate);

    return {
      ...metrics,

      remainingCredits,

      canBook,

      nextEligible: metrics?.cooldownEndDate || null,

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

    if (mentorUserId) {
      await this.ensureMentorOwnsBooking(mentorUserId, bookingId);
    }

    const joinedAt = new Date(joinedAtStr);
    const leftAt = new Date(leftAtStr);

    if (leftAt <= joinedAt) {
      throw new BadRequestException('Invalid attendance range.');
    }

    const duration = Math.floor(
      (leftAt.getTime() - joinedAt.getTime()) / (1000 * 60),
    );

    return db
      .update(zuvyMentorSlotBooking)
      .set({
        joinedAt,
        leftAt,
        durationAttended: duration,
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(eq(zuvyMentorSlotBooking.id, bookingId));
  }

  async completeSession(bookingId: number, mentorUserId?: number) {
    await this.syncZoomLicenseState();

    if (mentorUserId) {
      await this.ensureMentorOwnsBooking(mentorUserId, bookingId);
    }

    return db
      .update(zuvyMentorSlotBooking)
      .set({
        completedAt: new Date(),
        sessionLifecycleState: 'COMPLETED',
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(eq(zuvyMentorSlotBooking.id, bookingId));
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

  private async enqueueMentorRecordingJob(booking: {
    id: number;
    zoomMeetingId: string | null;
    zoomMeetingUuid?: string | null;
    isZoomMeet: boolean;
  }) {
    if (!booking.isZoomMeet || !booking.zoomMeetingId) return;

    try {
      const recordingData = {
        mentorBookingId: booking.id,
        zoomMeetingId: booking.zoomMeetingId,
        zoomMeetingUuid: booking.zoomMeetingUuid ?? null,
        status: 'DISCOVERED',
      } as const;

      await db
        .insert(zuvyMentorSessionRecordings)
        .values(recordingData)
        .onConflictDoNothing();

      console.log(
        `Recording job enqueued for mentor booking ${booking.id}, meetingId: ${booking.zoomMeetingId}`,
      );
    } catch (error) {
      console.error(
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
