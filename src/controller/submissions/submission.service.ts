import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, lte } from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import * as _ from 'lodash';
import { error, log } from 'console';
import { zuvyBatchEnrollments, zuvyAssessmentSubmission, users, zuvyModuleAssessment, zuvyCourseModules, zuvyChapterTracking, zuvyBootcamps } from '../../../drizzle/schema';


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
  async assessmentStudentsInfoBy(assessment_id: number,limit:number, offset:number, bootcamp_id:number) {
    try {
      const assessmentSubmissionData = await db.query.zuvyModuleAssessment.findMany({
        where: (zuvyModuleAssessment, {sql}) => sql`${zuvyModuleAssessment.id}= ${assessment_id}`,
        with: {
          assessmentSubmissions: {
            where: (zuvyAssessmentSubmission, { eq }) => eq(zuvyAssessmentSubmission.bootcampId ,bootcamp_id ),
            columns: {
              userId: true,
              assessmentId: true,
              bootcampId:true
            }
          }
        }
      });
      return assessmentSubmissionData;
    } catch (err) {
      throw err;
    }
  }

  // async submissionOfAssessment(studentId: number, submisionData){
  //   await db.insert(zuvyAssessmentSubmission).values(submisionData)
  // }

  async getAssessmentInfoBy(bootcamp_id, limit:number, offset:number) {
    try {
      const statusOfStudentCode = await db.query.zuvyCourseModules.findMany({
        where: (zuvyCourseModules, { sql }) =>
          sql`${zuvyCourseModules.bootcampId} = ${bootcamp_id}`,
        with: {
          moduleAssessments: {
            columns: {
              moduleId: true, // Include the moduleId
              title: true,
              codingProblems: true,
              mcq: true,
              openEndedQuestions: true,
            },
            with: {
              assessmentSubmissions: {
                where: (zuvyAssessmentSubmission, { sql }) =>
                  sql`${zuvyAssessmentSubmission.bootcampId} = ${bootcamp_id}`,
                columns: {
                  userId: true,
                  assessmentId: true,
                  // bootcampId: true,
                  // moduleId: true, // Include the moduleId

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


  // async getAssessmentInfoBy(bootcamp_id) {
  //   try{
  //     console.log('bootcamp', bootcamp_id);
  //     const courseModule = await db.select().from(zuvyCourseModules).where(eq(zuvyCourseModules.bootcampId, bootcamp_id))
      
  //     let moduleIds = courseModule.map(module => module.id)
  //     console.log('module: ', moduleIds)
      
  //     const assessment = await db.select().from(zuvyModuleAssessment).where(sql`${zuvyModuleAssessment.moduleId} IN ${moduleIds}`)
  //     const totalStudents = await db.select().from(zuvyBatchEnrollments).where(eq(zuvyBatchEnrollments.bootcampId, bootcamp_id))
  //     const assessmentSubmit = await db.select().from(zuvyAssessmentSubmission).where(eq(zuvyAssessmentSubmission.bootcampId, bootcamp_id))

  //     assessment.forEach((mod)=>{
        
  //     })


  //     return {total_students: totalStudents.length, submisions : assessmentSubmit.length, assessment  };

  //   } catch (err){
  //     throw err
  //   }
  // }
}