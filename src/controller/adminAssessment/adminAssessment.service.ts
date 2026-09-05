const AWS = require('aws-sdk');
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { db } from '../../db/index';
import {
  count,
  max,
  eq,
  inArray,
  SQL,
  sql,
  desc,
  and,
  isNotNull,
  isNull,
  exists,
  ilike,
  or,
  asc,
} from 'drizzle-orm';
import * as _ from 'lodash';
import {
  zuvyBatchEnrollments,
  zuvyChapterTracking,
  zuvyAssessmentReattempt,
  zuvyModuleChapter,
  zuvyOutsourseAssessments,
  zuvyAssessmentSubmission,
  users,
  zuvyModuleQuizVariants,
  zuvyModuleQuiz,
  zuvyOpenEndedQuestions,
  zuvyCodingQuestions,
  zuvyModuleAssessment,
  zuvyOutsourseQuizzes,
  zuvyOutsourseOpenEndedQuestions,
  zuvyOutsourseCodingQuestions,
  zuvyTags,
  zuvyBatches,
  zuvyLearnersCompleteProfile,
  zuvyBootcamps,
  zuvyMentorSlotBooking,
} from '../../../drizzle/schema';
import { STATUS_CODES } from 'src/helpers';
import { helperVariable } from 'src/constants/helper';
import { ResourceList } from 'src/rbac/utility';
import { RbacService } from 'src/rbac/rbac.service';

const { PENDING, ACCEPTED, REJECTED } = helperVariable.REATTMEPT_STATUS; // Importing helper variables
const {
  SUPPORT_EMAIL,
  AWS_SUPPORT_ACCESS_SECRET_KEY,
  AWS_SUPPORT_ACCESS_KEY_ID,
  ZUVY_BASH_URL,
} = process.env; // Importing env values

@Injectable()
export class AdminAssessmentService {
  constructor(private readonly rbacService: RbacService) {}
  private logger = new Logger(AdminAssessmentService.name);

