import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, lte } from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import * as _ from 'lodash';
import { error, log } from 'console';
import { zuvyBatchEnrollments, zuvyAssessmentSubmission, users, zuvyModuleAssessment, zuvyCourseModules, zuvyChapterTracking, zuvyBootcamps, zuvyOpenEndedQuestionSubmission } from '../../../drizzle/schema';
import {InstructorFeedbackDto, PatchOpenendedQuestionDto, CreateOpenendedQuestionDto} from './dto/submission.dto';

const { ZUVY_CONTENT_URL } = process.env;

@Injectable()
export class SubmissionService {
  async getSubmissionOfPractiseProblem(bootcampId: number) {
    try {
      const topicId = 3;
      const trackingData = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq }) =>
          eq(courseModules.bootcampId, bootcampId),
        orderBy: (courseModules, { asc }) => asc(courseModules.order),
        with: {
          moduleChapterData: {
            columns: {
              id: true,
            },
            where: (moduleChapter, { eq }) =>
              eq(moduleChapter.topicId, topicId),
            with: {
              chapterTrackingDetails: {
                columns: {
                  userId: true,
                },
              },
              codingQuestionDetails: {
                columns: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        }
      });

      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId));

      trackingData.forEach((course: any) => {
        course.moduleChapterData.forEach((chapterTracking) => {
          chapterTracking['submitStudents'] =
            chapterTracking['chapterTrackingDetails'].length;
          delete chapterTracking['chapterTrackingDetails'];
        });
      });

      return {
        trackingData,
        totalStudents: zuvyBatchEnrollmentsCount[0]?.count,
      };
    } catch (err) {
      throw err;
    }
  }

  async practiseProblemStatusOfStudents(
    questionId: number,
    chapterId: number,
    moduleId: number,
    limit: number,
    offset: number
  ) {
    try {
      const statusOfStudentCode = await db.query.zuvyChapterTracking.findMany({
        where: (chapterTracking, { sql }) =>
          sql`${chapterTracking.chapterId} = ${chapterId} AND ${chapterTracking.moduleId} = ${moduleId}`,
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
            with: {
              studentCodeDetails: true,
            },
          },
        },
        limit:limit,
        offset:offset
      });
      const totalStudents = await db.select().from(zuvyChapterTracking).where(sql`${zuvyChapterTracking.moduleId} = ${moduleId} and ${zuvyChapterTracking.chapterId} = ${chapterId}`);
      const totalStudentsCount = totalStudents.length;
      const totalPages = Math.ceil(totalStudentsCount/limit);
      const data = statusOfStudentCode.map((statusCode) => {
        return {
          id: Number(statusCode['user']['id']),
          name: statusCode['user']['name'],
          emailId: statusCode['user']['email'],
          noOfAttempts:
            statusCode['user']['studentCodeDetails']?.['questionSolved'][
              `${questionId}`
            ]?.['token'].length,
          status:
            statusCode['user']['studentCodeDetails']?.['questionSolved'][
              `${questionId}`
            ]?.['status'],
        };
      });

      return {data,totalPages,totalStudentsCount};
    } catch (err) {
      throw err;
    }
  }

  async assessmentStudentsInfoBy(assessment_id: number, limit: number, offset: number, bootcamp_id: number) {
    try {
      const assessmentSubmissionData = await db.query.zuvyModuleAssessment.findMany({
        where: (zuvyModuleAssessment, { sql }) => sql`${zuvyModuleAssessment.id} = ${assessment_id}`,
        columns: {
          id:true,
          title:true,
          passPercentage:true,
          timeLimit:true,
        },
        with: {
          assessmentSubmissions: {
            where: (zuvyAssessmentSubmission, { eq }) => eq(zuvyAssessmentSubmission.bootcampId, bootcamp_id),
            columns: {
              id:true,
              userId: true,
              assessmentId: true,
              bootcampId: true,
              marks:true,
              startedAt:true,
              submitedAt:true,
            },
            with: {
              user: {
                columns: {
                  name: true,
                  email: true,
                },
              },
            },
          }
          
        },
        limit: limit,
        offset: offset,
      });

      let bootcampStudents = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`);


      return assessmentSubmissionData;
    } catch (err) {
      throw err;
    }
  }

  async getAssessmentInfoBy(bootcamp_id, limit:number, offset:number) {
    try {
      const statusOfStudentCode = await db.query.zuvyCourseModules.findMany({
        where: (zuvyCourseModules, { sql }) =>
          sql`${zuvyCourseModules.bootcampId} = ${bootcamp_id}`,
        with: {
          moduleAssessments: {
            columns: {
              moduleId: true, 
              title: true,
              codingProblems: true,
              mcq: true,
              openEndedQuestions: true,
              id: true
            },
            with: {
              assessmentSubmissions: {
                where: (zuvyAssessmentSubmission, { sql }) =>
                  sql`${zuvyAssessmentSubmission.bootcampId} = ${bootcamp_id}`,
                columns: {
                  userId: true,
                  assessmentId: true
                },
              },
            },
          },
        },
        limit: limit,
        offset: offset,
      });
      
      let bootcampStudents = await db.select().from(zuvyBatchEnrollments).where(sql` ${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} AND${zuvyBatchEnrollments.batchId} IS NOT NULL  `)

        return { data: statusOfStudentCode, totalstudents:bootcampStudents.length};
      } catch (error) {
          console.error('Error fetching assessment info:', error);
          throw error;
      }
  }

  // assessment submission api 
  async assessmentStart(assessmentData, studentId: number) {
    try {
      return await db.insert(zuvyAssessmentSubmission).values({...assessmentData, userId:studentId}).returning();
    } catch (err) {
      throw err;
    }
  }

  async assessmentSubmission(data, id: number) {
    try {
      console.log('data', data, id)
      return await db.update(zuvyAssessmentSubmission).set(data).where(eq(zuvyAssessmentSubmission.id, id)).returning();
    } catch (err) {
      throw err;
    }
  }

  async submissionOpenended(OpenendedQuestionData:CreateOpenendedQuestionDto, studentId:number){
    try{
      const OpenendedQuestionSubmission = await db.insert(zuvyOpenEndedQuestionSubmission).values({...OpenendedQuestionData, studentId}).returning();
      return OpenendedQuestionSubmission;
    }catch(err){
      throw err;
    }
  }

  async patchOpenendedQuestion(data: PatchOpenendedQuestionDto, id: number){
    try{
      const res = await db.update(zuvyOpenEndedQuestionSubmission).set(data).where(eq(zuvyOpenEndedQuestionSubmission.id, id)).returning();
      return res;
    }catch(err){
      throw err;
    }
  }

  async instructorFeedback(data: InstructorFeedbackDto, id: number){
    try{
      const res = await db.update(zuvyOpenEndedQuestionSubmission).set(data).where(eq(zuvyOpenEndedQuestionSubmission.id, id)).returning();
      return res;
    }catch(err){
      throw err;
    }
  }

  async getOpenendedQuestionSubmission(submer_assissment_id){
    try{
      const res = await db.query.zuvyOpenEndedQuestionSubmission.findMany({
        where: (zuvyOpenEndedQuestionSubmission, {eq}) => eq(zuvyOpenEndedQuestionSubmission.id, submer_assissment_id),
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
        }
      })
      return res;
    } catch (err){
      throw err;
    }
  }

  async getAssessmentSubmission(assessment_id, studentId){
    try{
      const res = await db.query.zuvyAssessmentSubmission.findMany({
        where: (zuvyAssessmentSubmission, {eq, and}) => and(eq(zuvyAssessmentSubmission.assessmentId, assessment_id), eq(zuvyAssessmentSubmission.userId, studentId)),
        with: {
          user: {
            columns: {
              name: true,
              email: true,
            },
          },
          assessment: {
            columns: {
              id: true,
              title: true,
              passPercentage: true,
              timeLimit: true,
            },
          },
          openEndedSubmission: {
            columns: {
              id: true,
              question_id: true,
              answer: true,
              marks: true,
              feedback: true,
              submitAt: true,
              assessmentId: true,
            },
            with: {
              openEnded: {
                columns: {
                  id: true,
                  question: true,
                  difficulty: true,
                },
              },
            
            },
          },
          codingSubmission: {
            columns: {
              id: true,
              questionSolved: true,
              assessmentId: true,
            },
          },
          quizSubmission: {
            columns: {
              id: true,
              mcqId: true,
              status: true,
              chosenOption: true,
              attempt: true,
              assessmentId: true,
            },
          },
        }
      })
      return res;
    } catch (err){
      throw err;
    }
  }
}