import { Injectable, Logger } from '@nestjs/common';
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
} from '../../../drizzle/schema';
import { eq, and, sql, count, countDistinct } from 'drizzle-orm';

@Injectable()
export class LeaderboardService {
  private logger = new Logger(LeaderboardService.name);

  /**
   * Calculate percentage-based points
   *
   * Scoring system:
   * - 90-100 => 30 points
   * - 70-89 => 20 points
   * - 40-69 => 10 points
   * - below 40 => 0 points
   *
   * @param percentage The assessment percentage score
   * @returns Points awarded based on the percentage range
   */
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

  /**
   * Calculate submission attempt points
   *
   * Every submission attempt gets fixed 10 points
   *
   * @returns 10 points for every submission
   */
  private calculateSubmissionAttemptPoints(): number {
    return 10;
  }

  /**
   * Calculate on-time submission bonus points
   *
   * If submission is before deadline: +5 points
   * If submission is after deadline or no deadline: 0 points
   *
   * @param submittedAt Timestamp when submission was made
   * @param deadline Deadline string (ISO format or text)
   * @returns 5 points if on-time, 0 points otherwise
   */
  private calculateOnTimeBonusPoints(
    submittedAt: string | null,
    deadline: string | null,
  ): number {
    // If no deadline or submission time, no bonus
    if (!submittedAt || !deadline) {
      return 0;
    }

    try {
      const submissionTime = new Date(submittedAt).getTime();
      const deadlineTime = new Date(deadline).getTime();

      // If submitted before deadline, award bonus
      if (submissionTime <= deadlineTime) {
        return 5;
      }
    } catch (error) {
      this.logger.warn(`Failed to parse deadline dates: ${error.message}`);
    }

    return 0;
  }

  /**
   * Calculate total assessment points
   *
   * Formula:
   * totalPoints = submissionAttemptPoints + onTimeBonusPoints + percentagePoints
   * totalPoints = 10 + (0 or 5) + (0, 10, 20, or 30)
   *
   * @param percentage Assessment percentage score
   * @param submittedAt Submission timestamp
   * @param deadline Assessment deadline
   * @returns Object with breakdown of all point types
   */
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

  /**
   * Calculate assessment points for all learners
   *
   * Returns a map of learner-bootcamp combinations with their assessment points
   *
   * @returns Map with key "learnerId-bootcampId" and assessment points
   */
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
      // Fetch all assessment submissions with deadline information
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