  // Generate email content dynamically for student notification
  private async generateStudentEmailContent(
    user: any,
    submission: any,
  ): Promise<string> {
    const assessmentDeepLink = `${ZUVY_BASH_URL}/student/course/${submission.bootcampId}/modules/${submission.moduleId}?chapterId=${submission.chapterId}`;

    // Format duration to display hours if applicable
    let durationText = 'N/A';
    if (submission.timeLimit) {
      // Convert seconds to minutes first
      const timeLimitInMinutes = Math.floor(
        parseInt(submission.timeLimit) / 60,
      );

      if (timeLimitInMinutes >= 60) {
        const hours = Math.floor(timeLimitInMinutes / 60);
        const minutes = timeLimitInMinutes % 60;
        durationText = `${hours} hour${hours > 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} minute${minutes > 1 ? 's' : ''}` : ''}`;
      } else {
        durationText = `${timeLimitInMinutes} minute${timeLimitInMinutes > 1 ? 's' : ''}`;
      }
    }

    return `
Hello ${user.name},

Good news! Your request to retake the assessment "${submission.title || 'N/A'}" has been approved.
When you're ready, click the button below. It will take you straight to the test: 
[Start Assessment]: ${assessmentDeepLink}

Test Duration: ${durationText}
Total Marks: 100

Tips for a smooth attempt
1. Use a stable internet connection.
2. Keep your browser tab open until you submit.

All the best!
Team Zuvy`;
  }

  // reject of the student reattempt request mail
  private async generateRejectEmailContent(
    user: any,
    submission: any,
  ): Promise<string> {
    return `
      Hello ${user.name},

      Your request for re-attempt of the assessment "${submission.title || 'N/A'}" has been rejected.

      If you have any questions, please contact support.

      Regards,
      The Team Zuvy
    `;
  }

  // Method to approve re-attempt by admin
  async approveReattempt(assessmentSubmissionId: number): Promise<any> {
    try {
      // Check if submission exists
      const submission: any = await db.query.zuvyAssessmentSubmission.findFirst(
        {
          where: (zuvyAssessmentSubmission, { eq }) =>
            eq(zuvyAssessmentSubmission.id, assessmentSubmissionId),
          with: {
            reattempt: {
              where: (reattempt, { eq }) => eq(reattempt.status, PENDING),
              columns: {
                id: true,
                status: true,
              },
            },
            user: {
              columns: {
                name: true,
                email: true,
              },
            },
            submitedOutsourseAssessment: {
              columns: {
                id: true,
                bootcampId: true,
                moduleId: true,
                chapterId: true,
                timeLimit: true,
                marks: true,
              },
              with: {
                ModuleAssessment: {
                  columns: {
                    id: true,
                    title: true,
                    description: true,
                    marks: true,
                  },
                },
              },
            },
          },
        },
      );

      if (!submission) {
        return [
          {
            status: 'error',
            statusCode: 404,
            message: 'Assessment submission not found',
          },
        ];
      }
      if (submission.reattempt.length === 0) {
        return [
          {
            status: 'error',
            statusCode: 400,
            message: 'Re-attempt request already processed',
          },
        ];
      }

      let reattemptId = submission.reattempt[0].id;
      let ModuleAssessment =
        submission.submitedOutsourseAssessment.ModuleAssessment;
      let outsourseAssessment = submission.submitedOutsourseAssessment;
      delete submission.submitedOutsourseAssessment;

      let updatingAssessment: any = {
        reattemptApproved: true,
        active: false,
      };
      // Update submission to mark reattempt approved and reset submission status
      await db
        .update(zuvyAssessmentSubmission)
        .set(updatingAssessment)
        .where(eq(zuvyAssessmentSubmission.id, assessmentSubmissionId))
        .returning();
      await db
        .update(zuvyAssessmentReattempt)
        .set({ status: ACCEPTED })
        .where(eq(zuvyAssessmentReattempt.id, reattemptId))
        .returning();

      // Send email to student notifying approval
      let [errorSendEmail, emailSent] = await this.sendEmailToStudent({
        ...submission,
        ...ModuleAssessment,
        ...outsourseAssessment,
      });
      if (errorSendEmail) {
        this.logger.error(
          `error in sending email to student: ${errorSendEmail}`,
        );
        return [
          {
            status: 'success',
            statusCode: 200,
            message: 'Re-attempt approved and Not able to notified',
          },
        ];
      }
      return [
        null,
        {
          status: 'success',
          statusCode: 200,
          message: 'Re-attempt approved and student notified',
        },
      ];
    } catch (error) {
      this.logger.error('Error in approveReattempt', error);
      return [
        {
          status: 'error',
          statusCode: 500,
          message: 'Internal server error',
        },
      ];
    }
  }

  // Helper method to send email to student using AWS SES
  private async sendEmailToStudent(submission: any): Promise<any> {
    try {
      AWS.config.update({
        accessKeyId: AWS_SUPPORT_ACCESS_KEY_ID, // Replace with your access key ID
        secretAccessKey: AWS_SUPPORT_ACCESS_SECRET_KEY, // Replace with your secret access key
        region: 'ap-south-1', // Replace with your AWS SES region, e.g., 'us-east-1'
      });
      // Fetch student email and name
      let ses = new AWS.SES();

      const user = await db.query.users.findFirst({
        where: (zuvyUser, { eq }) => eq(zuvyUser.id, submission.userId),
      });

      if (!user) {
        this.logger.warn(
          `User with id ${submission.userId} not found for sending approval email`,
        );
        return;
      }

      const emailContent = await this.generateStudentEmailContent(
        user,
        submission,
      );

      const emailParams = {
        Source: SUPPORT_EMAIL,
        Destination: {
          ToAddresses: [user.email],
        },
        Message: {
          Subject: {
            Data: 'Re-attempt Approved for Assessment Submission',
          },
          Body: {
            Text: {
              Data: emailContent,
            },
          },
        },
      };

      const result = await ses.sendEmail(emailParams).promise();
      this.logger.log(
        `Email sent to student ${user.email} for re-attempt approval: ` +
          JSON.stringify(result),
      );
      return [null, result];
    } catch (error) {
      this.logger.error('Failed to send email to student', error);
      return [{ message: error, Error: true }];
    }
  }

  async rejectReattempt(assessmentSubmissionId: number): Promise<any> {
    try {
      // Check if submission exists
      const submission: any = await db.query.zuvyAssessmentSubmission.findFirst(
        {
          where: (zuvyAssessmentSubmission, { eq }) =>
            eq(zuvyAssessmentSubmission.id, assessmentSubmissionId),
          with: {
            reattempt: {
              where: (reattempt, { eq }) => eq(reattempt.status, PENDING),
              columns: {
                id: true,
                status: true,
              },
            },
            user: {
              columns: {
                name: true,
                email: true,
              },
            },
            submitedOutsourseAssessment: {
              columns: {
                id: true,
                bootcampId: true,
                moduleId: true,
                chapterId: true,
                timeLimit: true,
                marks: true,
              },
              with: {
                ModuleAssessment: {
                  columns: {
                    id: true,
                    title: true,
                    description: true,
                    marks: true,
                  },
                },
              },
            },
          },
        },
      );

      if (!submission) {
        return [
          {
            status: 'error',
            statusCode: 404,
            message: 'Assessment submission not found',
          },
        ];
      }
      if (submission.reattempt.length === 0) {
        return [
          {
            status: 'error',
            statusCode: 400,
            message: 'Re-attempt request already processed',
          },
        ];
      }
      let reattemptId = submission.reattempt[0].id;
      let ModuleAssessment =
        submission.submitedOutsourseAssessment.ModuleAssessment;
      let user = submission.user;
      let outsourseAssessment = submission.submitedOutsourseAssessment;
      delete submission.submitedOutsourseAssessment;

      let updatingAssessment: any = {
        reattemptApproved: false,
        active: true,
      };
      // Update submission to mark reattempt approved and reset submission status
      let red = await db
        .update(zuvyAssessmentSubmission)
        .set(updatingAssessment)
        .where(eq(zuvyAssessmentSubmission.id, assessmentSubmissionId))
        .returning();
      let green = await db
        .update(zuvyAssessmentReattempt)
        .set({ status: REJECTED })
        .where(eq(zuvyAssessmentReattempt.id, reattemptId))
        .returning();
      // Send email to student notifying approval
      let [errorSendEmail, emailSent] = await this.sendRejectEmailToStudent({
        ...submission,
        ...ModuleAssessment,
        ...outsourseAssessment,
      });
      if (errorSendEmail) {
        return [
          {
            status: 'error',
            statusCode: 500,
            message: errorSendEmail,
          },
        ];
      }

      return [
        null,
        {
          status: 'success',
          statusCode: 200,
          message: 'Re-attempt rejected and student notified',
        },
      ];
    } catch (error) {
      this.logger.error('Error in rejectReattempt', error);
      return [
        {
          status: 'error',
          statusCode: 500,
          message: 'Internal server error',
        },
      ];
    }
  }

  async sendRejectEmailToStudent(submission: any): Promise<any> {
    try {
      // Fetch student email and name
      let ses = new AWS.SES();

      AWS.config.update({
        accessKeyId: AWS_SUPPORT_ACCESS_KEY_ID, // Replace with your access key ID
        secretAccessKey: AWS_SUPPORT_ACCESS_SECRET_KEY, // Replace with your secret access key
        region: 'ap-south-1', // Replace with your AWS SES region, e.g., 'us-east-1'
      });

      const user = await db.query.users.findFirst({
        where: (zuvyUser, { eq }) => eq(zuvyUser.id, submission.userId),
      });

      if (!user) {
        this.logger.warn(
          `User with id ${submission.userId} not found for sending approval email`,
        );
        return;
      }

      const emailContent = await this.generateRejectEmailContent(
        user,
        submission,
      );

      const emailParams = {
        Source: SUPPORT_EMAIL,
        Destination: {
          ToAddresses: [user.email],
        },
        Message: {
          Subject: {
            Data: 'Re-attempt Approved for Assessment Submission',
          },
          Body: {
            Text: {
              Data: emailContent,
            },
          },
        },
      };

      const result = await ses.sendEmail(emailParams).promise();
      this.logger.log(
        `Email sent to student ${user.email} for re-attempt approval: ` +
          JSON.stringify(result),
      );
      return [null, result];
    } catch (error) {
      this.logger.error('Failed to send email to student', error);
      return [{ message: error, Error: true }];
    }
  }

  async transformAssessments(assessments) {
    const result = {};
    const stateDescriptions = {
      0: 'DRAFT',
      1: 'PUBLISHED',
      2: 'ACTIVE',
      3: 'CLOSED',
    };

    assessments.forEach((assessment) => {
      const moduleName = assessment.Module?.name;
      const {
        Module,
        ModuleAssessment,
        CodingQuestions,
        OpenEndedQuestions,
        Quizzes,
        submitedOutsourseAssessments,
        ...assessmentInfo
      } = assessment;
      let qualifiedStudents = 0;
      submitedOutsourseAssessments.map((student) => {
        if (student.isPassed) {
          qualifiedStudents += 1;
        }
      });
      if (!result[moduleName]) {
        result[moduleName] = [
          {
            ...assessmentInfo,
            ...ModuleAssessment,
            publishDatetime: assessment.publishDatetime,
            startDatetime: assessment.startDatetime,
            endDatetime: assessment.endDatetime,
            assessmentState: stateDescriptions[assessment.currentState] || null,
            totalSubmitedAssessments: submitedOutsourseAssessments.length,
            qualifiedStudents,
          },
        ];
      } else {
        result[moduleName].push({
          ...assessmentInfo,
          ...ModuleAssessment,
          publishDatetime: assessment.publishDatetime,
          startDatetime: assessment.startDatetime,
          endDatetime: assessment.endDatetime,
          assessmentState: stateDescriptions[assessment.currentState] || null,
          totalSubmitedAssessments: submitedOutsourseAssessments.length,
          qualifiedStudents,
        });
      }
    });
    return result;
  }

  async getTotalStudentsEnrolled(bootcampID) {
    let studentsEnrolled = await db
      .select()
      .from(zuvyBatchEnrollments)
      .where(
        and(
          eq(zuvyBatchEnrollments.bootcampId, bootcampID),
          isNotNull(zuvyBatchEnrollments.batchId),
        ),
      );
    return studentsEnrolled;
  }

  async getBootcampAssessment(
    roleName,
    bootcampID: number,
    searchAssessment: string,
    orderBy: 'title',
    orderDirection: 'asc' | 'desc',
    orgId?: number,
  ) {
    try {
      // ⭐ ERROR HANDLING BLOCK
      if (orderBy && !orderDirection) {
        throw new BadRequestException(
          'orderDirection is required when orderBy is provided',
        );
      }

      if (!orderBy && orderDirection) {
        throw new BadRequestException(
          'orderBy is required when orderDirection is provided',
        );
      }

      if (orderBy && orderBy !== 'title') {
        throw new BadRequestException('Invalid orderBy value. Allowed: title');
      }

      if (orderDirection && !['asc', 'desc'].includes(orderDirection)) {
        throw new BadRequestException(
          'Invalid orderDirection. Allowed: asc, desc',
        );
      }

      // DEFAULT VALUES
      orderBy = orderBy ?? 'title';
      orderDirection = orderDirection ?? 'asc';

      // ⭐ MAIN QUERY
      const assessment = await db.query.zuvyOutsourseAssessments.findMany({
        where: (z, { eq, and, sql }) => {
          const conditions = [eq(z.bootcampId, bootcampID)];

          if (searchAssessment) {
            conditions.push(
              exists(
                db
                  .select({ _: zuvyModuleAssessment.id })
                  .from(zuvyModuleAssessment)
                  .where(
                    and(
                      eq(zuvyModuleAssessment.id, z.id),
                      ilike(zuvyModuleAssessment.title, searchAssessment + '%'),
                    ),
                  ),
              ),
            );
          }

          return and(...conditions);
        },

        // ⭐ SORTING BLOCK
        orderBy: (z) => {
          const titleColumn = sql`(
            SELECT title
            FROM ${zuvyModuleAssessment}
            WHERE id = ${z.id}
          )`;

          return orderDirection === 'desc'
            ? sql`${titleColumn} DESC`
            : sql`${titleColumn} ASC`;
        },

        columns: {
          id: true,
          order: true,
          totalCodingQuestions: true,
          totalMcqQuestions: true,
          publishDatetime: true,
          startDatetime: true,
          endDatetime: true,
          currentState: true,
        },
        extras: (z) => ({
          hasReattemptRequest: exists(
            db
              .select({ _: zuvyAssessmentSubmission.id })
              .from(zuvyAssessmentSubmission)
              .innerJoin(
                zuvyAssessmentReattempt,
                eq(
                  zuvyAssessmentSubmission.id,
                  zuvyAssessmentReattempt.assessmentSubmissionId,
                ),
              )
              .where(eq(zuvyAssessmentSubmission.assessmentOutsourseId, z.id)),
          ).as('hasReattemptRequest'),
        }),

        with: {
          ModuleAssessment: {
            columns: { title: true, description: true },
          },
          Module: {
            columns: {
              name: true,
              description: true,
              timeAlloted: true,
              order: true,
            },
          },
          Quizzes: true,
          OpenEndedQuestions: true,
          CodingQuestions: true,

          submitedOutsourseAssessments: {
            where: (sub, { and, isNotNull, eq }) =>
              and(
                isNotNull(sub.submitedAt),
                eq(sub.active, true),
                isNotNull(sub.isPassed),
                exists(
                  db
                    .select({ _: zuvyBatchEnrollments.userId })
                    .from(zuvyBatchEnrollments)
                    .where(
                      and(
                        eq(zuvyBatchEnrollments.userId, sub.userId),
                        eq(zuvyBatchEnrollments.bootcampId, bootcampID),
                        isNotNull(zuvyBatchEnrollments.batchId),
                      ),
                    ),
                ),
              ),
            orderBy: (sub, { desc }) => desc(sub.startedAt),
          },
        },
      });

      // ⭐ REMOVE DUPLICATE SUBMISSIONS
      assessment.forEach((item) => {
        const unique: any[] = [];
        const set = new Set();

        item.submitedOutsourseAssessments.forEach((s) => {
          if (!set.has(s.userId)) {
            set.add(s.userId);
            unique.push(s);
          }
        });

        item.submitedOutsourseAssessments = unique;
      });

      if (!assessment.length) return [];

      // ⭐ STUDENTS COUNT
      const studentsEnrolled = await this.getTotalStudentsEnrolled(bootcampID);

      // ⭐ TRANSFORM & PERMISSIONS
      const result = await this.transformAssessments(assessment);
      result['totalStudents'] = studentsEnrolled.length;

      const allowed = [
        ResourceList.submission.read,
        ResourceList.submission.download,
        ResourceList.submission.re_attempt,
      ];

      const perm = await this.rbacService.getAllPermissions(
        roleName,
        allowed,
        orgId,
      );
      result['permissions'] = perm.permissions;

      return result;
    } catch (error) {
      console.error('❌ ERROR in getBootcampAssessment:', error);
      throw error;
    }
  }

  async getSubmissionsListOfAssessment(
    req,
    assessmentID: number,
    searchStudent: string,
    limit?: number,
    offset: number = 0,
    batchId?: number,
    qualified?: string,
    orderBy?: string,
    orderDirection?: string,
  ) {
    try {
      // Validate batchId
      if (batchId !== undefined && batchId <= 0) {
        throw {
          statusCode: 400,
          message: 'batchId must be a positive integer',
        };
      }

      // Validate qualified parameter
      if (qualified && !['true', 'false', 'all'].includes(qualified)) {
        throw {
          statusCode: 400,
          message: 'qualified must be "true", "false", or "all"',
        };
      }

      // Validate orderBy parameter
      if (
        orderBy &&
        !['submittedDate', 'percentage', 'name', 'email'].includes(orderBy)
      ) {
        throw {
          statusCode: 400,
          message:
            'orderBy must be one of: submittedDate, percentage, name, email',
        };
      }

      // Validate orderDirection parameter
      if (orderDirection && !['asc', 'desc'].includes(orderDirection)) {
        throw {
          statusCode: 400,
          message: 'orderDirection must be either "asc" or "desc"',
        };
      }
      // Fetch assessment details
      const assessmentInfo = await db
        .select()
        .from(zuvyOutsourseAssessments)
        .where(eq(zuvyOutsourseAssessments.id, assessmentID));

      if (assessmentInfo.length === 0) {
        throw { statusCode: 404, message: 'Assessment not found' };
      }

      const bootcampId = assessmentInfo[0].bootcampId;
      // Fetch all students enrolled in the bootcamp
      const enrolledStudents = await db.query.zuvyBatchEnrollments.findMany({
        where: (tbl) => {
          const conditions: SQL[] = [
            eq(tbl.bootcampId, bootcampId),
            isNotNull(tbl.batchId),
          ];
          if (batchId && !isNaN(batchId)) {
            conditions.push(eq(tbl.batchId, batchId));
          }
          if (searchStudent) {
            conditions.push(
              exists(
                db
                  .select({ _: users.id })
                  .from(users)
                  .where(
                    and(
                      eq(users.id, tbl.userId),
                      or(
                        ilike(users.name, searchStudent + '%'),
                        ilike(users.email, searchStudent + '%'),
                      ),
                    ),
                  ),
              ),
            );
          }
          return and(...conditions);
        },
        columns: {
          userId: true,
          batchId: true,
        },
        with: {
          user: {
            columns: {
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
        orderBy: (zuvyBatchEnrollments, { asc }) =>
          asc(zuvyBatchEnrollments.userId),
      });
      let userIds = enrolledStudents.map((student) => Number(student.userId));
      // Fetch submitted assessments for the given assessmentID
      // Fetch the latest submission per user for this assessment (no DB-level limit/offset here)
      const submitedOutsourseAssessments =
        await db.query.zuvyAssessmentSubmission.findMany({
          where: (sub) => {
            const conditions: SQL[] = [
              eq(sub.assessmentOutsourseId, assessmentID),
              inArray(sub.userId, userIds),
              exists(
                db
                  .select({ _: zuvyBatchEnrollments.userId })
                  .from(zuvyBatchEnrollments)
                  .where(
                    and(
                      eq(zuvyBatchEnrollments.userId, sub.userId),
                      eq(zuvyBatchEnrollments.bootcampId, bootcampId),
                      isNotNull(zuvyBatchEnrollments.batchId),
                      ...(batchId && !isNaN(batchId)
                        ? [eq(zuvyBatchEnrollments.batchId, batchId)]
                        : []),
                    ),
                  ),
              ),
              eq(
                sub.id,
                sql`(SELECT MAX(id) FROM ${zuvyAssessmentSubmission} WHERE assessment_outsourse_id = ${assessmentID} AND user_id = ${sub.userId})`,
              ),
            ];
            if (qualified === 'true') conditions.push(eq(sub.isPassed, true));
            else if (qualified === 'false')
              conditions.push(
                or(eq(sub.isPassed, false), isNull(sub.isPassed)),
              );
            return and(...conditions);
          },
          columns: {
            id: true,
            userId: true,
            marks: true,
            startedAt: true,
            submitedAt: true,
            isPassed: true,
            percentage: true,
            active: true,
            reattemptRequested: true,
            reattemptApproved: true,
            mcqScore: true,
            codingScore: true,
            tabChange: true,
            copyPaste: true,
            typeOfsubmission: true,
          },
          with: {
            user: {
              columns: {
                name: true,
                email: true,
              },
            },
          },
          orderBy: (zuvyAssessmentSubmission, { asc }) =>
            asc(zuvyAssessmentSubmission.userId),
        });
      const totalStudentsCount = await db
        .select({ count: count() })
        .from(zuvyBatchEnrollments)
        .where(
          and(
            eq(zuvyBatchEnrollments.bootcampId, bootcampId),
            isNotNull(zuvyBatchEnrollments.batchId),
            ...(batchId && !isNaN(batchId)
              ? [eq(zuvyBatchEnrollments.batchId, batchId)]
              : []),
          ),
        );

      const userReattemptCounts = await db
        .select({
          userId: zuvyAssessmentSubmission.userId,
          reattemptCount: count(),
        })
        .from(zuvyAssessmentSubmission)
        .where(eq(zuvyAssessmentSubmission.assessmentOutsourseId, assessmentID))
        .groupBy(zuvyAssessmentSubmission.userId);

      const totalCountOfQualifiedStudents = await db
        .select({
          userId: zuvyAssessmentSubmission.userId,
          lastSubmissionId: max(zuvyAssessmentSubmission.id),
        })
        .from(zuvyAssessmentSubmission)
        .innerJoin(
          zuvyBatchEnrollments,
          eq(zuvyAssessmentSubmission.userId, zuvyBatchEnrollments.userId),
        )
        .where(
          and(
            eq(zuvyAssessmentSubmission.assessmentOutsourseId, assessmentID),
            eq(zuvyBatchEnrollments.bootcampId, bootcampId),
            isNotNull(zuvyBatchEnrollments.batchId),
            ...(batchId && !isNaN(batchId)
              ? [eq(zuvyBatchEnrollments.batchId, batchId)]
              : []),
            eq(zuvyAssessmentSubmission.isPassed, true),
          ),
        )
        .groupBy(zuvyAssessmentSubmission.userId);

      const batchEnrollConditions: SQL[] = [
        eq(zuvyBatchEnrollments.userId, zuvyAssessmentSubmission.userId),
        eq(zuvyBatchEnrollments.bootcampId, bootcampId),
        isNotNull(zuvyBatchEnrollments.batchId),
      ];
      if (batchId && !isNaN(batchId)) {
        batchEnrollConditions.push(eq(zuvyBatchEnrollments.batchId, batchId));
      }
      const totalCountQualifiedCondition =
        qualified === 'true'
          ? eq(zuvyAssessmentSubmission.isPassed, true)
          : qualified === 'false'
            ? or(
                eq(zuvyAssessmentSubmission.isPassed, false),
                isNull(zuvyAssessmentSubmission.isPassed),
              )
            : undefined;

      const totalCountResult = await db
        .select({ value: count() })
        .from(zuvyAssessmentSubmission)
        .where(
          and(
            eq(zuvyAssessmentSubmission.assessmentOutsourseId, assessmentID),
            exists(
              db
                .select({ _: zuvyBatchEnrollments.userId })
                .from(zuvyBatchEnrollments)
                .where(and(...batchEnrollConditions)),
            ),
            ...(totalCountQualifiedCondition
              ? [totalCountQualifiedCondition]
              : []),
            eq(
              zuvyAssessmentSubmission.id,
              sql`(SELECT MAX(id) FROM ${zuvyAssessmentSubmission} WHERE assessment_outsourse_id = ${assessmentID} AND user_id = ${zuvyAssessmentSubmission.userId})`,
            ),
          ),
        );
      // totalCountResult holds count from DB if needed; we'll compute final totalCount from combinedData below
      // const totalCount = totalCountResult[0]?.value;

      const reattemptCountMap = new Map(
        userReattemptCounts.map((entry) => [
          Number(entry.userId),
          entry.reattemptCount,
        ]),
      );

      // Map submissions by userId for quick lookup
      const submissionsMap = new Map(
        submitedOutsourseAssessments.map((submission) => [
          Number(submission.userId),
          submission,
        ]),
      );

      // Combine enrolled students with their submissions
      let combinedData = enrolledStudents
        .map((student: any) => {
          const userId = Number(student.userId);
          const submission = submissionsMap.get(userId);
          const started = submission?.startedAt;
          const ended = submission?.submitedAt;
          return {
            id: submission?.id || null,
            userId,
            name: student.user?.name || 'Unknown',
            email: student.user?.email || 'Unknown',
            batchId: student.batchInfo?.id || null,
            batchName: student.batchInfo?.name || null,
            marks: submission?.marks || null,
            startedAt: started || null,
            submitedAt: ended || null,
            isPassed: submission?.isPassed,
            percentage:
              submission?.percentage != null
                ? parseFloat(submission.percentage.toFixed(2))
                : null,
            typeOfsubmission: submission
              ? submission.typeOfsubmission
              : 'not attempted',
            copyPaste: submission?.copyPaste || null,
            active: submission?.active,
            mcqScore:
              submission?.mcqScore != null
                ? parseFloat(submission.mcqScore.toFixed(2))
                : null,
            codingScore:
              submission?.codingScore != null
                ? parseFloat(submission.codingScore.toFixed(2))
                : null,
            reattemptRequested: submission?.reattemptRequested,
            reattemptApproved: submission?.reattemptApproved,
            reattemptCount: (reattemptCountMap.get(userId) || 1) - 1,
            tabChange: submission?.tabChange || null,
            timeTaken:
              started && ended
                ? Math.floor(
                    (new Date(ended).getTime() - new Date(started).getTime()) /
                      1000,
                  )
                : null,
          };
        })
        .filter((data) => data.startedAt);

      // Apply sorting if orderBy is specified (do in-memory so we can sort by user.name/user.email which come from users relation)
      if (orderBy) {
        const direction = orderDirection === 'desc' ? -1 : 1;

        combinedData.sort((a, b) => {
          let valueA: any, valueB: any;

          switch (orderBy) {
            case 'submittedDate':
              valueA = a.submitedAt ? new Date(a.submitedAt).getTime() : 0;
              valueB = b.submitedAt ? new Date(b.submitedAt).getTime() : 0;
              break;
            case 'percentage':
              valueA = a.percentage != null ? a.percentage : -Infinity;
              valueB = b.percentage != null ? b.percentage : -Infinity;
              break;
            case 'name':
              valueA = (a.name || '').toLowerCase();
              valueB = (b.name || '').toLowerCase();
              break;
            case 'email':
              valueA = (a.email || '').toLowerCase();
              valueB = (b.email || '').toLowerCase();
              break;
            default:
              return 0;
          }

          if (valueA < valueB) return -1 * direction;
          if (valueA > valueB) return 1 * direction;
          return 0;
        });
      }

      // Apply pagination after sorting to ensure correct ordering
      const totalCount = combinedData.length;
      const offsetNumFinal = Number.isFinite(Number(offset))
        ? Number(offset)
        : 0;
      const limitNumFinal =
        Number.isFinite(Number(limit)) && Number(limit) > 0
          ? Number(limit)
          : totalCount;
      const paginatedData = combinedData.slice(
        offsetNumFinal,
        offsetNumFinal + limitNumFinal,
      );

      // Fetch ModuleAssessment details
      const moduleAssessment =
        await db.query.zuvyOutsourseAssessments.findFirst({
          where: (zuvyOutsourseAssessments, { eq }) =>
            eq(zuvyOutsourseAssessments.id, assessmentID),
          columns: {
            id: true,
          },
          with: {
            ModuleAssessment: {
              columns: {
                title: true,
                description: true,
              },
            },
          },
        });

      // Prepare the final response
      const totalPages = Math.ceil(totalCount / limitNumFinal) || 1;

      const response = {
        ModuleAssessment: {
          title: moduleAssessment?.ModuleAssessment?.title || null,
          description: moduleAssessment?.ModuleAssessment?.description || null,
          passPercentage: assessmentInfo[0]?.passPercentage || null,
          totalStudentsCount: Number(totalStudentsCount[0]?.count) || 0,
          totalSubmitedStudents: totalCount,
          totalQualifiedStudents: totalCountOfQualifiedStudents.length,
          totalPages,
        },
        submitedOutsourseAssessments: paginatedData,
      };

      return response;
    } catch (error) {
      throw error;
    }
  }

  // user submission details of the assessment
  async getUserAssessmentSubmission(req, submissionAssessmentID, userID) {
    try {
      const assessment: any = await db.query.zuvyAssessmentSubmission.findMany({
        where: (s) =>
          and(eq(s.id, submissionAssessmentID), isNotNull(s.submitedAt)),
        columns: {
          id: true,
          userId: true,
          marks: true,
          startedAt: true,
          submitedAt: true,
          tabChange: true,
          copyPaste: true,
          fullScreenExit: true,
          assessmentOutsourseId: true,
        },
        with: {
          user: {
            columns: {
              name: true,
              email: true,
            },
          },
          openEndedSubmission: {
            columns: {
              id: true,
              answer: true,
              questionId: true,
              feedback: true,
              marks: true,
            },
            with: {
              submissionData: {
                with: {
                  OpenEndedQuestion: true,
                },
              },
            },
          },
          quizSubmission: {
            columns: {
              id: true,
              chosenOption: true,
              questionId: true,
              attemptCount: true,
            },
            with: {
              submissionData: {
                with: {
                  Quiz: {
                    with: {
                      quizVariants: true,
                    },
                  },
                },
              },
            },
          },
          PracticeCode: {
            columns: {
              id: true,
              questionSolved: true,
              questionId: true,
              action: true,
              status: true,
              createdAt: true,
              sourceCode: true,
            },
            where: (PracticeCode) =>
              and(
                eq(PracticeCode.status, helperVariable.ACCEPTED),
                eq(PracticeCode.action, 'submit'),
              ),
            distinct: ['questionId'],
            with: {
              questionDetail: true,
            },
          },
        },
      });
      if (assessment.length == 0) {
        throw { statusCode: 404, massage: 'error not' };
      }
      const outsourseAssessment =
        await db.query.zuvyOutsourseAssessments.findMany({
          where: (zuvyOutsourseAssessments, { eq }) =>
            eq(
              zuvyOutsourseAssessments.id,
              assessment[0].assessmentOutsourseId,
            ),
          columns: {
            id: true,
            order: true,
          },
          with: {
            Quizzes: true,
            OpenEndedQuestions: true,
            CodingQuestions: true,
          },
        });

      assessment[0].totalQuizzes = outsourseAssessment[0].Quizzes.length;
      assessment[0].totalOpenEndedQuestions =
        outsourseAssessment[0].OpenEndedQuestions.length;
      assessment[0].totalCodingQuestions =
        outsourseAssessment[0].CodingQuestions.length;

      return assessment[0];
    } catch (error) {
      throw error;
    }
  }

  async getOpenEndedSolutionForStudents(assessmentSubmissionId) {
    try {
      const assessmentOpenEndedSolution: any =
        await db.query.zuvyOpenEndedQuestionSubmission.findMany({
          where: (s) => eq(s.assessmentSubmissionId, assessmentSubmissionId),
          with: {
            submissionData: {
              with: {
                OpenEndedQuestion: true,
              },
            },
          },
        });
      assessmentOpenEndedSolution.forEach((item) => {
        if (item.submissionData && item.submissionData.OpenEndedQuestion) {
          item.OpenEndedQuestion = item.submissionData.OpenEndedQuestion;
          delete item.submissionData;
        }
      });
      return [
        null,
        {
          status: 'success',
          statusCode: 200,
          message: 'Open ended solution fetched successfully',
          data: assessmentOpenEndedSolution,
        },
      ];
    } catch (err) {
      return [
        {
          status: 'error',
          statusCode: 400,
          message: err.message,
        },
      ];
    }
  }

  async getAssessmentsAndStudents(bootcampID: number): Promise<any> {
    try {
      const assessments = await db.query.zuvyOutsourseAssessments.findMany({
        where: (z) => eq(z.bootcampId, bootcampID),
        columns: {
          id: true,
          bootcampId: true,
          passPercentage: true,
          order: true,
        },
        with: {
          submitedOutsourseAssessments: {
            columns: {
              id: true,
              userId: true,
              marks: true,
              startedAt: true,
              submitedAt: true,
              isPassed: true,
              percentage: true,
              active: true,
            },
            where: (sub, { and, isNotNull, eq }) =>
              and(
                isNotNull(sub.submitedAt),
                eq(sub.active, true),
                exists(
                  db
                    .select({ _: zuvyBatchEnrollments.userId })
                    .from(zuvyBatchEnrollments)
                    .where(
                      and(
                        eq(zuvyBatchEnrollments.userId, sub.userId),
                        eq(zuvyBatchEnrollments.bootcampId, bootcampID),
                        isNotNull(zuvyBatchEnrollments.batchId),
                      ),
                    ),
                ),
              ),
            orderBy: (sub, { desc }) => desc(sub.startedAt),
            limit: 1,
            with: {
              user: {
                columns: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          ModuleAssessment: {
            columns: {
              title: true,
              description: true,
            },
          },
          Module: {
            columns: {
              name: true,
              description: true,
              timeAlloted: true,
              order: true,
            },
          },
          Quizzes: true,
          OpenEndedQuestions: true,
          CodingQuestions: true,
        },
      });

      if (!assessments || assessments.length === 0) {
        return [
          {
            statusCode: STATUS_CODES.NOT_FOUND,
            message: 'No assessments found.',
          },
        ];
      }

      const assessmentsByModule = assessments.reduce((acc, assessment: any) => {
        const moduleName = assessment.Module?.name;

        const assessmentData = {
          id: assessment.id,
          order: assessment.order || 0,
          title: assessment.ModuleAssessment?.title || null,
          description: assessment.ModuleAssessment?.description || null,
          totalCodingQuestions: assessment.CodingQuestions?.length || 0,
          totalOpenEndedQuestions: assessment.OpenEndedQuestions?.length || 0,
          totalQuizzes: assessment.Quizzes?.length || 0,
          totalSubmitedAssessments:
            assessment.submitedOutsourseAssessments?.length || 0,
          qualifiedStudents:
            assessment.submitedOutsourseAssessments?.filter(
              (sub) => sub.isPassed,
            ).length || 0,
          passPercentage: assessment.passPercentage,
          attemptCount: assessment.submitedOutsourseAssessments?.length || 0,
          submitedOutsourseAssessments:
            assessment.submitedOutsourseAssessments.map((submission) => ({
              id: submission.id,
              userId: submission.userId,
              marks: submission.marks,
              startedAt: submission.startedAt,
              submitedAt: submission.submitedAt,
              isPassed: submission.isPassed,
              percentage: submission.percentage,
              name: submission['user']?.name || null,
              email: submission['user']?.email || null,
            })),
        };
        if (!acc[moduleName]) {
          acc[moduleName] = [];
        }
        acc[moduleName].push(assessmentData);

        return acc;
      }, {});

      const studentsEnrolled = await this.getTotalStudentsEnrolled(bootcampID);

      return {
        statusCode: STATUS_CODES.OK,
        ...assessmentsByModule,
        totalStudents: studentsEnrolled.length,
      };
    } catch (err) {
      return [{ message: err.message }];
    }
  }

  async getBootcampModuleCompletion(
    roleName,
    bootcampID: number,
    searchVideos?: string,
    limit?: number,
    offSet?: number,
    orderBy?: 'title',
    orderDirection?: 'asc' | 'desc',
    orgId?: number,
  ) {
    try {
      // Validate ordering inputs
      if ((orderBy && !orderDirection) || (!orderBy && orderDirection)) {
        return {
          message: 'Both orderBy and orderDirection are required together',
          statusCode: 400,
        };
      }

      // ORDER BY chapter.title (same style as your other method)
      let chapterOrderClause = (moduleChapter: any, helpers: any) =>
        helpers.asc(moduleChapter.title);

      if (orderBy === 'title') {
        chapterOrderClause = (moduleChapter: any, helpers: any) => {
          const dir = orderDirection === 'desc' ? helpers.desc : helpers.asc;
          return dir(moduleChapter.title);
        };
      }
      // Get total enrolled students
      const studentsEnrolled = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(
          and(
            eq(zuvyBatchEnrollments.bootcampId, bootcampID),
            isNotNull(zuvyBatchEnrollments.batchId),
          ),
        );

      const totalStudents = studentsEnrolled.length;

      // Prepare the query to fetch course modules with an optional video search filter
      const courseModules = (await db.query.zuvyCourseModules.findMany({
        where: (zuvyCourseModules, { eq }) =>
          eq(zuvyCourseModules.bootcampId, bootcampID),
        columns: {
          id: true,
          name: true,
        },
        with: {
          moduleChapterData: {
            columns: {
              id: true,
              title: true,
              description: true,
              order: true,
            },
            orderBy: chapterOrderClause,
            where: (zuvyModuleChapter, { eq }) =>
              eq(zuvyModuleChapter.topicId, 1), // Filter by topicId = 1
            with: {
              chapterTrackingDetails: {
                columns: { userId: true },
                where: (track) =>
                  and(
                    isNotNull(track.completedAt),
                    eq(track.moduleId, zuvyModuleChapter.moduleId),
                  ),
              },
            },
          },
        },
        orderBy: (zuvyCourseModules, { asc }) => asc(zuvyCourseModules.id),
      })) as Array<{
        id: number;
        name: string;
        moduleChapterData: Array<{
          id: number;
          title: string;
          description: string;
          order: number;
          chapterTrackingDetails: Array<{ userId: number }>;
        }>;
      }>;

      // Check if no course modules found
      if (courseModules.length === 0) {
        return { message: 'No videos found' };
      }

      // Transform data into the required format
      let moduleData = courseModules.reduce(
        (acc, module) => {
          const { name, moduleChapterData } = module;

          // Filter chapters by video title if searchVideos is provided
          const filteredChapters = searchVideos
            ? moduleChapterData.filter((chapter) =>
                chapter.title
                  .toLowerCase()
                  .includes(searchVideos.toLowerCase()),
              )
            : moduleChapterData;

          // Add chapters and the number of completed students
          const chaptersWithCompletion = filteredChapters.map((chapter) => ({
            id: chapter.id,
            title: chapter.title,
            description: chapter.description,
            order: chapter.order,
            completedStudents: chapter.chapterTrackingDetails?.length || 0,
          }));

          if (chaptersWithCompletion.length > 0) {
            acc[name] = chaptersWithCompletion;
          }

          return acc;
        },
        {} as Record<
          string,
          Array<{
            id: number;
            title: string;
            description: string;
            order: number;
            completedStudents: number;
          }>
        >,
      );

      // Ensure only non-empty module data is included
      moduleData = Object.fromEntries(
        Object.entries(moduleData).filter(
          ([_, chapters]) => chapters.length > 0,
        ),
      );

      // Convert moduleData to an array for pagination
      const moduleDataArray = Object.entries(moduleData);

      // Apply pagination (limit and offset)
      const paginatedModuleDataArray = moduleDataArray.slice(
        offSet || 0,
        (offSet || 0) + (limit || moduleDataArray.length),
      );

      // Convert the paginated array back to an object
      const paginatedModuleData = Object.fromEntries(paginatedModuleDataArray);

      // Calculate total rows and total pages
      const totalRows = moduleDataArray.length; // Total number of modules
      const totalPages = limit ? Math.ceil(totalRows / limit) : 1;

      // If no chapters match the search, return a message
      if (Object.keys(paginatedModuleData).length === 0) {
        return { message: 'No matching videos found' };
      }
      const targetPermissions = [
        ResourceList.submission.read,
        ResourceList.submission.download,
        ResourceList.submission.re_attempt,
      ];
      const grantedPermissions = await this.rbacService.getAllPermissions(
        roleName,
        targetPermissions,
        orgId,
      );

      return {
        ...paginatedModuleData,
        ...grantedPermissions,
        totalStudents,
        totalRows,
        totalPages,
      };
    } catch (error) {
      throw error;
    }
  }

  async getModuleChapterStudents(
    chapterID: number,
    searchStudent: string,
    batchId?: number,
    limit?: number,
    offSet?: number,
    orderBy?: 'name' | 'email' | 'completedAt',
    orderDirection?: 'asc' | 'desc',
  ) {
    try {
      // Validate ordering inputs when provided
      if ((orderBy && !orderDirection) || (!orderBy && orderDirection)) {
        return {
          message: 'Both orderBy and orderDirection are required together',
          statusCode: 400,
        };
      }

      if (
        orderBy &&
        !['name', 'email', 'completedAt'].includes(orderBy as string)
      ) {
        return {
          message: 'orderBy must be one of: name, email, completedAt',
          statusCode: 400,
        };
      }

      if (
        orderDirection &&
        !['asc', 'desc'].includes(orderDirection as string)
      ) {
        return {
          message: 'orderDirection must be either asc or desc',
          statusCode: 400,
        };
      }

      // Fetch bootcampId using chapterId
      const chapterDetails = await db.query.zuvyModuleChapter.findFirst({
        where: (zuvyModuleChapter, { eq }) =>
          eq(zuvyModuleChapter.id, chapterID),
        columns: {
          id: true,
          title: true,
          description: true,
        },
        with: {
          courseModulesData: {
            columns: {
              bootcampId: true,
            },
          },
        },
      });

      if (!chapterDetails) {
        return {
          message: 'Chapter not found',
        };
      }

      const bootcampId = Number(chapterDetails.courseModulesData?.bootcampId);

      // Fetch total students (respecting optional batchId)
      const totalStudentsResult = await db
        .select({ count: count() })
        .from(zuvyBatchEnrollments)
        .where(
          and(
            eq(zuvyBatchEnrollments.bootcampId, bootcampId),
            batchId
              ? eq(zuvyBatchEnrollments.batchId, batchId)
              : isNotNull(zuvyBatchEnrollments.batchId),
          ),
        )
        .execute();
      const totalStudentsCount = Number(totalStudentsResult[0]?.count || 0);

      // Fetch total submitted students (only count submissions from enrolled users)
      interface TotalSubmittedStudentsResult {
        count: number | bigint;
      }

      const totalSubmittedStudentsResult: TotalSubmittedStudentsResult[] =
        await db
          .select({ count: count() })
          .from(zuvyChapterTracking)
          .where(
            and(
              eq(zuvyChapterTracking.chapterId, chapterID),
              exists(
                db
                  .select({ _: zuvyBatchEnrollments.userId })
                  .from(zuvyBatchEnrollments)
                  .where(
                    and(
                      eq(
                        zuvyBatchEnrollments.userId,
                        zuvyChapterTracking.userId,
                      ),
                      batchId
                        ? eq(zuvyBatchEnrollments.batchId, batchId)
                        : isNotNull(zuvyBatchEnrollments.batchId),
                    ),
                  ),
              ),
            ),
          )
          .execute();
      const totalSubmittedStudents = Number(
        totalSubmittedStudentsResult[0]?.count || 0,
      );

      // Fetch chapter tracking details with students
      const chapterTrackingDetails =
        await db.query.zuvyChapterTracking.findMany({
          where: (track) => {
            const conditions: SQL[] = [
              eq(track.chapterId, chapterID),
              exists(
                db
                  .select({ _: zuvyBatchEnrollments.userId })
                  .from(zuvyBatchEnrollments)
                  .where(
                    and(
                      eq(zuvyBatchEnrollments.userId, track.userId),
                      eq(zuvyBatchEnrollments.bootcampId, bootcampId),
                      batchId
                        ? eq(zuvyBatchEnrollments.batchId, batchId)
                        : isNotNull(zuvyBatchEnrollments.batchId),
                    ),
                  ),
              ),
            ];
            if (searchStudent) {
              const pattern = `%${searchStudent}%`;
              conditions.push(
                exists(
                  db
                    .select({ _: users.id })
                    .from(users)
                    .where(
                      and(
                        eq(users.id, track.userId),
                        or(
                          ilike(users.name, pattern),
                          ilike(users.email, pattern),
                        ),
                      ),
                    ),
                ),
              );
            }
            return and(...conditions);
          },
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
          },
          orderBy: (zuvyChapterTracking, { asc }) =>
            asc(zuvyChapterTracking.id),
        });

      // Fetch batch enrollments for these users to attach batchId/batchName
      const userIds = Array.from(
        new Set(chapterTrackingDetails.map((t) => Number(t.userId))),
      );
      const userIdsBigInt = userIds.map((id) => BigInt(id));
      let enrollmentMap = new Map();
      if (userIds.length > 0) {
        const enrollments = await db.query.zuvyBatchEnrollments.findMany({
          where: (tbl) =>
            and(
              inArray(tbl.userId, userIdsBigInt),
              eq(tbl.bootcampId, bootcampId),
              batchId ? eq(tbl.batchId, batchId) : isNotNull(tbl.batchId),
            ),
          columns: {
            userId: true,
            batchId: true,
          },
          with: {
            batchInfo: {
              columns: {
                name: true,
              },
            },
          },
        });

        enrollmentMap = new Map(enrollments.map((e) => [Number(e.userId), e]));
      }

      const submittedStudents = chapterTrackingDetails
        .filter((tracking) => tracking['user'] != null)
        .map((tracking) => {
          const uid = Number(tracking['user'].id);
          const enrollment = enrollmentMap.get(uid);
          return {
            id: uid,
            name: tracking['user'].name,
            email: tracking['user'].email,
            completedAt: tracking.completedAt,
            batchId: enrollment ? Number(enrollment.batchId) : null,
            batchName:
              enrollment && enrollment.batchInfo
                ? enrollment.batchInfo.name
                : null,
          };
        });

      // Apply sorting if requested
      if (orderBy) {
        const direction = orderDirection === 'desc' ? -1 : 1;
        submittedStudents.sort((a, b) => {
          let valueA: any = null;
          let valueB: any = null;

          switch (orderBy) {
            case 'name':
              valueA = (a.name || '').toLowerCase();
              valueB = (b.name || '').toLowerCase();
              break;
            case 'email':
              valueA = (a.email || '').toLowerCase();
              valueB = (b.email || '').toLowerCase();
              break;
            case 'completedAt':
              valueA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
              valueB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
              break;
            default:
              return 0;
          }

          if (valueA < valueB) return -1 * direction;
          if (valueA > valueB) return 1 * direction;
          return 0;
        });
      }

      // Apply pagination to submitted students
      const totalRows = submittedStudents.length; // Total rows before pagination
      const totalPages = limit ? Math.ceil(totalRows / limit) : 1;
      const paginatedStudents = submittedStudents.slice(
        offSet || 0,
        (offSet || 0) + (limit || totalRows),
      );

      // Response format
      const response = {
        id: Number(chapterDetails.id),
        bootcampId,
        submittedStudents: paginatedStudents,
        moduleVideochapter: {
          title: chapterDetails.title,
          description: chapterDetails.description,
          totalStudentsCount,
          totalSubmittedStudents,
        },
        totalRows,
        totalPages,
      };

      return response;
    } catch (error) {
      throw error;
    }
  }

  async getLeaderboardByCriteria(
    bootcampId: number,
    criteria: 'attendance' | 'bootcampProgress' | 'assessmentScore',
    assessmentOutsourseId: number | number[],
    limit: number,
    offset: number,
  ) {
    try {
      const bootcampData = await db.query.zuvyBootcamps.findMany({
        where: (bootcamp, { eq }) => eq(bootcamp.id, bootcampId),
        with: {
          students: {
            columns: { attendance: true },
            where: (batchEnrolled, { isNotNull }) =>
              isNotNull(batchEnrolled.batchId),
            with: {
              userInfo: {
                columns: { id: true, name: true, email: true },
              },
              userTracking: {
                columns: { progress: true, updatedAt: true },
                where: (track, { eq }) => eq(track.bootcampId, bootcampId),
              },
            },
          },
        },
      });

      // fetch Bootcamp assessments
      // Fetch Bootcamp assessments with optional filtering by assessmentOutsourseId
      const bootcampAssessments =
        await db.query.zuvyOutsourseAssessments.findMany({
          where: (assessment, { eq, and, inArray }) => {
            const conditions = [eq(assessment.bootcampId, bootcampId)];

            if (assessmentOutsourseId) {
              const assessmentIds = Array.isArray(assessmentOutsourseId)
                ? assessmentOutsourseId
                : [assessmentOutsourseId];
              conditions.push(inArray(assessment.id, assessmentIds));
            }

            return and(...conditions);
          },
          columns: { id: true },
          with: {
            submitedOutsourseAssessments: {
              where: (s, { eq }) => eq(s.active, true),
              orderBy: (s, { desc }) => desc(s.startedAt),
              limit: 1,
              columns: { userId: true, marks: true },
            },
          },
        });

      // Students average assessment score calculate
      const studentScores: Record<number, number> = {};

      bootcampAssessments.forEach((assessment) => {
        assessment.submitedOutsourseAssessments.forEach((submission) => {
          if (!studentScores[submission.userId]) {
            studentScores[submission.userId] = 0;
          }
          studentScores[submission.userId] += submission.marks || 0;
        });
      });

      const totalAssessments = bootcampAssessments.length;
      for (const userId in studentScores) {
        studentScores[userId] =
          totalAssessments > 0 ? studentScores[userId] / totalAssessments : 0;
      }

      const leaderboardData = bootcampData.map((bootcamp) => {
        const studentsWithScores = bootcamp['students']
          .filter((student) => student.userInfo != null)
          .map((student) => {
            const attendance = student.attendance || 0;
            const progress = student.userTracking?.progress || 0;
            const assessmentScore = studentScores[student.userInfo.id] || 0;

            return {
              ...student,
              userInfo: {
                id: Number(student.userInfo.id),
                name: student.userInfo.name,
                email: student.userInfo.email,
              },
              attendance,
              progress,
              assessmentScore,
            };
          });

        const totalStudents = studentsWithScores.length;
        const totalPages = !isNaN(limit) ? Math.ceil(totalStudents / limit) : 1;

        // Sorting based on criteria
        if (criteria === 'attendance') {
          studentsWithScores.sort((a, b) => b.attendance - a.attendance);
        } else if (criteria === 'bootcampProgress') {
          studentsWithScores.sort((a, b) => b.progress - a.progress);
        } else if (assessmentOutsourseId || criteria === 'assessmentScore') {
          studentsWithScores.sort(
            (a, b) => b.assessmentScore - a.assessmentScore,
          );
        }

        // Return sorted students with pagination
        return {
          ...bootcamp,
          students:
            !isNaN(limit) && !isNaN(offset)
              ? studentsWithScores.slice(offset, limit + offset)
              : studentsWithScores,
          totalStudents,
          totalPages,
        };
      });

      return leaderboardData;
    } catch (err) {
      throw err;
    }
  }

  async getAssessmentStats(
    bootcampId: number,
    assessmentId?: number,
    userId?: number,
    percentages?: number | number[],
  ) {
    try {
      // Step 1: Fetch assessment with submissions and question IDs
      const assessmentWithSubmissions = await db
        .select({
          assessment: zuvyOutsourseAssessments,
          submission: zuvyAssessmentSubmission,
          codingQuestion: zuvyOutsourseCodingQuestions.codingQuestionId,
          openEndedQuestion:
            zuvyOutsourseOpenEndedQuestions.openEndedQuestionId,
          openEndedMarks: zuvyOutsourseOpenEndedQuestions.marks,
          quizQuestion: zuvyOutsourseQuizzes.quiz_id,
        })
        .from(zuvyOutsourseAssessments)
        .leftJoin(
          zuvyAssessmentSubmission,
          eq(
            zuvyAssessmentSubmission.assessmentOutsourseId,
            zuvyOutsourseAssessments.id,
          ),
        )
        .leftJoin(
          zuvyOutsourseCodingQuestions,
          eq(
            zuvyOutsourseCodingQuestions.assessmentOutsourseId,
            zuvyOutsourseAssessments.id,
          ),
        )
        .leftJoin(
          zuvyOutsourseOpenEndedQuestions,
          eq(
            zuvyOutsourseOpenEndedQuestions.assessmentOutsourseId,
            zuvyOutsourseAssessments.id,
          ),
        )
        .leftJoin(
          zuvyOutsourseQuizzes,
          eq(
            zuvyOutsourseQuizzes.assessmentOutsourseId,
            zuvyOutsourseAssessments.id,
          ),
        )
        .where(
          assessmentId
            ? eq(zuvyOutsourseAssessments.id, assessmentId)
            : eq(zuvyOutsourseAssessments.bootcampId, bootcampId),
        )
        .orderBy(desc(zuvyOutsourseAssessments.createdAt));

      if (!assessmentWithSubmissions.length) {
        throw new NotFoundException('No assessment found for this bootcamp');
      }

      const assessment = assessmentWithSubmissions[0].assessment;

      // Step 1.5: Get the actual assessment name from zuvyModuleAssessment
      const assessmentDetails = await db
        .select({
          title: zuvyModuleAssessment.title,
          description: zuvyModuleAssessment.description,
        })
        .from(zuvyModuleAssessment)
        .where(eq(zuvyModuleAssessment.id, assessment.assessmentId))
        .limit(1);

      const assessmentName =
        assessmentDetails[0]?.title || 'Untitled Assessment';

      // Step 2: Filter submissions (all or by user)
      const allSubmissions = assessmentWithSubmissions
        .map((row) => row.submission)
        .filter(Boolean);

      // Remove duplicate submissions by ID
      const uniqueSubmissions = allSubmissions.filter(
        (submission, index, self) =>
          index === self.findIndex((s) => s.id === submission.id),
      );

      let submissions = uniqueSubmissions.filter((s) =>
        userId ? s.userId === userId : true,
      );

      if (!submissions.length) {
        throw new NotFoundException('No submissions found for this assessment');
      }

      // Step 3: Apply percentage filter if provided
      if (percentages) {
        const percentageArray = Array.isArray(percentages)
          ? percentages
          : [percentages];
        submissions = submissions.filter((s) =>
          percentageArray.some((p) => s.percentage >= p),
        );
      }

      // Step 4: Compute percentage distribution
      const brackets = [80, 60, 50, 30];
      const sortedBrackets = [...brackets].sort((a, b) => b - a);

      const percentageStats = sortedBrackets.map((bracket, index) => {
        let studentCount = 0;

        // Get unique users to avoid counting same user multiple times
        const uniqueUsers = [...new Set(submissions.map((s) => s.userId))];

        uniqueUsers.forEach((userId) => {
          // Get all submissions for this user and take the latest one
          const userSubmissions = submissions.filter(
            (s) => s.userId === userId,
          );
          const latestSubmission = userSubmissions.reduce((latest, current) =>
            new Date(current.submitedAt) > new Date(latest.submitedAt)
              ? current
              : latest,
          );

          const percentage = latestSubmission.percentage || 0;

          if (index === 0) {
            // Highest bracket: 80% and above
            if (percentage >= bracket) {
              studentCount++;
            }
          } else {
            // Other brackets: between current bracket and next higher bracket
            const higherBracket = sortedBrackets[index - 1];
            if (percentage >= bracket && percentage < higherBracket) {
              studentCount++;
            }
          }
        });

        return {
          percentage: `${bracket}%`,
          students: studentCount,
        };
      });

      // Step 5: Collect only MCQ question IDs (coding aur open-ended skip karo)
      const quizIds = [
        ...new Set(
          assessmentWithSubmissions
            .map((row) => row.quizQuestion)
            .filter(Boolean)
            .filter((id, index, self) => self.indexOf(id) === index),
        ),
      ];

      // Step 6: Fetch only MCQ question details
      const mcqDetails = quizIds.length
        ? await db
            .select({
              id: zuvyModuleQuizVariants.id,
              quizId: zuvyModuleQuizVariants.quizId,
              question: zuvyModuleQuizVariants.question,
              options: zuvyModuleQuizVariants.options,
              correctOption: zuvyModuleQuizVariants.correctOption,
              difficulty: zuvyModuleQuiz.difficulty,
              tagId: zuvyModuleQuiz.tagId,
            })
            .from(zuvyModuleQuizVariants)
            .leftJoin(
              zuvyModuleQuiz,
              eq(zuvyModuleQuiz.id, zuvyModuleQuizVariants.quizId),
            )
            .where(inArray(zuvyModuleQuizVariants.quizId, quizIds))
        : [];

      // Step 7: Fetch tags only for MCQ questions
      const tagIds = mcqDetails.map((q) => q.tagId).filter(Boolean);
      const tags = tagIds.length
        ? await db
            .select({ id: zuvyTags.id, name: zuvyTags.tagName })
            .from(zuvyTags)
            .where(inArray(zuvyTags.id, tagIds))
        : [];

      const mapTagName = (tagId?: number) =>
        tags.find((t) => t.id === tagId)?.name || null;

      // Step 8: Prepare assessment question structure - sirf MCQ rakho
      const assessmentQuestions = {
        mcq: mcqDetails.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          correctOption: q.correctOption,
          difficulty: q.difficulty,
          topic: mapTagName(q.tagId),
        })),
      };

      // Step 9: Return final response
      return {
        assessmentId: assessment.id,
        assessmentName: assessmentName,
        totalMarks: assessment.marks,
        passPercentage: assessment.passPercentage,
        totalStudents: uniqueSubmissions.length,
        percentageStats,
        assessmentQuestions,
        ...(userId
          ? {
              userPercentage: submissions[0].percentage,
              userMarks: submissions[0].marks,
            }
          : {}),
      };
    } catch (error) {
      console.error('Error fetching assessment stats:', error);
      throw new BadRequestException(
        error.message || 'Failed to fetch assessment stats',
      );
    }
  }

  async getOverallAnalysis(batchId: number, userId?: number): Promise<any> {
    try {
      // 1. Fetch bootcampId and course name from batchId
      const batch = await db
        .select({
          bootcampId: zuvyBatches.bootcampId,
          batchName: zuvyBatches.name,
        })
        .from(zuvyBatches)
        .where(eq(zuvyBatches.id, batchId))
        .limit(1);

      if (!batch.length) {
        return {
          statusCode: STATUS_CODES.NOT_FOUND,
          message: 'Batch not found',
          data: [],
        };
      }

      const bootcampId = batch[0].bootcampId;

      const course = await db
        .select({ name: zuvyBootcamps.name })
        .from(zuvyBootcamps)
        .where(eq(zuvyBootcamps.id, bootcampId))
        .limit(1);

      const courseName = course[0]?.name || null;

      // 2. Fetch enrolled students for this batch with user info and attendance
      const enrollments = await db
        .select({
          userId: zuvyBatchEnrollments.userId,
          attendance: zuvyBatchEnrollments.attendance,
          batchId: zuvyBatchEnrollments.batchId,
          batchName: zuvyBatches.name,
          name: users.name,
          email: users.email,
        })
        .from(zuvyBatchEnrollments)
        .leftJoin(users, eq(users.id, zuvyBatchEnrollments.userId))
        .leftJoin(zuvyBatches, eq(zuvyBatches.id, zuvyBatchEnrollments.batchId))
        .where(
          and(
            eq(zuvyBatchEnrollments.batchId, batchId),
            userId ? eq(zuvyBatchEnrollments.userId, userId) : undefined,
          ),
        );

      if (!enrollments.length) {
        return {
          statusCode: STATUS_CODES.NOT_FOUND,
          message: 'No enrolled students found for this bootcamp',
          data: [],
        };
      }

      const enrolledUserIds = enrollments.map((e) => Number(e.userId));

      // 3. Fetch all assessments for this bootcamp ordered by 'order'
      const assessments = await db
        .select({
          id: zuvyOutsourseAssessments.id,
          order: zuvyOutsourseAssessments.order,
          assessmentId: zuvyOutsourseAssessments.assessmentId,
        })
        .from(zuvyOutsourseAssessments)
        .where(eq(zuvyOutsourseAssessments.bootcampId, bootcampId))
        .orderBy(zuvyOutsourseAssessments.order);

      // 4. Fetch assessment titles
      const assessmentTitles: Record<number, string> = {};
      if (assessments.length) {
        const titles = await db
          .select({
            id: zuvyModuleAssessment.id,
            title: zuvyModuleAssessment.title,
          })
          .from(zuvyModuleAssessment)
          .where(
            inArray(
              zuvyModuleAssessment.id,
              assessments.map((a) => a.assessmentId),
            ),
          );
        titles.forEach((t) => {
          assessmentTitles[t.id] = t.title;
        });
      }

      // 5. Fetch all active, submitted assessments for enrolled users
      const assessmentIds = assessments.map((a) => a.id);
      let submissions: {
        userId: number;
        assessmentOutsourseId: number;
        percentage: number | null;
      }[] = [];
      if (assessmentIds.length && enrolledUserIds.length) {
        submissions = await db
          .select({
            userId: zuvyAssessmentSubmission.userId,
            assessmentOutsourseId:
              zuvyAssessmentSubmission.assessmentOutsourseId,
            percentage: zuvyAssessmentSubmission.percentage,
          })
          .from(zuvyAssessmentSubmission)
          .where(
            and(
              and(
                inArray(
                  zuvyAssessmentSubmission.assessmentOutsourseId,
                  assessmentIds,
                ),
                inArray(zuvyAssessmentSubmission.userId, enrolledUserIds),
              ),
              and(
                eq(zuvyAssessmentSubmission.active, true),
                isNotNull(zuvyAssessmentSubmission.submitedAt),
              ),
            ),
          );
      }

      // Map: userId -> assessmentOutsourseId -> percentage
      const submissionMap: Record<number, Record<number, number | null>> = {};
      for (const sub of submissions) {
        if (!submissionMap[sub.userId]) submissionMap[sub.userId] = {};
        submissionMap[sub.userId][sub.assessmentOutsourseId] = sub.percentage;
      }

      // 6. Fetch completed one-on-one sessions count per student
      const sessionCountMap: Record<number, number> = {};
      if (enrolledUserIds.length) {
        const sessions = await db
          .select({
            studentUserId: zuvyMentorSlotBooking.studentUserId,
            sessionCount: count(zuvyMentorSlotBooking.id),
          })
          .from(zuvyMentorSlotBooking)
          .where(
            and(
              inArray(zuvyMentorSlotBooking.studentUserId, enrolledUserIds),
              eq(zuvyMentorSlotBooking.sessionLifecycleState, 'COMPLETED'),
            ),
          )
          .groupBy(zuvyMentorSlotBooking.studentUserId);
        sessions.forEach((s) => {
          sessionCountMap[Number(s.studentUserId)] = Number(s.sessionCount);
        });
      }

      // 7. Fetch full learner profiles
      const profileMap: Record<number, any> = {};
      if (enrolledUserIds.length) {
        const profiles = await db
          .select()
          .from(zuvyLearnersCompleteProfile)
          .where(inArray(zuvyLearnersCompleteProfile.userId, enrolledUserIds));
        profiles.forEach((p) => {
          profileMap[p.userId] = p;
        });
      }

      // 8. Build final result
      const batchName = enrollments[0]?.batchName || null;

      const students = enrollments.map((enrollment) => {
        const userId = Number(enrollment.userId);
        const userSubs = submissionMap[userId] || {};
        const numberOfAssessmentsAttempted = Object.keys(userSubs).length;

        const assessmentScores = assessments.map((assessment, idx) => {
          const percentage = userSubs[assessment.id] ?? null;
          return {
            title:
              assessmentTitles[assessment.assessmentId] ||
              `Assessment ${idx + 1}`,
            status: percentage !== null ? 'present' : 'absent',
            percentage,
          };
        });

        const attemptedPercentages = assessmentScores
          .map((a) => a.percentage)
          .filter((p) => p !== null) as number[];

        const averageAssessmentPercentage =
          attemptedPercentages.length > 0
            ? Math.round(
                attemptedPercentages.reduce((sum, p) => sum + p, 0) /
                  attemptedPercentages.length,
              )
            : null;

        return {
          name: enrollment.name,
          email: enrollment.email,
          overAllAttendance: enrollment.attendance ?? null,
          numberOfAssessmentsAttempted,
          averageAssessmentPercentage,
          assessments: assessmentScores,
          oneOnOneSessionsCompleted: sessionCountMap[userId] ?? 0,
          profile: profileMap[userId] || null,
        };
      });

      return {
        statusCode: STATUS_CODES.OK,
        message: 'Overall analysis fetched successfully',
        data: { courseName, batchName, students },
      };
    } catch (error) {
      this.logger.error('Error fetching overall analysis:', error);
      throw new BadRequestException(
        error.message || 'Failed to fetch overall analysis',
      );
    }
  }
}
