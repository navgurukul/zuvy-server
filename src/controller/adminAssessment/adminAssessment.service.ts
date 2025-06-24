const AWS = require('aws-sdk');
import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, SQL, sql } from 'drizzle-orm';
import * as _ from 'lodash';
import { zuvyBatchEnrollments, zuvyChapterTracking, zuvyAssessmentReattempt, zuvyModuleChapter, zuvyOutsourseAssessments, zuvyAssessmentSubmission } from '../../../drizzle/schema';
import { STATUS_CODES } from 'src/helpers';
import { helperVariable } from 'src/constants/helper'

const { PENDING, ACCEPTED, REJECTED} = helperVariable.REATTMEPT_STATUS; // Importing helper variables
const { SUPPORT_EMAIL, AWS_SUPPORT_ACCESS_SECRET_KEY, AWS_SUPPORT_ACCESS_KEY_ID, ZUVY_BASH_URL} = process.env; // Importing env values

@Injectable()
export class AdminAssessmentService {
  private logger = new Logger(AdminAssessmentService.name);

 
  // Generate email content dynamically for student notification
  private async generateStudentEmailContent(user: any, submission: any): Promise<string> {
    const assessmentDeepLink = `${ZUVY_BASH_URL}/student/courses/${submission.bootcampId}/modules/${submission.moduleId}/chapters/${submission.chapterId}`;
    
    // Format duration to display hours if applicable
    let durationText = 'N/A';
    if (submission.timeLimit) {
      // Convert seconds to minutes first
      const timeLimitInMinutes = Math.floor(parseInt(submission.timeLimit) / 60);
      
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
  private async generateRejectEmailContent(user: any, submission: any): Promise<string> {
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
      const submission:any = await db.query.zuvyAssessmentSubmission.findFirst({
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
          user:{
            columns:{
              name:true,
              email:true
            }
          },
          submitedOutsourseAssessment:{
            columns: {
              id: true,
              bootcampId: true,
              moduleId: true,
              chapterId: true,
              timeLimit: true,
              marks: true,              
            },
            with: {
              ModuleAssessment:{
                columns: {
                  id: true,
                  title: true,
                  description: true,
                  marks: true,
                },
              }
            }
          }
        }
      });

      if (!submission) {
        return [{
          status: 'error',
          statusCode: 404,
          message: 'Assessment submission not found',
        }];
      }
      if (submission.reattempt.length === 0) {
        return [{
          status: 'error',
          statusCode: 400,
          message: 'Re-attempt request already processed',
        }];
      }

      let reattemptId = submission.reattempt[0].id;
      let ModuleAssessment = submission.submitedOutsourseAssessment.ModuleAssessment
      let outsourseAssessment = submission.submitedOutsourseAssessment
      delete submission.submitedOutsourseAssessment

      let updatingAssessment:any  = {
        reattemptApproved: true,
        active: false,
      }
      // Update submission to mark reattempt approved and reset submission status
      await db.update(zuvyAssessmentSubmission)
        .set(updatingAssessment)
        .where(eq(zuvyAssessmentSubmission.id, assessmentSubmissionId)).returning();
      await db.update(zuvyAssessmentReattempt)
        .set({ status: ACCEPTED }).where(eq(zuvyAssessmentReattempt.id, reattemptId)).returning();

      // Send email to student notifying approval
      let [errorSendEmail, emailSent] = await this.sendEmailToStudent({...submission, ...ModuleAssessment, ...outsourseAssessment});
      if (errorSendEmail) {
        this.logger.error(`error in sending email to student: ${errorSendEmail}`)
        return [{
          status: 'success',
          statusCode: 200,
          message: 'Re-attempt approved and Not able to notified',
        }];
      }
      return [null, {
        status: 'success',
        statusCode: 200,
        message: 'Re-attempt approved and student notified',
      }];
    } catch (error) {
      this.logger.error('Error in approveReattempt', error);
      return [{
        status: 'error',
        statusCode: 500,
        message: 'Internal server error',
      }];
    }
  }

