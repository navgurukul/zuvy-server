import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
  zuvyLeaderboardSettings,
} from '../../../drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';

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
        assessmentPoints: number;
        lastActivityAt: string;
      }
    >
  > {
    const assessmentMap = new Map<
      string,
      {
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
        codingPoints: number;
        lastActivityAt: string;
      }
    >
  > {
    const codingMap = new Map<
      string,
      {
        codingPoints: number;
        lastActivityAt: string;
      }
    >();

    try {
      const codingSubmissions = await db
        .select({
          userId: zuvyPracticeCode.userId,
          bootcampId: zuvyOutsourseCodingQuestions.bootcampId,
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

      for (const submission of codingSubmissions) {
        if (
          !submission.userId ||
          !submission.bootcampId ||
          !submission.practiceCodeId
        ) {
          continue;
        }

        const failedTestCases = await db
          .select()
          .from(zuvyTestCasesSubmission)
          .where(
            and(
              eq(
                zuvyTestCasesSubmission.submissionId,
                submission.practiceCodeId,
              ),
              sql`${zuvyTestCasesSubmission.status} != 'Accepted'`,
            ),
          );

        const allTestCasesPassed = failedTestCases.length === 0;

        const pointsBreakdown = this.calculateTotalCodingPoints(
          submission.submittedAt,
          submission.deadline,
          allTestCasesPassed,
        );

        const key = `${submission.userId}-${submission.bootcampId}`;
        const entry = codingMap.get(key) || {
          codingPoints: 0,
          lastActivityAt: new Date().toISOString(),
        };

        entry.codingPoints += pointsBreakdown.totalCodingPoints;
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

      if (quizSubmissions.length === 0) {
        this.logger.log('No quiz submissions found');
        return new Map();
      }

      this.logger.log(`Found ${quizSubmissions.length} quiz submissions`);

      const quizMap = new Map<
        string,
        {
          quizPoints: number;
          lastActivityAt: string;
        }
      >();

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

      this.logger.log(
        `Processed quiz submissions for ${quizMap.size} learner-bootcamp combinations`,
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
        recordingPoints: number;
        lastActivityAt: string;
      }
    >
  > {
    const recordingMap = new Map<
      string,
      {
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
        assignmentPoints: number;
        lastActivityAt: string;
      }
    >
  > {
    const assignmentMap = new Map<
      string,
      {
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
      ] = await Promise.all([
        this.calculateAssessmentPoints(),
        this.calculateCodingPoints(),
        this.calculateQuizPoints(),
        this.calculateAttendancePoints(),
        this.calculateRecordingPoints(),
        this.calculateAssignmentPoints(),
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

      for (const key of allKeys) {
        const [learnerId, bootcampId] = key.split('-').map(Number);

        const assessmentEntry = assessmentMap.get(key);
        const codingEntry = codingMap.get(key);
        const quizEntry = quizMap.get(key);
        const attendanceEntry = attendanceMap.get(key);
        const recordingEntry = recordingMap.get(key);
        const assignmentEntry = assignmentMap.get(key);

        const assessmentPoints = assessmentEntry?.assessmentPoints || 0;
        const codingPoints = codingEntry?.codingPoints || 0;
        const quizPoints = quizEntry?.quizPoints || 0;
        const attendancePoints = attendanceEntry?.attendancePoints || 0;
        const recordingPoints = recordingEntry?.recordingPoints || 0;
        const assignmentPoints = assignmentEntry?.assignmentPoints || 0;

        const totalPoints =
          assessmentPoints +
          codingPoints +
          quizPoints +
          attendancePoints +
          recordingPoints +
          assignmentPoints;

        const lastActivityAt =
          assessmentEntry?.lastActivityAt ||
          codingEntry?.lastActivityAt ||
          quizEntry?.lastActivityAt ||
          attendanceEntry?.lastActivityAt ||
          recordingEntry?.lastActivityAt ||
          assignmentEntry?.lastActivityAt ||
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

      let updatedCount = 0;

      for (const entry of leaderboardMap.values()) {
        try {
          const existingEntry = await db
            .select()
            .from(zuvyLearnerLeaderboard)
            .where(
              and(
                eq(zuvyLearnerLeaderboard.learnerId, entry.learnerId),
                eq(zuvyLearnerLeaderboard.bootcampId, entry.bootcampId),
              ),
            );

          if (existingEntry.length > 0) {
            const existing = existingEntry[0];

            const assessmentEntry = assessmentMap.get(
              `${entry.learnerId}-${entry.bootcampId}`,
            );
            const codingEntry = codingMap.get(
              `${entry.learnerId}-${entry.bootcampId}`,
            );
            const quizEntry = quizMap.get(
              `${entry.learnerId}-${entry.bootcampId}`,
            );
            const attendanceEntry = attendanceMap.get(
              `${entry.learnerId}-${entry.bootcampId}`,
            );
            const recordingEntry = recordingMap.get(
              `${entry.learnerId}-${entry.bootcampId}`,
            );
            const assignmentEntry = assignmentMap.get(
              `${entry.learnerId}-${entry.bootcampId}`,
            );

            const updateData: any = {
              lastActivityAt: entry.lastActivityAt,
              updatedAt: new Date().toISOString(),
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

            updateData.totalPoints =
              newAssessmentPoints +
              newCodingPoints +
              newQuizPoints +
              newAttendancePoints +
              newRecordingPoints +
              newAssignmentPoints;

            await db
              .update(zuvyLearnerLeaderboard)
              .set(updateData)
              .where(eq(zuvyLearnerLeaderboard.id, existing.id));

            this.logger.debug(
              `Updated leaderboard for learner ${entry.learnerId}, bootcamp ${entry.bootcampId}`,
            );
          } else {
            await db.insert(zuvyLearnerLeaderboard as any).values({
              learnerId: entry.learnerId,
              bootcampId: entry.bootcampId,
              assessmentPoints: entry.assessmentPoints,
              codingPoints: entry.codingPoints,
              quizPoints: entry.quizPoints,
              attendancePoints: entry.attendancePoints,
              recordingPoints: entry.recordingPoints,
              assignmentPoints: entry.assignmentPoints,
              totalPoints: entry.totalPoints,
              lastActivityAt: entry.lastActivityAt,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            this.logger.debug(
              `Created leaderboard for learner ${entry.learnerId}, bootcamp ${entry.bootcampId}`,
            );
          }

          updatedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to update leaderboard for learner ${entry.learnerId}, bootcamp ${entry.bootcampId}: ${this.getErrorMessage(
              error,
              'unknown error',
            )}`,
          );
        }
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
        const isEnabled = await this.isLeaderboardEnabled(bootcampId);
        if (!isEnabled) {
          throw new BadRequestException(
            'Leaderboard is disabled for this bootcamp',
          );
        }
      }

      if (bootcampId) {
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
          .where(eq(zuvyLearnerLeaderboard.bootcampId, bootcampId))
          .orderBy(sql`${zuvyLearnerLeaderboard.totalPoints} DESC`)
          .limit(limit);

        return leaderboard;
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
          .innerJoin(
            zuvyLeaderboardSettings,
            eq(
              zuvyLeaderboardSettings.bootcampId,
              zuvyLearnerLeaderboard.bootcampId,
            ),
          )
          .where(eq(zuvyLeaderboardSettings.leaderboardEnabled, true))
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
      const isEnabled = await this.isLeaderboardEnabled(bootcampId);
      if (!isEnabled) {
        throw new BadRequestException(
          'Leaderboard is disabled for this bootcamp',
        );
      }

      const learnerEntry = await db
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
        .where(
          and(
            eq(zuvyLearnerLeaderboard.learnerId, learnerId),
            eq(zuvyLearnerLeaderboard.bootcampId, bootcampId),
          ),
        );

      if (learnerEntry.length === 0) {
        return null;
      }

      return {
        learnerId: learnerEntry[0].learnerId,
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
    return 5;
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

  async updateSettings(dto: {
    bootcampId: number;
    leaderboardEnabled: boolean;
  }): Promise<{ success: boolean; message: string }> {
    const bootcamp = await db
      .select({ id: zuvyBootcamps.id })
      .from(zuvyBootcamps)
      .where(eq(zuvyBootcamps.id, dto.bootcampId))
      .limit(1);

    if (bootcamp.length === 0) {
      throw new BadRequestException(
        `Bootcamp with ID ${dto.bootcampId} does not exist`,
      );
    }

    const existingSettings = await db
      .select()
      .from(zuvyLeaderboardSettings)
      .where(eq(zuvyLeaderboardSettings.bootcampId, dto.bootcampId))
      .limit(1);

    if (existingSettings.length > 0) {
      await db
        .update(zuvyLeaderboardSettings)
        .set({
          leaderboardEnabled: dto.leaderboardEnabled,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(zuvyLeaderboardSettings.bootcampId, dto.bootcampId));
    } else {
      await db.insert(zuvyLeaderboardSettings).values({
        bootcampId: dto.bootcampId,
        leaderboardEnabled: dto.leaderboardEnabled,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      success: true,
      message: `Leaderboard ${
        dto.leaderboardEnabled ? 'enabled' : 'disabled'
      } successfully`,
    };
  }

  async isLeaderboardEnabled(bootcampId: number): Promise<boolean> {
    const settings = await db
      .select({
        leaderboardEnabled: zuvyLeaderboardSettings.leaderboardEnabled,
      })
      .from(zuvyLeaderboardSettings)
      .where(eq(zuvyLeaderboardSettings.bootcampId, bootcampId))
      .limit(1);

    return settings.length > 0 ? settings[0].leaderboardEnabled : false;
  }
}
