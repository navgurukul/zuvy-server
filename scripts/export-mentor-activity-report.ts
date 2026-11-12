/**
 * Read-only export: every mentor slot created, every booking on it, and
 * recording status — across all instructors, for every org.
 *
 * This is an updated, month-wise version of the one-off report generated
 * earlier (docs/mentor-activity-report-2026-10-20T*). Same row shape, same
 * CSV columns, so it can be diffed against the earlier snapshot — plus a
 * new month-by-month summary table so ops can see the trend, not just the
 * cumulative total.
 *
 * Usage: npx ts-node scripts/export-mentor-activity-report.ts [--out-dir=docs]
 */
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../src/db';
import {
  users,
  zuvyOrganizations,
  zuvyMentorSlotManagement,
  zuvyMentorProfile,
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
  zuvyMentorSessionRecordings,
} from '../drizzle/schema';
import { eq, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

function getArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const outDir = getArg('out-dir', 'docs');

interface Row {
  mentor_id: string;
  mentor_name: string;
  mentor_email: string;
  organization_id: number;
  organization_name: string;
  slot_id: number | '';
  slot_start: string;
  slot_end: string;
  duration_minutes: number | '';
  slot_status: string; // effective: raw status, but 'available' past slot_start becomes 'past (unbooked)'
  slot_status_raw: string; // verbatim zuvy_mentor_slot_availability.status, for auditing
  max_capacity: number | '';
  current_booked_count: number | '';
  booking_id: number | '';
  booking_status: string;
  session_lifecycle_state: string;
  student_id: string;
  student_name: string;
  student_email: string;
  booked_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  mentor_rating: number | null;
  student_rating: number | null;
  recording_count: number | '';
  recording_status: string;
  recording_link: string;
  recording_last_error: string;
  month: string; // YYYY-MM bucket, derived from slot_start (or booked_at if no slot)
}

async function main() {
  console.log('==============================================');
  console.log(' Exporting mentor activity report (read-only)');
  console.log(` DB host: ${process.env.DB_HOST}`);
  console.log(` DB name: ${process.env.DB_NAME}`);
  console.log('==============================================');

  const studentUsers = alias(users, 'student_users');

  // One row per (mentor-org record) x (slot) x (booking), left-joined all
  // the way down so mentors with no slots, and slots with no bookings,
  // still show up with blank trailing columns — same shape as the original
  // report.
  const base = await db
    .select({
      mentorId: users.id,
      mentorName: users.name,
      mentorEmail: users.email,
      organizationId: zuvyMentorSlotManagement.organizationId,
      organizationName: zuvyOrganizations.displayName,
      slotId: zuvyMentorSlotAvailability.id,
      slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
      slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
      durationMinutes: zuvyMentorSlotAvailability.durationMinutes,
      slotStatus: zuvyMentorSlotAvailability.status,
      maxCapacity: zuvyMentorSlotAvailability.maxCapacity,
      currentBookedCount: zuvyMentorSlotAvailability.currentBookedCount,
      bookingId: zuvyMentorSlotBooking.id,
      bookingStatus: zuvyMentorSlotBooking.status,
      sessionLifecycleState: zuvyMentorSlotBooking.sessionLifecycleState,
      studentId: studentUsers.id,
      studentName: studentUsers.name,
      studentEmail: studentUsers.email,
      bookedAt: zuvyMentorSlotBooking.bookedAt,
      completedAt: zuvyMentorSlotBooking.completedAt,
      cancelledAt: zuvyMentorSlotBooking.cancelledAt,
      cancellationReason: zuvyMentorSlotBooking.cancellationReason,
      mentorRating: zuvyMentorSlotBooking.mentorRating,
      studentRating: zuvyMentorSlotBooking.studentRating,
    })
    .from(users)
    .innerJoin(
      zuvyMentorSlotManagement,
      eq(zuvyMentorSlotManagement.mentorUserId, users.id),
    )
    .innerJoin(zuvyMentorProfile, eq(zuvyMentorProfile.mentorUserId, users.id))
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
      zuvyMentorSlotBooking,
      eq(
        zuvyMentorSlotBooking.slotAvailabilityId,
        zuvyMentorSlotAvailability.id,
      ),
    )
    .leftJoin(
      studentUsers,
      eq(studentUsers.id, zuvyMentorSlotBooking.studentUserId),
    )
    .orderBy(
      asc(users.name),
      asc(zuvyMentorSlotManagement.organizationId),
      asc(zuvyMentorSlotAvailability.slotStartDateTime),
    );

  // Recordings fetched separately and grouped in JS (a booking can have more
  // than one recording row across retries) rather than joined, so the count
  // and "best" status are unambiguous.
  const recordings = await db
    .select({
      mentorBookingId: zuvyMentorSessionRecordings.mentorBookingId,
      status: zuvyMentorSessionRecordings.status,
      driveLink: zuvyMentorSessionRecordings.driveLink,
      lastError: zuvyMentorSessionRecordings.lastError,
    })
    .from(zuvyMentorSessionRecordings);

  const recordingsByBooking = new Map<number, typeof recordings>();
  for (const r of recordings) {
    const list = recordingsByBooking.get(r.mentorBookingId) ?? [];
    list.push(r);
    recordingsByBooking.set(r.mentorBookingId, list);
  }

  // zuvy_mentor_slot_availability.status is a pure booking-state flag
  // (available/full/cancelled) that is set on create/book/cancel and never
  // re-checked once slot_start_date_time passes — confirmed by reading
  // mentor-slot.service.ts (createSlot, bookSlot, cancelBooking) and every
  // @Cron job in mentor-slot.job.ts: none of them touch this column based on
  // time. The public mentor listing (mentor-public.service.ts) already
  // works around this by filtering `slotStartDateTime > NOW()` directly in
  // SQL instead of trusting the stored status. We do the same here so the
  // report doesn't show long-past, never-booked slots as "available".
  const now = new Date();
  function effectiveSlotStatus(
    rawStatus: string | null,
    slotStart: unknown,
  ): string {
    if (!rawStatus) return '';
    if (rawStatus !== 'available') return rawStatus;
    if (slotStart && new Date(slotStart as any) <= now)
      return 'past (unbooked)';
    return 'available';
  }

  function monthOf(dateStr: string | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  const rows: Row[] = base.map((r) => {
    const bookingRecordings = r.bookingId
      ? (recordingsByBooking.get(r.bookingId) ?? [])
      : [];
    const best =
      bookingRecordings.find((rec) => rec.status === 'COMPLETED') ??
      bookingRecordings[0];

    return {
      mentor_id: String(r.mentorId),
      mentor_name: r.mentorName,
      mentor_email: r.mentorEmail ?? '',
      organization_id: r.organizationId,
      organization_name: r.organizationName,
      slot_id: r.slotId ?? '',
      slot_start: r.slotStart ? new Date(r.slotStart as any).toISOString() : '',
      slot_end: r.slotEnd ? new Date(r.slotEnd as any).toISOString() : '',
      duration_minutes: r.durationMinutes ?? '',
      slot_status: effectiveSlotStatus(r.slotStatus, r.slotStart),
      slot_status_raw: r.slotStatus ?? '',
      max_capacity: r.maxCapacity ?? '',
      current_booked_count: r.currentBookedCount ?? '',
      booking_id: r.bookingId ?? '',
      booking_status: r.bookingStatus ?? '',
      session_lifecycle_state: r.sessionLifecycleState ?? '',
      student_id: r.studentId ? String(r.studentId) : '',
      student_name: r.studentName ?? '',
      student_email: r.studentEmail ?? '',
      booked_at: r.bookedAt ? new Date(r.bookedAt as any).toISOString() : '',
      completed_at: r.completedAt
        ? new Date(r.completedAt as any).toISOString()
        : null,
      cancelled_at: r.cancelledAt
        ? new Date(r.cancelledAt as any).toISOString()
        : null,
      cancellation_reason: r.cancellationReason,
      mentor_rating: r.mentorRating,
      student_rating: r.studentRating,
      recording_count: bookingRecordings.length || (r.bookingId ? 0 : ''),
      recording_status: best?.status ?? '',
      recording_link: best?.driveLink ?? '',
      recording_last_error: best?.lastError ?? '',
      month: monthOf(
        r.slotStart ? new Date(r.slotStart as any).toISOString() : null,
      ),
    };
  });

  // ---- Top tiles ----
  const mentorOrgRecords = new Set(
    rows.map((r) => `${r.mentor_id}:${r.organization_id}`),
  );
  const mentorsWithSlots = new Set(
    rows
      .filter((r) => r.slot_id !== '')
      .map((r) => `${r.mentor_id}:${r.organization_id}`),
  );
  const slotsCreated = new Set(
    rows.filter((r) => r.slot_id !== '').map((r) => r.slot_id),
  ).size;
  const pastUnbookedSlots = new Set(
    rows
      .filter((r) => r.slot_status === 'past (unbooked)')
      .map((r) => r.slot_id),
  ).size;
  const bookingsMade = new Set(
    rows.filter((r) => r.booking_id !== '').map((r) => r.booking_id),
  ).size;
  const completed = rows.filter(
    (r) => r.session_lifecycle_state === 'COMPLETED',
  ).length;
  const cancelled = rows.filter(
    (r) =>
      r.booking_status === 'cancelled' ||
      r.session_lifecycle_state === 'CANCELLED',
  ).length;

  const completedRows = rows.filter(
    (r) => r.session_lifecycle_state === 'COMPLETED',
  );
  const recOk = completedRows.filter(
    (r) => r.recording_status === 'COMPLETED',
  ).length;
  const recFailed = completedRows.filter(
    (r) => r.recording_status && r.recording_status !== 'COMPLETED',
  ).length;
  const recMissing = completedRows.filter((r) => !r.recording_count).length;

  // ---- Month-by-month summary ----
  const monthKeys = Array.from(
    new Set(rows.map((r) => r.month).filter(Boolean)),
  ).sort();
  const monthly = monthKeys.map((month) => {
    const monthRows = rows.filter((r) => r.month === month);
    const mSlots = new Set(
      monthRows.filter((r) => r.slot_id !== '').map((r) => r.slot_id),
    ).size;
    const mMentors = new Set(monthRows.map((r) => r.mentor_id)).size;
    const mBookings = new Set(
      monthRows.filter((r) => r.booking_id !== '').map((r) => r.booking_id),
    ).size;
    const mCompleted = monthRows.filter(
      (r) => r.session_lifecycle_state === 'COMPLETED',
    ).length;
    const mCancelled = monthRows.filter(
      (r) =>
        r.booking_status === 'cancelled' ||
        r.session_lifecycle_state === 'CANCELLED',
    ).length;
    const mMissed = monthRows.filter(
      (r) => r.session_lifecycle_state === 'MISSED',
    ).length;
    const mCompletedRows = monthRows.filter(
      (r) => r.session_lifecycle_state === 'COMPLETED',
    );
    const mRecOk = mCompletedRows.filter(
      (r) => r.recording_status === 'COMPLETED',
    ).length;
    const mRecFailed = mCompletedRows.filter(
      (r) => r.recording_status && r.recording_status !== 'COMPLETED',
    ).length;
    const mRecMissing = mCompletedRows.filter((r) => !r.recording_count).length;
    return {
      month,
      slots: mSlots,
      activeMentors: mMentors,
      bookings: mBookings,
      completed: mCompleted,
      cancelled: mCancelled,
      missed: mMissed,
      recOk: mRecOk,
      recFailed: mRecFailed,
      recMissing: mRecMissing,
    };
  });

  // ---- Per-mentor summary (cumulative, unchanged shape from the original) ----
  type MentorKey = string;
  const mentorSummary = new Map<
    MentorKey,
    {
      name: string;
      email: string;
      org: string;
      slots: number;
      bookings: number;
      completed: number;
      recOk: number;
      recFailed: number;
      recMissing: number;
    }
  >();
  for (const r of rows) {
    const key = `${r.mentor_id}:${r.organization_id}`;
    if (!mentorSummary.has(key)) {
      mentorSummary.set(key, {
        name: r.mentor_name,
        email: r.mentor_email,
        org: r.organization_name,
        slots: 0,
        bookings: 0,
        completed: 0,
        recOk: 0,
        recFailed: 0,
        recMissing: 0,
      });
    }
    const s = mentorSummary.get(key)!;
    if (r.slot_id !== '') s.slots++;
    if (r.booking_id !== '') s.bookings++;
    if (r.session_lifecycle_state === 'COMPLETED') {
      s.completed++;
      if (r.recording_status === 'COMPLETED') s.recOk++;
      else if (r.recording_status) s.recFailed++;
      else s.recMissing++;
    }
  }

  console.log(`\nMentor · org records: ${mentorOrgRecords.size}`);
  console.log(`Have created a slot: ${mentorsWithSlots.size}`);
  console.log(`Slots created: ${slotsCreated}`);
  console.log(`Bookings made: ${bookingsMade}`);
  console.log(`Sessions completed: ${completed}`);
  console.log(`Bookings cancelled: ${cancelled}`);
  console.log(
    `Recordings — ok: ${recOk}, failed: ${recFailed}, missing: ${recMissing}`,
  );
  console.log(`\nMonths covered: ${monthKeys.join(', ') || '(none)'}`);

  // ---- Write CSV ----
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const csvHeader = [
    'mentor_id',
    'mentor_name',
    'mentor_email',
    'organization_id',
    'organization_name',
    'slot_id',
    'slot_start',
    'slot_end',
    'duration_minutes',
    'slot_status',
    'slot_status_raw',
    'max_capacity',
    'current_booked_count',
    'booking_id',
    'booking_status',
    'session_lifecycle_state',
    'student_id',
    'student_name',
    'student_email',
    'booked_at',
    'completed_at',
    'cancelled_at',
    'cancellation_reason',
    'mentor_rating',
    'student_rating',
    'recording_count',
    'recording_status',
    'recording_link',
    'recording_last_error',
    'month',
  ];
  function csvCell(v: any): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const csvLines = [csvHeader.join(',')];
  for (const r of rows) {
    csvLines.push(csvHeader.map((h) => csvCell((r as any)[h])).join(','));
  }
  const csvPath = path.join(outDir, `mentor-activity-report-${timestamp}.csv`);
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
  console.log(`\nCSV written to ${csvPath}`);

  // ---- Write HTML ----
  const htmlPath = path.join(
    outDir,
    `mentor-activity-report-${timestamp}.html`,
  );
  const html = renderHtml({
    generatedAt: new Date(),
    dbSource: `${process.env.DB_HOST} / ${process.env.DB_NAME}`,
    tiles: {
      mentorOrgRecords: mentorOrgRecords.size,
      mentorsWithSlots: mentorsWithSlots.size,
      slotsCreated,
      bookingsMade,
      completed,
      cancelled,
    },
    recording: { recOk, recFailed, recMissing },
    pastUnbookedSlots,
    monthly,
    mentorSummary: Array.from(mentorSummary.values()),
    rows,
  });
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`HTML written to ${htmlPath}`);
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function renderHtml(data: {
  generatedAt: Date;
  dbSource: string;
  tiles: Record<string, number>;
  recording: { recOk: number; recFailed: number; recMissing: number };
  pastUnbookedSlots: number;
  monthly: Array<{
    month: string;
    slots: number;
    activeMentors: number;
    bookings: number;
    completed: number;
    cancelled: number;
    missed: number;
    recOk: number;
    recFailed: number;
    recMissing: number;
  }>;
  mentorSummary: Array<{
    name: string;
    email: string;
    org: string;
    slots: number;
    bookings: number;
    completed: number;
    recOk: number;
    recFailed: number;
    recMissing: number;
  }>;
  rows: Row[];
}): string {
  const {
    generatedAt,
    dbSource,
    tiles,
    recording,
    pastUnbookedSlots,
    monthly,
    mentorSummary,
    rows,
  } = data;

  function esc(v: any): string {
    if (v === null || v === undefined) return '';
    return String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c] as string,
    );
  }

  const monthRowsHtml = monthly
    .map(
      (m) => `<tr>
    <td>${esc(monthLabel(m.month))}</td>
    <td class="num">${m.slots}</td>
    <td class="num">${m.activeMentors}</td>
    <td class="num">${m.bookings}</td>
    <td class="num">${m.completed}</td>
    <td class="num">${m.cancelled}</td>
    <td class="num">${m.missed}</td>
    <td class="num">${m.recOk ? `<span class="pill pill-done">${m.recOk} ok</span>` : ''}</td>
    <td class="num">${m.recFailed ? `<span class="pill pill-missing">${m.recFailed} failed</span>` : ''}</td>
    <td class="num">${m.recMissing ? `<span class="pill pill-partial">${m.recMissing} missing</span>` : ''}</td>
  </tr>`,
    )
    .join('');

  const mentorRowsHtml = mentorSummary
    .sort((a, b) => b.slots - a.slots)
    .map(
      (m) => `<tr>
    <td>${esc(m.name)}</td>
    <td class="mono dim">${esc(m.email)}</td>
    <td>${esc(m.org)}</td>
    <td class="num">${m.slots}</td>
    <td class="num">${m.bookings}</td>
    <td class="num">${m.completed}</td>
    <td class="num">${m.recOk ? `<span class="pill pill-done">${m.recOk} ok</span>` : ''}</td>
    <td class="num">${m.recFailed ? `<span class="pill pill-missing">${m.recFailed} failed</span>` : ''}</td>
    <td class="num">${m.recMissing ? `<span class="pill pill-partial">${m.recMissing} missing</span>` : ''}</td>
  </tr>`,
    )
    .join('');

  const monthOptions = Array.from(
    new Set(rows.map((r) => r.month).filter(Boolean)),
  )
    .sort()
    .map((m) => `<option value="${m}">${esc(monthLabel(m))}</option>`)
    .join('');

  function statusPillJs() {
    return `function statusPill(state, bookingStatus) {
  if (!state) return '<span class="pill pill-neutral">no booking</span>';
  if (state === 'COMPLETED') return '<span class="pill pill-done">completed</span>';
  if (bookingStatus === 'cancelled' || state === 'CANCELLED') return '<span class="pill pill-missing">cancelled</span>';
  if (state === 'MISSED') return '<span class="pill pill-missing">missed</span>';
  return '<span class="pill pill-partial">' + state.toLowerCase() + '</span>';
}`;
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Mentor Activity Report</title>
<style>
:root{
  --bg:#eef1f2; --surface:#ffffff; --surface-2:#f5f8f8;
  --ink:#16212b; --ink-soft:#55636f; --ink-faint:#8a99a3;
  --line:#d7dee1; --line-soft:#e6ebed;
  --accent:#256b64; --accent-ink:#ffffff; --accent-soft:#e2f0ee; --accent-line:#bcdad5;
  --done:#2f7d4f; --done-soft:#e3f3e8; --done-line:#b9ddc4;
  --partial:#93650b; --partial-soft:#faf1de; --partial-line:#edd8ab;
  --missing:#b23a48; --missing-soft:#fbe9eb; --missing-line:#eec3c8;
  --shadow:0 1px 2px rgba(20,30,35,.06), 0 10px 28px -14px rgba(20,30,35,.18);
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#10161b; --surface:#182228; --surface-2:#1c262d;
    --ink:#e8edf0; --ink-soft:#a9b7c0; --ink-faint:#728089;
    --line:#2c3941; --line-soft:#212c33;
    --accent:#5cb8ac; --accent-ink:#07211d; --accent-soft:#173330; --accent-line:#2b5b53;
    --done:#5dc78c; --done-soft:#123322; --done-line:#285e3d;
    --partial:#dba646; --partial-soft:#33270e; --partial-line:#6b4f18;
    --missing:#e2707d; --missing-soft:#3a181c; --missing-line:#6e2a33;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 12px 32px -16px rgba(0,0,0,.6);
  }
}
*{box-sizing:border-box;}
body{ margin:0; background:var(--bg); color:var(--ink); font:15px/1.55 'Segoe UI', system-ui, -apple-system, sans-serif; }
.mono{ font-family:ui-monospace, Consolas, monospace; }
.dim{ color:var(--ink-faint); }
.wrap{ max-width:1180px; margin:0 auto; padding:36px 24px 80px; }
h1{ font-size:24px; margin:0 0 4px; }
h2{ font-size:16px; margin:0 0 14px; }
.subtitle{ color:var(--ink-soft); font-size:13.5px; margin-bottom:22px; }
.meta{ display:flex; gap:20px; flex-wrap:wrap; font-size:12px; color:var(--ink-faint); margin-bottom:28px; padding-bottom:18px; border-bottom:1px solid var(--line); }
.meta b{ color:var(--ink-soft); }

