import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { users } from '../../../drizzle/schema';
import { db } from '../../db/index';
import {
  zuvyAssessmentSubmission,
  zuvyOutsourseAssessments,
  zuvyLearnerLeaderboard,
  zuvyPracticeCode,
  zuvyOutsourseCodingQuestions,
  zuvyTestCasesSubmission,
  zuvyQuizTracking,
  zuvyOutsourseQuizzes,
  zuvyStudentAttendanceRecords,
  AttendanceStatus,
  zuvySessions,
  zuvyChapterTracking,
  zuvyModuleChapter,
  zuvyCourseModules,
  zuvyBootcamps,
  zuvyBatchEnrollments,
  zuvyAssignmentSubmission,
  zuvyLearnerLeaderboardChapterPoints,
} from '../../../drizzle/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

type ChapterPointRow = {
  learnerId: number;
  bootcampId: number;
  chapterId: number;
  topicId: number | null;
  points: number;
};

type CalculationScope = {
  userId: number;
  bootcampId: number;
  moduleId: number;
  chapterId: number;
};

type LeaderboardPointColumn =
  | 'assessmentPoints'
  | 'codingPoints'
  | 'quizPoints'
  | 'recordingPoints'
  | 'attendancePoints'
  | 'assignmentPoints'
  | 'articlePoints'
  | 'videoPoints';

@Injectable()
export class LeaderboardService {
  private logger = new Logger(LeaderboardService.name);
  private getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  // Calculates assessment performance points based on the percentage score.
  private calculatePercentagePoints(percentage: number): number {
    if (percentage >= 90) {
      return 30;
    } else if (percentage >= 70) {
      return 20;
    } else if (percentage >= 40) {
      return 10;
    } else {
      return 0;
    }
  }

  // Return points for attempting an assessment.
  private calculateSubmissionAttemptPoints(): number {
    return 10;
  }

  // Calculates total assessment points by combining attempt and performance points.
  private calculateTotalAssessmentPoints(percentage: number): {
    attemptPoints: number;
    percentagePoints: number;
    totalPoints: number;
  } {
    const attemptPoints = this.calculateSubmissionAttemptPoints();
    const percentagePoints = this.calculatePercentagePoints(percentage || 0);

    return {
      attemptPoints,
      percentagePoints,
      totalPoints: attemptPoints + percentagePoints,
    };
  }
  // Calculate assessment points for each learner and chapter.
  private async calculateAssessmentPoints(scope?: CalculationScope): Promise<
    Map<
      string,
      {
        chapterPoints: Map<number, number>;
        assessmentPoints: number;
        lastActivityAt: string;
      }
    >
  > {
    const assessmentMap = new Map<
      string,
      {
        chapterPoints: Map<number, number>;
        assessmentPoints: number;
        lastActivityAt: string;
      }
    >();

    try {
      const assessmentSubmissions = await db
        .select({
          userId: zuvyAssessmentSubmission.userId,
          percentage: zuvyAssessmentSubmission.percentage,
          assessmentId: zuvyAssessmentSubmission.assessmentOutsourseId,
          bootcampId: zuvyOutsourseAssessments.bootcampId,
          chapterId: zuvyOutsourseAssessments.chapterId,
          submittedAt: zuvyAssessmentSubmission.submitedAt,
          isPassed: zuvyAssessmentSubmission.isPassed,
        })
        .from(zuvyAssessmentSubmission)
        .leftJoin(
          zuvyOutsourseAssessments,
          eq(
            zuvyAssessmentSubmission.assessmentOutsourseId,
            zuvyOutsourseAssessments.id,
          ),
        )
        .where(
          and(
            sql`${zuvyAssessmentSubmission.percentage} IS NOT NULL`,
            sql`${zuvyOutsourseAssessments.bootcampId} IS NOT NULL`,
            scope
              ? eq(zuvyAssessmentSubmission.userId, scope.userId)
              : sql`TRUE`,
            scope
              ? eq(zuvyOutsourseAssessments.bootcampId, scope.bootcampId)
              : sql`TRUE`,
            scope
              ? eq(zuvyOutsourseAssessments.chapterId, scope.chapterId)
              : sql`TRUE`,
          ),
        );

      if (assessmentSubmissions.length === 0) {
        return assessmentMap;
      }

      // Get latest submission for each learner + assessment
      const latestSubmissions = new Map<
        string,
        (typeof assessmentSubmissions)[number]
      >();

      for (const submission of assessmentSubmissions) {
        if (
          !submission.userId ||
          !submission.assessmentId ||
          !submission.chapterId
        ) {
          continue;
        }

        const key = `${submission.userId}-${submission.assessmentId}`;

        const existing = latestSubmissions.get(key);

        if (
          !existing ||
          new Date(submission.submittedAt || 0).getTime() >
            new Date(existing.submittedAt || 0).getTime()
        ) {
          latestSubmissions.set(key, submission);
        }
      }

      // Process only latest submission
      for (const submission of latestSubmissions.values()) {
        if (!submission.userId || !submission.bootcampId) {
          continue;
        }

        const key = `${submission.userId}-${submission.bootcampId}`;

        let pointsBreakdown;

        if (submission.isPassed) {
          pointsBreakdown = this.calculateTotalAssessmentPoints(
            submission.percentage || 0,
          );
        } else {
          pointsBreakdown = {
            attemptPoints: 0,
            percentagePoints: 0,
            totalPoints: 0,
          };
        }

        const entry = assessmentMap.get(key) || {
          chapterPoints: new Map<number, number>(),
          assessmentPoints: 0,
          lastActivityAt: new Date().toISOString(),
        };

        entry.assessmentPoints += pointsBreakdown.totalPoints;

        if (submission.chapterId) {
          const currentChapterPoints =
            entry.chapterPoints.get(submission.chapterId) ?? 0;

          entry.chapterPoints.set(
            submission.chapterId,
            currentChapterPoints + pointsBreakdown.totalPoints,
          );
        }

        entry.lastActivityAt =
          submission.submittedAt || new Date().toISOString();

        assessmentMap.set(key, entry);
      }
    } catch (error) {
      this.logger.error(
        `Error calculating assessment points: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );
    }

    return assessmentMap;
  }

  // Calculate coding points for accepted coding submissions.
  private async calculateCodingPoints(scope: CalculationScope): Promise<
    Map<
      string,
      {
        chapterPoints: Map<number, number>;
        codingPoints: number;
        lastActivityAt: string;
      }
    >
  > {
    const codingMap = new Map<
      string,
      {
        chapterPoints: Map<number, number>;
        codingPoints: number;
        lastActivityAt: string;
      }
    >();

    try {
      const codingSubmissions = await db
        .select({
          userId: zuvyPracticeCode.userId,
          chapterId: zuvyPracticeCode.chapterId,
          topicId: zuvyModuleChapter.topicId,
          submittedAt: zuvyPracticeCode.createdAt,
          practiceCodeId: zuvyPracticeCode.id,
          status: zuvyPracticeCode.status,
        })
        .from(zuvyPracticeCode)
        .leftJoin(
          zuvyModuleChapter,
          eq(zuvyPracticeCode.chapterId, zuvyModuleChapter.id),
        )
        .where(
          and(
            eq(zuvyPracticeCode.status, 'Accepted'),
            eq(zuvyPracticeCode.userId, BigInt(scope.userId)),
          ),
        );

      if (codingSubmissions.length === 0) {
        return codingMap;
      }
      for (const submission of codingSubmissions) {
        if (!submission.userId || !submission.practiceCodeId) {
          continue;
        }

        const pointsBreakdown = this.calculateTotalCodingPoints(true);

        const key = `${submission.userId}-${scope.bootcampId}`;

        const entry = codingMap.get(key) || {
          chapterPoints: new Map<number, number>(),
          codingPoints: 0,
          lastActivityAt: new Date().toISOString(),
        };

        if (submission.chapterId && submission.topicId === 3) {
          if (!entry.chapterPoints.has(submission.chapterId)) {
            entry.chapterPoints.set(
              submission.chapterId,
              pointsBreakdown.totalCodingPoints,
            );

            entry.codingPoints += pointsBreakdown.totalCodingPoints;
          }
        }

        entry.lastActivityAt =
          submission.submittedAt || new Date().toISOString();

        codingMap.set(key, entry);
      }
    } catch (error) {
      this.logger.error(
        `Error calculating coding points: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );
    }
    return codingMap;
  }

