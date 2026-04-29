import { db } from '../src/db';
import {
  zuvyMentorSlotManagement,
  zuvyUserRolesAssigned,
  zuvyUserRoles,
} from '../drizzle/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  console.log('🔍 Syncing mentor table with instructor roles...');

  try {
    /* ========================================
1. GET ALL INSTRUCTORS (WITH ORG)
======================================== */

    const instructors = await db
      .select({
        userId: zuvyUserRolesAssigned.userId,
        organizationId: zuvyUserRolesAssigned.organizationId,
      })
      .from(zuvyUserRolesAssigned)
      .innerJoin(
        zuvyUserRoles,
        eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
      )
      .where(eq(zuvyUserRoles.name, 'instructor'));

    console.log(`✅ Found ${instructors.length} instructor role assignments`);

    /* ========================================
   2. FILTER VALID INSTRUCTORS (WITH ORG)
======================================== */

    const validInstructors = instructors.filter(
      (i) => i.organizationId !== null,
    );

    /* Deduplicate (userId -> organizationId) */
    const instructorMap = new Map<bigint, number>();

    for (const i of validInstructors) {
      if (!instructorMap.has(i.userId)) {
        instructorMap.set(i.userId, i.organizationId!);
      }
    }

    console.log(
      `✅ Valid instructors with organization: ${instructorMap.size}`,
    );

    const instructorIds = new Set(instructorMap.keys());

    /* ========================================
   3. GET EXISTING MENTORS
======================================== */

    const existingMentors = await db
      .select({
        mentorUserId: zuvyMentorSlotManagement.mentorUserId,
      })
      .from(zuvyMentorSlotManagement);

    const existingMentorIds = new Set(
      existingMentors.map((m) => m.mentorUserId),
    );

    /* ========================================
   4. INSERT MISSING INSTRUCTORS
======================================== */

    const missingMentors = [...instructorIds].filter(
      (id) => !existingMentorIds.has(id),
    );

    console.log(`➕ Adding ${missingMentors.length} missing mentors`);

    if (missingMentors.length > 0) {
      await db.insert(zuvyMentorSlotManagement).values(
        missingMentors.map((userId) => ({
          mentorUserId: userId,
          organizationId: instructorMap.get(userId)!, // ✅ guaranteed
          bio: null,
          expertise: [],
          title: null,
          isVerified: false,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
    }

    /* ========================================
   5. DELETE NON-INSTRUCTOR MENTORS
======================================== */

    const nonInstructorMentors = existingMentors
      .map((m) => m.mentorUserId)
      .filter((id) => !instructorIds.has(id));

    console.log(`🗑 Removing ${nonInstructorMentors.length} invalid mentors`);

    if (nonInstructorMentors.length > 0) {
      await db
        .delete(zuvyMentorSlotManagement)
        .where(
          inArray(zuvyMentorSlotManagement.mentorUserId, nonInstructorMentors),
        );
    }

    console.log('🎉 Mentor table successfully synced with instructors');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

main();
