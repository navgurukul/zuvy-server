import { db } from '../src/db';
import {
  zuvyMentorSlotManagement,
  zuvyUserRolesAssigned,
  zuvyUserRoles,
} from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Script to identify and handle mentor profiles for users who are not instructors.
 * Going forward, only instructors should have mentor access.
 *
 * Run with: npx ts-node scripts/validate-mentor-roles.ts [deactivate]
 * If 'deactivate' is passed as argument, it will deactivate non-instructor mentor profiles.
 */

async function main() {
  const shouldDeactivate = process.argv[2] === 'deactivate';

  console.log('Starting mentor role validation script...');
  if (shouldDeactivate) {
    console.log(
      'DEACTIVATE MODE: Will deactivate non-instructor mentor profiles',
    );
  }

  try {
    // Get all mentor profiles
    const mentorProfiles = await db
      .select({
        mentorUserId: zuvyMentorSlotManagement.mentorUserId,
        isVerified: zuvyMentorSlotManagement.isVerified,
        status: zuvyMentorSlotManagement.status,
      })
      .from(zuvyMentorSlotManagement);

    console.log(`Found ${mentorProfiles.length} mentor profiles`);

    // Get all instructor role assignments
    const instructorAssignments = await db
      .select({
        userId: zuvyUserRolesAssigned.userId,
      })
      .from(zuvyUserRolesAssigned)
      .innerJoin(
        zuvyUserRoles,
        eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
      )
      .where(eq(zuvyUserRoles.name, 'instructor'));

    const instructorUserIds = new Set(
      instructorAssignments.map((a) => a.userId),
    );

    console.log(`Found ${instructorUserIds.size} users with instructor role`);

    // Find mentors who are not instructors
    const nonInstructorMentors = mentorProfiles.filter(
      (profile) => !instructorUserIds.has(profile.mentorUserId),
    );

    console.log(
      `Found ${nonInstructorMentors.length} mentor profiles for non-instructor users:`,
    );

    for (const mentor of nonInstructorMentors) {
      console.log(
        `- User ID: ${mentor.mentorUserId}, Verified: ${mentor.isVerified}, Status: ${mentor.status}`,
      );
    }

    if (nonInstructorMentors.length > 0) {
      console.log(
        '\nThese mentor profiles belong to users without instructor role.',
      );
      console.log('Please review and take appropriate action:');
      console.log(
        '1. Assign instructor role to these users if they should remain mentors',
      );
      console.log(
        '2. Or run this script with "deactivate" argument to deactivate their profiles',
      );

      if (shouldDeactivate) {
        console.log(
          '\nDeactivating mentor profiles for non-instructor users...',
        );

        for (const mentor of nonInstructorMentors) {
          await db
            .update(zuvyMentorSlotManagement)
            .set({
              status: 'inactive',
              updatedAt: new Date(),
            } as Partial<typeof zuvyMentorSlotManagement.$inferInsert>)
            .where(
              eq(zuvyMentorSlotManagement.mentorUserId, mentor.mentorUserId),
            );

          console.log(
            `Deactivated mentor profile for user ${mentor.mentorUserId}`,
          );
        }

        console.log('Deactivation complete.');
      }
    } else {
      console.log(
        'All mentor profiles belong to instructor users. No action needed.',
      );
    }
  } catch (error) {
    console.error('Error running script:', error);
  } finally {
    process.exit(0);
  }
}

main();