  // Calculate quiz points using attempt and score points.
  private async calculateQuizPoints(scope?: CalculationScope): Promise<
    Map<
      string,
      {
        chapterPoints: Map<number, number>;
        quizPoints: number;
        lastActivityAt: string;
      }
    >
  > {
    try {
      const quizSubmissions = await db
        .select({
          userId: zuvyQuizTracking.userId,
          bootcampId: zuvyOutsourseQuizzes.bootcampId,
          mcqScore: zuvyAssessmentSubmission.mcqScore,
          requiredMCQScore: zuvyAssessmentSubmission.requiredMCQScore,
          attemptCount: zuvyQuizTracking.attemptCount,
          createdAt: zuvyQuizTracking.createdAt,
        })
        .from(zuvyQuizTracking)
        .leftJoin(
          zuvyAssessmentSubmission,
          eq(
            zuvyQuizTracking.assessmentSubmissionId,
            zuvyAssessmentSubmission.id,
          ),
        )
        .leftJoin(
          zuvyOutsourseQuizzes,
          eq(zuvyQuizTracking.questionId, zuvyOutsourseQuizzes.id),
        )
        .leftJoin(
          zuvyOutsourseAssessments,
          eq(
            zuvyOutsourseQuizzes.assessmentOutsourseId,
            zuvyOutsourseAssessments.id,
          ),
        )
        .where(
          and(
            sql`${zuvyOutsourseQuizzes.bootcampId} IS NOT NULL`,
            scope ? eq(zuvyQuizTracking.userId, scope.userId) : sql`TRUE`,
            scope
              ? eq(zuvyOutsourseQuizzes.bootcampId, scope.bootcampId)
              : sql`TRUE`,
          ),
        );

      const standaloneQuizCompletions = await db
        .select({
          userId: zuvyChapterTracking.userId,
          chapterId: zuvyChapterTracking.chapterId,
          bootcampId: zuvyCourseModules.bootcampId,
          completedAt: zuvyChapterTracking.completedAt,
        })
        .from(zuvyChapterTracking)
        .leftJoin(
          zuvyModuleChapter,
          eq(zuvyChapterTracking.chapterId, zuvyModuleChapter.id),
        )
        .leftJoin(
          zuvyCourseModules,
          eq(zuvyModuleChapter.moduleId, zuvyCourseModules.id),
        )
        .where(
          and(
            eq(zuvyModuleChapter.topicId, 4),
            sql`${zuvyCourseModules.bootcampId} IS NOT NULL`,
            scope
              ? eq(zuvyChapterTracking.userId, BigInt(scope.userId))
              : sql`TRUE`,
            scope
              ? eq(zuvyCourseModules.bootcampId, scope.bootcampId)
              : sql`TRUE`,
            scope
              ? eq(zuvyChapterTracking.chapterId, scope.chapterId)
              : sql`TRUE`,
          ),
        );

      const quizMap = new Map<
        string,
        {
          chapterPoints: Map<number, number>;
          quizPoints: number;
          lastActivityAt: string;
        }
      >();

      if (
        quizSubmissions.length === 0 &&
        standaloneQuizCompletions.length === 0
      ) {
        this.logger.log('No quiz submissions or completions found');
        return quizMap;
      }

      for (const submission of quizSubmissions) {
        if (!submission.userId || !submission.bootcampId) {
          continue;
        }

        const key = `${submission.userId}-${submission.bootcampId}`;

        let quizPercentage = 0;
        if (
          submission.mcqScore !== null &&
          submission.requiredMCQScore &&
          submission.requiredMCQScore > 0
        ) {
          quizPercentage =
            (submission.mcqScore / submission.requiredMCQScore) * 100;
        }

        const attemptPoints = 10;
        const scorePoints = this.calculateQuizScorePoints(quizPercentage);

        const totalQuizPoints = attemptPoints + scorePoints;

        const entry = quizMap.get(key) || {
          chapterPoints: new Map<number, number>(),
          quizPoints: 0,
          lastActivityAt: new Date().toISOString(),
        };

        entry.quizPoints += totalQuizPoints;
        entry.lastActivityAt = submission.createdAt || new Date().toISOString();
        quizMap.set(key, entry);
      }

      const completionsByLearnerBootcamp = new Map<string, Set<number>>();

      for (const completion of standaloneQuizCompletions) {
        if (
          !completion.userId ||
          !completion.bootcampId ||
          !completion.chapterId
        ) {
          continue;
        }

        const key = `${completion.userId}-${completion.bootcampId}`;

        if (!completionsByLearnerBootcamp.has(key)) {
          completionsByLearnerBootcamp.set(key, new Set());
        }

        completionsByLearnerBootcamp.get(key)!.add(completion.chapterId);

        const entry = quizMap.get(key) || {
          chapterPoints: new Map<number, number>(),
          quizPoints: 0,
          lastActivityAt: completion.completedAt || new Date().toISOString(),
        };

        if (completion.completedAt) {
          const compTime = new Date(completion.completedAt).getTime();
          const entryTime = new Date(entry.lastActivityAt).getTime();
          if (compTime > entryTime) {
            entry.lastActivityAt = completion.completedAt;
          }
        }

        quizMap.set(key, entry);
      }

      for (const [key, chapterSet] of completionsByLearnerBootcamp.entries()) {
        const entry = quizMap.get(key);
        if (entry) {
          for (const chapterId of chapterSet) {
            entry.chapterPoints.set(chapterId, 10);
          }
          entry.quizPoints += chapterSet.size * 10;
        }
      }

      this.logger.log(
        `Processed quiz points for ${quizMap.size} learner-bootcamp combinations`,
      );
      return quizMap;
    } catch (error) {
      this.logger.error(
        `Error calculating quiz points: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );
      return new Map();
    }
  }

  // Calculate quiz points based on the score percentage.
  private calculateQuizScorePoints(percentage: number): number {
    if (percentage >= 90) {
      return 15;
    } else if (percentage >= 70) {
      return 10;
    } else if (percentage >= 40) {
      return 5;
    } else {
      return 0;
    }
  }

  // Calculate points for present attendance.
  private async calculateAttendancePoints(scope?: CalculationScope): Promise<
    Map<
      string,
      {
        chapterPoints: Map<number, number>;
        attendancePoints: number;
        lastActivityAt: string;
      }
    >
  > {
    const attendanceMap = new Map<
      string,
      {
        chapterPoints: Map<number, number>;
        attendancePoints: number;
        lastActivityAt: string;
      }
    >();

    try {
      const attendanceRecords = await db
        .select({
          userId: zuvyStudentAttendanceRecords.userId,
          bootcampId: zuvyStudentAttendanceRecords.bootcampId,
          sessionId: zuvyStudentAttendanceRecords.sessionId,
          chapterId: zuvySessions.chapterId,
          status: zuvyStudentAttendanceRecords.status,
          attendanceDate: zuvyStudentAttendanceRecords.attendanceDate,
          createdAt: zuvyStudentAttendanceRecords.createdAt,
        })
        .from(zuvyStudentAttendanceRecords)
        .leftJoin(
          zuvySessions,
          eq(zuvyStudentAttendanceRecords.sessionId, zuvySessions.id),
        )
        .where(
          and(
            eq(zuvyStudentAttendanceRecords.status, AttendanceStatus.PRESENT),
            sql`${zuvyStudentAttendanceRecords.bootcampId} IS NOT NULL`,

            scope
              ? eq(zuvyStudentAttendanceRecords.userId, BigInt(scope.userId))
              : sql`TRUE`,

            scope
              ? eq(zuvyStudentAttendanceRecords.bootcampId, scope.bootcampId)
              : sql`TRUE`,

            scope ? eq(zuvySessions.chapterId, scope.chapterId) : sql`TRUE`,
          ),
        );

      if (attendanceRecords.length === 0) {
        this.logger.log('No attendance records found');
        return attendanceMap;
      }

      for (const record of attendanceRecords) {
        if (!record.userId || !record.bootcampId || !record.chapterId) {
          continue;
        }

        const key = `${record.userId}-${record.bootcampId}`;

        const entry = attendanceMap.get(key) || {
          chapterPoints: new Map<number, number>(),
          attendancePoints: 0,
          lastActivityAt: new Date().toISOString(),
        };

        const pointsPerSession = 10;

        // Prevent duplicate points for the same chapter
        if (!entry.chapterPoints.has(record.chapterId)) {
          entry.chapterPoints.set(record.chapterId, pointsPerSession);

          entry.attendancePoints += pointsPerSession;
        }

        entry.lastActivityAt = record.createdAt || new Date().toISOString();

        attendanceMap.set(key, entry);
      }

      return attendanceMap;
    } catch (error) {
      this.logger.error(
        `Error calculating attendance points: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );

      return attendanceMap;
    }
  }

