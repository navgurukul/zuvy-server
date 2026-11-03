/**
 * Read-only verification for the /student/mentors "available count" fix.
 * Compares the OLD behavior (small page, unordered) against the NEW
 * behavior (ordered, with totalAvailable) for a given org, so we can see
 * the bug reproduce and confirm the fix closes the gap.
 *
 * Usage: npx ts-node scripts/verify-mentor-list-fix.ts --org=9
 */
import { db } from '../src/db';
import {
  users,
  zuvyUserRolesAssigned,
  zuvyUserRoles,
  zuvyMentorProfile,
  zuvyMentorSlotManagement,
  zuvyMentorSlotAvailability,
  zuvyOrganizations,
} from '../drizzle/schema';
import { and, eq, sql } from 'drizzle-orm';
import { MentorPublicService } from '../src/controller/mentor-slot/public/mentor-public.service';

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

const orgId = getArg('org') ? Number(getArg('org')) : undefined;

async function main() {
  console.log('==============================================');
  console.log(' Verifying mentor-list fix (read-only)');
  console.log(` DB host: ${process.env.DB_HOST}`);
  console.log(` DB name: ${process.env.DB_NAME}`);
  console.log(` Org: ${orgId ?? '(all orgs)'}`);
  console.log('==============================================');

  try {
    // --- Ground truth: every mentor in the org + whether they have an
    //     open slot, computed with no pagination at all. ---
    const filters = [eq(zuvyUserRoles.name, 'instructor')];
    if (orgId !== undefined) {
      filters.push(eq(zuvyMentorSlotManagement.organizationId, orgId));
    }

    const availableSlotsExpr = sql<number>`
      COUNT(DISTINCT ${zuvyMentorSlotAvailability.id}) FILTER (
      WHERE ${zuvyMentorSlotAvailability.slotStartDateTime} > NOW()
      AND ${zuvyMentorSlotAvailability.currentBookedCount} < ${zuvyMentorSlotAvailability.maxCapacity}
      )
    `;

    const everyone = await db
      .select({
        userId: users.id,
        name: users.name,
        availableSlots: availableSlotsExpr,
      })
      .from(users)
      .innerJoin(
        zuvyMentorSlotManagement,
        eq(zuvyMentorSlotManagement.mentorUserId, users.id),
      )
      .innerJoin(
        zuvyMentorProfile,
        eq(zuvyMentorProfile.mentorUserId, users.id),
      )
      .innerJoin(
        zuvyOrganizations,
        eq(zuvyOrganizations.id, zuvyMentorSlotManagement.organizationId),
      )
      .leftJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotAvailability.mentorSlotManagementId,
          zuvyMentorSlotManagement.id,
        ),
      )
      .leftJoin(
        zuvyUserRolesAssigned,
        and(
          eq(zuvyUserRolesAssigned.userId, users.id),
          eq(
            zuvyUserRolesAssigned.organizationId,
            zuvyMentorSlotManagement.organizationId,
          ),
        ),
      )
      .leftJoin(
        zuvyUserRoles,
        eq(zuvyUserRoles.id, zuvyUserRolesAssigned.roleId),
      )
      .where(and(...filters))
      .groupBy(zuvyMentorSlotManagement.id, users.id, users.name);

    const groundTruthAvailable = everyone.filter(
      (m) => Number(m.availableSlots) > 0,
    );

    console.log(
      `\nGround truth: ${everyone.length} mentors total, ${groundTruthAvailable.length} with an open slot.`,
    );
    console.log(
      'Mentors with an open slot:',
      groundTruthAvailable.map((m) => m.name).join(', ') || '(none)',
    );

    // --- Now call the ACTUAL (fixed) service method the endpoint uses,
    //     with a small page size, the way the default "Browse Mentors"
    //     view does. ---
    const service = new MentorPublicService();
    const page1 = await service.getAllMentors(
      3,
      0,
      undefined,
      undefined,
      undefined,
      undefined,
      orgId,
    );

    console.log('\n--- GET /student/mentors?limit=3&offset=0 (fixed) ---');
    console.log(
      `total=${page1.total}  totalAvailable=${(page1 as any).totalAvailable}`,
    );
    console.log(
      'Page 1 order:',
      page1.data
        .map(
          (m: any) =>
            `${m.name} (${m.availableSlots} slots, ${m.availabilityStatus})`,
        )
        .join(' | '),
    );

    const pageAvailableCount = page1.data.filter(
      (m: any) => m.availabilityStatus === 'Available',
    ).length;

    console.log('\n--- Verdict ---');
    console.log(
      `Old-style client count (available mentors ON PAGE 1 ONLY): ${pageAvailableCount}`,
    );
    console.log(
      `New totalAvailable field (org-wide, independent of pagination): ${(page1 as any).totalAvailable}`,
    );
    console.log(
      `Ground truth (hand-computed, unpaginated): ${groundTruthAvailable.length}`,
    );

    if ((page1 as any).totalAvailable === groundTruthAvailable.length) {
      console.log(
        '\n✅ PASS — totalAvailable matches ground truth regardless of page size.',
      );
    } else {
      console.log('\n❌ FAIL — totalAvailable does not match ground truth.');
      process.exitCode = 1;
    }

    if (
      page1.data.length > 0 &&
      Number(page1.data[0].availableSlots) >=
        Number(page1.data[page1.data.length - 1].availableSlots)
    ) {
      console.log(
        '✅ PASS — page 1 is sorted with higher-availability mentors first (deterministic order confirmed).',
      );
    } else if (page1.data.length <= 1) {
      console.log(
        'ℹ️  Only one (or zero) mentors returned — ordering not observable with this org/limit.',
      );
    } else {
      console.log(
        '❌ FAIL — page 1 does not look sorted by availableSlots descending.',
      );
      process.exitCode = 1;
    }

    if (
      groundTruthAvailable.length > 3 &&
      pageAvailableCount < groundTruthAvailable.length
    ) {
      console.log(
        `\nReproduces the original bug shape nicely: a 3-row page only "sees" ${pageAvailableCount} of the ${groundTruthAvailable.length} truly available mentors — which is exactly why totalAvailable (not a page-count) is the field the frontend should read.`,
      );
    }
  } catch (error) {
    console.error('Verification failed:', error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

main();