.tiles{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:28px; }
.tile{ background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:16px 18px; box-shadow:var(--shadow); }
.tile .n{ font-size:26px; font-weight:700; font-variant-numeric:tabular-nums; }
.tile .l{ font-size:11.5px; color:var(--ink-faint); text-transform:uppercase; letter-spacing:.04em; margin-top:2px; }

.callout{ background:var(--accent-soft); border:1px solid var(--accent-line); border-radius:10px; padding:16px 20px; margin-bottom:32px; font-size:13.5px; }
.callout ul{ margin:8px 0 0; padding-left:20px; }
.callout li{ margin-bottom:4px; }

section{ margin-bottom:36px; }
.table-wrap{ overflow-x:auto; border:1px solid var(--line); border-radius:10px; background:var(--surface); }
table{ width:100%; border-collapse:collapse; font-size:13px; min-width:640px; }
th{ text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-faint); background:var(--surface-2); padding:9px 12px; border-bottom:1px solid var(--line); white-space:nowrap; position:sticky; top:0; }
td{ padding:9px 12px; border-bottom:1px solid var(--line-soft); vertical-align:top; }
tr:last-child td{ border-bottom:none; }
.num{ font-variant-numeric:tabular-nums; text-align:right; }

.pill{ display:inline-block; font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px; border:1px solid; white-space:nowrap; }
.pill-done{ color:var(--done); background:var(--done-soft); border-color:var(--done-line); }
.pill-partial{ color:var(--partial); background:var(--partial-soft); border-color:var(--partial-line); }
.pill-missing{ color:var(--missing); background:var(--missing-soft); border-color:var(--missing-line); }
.pill-neutral{ color:var(--ink-faint); background:var(--surface-2); border-color:var(--line); }