  // Calculate points for completed recording chapters.
  private async calculateRecordingPoints(scope?: CalculationScope): Promise<
    Map<
      string,
      {
        chapterPoints: Map<number, number>;
        recordingPoints: number;
        lastActivityAt: string;
      }
    >
  > {
    const recordingMap = new Map<
      string,
      {
        chapterPoints: Map<number, number>;
        recordingPoints: number;
        lastActivityAt: string;
      }
    >();

    try {
      // Get completed recording chapters.
      const recordingCompletions = await db
        .select({
          userId: zuvyChapterTracking.userId,
          chapterId: zuvyChapterTracking.chapterId,
          bootcampId: zuvyCourseModules.bootcampId,
          completedAt: zuvyChapterTracking.completedAt,
          sessionId: zuvySessions.id,
        })
        .from(zuvyChapterTracking)
        .leftJoin(
          zuvyModuleChapter,
          eq(zuvyChapterTracking.chapterId, zuvyModuleChapter.id),
        )
        .leftJoin(
          zuvyCourseModules,
          eq(zuvyModuleChapter.moduleId, zuvyCourseModules.id),
        )
        .leftJoin(
          zuvySessions,
          and(
            eq(zuvySessions.chapterId, zuvyChapterTracking.chapterId),
            eq(zuvySessions.bootcampId, zuvyCourseModules.bootcampId),
          ),
        )
        .where(
          and(
            // Recording topic
            eq(zuvyModuleChapter.topicId, 8),

            sql`${zuvyCourseModules.bootcampId} IS NOT NULL`,

            // Only completed recordings
            sql`${zuvyChapterTracking.completedAt} IS NOT NULL`,

            scope
              ? eq(zuvyChapterTracking.userId, BigInt(scope.userId))
              : sql`TRUE`,

            scope
              ? eq(zuvyCourseModules.bootcampId, scope.bootcampId)
              : sql`TRUE`,

            scope
              ? eq(zuvyChapterTracking.chapterId, scope.chapterId)
              : sql`TRUE`,
          ),
        );

      if (recordingCompletions.length === 0) {
        this.logger.log('No recording completions found');
        return recordingMap;
      }

      // Get only learners who were PRESENT in the live session.
      const attendanceRecords = await db
        .select({
          userId: zuvyStudentAttendanceRecords.userId,
          sessionId: zuvyStudentAttendanceRecords.sessionId,
        })
        // .from(zuvyStudentAttendanceRecords)
        // .where(
        //   eq(zuvyStudentAttendanceRecords.status, AttendanceStatus.PRESENT),
        // );

        .from(zuvyStudentAttendanceRecords)
        .where(
          and(
            eq(zuvyStudentAttendanceRecords.status, AttendanceStatus.PRESENT),

            scope
              ? eq(zuvyStudentAttendanceRecords.userId, BigInt(scope.userId))
              : sql`TRUE`,

            scope
              ? eq(zuvyStudentAttendanceRecords.bootcampId, scope.bootcampId)
              : sql`TRUE`,
          ),
        );

      // userId + sessionId => attended
      const attendedSessions = new Set(
        attendanceRecords.map(
          (attendance) => `${attendance.userId}-${attendance.sessionId}`,
        ),
      );

      for (const completion of recordingCompletions) {
        if (
          !completion.userId ||
          !completion.bootcampId ||
          !completion.chapterId ||
          !completion.sessionId
        ) {
          continue;
        }

        const key = `${completion.userId}-${completion.bootcampId}`;

        // Did learner attend the live session?
        const attended = attendedSessions.has(
          `${completion.userId}-${completion.sessionId}`,
        );

        /*
         * Rules:
         *
         * PRESENT + recording watched
         * -> recording points = 0
         *
         * ABSENT + recording watched
         * -> recording points = 5
         *
         * ABSENT + recording not watched
         * -> this completion does not exist here
         * -> recording points = 0
         */
        const recordingPoints = attended ? 0 : 5;

        const entry = recordingMap.get(key) || {
          chapterPoints: new Map<number, number>(),
          recordingPoints: 0,
          lastActivityAt: completion.completedAt || new Date().toISOString(),
        };

        if (recordingPoints > 0) {
          entry.chapterPoints.set(completion.chapterId, recordingPoints);

          entry.recordingPoints += recordingPoints;
        }

        entry.lastActivityAt = completion.completedAt || entry.lastActivityAt;

        recordingMap.set(key, entry);
      }

      this.logger.log(
        `Processed recording points for ${recordingMap.size} learner-bootcamp combinations`,
      );

      return recordingMap;
    } catch (error) {
      this.logger.error(
        `Error calculating recording points: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );

      return recordingMap;
    }
  }

  // Calculate assignment points including the on-time bonus.
  private async calculateAssignmentPoints(scope?: CalculationScope): Promise<
    Map<
      string,
      {
        chapterPoints: Map<number, number>;
        assignmentPoints: number;
        lastActivityAt: string;
      }
    >
  > {
    const assignmentMap = new Map<
      string,
      {
        chapterPoints: Map<number, number>;
        assignmentPoints: number;
        lastActivityAt: string;
      }
    >();

    try {
      const assignmentSubmissions = await db
        .select({
          userId: zuvyAssignmentSubmission.userId,
          bootcampId: zuvyAssignmentSubmission.bootcampId,
          chapterId: zuvyAssignmentSubmission.chapterId,
          createdAt: zuvyAssignmentSubmission.createdAt,
          timeLimit: zuvyAssignmentSubmission.timeLimit,
        })
        .from(zuvyAssignmentSubmission)
        .innerJoin(
          zuvyBootcamps,
          eq(zuvyAssignmentSubmission.bootcampId, zuvyBootcamps.id),
        )
        .where(
          and(
            sql`${zuvyAssignmentSubmission.bootcampId} IS NOT NULL`,
            scope
              ? eq(zuvyAssignmentSubmission.userId, scope.userId)
              : sql`TRUE`,
            scope
              ? eq(zuvyAssignmentSubmission.bootcampId, scope.bootcampId)
              : sql`TRUE`,
            scope
              ? eq(zuvyAssignmentSubmission.chapterId, scope.chapterId)
              : sql`TRUE`,
          ),
        );

      if (assignmentSubmissions.length === 0) {
        this.logger.log('No assignment submissions found');
        return assignmentMap;
      }

      this.logger.log(
        `Found ${assignmentSubmissions.length} assignment submissions`,
      );

      for (const submission of assignmentSubmissions) {
        if (
          !submission.userId ||
          !submission.bootcampId ||
          !submission.chapterId
        ) {
          continue;
        }

        const key = `${submission.userId}-${submission.bootcampId}`;

        const attemptPoints = 5;

        const bonusPoints =
          submission.createdAt &&
          submission.timeLimit &&
          new Date(submission.createdAt).getTime() <=
            new Date(submission.timeLimit).getTime()
            ? 5
            : 0;

        const totalAssignmentPoints = attemptPoints + bonusPoints;

        const entry = assignmentMap.get(key) || {
          chapterPoints: new Map<number, number>(),
          assignmentPoints: 0,
          lastActivityAt: new Date().toISOString(),
        };

        entry.assignmentPoints += totalAssignmentPoints;

        const currentChapterPoints =
          entry.chapterPoints.get(submission.chapterId) ?? 0;

        entry.chapterPoints.set(
          submission.chapterId,
          currentChapterPoints + totalAssignmentPoints,
        );

        entry.lastActivityAt = submission.createdAt || new Date().toISOString();

        assignmentMap.set(key, entry);
      }

      this.logger.log(
        `Processed assignments for ${assignmentMap.size} learner-bootcamp combinations`,
      );
      return assignmentMap;
    } catch (error) {
      this.logger.error(
        `Error calculating assignment points: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );
      return assignmentMap;
    }
  }

