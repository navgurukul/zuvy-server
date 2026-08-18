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
  | 'assignmentPoints'
  | 'articlePoints'
  | 'videoPoints';

@Injectable()
export class LeaderboardService {
  private logger = new Logger(LeaderboardService.name);
  private getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

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

  private calculateSubmissionAttemptPoints(): number {
    return 10;
  }

  private calculateOnTimeBonusPoints(
    submittedAt: string | null,
    deadline: string | null,
  ): number {
    if (!submittedAt || !deadline) {
      return 0;
    }

    try {
      const submissionTime = new Date(submittedAt).getTime();
      const deadlineTime = new Date(deadline).getTime();

      if (submissionTime <= deadlineTime) {
        return 5;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to parse deadline dates: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );
    }

    return 0;
  }

  private calculateTotalAssessmentPoints(
    percentage: number,
    submittedAt: string | null,
    deadline: string | null,
  ): {
    attemptPoints: number;
    bonusPoints: number;
    percentagePoints: number;
    totalPoints: number;
  } {
    const attemptPoints = this.calculateSubmissionAttemptPoints();
    const bonusPoints = this.calculateOnTimeBonusPoints(submittedAt, deadline);
    const percentagePoints = this.calculatePercentagePoints(percentage || 0);

    return {
      attemptPoints,
      bonusPoints,
      percentagePoints,
      totalPoints: attemptPoints + bonusPoints + percentagePoints,
    };
  }

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
          bootcampId: zuvyOutsourseAssessments.bootcampId,
          chapterId: zuvyOutsourseAssessments.chapterId,
          submittedAt: zuvyAssessmentSubmission.submitedAt,
          deadline: zuvyOutsourseAssessments.deadline,
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

