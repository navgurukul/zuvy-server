import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, lte } from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import * as _ from 'lodash';
import { error, log } from 'console';
import { zuvyBatchEnrollments, zuvyAssessmentSubmission, users, zuvyModuleAssessment, zuvyCourseModules, zuvyChapterTracking, zuvyBootcamps, zuvyOpenEndedQuestionSubmission, zuvyProjectTracking, zuvyQuizTracking } from '../../../drizzle/schema';
import { InstructorFeedbackDto, PatchOpenendedQuestionDto, CreateOpenendedQuestionDto } from './dto/submission.dto';
import { truncate } from 'fs/promises';

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
        limit: limit,
        offset: offset
      });
      const totalStudents = await db.select().from(zuvyChapterTracking).where(sql`${zuvyChapterTracking.moduleId} = ${moduleId} and ${zuvyChapterTracking.chapterId} = ${chapterId}`);
      const totalStudentsCount = totalStudents.length;
      const totalPages = Math.ceil(totalStudentsCount / limit);
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

      return { data, totalPages, totalStudentsCount };
    } catch (err) {
      throw err;
    }
  }

  // async assessmentStudentsInfoBy(assessment_id: number, limit: number, offset: number, bootcamp_id: number) {
  //   try {
  //     const assessmentSubmissionData = await db.query.zuvyModuleAssessment.findMany({
  //       where: (zuvyModuleAssessment, { sql }) => sql`${zuvyModuleAssessment.id} = ${assessment_id}`,
  //       columns: {
  //         id:true,
  //         title:true,
  //         passPercentage:true,
  //         timeLimit:true,
  //       },
  //       with: {
  //         assessmentSubmissions: {
  //           where: (zuvyAssessmentSubmission, { eq }) => eq(zuvyAssessmentSubmission.bootcampId, bootcamp_id),
  //           columns: {
  //             id:true,
  //             userId: true,
  //             assessmentId: true,
  //             bootcampId: true,
  //             marks:true,
  //             startedAt:true,
  //             submitedAt:true,
  //           },
  //           with: {
  //             user: {
  //               columns: {
  //                 name: true,
  //                 email: true,
  //               },
  //             },
  //           },
  //         }

  //       },
  //       limit: limit,
  //       offset: offset,
  //     });

  //     let bootcampStudents = await db
  //       .select()
  //       .from(zuvyBatchEnrollments)
  //       .where(sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`);


  //     return assessmentSubmissionData;
  //   } catch (err) {
  //     throw err;
  //   }
  // }

  async getAssessmentInfoBy(bootcamp_id, limit: number, offset: number) {
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

      return { data: statusOfStudentCode, totalstudents: bootcampStudents.length };
    } catch (error) {
      console.error('Error fetching assessment info:', error);
      throw error;
    }
  }

  // assessment submission api 
  async assessmentStart(assessmentData, studentId: number) {
    try {
      return await db.insert(zuvyAssessmentSubmission).values({ ...assessmentData, userId: studentId }).returning();
    } catch (err) {
      throw err;
    }
  }

  async assessmentSubmission(data, id: number) {
    try {
      data['submitedAt'] = new Date().toISOString();
      return await db.update(zuvyAssessmentSubmission).set(data).where(eq(zuvyAssessmentSubmission.id, id)).returning();
    } catch (err) {
      throw err;
    }
  }

  async submissionOpenended(OpenendedQuestionData: CreateOpenendedQuestionDto, userId: number) {
    try {
      const OpenendedQuestionSubmission = await db.insert(zuvyOpenEndedQuestionSubmission).values({ ...OpenendedQuestionData, userId }).returning();
      return OpenendedQuestionSubmission;
    } catch (err) {
      throw err;
    }
  }

  async patchOpenendedQuestion(data: PatchOpenendedQuestionDto, id: number) {
    try {
      const res = await db.update(zuvyOpenEndedQuestionSubmission).set(data).where(eq(zuvyOpenEndedQuestionSubmission.id, id)).returning();
      return res;
    } catch (err) {
      throw err;
    }
  }

  async instructorFeedback(data: InstructorFeedbackDto, id: number) {
    try {
      const res = await db.update(zuvyOpenEndedQuestionSubmission).set(data).where(eq(zuvyOpenEndedQuestionSubmission.id, id)).returning();
      return res;
    } catch (err) {
      throw err;
    }
  }

  async getOpenendedQuestionSubmission(submer_assissment_id) {
    try {
      const res = await db.query.zuvyOpenEndedQuestionSubmission.findMany({
        where: (zuvyOpenEndedQuestionSubmission, { eq }) => eq(zuvyOpenEndedQuestionSubmission.id, submer_assissment_id),
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
    } catch (err) {
      throw err;
    }
  }

  // async getAssessmentSubmission(assessment_id, studentId){
  //   try{
  //     const res = await db.query.zuvyAssessmentSubmission.findMany({
  //       where: (zuvyAssessmentSubmission, {eq, and}) => and(eq(zuvyAssessmentSubmission.assessmentId, assessment_id), eq(zuvyAssessmentSubmission.userId, studentId)),
  //       with: {
  //         user: {
  //           columns: {
  //             name: true,
  //             email: true,
  //           },
  //         },
  //         assessment: {
  //           columns: {
  //             id: true,
  //             title: true,
  //             passPercentage: true,
  //             timeLimit: true,
  //           },
  //         },
  //         openEndedSubmission: {
  //           columns: {
  //             id: true,
  //             question_id: true,
  //             answer: true,
  //             marks: true,
  //             feedback: true,
  //             submitAt: true,
  //             assessmentId: true,
  //           },
  //           with: {
  //             openEnded: {
  //               columns: {
  //                 id: true,
  //                 question: true,
  //                 difficulty: true,
  //               },
  //             },

  //           },
  //         },
  //         codingSubmission: {
  //           columns: {
  //             id: true,
  //             questionSolved: true,
  //             assessmentId: true,
  //           },
  //         },
  //         quizSubmission: {
  //           columns: {
  //             id: true,
  //             mcqId: true,
  //             status: true,
  //             chosenOption: true,
  //             attempt: true,
  //             assessmentId: true,
  //           },
  //         },
  //       }
  //     })
  //     return res;
  //   } catch (err){
  //     throw err;
  //   }
  // }

  async getAllProjectSubmissions(bootcampId: number) {
    try {
      const data = await db.query.zuvyBootcamps.findFirst({
        columns: {
          id: true,
          name: true
        },
        where: (bootcamp, { eq }) =>
          eq(bootcamp.id, bootcampId),
        with: {
          bootcampModules: {
            columns: {
              id: true
            },
            where: (courseModule, { sql }) =>
              sql`${courseModule.typeId} = 2`,
            orderBy: (courseModule, { asc }) => asc(courseModule.order),
            with: {
              projectData: {
                columns: {
                  id: true,
                  title: true
                },
                with: {
                  projectTrackingData: true
                }
              }
            }
          }
        }
      })

      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId));

      data['bootcampModules'].forEach((module: any) => {
        module.projectData.forEach((project) => {
          project['submitStudents'] =
            project['projectTrackingData'].length;
          delete project['projectTrackingData'];
        });
      });

      if (data['bootcampModules'].length > 0) {
        return {
          status: 'success',
          code: 200,
          data,
          totalStudents: zuvyBatchEnrollmentsCount[0]?.count
        }
      }
      else {
        return {
          status: 'error',
          code: 404,
          message: 'No project in this course.'
        }
      }

    }
    catch (err) {
      throw err;
    }
  }

  async getUserDetailsForProject(projectId: number, bootcampId: number, limit: number, offset: number) {
    try {
      const projectSubmissionData = await db.query.zuvyCourseProjects.findFirst({
        where: (zuvyProject, { sql }) => sql`${zuvyProject.id} = ${projectId}`,
        columns: {
          id: true,
          title: true,
        },
        with: {
          projectTrackingData: {
            where: (projectTracking, { eq }) => eq(projectTracking.bootcampId, bootcampId),
            columns: {
              id: true,
              userId: true,
              projectId: true,
              bootcampId: true,
              isChecked: true,
              moduleId: true
            },
            with: {
              userDetails: {
                columns: {
                  name: true,
                  email: true,
                }
              },
            },
            limit: limit,
            offset: offset
          }

        }
      });

      const totalStudentsCount = await db.select().from(zuvyProjectTracking).where(sql`${zuvyProjectTracking.projectId} = ${projectId} and ${zuvyProjectTracking.bootcampId} = ${bootcampId}`);
      const totalPages = Math.ceil(totalStudentsCount.length / limit);

      if (projectSubmissionData['projectTrackingData'].length > 0) {

        return {
          status: 'success',
          code: 200,
          projectSubmissionData,
          totalPages
        }
      }
      else {
        return {
          status: 'error',
          code: 404,
          message: 'No submission from any student for this project'
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async getProjectDetailsForAUser(projectId: number, userId: number, bootcampId: number) {
    try {
      const projectSubmissionDetails = await db.query.zuvyCourseProjects.findFirst({
        where: (zuvyProject, { sql }) => sql`${zuvyProject.id} = ${projectId}`,
        with: {
          projectTrackingData: {
            where: (projectTracking, { sql }) => sql`${projectTracking.bootcampId} = ${bootcampId} and ${projectTracking.userId} = ${userId}`,
            with: {
              userDetails: {
                columns: {
                  name: true,
                  email: true,
                }
              },
            }
          }
        }
      });
      return {
        status: 'success',
        code: 200,
        projectSubmissionDetails
      }
    } catch (err) {
      throw err;
    }
  }

  // submission of the quizzez , and open ended questions, And  two different functons
  async submitQuiz(answers, userId: number, assessmentSubmissionId: number) {
    try {
      let submissionData = await this.getSubmissionQuiz(assessmentSubmissionId, userId);
      let updateData, InsertData
      // if submission already exists then update the submission
      if (submissionData.length > 0) {
        let filterQuestionId = submissionData.map((answer) => answer.questionId);
        updateData = answers.map((answer) => {
          if (filterQuestionId.includes(answer.questionId)) {
            return { ...answer }
          } else {
            InsertData.push({ ...answer, userId, assessmentSubmissionId })
          }
        });
        updateData = await db.update(zuvyQuizTracking).set(updateData).where(sql`${zuvyQuizTracking.assessmentSubmissionId} = ${assessmentSubmissionId} and ${zuvyQuizTracking.userId} = ${userId}`).returning();
        InsertData = await db.insert(zuvyQuizTracking).values(InsertData).returning();

      } else {
        // filter the submission data and insert the new submission if not exists then insert the new submission
        let quizInsertData = answers.map((answer) => { return { ...answer, userId, assessmentSubmissionId } });
        updateData = [] // if no submission data then update data will be empty
        InsertData = await db.insert(zuvyQuizTracking).values(quizInsertData).returning();
      }
      return [...InsertData, ...updateData];
    } catch (err) {
      throw err;
    }
  }

  async getSubmissionQuiz(assessmentSubmissionId, userId: number) {
    try {
      const submissionQuiz = await db.select().from(zuvyQuizTracking).where(sql`${zuvyQuizTracking.assessmentSubmissionId} = ${assessmentSubmissionId} and ${zuvyQuizTracking.userId} = ${userId}`);
      return submissionQuiz;
    } catch (err) {
      throw err;
    }
  }

  async submitOpenEndedQuestion(answers, userId: number, assessmentSubmissionId: number) {
    try {
      let submissionData = await this.getSubmissionOpenEnded(assessmentSubmissionId, userId);
      let updateData, InsertData
      // if submission already exists then update the submission
      if (submissionData.length > 0) {
        let filterQuestionId = submissionData.map((answer) => answer.questionId);
        updateData = answers.map((answer) => {
          if (filterQuestionId.includes(answer.questionId)) {
            return { ...answer }
          } else {
            InsertData.push({ ...answer, userId, assessmentSubmissionId })
          }
        });
        updateData = await db.update(zuvyOpenEndedQuestionSubmission).set(updateData).where(sql`${zuvyOpenEndedQuestionSubmission.assessmentSubmissionId} = ${assessmentSubmissionId} and ${zuvyOpenEndedQuestionSubmission.userId} = ${userId}`).returning();
        InsertData = await db.insert(zuvyOpenEndedQuestionSubmission).values(InsertData).returning();

      } else {
        // filter the submission data and insert the new submission if not exists then insert the new submission
        let quizInsertData = answers.map((answer) => { return { ...answer, userId, assessmentSubmissionId } });
        updateData = [] // if no submission data then update data will be empty

        InsertData = await db.insert(zuvyOpenEndedQuestionSubmission).values(quizInsertData).returning();
      }
      return [...InsertData, ...updateData];
    } catch (err) {
      throw err;
    }
  }

  async getSubmissionOpenEnded(assessmentSubmissionId, userId: number) {
    try {
      const submissionOpenEnded = await db.select().from(zuvyOpenEndedQuestionSubmission).where(sql`${zuvyOpenEndedQuestionSubmission.assessmentSubmissionId} = ${assessmentSubmissionId} and ${zuvyOpenEndedQuestionSubmission.userId} = ${userId}`);
      return submissionOpenEnded;
    } catch (err) {
      throw err;
    }
  }
}