  // Calculate points for completed video chapters.
  private async calculateVideoPoints(scope?: CalculationScope): Promise<
    Map<
      string,
      {
        chapterPoints: Map<number, number>;
        videoPoints: number;
        lastActivityAt: string;
      }
    >
  > {
    const videoMap = new Map<
      string,
      {
        chapterPoints: Map<number, number>;
        videoPoints: number;
        lastActivityAt: string;
      }
    >();

    try {
      const videoCompletions = await db
        .select({
          userId: zuvyChapterTracking.userId,
          chapterId: zuvyChapterTracking.chapterId,
          bootcampId: zuvyCourseModules.bootcampId,
          completedAt: zuvyChapterTracking.completedAt,
        })
        .from(zuvyChapterTracking)
        .leftJoin(
          zuvyModuleChapter,
          eq(zuvyChapterTracking.chapterId, zuvyModuleChapter.id),
        )
        .leftJoin(
          zuvyCourseModules,
          eq(zuvyModuleChapter.moduleId, zuvyCourseModules.id),
        )
        .where(
          and(
            eq(zuvyModuleChapter.topicId, 1),
            sql`${zuvyCourseModules.bootcampId} IS NOT NULL`,
            scope
              ? eq(zuvyChapterTracking.userId, BigInt(scope.userId))
              : sql`TRUE`,
            scope
              ? eq(zuvyCourseModules.bootcampId, scope.bootcampId)
              : sql`TRUE`,
            scope
              ? eq(zuvyChapterTracking.chapterId, scope.chapterId)
              : sql`TRUE`,
          ),
        );

      const completionsByLearnerBootcamp = new Map<string, Set<number>>();

      for (const completion of videoCompletions) {
        if (
          !completion.userId ||
          !completion.bootcampId ||
          !completion.chapterId
        ) {
          continue;
        }

        const key = `${completion.userId}-${completion.bootcampId}`;

        if (!completionsByLearnerBootcamp.has(key)) {
          completionsByLearnerBootcamp.set(key, new Set());
        }

        completionsByLearnerBootcamp.get(key)!.add(completion.chapterId);

        videoMap.set(key, {
          chapterPoints: new Map<number, number>(),
          videoPoints: 0,
          lastActivityAt: completion.completedAt || new Date().toISOString(),
        });
      }

      for (const [key, chapterSet] of completionsByLearnerBootcamp) {
        const pointsPerVideo = 10;

        const entry = videoMap.get(key);

        if (entry) {
          for (const chapterId of chapterSet) {
            entry.chapterPoints.set(chapterId, pointsPerVideo);
          }

          entry.videoPoints = chapterSet.size * pointsPerVideo;
        }
      }

      return videoMap;
    } catch (error) {
      this.logger.error(
        `Error calculating video points: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );

      return videoMap;
    }
  }

  // Calculate points for completed article chapters.
  private async calculateArticlePoints(scope?: CalculationScope): Promise<
    Map<
      string,
      {
        chapterPoints: Map<number, number>;
        articlePoints: number;
        lastActivityAt: string;
      }
    >
  > {
    const articleMap = new Map<
      string,
      {
        chapterPoints: Map<number, number>;
        articlePoints: number;
        lastActivityAt: string;
      }
    >();

    try {
      const articleCompletions = await db
        .select({
          userId: zuvyChapterTracking.userId,
          chapterId: zuvyChapterTracking.chapterId,
          bootcampId: zuvyCourseModules.bootcampId,
          completedAt: zuvyChapterTracking.completedAt,
        })
        .from(zuvyChapterTracking)
        .leftJoin(
          zuvyModuleChapter,
          eq(zuvyChapterTracking.chapterId, zuvyModuleChapter.id),
        )
        .leftJoin(
          zuvyCourseModules,
          eq(zuvyModuleChapter.moduleId, zuvyCourseModules.id),
        )
        .where(
          and(
            eq(zuvyModuleChapter.topicId, 2),
            sql`${zuvyCourseModules.bootcampId} IS NOT NULL`,
            scope
              ? eq(zuvyChapterTracking.userId, BigInt(scope.userId))
              : sql`TRUE`,
            scope
              ? eq(zuvyCourseModules.bootcampId, scope.bootcampId)
              : sql`TRUE`,
            scope
              ? eq(zuvyChapterTracking.chapterId, scope.chapterId)
              : sql`TRUE`,
          ),
        );

      const completionsByLearnerBootcamp = new Map<string, Set<number>>();

      for (const completion of articleCompletions) {
        if (
          !completion.userId ||
          !completion.bootcampId ||
          !completion.chapterId
        ) {
          continue;
        }

        const key = `${completion.userId}-${completion.bootcampId}`;

        if (!completionsByLearnerBootcamp.has(key)) {
          completionsByLearnerBootcamp.set(key, new Set());
        }

        completionsByLearnerBootcamp.get(key)!.add(completion.chapterId);

        articleMap.set(key, {
          chapterPoints: new Map<number, number>(),
          articlePoints: 0,
          lastActivityAt: completion.completedAt || new Date().toISOString(),
        });
      }

      for (const [key, chapterSet] of completionsByLearnerBootcamp) {
        const pointsPerArticle = 10;

        const entry = articleMap.get(key);

        if (entry) {
          for (const chapterId of chapterSet) {
            entry.chapterPoints.set(chapterId, pointsPerArticle);
          }

          entry.articlePoints = chapterSet.size * pointsPerArticle;
        }
      }

      return articleMap;
    } catch (error) {
      this.logger.error(
        `Error calculating article points: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );

      return articleMap;
    }
  }

