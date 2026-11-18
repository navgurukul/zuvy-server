/**
 * One-off clean-up for the "reserve a Zoom licence only at booking" change.
 *
 * Mentor slots used to reserve a licence when they were created, so every open
 * slot blocked a licence for classes. New slots no longer do that; this script
 * frees the licences that existing open slots still hold.
 *
 * It removes `mentor_slot` licence assignments for slots that
 *   - start in the future, and
 *   - have no booking that isn't cancelled.
 * Booked slots, past slots and class sessions are never touched. A slot freed
 * here gets a licence again when a student books it.
 *
 * Dry run by default: prints what it would remove and changes nothing.
 *
 * Usage:
 *   npx ts-node scripts/release-unbooked-mentor-slot-licences.ts           # dry run
 *   npx ts-node scripts/release-unbooked-mentor-slot-licences.ts --apply   # delete
 *   ... --slot-ids=12,15   # only these slots (still only if unbooked and future)
 */
import { db } from '../src/db';
import {
  licenseAssignments,
  users,
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
  zuvyMentorSlotManagement,
} from '../drizzle/schema';
import { and, eq, gt, inArray, ne, notExists, sql } from 'drizzle-orm';

const apply = process.argv.includes('--apply');
const slotIdsArg = process.argv.find((a) => a.startsWith('--slot-ids='));
const onlySlotIds = slotIdsArg
  ? slotIdsArg
      .slice('--slot-ids='.length)
      .split(',')
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isInteger(id) && id > 0)
  : null;
if (slotIdsArg && !onlySlotIds?.length) {
  console.error('--slot-ids needs a comma-separated list of slot ids.');
  process.exit(1);
}

function findUnbookedFutureSlotAssignments(executor: any) {
  return executor
    .select({
      assignmentId: licenseAssignments.id,
      slotId: zuvyMentorSlotAvailability.id,
      mentorEmail: users.email,
      slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
      slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
      slotStatus: zuvyMentorSlotAvailability.status,
    })
    .from(licenseAssignments)
    .innerJoin(
      zuvyMentorSlotAvailability,
      eq(
        zuvyMentorSlotAvailability.id,
        licenseAssignments.mentorSlotAvailabilityId,
      ),
    )
    .innerJoin(
      zuvyMentorSlotManagement,
      eq(
        zuvyMentorSlotManagement.id,
        zuvyMentorSlotAvailability.mentorSlotManagementId,
      ),
    )
    .innerJoin(users, eq(users.id, zuvyMentorSlotManagement.mentorUserId))
    .where(
      and(
        eq(licenseAssignments.sourceType, 'mentor_slot'),
        gt(zuvyMentorSlotAvailability.slotStartDateTime, new Date()),
        onlySlotIds
          ? inArray(zuvyMentorSlotAvailability.id, onlySlotIds)
          : undefined,
        notExists(
          executor
            .select({ one: sql`1` })
            .from(zuvyMentorSlotBooking)
            .where(
              and(
                eq(
                  zuvyMentorSlotBooking.slotAvailabilityId,
                  zuvyMentorSlotAvailability.id,
                ),
                ne(zuvyMentorSlotBooking.status, 'cancelled'),
              ),
            ),
        ),
      ),
    )
    .orderBy(zuvyMentorSlotAvailability.slotStartDateTime);
}

async function main() {
  console.log(
    apply
      ? 'APPLY: removing licence holds from unbooked future mentor slots.'
      : 'DRY RUN: nothing will be changed. Pass --apply to remove these holds.',
  );

  const removed = await db.transaction(async (trx) => {
    // Same lock every licence allocation takes, so nothing books one of
    // these slots between the read and the delete.
    await trx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('zuvy_zoom_license_pool'))`,
    );

    const rows = await findUnbookedFutureSlotAssignments(trx);

    console.table(
      rows.map((row) => ({
        assignment: Number(row.assignmentId),
        slot: row.slotId,
        mentor: row.mentorEmail,
        start: new Date(row.slotStart).toISOString(),
        end: new Date(row.slotEnd).toISOString(),
        status: row.slotStatus,
      })),
    );
    console.log(`${rows.length} licence hold(s) on unbooked future slots.`);

    if (!apply || rows.length === 0) return 0;

    const deleted = await trx
      .delete(licenseAssignments)
      .where(
        inArray(
          licenseAssignments.id,
          rows.map((row) => row.assignmentId),
        ),
      )
      .returning({ id: licenseAssignments.id });

    return deleted.length;
  });

  if (apply) {
    console.log(`Removed ${removed} licence hold(s).`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
