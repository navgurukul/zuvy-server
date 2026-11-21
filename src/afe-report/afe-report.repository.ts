import { Injectable } from '@nestjs/common';
import {
  SQL,
  and,
  desc,
  eq,
  exists,
  gte,
  inArray,
  lt,
  notExists,
  notIlike,
  sql,
} from 'drizzle-orm';
import { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from 'src/db';
import {
  users,
  zuvyAfeReportRuns,
  zuvyBootcamps,
  zuvyChapterTracking,
  zuvyCourseModules,
  zuvyFormTracking,
  zuvyModuleChapter,
  zuvyModuleForm,
  zuvyStudentCredentials,
  zuvyUserRolesAssigned,
  zuvyUserSessions,
} from 'drizzle/schema';
import { FormAnswer, FormQuestion } from './afe-report.forms';
import {
  AssembledTours,
  Finish,
  LearnerInfo,
  TOPIC,
  TourModule,
  answerKey,
  assembleTours,
  chapterKey,
  formQuestionIds,
} from './afe-report.rows';
import { RunSummary, STALE_SENDING_MS } from './afe-report.config';

// Keeps IN (...) lists a sensible size when the first report covers
// everything so far.
const CHUNK = 500;

function chunk<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** A timestamp as epoch milliseconds, so no driver date parsing is involved. */
function epochMs(column: AnyPgColumn): SQL<string> {
  return sql<string>`(extract(epoch from ${column}) * 1000)::bigint`;
}

const toDate = (ms: string | number | null) =>
  ms === null || ms === undefined ? null : new Date(Number(ms));

@Injectable()
export class AfeReportRepository {
  /** The tours (modules) of the organisation's courses, "Dummy" courses left out. */
  async loadTours(orgId: number): Promise<AssembledTours> {
    const chapters = await db
      .select({
        bootcampId: zuvyBootcamps.id,
        bootcampName: zuvyBootcamps.name,
        bootcampLanguage: zuvyBootcamps.language,
        moduleId: zuvyCourseModules.id,
        moduleName: zuvyCourseModules.name,
        chapterId: zuvyModuleChapter.id,
        topicId: zuvyModuleChapter.topicId,
        order: zuvyModuleChapter.order,
        videoDurationSeconds: zuvyModuleChapter.videoDurationSeconds,
        formQuestions: zuvyModuleChapter.formQuestions,
      })
      .from(zuvyBootcamps)
      .innerJoin(
        zuvyCourseModules,
        eq(zuvyCourseModules.bootcampId, zuvyBootcamps.id),
      )
      .innerJoin(
        zuvyModuleChapter,
        eq(zuvyModuleChapter.moduleId, zuvyCourseModules.id),
      )
      .where(
        and(
          eq(zuvyBootcamps.organizationId, orgId),
          notIlike(zuvyBootcamps.name, '%dummy%'),
        ),
      );

    const questionIds = [
      ...new Set(
        chapters
          .filter((c) => c.topicId === TOPIC.FORM)
          .flatMap((c) => formQuestionIds(c.formQuestions)),
      ),
    ];
    const questions: FormQuestion[] = [];
    for (const ids of chunk(questionIds)) {
      const rows = await db
        .select({
          id: zuvyModuleForm.id,
          question: zuvyModuleForm.question,
          options: zuvyModuleForm.options,
          typeId: zuvyModuleForm.typeId,
        })
        .from(zuvyModuleForm)
        .where(inArray(zuvyModuleForm.id, ids));
      questions.push(
        ...rows.map((r) => ({
          ...r,
          options: (r.options as Record<string, string>) ?? null,
        })),
      );
    }
    return assembleTours(chapters, questions);
  }

  /**
   * Tours finished in [from, to): feedback forms submitted in that period, by
   * Student ID accounts only (signed up without an email; Google sign-in
   * accounts are left out). Accounts with any staff role (admin, ops,
   * instructor, ...) are left out too.
   */
  async loadFinishes(
    tours: Map<number, TourModule>,
    from: Date,
    to: Date,
  ): Promise<Finish[]> {
    const moduleByFeedbackChapter = new Map<number, number>();
    for (const tour of tours.values()) {
      moduleByFeedbackChapter.set(tour.feedback.chapterId, tour.moduleId);
    }
    const finishes: Finish[] = [];
    for (const ids of chunk([...moduleByFeedbackChapter.keys()])) {
      const rows = await db
        .select({
          userId: zuvyChapterTracking.userId,
          chapterId: zuvyChapterTracking.chapterId,
          completedAtMs: epochMs(zuvyChapterTracking.completedAt),
        })
        .from(zuvyChapterTracking)
        .where(
          and(
            inArray(zuvyChapterTracking.chapterId, ids),
            gte(zuvyChapterTracking.completedAt, from.toISOString()),
            lt(zuvyChapterTracking.completedAt, to.toISOString()),
            exists(
              db
                .select({ one: sql`1` })
                .from(zuvyStudentCredentials)
                .where(
                  eq(zuvyStudentCredentials.userId, zuvyChapterTracking.userId),
                ),
            ),
            notExists(
              db
                .select({ one: sql`1` })
                .from(zuvyUserRolesAssigned)
                .where(
                  eq(zuvyUserRolesAssigned.userId, zuvyChapterTracking.userId),
                ),
            ),
          ),
        );
      for (const r of rows) {
        finishes.push({
          userId: Number(r.userId),
          moduleId: moduleByFeedbackChapter.get(r.chapterId),
          completedAt: toDate(r.completedAtMs),
        });
      }
    }
    return finishes;
  }

  async loadLearners(userIds: number[]): Promise<Map<number, LearnerInfo>> {
    const learners = new Map<number, LearnerInfo>();
    for (const ids of chunk(userIds)) {
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          state: zuvyStudentCredentials.state,
          city: zuvyStudentCredentials.city,
          schoolName: zuvyStudentCredentials.schoolName,
          udiseCode: zuvyStudentCredentials.udiseCode,
        })
        .from(users)
        .leftJoin(
          zuvyStudentCredentials,
          eq(zuvyStudentCredentials.userId, users.id),
        )
        .where(
          inArray(
            users.id,
            ids.map((id) => BigInt(id)),
          ),
        );
      for (const r of rows) {
        const { id, ...info } = r;
        learners.set(Number(id), info);
      }
    }
    return learners;
  }

  /** Latest answer per user and question in the given form chapters. */
  async loadAnswers(
    userIds: number[],
    chapterIds: number[],
  ): Promise<Map<string, FormAnswer>> {
    const answers = new Map<string, FormAnswer & { rank: [number, number] }>();
    if (chapterIds.length === 0) return answers;
    for (const ids of chunk(userIds)) {
      const rows = await db
        .select({
          id: zuvyFormTracking.id,
          userId: zuvyFormTracking.userId,
          questionId: zuvyFormTracking.questionId,
          chosenOptions: zuvyFormTracking.chosenOptions,
          answer: zuvyFormTracking.answer,
          updatedAtMs: epochMs(zuvyFormTracking.updatedAt),
        })
        .from(zuvyFormTracking)
        .where(
          and(
            inArray(zuvyFormTracking.userId, ids),
            inArray(zuvyFormTracking.chapterId, chapterIds),
          ),
        );
      for (const r of rows) {
        if (r.userId === null || r.questionId === null) continue;
        const key = answerKey(Number(r.userId), r.questionId);
        const rank: [number, number] = [Number(r.updatedAtMs ?? 0), r.id];
        const current = answers.get(key);
        if (
          !current ||
          rank[0] > current.rank[0] ||
          (rank[0] === current.rank[0] && rank[1] > current.rank[1])
        ) {
          answers.set(key, {
            chosenOptions: r.chosenOptions,
            answer: r.answer,
            rank,
          });
        }
      }
    }
    return answers;
  }

  async loadWatchedVideos(
    userIds: number[],
    videoChapterIds: number[],
  ): Promise<Set<string>> {
    const watched = new Set<string>();
    if (videoChapterIds.length === 0) return watched;
    for (const ids of chunk(userIds)) {
      for (const chapterIds of chunk(videoChapterIds)) {
        const rows = await db
          .select({
            userId: zuvyChapterTracking.userId,
            chapterId: zuvyChapterTracking.chapterId,
          })
          .from(zuvyChapterTracking)
          .where(
            and(
              inArray(
                zuvyChapterTracking.userId,
                ids.map((id) => BigInt(id)),
              ),
              inArray(zuvyChapterTracking.chapterId, chapterIds),
            ),
          );
        for (const r of rows)
          watched.add(chapterKey(Number(r.userId), r.chapterId));
      }
    }
    return watched;
  }

  /** Login sessions started before `before`, oldest first, per user. */
  async loadSessions(
    userIds: number[],
    before: Date,
  ): Promise<Map<number, { id: string; createdAt: Date }[]>> {
    const sessions = new Map<number, { id: string; createdAt: Date }[]>();
    for (const ids of chunk(userIds)) {
      const rows = await db
        .select({
          id: zuvyUserSessions.id,
          userId: zuvyUserSessions.userId,
          createdAtMs: epochMs(zuvyUserSessions.createdAt),
        })
        .from(zuvyUserSessions)
        .where(
          and(
            inArray(
              zuvyUserSessions.userId,
              ids.map((id) => BigInt(id)),
            ),
            lt(zuvyUserSessions.createdAt, before.toISOString()),
          ),
        )
        .orderBy(zuvyUserSessions.createdAt, zuvyUserSessions.id);
      for (const r of rows) {
        const userId = Number(r.userId);
        const list = sessions.get(userId) ?? [];
        list.push({ id: r.id, createdAt: toDate(r.createdAtMs) });
        sessions.set(userId, list);
      }
    }
    return sessions;
  }

  // ---- report runs ----

  private runSummary = {
    id: zuvyAfeReportRuns.id,
    status: zuvyAfeReportRuns.status,
    windowEndMs: epochMs(zuvyAfeReportRuns.windowEnd),
    createdAtMs: epochMs(zuvyAfeReportRuns.createdAt),
  };

  private toSummary(row: {
    status: string;
    windowEndMs: string;
    createdAtMs: string;
  }): RunSummary {
    return {
      status: row.status as RunSummary['status'],
      windowEnd: toDate(row.windowEndMs),
      createdAt: toDate(row.createdAtMs),
    };
  }

  async latestSent(): Promise<RunSummary | null> {
    const [row] = await db
      .select(this.runSummary)
      .from(zuvyAfeReportRuns)
      .where(eq(zuvyAfeReportRuns.status, 'sent'))
      .orderBy(desc(zuvyAfeReportRuns.windowEnd))
      .limit(1);
    return row ? this.toSummary(row) : null;
  }

  async latestAttempt(): Promise<RunSummary | null> {
    const [row] = await db
      .select(this.runSummary)
      .from(zuvyAfeReportRuns)
      .orderBy(desc(zuvyAfeReportRuns.createdAt), desc(zuvyAfeReportRuns.id))
      .limit(1);
    return row ? this.toSummary(row) : null;
  }

  /** A run still "sending" long after it started: its server died mid-way. */
  async abandonStale(now: Date): Promise<number> {
    const rows = await db
      .update(zuvyAfeReportRuns)
      // `as any`: with strictNullChecks off, drizzle's set() type drops
      // nullable columns such as error (same as elsewhere in this codebase).
      .set({
        status: 'failed',
        error: 'Abandoned: still sending after 30 minutes (server restarted?)',
      } as any)
      .where(
        and(
          eq(zuvyAfeReportRuns.status, 'sending'),
          lt(
            zuvyAfeReportRuns.createdAt,
            new Date(now.getTime() - STALE_SENDING_MS).toISOString(),
          ),
        ),
      )
      .returning({ id: zuvyAfeReportRuns.id });
    return rows.length;
  }

  /**
   * Claims the report for [windowStart, windowEnd). Returns null when another
   * server already claimed or sent a report starting at windowStart.
   */
  async claim(windowStart: Date, windowEnd: Date): Promise<number | null> {
    const rows = await db
      .insert(zuvyAfeReportRuns)
      .values({
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        status: 'sending',
      })
      .onConflictDoNothing()
      .returning({ id: zuvyAfeReportRuns.id });
    return rows[0]?.id ?? null;
  }

  async markSent(id: number, rowCount: number, recipients: string[]) {
    await db
      .update(zuvyAfeReportRuns)
      .set({
        status: 'sent',
        rowCount,
        recipients: recipients.join(', '),
        error: null,
        sentAt: sql`now()`,
      } as any)
      .where(eq(zuvyAfeReportRuns.id, id));
  }

  async markFailed(id: number, error: string) {
    await db
      .update(zuvyAfeReportRuns)
      .set({ status: 'failed', error: error.slice(0, 2000) } as any)
      .where(eq(zuvyAfeReportRuns.id, id));
  }
}