  // Helper method to send email to student using AWS SES
  private async sendEmailToStudent(submission: any): Promise<any> {
    try {

      AWS.config.update({
        accessKeyId: AWS_SUPPORT_ACCESS_KEY_ID,      // Replace with your access key ID
        secretAccessKey: AWS_SUPPORT_ACCESS_SECRET_KEY, // Replace with your secret access key
        region: 'ap-south-1'                      // Replace with your AWS SES region, e.g., 'us-east-1'
      });
      // Fetch student email and name
      let ses = new AWS.SES();
      
      const user = await db.query.users.findFirst({
        where: (zuvyUser, { eq }) => eq(zuvyUser.id, submission.userId),
      });

      if (!user) {
        this.logger.warn(`User with id ${submission.userId} not found for sending approval email`);
        return;
      }

      const emailContent = await this.generateStudentEmailContent(user, submission);

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
      this.logger.log(`Email sent to student ${user.email} for re-attempt approval: ` + JSON.stringify(result));
      return [null, result]
    } catch (error) {
      this.logger.error('Failed to send email to student', error);
      return [{message: error, Error: true}]
    }
  }

  async rejectReattempt(assessmentSubmissionId: number): Promise<any> {
    try {
      // Check if submission exists
      const submission:any = await db.query.zuvyAssessmentSubmission.findFirst({
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
          user:{
            columns:{
              name:true,
              email:true
            }
          },
          submitedOutsourseAssessment:{
            columns: {
              id: true,
              bootcampId: true,
              moduleId: true,
              chapterId: true,
              timeLimit: true,
              marks: true,              
            },
            with: {
              ModuleAssessment:{
                columns: {
                  id: true,
                  title: true,
                  description: true,
                  marks: true,
                },
              }
            }
          }
        }
      });

      if (!submission) {
        return [{
          status: 'error',
          statusCode: 404,
          message: 'Assessment submission not found',
        }];
      }
      if (submission.reattempt.length === 0) {
        return [{
          status: 'error',
          statusCode: 400,
          message: 'Re-attempt request already processed',
        }];
      }
      let reattemptId = submission.reattempt[0].id;
      let ModuleAssessment = submission.submitedOutsourseAssessment.ModuleAssessment
      let user = submission.user
      let outsourseAssessment = submission.submitedOutsourseAssessment
      delete submission.submitedOutsourseAssessment

      let updatingAssessment:any  = {
        reattemptApproved: false,
        active: true
      }
      // Update submission to mark reattempt approved and reset submission status
      let red = await db.update(zuvyAssessmentSubmission)
        .set(updatingAssessment)
        .where(eq(zuvyAssessmentSubmission.id, assessmentSubmissionId)).returning();
      let green = await db.update(zuvyAssessmentReattempt)
        .set({ status: REJECTED }).where(eq(zuvyAssessmentReattempt.id, reattemptId)).returning();
      // Send email to student notifying approval
      let [errorSendEmail, emailSent] = await this.sendRejectEmailToStudent({...submission, ...ModuleAssessment, ...outsourseAssessment});
      if (errorSendEmail) {
        return [{
          status: 'error',
          statusCode: 500,
          message: errorSendEmail,
        }];
      }
    
      return [null, {
        status: 'success',
        statusCode: 200,
        message: 'Re-attempt rejected and student notified',
      }];
    } catch (error) {
      this.logger.error('Error in rejectReattempt', error);
      return [{
        status: 'error',
        statusCode: 500,
        message: 'Internal server error',
      }];
    }
  }

  async sendRejectEmailToStudent(submission: any): Promise<any> {
    try {
      // Fetch student email and name
      let ses = new AWS.SES();

      AWS.config.update({
        accessKeyId: AWS_SUPPORT_ACCESS_KEY_ID,      // Replace with your access key ID
        secretAccessKey: AWS_SUPPORT_ACCESS_SECRET_KEY, // Replace with your secret access key
        region: 'ap-south-1'                      // Replace with your AWS SES region, e.g., 'us-east-1'
      });
      
      const user = await db.query.users.findFirst({
        where: (zuvyUser, { eq }) => eq(zuvyUser.id, submission.userId),
      });

      if (!user) {
        this.logger.warn(`User with id ${submission.userId} not found for sending approval email`);
        return;
      }

      const emailContent = await this.generateRejectEmailContent(user, submission);

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
      this.logger.log(`Email sent to student ${user.email} for re-attempt approval: ` + JSON.stringify(result));
      return [null, result]
    } catch (error) {
      this.logger.error('Failed to send email to student', error);
      return [{message: error, Error: true}]
    }
  }
  
  async transformAssessments(assessments) {
    const result = {};
    const stateDescriptions = {
      0: 'DRAFT',
      1: 'PUBLISHED',
      2: 'ACTIVE',
      3: 'CLOSED'
    };
    
    assessments.forEach((assessment) => {
      const moduleName = assessment.Module.name;
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
        sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampID} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`,
      );
    return studentsEnrolled;
  }

  async getBootcampAssessment(bootcampID:number,searchAssessment:string) {
    try {
      const assessment = await db.query.zuvyOutsourseAssessments.findMany({
        where: (zuvyOutsourseAssessments, { eq ,and}) =>
          {
          const conditions = [
                eq(zuvyOutsourseAssessments.bootcampId, bootcampID)
          ];
          if (searchAssessment) {
            conditions.push(sql`
              EXISTS (
                SELECT 1
                FROM main.zuvy_module_assessment AS ma
                WHERE ma.id = ${zuvyOutsourseAssessments.id}
                AND lower(ma.title) LIKE lower(${searchAssessment + '%'})
                )`);
          }
      
          return and(...conditions);
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
        with: {
          ModuleAssessment: {
            columns: {
              title: true,
              description: true,
            }
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
            where: (zuvyAssessmentSubmission, { sql }) =>
              sql`
            ${zuvyAssessmentSubmission.submitedAt} IS NOT NULL 
            AND ${zuvyAssessmentSubmission.active} IS true
            AND ${zuvyAssessmentSubmission.isPassed} IS NOT NULL
            AND EXISTS (
                SELECT 1
                FROM main.zuvy_batch_enrollments
                WHERE main.zuvy_batch_enrollments.user_id = ${zuvyAssessmentSubmission.userId}
                AND main.zuvy_batch_enrollments.bootcamp_id = ${bootcampID}
                AND main.zuvy_batch_enrollments.batch_id IS NOT NULL
              )
            `,
          },
        },
      });
      assessment.forEach(item => {
        const uniqueSubmissions = [];
        const userIds = new Set();
      
        item.submitedOutsourseAssessments.forEach(submission => {
          if (!userIds.has(submission.userId)) {
            userIds.add(submission.userId);
            uniqueSubmissions.push(submission);
          }
        });
      
        item.submitedOutsourseAssessments = uniqueSubmissions;
      });
      if (assessment == undefined || assessment.length == 0) {
        return [];
      }
      // assessment
      let studentsEnrolled = await this.getTotalStudentsEnrolled(bootcampID);
      let result = await this.transformAssessments(assessment);
      result['totalStudents'] = studentsEnrolled.length;
      return result;
    } catch (error) {
      throw error;
    }
  }

  async getAssessmentStudents(req, assessmentID: number, searchStudent: string, limit?: number, offset?: number) {
    try {
      // Fetch assessment details
      const assessmentInfo = await db
        .select()
        .from(zuvyOutsourseAssessments)
        .where(sql`${zuvyOutsourseAssessments.id} = ${assessmentID}`);
  
      if (assessmentInfo.length === 0) {
        throw { statusCode: 404, message: 'Assessment not found' };
      }
  
      const bootcampId = assessmentInfo[0].bootcampId;
  
      // Fetch all students enrolled in the bootcamp
      const enrolledStudents = await db.query.zuvyBatchEnrollments.findMany({
        where: (zuvyBatchEnrollments, { eq, sql }) => sql`
          ${zuvyBatchEnrollments.bootcampId} = ${bootcampId}
          AND ${zuvyBatchEnrollments.batchId} IS NOT NULL
          ${searchStudent ? sql`
            AND EXISTS (
              SELECT 1
              FROM main.users
              WHERE main.users.id = ${zuvyBatchEnrollments.userId}
              AND (
                lower(main.users.name) LIKE lower(${searchStudent + '%'})
                OR lower(main.users.email) LIKE lower(${searchStudent + '%'})
              )
            )
          ` : sql``}
        `,
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
              name: true,
            },
          },
        },
        limit: limit || 20,
        offset: offset || 0,
        orderBy: (zuvyBatchEnrollments, { asc }) => asc(zuvyBatchEnrollments.userId),
      });
  
      // Fetch submitted assessments for the given assessmentID
      const submitedOutsourseAssessments = await db.query.zuvyAssessmentSubmission.findMany({
        where: (zuvyAssessmentSubmission, { sql }) => sql`
          ${zuvyAssessmentSubmission.assessmentOutsourseId} = ${assessmentID}
          AND EXISTS (
            SELECT 1
            FROM main.zuvy_batch_enrollments
            WHERE main.zuvy_batch_enrollments.user_id = ${zuvyAssessmentSubmission.userId}
            AND main.zuvy_batch_enrollments.bootcamp_id = ${bootcampId}
            AND main.zuvy_batch_enrollments.batch_id IS NOT NULL
          )
        `,
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
        limit: limit || 20,
        offset: offset || 0,
        orderBy: (zuvyAssessmentSubmission, { asc }) => asc(zuvyAssessmentSubmission.userId),
      });
      const totalStudentsCount = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(zuvyBatchEnrollments)
      .where(sql`
        ${zuvyBatchEnrollments.bootcampId} = ${bootcampId}
        AND ${zuvyBatchEnrollments.batchId} IS NOT NULL
        `);


      const userReattemptCounts = await db
      .select({
        userId: zuvyAssessmentSubmission.userId,
        reattemptCount: sql<number>`COUNT(*)`,
      })
      .from(zuvyAssessmentSubmission)
      .where(sql`${zuvyAssessmentSubmission.assessmentOutsourseId} = ${assessmentID}`)
      .groupBy(zuvyAssessmentSubmission.userId)

      const reattemptCountMap = new Map(
        userReattemptCounts.map((entry) => [Number(entry.userId), entry.reattemptCount])
      );
      

      
      // Map submissions by userId for quick lookup
      const submissionsMap = new Map(
        submitedOutsourseAssessments.map((submission) => [Number(submission.userId), submission])
      );

      // Combine enrolled students with their submissions
      const combinedData = enrolledStudents.map((student:any) => {
        let userId = Number(student.userId);
        const submission = submissionsMap.get(Number(userId));  
        return {
          id: submission?.id || null,
          userId,
          name: student.user.name,
          email: student.user.email,
          batchName: student.batchInfo?.name || null,
          marks: submission?.marks || null,
          startedAt: submission?.startedAt || null,
          submitedAt: submission?.submitedAt || null,
          isPassed: submission?.isPassed,
          percentage: submission?.percentage || null,
          typeOfsubmission: submission ? submission.typeOfsubmission : 'not attempted',
          copyPaste: submission?.copyPaste || null,
          active: submission?.active,
          reattemptRequested: submission?.reattemptRequested,
          reattemptApproved: submission?.reattemptApproved,
          reattemptCount: (reattemptCountMap.get(userId) || 1) - 1,
          tabChange: submission?.tabChange || null,
        };
      });
  
      // Fetch ModuleAssessment details
      const moduleAssessment = await db.query.zuvyOutsourseAssessments.findFirst({
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
      const response = {
        ModuleAssessment: {
          title: moduleAssessment?.ModuleAssessment?.title || null,
          description: moduleAssessment?.ModuleAssessment?.description || null,
          totalStudents: Number(totalStudentsCount[0]?.count) || 0,
          totalSubmitedStudents: userReattemptCounts.length,
        },
        submitedOutsourseAssessments: combinedData,
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
        where: (zuvyAssessmentSubmission, { eq, and, isNotNull, sql }) =>
          sql`${zuvyAssessmentSubmission.id}= ${submissionAssessmentID} AND ${zuvyAssessmentSubmission.submitedAt} IS NOT NULL`,
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
                      quizVariants: true
                    }
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
            where: (PracticeCode, { sql }) =>
              sql`${PracticeCode.status} = ${helperVariable.ACCEPTED} AND ${PracticeCode.action} = 'submit'`,
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

  async getAssessmentsAndStudents(bootcampID: number): Promise<any> {
    try {  
      const assessments = await db.query.zuvyOutsourseAssessments.findMany({
        where: (zuvyOutsourseAssessments, { sql }) =>
          sql`${zuvyOutsourseAssessments.bootcampId} = ${bootcampID}`,
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
            where: (submitedOutsourseAssessments, { sql }) => sql`${submitedOutsourseAssessments.submitedAt} IS NOT NULL AND ${submitedOutsourseAssessments.active} = true           
              AND EXISTS (
                SELECT 1
                FROM main.zuvy_batch_enrollments
                WHERE main.zuvy_batch_enrollments.user_id = ${submitedOutsourseAssessments.userId}
                AND main.zuvy_batch_enrollments.bootcamp_id = ${bootcampID}
                AND main.zuvy_batch_enrollments.batch_id IS NOT NULL
              )
              order by ${submitedOutsourseAssessments.startedAt} desc limit 1 
            `,
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
        return [{ statusCode: STATUS_CODES.NOT_FOUND, message: 'No assessments found.' }];
      }

      const assessmentsByModule = assessments.reduce((acc, assessment:any) => {
        const moduleName = assessment.Module?.name;
        
        const assessmentData = {
          id: assessment.id,
          order: assessment.order || 0,
          title: assessment.ModuleAssessment?.title || null,
          description: assessment.ModuleAssessment?.description || null,
          totalCodingQuestions: assessment.CodingQuestions?.length || 0,
          totalOpenEndedQuestions: assessment.OpenEndedQuestions?.length || 0,
          totalQuizzes: assessment.Quizzes?.length || 0,
          totalSubmitedAssessments: assessment.submitedOutsourseAssessments?.length || 0,
          qualifiedStudents: assessment.submitedOutsourseAssessments?.filter(sub => sub.isPassed).length || 0,
          passPercentage: assessment.passPercentage,
          attemptCount: assessment.submitedOutsourseAssessments?.length || 0,
          submitedOutsourseAssessments: assessment.submitedOutsourseAssessments.map(submission => ({
            id: submission.id,
            userId: submission.userId,
            marks: submission.marks,
            startedAt: submission.startedAt,
            submitedAt: submission.submitedAt,
            isPassed: submission.isPassed,
            percentage: submission.percentage,
            name: submission['user'].name || null,
            email: submission['user'].email || null,
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
      return [{message: err.message}]
    }
  }

  async getBootcampModuleCompletion(bootcampID: number, searchVideos?: string, limit?: number, offSet?: number) {
    try {
      // Get total enrolled students
      const studentsEnrolled = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampID} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`
        );
  
      const totalStudents = studentsEnrolled.length;
  
      // Prepare the query to fetch course modules with an optional video search filter
      const courseModules = await db.query.zuvyCourseModules.findMany({
        where: (zuvyCourseModules, { eq }) => eq(zuvyCourseModules.bootcampId, bootcampID),
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
            where: (zuvyModuleChapter, { eq }) => eq(zuvyModuleChapter.topicId, 1), // Filter by topicId = 1
            with: {
              chapterTrackingDetails: {
                columns: { userId: true },
                where: (zuvyChapterTracking, { sql }) =>
                  sql`${zuvyChapterTracking.completedAt} IS NOT NULL AND ${zuvyChapterTracking.moduleId} = ${zuvyModuleChapter.moduleId}`,
              },
            },
          },
        },
        orderBy: (zuvyCourseModules, { asc }) => asc(zuvyCourseModules.id),
      }) as Array<{
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
        return { message: "No videos found" };
      }
  
      // Transform data into the required format
      let moduleData = courseModules.reduce((acc, module) => {
        const { name, moduleChapterData } = module;
  
        // Filter chapters by video title if searchVideos is provided
        const filteredChapters = searchVideos
          ? moduleChapterData.filter((chapter) =>
              chapter.title.toLowerCase().includes(searchVideos.toLowerCase())
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
      }, {} as Record<string, Array<{ id: number; title: string; description: string; order: number; completedStudents: number }>>);
  
      // Ensure only non-empty module data is included
      moduleData = Object.fromEntries(
        Object.entries(moduleData).filter(([_, chapters]) => chapters.length > 0)
      );
  
      // Convert moduleData to an array for pagination
      const moduleDataArray = Object.entries(moduleData);
  
      // Apply pagination (limit and offset)
      const paginatedModuleDataArray = moduleDataArray.slice(offSet || 0, (offSet || 0) + (limit || moduleDataArray.length));
  
      // Convert the paginated array back to an object
      const paginatedModuleData = Object.fromEntries(paginatedModuleDataArray);
  
      // Calculate total rows and total pages
      const totalRows = moduleDataArray.length; // Total number of modules
      const totalPages = limit ? Math.ceil(totalRows / limit) : 1;
  
      // If no chapters match the search, return a message
      if (Object.keys(paginatedModuleData).length === 0) {
        return { message: "No matching videos found" };
      }
  
      return {
        ...paginatedModuleData,
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
    limit?: number,
    offSet?: number
  ) {
    try {
      // Fetch bootcampId using chapterId
      const chapterDetails = await db.query.zuvyModuleChapter.findFirst({
        where: (zuvyModuleChapter, { eq }) => eq(zuvyModuleChapter.id, chapterID),
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
  
      const bootcampId = Number(chapterDetails.courseModulesData.bootcampId);
  
      // Fetch total students
      const totalStudentsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId))
        .execute();
      const totalStudents = Number(totalStudentsResult[0]?.count || 0);
  
      // Fetch total submitted students
      const totalSubmittedStudentsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(zuvyChapterTracking)
        .where(eq(zuvyChapterTracking.chapterId, chapterID))
        .execute();
      const totalSubmittedStudents = Number(totalSubmittedStudentsResult[0]?.count || 0);
  
      // Fetch chapter tracking details with students
      const chapterTrackingDetails = await db.query.zuvyChapterTracking.findMany({
        where: (zuvyChapterTracking, { eq, sql }) => sql`
          ${zuvyChapterTracking.chapterId} = ${chapterID}
          ${searchStudent ? sql`
            AND EXISTS (
              SELECT 1
              FROM main.users
              WHERE main.users.id = ${zuvyChapterTracking.userId}
              AND (
                lower(main.users.name) LIKE lower(${searchStudent + '%'})
                OR lower(main.users.email) LIKE lower(${searchStudent + '%'})
              )
            )
          ` : sql``}
        `,
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
        orderBy: (zuvyChapterTracking, { asc }) => asc(zuvyChapterTracking.id),
      });
  
      const submittedStudents = chapterTrackingDetails.map((tracking) => ({
        id: Number(tracking['user'].id), // Convert user ID to number
        name: tracking['user'].name,
        email: tracking['user'].email,
        completedAt: tracking.completedAt,
      }));
  
      // Apply pagination to submitted students
      const totalRows = submittedStudents.length; // Total rows before pagination
      const totalPages = limit ? Math.ceil(totalRows / limit) : 1;
      const paginatedStudents = submittedStudents.slice(
        offSet || 0,
        (offSet || 0) + (limit || totalRows)
      );
  
      // Response format
      const response = {
        id: Number(chapterDetails.id), 
        bootcampId,
        submittedStudents: paginatedStudents,
        moduleVideochapter: {
          title: chapterDetails.title,
          description: chapterDetails.description,
          totalStudents,
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
    offset: number
  ) {
    try {
      const bootcampData = await db.query.zuvyBootcamps.findMany({
        where: (bootcamp, { eq }) => eq(bootcamp.id, bootcampId),
        with: {
          students: {
            columns: { attendance: true },
            where: (batchEnrolled, { sql }) => sql`${batchEnrolled.batchId} IS NOT NULL`,
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
      const bootcampAssessments = await db.query.zuvyOutsourseAssessments.findMany({
        where: (assessment, { eq, and, inArray }) => {
          const conditions = [eq(assessment.bootcampId, bootcampId)];

          if (assessmentOutsourseId) {
            const assessmentIds = Array.isArray(assessmentOutsourseId) ? assessmentOutsourseId : [assessmentOutsourseId];
            conditions.push(inArray(assessment.id, assessmentIds));
          }

          return and(...conditions);
        },
        columns: { id: true },
        with: {
          submitedOutsourseAssessments: {
            where: (submitedOutsourseAssessments,{sql}) => sql`${submitedOutsourseAssessments.active} = true order by ${submitedOutsourseAssessments.startedAt} desc limit 1`,
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
        studentScores[userId] = totalAssessments > 0 ? studentScores[userId] / totalAssessments : 0;
      }

      const leaderboardData = bootcampData.map((bootcamp) => {
        const studentsWithScores = bootcamp['students'].map((student) => {
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
          studentsWithScores.sort((a, b) => b.assessmentScore - a.assessmentScore);
        }

        // Return sorted students with pagination
        return {
          ...bootcamp,
          students: !isNaN(limit) && !isNaN(offset) ? studentsWithScores.slice(offset, limit + offset) : studentsWithScores,
          totalStudents,
          totalPages,
        };
      });

      return leaderboardData;
    } catch (err) {
      throw err;
    }
  }
}
function and(arg0: SQL<unknown>, arg1: SQL<unknown>): import("drizzle-orm").SQL<unknown> {
  throw new Error('Function not implemented.');
}