  async getChapterWisePoints(
    userId: number,
    bootcampId: number,
    chapterIds: number[],
  ): Promise<{
    chapterPointsMap: Map<number, number>;
    assignmentBreakdownMap: Map<
      number,
      {
        assignment: number;
        bonus: number;
        performance: number;
      }
    >;
  }> {
    const chapterPointsMap = new Map<number, number>();
    const assignmentBreakdownMap = new Map<
      number,
      {
        assignment: number;
        bonus: number;
        performance: number;
      }
    >();

    if (!chapterIds.length) {
      return {
        chapterPointsMap,
        assignmentBreakdownMap,
      };
    }

    for (const chapterId of chapterIds) {
      chapterPointsMap.set(chapterId, 0);
    }

    const persistedChapterPoints = await db
      .select({
        chapterId: zuvyLearnerLeaderboardChapterPoints.chapterId,
        points: zuvyLearnerLeaderboardChapterPoints.points,
      })
      .from(zuvyLearnerLeaderboardChapterPoints)
      .where(
        and(
          eq(zuvyLearnerLeaderboardChapterPoints.learnerId, userId),
          eq(zuvyLearnerLeaderboardChapterPoints.bootcampId, bootcampId),
          inArray(zuvyLearnerLeaderboardChapterPoints.chapterId, chapterIds),
        ),
      );

    for (const chapterPoint of persistedChapterPoints) {
      chapterPointsMap.set(chapterPoint.chapterId, chapterPoint.points ?? 0);
    }

    return {
      chapterPointsMap,
      assignmentBreakdownMap,
    };
  }