      for (const submission of assessmentSubmissions) {
        if (!submission.userId || !submission.bootcampId) {
          continue;
        }

        const key = `${submission.userId}-${submission.bootcampId}`;

        const pointsBreakdown = this.calculateTotalAssessmentPoints(
          submission.percentage || 0,
          submission.submittedAt,
          submission.deadline,
        );

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

  private async calculateCodingPoints(scope?: CalculationScope): Promise<
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
          bootcampId: zuvyOutsourseCodingQuestions.bootcampId,
          chapterId: zuvyOutsourseCodingQuestions.chapterId,
          topicId: zuvyModuleChapter.topicId,
          submittedAt: zuvyPracticeCode.createdAt,
          deadline: zuvyOutsourseAssessments.deadline,
          practiceCodeId: zuvyPracticeCode.id,
          status: zuvyPracticeCode.status,
        })
        .from(zuvyPracticeCode)
        .leftJoin(
          zuvyOutsourseCodingQuestions,
          eq(
            zuvyPracticeCode.codingOutsourseId,
            zuvyOutsourseCodingQuestions.id,
          ),
        )

        .innerJoin(
          zuvyBootcamps,
          eq(zuvyOutsourseCodingQuestions.bootcampId, zuvyBootcamps.id),
        )

        .leftJoin(
          zuvyOutsourseAssessments,
          eq(
            zuvyOutsourseCodingQuestions.assessmentOutsourseId,
            zuvyOutsourseAssessments.id,
          ),
        )
        .leftJoin(
          zuvyModuleChapter,
          eq(zuvyOutsourseCodingQuestions.chapterId, zuvyModuleChapter.id),
        )
        .where(
          and(
            sql`${zuvyOutsourseCodingQuestions.bootcampId} IS NOT NULL`,
            sql`${zuvyPracticeCode.status} = 'Accepted'`,
            scope
              ? eq(zuvyPracticeCode.userId, BigInt(scope.userId))
              : sql`TRUE`,
            scope
              ? eq(zuvyOutsourseCodingQuestions.bootcampId, scope.bootcampId)
              : sql`TRUE`,
            scope
              ? eq(zuvyOutsourseCodingQuestions.chapterId, scope.chapterId)
              : sql`TRUE`,
          ),
        );

      if (codingSubmissions.length === 0) {
        return codingMap;
      }
      for (const submission of codingSubmissions) {
        if (
          !submission.userId ||
          !submission.bootcampId ||
          !submission.practiceCodeId
        ) {
          continue;
        }

        const isAccepted = this.isAcceptedCodingSubmission(submission.status);

        const pointsBreakdown = this.calculateTotalCodingPoints(
          submission.submittedAt,
          submission.deadline,
          isAccepted,
        );

        if (!isAccepted) {
          continue;
        }

        const key = `${submission.userId}-${submission.bootcampId}`;
        const entry = codingMap.get(key) || {
          chapterPoints: new Map<number, number>(),
          codingPoints: 0,
          lastActivityAt: new Date().toISOString(),
        };

        entry.codingPoints += pointsBreakdown.totalCodingPoints;

        if (submission.chapterId && submission.topicId === 3) {
          const currentChapterPoints =
            entry.chapterPoints.get(submission.chapterId) ?? 0;

          entry.chapterPoints.set(
            submission.chapterId,
            currentChapterPoints + pointsBreakdown.totalCodingPoints,
          );
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
      this.logger.log('Calculating quiz points...');

      const quizSubmissions = await db
        .select({
          userId: zuvyQuizTracking.userId,
          bootcampId: zuvyOutsourseQuizzes.bootcampId,
          mcqScore: zuvyAssessmentSubmission.mcqScore,
          requiredMCQScore: zuvyAssessmentSubmission.requiredMCQScore,
          submittedAt: zuvyAssessmentSubmission.submitedAt,
          deadline: zuvyOutsourseAssessments.deadline,
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

      this.logger.log(
        `Found ${quizSubmissions.length} quiz submissions and ${standaloneQuizCompletions.length} standalone completions`,
      );

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

        const attemptPoints = 5;
        const bonusPoints = this.calculateQuizOnTimeBonusPoints(
          submission.submittedAt,
          submission.deadline,
        );
        const scorePoints = this.calculateQuizScorePoints(quizPercentage);

        const totalQuizPoints = attemptPoints + bonusPoints + scorePoints;

        const entry = quizMap.get(key) || {
          chapterPoints: new Map<number, number>(),
          quizPoints: 0,
          lastActivityAt: new Date().toISOString(),
        };

        entry.quizPoints += totalQuizPoints;
        entry.lastActivityAt =
          submission.submittedAt ||
          submission.createdAt ||
          new Date().toISOString();

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
            entry.chapterPoints.set(chapterId, 5);
          }
          entry.quizPoints += chapterSet.size * 5;
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

  private calculateQuizOnTimeBonusPoints(
    submittedAt: string | null,
    deadline: string | null,
  ): number {
    if (!submittedAt || !deadline) {
      return 0;
    }

    try {
      const submissionTime = new Date(submittedAt).getTime();
      const deadlineTime = new Date(deadline).getTime();

      if (submissionTime <= deadlineTime) {
        return 3;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to parse quiz deadline: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );
    }

    return 0;
  }

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

  private async calculateAttendancePoints(): Promise<
    Map<
      string,
      {
        attendancePoints: number;
        lastActivityAt: string;
      }
    >
  > {
    const attendanceMap = new Map<
      string,
      {
        attendancePoints: number;
        lastActivityAt: string;
      }
    >();

    try {
      const attendanceRecords = await db
        .select({
          userId: zuvyStudentAttendanceRecords.userId,
          bootcampId: zuvyStudentAttendanceRecords.bootcampId,
          status: zuvyStudentAttendanceRecords.status,
          attendanceDate: zuvyStudentAttendanceRecords.attendanceDate,
          createdAt: zuvyStudentAttendanceRecords.createdAt,
        })
        .from(zuvyStudentAttendanceRecords)
        .where(
          and(
            eq(zuvyStudentAttendanceRecords.status, AttendanceStatus.PRESENT),
            sql`${zuvyStudentAttendanceRecords.bootcampId} IS NOT NULL`,
          ),
        );

      if (attendanceRecords.length === 0) {
        this.logger.log('No attendance records found');
        return attendanceMap;
      }

      this.logger.log(`Found ${attendanceRecords.length} attendance records`);

      for (const record of attendanceRecords) {
        if (!record.userId || !record.bootcampId) {
          continue;
        }

        const key = `${record.userId}-${record.bootcampId}`;

        const pointsPerSession = 10;

        const entry = attendanceMap.get(key) || {
          attendancePoints: 0,
          lastActivityAt: new Date().toISOString(),
        };

        entry.attendancePoints += pointsPerSession;
        entry.lastActivityAt = record.createdAt || new Date().toISOString();

        attendanceMap.set(key, entry);
      }

      this.logger.log(
        `Processed attendance for ${attendanceMap.size} learner-bootcamp combinations`,
      );
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
      const recordingCompletions = await db
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
          eq(zuvyChapterTracking.moduleId, zuvyCourseModules.id),
        )
        .where(
          and(
            sql`${zuvyModuleChapter.topicId} = 8`, // Filter for recording chapters (topic_id = 8)
            sql`${zuvyCourseModules.bootcampId} IS NOT NULL`,
            sql`${zuvyChapterTracking.completedAt} IS NOT NULL`, // Only completed chapters
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

      this.logger.log(
        `Found ${recordingCompletions.length} recording completion records`,
      );

      const completionsByLearnerBootcamp = new Map<string, Set<number>>();

      for (const completion of recordingCompletions) {
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

        const chapterSet = completionsByLearnerBootcamp.get(key);
        chapterSet.add(completion.chapterId);

        if (!recordingMap.has(key)) {
          recordingMap.set(key, {
            chapterPoints: new Map<number, number>(),
            recordingPoints: 0,
            lastActivityAt: completion.completedAt || new Date().toISOString(),
          });
        } else {
          const entry = recordingMap.get(key);
          entry.lastActivityAt = completion.completedAt || entry.lastActivityAt;
        }
      }

      for (const [key, chapterSet] of completionsByLearnerBootcamp.entries()) {
        const distinctChapterCount = chapterSet.size;
        const pointsPerRecording = 5;
        const totalRecordingPoints = distinctChapterCount * pointsPerRecording;

        const entry = recordingMap.get(key);
        entry.recordingPoints = totalRecordingPoints;

        for (const chapterId of chapterSet) {
          entry.chapterPoints.set(chapterId, pointsPerRecording);
        }
      }

      this.logger.log(
        `Processed recording completions for ${recordingMap.size} learner-bootcamp combinations`,
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
      case 8:
        return 'recordingPoints';
      default:
        return null;
    }
  }

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
        entry = (await this.calculateCodingPoints(scope)).get(key);
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

  async updateLeaderboard(): Promise<{
    success: boolean;
    message: string;
    updated: number;
    error?: string;
  }> {
    try {
      this.logger.log('Starting main leaderboard update...');

      const attendanceMap = await this.calculateAttendancePoints();

      const leaderboardMap = new Map<
        string,
        {
          learnerId: number;
          bootcampId: number;
          attendancePoints: number;
          lastActivityAt: string;
        }
      >();

      const allKeys = new Set<string>();
      attendanceMap.forEach((_, key) => allKeys.add(key));

      for (const key of allKeys) {
        const [learnerId, bootcampId] = key.split('-').map(Number);

        const attendanceEntry = attendanceMap.get(key);

        const attendancePoints = attendanceEntry?.attendancePoints || 0;

        const lastActivityAt =
          attendanceEntry?.lastActivityAt || new Date().toISOString();

        leaderboardMap.set(key, {
          learnerId,
          bootcampId,
          attendancePoints,
          lastActivityAt,
        });
      }

      if (leaderboardMap.size === 0) {
        this.logger.log('No leaderboard data to process');
        return {
          success: true,
          message: 'No leaderboard data to process',
          updated: 0,
        };
      }

      this.logger.log(
        `Processing ${leaderboardMap.size} unique learner-bootcamp combinations`,
      );

      const learnerIds = Array.from(
        new Set(Array.from(allKeys, (key) => Number(key.split('-')[0]))),
      );
      const bootcampIds = Array.from(
        new Set(Array.from(allKeys, (key) => Number(key.split('-')[1]))),
      );

      const existingEntries =
        learnerIds.length > 0 && bootcampIds.length > 0
          ? await db
              .select({
                id: zuvyLearnerLeaderboard.id,
                learnerId: zuvyLearnerLeaderboard.learnerId,
                bootcampId: zuvyLearnerLeaderboard.bootcampId,
                assessmentPoints: zuvyLearnerLeaderboard.assessmentPoints,
                codingPoints: zuvyLearnerLeaderboard.codingPoints,
                quizPoints: zuvyLearnerLeaderboard.quizPoints,
                attendancePoints: zuvyLearnerLeaderboard.attendancePoints,
                recordingPoints: zuvyLearnerLeaderboard.recordingPoints,
                assignmentPoints: zuvyLearnerLeaderboard.assignmentPoints,
                videoPoints: zuvyLearnerLeaderboard.videoPoints,
                articlePoints: zuvyLearnerLeaderboard.articlePoints,
                totalPoints: zuvyLearnerLeaderboard.totalPoints,
                lastActivityAt: zuvyLearnerLeaderboard.lastActivityAt,
              })
              .from(zuvyLearnerLeaderboard)
              .where(
                and(
                  inArray(zuvyLearnerLeaderboard.learnerId, learnerIds),
                  inArray(zuvyLearnerLeaderboard.bootcampId, bootcampIds),
                ),
              )
          : [];

      const existingEntryMap = new Map<
        string,
        (typeof existingEntries)[number]
      >();
      for (const existingEntry of existingEntries) {
        existingEntryMap.set(
          `${existingEntry.learnerId}-${existingEntry.bootcampId}`,
          existingEntry,
        );
      }

      let updatedCount = 0;
      const insertValues: any[] = [];
      const updateValues: Array<{ id: number; data: any }> = [];

      for (const entry of leaderboardMap.values()) {
        const existing = existingEntryMap.get(
          `${entry.learnerId}-${entry.bootcampId}`,
        );

        const attendanceEntry = attendanceMap.get(
          `${entry.learnerId}-${entry.bootcampId}`,
        );

        if (existing) {
          const newAttendancePoints =
            attendanceEntry?.attendancePoints ?? existing.attendancePoints;
          const attendanceDelta =
            newAttendancePoints - (existing.attendancePoints ?? 0);
          const totalPoints = (existing.totalPoints ?? 0) + attendanceDelta;

          // Only update if something changed
          const hasChanged =
            existing.attendancePoints !== newAttendancePoints ||
            existing.totalPoints !== totalPoints ||
            existing.lastActivityAt !== entry.lastActivityAt;

          if (hasChanged) {
            const updateData: any = {
              lastActivityAt: entry.lastActivityAt,
              updatedAt: new Date().toISOString(),
              totalPoints,
            };

            if (attendanceEntry)
              updateData.attendancePoints = attendanceEntry.attendancePoints;

            updateValues.push({
              id: existing.id,
              data: updateData,
            });
          } else {
            // Mark as processed even if skipped to match original updatedCount behavior
            updatedCount++;
          }
        } else {
          insertValues.push({
            learnerId: entry.learnerId,
            bootcampId: entry.bootcampId,
            attendancePoints: entry.attendancePoints,
            totalPoints: entry.attendancePoints,
            lastActivityAt: entry.lastActivityAt,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      await db.transaction(async (tx) => {
        // Execute inserts in batches/bulk if any
        if (insertValues.length > 0) {
          const chunkSize = 100;
          for (let i = 0; i < insertValues.length; i += chunkSize) {
            const chunk = insertValues.slice(i, i + chunkSize);
            await tx.insert(zuvyLearnerLeaderboard as any).values(chunk);
          }
          updatedCount += insertValues.length;
        }

        for (const updateValue of updateValues) {
          await tx
            .update(zuvyLearnerLeaderboard)
            .set(updateValue.data)
            .where(eq(zuvyLearnerLeaderboard.id, updateValue.id));
          updatedCount++;
        }
      });

      this.logger.log(
        `Successfully updated ${updatedCount} leaderboard entries`,
      );

      return {
        success: true,
        message: `Leaderboard updated successfully without chapter completion points`,
        updated: updatedCount,
      };
    } catch (error) {
      this.logger.error(
        `Error updating leaderboard: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );
      return {
        success: false,
        message: 'Failed to update leaderboard',
        updated: 0,
        error: this.getErrorMessage(error, 'Failed to update leaderboard'),
      };
    }
  }

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

  private calculateCodingOnTimeBonusPoints(
    submittedAt: string | null,
    deadline: string | null,
  ): number {
    if (!submittedAt || !deadline) {
      return 0;
    }

    try {
      const submissionTime = new Date(submittedAt).getTime();
      const deadlineTime = new Date(deadline).getTime();

      if (submissionTime <= deadlineTime) {
        return 3;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to parse coding deadline dates: ${this.getErrorMessage(
          error,
          'unknown error',
        )}`,
      );
    }

    return 0;
  }

  private isAcceptedCodingSubmission(status?: string | null): boolean {
    return (status ?? '').trim().toLowerCase() === 'accepted';
  }

  private calculateTestCasesPassedPoints(isAccepted: boolean): number {
    return isAccepted ? 15 : 0;
  }

  private calculateTotalCodingPoints(
    submittedAt: string | null,
    deadline: string | null,
    isAccepted: boolean,
  ): {
    attemptPoints: number;
    bonusPoints: number;
    testCasesPoints: number;
    totalCodingPoints: number;
  } {
    if (!isAccepted) {
      return {
        attemptPoints: 0,
        bonusPoints: 0,
        testCasesPoints: 0,
        totalCodingPoints: 0,
      };
    }

    const attemptPoints = this.calculateCodingAttemptPoints();
    const bonusPoints = this.calculateCodingOnTimeBonusPoints(
      submittedAt,
      deadline,
    );
    const testCasesPoints = this.calculateTestCasesPassedPoints(true);

    return {
      attemptPoints,
      bonusPoints,
      testCasesPoints,
      totalCodingPoints: attemptPoints + bonusPoints + testCasesPoints,
    };
  }

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

      // Add ranks to all learners
      // const learnersWithRanks = allLearners.map((learner, index) => ({
      //   ...learner,
      //   rank: index + 1,
      // }));

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
