import { Injectable, Logger } from '@nestjs/common';
const AWS = require('aws-sdk');
import { db } from '../../db/index';
import {
  eq,
  sql,
  count,
  lte,
  inArray,
  and,
  isNotNull,
  ilike,
  or,
  SQLWrapper,
} from 'drizzle-orm';
import * as _ from 'lodash';
import {
  zuvyBatchEnrollments,
  zuvyAssessmentSubmission,
  zuvyChapterTracking,
  zuvyOpenEndedQuestionSubmission,
  zuvyProjectTracking,
  zuvyQuizTracking,
  zuvyModuleChapter,
  zuvyFormTracking,
  zuvyPracticeCode,
  zuvyOutsourseQuizzes,
  zuvyModuleQuizVariants,
  zuvyOutsourseAssessments,
  users,
  zuvyBatches,
} from '../../../drizzle/schema';
import {
  InstructorFeedbackDto,
  PatchOpenendedQuestionDto,
  CreateOpenendedQuestionDto,
  SubmissionassessmentDto,
} from './dto/submission.dto';
import { STATUS_CODES } from 'src/helpers';
import { helperVariable } from 'src/constants/helper';
import { ResourceList } from 'src/rbac/utility';
import { RbacService } from 'src/rbac/rbac.service';
const DIFFICULTY = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
};
// Difficulty Points Mapping
let { ACCEPTED, SUBMIT } = helperVariable;
const {
  SUPPORT_EMAIL,
  AWS_SUPPORT_ACCESS_SECRET_KEY,
  AWS_SUPPORT_ACCESS_KEY_ID,
  ZUVY_BASH_URL,
} = process.env; // Importing env values

@Injectable()
export class SubmissionService {
  constructor(private readonly rbacService: RbacService) {}
  private readonly logger = new Logger(SubmissionService.name);

  async getSubmissionOfPractiseProblem(
    roleName,
    bootcampId: number,
    searchProblem: string,
    orderBy?: 'title',
    orderDirection?: 'asc' | 'desc',
    searchTerm?: string,
  ) {
    try {
      const topicId = 3;

      // -------------------------
      // Order validation (ERROR)
      // -------------------------
      if ((orderBy && !orderDirection) || (!orderBy && orderDirection)) {
        // Return an error-like object so controller can handle it consistently.
        return {
          status: 'error',
          code: 400,
          message: 'Both orderBy and orderDirection are required together',
        };
      }
      const trackingData = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq }) =>
          eq(courseModules.bootcampId, bootcampId),