  // Merge chapter points from different activities.
  private mergeChapterPoints(
    learnerId: number,
    bootcampId: number,
    chapterPointsByKey: Map<string, Map<number, number>>,
    entry?: { chapterPoints: Map<number, number> },
  ): void {
    if (!entry?.chapterPoints?.size) {
      return;
    }

    const learnerBootcampKey = `${learnerId}-${bootcampId}`;
    const mergedChapterPoints =
      chapterPointsByKey.get(learnerBootcampKey) ?? new Map<number, number>();

    for (const [chapterId, points] of entry.chapterPoints.entries()) {
      const currentPoints = mergedChapterPoints.get(chapterId) ?? 0;
      mergedChapterPoints.set(chapterId, currentPoints + points);
    }

    chapterPointsByKey.set(learnerBootcampKey, mergedChapterPoints);
  }

  // Create rows for chapter-wise points.
  private async buildChapterPointRows(
    allKeys: Set<string>,
    assessmentMap: Map<
      string,
      {
        chapterPoints: Map<number, number>;
        assessmentPoints: number;
        lastActivityAt: string;
      }
    >,
    codingMap: Map<
      string,
      {
        chapterPoints: Map<number, number>;
        codingPoints: number;
        lastActivityAt: string;
      }
    >,
    quizMap: Map<
      string,
      {
        chapterPoints: Map<number, number>;
        quizPoints: number;
        lastActivityAt: string;
      }
    >,
    recordingMap: Map<
      string,
      {
        chapterPoints: Map<number, number>;
        recordingPoints: number;
        lastActivityAt: string;
      }
    >,
    assignmentMap: Map<
      string,
      {
        chapterPoints: Map<number, number>;
        assignmentPoints: number;
        lastActivityAt: string;
      }
    >,
    videoMap: Map<
      string,
      {
        chapterPoints: Map<number, number>;
        videoPoints: number;
        lastActivityAt: string;
      }
    >,
    articleMap: Map<
      string,
      {
        chapterPoints: Map<number, number>;
        articlePoints: number;
        lastActivityAt: string;
      }
    >,
  ): Promise<ChapterPointRow[]> {
    const chapterPointsByKey = new Map<string, Map<number, number>>();

    for (const key of allKeys) {
      const [learnerId, bootcampId] = key.split('-').map(Number);

      this.mergeChapterPoints(
        learnerId,
        bootcampId,
        chapterPointsByKey,
        assessmentMap.get(key),
      );
      this.mergeChapterPoints(
        learnerId,
        bootcampId,
        chapterPointsByKey,
        codingMap.get(key),
      );
      this.mergeChapterPoints(
        learnerId,
        bootcampId,
        chapterPointsByKey,
        quizMap.get(key),
      );
      this.mergeChapterPoints(
        learnerId,
        bootcampId,
        chapterPointsByKey,
        recordingMap.get(key),
      );
      this.mergeChapterPoints(
        learnerId,
        bootcampId,
        chapterPointsByKey,
        assignmentMap.get(key),
      );
      this.mergeChapterPoints(
        learnerId,
        bootcampId,
        chapterPointsByKey,
        videoMap.get(key),
      );
      this.mergeChapterPoints(
        learnerId,
        bootcampId,
        chapterPointsByKey,
        articleMap.get(key),
      );
    }

    const chapterIds = Array.from(
      new Set(
        Array.from(chapterPointsByKey.values()).flatMap((chapterPoints) =>
          Array.from(chapterPoints.keys()),
        ),
      ),
    );

    const topicIdByChapter = new Map<number, number | null>();

    if (chapterIds.length > 0) {
      const chapters = await db
        .select({
          chapterId: zuvyModuleChapter.id,
          topicId: zuvyModuleChapter.topicId,
        })
        .from(zuvyModuleChapter)
        .where(inArray(zuvyModuleChapter.id, chapterIds));

      for (const chapter of chapters) {
        topicIdByChapter.set(chapter.chapterId, chapter.topicId ?? null);
      }
    }

    const rows: ChapterPointRow[] = [];

    for (const [key, chapterPoints] of chapterPointsByKey.entries()) {
      const [learnerId, bootcampId] = key.split('-').map(Number);

      for (const [chapterId, points] of chapterPoints.entries()) {
        rows.push({
          learnerId,
          bootcampId,
          chapterId,
          topicId: topicIdByChapter.get(chapterId) ?? null,
          points,
        });
      }
    }

    return rows;
  }

  // Save or update chapter-wise points.
  private async upsertChapterPointRows(
    tx: any,
    chapterPointRows: ChapterPointRow[],
  ): Promise<void> {
    const chunkSize = 100;

    for (let i = 0; i < chapterPointRows.length; i += chunkSize) {
      const chunk = chapterPointRows.slice(i, i + chunkSize);

      await tx
        .insert(zuvyLearnerLeaderboardChapterPoints)
        .values(
          chunk.map((row) => ({
            learnerId: row.learnerId,
            bootcampId: row.bootcampId,
            chapterId: row.chapterId,
            topicId: row.topicId,
            points: row.points,
            updatedAt: sql`NOW()`,
          })),
        )
        .onConflictDoUpdate({
          target: [
            zuvyLearnerLeaderboardChapterPoints.learnerId,
            zuvyLearnerLeaderboardChapterPoints.bootcampId,
            zuvyLearnerLeaderboardChapterPoints.chapterId,
          ],
          set: {
            topicId: sql`excluded.topic_id`,
            points: sql`excluded.points`,
            updatedAt: sql`NOW()`,
          },
        });
    }
  }

  // Get the leaderboard column for a chapter topic.
  private getLeaderboardPointColumnForTopic(
    topicId: number | null,
  ): LeaderboardPointColumn | null {
    switch (topicId) {
      case 1:
        return 'videoPoints';
      case 2:
        return 'articlePoints';
      case 3:
        return 'codingPoints';
      case 4:
        return 'quizPoints';
      case 5:
        return 'assignmentPoints';
      case 6:
        return 'assessmentPoints';
      case 7:
        return 'attendancePoints';
      case 8:
        return 'recordingPoints';
      default:
        return null;
    }
  }

