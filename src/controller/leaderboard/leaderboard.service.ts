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
  zuvySessionRecordViews,
  zuvySessions,
  zuvyProjectTracking,
  AttendanceStatus,
  zuvyChapterTracking,
  zuvyModuleChapter,
  zuvyCourseModules,
  zuvyBootcamps,
  zuvyBatchEnrollments,
  zuvyAssignmentSubmission,
} from '../../../drizzle/schema';
import { eq, and, sql, inArray, isNotNull } from 'drizzle-orm';

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

  private async calculateAssessmentPoints(): Promise<
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

  private async calculateCodingPoints(): Promise<
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
          submittedAt: zuvyPracticeCode.createdAt,
          deadline: zuvyOutsourseAssessments.deadline,
          practiceCodeId: zuvyPracticeCode.id,
        })
        .from(zuvyPracticeCode)
        .leftJoin(
          zuvyOutsourseCodingQuestions,
          eq(
            zuvyPracticeCode.codingOutsourseId,
            zuvyOutsourseCodingQuestions.id,
          ),
        )
        .leftJoin(
          zuvyOutsourseAssessments,
          eq(
            zuvyOutsourseCodingQuestions.assessmentOutsourseId,
            zuvyOutsourseAssessments.id,
          ),
        )
        .where(
          and(sql`${zuvyOutsourseCodingQuestions.bootcampId} IS NOT NULL`),
        );

      if (codingSubmissions.length === 0) {
        return codingMap;
      }

      const practiceCodeIds = codingSubmissions
        .map((s) => s.practiceCodeId)
        .filter((id): id is number => id != null);

      const failedTestCases =
        practiceCodeIds.length > 0
          ? await db
              .select({
                submissionId: zuvyTestCasesSubmission.submissionId,
              })
              .from(zuvyTestCasesSubmission)
              .where(
                and(
                  inArray(
                    zuvyTestCasesSubmission.submissionId,
                    practiceCodeIds,
                  ),
                  sql`${zuvyTestCasesSubmission.status} != 'Accepted'`,
                ),
              )
          : [];

      const failedSubmissionIdsSet = new Set(
        failedTestCases.map((tc) => tc.submissionId),
      );

      for (const submission of codingSubmissions) {
        if (
          !submission.userId ||
          !submission.bootcampId ||
          !submission.practiceCodeId
        ) {
          continue;
        }

        const allTestCasesPassed = !failedSubmissionIdsSet.has(
          submission.practiceCodeId,
        );

        const pointsBreakdown = this.calculateTotalCodingPoints(
          submission.submittedAt,
          submission.deadline,
          allTestCasesPassed,
        );

        const key = `${submission.userId}-${submission.bootcampId}`;
        const entry = codingMap.get(key) || {
          chapterPoints: new Map<number, number>(),
          codingPoints: 0,
          lastActivityAt: new Date().toISOString(),
        };

        entry.codingPoints += pointsBreakdown.totalCodingPoints;

        if (submission.chapterId) {
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

  private async calculateQuizPoints(): Promise<
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
        .where(sql`${zuvyOutsourseQuizzes.bootcampId} IS NOT NULL`);

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

  private async calculateRecordingPoints(): Promise<
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

  private async calculateAssignmentPoints(): Promise<
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
      const projectSubmissions = await db
        .select({
          userId: zuvyProjectTracking.userId,
          bootcampId: zuvyProjectTracking.bootcampId,
          grades: zuvyProjectTracking.grades,
          isChecked: zuvyProjectTracking.isChecked,
          createdAt: zuvyProjectTracking.createdAt,
          updatedAt: zuvyProjectTracking.updatedAt,
        })
        .from(zuvyProjectTracking)
        .where(sql`${zuvyProjectTracking.bootcampId} IS NOT NULL`);

      if (projectSubmissions.length === 0) {
        this.logger.log('No project submissions found');
        return assignmentMap;
      }

      this.logger.log(`Found ${projectSubmissions.length} project submissions`);

      for (const submission of projectSubmissions) {
        if (!submission.userId || !submission.bootcampId) {
          continue;
        }

        const key = `${submission.userId}-${submission.bootcampId}`;

        const attemptPoints = 5;

        const submissionBonus = submission.isChecked ? 3 : 0;

        let scorePoints = 0;
        if (submission.grades !== null && submission.grades !== undefined) {
          const gradePercentage = submission.grades;
          if (gradePercentage >= 90) {
            scorePoints = 12;
          } else if (gradePercentage >= 75) {
            scorePoints = 9;
          } else if (gradePercentage >= 50) {
            scorePoints = 6;
          } else if (gradePercentage > 0) {
            scorePoints = 3;
          } else {
            scorePoints = 0;
          }
        }

        const totalAssignmentPoints =
          attemptPoints + submissionBonus + scorePoints;

        const entry = assignmentMap.get(key) || {
          chapterPoints: new Map<number, number>(),
          assignmentPoints: 0,
          lastActivityAt: new Date().toISOString(),
        };

        entry.assignmentPoints += totalAssignmentPoints;
        entry.lastActivityAt =
          submission.updatedAt ||
          submission.createdAt ||
          new Date().toISOString();

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

  private async calculateVideoPoints(): Promise<
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

  private async calculateArticlePoints(): Promise<
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

    // 1. Current module ke chapters
    const chapters = await db
      .select({
        chapterId: zuvyModuleChapter.id,
        topicId: zuvyModuleChapter.topicId,
      })
      .from(zuvyModuleChapter)
      .where(inArray(zuvyModuleChapter.id, chapterIds));

    // 2. Sab chapters ko initially 0
    for (const chapter of chapters) {
      if (chapter.chapterId != null) {
        chapterPointsMap.set(chapter.chapterId, 0);
      }
    }

    // Filter chapter IDs by topic
    const videoChapterIds = chapters
      .filter((chapter) => chapter.topicId === 1 && chapter.chapterId != null)
      .map((chapter) => chapter.chapterId as number);

    const articleChapterIds = chapters
      .filter((chapter) => chapter.topicId === 2 && chapter.chapterId != null)
      .map((chapter) => chapter.chapterId as number);

    const codingChapterIds = chapters
      .filter((chapter) => chapter.topicId === 3 && chapter.chapterId != null)
      .map((chapter) => chapter.chapterId as number);

    const quizChapterIds = chapters
      .filter((chapter) => chapter.topicId === 4 && chapter.chapterId != null)
      .map((chapter) => chapter.chapterId as number);

    const assignmentChapterIds = chapters
      .filter((chapter) => chapter.topicId === 5 && chapter.chapterId != null)
      .map((chapter) => chapter.chapterId as number);

    const assessmentChapterIds = chapters
      .filter((chapter) => chapter.topicId === 6 && chapter.chapterId != null)
      .map((chapter) => chapter.chapterId as number);

    const recordingChapterIds = chapters
      .filter((chapter) => chapter.topicId === 8 && chapter.chapterId != null)
      .map((chapter) => chapter.chapterId as number);

    // 3. Define parallel database queries
    const videoPromise =
      videoChapterIds.length > 0
        ? db
            .select({
              chapterId: zuvyChapterTracking.chapterId,
            })
            .from(zuvyChapterTracking)
            .where(
              and(
                eq(zuvyChapterTracking.userId, BigInt(userId)),
                inArray(zuvyChapterTracking.chapterId, videoChapterIds),
              ),
            )
        : Promise.resolve([]);

    const articlePromise =
      articleChapterIds.length > 0
        ? db
            .select({
              chapterId: zuvyChapterTracking.chapterId,
            })
            .from(zuvyChapterTracking)
            .where(
              and(
                eq(zuvyChapterTracking.userId, BigInt(userId)),
                inArray(zuvyChapterTracking.chapterId, articleChapterIds),
              ),
            )
        : Promise.resolve([]);

    const codingPromise =
      codingChapterIds.length > 0
        ? db
            .select({
              chapterId: zuvyPracticeCode.chapterId,
              submittedAt: zuvyPracticeCode.createdAt,
              deadline: zuvyOutsourseAssessments.deadline,
              practiceCodeId: zuvyPracticeCode.id,
            })
            .from(zuvyPracticeCode)
            .leftJoin(
              zuvyOutsourseCodingQuestions,
              eq(
                zuvyPracticeCode.codingOutsourseId,
                zuvyOutsourseCodingQuestions.id,
              ),
            )
            .leftJoin(
              zuvyOutsourseAssessments,
              eq(
                zuvyOutsourseCodingQuestions.assessmentOutsourseId,
                zuvyOutsourseAssessments.id,
              ),
            )
            .where(
              and(
                eq(zuvyPracticeCode.userId, BigInt(userId)),
                inArray(zuvyPracticeCode.chapterId, codingChapterIds),
              ),
            )
        : Promise.resolve([]);

    const codingCompletionsPromise =
      codingChapterIds.length > 0
        ? db
            .select({
              chapterId: zuvyChapterTracking.chapterId,
            })
            .from(zuvyChapterTracking)
            .where(
              and(
                eq(zuvyChapterTracking.userId, BigInt(userId)),
                inArray(zuvyChapterTracking.chapterId, codingChapterIds),
              ),
            )
        : Promise.resolve([]);

    const quizPromise =
      quizChapterIds.length > 0
        ? db
            .select({
              chapterId: zuvyChapterTracking.chapterId,
            })
            .from(zuvyChapterTracking)
            .where(
              and(
                eq(zuvyChapterTracking.userId, BigInt(userId)),
                inArray(zuvyChapterTracking.chapterId, quizChapterIds),
              ),
            )
        : Promise.resolve([]);

    const assignmentPromise =
      assignmentChapterIds.length > 0
        ? db
            .select({
              chapterId: zuvyAssignmentSubmission.chapterId,
              createdAt: zuvyAssignmentSubmission.createdAt,
              timeLimit: zuvyAssignmentSubmission.timeLimit,
            })
            .from(zuvyAssignmentSubmission)
            .where(
              and(
                eq(zuvyAssignmentSubmission.userId, userId),
                eq(zuvyAssignmentSubmission.bootcampId, bootcampId),
                inArray(
                  zuvyAssignmentSubmission.chapterId,
                  assignmentChapterIds,
                ),
              ),
            )
        : Promise.resolve([]);

    const assessmentPromise =
      assessmentChapterIds.length > 0
        ? db
            .select({
              chapterId: zuvyOutsourseAssessments.chapterId,
              percentage: zuvyAssessmentSubmission.percentage,
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
                eq(zuvyAssessmentSubmission.userId, userId),
                eq(zuvyOutsourseAssessments.bootcampId, bootcampId),
                inArray(
                  zuvyOutsourseAssessments.chapterId,
                  assessmentChapterIds,
                ),
              ),
            )
        : Promise.resolve([]);

    const recordingPromise =
      recordingChapterIds.length > 0
        ? db
            .select({
              chapterId: zuvyChapterTracking.chapterId,
            })
            .from(zuvyChapterTracking)
            .where(
              and(
                eq(zuvyChapterTracking.userId, BigInt(userId)),
                inArray(zuvyChapterTracking.chapterId, recordingChapterIds),
                isNotNull(zuvyChapterTracking.completedAt),
              ),
            )
        : Promise.resolve([]);

    // 4. Run parallel queries
    const [
      videoCompletions,
      articleCompletions,
      codingSubmissions,
      codingCompletions,
      quizCompletions,
      assignmentSubmissions,
      assessmentSubmissions,
      recordingCompletions,
    ] = await Promise.all([
      videoPromise,
      articlePromise,
      codingPromise,
      codingCompletionsPromise,
      quizPromise,
      assignmentPromise,
      assessmentPromise,
      recordingPromise,
    ]);

    // 5. Process video results
    for (const video of videoCompletions) {
      if (video.chapterId != null) {
        chapterPointsMap.set(video.chapterId, 10);
      }
    }

    // 6. Process article results
    for (const article of articleCompletions) {
      if (article.chapterId != null) {
        chapterPointsMap.set(article.chapterId, 10);
      }
    }

    // 7. Process coding results
    if (codingSubmissions.length > 0) {
      const practiceCodeIds = codingSubmissions.map((s) => s.practiceCodeId);

      const failedTestCases = await db
        .select({
          submissionId: zuvyTestCasesSubmission.submissionId,
        })
        .from(zuvyTestCasesSubmission)
        .where(
          and(
            inArray(zuvyTestCasesSubmission.submissionId, practiceCodeIds),
            sql`${zuvyTestCasesSubmission.status} != 'Accepted'`,
          ),
        );

      const failedSubmissionIdsSet = new Set(
        failedTestCases.map((tc) => tc.submissionId),
      );

      const chapterMaxPoints = new Map<number, number>();

      for (const submission of codingSubmissions) {
        if (submission.chapterId == null) {
          continue;
        }
        const allTestCasesPassed = !failedSubmissionIdsSet.has(
          submission.practiceCodeId,
        );

        const pointsBreakdown = this.calculateTotalCodingPoints(
          submission.submittedAt,
          submission.deadline,
          allTestCasesPassed,
        );

        const existingMax = chapterMaxPoints.get(submission.chapterId) ?? 0;
        if (pointsBreakdown.totalCodingPoints > existingMax) {
          chapterMaxPoints.set(
            submission.chapterId,
            pointsBreakdown.totalCodingPoints,
          );
        }
      }

      for (const [chapterId, points] of chapterMaxPoints.entries()) {
        const existingPoints = chapterPointsMap.get(chapterId) ?? 0;
        chapterPointsMap.set(chapterId, existingPoints + points);
      }
    }

    for (const completion of codingCompletions) {
      if (completion.chapterId != null) {
        const currentPoints = chapterPointsMap.get(completion.chapterId) ?? 0;
        if (currentPoints < 5) {
          chapterPointsMap.set(completion.chapterId, 5);
        }
      }
    }

    // 8. Process quiz results
    for (const quiz of quizCompletions) {
      if (quiz.chapterId != null) {
        chapterPointsMap.set(quiz.chapterId, 5);
      }
    }

    // 9. Process assignment results
    for (const submission of assignmentSubmissions) {
      if (submission.chapterId == null) {
        continue;
      }

      const attemptPoints = 5;

      const submittedSecond = submission.createdAt
        ? Math.floor(new Date(submission.createdAt).getTime() / 1000)
        : null;

      const deadlineSecond = submission.timeLimit
        ? Math.floor(new Date(submission.timeLimit).getTime() / 1000)
        : null;

      const bonusPoints =
        submittedSecond !== null &&
        deadlineSecond !== null &&
        submittedSecond <= deadlineSecond
          ? 5
          : 0;

      const totalPoints = attemptPoints + bonusPoints;

      const existingPoints = chapterPointsMap.get(submission.chapterId) ?? 0;

      chapterPointsMap.set(submission.chapterId, existingPoints + totalPoints);

      assignmentBreakdownMap.set(submission.chapterId, {
        assignment: attemptPoints,
        bonus: bonusPoints,
        performance: 0,
      });
    }

    // 10. Process assessment results
    for (const submission of assessmentSubmissions) {
      if (submission.chapterId == null) {
        continue;
      }
      const pointsBreakdown = this.calculateTotalAssessmentPoints(
        submission.percentage || 0,
        submission.submittedAt,
        submission.deadline,
      );

      const existingPoints = chapterPointsMap.get(submission.chapterId) ?? 0;
      chapterPointsMap.set(
        submission.chapterId,
        existingPoints + pointsBreakdown.totalPoints,
      );
    }

    // 11. Process recording results
    for (const recording of recordingCompletions) {
      if (recording.chapterId != null) {
        chapterPointsMap.set(recording.chapterId, 5);
      }
    }

    return {
      chapterPointsMap,
      assignmentBreakdownMap,
    };
  }

  async updateLeaderboard(): Promise<{
    success: boolean;
    message: string;
    updated: number;
    error?: string;
  }> {
    try {
      this.logger.log('Starting main leaderboard update...');

      const [
        assessmentMap,
        codingMap,
        quizMap,
        attendanceMap,
        recordingMap,
        assignmentMap,
        videoMap,
        articleMap,
      ] = await Promise.all([
        this.calculateAssessmentPoints(),
        this.calculateCodingPoints(),
        this.calculateQuizPoints(),
        this.calculateAttendancePoints(),
        this.calculateRecordingPoints(),
        this.calculateAssignmentPoints(),
        this.calculateVideoPoints(),
        this.calculateArticlePoints(),
      ]);

      const leaderboardMap = new Map<
        string,
        {
          learnerId: number;
          bootcampId: number;
          assessmentPoints: number;
          codingPoints: number;
          quizPoints: number;
          attendancePoints: number;
          recordingPoints: number;
          assignmentPoints: number;
          videoPoints: number;
          articlePoints: number;
          totalPoints: number;
          lastActivityAt: string;
        }
      >();

      const allKeys = new Set<string>();
      assessmentMap.forEach((_, key) => allKeys.add(key));
      codingMap.forEach((_, key) => allKeys.add(key));
      quizMap.forEach((_, key) => allKeys.add(key));
      attendanceMap.forEach((_, key) => allKeys.add(key));
      recordingMap.forEach((_, key) => allKeys.add(key));
      assignmentMap.forEach((_, key) => allKeys.add(key));
      videoMap.forEach((_, key) => allKeys.add(key));
      articleMap.forEach((_, key) => allKeys.add(key));

      for (const key of allKeys) {
        const [learnerId, bootcampId] = key.split('-').map(Number);

        const assessmentEntry = assessmentMap.get(key);
        const codingEntry = codingMap.get(key);
        const quizEntry = quizMap.get(key);
        const attendanceEntry = attendanceMap.get(key);
        const recordingEntry = recordingMap.get(key);
        const assignmentEntry = assignmentMap.get(key);
        const videoEntry = videoMap.get(key);
        const articleEntry = articleMap.get(key);

        const assessmentPoints = assessmentEntry?.assessmentPoints || 0;
        const codingPoints = codingEntry?.codingPoints || 0;
        const quizPoints = quizEntry?.quizPoints || 0;
        const attendancePoints = attendanceEntry?.attendancePoints || 0;
        const recordingPoints = recordingEntry?.recordingPoints || 0;
        const assignmentPoints = assignmentEntry?.assignmentPoints || 0;
        const videoPoints = videoEntry?.videoPoints || 0;
        const articlePoints = articleEntry?.articlePoints || 0;

        const totalPoints =
          assessmentPoints +
          codingPoints +
          quizPoints +
          attendancePoints +
          recordingPoints +
          assignmentPoints +
          videoPoints +
          articlePoints;

        const lastActivityAt =
          assessmentEntry?.lastActivityAt ||
          codingEntry?.lastActivityAt ||
          quizEntry?.lastActivityAt ||
          attendanceEntry?.lastActivityAt ||
          recordingEntry?.lastActivityAt ||
          assignmentEntry?.lastActivityAt ||
          videoEntry?.lastActivityAt ||
          articleEntry?.lastActivityAt ||
          new Date().toISOString();

        leaderboardMap.set(key, {
          learnerId,
          bootcampId,
          assessmentPoints,
          codingPoints,
          quizPoints,
          attendancePoints,
          recordingPoints,
          assignmentPoints,
          videoPoints,
          articlePoints,
          totalPoints,
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
      const updatePromises: any[] = [];

      for (const entry of leaderboardMap.values()) {
        const existing = existingEntryMap.get(
          `${entry.learnerId}-${entry.bootcampId}`,
        );

        const assessmentEntry = assessmentMap.get(
          `${entry.learnerId}-${entry.bootcampId}`,
        );
        const codingEntry = codingMap.get(
          `${entry.learnerId}-${entry.bootcampId}`,
        );
        const quizEntry = quizMap.get(`${entry.learnerId}-${entry.bootcampId}`);
        const attendanceEntry = attendanceMap.get(
          `${entry.learnerId}-${entry.bootcampId}`,
        );
        const recordingEntry = recordingMap.get(
          `${entry.learnerId}-${entry.bootcampId}`,
        );
        const assignmentEntry = assignmentMap.get(
          `${entry.learnerId}-${entry.bootcampId}`,
        );
        const videoEntry = videoMap.get(
          `${entry.learnerId}-${entry.bootcampId}`,
        );
        const articleEntry = articleMap.get(
          `${entry.learnerId}-${entry.bootcampId}`,
        );

        if (existing) {
          const newAssessmentPoints =
            assessmentEntry?.assessmentPoints ?? existing.assessmentPoints;
          const newCodingPoints =
            codingEntry?.codingPoints ?? existing.codingPoints;
          const newQuizPoints = quizEntry?.quizPoints ?? existing.quizPoints;
          const newAttendancePoints =
            attendanceEntry?.attendancePoints ?? existing.attendancePoints;
          const newRecordingPoints =
            recordingEntry?.recordingPoints ?? existing.recordingPoints;
          const newAssignmentPoints =
            assignmentEntry?.assignmentPoints ?? existing.assignmentPoints;
          const newVideoPoints =
            videoEntry?.videoPoints ?? existing.videoPoints;
          const newArticlePoints =
            articleEntry?.articlePoints ?? existing.articlePoints;

          const totalPoints =
            newAssessmentPoints +
            newCodingPoints +
            newQuizPoints +
            newAttendancePoints +
            newRecordingPoints +
            newAssignmentPoints +
            newVideoPoints +
            newArticlePoints;

          // Only update if something changed
          const hasChanged =
            existing.assessmentPoints !== newAssessmentPoints ||
            existing.codingPoints !== newCodingPoints ||
            existing.quizPoints !== newQuizPoints ||
            existing.attendancePoints !== newAttendancePoints ||
            existing.recordingPoints !== newRecordingPoints ||
            existing.assignmentPoints !== newAssignmentPoints ||
            existing.videoPoints !== newVideoPoints ||
            existing.articlePoints !== newArticlePoints ||
            existing.totalPoints !== totalPoints ||
            existing.lastActivityAt !== entry.lastActivityAt;

          if (hasChanged) {
            const updateData: any = {
              lastActivityAt: entry.lastActivityAt,
              updatedAt: new Date().toISOString(),
              totalPoints,
            };

            if (assessmentEntry)
              updateData.assessmentPoints = assessmentEntry.assessmentPoints;
            if (codingEntry) updateData.codingPoints = codingEntry.codingPoints;
            if (quizEntry) updateData.quizPoints = quizEntry.quizPoints;
            if (attendanceEntry)
              updateData.attendancePoints = attendanceEntry.attendancePoints;
            if (recordingEntry)
              updateData.recordingPoints = recordingEntry.recordingPoints;
            if (assignmentEntry)
              updateData.assignmentPoints = assignmentEntry.assignmentPoints;
            if (videoEntry) updateData.videoPoints = videoEntry.videoPoints;
            if (articleEntry)
              updateData.articlePoints = articleEntry.articlePoints;

            updatePromises.push(
              db
                .update(zuvyLearnerLeaderboard)
                .set(updateData)
                .where(eq(zuvyLearnerLeaderboard.id, existing.id))
                .then(() => {
                  updatedCount++;
                })
                .catch((error) => {
                  this.logger.error(
                    `Failed to update leaderboard for learner ${entry.learnerId}, bootcamp ${entry.bootcampId}: ${this.getErrorMessage(
                      error,
                      'unknown error',
                    )}`,
                  );
                }),
            );
          } else {
            // Mark as processed even if skipped to match original updatedCount behavior
            updatedCount++;
          }
        } else {
          insertValues.push({
            learnerId: entry.learnerId,
            bootcampId: entry.bootcampId,
            assessmentPoints: entry.assessmentPoints,
            codingPoints: entry.codingPoints,
            quizPoints: entry.quizPoints,
            attendancePoints: entry.attendancePoints,
            recordingPoints: entry.recordingPoints,
            assignmentPoints: entry.assignmentPoints,
            videoPoints: entry.videoPoints,
            articlePoints: entry.articlePoints,
            totalPoints: entry.totalPoints,
            lastActivityAt: entry.lastActivityAt,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // Execute insert in batches/bulk if any
      if (insertValues.length > 0) {
        try {
          const chunkSize = 100;
          for (let i = 0; i < insertValues.length; i += chunkSize) {
            const chunk = insertValues.slice(i, i + chunkSize);
            await db.insert(zuvyLearnerLeaderboard as any).values(chunk);
          }
          updatedCount += insertValues.length;
        } catch (error) {
          this.logger.error(
            `Failed to bulk insert leaderboard entries: ${this.getErrorMessage(
              error,
              'unknown error',
            )}`,
          );
        }
      }

      // Execute updates in parallel
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      this.logger.log(
        `Successfully updated ${updatedCount} leaderboard entries`,
      );

      return {
        success: true,
        message: `Leaderboard updated successfully with all point types`,
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

  private calculateTestCasesPassedPoints(allTestCasesPassed: boolean): number {
    return allTestCasesPassed ? 15 : 0;
  }

  private calculateTotalCodingPoints(
    submittedAt: string | null,
    deadline: string | null,
    allTestCasesPassed: boolean,
  ): {
    attemptPoints: number;
    bonusPoints: number;
    testCasesPoints: number;
    totalCodingPoints: number;
  } {
    const attemptPoints = this.calculateCodingAttemptPoints();
    const bonusPoints = this.calculateCodingOnTimeBonusPoints(
      submittedAt,
      deadline,
    );
    const testCasesPoints =
      this.calculateTestCasesPassedPoints(allTestCasesPassed);

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