.controls{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; align-items:center; }
.controls input[type=search]{ flex:1; min-width:220px; padding:8px 12px; border-radius:8px; border:1px solid var(--line); background:var(--surface); color:var(--ink); font-size:13px; }
.controls select{ padding:8px 12px; border-radius:8px; border:1px solid var(--line); background:var(--surface); color:var(--ink); font-size:13px; }
.chip{ font-size:12px; padding:6px 13px; border-radius:20px; border:1px solid var(--line); background:var(--surface); color:var(--ink-soft); cursor:pointer; }
.chip.active{ background:var(--accent); border-color:var(--accent); color:var(--accent-ink); }
.count{ font-size:12px; color:var(--ink-faint); margin-left:auto; }
tr.hide{ display:none; }
a{ color:var(--accent); }
</style>
</head>
<body>
<div class="wrap">
  <h1>Mentor Activity Report</h1>
  <p class="subtitle">Every slot created, every booking on it, and recording status — across all instructors, broken down month by month.</p>
  <div class="meta">
    <span><b>Generated</b> ${generatedAt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
    <span><b>Source</b> ${esc(dbSource)}</span>
  </div>

  <div class="tiles">
    <div class="tile"><div class="n">${tiles.mentorOrgRecords}</div><div class="l">Mentor · org records</div></div>
    <div class="tile"><div class="n">${tiles.mentorsWithSlots}</div><div class="l">Have created a slot</div></div>
    <div class="tile"><div class="n">${tiles.slotsCreated}</div><div class="l">Slots created</div></div>
    <div class="tile"><div class="n">${tiles.bookingsMade}</div><div class="l">Bookings made</div></div>
    <div class="tile"><div class="n">${tiles.completed}</div><div class="l">Sessions completed</div></div>
    <div class="tile"><div class="n">${tiles.cancelled}</div><div class="l">Bookings cancelled</div></div>
  </div>

  <div class="callout">
    <b>Recording health on completed sessions</b> — ${tiles.completed} sessions have actually run so far:
    <ul>
      <li><span class="pill pill-done">${recording.recOk} ok</span> — recording processed and playable</li>
      <li><span class="pill pill-missing">${recording.recFailed} failed</span> — a recording was attempted but permanently failed (check <code>recording_last_error</code> in the CSV)</li>
      <li><span class="pill pill-partial">${recording.recMissing} missing</span> — no recording row exists at all for a completed session</li>
    </ul>
  </div>

  <div class="callout">
    <b>Note on "Slot status"</b> — the slot's stored status (available/full/cancelled) is only updated when it's booked or cancelled; it is never time-expired in the backend, so a slot that nobody booked before its start time passed would otherwise still read "available" forever. This report corrects for that: any slot with status <code>available</code> whose start time has already passed is shown as <span class="pill pill-partial">past (unbooked)</span> instead. Currently <b>${pastUnbookedSlots}</b> slots fall into that bucket. The raw, uncorrected status is still kept in the CSV as <code>slot_status_raw</code> for auditing.
  </div>

  <section>
    <h2>Month by month</h2>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Month</th><th class="num">Slots created</th><th class="num">Active mentors</th>
          <th class="num">Bookings</th><th class="num">Completed</th><th class="num">Cancelled</th><th class="num">Missed</th>
          <th>Recordings ok</th><th>Failed</th><th>Missing</th>
        </tr></thead>
        <tbody>${monthRowsHtml}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>Per-mentor summary (cumulative to date)</h2>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Mentor</th><th>Email</th><th>Org</th>
          <th class="num">Slots</th><th class="num">Bookings</th><th class="num">Completed</th>
          <th>Recordings ok</th><th>Failed</th><th>Missing</th>
        </tr></thead>
        <tbody>${mentorRowsHtml}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>Full detail — every slot &amp; booking</h2>
    <div class="controls">
      <input type="search" id="search" placeholder="Search mentor or student name / email…" />
      <select id="monthFilter"><option value="">All months</option>${monthOptions}</select>
      <button class="chip active" data-filter="all">All</button>
      <button class="chip" data-filter="booked">Has a booking</button>
      <button class="chip" data-filter="completed">Completed</button>
      <button class="chip" data-filter="attention">Needs attention</button>
      <span class="count" id="rowCount"></span>
    </div>
    <div class="table-wrap">
      <table id="detailTable">
        <thead><tr>
          <th>Mentor</th><th>Org</th><th>Slot start</th><th>Duration</th><th>Slot status</th>
          <th>Student</th><th>Session status</th><th>Recording</th>
        </tr></thead>
        <tbody id="detailBody"></tbody>
      </table>
    </div>
  </section>
</div>

<script>
const ROWS = ${JSON.stringify(rows)};

${statusPillJs()}

function recordingPill(row) {
  if (!row.booking_id) return '';
  if (!row.recording_count) return '<span class="pill pill-partial">missing</span>';
  if (row.recording_status === 'COMPLETED') {
    return row.recording_link
      ? '<a href="' + row.recording_link + '" target="_blank" rel="noopener"><span class="pill pill-done">ready ↗</span></a>'
      : '<span class="pill pill-done">ready</span>';
  }
  return '<span class="pill pill-missing" title="' + (row.recording_last_error || '') + '">' + (row.recording_status || 'failed').toLowerCase() + '</span>';
}

function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function fmt(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

const tbody = document.getElementById('detailBody');
tbody.innerHTML = ROWS.map(r => \`<tr
    data-mentor="\${esc((r.mentor_name||'') + ' ' + (r.mentor_email||'')).toLowerCase()}"
    data-student="\${esc((r.student_name||'') + ' ' + (r.student_email||'')).toLowerCase()}"
    data-month="\${r.month || ''}"
    data-booked="\${r.booking_id ? '1' : '0'}"
    data-completed="\${r.session_lifecycle_state === 'COMPLETED' ? '1' : '0'}"
    data-attention="\${(r.session_lifecycle_state === 'COMPLETED' && (!r.recording_count || r.recording_status !== 'COMPLETED')) ? '1' : '0'}"
  ><td>\${esc(r.mentor_name)}</td><td>\${esc(r.organization_name)}</td><td>\${r.slot_start ? fmt(r.slot_start) : '<span class="dim">—</span>'}</td><td>\${r.duration_minutes ? r.duration_minutes + ' min' : ''}</td><td>\${esc(r.slot_status)}</td><td>\${esc(r.student_name) || '<span class="dim">—</span>'}</td><td>\${statusPill(r.session_lifecycle_state, r.booking_status)}</td><td>\${recordingPill(r)}</td></tr>\`).join('');

const rows = Array.from(tbody.querySelectorAll('tr'));
const searchEl = document.getElementById('search');
const monthEl = document.getElementById('monthFilter');
const chips = Array.from(document.querySelectorAll('.chip'));
const countEl = document.getElementById('rowCount');
let activeFilter = 'all';

function applyFilters() {
  const q = searchEl.value.trim().toLowerCase();
  const month = monthEl.value;
  let visible = 0;
  for (const row of rows) {
    const matchesSearch = !q || row.dataset.mentor.includes(q) || row.dataset.student.includes(q);
    const matchesMonth = !month || row.dataset.month === month;
    const matchesFilter =
      activeFilter === 'all' ? true :
      activeFilter === 'booked' ? row.dataset.booked === '1' :
      activeFilter === 'completed' ? row.dataset.completed === '1' :
      activeFilter === 'attention' ? row.dataset.attention === '1' : true;
    const show = matchesSearch && matchesMonth && matchesFilter;
    row.classList.toggle('hide', !show);
    if (show) visible++;
  }
  countEl.textContent = visible + ' / ' + rows.length + ' rows';
}

searchEl.addEventListener('input', applyFilters);
monthEl.addEventListener('change', applyFilters);
chips.forEach(chip => chip.addEventListener('click', () => {
  chips.forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  activeFilter = chip.dataset.filter;
  applyFilters();
}));

applyFilters();
</script>
</body>
</html>`;
}

main()
  .catch((err) => {
    console.error('Export failed:', err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