  // Get calculated points for a completed chapter.
  private async getExistingCalculatedChapterPointsForCompletion(
    scope: CalculationScope,
    topicId: number | null,
  ): Promise<{ topicId: number | null; points: number }> {
    const key = `${scope.userId}-${scope.bootcampId}`;
    let entry:
      | {
          chapterPoints: Map<number, number>;
        }
      | undefined;

    switch (topicId) {
      case 1:
        entry = (await this.calculateVideoPoints(scope)).get(key);
        break;
      case 2:
        entry = (await this.calculateArticlePoints(scope)).get(key);
        break;
      case 3:
        const codingResult = await this.calculateCodingPoints(scope);

        entry = codingResult.get(key);

        break;
      case 4:
        entry = (await this.calculateQuizPoints(scope)).get(key);
        break;
      case 5:
        entry = (await this.calculateAssignmentPoints(scope)).get(key);
        break;
      case 6:
        entry = (await this.calculateAssessmentPoints(scope)).get(key);
        break;
      case 7:
        entry = (await this.calculateAttendancePoints(scope)).get(key);
        break;

      case 8:
        entry = (await this.calculateRecordingPoints(scope)).get(key);
        break;
      default:
        return { topicId, points: 0 };
    }

    const requestedChapterId = Number(scope.chapterId);

    return {
      topicId,
      points: entry?.chapterPoints.get(requestedChapterId) ?? 0,
    };
  }

  // Update chapter points and the main leaderboard.
  async updateChapterPointsForCompletion(
    userId: number,
    bootcampId: number,
    moduleId: number,
    chapterId: number,
    topicId: number | null,
  ): Promise<void> {
    const { points } =
      await this.getExistingCalculatedChapterPointsForCompletion(
        {
          userId,
          bootcampId,
          moduleId,
          chapterId,
        },
        topicId,
      );

    const pointColumn = this.getLeaderboardPointColumnForTopic(topicId);

    if (!pointColumn) {
      return;
    }

    await db.transaction(async (tx) => {
      const existingChapterPoint = await tx
        .select({
          points: zuvyLearnerLeaderboardChapterPoints.points,
        })
        .from(zuvyLearnerLeaderboardChapterPoints)
        .where(
          and(
            eq(zuvyLearnerLeaderboardChapterPoints.learnerId, userId),
            eq(zuvyLearnerLeaderboardChapterPoints.bootcampId, bootcampId),
            eq(zuvyLearnerLeaderboardChapterPoints.chapterId, chapterId),
          ),
        )
        .limit(1);

      const previousPoints = existingChapterPoint[0]?.points ?? 0;
      const pointsDelta = points - previousPoints;

      await this.upsertChapterPointRows(tx, [
        {
          learnerId: userId,
          bootcampId,
          chapterId,
          topicId,
          points,
        },
      ]);

      if (pointsDelta === 0) {
        return;
      }

      await tx
        .insert(zuvyLearnerLeaderboard)
        .values({
          learnerId: userId,
          bootcampId,
          [pointColumn]: points,
          totalPoints: points,
          lastActivityAt: sql`NOW()`,
          updatedAt: sql`NOW()`,
        } as any)
        .onConflictDoUpdate({
          target: [
            zuvyLearnerLeaderboard.learnerId,
            zuvyLearnerLeaderboard.bootcampId,
          ],
          set: {
            [pointColumn]: sql`COALESCE(${zuvyLearnerLeaderboard[pointColumn]}, 0) + ${pointsDelta}`,
            totalPoints: sql`COALESCE(${zuvyLearnerLeaderboard.totalPoints}, 0) + ${pointsDelta}`,
            lastActivityAt: sql`NOW()`,
            updatedAt: sql`NOW()`,
          } as any,
        });
    });
  }

