import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { sql } from 'drizzle-orm';
import * as _ from 'lodash';
import { zuvyBatchEnrollments, zuvyOutsourseAssessments } from '../../../drizzle/schema';

const { ZUVY_CONTENT_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class AdminAssessmentService {
  async transformAssessments(assessments) {
    const result = {};
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
            totalCodingQuestions: CodingQuestions.length,
            totalOpenEndedQuestions: OpenEndedQuestions.length,
            totalQuizzes: Quizzes.length,
            totalSubmitedAssessments: submitedOutsourseAssessments.length,
            qualifiedStudents,
          },
        ];
      } else {
        result[moduleName].push({
          ...assessmentInfo,
          ...ModuleAssessment,
          totalCodingQuestions: CodingQuestions.length,
          totalOpenEndedQuestions: OpenEndedQuestions.length,
          totalQuizzes: Quizzes.length,
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

  async getBootcampAssessment(bootcampID) {
    try {
      const assessment = await db.query.zuvyOutsourseAssessments.findMany({
        where: (zuvyOutsourseAssessments, { eq }) =>
          eq(zuvyOutsourseAssessments.bootcampId, bootcampID),
        columns: {
          id: true,
          order: true,
        },
        with: {
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
          submitedOutsourseAssessments: {
            where: (zuvyAssessmentSubmission, { sql }) =>
              sql`
            ${zuvyAssessmentSubmission.submitedAt} IS NOT NULL 
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

  async getAssessmentStudents(req, assessmentID) {
    try {
      const assessmentInfo = await db.select().from(zuvyOutsourseAssessments).where(sql`${zuvyOutsourseAssessments.id} = ${assessmentID}`);

      if(assessmentInfo.length > 0)
        {
      const assessment = await db.query.zuvyOutsourseAssessments.findMany({
        where: (zuvyOutsourseAssessments, { eq }) =>
          eq(zuvyOutsourseAssessments.id, assessmentID),
        columns: {
          id: true,
          bootcampId: true,
          passPercentage: true,
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
            },
            where: (submitedOutsourseAssessments, { sql, eq }) => sql`
            ${submitedOutsourseAssessments.submitedAt} IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM main.zuvy_batch_enrollments
              WHERE main.zuvy_batch_enrollments.user_id = ${submitedOutsourseAssessments.userId}
              AND main.zuvy_batch_enrollments.bootcamp_id = ${assessmentInfo[0].bootcampId}
              AND main.zuvy_batch_enrollments.batch_id IS NOT NULL
            )
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
      let studentsEnrolled = await this.getTotalStudentsEnrolled(
        assessment[0].bootcampId,
      );
      assessment[0].ModuleAssessment['totalStudents'] = studentsEnrolled.length;
      assessment[0].ModuleAssessment['totalSubmitedStudents'] =
        assessment[0].submitedOutsourseAssessments.length || 0;

      assessment[0].submitedOutsourseAssessments =
        assessment[0].submitedOutsourseAssessments.map((submission: any) => {
          return {
            id: submission.id,
            userId: submission.userId,
            marks: submission.marks,
            startedAt: submission.startedAt,
            submitedAt: submission.submitedAt,
            isPassed: submission.isPassed,
            percentage: submission.percentage,
            ...submission.user,
          };
        });

      return assessment[0];
        }
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
          embeddedGoogleSearch: true,
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
                  Quiz: true,
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
              sql`${PracticeCode.status} = he AND ${PracticeCode.action} = 'submit'`,
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
}