        // Calculate points breakdown
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
        `Error calculating assessment points: ${error.message}`,
      );
    }

    return assessmentMap;
  }

  /**
   * Calculate coding points for all learners
   *
   * Returns a map of learner-bootcamp combinations with their coding points
   *
   * @returns Map with key "learnerId-bootcampId" and coding points
   */
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
      // Fetch all coding submissions
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

        // Check if all test cases for this submission passed
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

        // Calculate points breakdown
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
      this.logger.error(`Error calculating coding points: ${error.message}`);
    }

    return codingMap;
  }

  /**
   * Calculate quiz points for all learners
   *
   * Placeholder for future implementation
   *
   * @returns Empty map (not yet implemented)
   */
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

      // Fetch all quiz submissions with assessment details and bootcamp info
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

      // Group by learner-bootcamp and calculate points
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

        // Calculate quiz percentage if we have scores
        let quizPercentage = 0;
        if (
          submission.mcqScore !== null &&
          submission.requiredMCQScore &&
          submission.requiredMCQScore > 0
        ) {
          quizPercentage =
            (submission.mcqScore / submission.requiredMCQScore) * 100;
        }

        // Calculate points for this quiz submission
        const attemptPoints = 5; // Fixed points for submission attempt
        const bonusPoints = this.calculateQuizOnTimeBonusPoints(
          submission.submittedAt,
          submission.deadline,
        );
        const scorePoints = this.calculateQuizScorePoints(quizPercentage);

        const totalQuizPoints = attemptPoints + bonusPoints + scorePoints;

        // Merge with existing entry or create new
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
      this.logger.error(`Error calculating quiz points: ${error.message}`);
      return new Map();
    }
  }

  /**
   * Calculate quiz on-time submission bonus points
   *
   * If quiz submitted before deadline: +3 points
   * Otherwise: 0 points
   *
   * @param submittedAt Timestamp when submitted
   * @param deadline Deadline timestamp
   * @returns 3 points if on-time, 0 otherwise
   */
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
      this.logger.warn(`Failed to parse quiz deadline: ${error.message}`);
    }

    return 0;
  }

  /**
   * Calculate quiz score-based points
   *
   * Scoring system:
   * - 90-100% => 15 points
   * - 70-89% => 10 points
   * - 40-69% => 5 points
   * - below 40% => 0 points
   *
   * @param percentage Quiz percentage score
   * @returns Points based on percentage range
   */
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

  /**
   * Calculate attendance points for all learners
   *
   * Attendance:
   * - Live session attended (system-marked PRESENT) = 10 points per session
   *
   * Fetches attendance records and counts total attended sessions per learner-bootcamp
   *
   * @returns Map with key "learnerId-bootcampId" and attendance points
   */
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
      // Fetch all attendance records where learner was marked PRESENT
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

      // Group by learner-bootcamp and count attended sessions
      for (const record of attendanceRecords) {
        if (!record.userId || !record.bootcampId) {
          continue;
        }

        const key = `${record.userId}-${record.bootcampId}`;

        // 10 points per attended session
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
        `Error calculating attendance points: ${error.message}`,
      );
      return attendanceMap;
    }
  }

  /**
   * Calculate recording points for all learners
   *
   * Recording:
   * - Recorded session watched (system-marked) = 5 points per session
   *
   * Fetches record views and counts total watched recordings per learner
   * Joined with sessions table to get bootcamp information
   *
   * @returns Map with key "learnerId-bootcampId" and recording points
   */
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
      // Fetch all recording views with session details and bootcamp info
      const recordingViews = await db
        .select({
          userId: zuvySessionRecordViews.userId,
          sessionId: zuvySessionRecordViews.sessionId,
          bootcampId: zuvySessions.bootcampId,
          viewedAt: zuvySessionRecordViews.viewedAt,
        })
        .from(zuvySessionRecordViews)
        .leftJoin(
          zuvySessions,
          eq(zuvySessionRecordViews.sessionId, zuvySessions.id),
        )
        .where(sql`${zuvySessions.bootcampId} IS NOT NULL`);

      if (recordingViews.length === 0) {
        this.logger.log('No recording views found');
        return recordingMap;
      }

      this.logger.log(`Found ${recordingViews.length} recording view records`);

      // Group by learner-bootcamp and session, then count distinct sessions
      const viewsByLearnerBootcampSession = new Map<string, Set<number>>();

      for (const view of recordingViews) {
        if (!view.userId || !view.bootcampId || !view.sessionId) {
          continue;
        }

        const key = `${view.userId}-${view.bootcampId}`;

        if (!viewsByLearnerBootcampSession.has(key)) {
          viewsByLearnerBootcampSession.set(key, new Set());
        }

        // Add session ID to set (automatically deduplicates)
        const sessionSet = viewsByLearnerBootcampSession.get(key);
        sessionSet.add(view.sessionId);

        // Update last activity
        if (!recordingMap.has(key)) {
          recordingMap.set(key, {
            recordingPoints: 0,
            lastActivityAt: view.viewedAt || new Date().toISOString(),
          });
        } else {
          const entry = recordingMap.get(key);
          entry.lastActivityAt = view.viewedAt || entry.lastActivityAt;
        }
      }

      // Calculate points based on distinct sessions watched
      for (const [key, sessionSet] of viewsByLearnerBootcampSession.entries()) {
        const distinctSessionCount = sessionSet.size;
        const pointsPerSession = 5;
        const totalRecordingPoints = distinctSessionCount * pointsPerSession;

        const entry = recordingMap.get(key);
        entry.recordingPoints = totalRecordingPoints;
      }

      this.logger.log(
        `Processed recording views for ${recordingMap.size} learner-bootcamp combinations`,
      );
      return recordingMap;
    } catch (error) {
      this.logger.error(`Error calculating recording points: ${error.message}`);
      return recordingMap;
    }
  }

  /**
   * Calculate assignment points for all learners
   *
   * Assignment:
   * - Submission attempt = 5 points per assignment
   * - On-time submission = 3 points bonus
   * - Score-based points = 0-12 points based on grade percentage
   *
   * Fetches project tracking data and calculates total points per learner-bootcamp
   *
   * @returns Map with key "learnerId-bootcampId" and assignment points
   */
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
      // Fetch project tracking records with submission status
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

      // Group by learner-bootcamp and calculate points
      for (const submission of projectSubmissions) {
        if (!submission.userId || !submission.bootcampId) {
          continue;
        }

        const key = `${submission.userId}-${submission.bootcampId}`;

        // 5 points for submission attempt
        const attemptPoints = 5;

        // 3 points bonus if submitted (isChecked indicates it was graded/submitted)
        const submissionBonus = submission.isChecked ? 3 : 0;

        // Calculate score-based points (0-12) based on grade percentage
        let scorePoints = 0;
        if (submission.grades !== null && submission.grades !== undefined) {
          const gradePercentage = submission.grades; // Assuming grades is percentage (0-100)
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

        // Merge with existing entry or create new
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
        `Error calculating assignment points: ${error.message}`,
      );
      return assignmentMap;
    }
  }

  /**
   * Update the main leaderboard with all point types
   *
   * This function orchestrates the calculation of all point types:
   * 1. Assessment points (submission attempt + on-time bonus + percentage-based)
   * 2. Coding points (submission attempt + on-time bonus + test cases)
   * 3. Quiz points (submission attempt + on-time bonus + score-based)
   * 4. Attendance points (10 points per live session attended)
   * 5. Recording points (5 points per recorded session watched)
   * 6. Assignment points (attempt + submission bonus + grade-based)
   *
   * Then merges all results and updates leaderboard table once per learner-bootcamp.
   * Preserves existing points if they're not recalculated in current run.
   *
   * totalPoints = assessmentPoints + codingPoints + quizPoints + attendancePoints + recordingPoints + assignmentPoints
   */
  async updateLeaderboard(): Promise<{
    success: boolean;
    message: string;
    updated: number;
    error?: string;
  }> {
    try {
      this.logger.log('Starting main leaderboard update...');

      // Calculate points from all sources in parallel
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

      // Merge all maps into one master map
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

      // Collect all unique learner-bootcamp keys
      const allKeys = new Set<string>();
      assessmentMap.forEach((_, key) => allKeys.add(key));
      codingMap.forEach((_, key) => allKeys.add(key));
      quizMap.forEach((_, key) => allKeys.add(key));
      attendanceMap.forEach((_, key) => allKeys.add(key));
      recordingMap.forEach((_, key) => allKeys.add(key));
      assignmentMap.forEach((_, key) => allKeys.add(key));

      // Build merged leaderboard map
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

      // Step 2: Update or create leaderboard entries
      let updatedCount = 0;

      for (const entry of leaderboardMap.values()) {
        try {
          // Check if leaderboard entry exists
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

            // Merge with existing values: only update points that have new data
            // This preserves existing points that weren't recalculated in this run
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

            // Only update point fields that have new data, keep existing values otherwise
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

            // Recalculate total points based on all values (existing + updated)
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

            // Update existing leaderboard entry
            await db
              .update(zuvyLearnerLeaderboard)
              .set(updateData)
              .where(eq(zuvyLearnerLeaderboard.id, existing.id));

            this.logger.debug(
              `Updated leaderboard for learner ${entry.learnerId}, bootcamp ${entry.bootcampId}`,
            );
          } else {
            // Create new leaderboard entry
            await db.insert(zuvyLearnerLeaderboard).values({
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
            `Failed to update leaderboard for learner ${entry.learnerId}, bootcamp ${entry.bootcampId}: ${error.message}`,
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
      this.logger.error(`Error updating leaderboard: ${error.message}`);
      return {
        success: false,
        message: 'Failed to update leaderboard',
        updated: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get leaderboard for a specific bootcamp
   * Sorted by total points in descending order with rank
   *
   * @param bootcampId The bootcamp ID to fetch leaderboard for
   * @param limit Number of top learners to return (default: 100)
   * @returns Array of learners sorted by points and ranks
   */
  async getBootcampLeaderboard(
    bootcampId: number,
    limit: number = 100,
  ): Promise<
    Array<{
      rank: number;
      learnerId: number;
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
      const leaderboard = await db
        .select({
          learnerId: zuvyLearnerLeaderboard.learnerId,
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
        .where(eq(zuvyLearnerLeaderboard.bootcampId, bootcampId))
        .orderBy(sql`${zuvyLearnerLeaderboard.totalPoints} DESC`)
        .limit(limit);

      // Add rank based on order
      return leaderboard.map((entry, index) => ({
        rank: index + 1,
        learnerId: entry.learnerId,
        assessmentPoints: entry.assessmentPoints,
        codingPoints: entry.codingPoints,
        quizPoints: entry.quizPoints,
        attendancePoints: entry.attendancePoints,
        recordingPoints: entry.recordingPoints,
        assignmentPoints: entry.assignmentPoints,
        totalPoints: entry.totalPoints,
        lastActivityAt: entry.lastActivityAt,
      }));
    } catch (error) {
      this.logger.error(`Error fetching course leaderboard: ${error.message}`);
      return [];
    }
  }

  /**
   * Get leaderboard position for a specific learner in a bootcamp
   *
   * @param learnerId The learner ID
   * @param bootcampId The bootcamp ID
   * @returns Learner's leaderboard information including rank and all point types
   */
  async getLearnerPosition(
    learnerId: number,
    bootcampId: number,
  ): Promise<{
    rank: number | null;
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
        .select()
        .from(zuvyLearnerLeaderboard)
        .where(
          and(
            eq(zuvyLearnerLeaderboard.learnerId, learnerId),
            eq(zuvyLearnerLeaderboard.bootcampId, bootcampId),
          ),
        );

      if (learnerEntry.length === 0) {
        return null;
      }

      // Count how many learners have higher points
      const higherScoresCount = await db
        .select({ count: sql`COUNT(*)` })
        .from(zuvyLearnerLeaderboard)
        .where(
          and(
            eq(zuvyLearnerLeaderboard.bootcampId, bootcampId),
            sql`${zuvyLearnerLeaderboard.totalPoints} > ${learnerEntry[0].totalPoints}`,
          ),
        );

      const rank =
        (higherScoresCount[0]?.count as number) + 1 || learnerEntry[0].rank;

      return {
        rank,
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
      this.logger.error(`Error fetching learner position: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate coding submission attempt points
   *
   * Every coding submission attempt gets fixed 5 points
   *
   * @returns 5 points for every coding submission
   */
  private calculateCodingAttemptPoints(): number {
    return 5;
  }

  /**
   * Calculate coding on-time submission bonus points
   *
   * If coding submission is before deadline: +3 points
   * If submission is after deadline or no deadline: 0 points
   *
   * @param submittedAt Timestamp when submission was made
   * @param deadline Deadline string (ISO format or text)
   * @returns 3 points if on-time, 0 points otherwise
   */
  private calculateCodingOnTimeBonusPoints(
    submittedAt: string | null,
    deadline: string | null,
  ): number {
    // If no deadline or submission time, no bonus
    if (!submittedAt || !deadline) {
      return 0;
    }

    try {
      const submissionTime = new Date(submittedAt).getTime();
      const deadlineTime = new Date(deadline).getTime();

      // If submitted before deadline, award bonus
      if (submissionTime <= deadlineTime) {
        return 3;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to parse coding deadline dates: ${error.message}`,
      );
    }

    return 0;
  }

  /**
   * Calculate test cases passed bonus points
   *
   * If ALL test cases passed: +15 points
   * If ANY test case failed: 0 points
   *
   * @param allTestCasesPassed Boolean indicating if all test cases passed
   * @returns 15 points if all passed, 0 points if any failed
   */
  private calculateTestCasesPassedPoints(allTestCasesPassed: boolean): number {
    return allTestCasesPassed ? 15 : 0;
  }

  /**
   * Calculate total coding points
   *
   * Formula:
   * codingPoints = submissionAttemptPoints + onTimeBonusPoints + testCasesPassedPoints
   * codingPoints = 5 + (0 or 3) + (0 or 15)
   *
   * @param submittedAt Submission timestamp
   * @param deadline Coding deadline
   * @param allTestCasesPassed Whether all test cases passed
   * @returns Object with breakdown of all coding point types
   */
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
}