  // Get the leaderboard for a bootcamp.
  async getBootcampLeaderboard(
    bootcampId?: number,
    limit: number = 100,
  ): Promise<
    Array<{
      learnerId: number;
      name: string;
      assessmentPoints: number;
      codingPoints: number;
      quizPoints: number;
      attendancePoints: number;
      recordingPoints: number;
      assignmentPoints: number;
      articlePoints: number;
      videoPoints: number;
      totalPoints: number;
      lastActivityAt: string;
    }>
  > {
    try {
      if (bootcampId) {
        const leaderboard = await db
          .select({
            learnerId: zuvyBatchEnrollments.userId,
            name: users.name,

            assessmentPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.assessmentPoints}, 0)`,
            codingPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.codingPoints}, 0)`,
            quizPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.quizPoints}, 0)`,
            attendancePoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.attendancePoints}, 0)`,
            recordingPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.recordingPoints}, 0)`,
            articlePoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.articlePoints}, 0)`,
            videoPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.videoPoints}, 0)`,
            assignmentPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.assignmentPoints}, 0)`,
            totalPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.totalPoints}, 0)`,
            lastActivityAt: zuvyLearnerLeaderboard.lastActivityAt,
          })
          .from(zuvyBatchEnrollments)
          .leftJoin(users, eq(users.id, zuvyBatchEnrollments.userId))
          .leftJoin(
            zuvyLearnerLeaderboard,
            and(
              eq(zuvyLearnerLeaderboard.learnerId, zuvyBatchEnrollments.userId),
              eq(zuvyLearnerLeaderboard.bootcampId, bootcampId),
            ),
          )
          .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId))
          .orderBy(sql`COALESCE(${zuvyLearnerLeaderboard.totalPoints}, 0) DESC`)
          .limit(limit);
        return leaderboard.map((row) => ({
          ...row,
          learnerId: Number(row.learnerId),
        }));
      } else {
        const leaderboard = await db
          .select({
            learnerId: zuvyLearnerLeaderboard.learnerId,
            name: users.name,
            assessmentPoints: zuvyLearnerLeaderboard.assessmentPoints,
            codingPoints: zuvyLearnerLeaderboard.codingPoints,
            quizPoints: zuvyLearnerLeaderboard.quizPoints,
            attendancePoints: zuvyLearnerLeaderboard.attendancePoints,
            recordingPoints: zuvyLearnerLeaderboard.recordingPoints,
            articlePoints: zuvyLearnerLeaderboard.articlePoints,
            videoPoints: zuvyLearnerLeaderboard.videoPoints,
            assignmentPoints: zuvyLearnerLeaderboard.assignmentPoints,
            totalPoints: zuvyLearnerLeaderboard.totalPoints,
            lastActivityAt: zuvyLearnerLeaderboard.lastActivityAt,
          })
          .from(zuvyLearnerLeaderboard)
          .leftJoin(users, eq(users.id, zuvyLearnerLeaderboard.learnerId))
          .orderBy(sql`${zuvyLearnerLeaderboard.totalPoints} DESC`)
          .limit(limit);

        return leaderboard;
      }
    } catch (error) {
      this.logger.error(
        `Error fetching course leaderboard: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }
      return [];
    }
  }

  // Get a learner's leaderboard details.
  async getLearnerPosition(
    learnerId: number,
    bootcampId: number,
  ): Promise<{
    learnerId: number;
    name: string;
    assessmentPoints: number;
    codingPoints: number;
    quizPoints: number;
    attendancePoints: number;
    recordingPoints: number;
    assignmentPoints: number;
    articlePoints: number;
    videoPoints: number;
    totalPoints: number;
    lastActivityAt: string;
  } | null> {
    try {
      const learnerEntry = await db
        .select({
          learnerId: zuvyBatchEnrollments.userId,
          name: users.name,

          assessmentPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.assessmentPoints}, 0)`,
          codingPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.codingPoints}, 0)`,
          quizPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.quizPoints}, 0)`,
          attendancePoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.attendancePoints}, 0)`,
          recordingPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.recordingPoints}, 0)`,
          assignmentPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.assignmentPoints}, 0)`,
          articlePoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.articlePoints}, 0)`,
          videoPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.videoPoints}, 0)`,
          totalPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.totalPoints}, 0)`,
          lastActivityAt: zuvyLearnerLeaderboard.lastActivityAt,
        })
        .from(zuvyBatchEnrollments)
        .leftJoin(users, eq(users.id, zuvyBatchEnrollments.userId))
        .leftJoin(
          zuvyLearnerLeaderboard,
          and(
            eq(zuvyLearnerLeaderboard.learnerId, zuvyBatchEnrollments.userId),
            eq(zuvyLearnerLeaderboard.bootcampId, bootcampId),
          ),
        )
        .where(
          and(
            eq(zuvyBatchEnrollments.userId, BigInt(learnerId)),
            eq(zuvyBatchEnrollments.bootcampId, bootcampId),
          ),
        )
        .limit(1);

      if (learnerEntry.length === 0) {
        return null;
      }

      return {
        // learnerId: learnerEntry[0].learnerId,
        learnerId: Number(learnerEntry[0].learnerId),
        name: learnerEntry[0].name || '',
        assessmentPoints: learnerEntry[0].assessmentPoints,
        codingPoints: learnerEntry[0].codingPoints,
        quizPoints: learnerEntry[0].quizPoints,
        attendancePoints: learnerEntry[0].attendancePoints,
        recordingPoints: learnerEntry[0].recordingPoints,
        assignmentPoints: learnerEntry[0].assignmentPoints,
        articlePoints: learnerEntry[0].articlePoints,
        videoPoints: learnerEntry[0].videoPoints,
        totalPoints: learnerEntry[0].totalPoints,
        lastActivityAt: learnerEntry[0].lastActivityAt,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching learner position: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      return null;
    }
  }

  private calculateCodingAttemptPoints(): number {
    return 10;
  }

  private calculateTotalCodingPoints(isAccepted: boolean): {
    attemptPoints: number;
    codingPoints: number;
    totalCodingPoints: number;
  } {
    if (!isAccepted) {
      return {
        attemptPoints: 0,
        codingPoints: 0,
        totalCodingPoints: 0,
      };
    }

    const attemptPoints = this.calculateCodingAttemptPoints();
    const codingPoints = 10;

    return {
      attemptPoints,
      codingPoints,
      totalCodingPoints: attemptPoints + codingPoints,
    };
  }

  // Get the ranked leaderboard for a learner's bootcamp.
  async getStudentLeaderboard(
    learnerId: number | string,
    bootcampId: number,
    limit: number = 100,
  ): Promise<{
    leaderboard: Array<{
      learnerId: number;
      name: string;
      rank: number;
      totalPoints: number;
    }>;
    currentLearner: {
      learnerId: number;
      name: string;
      rank: number;
      totalPoints: number;
    } | null;
    totalLearners: number;
  }> {
    try {
      const normalizedLearnerId = Number(learnerId);

      if (Number.isNaN(normalizedLearnerId)) {
        throw new BadRequestException('Invalid learner ID');
      }

      const enrollment = await db
        .select({
          id: zuvyBatchEnrollments.id,
        })
        .from(zuvyBatchEnrollments)
        .where(
          and(
            eq(zuvyBatchEnrollments.userId, BigInt(normalizedLearnerId)),
            eq(zuvyBatchEnrollments.bootcampId, bootcampId),
          ),
        )
        .limit(1);
      if (enrollment.length === 0) {
        throw new ForbiddenException('You are not enrolled in this bootcamp.');
      }
      const totalLearnersResult = await db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId));
      const totalLearners = Number(totalLearnersResult[0]?.count || 0);
      const allLearners = await db
        .select({
          learnerId: zuvyBatchEnrollments.userId,
          name: users.name,
          totalPoints: sql<number>`COALESCE(${zuvyLearnerLeaderboard.totalPoints}, 0)`,
        })
        .from(zuvyBatchEnrollments)
        .leftJoin(users, eq(users.id, zuvyBatchEnrollments.userId))
        .leftJoin(
          zuvyLearnerLeaderboard,
          and(
            eq(zuvyLearnerLeaderboard.learnerId, zuvyBatchEnrollments.userId),
            eq(zuvyLearnerLeaderboard.bootcampId, bootcampId),
          ),
        )
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId))
        .orderBy(sql`COALESCE(${zuvyLearnerLeaderboard.totalPoints}, 0) DESC`);

      const learnersWithRanks = allLearners.map((learner, index) => ({
        learnerId: Number(learner.learnerId),
        name: learner.name,
        totalPoints: learner.totalPoints,
        rank: index + 1,
      }));

      // Get top learners based on limit
      const topLearners = learnersWithRanks.slice(0, limit);

      // Find current learner in all learners
      const currentLearnerData = learnersWithRanks.find(
        (learner) => Number(learner.learnerId) === normalizedLearnerId,
      );

      if (currentLearnerData) {
        return {
          leaderboard: topLearners,
          currentLearner: currentLearnerData,
          totalLearners,
        };
      }
      return {
        leaderboard: topLearners,
        currentLearner: null,
        totalLearners,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching student leaderboard: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      return {
        leaderboard: [],
        currentLearner: null,
        totalLearners: 0,
      };
    }
  }
}
