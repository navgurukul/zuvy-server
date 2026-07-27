import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index';
import {
  zuvyBatchEnrollments,
  zuvyStudentAttendance,
  zuvyStudentAttendanceRecords,
  users,
} from '../../../drizzle/schema';
import { helperVariable } from 'src/constants/helper';
import {
  aggregateForUser,
  CompletedSessionRow,
  AttendanceStatusEntry,
  AttendanceAggregate,
} from './attendance-aggregation';

export { CompletedSessionRow } from './attendance-aggregation';

type AttendanceScope =
  | { userId: number; userEmail: string }
  | { batchId: number };

const ATTENDANCE_COMPLETION_GRACE_MS = 5 * 60 * 1000;

/**
 * Single source of truth for "how many completed classes did this student
 * attend, and what %". Both the live per-student report and the cached
 * batch-list percentage must go through these three steps so they can only
 * ever disagree due to cache staleness, never due to divergent logic.
 */
@Injectable()
export class AttendanceCalculationService {
  /**
   * Sessions that count toward attendance for a batch: status='completed'
   * AND (batchId = X OR secondBatchId = X). The parens around the OR matter —
   * AND binds tighter than OR in SQL, so omitting them silently drops the
   * completed-only filter for the primary-batch branch.
   */
  async getCompletedSessionsForBatch(
    batchId: number,
    options?: {
      bootcampId?: number;
      searchTerm?: string;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Promise<CompletedSessionRow[]> {
    const completedCutoffIso = new Date(
      Date.now() - ATTENDANCE_COMPLETION_GRACE_MS,
    ).toISOString();

    const sessions = await db.query.zuvySessions.findMany({
      where: (session, { and, eq, ne, or, ilike, gte, lte, isNull }) =>
        and(
          options?.bootcampId
            ? eq(session.bootcampId, options.bootcampId)
            : undefined,
          or(eq(session.batchId, batchId), eq(session.secondBatchId, batchId)),
          or(
            eq(session.status, helperVariable.completed),
            and(
              or(isNull(session.status), ne(session.status, 'cancelled')),
              lte(session.endTime, completedCutoffIso),
            ),
          ),
          options?.searchTerm
            ? ilike(session.title, `%${options.searchTerm}%`)
            : undefined,
          options?.fromDate && options?.toDate
            ? and(
                gte(session.startTime, options.fromDate.toISOString()),
                lte(session.startTime, options.toDate.toISOString()),
              )
            : undefined,
        ),
      with: {
        batches: { columns: { id: true, name: true } },
      },
      orderBy: (session, { asc, desc }) =>
        options?.fromDate && options?.toDate
          ? asc(session.startTime)
          : desc(session.id),
    });

    return sessions.map((s: any) => ({
      id: Number(s.id),
      title: s.title,
      startTime: s.startTime,
      endTime: s.endTime,
      s3link: s.s3link,
      moduleId: s.moduleId,
      chapterId: s.chapterId,
      meetingId: s.meetingId,
      isZoomMeet: s.isZoomMeet !== false,
      batchName: s.batches?.name ?? null,
    }));
  }

  /**
   * Builds a per-(session, user) attendance status map, merging the
   * Zoom-webhook table (zuvy_student_attendance_records) for Zoom sessions
   * with the legacy Google Meet table (zuvy_student_attendance, a JSON blob
   * keyed by meetingId + email) for non-Zoom sessions.
   *
   * Pass `{ userId, userEmail }` to resolve a single student cheaply, or
   * `{ batchId }` to resolve every enrolled student at once.
   */
  async getUnifiedAttendanceMap(
    sessions: CompletedSessionRow[],
    rawScope: AttendanceScope,
  ): Promise<Map<number, Map<number, AttendanceStatusEntry>>> {
    // Normalize userId to a number once, here, regardless of what the caller
    // passed in (e.g. a JWT's `sub` claim is always a string). Every map key
    // and lookup below assumes a numeric userId — a stray string would
    // silently miss every entry via Map's strict-equality key comparison.
    const scope: AttendanceScope =
      'userId' in rawScope
        ? { ...rawScope, userId: Number(rawScope.userId) }
        : rawScope;

    const map = new Map<number, Map<number, AttendanceStatusEntry>>();
    const setEntry = (
      sessionId: number,
      userId: number,
      entry: AttendanceStatusEntry,
    ) => {
      if (!map.has(sessionId)) map.set(sessionId, new Map());
      map.get(sessionId)!.set(userId, entry);
    };

    const isSingleUser = 'userId' in scope;
    const zoomSessions = sessions.filter((s) => s.isZoomMeet);
    const googleMeetSessions = sessions.filter((s) => !s.isZoomMeet);
    const zoomSessionIds = zoomSessions.map((s) => s.id);
    const googleMeetMeetingIds = googleMeetSessions.map((s) => s.meetingId);
    const meetingIdToSessionId = new Map(
      googleMeetSessions.map((s) => [s.meetingId, s.id]),
    );

    if (zoomSessionIds.length > 0) {
      const rows = await db
        .select({
          sessionId: zuvyStudentAttendanceRecords.sessionId,
          userId: zuvyStudentAttendanceRecords.userId,
          status: zuvyStudentAttendanceRecords.status,
          duration: zuvyStudentAttendanceRecords.duration,
        })
        .from(zuvyStudentAttendanceRecords)
        .where(
          isSingleUser
            ? and(
                eq(
                  zuvyStudentAttendanceRecords.userId,
                  (scope as { userId: number }).userId,
                ),
                inArray(zuvyStudentAttendanceRecords.sessionId, zoomSessionIds),
              )
            : inArray(zuvyStudentAttendanceRecords.sessionId, zoomSessionIds),
        );

      rows.forEach((r) => {
        setEntry(r.sessionId, Number(r.userId), {
          status: (r.status || 'absent').toLowerCase(),
          duration: r.duration ?? 0,
        });
      });
    }

    if (googleMeetMeetingIds.length > 0) {
      const rows = await db
        .select({
          meetingId: zuvyStudentAttendance.meetingId,
          attendance: zuvyStudentAttendance.attendance,
        })
        .from(zuvyStudentAttendance)
        .where(inArray(zuvyStudentAttendance.meetingId, googleMeetMeetingIds));

      let emailToUserId: Map<string, number> | null = null;
      if (!isSingleUser) {
        const enrolledUsers = await db
          .select({ userId: zuvyBatchEnrollments.userId, email: users.email })
          .from(zuvyBatchEnrollments)
          .innerJoin(users, eq(users.id, zuvyBatchEnrollments.userId))
          .where(
            eq(
              zuvyBatchEnrollments.batchId,
              (scope as { batchId: number }).batchId,
            ),
          );
        emailToUserId = new Map(
          enrolledUsers.map((u) => [
            (u.email || '').toLowerCase(),
            Number(u.userId),
          ]),
        );
      }

      rows.forEach((record) => {
        let students: any[] = [];
        if (Array.isArray(record.attendance)) {
          students = record.attendance as any[];
        } else if (typeof record.attendance === 'string') {
          try {
            students = JSON.parse(record.attendance);
          } catch {}
        }

        const sessionId = meetingIdToSessionId.get(record.meetingId);
        if (!sessionId) return;

        if (isSingleUser) {
          const { userId, userEmail } = scope as {
            userId: number;
            userEmail: string;
          };
          const rec = students.find(
            (s: any) => s.email?.toLowerCase() === userEmail,
          );
          if (rec) {
            setEntry(sessionId, userId, {
              status: rec.attendance || 'absent',
              duration: rec.duration ?? 0,
            });
          }
        } else {
          students.forEach((s: any) => {
            const uid = emailToUserId!.get((s.email || '').toLowerCase());
            if (uid) {
              setEntry(sessionId, uid, {
                status: s.attendance || 'absent',
                duration: s.duration ?? 0,
              });
            }
          });
        }
      });
    }

    return map;
  }

  /** Delegates to the DB-free pure aggregation module (see attendance-aggregation.ts). */
  aggregateForUser(
    sessions: CompletedSessionRow[],
    attendanceMap: Map<number, Map<number, AttendanceStatusEntry>>,
    userId: number,
  ): AttendanceAggregate {
    return aggregateForUser(sessions, attendanceMap, userId);
  }
}