        with: {
          moduleChapterData: {
            columns: { id: true, codingQuestions: true },

            // TITLE-BASED SORTING (if orderDirection not provided, default asc)
            orderBy: (chapter, { asc, desc, sql }) => {
              const titleColumn = sql`
              (SELECT cq.title 
               FROM main.zuvy_coding_questions AS cq
               WHERE cq.id = ${chapter.codingQuestions})
            `;
              return [
                orderDirection === 'desc'
                  ? desc(titleColumn)
                  : asc(titleColumn),
              ];
            },
            where: (moduleChapter, { eq, and, sql }) =>
              and(
                eq(moduleChapter.topicId, topicId),
                searchProblem
                  ? sql`
                    EXISTS (
                      SELECT 1
                      FROM main.zuvy_coding_questions AS cq
                      WHERE cq.id = ${moduleChapter.codingQuestions}
                      AND cq.title ILIKE ${searchProblem + '%'}
                    )
                  `
                  : sql`TRUE`,
              ),
            with: {
              chapterTrackingDetails: {
                columns: { userId: true, completedAt: true },
                with: {
                  user: { columns: { name: true, email: true, id: true } },
                },
              },
              codingQuestionDetails: {
                columns: { id: true, title: true },
              },
            },
          },
        },
      });
      // If DB returned nothing
      if (!trackingData || trackingData.length === 0) {
        return {
          status: 'success',
          code: 200,
          trackingData: [],
          totalStudents: 0,
        };
      }
      // Count students
      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} 
          AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`,
        );
      // Add submission count & submissions list
      trackingData.forEach((course: any) => {
        course.moduleChapterData.forEach((chapter: any) => {
          const details = Array.isArray(chapter.chapterTrackingDetails)
            ? chapter.chapterTrackingDetails
            : [];
          chapter.submitStudents = details.length;

          chapter.submissions = details.map((d: any) => ({
            userId: d.userId ?? d.user?.id,
            name: d.user?.name ?? null,
            email: d.user?.email ?? null,
            completedAt: d.completedAt ?? null,
          }));
          // remove raw details if you don't want to return them
          delete chapter.chapterTrackingDetails;
        });
      });
      // Student-level filter: name/email
      let filteredTrackingData = trackingData;
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        filteredTrackingData = trackingData
          .map((course: any) => {
            const filteredChapters = course.moduleChapterData
              .map((chapter: any) => {
                const matched = chapter.submissions.filter(
                  (s: any) =>
                    (s.name && s.name.toLowerCase().includes(lower)) ||
                    (s.email && s.email.toLowerCase().includes(lower)),
                );

                return matched.length > 0
                  ? { ...chapter, submissions: matched }
                  : null;
              })
              .filter(Boolean);

            return filteredChapters.length > 0
              ? { ...course, moduleChapterData: filteredChapters }
              : null;
          })
          .filter(Boolean);
      }
      const targetPermissions = [
        ResourceList.submission.read,
        ResourceList.submission.download,
        ResourceList.submission.re_attempt,
      ];
      const grantedPermissions = await this.rbacService.getAllPermissions(
        roleName,
        targetPermissions,
      );
      return {
        status: 'success',
        code: 200,
        trackingData: filteredTrackingData.filter(
          (course: any) => course.moduleChapterData.length > 0,
        ),
        totalStudents: zuvyBatchEnrollmentsCount[0]?.count || 0,
        ...grantedPermissions,
      };
    } catch (err) {
      throw err;
    }
  }

  async practiseProblemStatusOfStudents(
    questionId: number,
    chapterId: number,
    moduleId: number,
    batchId?: number,
    limit?: number,
    offset?: number,
    searchStudent?: string,
    orderBy?: any,
    orderDirection?: any,
  ) {
    try {
      // Coerce numeric params to safe values
      const safeLimit =
        typeof limit === 'number' && !isNaN(limit) && limit > 0
          ? limit
          : undefined;
      const safeOffset =
        typeof offset === 'number' && !isNaN(offset) && offset >= 0
          ? offset
          : undefined;

      const statusOfStudentCode = await db.query.zuvyChapterTracking.findMany({
        where: (chapterTracking, { sql, and }) => {
          // Ensure chapter/module/date match and that the user is enrolled
          const conditions = [
            sql`${chapterTracking.chapterId} = ${chapterId}`,
            sql`${chapterTracking.moduleId} = ${moduleId}`,
            sql`EXISTS (
              SELECT 1
              FROM main.zuvy_batch_enrollments AS be
              WHERE be.user_id = ${chapterTracking.userId}
              ${batchId ? sql`AND be.batch_id = ${batchId}` : sql``}
            )`,
          ];
          if (searchStudent) {
            conditions.push(sql`EXISTS (
              SELECT 1
              FROM main.users AS u
              WHERE u.id = ${chapterTracking.userId}
              AND (u.name ILIKE ${searchStudent + '%'} OR u.email ILIKE ${searchStudent + '%'})
            )`);
          }
          return and(...conditions);
        },
        with: {
          user: {
            // users table will only expose name and email per request
            columns: {
              name: true,
              email: true,
            },
            with: {
              studentCodeDetails: {
                where: (
                  practiceCode: { action: any; submissionId: any },
                  { sql }: any,
                ) =>
                  sql`${practiceCode.action} = 'submit' AND ${practiceCode.submissionId} IS NULL`,
              },
            },
          },
        },
        ...(typeof safeLimit === 'number' ? { limit: safeLimit } : {}),
        ...(typeof safeOffset === 'number' ? { offset: safeOffset } : {}),
      });

      // Get the total number of students matching the chapter, module, batch, and search criteria
      const totalStudentsRes = await db
        .select({
          count: sql<number>`cast(count(${zuvyChapterTracking.id}) as int)`,
        })
        .from(zuvyChapterTracking)
        .where(() => {
          const conditions = [
            sql`${zuvyChapterTracking.chapterId} = ${chapterId}`,
            sql`${zuvyChapterTracking.moduleId} = ${moduleId}`,
            sql`EXISTS (
              SELECT 1
              FROM main.zuvy_batch_enrollments AS be
              WHERE be.user_id = ${zuvyChapterTracking.userId}
              ${batchId ? sql`AND be.batch_id = ${batchId}` : sql``}
            )`,
          ];
          if (searchStudent) {
            conditions.push(sql`EXISTS (
              SELECT 1
              FROM main.users AS u
              WHERE u.id = ${zuvyChapterTracking.userId}
              AND (u.name ILIKE ${searchStudent + '%'} OR u.email ILIKE ${searchStudent + '%'})
            )`);
          }
          return and(...conditions);
        });
      const totalStudentsCount = totalStudentsRes[0]?.count ?? 0;
      const totalPages = safeLimit
        ? Math.ceil(totalStudentsCount / safeLimit)
        : 1;

      // Prepare the result with data about each student's attempts and submission status
      // Attach batchId per user by fetching enrollments for returned userIds
      const userIds = statusOfStudentCode
        .map((s: any) => s.userId)
        .filter((id: any) => id !== undefined && id !== null);
      let enrollmentMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const enrollments = await db
          .select({
            userId: zuvyBatchEnrollments.userId,
            batchId: zuvyBatchEnrollments.batchId,
            batchName: zuvyBatches.name,
          })
          .from(zuvyBatchEnrollments)
          .leftJoin(
            zuvyBatches,
            sql`${zuvyBatches.id} = ${zuvyBatchEnrollments.batchId}`,
          )
          .where(sql`${zuvyBatchEnrollments.userId} in ${userIds}`);

        enrollments.forEach((e: any) => {
          if (!enrollmentMap[String(e.userId)]) {
            enrollmentMap[String(e.userId)] = {
              batchId: e.batchId ?? null,
              batchName: e.batchName ?? null,
            };
          }
        });
      }

      const data = statusOfStudentCode
        .map((statusCode) => {
          const user = statusCode['user'];
          // use tracking.userId as the canonical id (users table may only have name/email)
          const canonicalUserId = statusCode['userId'];
          if (user) {
            return {
              id: Number(canonicalUserId),
              name: user['name'],
              email: user['email'],
              batchId: enrollmentMap[String(canonicalUserId)]?.batchId ?? null,
              batchName:
                enrollmentMap[String(canonicalUserId)]?.batchName ?? null,
              noOfAttempts: user['studentCodeDetails']?.length,
              status: user['studentCodeDetails']?.some(
                (submission: { status: string }) =>
                  submission.status === 'Accepted',
              )
                ? 'Accepted'
                : 'Not Accepted',
              submittedDate: statusCode['submitted_date'],
              // Add any other top-level fields from statusCode if needed (exclude user)
              ...Object.fromEntries(
                Object.entries(statusCode).filter(([key]) => key !== 'user'),
              ),
            };
          } else {
            return null;
          }
        })
        .filter((item) => item !== null);

      // Apply JavaScript-side sorting (for name, email, submittedDate)
      if (orderBy) {
        const dir =
          orderDirection && String(orderDirection).toLowerCase() === 'desc'
            ? -1
            : 1;
        data.sort((a: any, b: any) => {
          let va: any;
          let vb: any;
          switch (orderBy) {
            case 'submittedDate':
              va = a.submittedDate;
              vb = b.submittedDate;
              break;
            case 'name':
              va = a.name != null ? String(a.name) : null;
              vb = b.name != null ? String(b.name) : null;
              if (va != null && vb != null) {
                const cmp = va.localeCompare(vb, 'en', {
                  sensitivity: 'base',
                  numeric: true,
                });
                return dir === -1 ? -cmp : cmp;
              }
              break;
            case 'email':
              va = a.email != null ? String(a.email) : null;
              vb = b.email != null ? String(b.email) : null;
              if (va != null && vb != null) {
                const cmp = va.localeCompare(vb, 'en', {
                  sensitivity: 'base',
                  numeric: true,
                });
                return dir === -1 ? -cmp : cmp;
              }
              break;
            default:
              va = a.id;
              vb = b.id;
          }
          if (va == null && vb == null) return 0;
          if (va == null) return dir === -1 ? 1 : -1;
          if (vb == null) return dir === -1 ? -1 : 1;
          if (va < vb) return dir === -1 ? 1 : -1;
          if (va > vb) return dir === -1 ? -1 : 1;
          return 0;
        });
      }

      return { data, totalPages, totalStudentsCount };
    } catch (err) {
      throw err;
    }
  }

  async getAssessmentInfoBy(
    bootcamp_id: number,
    limit: number,
    offset: number,
    orderBy?: 'submittedDate' | 'name' | 'email',
    orderDirection?: 'asc' | 'desc',
    submittedDateStart?: string,
    submittedDateEnd?: string,
  ) {
    try {
      // Build date filter for submittedDate
      let dateFilter = sql`TRUE`;
      if (submittedDateStart && submittedDateEnd) {
        dateFilter = sql`zuvyCourseModules.submitted_date BETWEEN ${submittedDateStart} AND ${submittedDateEnd}`;
      } else if (submittedDateStart) {
        dateFilter = sql`zuvyCourseModules.submitted_date >= ${submittedDateStart}`;
      } else if (submittedDateEnd) {
        dateFilter = sql`zuvyCourseModules.submitted_date <= ${submittedDateEnd}`;
      }

      // Build order clause
      let orderClause = undefined;
      if (orderBy) {
        orderClause = (
          zuvyCourseModules: {
            submitted_date: any;
            percentage: any;
            name: any;
            email: any;
            id: any;
          },
          helpers: { desc: any; asc: (arg0: any) => any },
          { sql }: any,
        ) => {
          const dir =
            orderDirection && orderDirection.toLowerCase() === 'desc'
              ? helpers.desc
              : helpers.asc;
          if (orderBy === 'submittedDate')
            return dir(zuvyCourseModules.submitted_date);
          // Order by related user fields via subselects if requested
          if (orderBy === 'name')
            return dir(
              sql`(SELECT name FROM main.users AS u WHERE u.id = ${zuvyCourseModules.id}) order by name ${dir === helpers.desc ? 'desc' : 'asc'}`,
            );
          if (orderBy === 'email')
            return dir(
              sql`(SELECT email FROM main.users AS u WHERE u.id = ${zuvyCourseModules.id}) order by email ${dir === helpers.desc ? 'desc' : 'asc'}`,
            );
          return helpers.asc(zuvyCourseModules.id);
        };
      }

      const statusOfStudentCode = await db.query.zuvyCourseModules.findMany({
        where: (zuvyCourseModules, { sql }) =>
          sql`${zuvyCourseModules.bootcampId} = ${bootcamp_id} AND ${dateFilter}`,
        with: {
          moduleAssessments: {
            columns: {
              moduleId: true,
              title: true,
              codingProblems: true,
              mcq: true,
              openEndedQuestions: true,
              id: true,
            },
            with: {
              assessmentSubmissions: {
                where: (
                  zuvyAssessmentSubmission: { bootcampId: any },
                  { sql }: any,
                ) =>
                  sql`${zuvyAssessmentSubmission.bootcampId} = ${bootcamp_id}`,
                columns: {
                  userId: true,
                  assessmentId: true,
                },
              },
            },
          },
        },
        limit: limit,
        offset: offset,
        ...(orderClause ? { orderBy: orderClause } : {}),
      });

      let bootcampStudents = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(
          sql` ${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} AND${zuvyBatchEnrollments.batchId} IS NOT NULL  `,
        );

      return {
        data: statusOfStudentCode,
        totalstudents: bootcampStudents.length,
      };
    } catch (error) {
      console.error('Error fetching assessment info:', error);
      throw error;
    }
  }

  async formatedChapterDetails(chapterDetails: any) {
    try {
      chapterDetails.Quizzes = chapterDetails?.Quizzes.map(
        (Quizzes: { Quiz: any }) => {
          let quizDetails = { ...Quizzes.Quiz };
          delete Quizzes.Quiz;
          return { ...Quizzes, ...quizDetails };
        },
      );

      chapterDetails.OpenEndedQuestions =
        chapterDetails?.OpenEndedQuestions.map(
          (OpenEndedQuestions: { OpenEndedQuestion: any }) => {
            let openEndedDetails = { ...OpenEndedQuestions.OpenEndedQuestion };
            delete OpenEndedQuestions.OpenEndedQuestion;
            return { ...OpenEndedQuestions, ...openEndedDetails };
          },
        );

      chapterDetails.CodingQuestions = chapterDetails?.CodingQuestions.map(
        (CodingQuestions: { CodingQuestion: any }) => {
          let codingDetails = { ...CodingQuestions.CodingQuestion };
          delete CodingQuestions.CodingQuestion;
          return { ...CodingQuestions, ...codingDetails };
        },
      );

      return chapterDetails;
    } catch (err) {
      throw err;
    }
  }

  async calculateTotalPoints(data: any) {
    let { hardCodingMark, mediumCodingMark, easyCodingMark } = data;
    const CODING_POINTS = {
      easy: easyCodingMark,
      medium: mediumCodingMark,
      hard: hardCodingMark,
    };
    // const totalOpenPoints = data.OpenEndedQuestions.reduce((sum, q) => sum + pointsMapping.OPEN_ENDED_POINTS[q.difficulty], 0);
    const totalCodingPoints = data.CodingQuestions.reduce(
      (sum: any, q: { difficulty: string | number }) =>
        sum + CODING_POINTS[q.difficulty],
      0,
    );

    let codingQuestionCount = data.CodingQuestions.length;
    let mcqQuestionCount = data.Quizzes.length;
    let openEndedQuestionCount = data.OpenEndedQuestions.length;
    let {
      hardMcqMark,
      mediumMcqMark,
      easyMcqMark,
      hardMcqQuestions,
      mediumMcqQuestions,
      easyMcqQuestions,
    } = data;
    let totalMCQPoints =
      hardMcqMark * hardMcqQuestions +
      mediumMcqMark * mediumMcqQuestions +
      easyMcqMark * easyMcqQuestions;
    const totalPoints = totalMCQPoints + totalCodingPoints;

    return {
      totalMCQPoints,
      totalCodingPoints,
      totalPoints,
      codingQuestionCount,
      mcqQuestionCount,
      openEndedQuestionCount,
    };
  }

  async calculateAssessmentResults(
    assessmentOutsourseId: number,
    practiceCodeData: any,
    mcqScore: number,
  ) {
    try {
      let assessment: any = await db
        .select()
        .from(zuvyOutsourseAssessments)
        .where(eq(zuvyOutsourseAssessments.id, assessmentOutsourseId));

      if (assessment == undefined || assessment.length == 0) {
        return [
          {
            status: 'error',
            statusCode: 404,
            message: 'Assessment not found',
          },
        ];
      }
      assessment = assessment[0];
      let codingMarks = {
        Easy: assessment.easyCodingMark,
        Medium: assessment.mediumCodingMark,
        Hard: assessment.hardCodingMark,
      };
      // Only count the latest submission per questionId
      const latestCodingSubmissions = Object.values(
        (practiceCodeData || []).reduce(
          (
            acc: { [x: string]: any },
            curr: { questionId: any; createdAt: any },
          ) => {
            const qid = curr.questionId;
            if (
              !acc[qid] ||
              new Date(curr.createdAt || 0) > new Date(acc[qid]?.createdAt || 0)
            ) {
              acc[qid] = curr;
            }
            return acc;
          },
          {},
        ),
      );
      let codingScore = 0;
      latestCodingSubmissions.forEach((codingQuestionSubmission: any) => {
        codingScore +=
          codingMarks[codingQuestionSubmission.questionDetail.difficulty];
      });
      const totalCodingMarks =
        assessment.easyCodingQuestions * assessment.easyCodingMark +
        assessment.mediumCodingQuestions * assessment.mediumCodingMark +
        assessment.hardCodingQuestions * assessment.hardCodingMark;

      // Calculate total possible score for MCQs
      const totalMcqMarks =
        assessment.easyMcqQuestions * assessment.easyMcqMark +
        assessment.mediumMcqQuestions * assessment.mediumMcqMark +
        assessment.hardMcqQuestions * assessment.hardMcqMark;
      // Total assessment score
      let totalStudentScore = codingScore + mcqScore;
      const totalAssessmentMarks = totalCodingMarks + totalMcqMarks;
      let percentage = (totalStudentScore / totalAssessmentMarks) * 100;
      percentage = percentage ? percentage : 0;
      let isPassed = assessment.passPercentage <= percentage ? true : false;
      let updateAssessmentSubmission = {
        attemptedCodingQuestions: latestCodingSubmissions.length,
        codingScore: parseFloat(codingScore.toFixed(2)),
        marks: parseFloat(totalStudentScore.toFixed(2)),
        isPassed,
        percentage: parseFloat(percentage.toFixed(2)),
      };
      return [null, updateAssessmentSubmission];
    } catch (err) {
      return [{ message: err.message }];
    }
  }

  async getAssessmentSubmission(
    assessmentSubmissionId: number,
    userId: number,
  ) {
    try {
      const data: any = await db.query.zuvyAssessmentSubmission.findFirst({
        where: (zuvyAssessmentSubmission, { eq }) =>
          eq(zuvyAssessmentSubmission.id, assessmentSubmissionId),
        with: {
          user: {
            columns: {
              email: true,
              name: true,
              id: true,
            },
          },
          submitedOutsourseAssessment: true,
          PracticeCode: {
            where: (
              zuvyPracticeCode: { status: any; action: any; userId: any },
              { eq, and }: any,
            ) =>
              and(
                eq(zuvyPracticeCode.status, ACCEPTED),
                eq(zuvyPracticeCode.action, SUBMIT),
                eq(zuvyPracticeCode.userId, userId),
              ),
            distinct: [zuvyPracticeCode.questionId],
            with: {
              questionDetail: true,
            },
          },
        },
      });
      if (data == undefined || data.length == 0) {
        return [
          {
            status: 'error',
            statusCode: 404,
            message: 'Assessment not found',
          },
        ];
      }
      // Only return the fetched data, do not calculate results here
      // The calculation will be handled in assessmentSubmission
      return [
        null,
        {
          userId: data.user.id,
          submitedAt: data.submitedAt,
          assessmentOutsourseId: data.assessmentOutsourseId,
          PracticeCode: data.PracticeCode,
          mcqScore: data.mcqScore,
          marks: data.marks,
          isPassed: data.isPassed,
          codingScore: data.codingScore,
          // Add any other fields needed by assessmentSubmission
        },
      ];
    } catch (err) {
      return [{ message: err.message }];
    }
  }

  async assessmentSubmission(
    data: SubmissionassessmentDto,
    id: number,
    userId: number,
  ): Promise<any> {
    try {
      let err: any, submitData: any;
      // Step 1: Fetch assessment submission details for the user and submission id
      [err, submitData] = await this.getAssessmentSubmission(id, userId);
      if (err) {
        // If there is an error in fetching, return immediately
        return [err];
      }

      // Step 2: Validate the fetched data
      if (!submitData) {
        return [
          {
            status: 'error',
            statusCode: 404,
            message: 'Assessment not found',
          },
        ];
      }
      if (submitData.userId != userId) {
        return [
          {
            status: 'error',
            statusCode: 400,
            message: 'Unauthorized assessment submission',
          },
        ];
      }
      // Only check submitedAt if it exists on submitData
      if ('submitedAt' in submitData && submitData.submitedAt != null) {
        return [
          {
            status: 'error',
            statusCode: 400,
            message: 'Assessment already submitted',
          },
        ];
      }

      // Step 3: Calculate assessment results before updating
      // Use the same logic as getAssessmentSubmission, but call directly here
      const [errCalc, calcResult] = await this.calculateAssessmentResults(
        submitData.assessmentOutsourseId,
        submitData.PracticeCode,
        submitData.mcqScore,
      );
      if (errCalc) {
        return [errCalc];
      }

      // Step 4: Merge input data, fetched submission data, and calculated results
      // Ensure all relevant fields from getAssessmentSubmission are included in the return
      const mergedData = {
        ...data,
        ...calcResult,
        userId: submitData.userId,
        submitedAt: submitData.submitedAt || new Date(),
        assessmentOutsourseId: submitData.assessmentOutsourseId,
        mcqScore: Number(parseFloat(submitData.mcqScore).toFixed(2)),
      };

      // Step 5: Update the assessment submission in the database
      const assessment = await db
        .update(zuvyAssessmentSubmission)
        .set(mergedData)
        .where(eq(zuvyAssessmentSubmission.id, id))
        .returning();
      if (!assessment || assessment.length === 0) {
        return [
          {
            status: 'error',
            statusCode: 404,
            message: 'Assessment not found',
          },
        ];
      }

      return [null, mergedData];
    } catch (err) {
      // Log and return error in case of failure
      console.error('Error in assessmentSubmission:', err);
      return [{ message: err.message }];
    }
  }

  async submissionOpenended(
    OpenendedQuestionData: CreateOpenendedQuestionDto,
    userId: number,
  ) {
    try {
      const OpenendedQuestionSubmission = await db
        .insert(zuvyOpenEndedQuestionSubmission)
        .values({ ...OpenendedQuestionData, userId })
        .returning();
      return OpenendedQuestionSubmission;
    } catch (err) {
      throw err;
    }
  }

  async patchOpenendedQuestion(data: any, id: number) {
    try {
      const res = await db
        .update(zuvyOpenEndedQuestionSubmission)
        .set(data)
        .where(eq(zuvyOpenEndedQuestionSubmission.id, id))
        .returning();
      return res;
    } catch (err) {
      throw err;
    }
  }

  async instructorFeedback(data: any, id: number) {
    try {
      const res = await db
        .update(zuvyOpenEndedQuestionSubmission)
        .set(data)
        .where(eq(zuvyOpenEndedQuestionSubmission.id, id))
        .returning();
      return res;
    } catch (err) {
      throw err;
    }
  }

  async getOpenendedQuestionSubmission(
    submer_assissment_id: number | SQLWrapper,
  ) {
    try {
      const res = await db.query.zuvyOpenEndedQuestionSubmission.findMany({
        where: (zuvyOpenEndedQuestionSubmission, { eq }) =>
          eq(zuvyOpenEndedQuestionSubmission.id, submer_assissment_id),
        with: {
          user: {
            columns: {
              name: true,
              email: true,
            },
          },
          openEnded: {
            columns: {
              id: true,
              question: true,
              difficulty: true,
            },
          },
        },
      });
      return res;
    } catch (err) {
      throw err;
    }
  }

  async getAllProjectSubmissions(
    roleName,
    bootcampId: number,
    searchProject: string,
    orderBy?: 'title',
    orderDirection?: 'asc' | 'desc',
    submittedDateStart?: string,
    submittedDateEnd?: string,
  ) {
    try {
      // ===== DATE FILTER =====
      let dateFilter = sql`TRUE`;
      if (submittedDateStart && submittedDateEnd) {
        dateFilter = sql`projectData.submitted_date BETWEEN ${submittedDateStart} AND ${submittedDateEnd}`;
      } else if (submittedDateStart) {
        dateFilter = sql`projectData.submitted_date >= ${submittedDateStart}`;
      } else if (submittedDateEnd) {
        dateFilter = sql`projectData.submitted_date <= ${submittedDateEnd}`;
      }

      // ===== SORT VALIDATION =====
      if (!orderBy && orderDirection) {
        return {
          status: 'error',
          code: 400,
          message: 'You cannot pass orderDirection without orderBy field.',
        };
      }

      if (orderBy && !orderDirection) {
        return {
          status: 'error',
          code: 400,
          message:
            'orderDirection is required when orderBy is provided. Please use "asc" or "desc".',
        };
      }

      // ===== FETCH DATA (DRIZZLE SORTING HERE) =====
      const data: any = await db.query.zuvyBootcamps.findFirst({
        columns: {
          id: true,
          name: true,
        },
        where: (bootcamp, { eq }) => eq(bootcamp.id, bootcampId),
        with: {
          bootcampModules: {
            columns: { id: true },
            where: (courseModule: { typeId: any }, { sql }: any) =>
              sql`${courseModule.typeId} = 2`,

            // Module sorting remains same
            orderBy: (courseModule, { asc }) => asc(courseModule.order),

            with: {
              projectData: {
                columns: {
                  id: true,
                  title: true,
                  submitted_date: true,
                },

                where: (projectData: { title: any }, { sql }: any) =>
                  and(
                    searchProject
                      ? sql`${projectData.title} ILIKE ${'%' + searchProject + '%'}`
                      : sql`TRUE`,
                    dateFilter,
                  ),

                // ⭐⭐⭐ DRIZZLE ORDER BY TITLE (ALPHABETICAL SORTING)
                orderBy: (projectData, { asc, desc }) =>
                  orderBy === 'title'
                    ? orderDirection === 'desc'
                      ? desc(projectData.title)
                      : asc(projectData.title)
                    : asc(projectData.title),

                with: {
                  projectTrackingData: true,
                },
              },
            },
          },
        },
      });

      // ===== STUDENT COUNT =====
      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId));

      // ===== PROCESS DATA =====
      data.bootcampModules.forEach((module: any) => {
        module.projectData.forEach((project: any) => {
          project.submitStudents = project.projectTrackingData.length;
          delete project.projectTrackingData;
        });
      });

      // Remove empty modules
      data.bootcampModules = data.bootcampModules.filter(
        (module: any) => module.projectData.length > 0,
      );

      // ===== PERMISSIONS =====
      const targetPermissions = [
        ResourceList.submission.read,
        ResourceList.submission.download,
        ResourceList.submission.re_attempt,
      ];
      const grantedPermissions = await this.rbacService.getAllPermissions(
        roleName,
        targetPermissions,
      );

      // ===== RESPONSE =====
      if (data.bootcampModules.length > 0) {
        return {
          status: 'success',
          code: 200,
          data,
          totalStudents: zuvyBatchEnrollmentsCount[0]?.count,
          ...grantedPermissions,
        };
      } else {
        return {
          status: 'error',
          code: 404,
          message: 'No project in this course.',
          ...grantedPermissions,
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async getUserDetailsForProject(
    projectId: number,
    bootcampId: number,
    batchId?: number,
    limit?: number,
    offset?: number,
    searchStudent?: string,
    orderBy?: any,
    orderDirection?: any,
  ) {
    try {
      // Coerce numeric params to safe values to avoid SQL injection/NaN issues
      const safeBatchId =
        typeof batchId === 'number' && !isNaN(batchId) ? batchId : undefined;
      const safeLimit =
        typeof limit === 'number' && !isNaN(limit) ? limit : undefined;
      const safeOffset =
        typeof offset === 'number' && !isNaN(offset) ? offset : undefined;
      // No date filtering — keep dateFilter TRUE
      let dateFilter = sql`TRUE`;

      // Prepare ordering: prefer DB-side ordering for name/email (via subselects) and percentage (grades)
      const requestedOrder = orderBy
        ? {
            field: orderBy,
            dir:
              orderDirection && orderDirection.toLowerCase() === 'desc'
                ? 'desc'
                : 'asc',
          }
        : undefined;
      let orderClause = undefined;
      if (requestedOrder) {
        const field = requestedOrder.field;
        const dirIsDesc = requestedOrder.dir === 'desc';
        orderClause = (projectTracking: any, helpers: any, { sql }: any) => {
          const dir = dirIsDesc ? helpers.desc : helpers.asc;
          if (field === 'submittedDate')
            return dir(projectTracking.submitted_date);
          if (field === 'name')
            return dir(
              sql`(SELECT name FROM main.users AS u WHERE u.id = ${projectTracking.userId})`,
            );
          if (field === 'email')
            return dir(
              sql`(SELECT email FROM main.users AS u WHERE u.id = ${projectTracking.userId})`,
            );
          return dir(projectTracking.id);
        };
      }

      const projectSubmissionData = await db.query.zuvyCourseProjects.findFirst(
        {
          where: (zuvyProject, { sql }) =>
            sql`${zuvyProject.id} = ${projectId}`,
          columns: {
            id: true,
            title: true,
          },
          with: {
            projectTrackingData: {
              where: (
                projectTracking: { bootcampId: any; userId: any },
                { and, eq, sql }: any,
              ) => {
                // Ensure projectTracking belongs to the bootcamp and (optionally) the batch by validating enrollment
                const conditions: any[] = [
                  eq(projectTracking.bootcampId, bootcampId),
                  dateFilter,
                ];

                if (searchStudent) {
                  // Add a LIKE/ILIKE filter on users table
                  conditions.push(sql`EXISTS (
                      SELECT 1
                      FROM main.users AS u
                      WHERE u.id = ${projectTracking.userId}
                      AND (u.name ILIKE ${searchStudent + '%'} OR u.email ILIKE ${searchStudent + '%'})
                    )`);
                }

                // Enforce that the user is enrolled in the bootcamp and matches batchId when provided
                conditions.push(sql`EXISTS (
                  SELECT 1 FROM main.zuvy_batch_enrollments AS be
                  WHERE be.user_id = ${projectTracking.userId} AND be.bootcamp_id = ${bootcampId} ${safeBatchId ? sql`AND be.batch_id = ${safeBatchId}` : sql``}
                )`);

                return and(...conditions);
              },
              columns: {
                id: true,
                userId: true,
                projectId: true,
                bootcampId: true,
                isChecked: true,
                moduleId: true,
                batchId: true,
                grades: true,
                submitted_date: true,
                createdAt: true,
                projectLink: true,
              },
              with: {
                userDetails: {
                  columns: {
                    name: true,
                    email: true,
                  },
                },
              },
              // attach DB-side limit/offset at the relation level (use safe values)
              // NOTE: we intentionally avoid DB-side `orderBy` here and perform
              // ordering in JS below to reliably support sorting by related
              // fields like `name`/`email` (via localeCompare) and `percentage`.
              ...(typeof safeLimit === 'number' ? { limit: safeLimit } : {}),
              ...(typeof safeOffset === 'number' ? { offset: safeOffset } : {}),
            },
          },
        },
      );

      // Get total count of students for pagination with search filter
      // Build a date filter for counting that references the zuvyProjectTracking alias
      let dateFilterForCount = sql`TRUE`;

      // Count total project tracking rows that match the filters and whose users are enrolled
      const totalStudentsCountRes = await db
        .select({
          count: sql<number>`cast(count(${zuvyProjectTracking.id}) as int)`,
        })
        .from(zuvyProjectTracking).where(sql`
          ${zuvyProjectTracking.projectId} = ${projectId}
          AND ${zuvyProjectTracking.bootcampId} = ${bootcampId}
          ${
            searchStudent
              ? sql`AND EXISTS (
                SELECT 1 FROM main.users AS u WHERE u.id = ${zuvyProjectTracking.userId} AND (u.name ILIKE ${searchStudent + '%'} OR u.email ILIKE ${searchStudent + '%'})
              )`
              : sql``
          }
          AND EXISTS (
            SELECT 1 FROM main.zuvy_batch_enrollments AS be
            WHERE be.user_id = ${zuvyProjectTracking.userId} AND be.bootcamp_id = ${bootcampId} ${safeBatchId ? sql`AND be.batch_id = ${safeBatchId}` : sql``}
          )
        `);

      const totalStudentsCount = totalStudentsCountRes[0]?.count ?? 0;
      const totalPages = limit
        ? Math.ceil(totalStudentsCount / (limit || 1))
        : 1;

      // Process the project submission data and ensure batchId/submitted_date/createdAt are exposed
      if (
        projectSubmissionData &&
        Array.isArray(projectSubmissionData['projectTrackingData']) &&
        projectSubmissionData['projectTrackingData'].length > 0
      ) {
        // Bulk-fetch enrollments for all users in the result so we can fill batchId from zuvy_batch_enrollments
        const userIds = projectSubmissionData['projectTrackingData']
          .map((p: any) => p.userId)
          .filter((id: any) => id !== undefined && id !== null)
          .map((id: any) => Number(id));
        let enrollmentMap: Record<string, any> = {};
        if (userIds.length > 0) {
          const enrollments = await db
            .select({
              userId: zuvyBatchEnrollments.userId,
              batchId: zuvyBatchEnrollments.batchId,
              batchName: zuvyBatches.name,
            })
            .from(zuvyBatchEnrollments)
            .leftJoin(
              zuvyBatches,
              eq(zuvyBatches.id, zuvyBatchEnrollments.batchId),
            )
            .where(
              sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.userId} in ${userIds} ${safeBatchId ? sql`AND ${zuvyBatchEnrollments.batchId} = ${safeBatchId}` : sql``}`,
            );

          enrollments.forEach((e: any) => {
            if (!enrollmentMap[String(e.userId)]) {
              enrollmentMap[String(e.userId)] = {
                batchId: e.batchId ?? null,
                batchName: e.batchName ?? null,
              };
            }
          });
        }

        projectSubmissionData['projectTrackingData'] = projectSubmissionData[
          'projectTrackingData'
        ].map((project: any) => {
          // normalize user details
          if (project['userDetails']) {
            project['name'] = project['userDetails']['name'];
            project['email'] = project['userDetails']['email'];
            delete project['userDetails'];
          }

          // ensure the additional fields are present on the object and prefer enrollment batch when available
          const enrollment = enrollmentMap[String(project.userId)];

          // ✅ FIXED batch mapping
          project['batchId'] =
            project['batchId'] ??
            project['batch_id'] ??
            enrollment?.batchId ??
            null;

          project['batchName'] =
            project['batchName'] ??
            project['batch_name'] ??
            enrollment?.batchName ??
            null;
          project['submitted_date'] =
            project['submitted_date'] ?? project['submittedDate'] ?? null;

          project['createdAt'] =
            project['createdAt'] ?? project['created_at'] ?? null;
          return project;
        });

        // Apply JS-side ordering
        if (requestedOrder) {
          const { field, dir } = requestedOrder;
          projectSubmissionData['projectTrackingData'].sort(
            (a: any, b: any) => {
              let va: any;
              let vb: any;
              if (field === 'submittedDate') {
                va = a.submitted_date;
                vb = b.submitted_date;
              } else if (field === 'percentage') {
                // project 'percentage' maps to the grades field on project tracking
                va = a.grades != null ? Number(a.grades) : null;
                vb = b.grades != null ? Number(b.grades) : null;
              } else if (field === 'name') {
                // use localeCompare for robust string ordering (case-insensitive)
                va = a.name != null ? String(a.name) : null;
                vb = b.name != null ? String(b.name) : null;
                if (va != null && vb != null) {
                  const cmp = va.localeCompare(vb, 'en', {
                    sensitivity: 'base',
                    numeric: true,
                  });
                  return dir === 'desc' ? -cmp : cmp;
                }
              } else if (field === 'email') {
                va = a.email != null ? String(a.email) : null;
                vb = b.email != null ? String(b.email) : null;
                if (va != null && vb != null) {
                  const cmp = va.localeCompare(vb, 'en', {
                    sensitivity: 'base',
                    numeric: true,
                  });
                  return dir === 'desc' ? -cmp : cmp;
                }
              } else {
                va = a.id;
                vb = b.id;
              }

              if (va == null && vb == null) return 0;
              if (va == null) return dir === 'desc' ? 1 : -1;
              if (vb == null) return dir === 'desc' ? -1 : 1;
              if (va < vb) return dir === 'desc' ? 1 : -1;
              if (va > vb) return dir === 'desc' ? -1 : 1;
              return 0;
            },
          );
        }

        // Apply pagination in JS
        const pagedData =
          typeof safeLimit === 'number' && typeof safeOffset === 'number'
            ? projectSubmissionData['projectTrackingData'].slice(
                safeOffset,
                safeOffset + safeLimit,
              )
            : projectSubmissionData['projectTrackingData'];

        return {
          status: 'success',
          code: 200,
          projectSubmissionData: {
            ...projectSubmissionData,
            projectTrackingData: pagedData,
          },
          totalPages: safeLimit > 0 ? totalPages : 1,
          totalStudents: totalStudentsCount,
        };
      } else {
        return {
          status: 'error',
          code: 404,
          message: 'No submission from any student for this project',
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async getProjectDetailsForAUser(
    projectId: number,
    userId: number,
    bootcampId: number,
  ) {
    try {
      const projectSubmissionDetails =
        await db.query.zuvyCourseProjects.findFirst({
          where: (zuvyProject, { sql }) =>
            sql`${zuvyProject.id} = ${projectId}`,
          with: {
            projectTrackingData: {
              where: (
                projectTracking: { bootcampId: any; userId: any },
                { sql }: any,
              ) =>
                sql`${projectTracking.bootcampId} = ${bootcampId} and ${projectTracking.userId} = ${userId}`,
              columns: {
                id: true,
                userId: true,
                projectId: true,
                bootcampId: true,
                isChecked: true,
                moduleId: true,
                batchId: true,
                grades: true,
                submitted_date: true,
                createdAt: true,
                projectLink: true,
              },
              with: {
                userDetails: {
                  columns: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        });
      return {
        status: 'success',
        code: 200,
        projectSubmissionDetails,
      };
    } catch (err) {
      throw err;
    }
  }

  // submission of the quizzez , and open ended questions, And  two different functons
  async submitQuiz(
    answers: any[],
    userId: number,
    assessmentSubmissionId: number,
    assessmentOutsourseId: number | SQLWrapper,
  ): Promise<any> {
    try {
      // Fetch required data
      const [submissionData, AssessmentsMasterData] = await Promise.all([
        this.getSubmissionQuiz(assessmentSubmissionId, userId),
        db
          .select()
          .from(zuvyOutsourseAssessments)
          .where(eq(zuvyOutsourseAssessments.id, assessmentOutsourseId)),
      ]);

      if (!AssessmentsMasterData.length) {
        return [{ message: 'Outsourse assessment not found' }];
      }

      const mcqMarks = {
        Easy: AssessmentsMasterData[0].easyMcqMark,
        Medium: AssessmentsMasterData[0].mediumMcqMark,
        Hard: AssessmentsMasterData[0].hardMcqMark,
      };

      const filterQuestionIds = submissionData.map(
        (answer) => answer.variantId,
      );
      const filterAnswersQuestionIds = answers.map(
        (answer: { variantId: any }) => answer.variantId,
      );
      let mcqScore = 0;
      let requiredMCQScore = 0;

      // Fetch quiz master data if applicable
      const quizMasterData = await db.query.zuvyModuleQuizVariants.findMany({
        where: (zuvyModuleQuizVariants, { sql }) =>
          sql`${zuvyModuleQuizVariants.id} in ${[...filterQuestionIds, ...filterAnswersQuestionIds]}`,
        with: {
          quiz: {
            columns: { difficulty: true, id: true },
          },
        },
      });

      quizMasterData.forEach((data: any) => {
        requiredMCQScore += mcqMarks[data.quiz.difficulty];
      });

      const insertData = [];
      const updatePromises = [];

      answers.forEach((answer: any) => {
        answer.status = 'failed';
        answer.assessmentSubmissionId = assessmentSubmissionId;

        const matchingQuiz: any = quizMasterData.find(
          (mcq) =>
            mcq.id === answer.variantId &&
            answer.chosenOption === mcq.correctOption,
        );

        if (matchingQuiz) {
          mcqScore += mcqMarks[matchingQuiz.quiz.difficulty];
          answer.status = 'passed';
        }
        if (filterQuestionIds.includes(answer.variantId)) {
          // Collect update promises
          updatePromises.push(
            db
              .update(zuvyQuizTracking)
              .set({ ...answer })
              .where(
                sql`${zuvyQuizTracking.questionId} = ${answer.questionId} 
                AND ${zuvyQuizTracking.assessmentSubmissionId} = ${assessmentSubmissionId} 
                AND ${zuvyQuizTracking.userId} = ${userId}`,
              )
              .returning(),
          );
        } else {
          // Collect insert data
          insertData.push({ ...answer, userId, assessmentSubmissionId });
        }
      });

      // Execute updates in parallel
      const updateResults =
        updatePromises.length > 0 ? await Promise.all(updatePromises) : [];

      // Insert new data if available
      const insertedData =
        insertData.length > 0
          ? await db.insert(zuvyQuizTracking).values(insertData).returning()
          : [];

      // Update assessment MCQ info
      const updateAssessmentMcqInfo: any = {
        mcqScore,
        requiredMCQScore,
        attemptedMCQQuestions: answers.length,
      };

      await db
        .update(zuvyAssessmentSubmission)
        .set(updateAssessmentMcqInfo)
        .where(sql`${zuvyAssessmentSubmission.id} = ${assessmentSubmissionId}`)
        .returning();

      // Return combined data
      return [
        null,
        {
          message: 'Successfully saved the Quiz.',
          data: [...insertedData, ...updateResults.flat()],
        },
      ];
    } catch (err) {
      return [{ message: err.message }];
    }
  }

  async getSubmissionQuiz(assessmentSubmissionId: any, userId: number) {
    try {
      const submissionQuiz = await db
        .select()
        .from(zuvyQuizTracking)
        .where(
          sql`${zuvyQuizTracking.assessmentSubmissionId} = ${assessmentSubmissionId} and ${zuvyQuizTracking.userId} = ${userId}`,
        );
      return submissionQuiz;
    } catch (err) {
      throw err;
    }
  }

  async submitOpenEndedQuestion(
    answers: any[],
    userId: number,
    assessmentSubmissionId: number | SQLWrapper,
  ) {
    try {
      let updateData = [];
      let insertData = [];
      let submissionData = await this.getSubmissionOpenEnded(
        assessmentSubmissionId,
        userId,
      );
      let updateResults = []; // Declare the updateResults variable

      if (submissionData.length > 0) {
        let filterQuestionId = submissionData.map(
          (answer) => answer.questionId,
        );
        let updatePromises = [];
        let insertPromises = [];

        for (let answer of answers) {
          if (filterQuestionId.includes(answer.questionId)) {
            let updatePromise = db
              .update(zuvyOpenEndedQuestionSubmission)
              .set({ ...answer })
              .where(
                sql`${zuvyOpenEndedQuestionSubmission.questionId} = ${answer.questionId} and ${zuvyOpenEndedQuestionSubmission.userId} = ${userId} and ${zuvyOpenEndedQuestionSubmission.assessmentSubmissionId} = ${assessmentSubmissionId}`,
              )
              .returning();
            updatePromises.push(updatePromise);
          } else {
            insertData.push({ ...answer, userId, assessmentSubmissionId });
          }
        }

        // Await all update promises
        if (updatePromises.length > 0) {
          let updateResults = await Promise.all(updatePromises);
          updateResults.forEach((result) => {
            updateData.push(result[0]);
          });
        }

        // Insert new answers if any
        if (insertData.length > 0) {
          const insertResults = await db
            .insert(zuvyOpenEndedQuestionSubmission)
            .values(insertData)
            .returning();
          insertData = insertResults;
        }
      } else {
        let quizInsertData = answers.map((answer: any) => ({
          ...answer,
          userId,
          assessmentSubmissionId,
        }));
        insertData = await db
          .insert(zuvyOpenEndedQuestionSubmission)
          .values(quizInsertData)
          .returning();
        await db
          .update(zuvyAssessmentSubmission)
          .set({ attemptedOpenEndedQuestions: insertData.length } as any)
          .where(eq(zuvyAssessmentSubmission.id, assessmentSubmissionId))
          .returning();
      }
      return {
        message: 'Successfully save the open ended question.',
        data: [...insertData, ...updateData],
      };
    } catch (err) {
      console.error('Error in submitOpenEndedQuestion:', err);
      throw err; // Ensure proper error handling/logging here
    }
  }

  async getSubmissionOpenEnded(assessmentSubmissionId: any, userId: number) {
    try {
      const submissionOpenEnded = await db
        .select()
        .from(zuvyOpenEndedQuestionSubmission)
        .where(
          sql`${zuvyOpenEndedQuestionSubmission.assessmentSubmissionId} = ${assessmentSubmissionId} and ${zuvyOpenEndedQuestionSubmission.userId} = ${userId}`,
        );
      return submissionOpenEnded;
    } catch (err) {
      throw err;
    }
  }

  async getSubmissionOfForms(
    roleName,
    bootcampId: number,
    searchForm?: string,
    limit?: number,
    offset?: number,
    orderBy?: 'title',
    orderDirection?: 'asc' | 'desc',
  ) {
    try {
      const topicId = 7;

      // Validate ordering inputs
      if ((orderBy && !orderDirection) || (!orderBy && orderDirection)) {
        return {
          status: 'error',
          code: 400,
          message: 'Both orderBy and orderDirection are required together',
        };
      }

      // ORDER BY chapter title
      let chapterOrderClause = (moduleChapter: any, helpers: any) =>
        helpers.asc(moduleChapter.title);

      if (orderBy === 'title') {
        chapterOrderClause = (moduleChapter: any, helpers: any) => {
          const dir = orderDirection === 'desc' ? helpers.desc : helpers.asc;
          return dir(moduleChapter.title);
        };
      }

      const trackingData: any[] = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq }) =>
          eq(courseModules.bootcampId, bootcampId),

        // ORDER BY course.order
        orderBy: (courseModules, { asc }) => asc(courseModules.order),

        with: {
          moduleChapterData: {
            columns: { id: true, title: true },

            // APPLY ORDER BY title inside chapters
            orderBy: chapterOrderClause,

            where: (moduleChapter, { eq, sql, and }) =>
              and(
                eq(moduleChapter.topicId, topicId),
                searchForm
                  ? sql`${moduleChapter.title} ILIKE ${searchForm + '%'}`
                  : sql`TRUE`,
              ),

            with: {
              chapterTrackingDetails: {
                columns: { userId: true, completedAt: true },
                with: {
                  user: { columns: { name: true, email: true, id: true } },
                },
              },
            },
          },
        },

        limit,
        offset,
      });

      // Process data
      trackingData.forEach((course) => {
        course.moduleChapterData.forEach((chapter) => {
          const details = chapter.chapterTrackingDetails || [];
          chapter.submitStudents = details.length;
          chapter.submissions = details.map((d: any) => ({
            userId: d.user?.id,
            name: d.user?.name,
            email: d.user?.email,
            completedAt: d.completedAt,
          }));
          delete chapter.chapterTrackingDetails;
        });
      });

      const totalForms = trackingData.reduce(
        (total, course) => total + course.moduleChapterData.length,
        0,
      );

      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId));

      const filteredTrackingData = trackingData.filter(
        (course) => course.moduleChapterData.length > 0,
      );

      const totalPages = limit ? Math.ceil(totalForms / limit) : 1;

      const targetPermissions = [
        ResourceList.submission.read,
        ResourceList.submission.download,
        ResourceList.submission.re_attempt,
      ];
      const grantedPermissions = await this.rbacService.getAllPermissions(
        roleName,
        targetPermissions,
      );

      return {
        status: 'success',
        code: 200,
        trackingData: filteredTrackingData,
        ...grantedPermissions,
        totalStudents: zuvyBatchEnrollmentsCount[0]?.count,
        totalForms,
        totalPages,
        currentPage:
          limit && offset !== undefined ? Math.floor(offset / limit) + 1 : 1,
      };
    } catch (err) {
      throw err;
    }
  }

  async formsStatusOfStudents(
    bootcampId: number,
    chapterId: number,
    moduleId: number,
    batchId?: number,
    limit?: number,
    offset?: number,
    searchStudent?: string,
    orderBy?: any,
    orderDirection?: any,
  ) {
    try {
      if (isNaN(bootcampId) || bootcampId <= 0) {
        throw new Error('Invalid bootcampId');
      }

      // normalize batchId
      const safeBatchId =
        typeof batchId !== 'undefined' && batchId !== null
          ? Number(batchId)
          : undefined;
      const hasBatchFilter =
        Number.isFinite(safeBatchId) && safeBatchId > 0
          ? safeBatchId
          : undefined;

      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(
          hasBatchFilter
            ? sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.batchId} = ${hasBatchFilter}`
            : sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`,
        );

      const totalAllStudents = zuvyBatchEnrollmentsCount[0]?.count ?? 0;

      //INCOMPLETE STUDENTS (ENROLLMENTS)//
      const statusOfIncompletedStudentFormRaw =
        await db.query.zuvyBatchEnrollments.findMany({
          where: (be, { sql, and }) => {
            const conditions: any[] = [
              sql`${be.bootcampId} = ${bootcampId}`,
              hasBatchFilter
                ? sql`${be.batchId} = ${hasBatchFilter}`
                : sql`${be.batchId} IS NOT NULL`,
            ];

            if (searchStudent) {
              conditions.push(sql`EXISTS (
              SELECT 1 FROM main.users AS u
              WHERE u.id = ${be.userId}
              AND (u.name ILIKE ${searchStudent + '%'} OR u.email ILIKE ${searchStudent + '%'})
            )`);
            }
            return and(...conditions);
          },
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
            batchInfo: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        });

      const statusOfIncompletedStudentForm =
        statusOfIncompletedStudentFormRaw.filter((r) => r['user']);

      const statusOfCompletedStudentFormRaw =
        await db.query.zuvyChapterTracking.findMany({
          where: (ct, { sql, and }) => {
            const conditions: any[] = [
              sql`${ct.chapterId} = ${chapterId}`,
              sql`${ct.moduleId} = ${moduleId}`,
              sql`EXISTS (
              SELECT 1 FROM main.zuvy_batch_enrollments AS be
              WHERE be.user_id = ${ct.userId}
              AND be.bootcamp_id = ${bootcampId}
              ${hasBatchFilter ? sql`AND be.batch_id = ${hasBatchFilter}` : sql``}
            )`,
            ];

            if (searchStudent) {
              conditions.push(sql`EXISTS (
              SELECT 1 FROM main.users AS u
              WHERE u.id = ${ct.userId}
              AND (u.name ILIKE ${searchStudent + '%'} OR u.email ILIKE ${searchStudent + '%'})
            )`);
            }

            return and(...conditions);
          },
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

      /* -------------------------------------------------- */
      /* 🔹 FETCH BATCH INFO FOR COMPLETED USERS */
      /* -------------------------------------------------- */
      const completedUserIds = statusOfCompletedStudentFormRaw
        .map((s: any) => s.userId)
        .filter((id: any) => id !== undefined && id !== null);

      let completedEnrollmentMap: Record<
        string,
        { batchId: number | null; batchName: string | null }
      > = {};

      if (completedUserIds.length > 0) {
        const enrollments = await db
          .select({
            userId: zuvyBatchEnrollments.userId,
            batchId: zuvyBatchEnrollments.batchId,
            batchName: zuvyBatches.name,
          })
          .from(zuvyBatchEnrollments)
          .leftJoin(
            zuvyBatches,
            eq(zuvyBatches.id, zuvyBatchEnrollments.batchId),
          ).where(sql`
          ${zuvyBatchEnrollments.bootcampId} = ${bootcampId}
          AND ${zuvyBatchEnrollments.userId} IN ${completedUserIds}
          ${hasBatchFilter ? sql`AND ${zuvyBatchEnrollments.batchId} = ${hasBatchFilter}` : sql``}
        `);

        enrollments.forEach((e: any) => {
          if (!completedEnrollmentMap[String(e.userId)]) {
            completedEnrollmentMap[String(e.userId)] = {
              batchId: e.batchId ?? null,
              batchName: e.batchName ?? null,
            };
          }
        });
      }

      const data1 = statusOfCompletedStudentFormRaw
        .filter((s) => s['user'])
        .map((s) => {
          const uid = String(s['user'].id);
          return {
            id: Number(s['user'].id),
            name: s['user'].name,
            email: s['user'].email,
            status: 'Submitted',
            batchId: completedEnrollmentMap[uid]?.batchId ?? null,
            batchName: completedEnrollmentMap[uid]?.batchName ?? null,
            submittedAt:
              s['submitted_date'] || s.completedAt || s['createdAt'] || null,
          };
        });

      const completedIds = new Set(data1.map((d) => d.id));

      const data2 = statusOfIncompletedStudentForm
        .filter((s) => !completedIds.has(Number(s['user'].id)))
        .map((s) => ({
          id: Number(s['user'].id),
          name: s['user'].name,
          email: s['user'].email,
          status: 'Not Submitted',
          batchId: s.batchId ?? null,
          batchName: s['batchInfo'].name ?? null,
          submittedAt: null,
        }));

      let combinedData = [...data1, ...data2];

      if (orderBy) {
        const dir = orderDirection?.toLowerCase() === 'desc' ? -1 : 1;

        combinedData.sort((a: any, b: any) => {
          let va: any;
          let vb: any;
          if (orderBy === 'submittedDate') {
            va = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
            vb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          } else if (orderBy === 'name') {
            va = (a.name || '').toLowerCase();
            vb = (b.name || '').toLowerCase();
          } else if (orderBy === 'email') {
            va = (a.email || '').toLowerCase();
            vb = (b.email || '').toLowerCase();
          }
          if (va < vb) return -1 * dir;
          if (va > vb) return 1 * dir;
          return 0;
        });
      }

      const offsetNum = Number.isFinite(Number(offset)) ? Number(offset) : 0;
      const limitNum =
        Number.isFinite(Number(limit)) && Number(limit) > 0
          ? Number(limit)
          : undefined;

      const paginatedData =
        typeof limitNum === 'number'
          ? combinedData.slice(offsetNum, offsetNum + limitNum)
          : combinedData;

      const totalPages = limitNum
        ? Math.ceil(combinedData.length / limitNum)
        : 1;

      return {
        status: 'Success',
        code: 200,
        moduleId,
        chapterId,
        combinedData: paginatedData,
        totalPages,
        totalStudentsCount: combinedData.length,
        totalAllStudents,
      };
    } catch (err) {
      throw err;
    }
  }

  async getFormDetailsById(
    moduleId: number,
    chapterId: number,
    userId: number,
  ) {
    try {
      const chapterDetails = await db
        .select()
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.id, chapterId));

      const FormTracking = await db
        .select()
        .from(zuvyFormTracking)
        .where(
          sql`${zuvyFormTracking.userId} = ${userId} and ${zuvyFormTracking.chapterId} = ${chapterId} and ${zuvyFormTracking.moduleId} = ${moduleId}`,
        );

      const ChapterTracking = await db
        .select()
        .from(zuvyChapterTracking)
        .where(
          sql`${zuvyChapterTracking.userId} = ${userId} and ${zuvyChapterTracking.chapterId} = ${chapterId} and ${zuvyChapterTracking.moduleId} = ${moduleId}`,
        );

      if (chapterDetails.length > 0) {
        if (chapterDetails[0].topicId == 7) {
          if (chapterDetails[0].formQuestions !== null) {
            if (FormTracking.length == 0) {
              // const questions = await db
              //   .select({
              //     id: zuvyModuleForm.id,
              //     question: zuvyModuleForm.question,
              //     options: zuvyModuleForm.options,
              //     typeId: zuvyModuleForm.typeId,
              //     isRequired: zuvyModuleForm.isRequired
              //   })
              //   .from(zuvyModuleForm)
              //   .where(
              //     sql`${inArray(zuvyModuleForm.id, Object.values(chapterDetails[0].formQuestions))}`,
              //   );
              // questions['status'] =
              //   ChapterTracking.length != 0
              //     ? 'Completed'
              //     : 'Pending';

              return {
                status: 'success',
                code: 200,
                message: 'Form not submitted by student',
              };
            } else {
              const trackedData = await db.query.zuvyModuleForm.findMany({
                where: (moduleForm, { sql }) =>
                  sql`${inArray(moduleForm.id, Object.values(chapterDetails[0].formQuestions))}`,
                with: {
                  formTrackingData: {
                    columns: {
                      chosenOptions: true,
                      answer: true,
                      status: true,
                      updatedAt: true,
                    },
                    where: (formTracking, { sql }) =>
                      sql`${formTracking.userId} = ${userId} and ${formTracking.chapterId} = ${chapterId} and ${formTracking.moduleId} = ${moduleId}`,
                  },
                },
              });

              trackedData['status'] =
                ChapterTracking.length != 0 ? 'Completed' : 'Pending';

              return {
                status: 'success',
                code: 200,
                message: 'Form submitted by student',
                trackedData,
              };
            }
          }
        } else {
          let content = [
            {
              title: chapterDetails[0].title,
              description: chapterDetails[0].description,
              links: chapterDetails[0].links,
              file: chapterDetails[0].file,
              content: chapterDetails[0].articleContent,
            },
          ];
          return content;
        }
      } else {
        return 'No Form found';
      }
    } catch (err) {
      throw err;
    }
  }

  async getSubmissionOfAssignment(
    roleName,
    bootcampId: number,
    assignmentName: string,
    orderBy?: 'title',
    orderDirection?: 'asc' | 'desc',
  ): Promise<any> {
    try {
      const topicId = 5;

      // Validate ordering inputs
      if ((orderBy && !orderDirection) || (!orderBy && orderDirection)) {
        return [
          {
            message: 'Both orderBy and orderDirection are required together',
            statusCode: STATUS_CODES.BAD_REQUEST,
          },
          null,
        ];
      }

      // ORDER BY chapter title only
      let chapterOrderClause = (moduleChapter: any, helpers: any) =>
        helpers.asc(moduleChapter.title);

      if (orderBy === 'title') {
        chapterOrderClause = (moduleChapter: any, helpers: any) => {
          const dir = orderDirection === 'desc' ? helpers.desc : helpers.asc;
          return dir(moduleChapter.title);
        };
      }

      const trackingData = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq }) =>
          eq(courseModules.bootcampId, bootcampId),
        // MODULE ORDER
        orderBy: (courseModules, { desc }) => desc(courseModules.order),
        with: {
          moduleChapterData: {
            columns: {
              id: true,
              title: true,
            },
            // APPLY ORDER BY TITLE HERE
            orderBy: chapterOrderClause,
            where: (
              moduleChapter: { topicId: any; title: any },
              { and, eq, sql }: any,
            ) =>
              and(
                eq(moduleChapter.topicId, topicId),
                assignmentName
                  ? sql`${moduleChapter.title} ILIKE ${assignmentName + '%'}`
                  : sql`TRUE`,
              ),
            with: {
              chapterTrackingDetails: {
                columns: {
                  userId: true,
                  completedAt: true,
                },
                with: {
                  user: {
                    columns: {
                      name: true,
                      email: true,
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Fetch the total student count for the bootcamp
      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(
          sql`(${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL)`,
        );

      // Process tracking data, count submitted students, and filter out empty moduleChapterData
      const filteredTrackingData = trackingData
        .map((course: any) => {
          course.moduleChapterData = course.moduleChapterData
            .map((chapterTracking: { [x: string]: any }) => {
              chapterTracking['submitStudents'] =
                chapterTracking['chapterTrackingDetails'].length;
              delete chapterTracking['chapterTrackingDetails'];

              return chapterTracking;
            })
            .filter(
              (chapterTracking: { [x: string]: number }) =>
                chapterTracking['submitStudents'] > 0,
            );

          return course;
        })
        .filter((course: any) => course.moduleChapterData.length > 0);

      // If no assignment name is provided, return all courses regardless of submissions
      const finalTrackingData = assignmentName
        ? filteredTrackingData
        : trackingData;
      const targetPermissions = [
        ResourceList.submission.read,
        ResourceList.submission.download,
        ResourceList.submission.re_attempt,
      ];
      const grantedPermissions = await this.rbacService.getAllPermissions(
        roleName,
        targetPermissions,
      );

      return [
        null,
        {
          message: 'Submission of assignment for courses has been fetched',
          statusCode: STATUS_CODES.OK,
          data: {
            trackingData: finalTrackingData,
            totalStudents: zuvyBatchEnrollmentsCount[0]?.count,
          },
          ...grantedPermissions,
        },
      ];
    } catch (error) {
      return [
        { message: error.message, statusCode: STATUS_CODES.BAD_REQUEST },
        null,
      ];
    }
  }

  async assignmentStatusOfStudents(
    chapterId: number,
    batchId?: number,
    limit?: number,
    offset?: number,
    searchStudent?: string,
    orderBy?: any,
    orderDirection?: any,
  ): Promise<any> {
    try {
      // Get chapter details
      const chapterDeadline = await db
        .select()
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.id, chapterId));

      if (chapterDeadline.length > 0) {
        // Build order clause (support submittedDate, name, email)
        let orderClause = undefined;
        if (orderBy) {
          orderClause = (
            chapterTracking: {
              userId: any;
              submitted_date: any;
              percentage: any;
              name: any;
              email: any;
              id: any;
            },
            helpers: { desc: any; asc: (arg0: any) => any },
            { sql }: any,
          ) => {
            const dir =
              orderDirection &&
              orderDirection.toString().toLowerCase() === 'desc'
                ? helpers.desc
                : helpers.asc;
            if (orderBy === 'submittedDate')
              return dir(chapterTracking.submitted_date);
            // Order by related user fields using a sub-select. This avoids fetching all rows and sorting in JS
            if (orderBy === 'name')
              return dir(
                sql`(SELECT name FROM main.users AS u WHERE u.id = ${chapterTracking.userId})`,
              );
            if (orderBy === 'email')
              return dir(
                sql`(SELECT email FROM main.users AS u WHERE u.id = ${chapterTracking.userId})`,
              );
            return helpers.asc(chapterTracking.id);
          };
        }

        const statusOfStudentCode = await db.query.zuvyChapterTracking.findMany(
          {
            where: (chapterTracking, { sql, and }) => {
              const conditions = [
                sql`${chapterTracking.chapterId} = ${chapterId}`,
                sql`EXISTS (
                SELECT 1
                FROM main.zuvy_batch_enrollments AS be
                WHERE be.user_id = ${chapterTracking.userId}
                ${batchId ? sql`AND be.batch_id = ${batchId}` : sql``}
              )`,
              ];
              if (searchStudent) {
                conditions.push(sql`EXISTS (
                  SELECT 1 FROM main.users AS u
                  WHERE u.id = ${chapterTracking.userId}
                  AND (u.name ILIKE ${searchStudent + '%'} OR u.email ILIKE ${searchStudent + '%'})
                )`);
              }
              return and(...conditions);
            },
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true,
                },
                with: {
                  studentAssignmentStatus: {
                    columns: {
                      bootcampId: true,
                    },
                  },
                },
              },
            },
          },
        );

        // Get the total student count for pagination using enrollment table to respect batch filtering
        const totalStudentsRes = await db
          .select({
            count: sql<number>`cast(count(${zuvyChapterTracking.id}) as int)`,
          })
          .from(zuvyChapterTracking).where(sql`
            ${zuvyChapterTracking.chapterId} = ${chapterId}
            ${
              batchId
                ? sql`AND EXISTS (SELECT 1 FROM main.zuvy_batch_enrollments AS be WHERE be.user_id = ${zuvyChapterTracking.userId} AND be.batch_id = ${batchId})`
                : sql`AND EXISTS (SELECT 1 FROM main.zuvy_batch_enrollments AS be WHERE be.user_id = ${zuvyChapterTracking.userId})`
            }
            ${
              searchStudent
                ? sql`AND EXISTS (SELECT 1 FROM main.users AS u WHERE u.id = ${zuvyChapterTracking.userId} AND (u.name ILIKE ${searchStudent + '%'} OR u.email ILIKE ${searchStudent + '%'}))`
                : sql``
            }
          `);

        const totalStudentsCount = totalStudentsRes[0]?.count ?? 0;
        // Normalize pagination inputs: treat non-positive/invalid limits as undefined
        const safeLimit =
          Number.isFinite(Number(limit)) && Number(limit) > 0
            ? Number(limit)
            : undefined;
        const safeOffset =
          Number.isFinite(Number(offset)) && Number(offset) >= 0
            ? Number(offset)
            : 0;
        const totalPages = safeLimit
          ? Math.ceil(totalStudentsCount / safeLimit)
          : 1;
        const deadlineDate = new Date(
          chapterDeadline[0].completionDate,
        ).getTime();

        // Process the result data with filtering out entries without a valid user
        const data = statusOfStudentCode
          .filter((statusCode) => statusCode['user'])
          .map((statusCode) => {
            const studentAssignmentStatus = statusCode;
            let isLate = false;

            if (
              studentAssignmentStatus &&
              studentAssignmentStatus['completedAt']
            ) {
              const createdAtDate = new Date(
                studentAssignmentStatus['completedAt'],
              ).getTime();
              if (createdAtDate > deadlineDate) {
                isLate = true;
              }
            }

            // Expose submitted_date so we can sort by it on the JS side if requested
            const submittedDate =
              statusCode['submitted_date'] ?? statusCode['completedAt'] ?? null;

            // Return properties without null or unknown
            return {
              id: Number(statusCode['user']['id']),
              name: statusCode['user']['name'],
              emailId: statusCode['user']['email'],
              status: isLate ? 'Late Submission' : 'On Time',
              bootcampId:
                statusCode['user'].studentAssignmentStatus?.bootcampId,
              submitted_date: submittedDate,
            };
          });

        // Sort in JS to support ordering by related user fields (name/email) as well as submittedDate
        let sortedData = data;
        if (orderBy) {
          const dir =
            orderDirection && orderDirection.toString().toLowerCase() === 'desc'
              ? -1
              : 1;
          if (orderBy === 'name') {
            sortedData = sortedData.sort((a: any, b: any) => {
              const an = (a.name || '').toString();
              const bn = (b.name || '').toString();
              return an.localeCompare(bn) * dir;
            });
          } else if (orderBy === 'email') {
            sortedData = sortedData.sort((a: any, b: any) => {
              const ae = (a.emailId || '').toString();
              const be = (b.emailId || '').toString();
              return ae.localeCompare(be) * dir;
            });
          } else if (orderBy === 'submittedDate') {
            sortedData = sortedData.sort((a: any, b: any) => {
              const at = a.submitted_date
                ? new Date(a.submitted_date).getTime()
                : 0;
              const bt = b.submitted_date
                ? new Date(b.submitted_date).getTime()
                : 0;
              return (at - bt) * dir;
            });
          }
        }

        // Apply pagination in JS after sorting so ordering by name/email works correctly
        const paginatedData =
          typeof safeLimit === 'number'
            ? sortedData.slice(safeOffset, safeOffset + safeLimit)
            : sortedData;

        // Calculate the current page based on limit and offset
        const currentPage =
          typeof safeLimit === 'number'
            ? Math.floor(safeOffset / safeLimit) + 1
            : 1;

        // Return the response with student data
        return [
          null,
          {
            message: 'Assignment Status of the students has been fetched',
            statusCode: STATUS_CODES.OK,
            data: {
              data: paginatedData,
              chapterId: chapterDeadline[0].id,
              chapterName: chapterDeadline[0].title,
              totalPages,
              totalStudentsCount,
              currentPage,
            },
          },
        ];
      } else {
        return [
          null,
          { message: 'NO CONTENT FOUND', statusCode: STATUS_CODES.OK },
        ];
      }
    } catch (error) {
      return [
        { message: error.message, statusCode: STATUS_CODES.BAD_REQUEST },
        null,
      ];
    }
  }

  async getAssignmentSubmissionDetailForUser(
    chapterId: number,
    userId: number,
  ): Promise<any> {
    try {
      const assignmentDetails = await db.query.zuvyModuleChapter.findFirst({
        where: (moduleChapter, { eq }) => eq(moduleChapter.id, chapterId),
        columns: {
          id: true,
          topicId: true,
          title: true,
          articleContent: true,
          completionDate: true,
        },
        with: {
          chapterTrackingDetails: {
            columns: {
              completedAt: true,
            },
            where: (chapterTracking, { eq }) =>
              eq(chapterTracking.userId, BigInt(userId)),
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true,
                },
                with: {
                  studentAssignmentStatus: {
                    columns: {
                      projectUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      let isSubmittedOnTime = true;
      if (
        new Date(assignmentDetails['completionDate']).getTime() <
        new Date(
          assignmentDetails['chapterTrackingDetails'][0]['completedAt'],
        ).getTime()
      ) {
        isSubmittedOnTime = false;
      }
      assignmentDetails['chapterTrackingDetails'][0]['user']['id'] = Number(
        assignmentDetails['chapterTrackingDetails'][0]['user']['id'],
      );
      assignmentDetails['chapterTrackingDetails'][0]['status'] =
        isSubmittedOnTime == true ? 'Submitted on time' : 'Submitted late';
      return [
        null,
        {
          message: 'Assignment submission detail of the user has been fetched',
          statusCode: STATUS_CODES.OK,
          data: assignmentDetails,
        },
      ];
    } catch (error) {
      return [
        { message: error.message, statusCode: STATUS_CODES.BAD_REQUEST },
        null,
      ];
    }
  }

  async submitProperting(
    assessmentSubmissionId,
    propertingPutBody: any,
  ): Promise<any> {
    try {
      let updatedSubmissionAssessment = await db
        .update(zuvyAssessmentSubmission)
        .set(propertingPutBody)
        .where(eq(zuvyAssessmentSubmission.id, assessmentSubmissionId))
        .returning({
          eyeMomentCount: zuvyAssessmentSubmission.eyeMomentCount,
          fullScreenExit: zuvyAssessmentSubmission.fullScreenExit,
          copyPaste: zuvyAssessmentSubmission.copyPaste,
          tabChange: zuvyAssessmentSubmission.tabChange,
        });
      if (updatedSubmissionAssessment.length == 0) {
        return [
          null,
          {
            message: 'Assessment properting not found',
            statusCode: STATUS_CODES.NOT_FOUND,
            data: {},
          },
        ];
      }
      return [
        null,
        {
          message: 'Assignment properting data updated',
          statusCode: STATUS_CODES.OK,
          data: updatedSubmissionAssessment[0],
        },
      ];
    } catch (error) {
      return [
        { message: error.message, statusCode: STATUS_CODES.BAD_REQUEST },
        null,
      ];
    }
  }

  async deactivateAssessmentSubmission(
    assessmentSubmissionId: number,
  ): Promise<any> {
    try {
      // First, check if the assessment submission exists
      const submission = await db.query.zuvyAssessmentSubmission.findFirst({
        where: (zuvyAssessmentSubmission, { eq }) =>
          eq(zuvyAssessmentSubmission.id, assessmentSubmissionId),
      });

      if (!submission) {
        return [
          {
            status: 'error',
            statusCode: 404,
            message: 'Assessment submission not found',
          },
        ];
      }

      // Update the active attribute to false instead of deleting
      let updateActiveData: any = { active: false };
      const updated = await db
        .update(zuvyAssessmentSubmission)
        .set(updateActiveData)
        .where(eq(zuvyAssessmentSubmission.id, assessmentSubmissionId))
        .returning();

      if (!updated || updated.length === 0) {
        return [
          {
            status: 'error',
            statusCode: 500,
            message: 'Failed to deactivate assessment submission',
          },
        ];
      }

      return [
        null,
        {
          status: 'success',
          statusCode: 200,
          message: 'Assessment submission deactivated successfully',
        },
      ];
    } catch (err) {
      return [
        {
          status: 'error',
          statusCode: 500,
          message: err.message,
        },
      ];
    }
  }

  async recalcAndFixMCQForAssessment(
    assessmentOutsourseId: number,
  ): Promise<any> {
    try {
      function ceilToOneDecimal(num: number) {
        return Math.ceil(num * 100) / 100;
      }

      const submissions = await db
        .select({
          id: zuvyAssessmentSubmission.id,
          userId: zuvyAssessmentSubmission.userId,
          codingScore: zuvyAssessmentSubmission.codingScore,
          mcqScore: zuvyAssessmentSubmission.mcqScore,
          marks: zuvyAssessmentSubmission.marks,
          percentage: zuvyAssessmentSubmission.percentage,
          isPassed: zuvyAssessmentSubmission.isPassed,
        })
        .from(zuvyAssessmentSubmission)
        .where(
          eq(
            zuvyAssessmentSubmission.assessmentOutsourseId,
            assessmentOutsourseId,
          ),
        );

      if (submissions.length === 0) {
        return [
          null,
          {
            statusCode: 202,
            message: 'assessmet submission not found',
          },
        ];
      }
      const assessmentMeta = await db
        .select({
          easy: zuvyOutsourseAssessments.easyMcqMark,
          medium: zuvyOutsourseAssessments.mediumMcqMark,
          hard: zuvyOutsourseAssessments.hardMcqMark,
          pass: zuvyOutsourseAssessments.passPercentage,
        })
        .from(zuvyOutsourseAssessments)
        .where(eq(zuvyOutsourseAssessments.id, assessmentOutsourseId))
        .then((r) => r[0]!);

      if (!assessmentMeta) {
        return [
          null,
          {
            statusCode: 202,
            message: 'assessment not found',
          },
        ];
      }
      let mcqMarks: any = {
        [DIFFICULTY.EASY]: assessmentMeta.easy || 0,
        [DIFFICULTY.MEDIUM]: assessmentMeta.medium || 0,
        [DIFFICULTY.HARD]: assessmentMeta.hard || 0,
      };

      const updatedUserIds: number[] = [];
      let correctOptions = {
        119: [1, 3, 4],
        132: [1, 3],
      };
      for (const sub of submissions) {
        try {
          const quizAnswers = await db
            .select({
              id: zuvyQuizTracking.id,
              variantId: zuvyQuizTracking.variantId,
              chosenOption: zuvyQuizTracking.chosenOption,
            })
            .from(zuvyQuizTracking)
            .where(eq(zuvyQuizTracking.assessmentSubmissionId, sub.id));

          const variantIds = quizAnswers.map((q) => q.variantId);
          const quizMasterData = await db.query.zuvyModuleQuizVariants.findMany(
            {
              where: (zuvyModuleQuizVariants, { sql }) =>
                sql`${zuvyModuleQuizVariants.id} in ${variantIds}`,
              with: {
                quiz: {
                  columns: {
                    difficulty: true,
                  },
                },
              },
            },
          );

          let mcqScore = 0;
          let requiredMCQScore = 0;
          const attemptedMCQs = quizAnswers.length;

          for (const answer of quizAnswers) {
            const matched: any = quizMasterData.find(
              (v) => v.id === answer.variantId,
            );
            if (!matched) continue;

            const difficulty = matched.quiz.difficulty;
            const weight = mcqMarks[difficulty] || 0;
            requiredMCQScore += weight;
            let isCorrect: boolean;
            if (!correctOptions[matched.id]) {
              isCorrect = answer.chosenOption === matched.correctOption;
            } else {
              let Correct_options = correctOptions[matched.id];
              isCorrect = Correct_options?.includes(answer.chosenOption)
                ? true
                : false;
            }
            if (isCorrect) mcqScore += weight;
            // Update quiz tracking status
            await db
              .update(zuvyQuizTracking)
              .set({ status: isCorrect ? 'passed' : 'failed' })
              .where(eq(zuvyQuizTracking.id, answer.id));
          }

          const safeCodingScore = Number(sub.codingScore) || 0;
          let newMarks = safeCodingScore + mcqScore;
          const totalPossible = safeCodingScore + requiredMCQScore;
          let percentage =
            totalPossible > 0
              ? parseFloat(((newMarks / totalPossible) * 100).toFixed(2))
              : 0;
          const isPassed = percentage >= (Number(assessmentMeta.pass) || 0);

          const hasChanged =
            mcqScore !== sub.mcqScore ||
            newMarks !== sub.marks ||
            percentage !== sub.percentage ||
            isPassed !== sub.isPassed;

          if (hasChanged) {
            const updatedSubmission: any = {
              mcqScore,
              marks: newMarks,
              percentage,
              isPassed,
            };
            await db
              .update(zuvyAssessmentSubmission)
              .set(updatedSubmission)
              .where(eq(zuvyAssessmentSubmission.id, sub.id));
            this.logger.log(
              `Updated submission ${sub.id} with new marks: ${newMarks}, percentage: ${percentage}, isPassed: ${isPassed} for userId: ${sub.userId}`,
            );
            updatedUserIds.push(sub.userId);

            // ✉️ Send email after update
            await this.sendScoreUpdateEmailToStudent(sub.userId, percentage);
          }
        } catch (err) {
          console.error(`❌ Error in submission ${sub.id}:`, err);
        }
      }

      this.logger.log(
        `✅ MCQ recalculation + emails complete. Updated user ids:', ${JSON.stringify(updatedUserIds)}`,
      );
      return [null, updatedUserIds];
    } catch (err) {
      console.error('❌ Fatal error during MCQ recalculation:', err);
      return [
        {
          status: 'error',
          statusCode: 500,
          message: 'Fatal error recalculating MCQ',
        },
      ];
    }
  }

  async sendScoreUpdateEmailToStudent(userId: any, updatedScore: number) {
    AWS.config.update({
      accessKeyId: AWS_SUPPORT_ACCESS_KEY_ID,
      secretAccessKey: AWS_SUPPORT_ACCESS_SECRET_KEY,
      region: 'ap-south-1',
    });

    const ses = new AWS.SES();

    const user = await db.query.users.findFirst({
      where: (zuvyUser, { eq }) => eq(zuvyUser.id, userId),
    });

    if (!user) {
      console.warn(`⚠️ User not found for ID ${userId}`);
      return;
    }

    const emailText = `
Dear ${user.name || 'Student'},

We would like to inform you that your score for the Final Assessment held on 3rd–4th May has been updated.

Due to a discrepancy in a few multiple-choice questions where incorrect options were initially marked as correct, some students' scores were affected. This issue has now been resolved, and your score has been recalculated based on the option you originally selected.

Your updated score is: ${updatedScore}%

We sincerely apologize for the inconvenience caused.

You can view your latest score by logging into your Zuvy LMS account—this has been reflected in the system.

Thank you for your understanding.

Best regards,  
Zuvy LMS Team
`;

    const emailParams = {
      Source: SUPPORT_EMAIL,
      Destination: {
        ToAddresses: [user.email],
      },
      Message: {
        Subject: { Data: 'Updated Score for Final Assessment – 3rd–4th May' },
        Body: {
          Text: { Data: emailText },
        },
      },
    };

    try {
      const result = await ses.sendEmail(emailParams).promise();
    } catch (err) {
      console.error(` Failed to send email to ${user.email}`, err);
    }
  }

  async getLiveChapterSubmissions(
    roleName,
    bootcampId: number,
    searchTerm?: string,
    limit?: number,
    offset?: number,
    orderBy?: 'title',
    orderDirection?: 'asc' | 'desc',
  ): Promise<[any, any]> {
    try {
      // Validate ordering inputs
      if ((orderBy && !orderDirection) || (!orderBy && orderDirection)) {
        return [
          {
            message: 'Both orderBy and orderDirection are required together',
            statusCode: STATUS_CODES.BAD_REQUEST,
          },
          null,
        ];
      }

      // ORDER BY chapter title only
      let chapterOrderClause = (moduleChapter: any, helpers: any) =>
        helpers.asc(moduleChapter.title);

      if (orderBy === 'title') {
        chapterOrderClause = (moduleChapter: any, helpers: any) => {
          const dir = orderDirection === 'desc' ? helpers.desc : helpers.asc;
          return dir(moduleChapter.title);
        };
      }

      // Query modules mapped to bootcampId
      const topicId = 8; // or as per your schema for chapters
      const trackingData = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq, and }) =>
          and(eq(courseModules.bootcampId, bootcampId)),

        orderBy: (courseModules, { asc }) => asc(courseModules.order),

        with: {
          moduleChapterData: {
            columns: {
              id: true,
              title: true,
            },

            orderBy: chapterOrderClause,

            where: (moduleChapter: any, { eq, and, ilike, sql }: any) =>
              and(
                eq(moduleChapter.topicId, topicId),
                searchTerm
                  ? sql`
                (
                  ${ilike(moduleChapter.title, `%${searchTerm}%`)}
                  OR EXISTS (
                    SELECT 1
                    FROM main.zuvy_chapter_tracking AS ct
                    JOIN main.users AS u ON u.id = ct.user_id
                    WHERE ct.chapter_id = ${moduleChapter.id}
                      AND (u.name ILIKE ${searchTerm + '%'}
                        OR u.email ILIKE ${searchTerm + '%'})
                  )
                )
              `
                  : sql`TRUE`,
              ),

            with: {
              chapterTrackingDetails: {
                columns: {
                  userId: true,
                  completedAt: true,
                },
                with: {
                  user: {
                    columns: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                  studentChapterDetails: {
                    columns: {
                      batchId: true,
                      bootcampId: true,
                    },
                    with: {
                      batchInfo: {
                        columns: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        limit,
        offset,
      });
      // Get total students for bootcamp
      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`,
        );
      // Add submitStudents field and expose submissions for each chapter
      trackingData.forEach((course: any) => {
        course.moduleChapterData.forEach((chapterTracking: any) => {
          const details = Array.isArray(
            chapterTracking['chapterTrackingDetails'],
          )
            ? chapterTracking['chapterTrackingDetails']
            : [];
          chapterTracking['submitStudents'] = details.length;
          chapterTracking['submissions'] = details.map((d: any) => ({
            userId: d.userId ?? d.user?.id,
            name: d.user?.name ?? null,
            email: d.user?.email ?? null,
            batchId: d.studentChapterDetails?.batchInfo?.id ?? null,
            batchName: d.studentChapterDetails?.batchInfo?.name ?? null,
            completedAt: d.completedAt ?? null,
          }));
        });
      });
      const totalStudents = zuvyBatchEnrollmentsCount[0]?.count || 0;
      // Filter out modules with no chapters
      const filteredTrackingData = trackingData.filter(
        (course: any) => course.moduleChapterData.length > 0,
      );
      const targetPermissions = [
        ResourceList.submission.read,
        ResourceList.submission.download,
        ResourceList.submission.re_attempt,
      ];
      const grantedPermissions = await this.rbacService.getAllPermissions(
        roleName,
        targetPermissions,
      );
      return [
        null,
        {
          trackingData: filteredTrackingData,
          totalStudents,
          ...grantedPermissions,
        },
      ];
    } catch (err) {
      return [err, null];
    }
  }

  async getLiveChapterStudentSubmission(
    moduleChapterId: number,
    limit?: number,
    offset?: number,
    name?: string,
    email?: string,
    status?: 'present' | 'absent',
    orderBy?: 'name' | 'email' | 'status',
    orderDirection?: 'asc' | 'desc',
  ): Promise<[any, any]> {
    try {
      const submissions = await db.query.zuvySessions.findMany({
        where: (session, { eq }) => eq(session.chapterId, moduleChapterId),
        columns: {
          id: true,
          meetingId: true,
          hangoutLink: true,
          creator: true,
          startTime: true,
          endTime: true,
          batchId: true,
          secondBatchId: true,
          bootcampId: true,
          moduleId: true,
          chapterId: true,
          title: true,
          s3link: true,
        },
        with: {
          studentAttendanceRecords: {
            where: (record: { userId: any; status: any }) =>
              and(
                // Only attendance where the user has a completed chapter_tracking for this chapter
                inArray(
                  record.userId,
                  db
                    .select({ userId: zuvyChapterTracking.userId })
                    .from(zuvyChapterTracking)
                    .where(
                      and(
                        eq(zuvyChapterTracking.chapterId, moduleChapterId),
                        isNotNull(zuvyChapterTracking.completedAt),
                      ),
                    ),
                ),

                // Optional user filter by name/email (if provided)
                name || email
                  ? inArray(
                      record.userId,
                      db
                        .select({ id: users.id })
                        .from(users)
                        .where(
                          or(
                            name ? ilike(users.name, `${name}%`) : undefined,
                            email ? ilike(users.email, `${email}%`) : undefined,
                          ),
                        ),
                    )
                  : undefined,

                // Optional status filter
                status ? eq(record.status, status) : undefined,
              ),

            columns: {
              userId: true,
              status: true,
              duration: true,
            },

            with: {
              user: {
                columns: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // Process and sort data in JavaScript
      let allRecords: any[] = [];
      submissions.forEach((session: any) => {
        if (
          session.studentAttendanceRecords &&
          session.studentAttendanceRecords.length > 0
        ) {
          session.studentAttendanceRecords.forEach((record: any) => {
            allRecords.push({
              ...record,
              sessionId: session.id,
              sessionTitle: session.title,
              meetingId: session.meetingId,
              hangoutLink: session.hangoutLink,
            });
          });
        }
      });

      // Sort if orderBy is provided
      if (orderBy) {
        const dir =
          orderDirection && orderDirection.toLowerCase() === 'desc' ? -1 : 1;

        if (orderBy === 'name') {
          allRecords.sort((a: any, b: any) => {
            const an = (a.user?.name || '').toString();
            const bn = (b.user?.name || '').toString();
            return an.localeCompare(bn) * dir;
          });
        } else if (orderBy === 'email') {
          allRecords.sort((a: any, b: any) => {
            const ae = (a.user?.email || '').toString();
            const be = (b.user?.email || '').toString();
            return ae.localeCompare(be) * dir;
          });
        } else if (orderBy === 'status') {
          allRecords.sort((a: any, b: any) => {
            const as = (a.status || '').toString();
            const bs = (b.status || '').toString();
            return as.localeCompare(bs) * dir;
          });
        }
      }

      // Apply pagination
      const safeLim =
        typeof limit === 'number' && limit > 0 ? limit : undefined;
      const safeOff = typeof offset === 'number' && offset >= 0 ? offset : 0;

      let paginatedRecords = allRecords;
      if (safeLim) {
        paginatedRecords = allRecords.slice(safeOff, safeOff + safeLim);
      }

      const totalPages = safeLim ? Math.ceil(allRecords.length / safeLim) : 1;

      return [
        null,
        {
          data: paginatedRecords,
          totalCount: allRecords.length,
          totalPages,
        },
      ];
    } catch (err) {
      return [err, null];
    }
  }
}
