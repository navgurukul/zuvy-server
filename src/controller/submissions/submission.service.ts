import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, lte, inArray } from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import * as _ from 'lodash';
import { error, log } from 'console';
import { zuvyBatchEnrollments, zuvyAssessmentSubmission, users, zuvyModuleAssessment, zuvyCourseModules, zuvyChapterTracking, zuvyBootcamps, zuvyOpenEndedQuestionSubmission, zuvyProjectTracking, zuvyQuizTracking, zuvyModuleTracking, zuvyModuleChapter, zuvyFormTracking, zuvyModuleForm } from '../../../drizzle/schema';
import { InstructorFeedbackDto, PatchOpenendedQuestionDto, CreateOpenendedQuestionDto } from './dto/submission.dto';
import { truncate } from 'fs/promises';
import { helperVariable } from 'src/constants/helper';

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
        projectSubmissionData['projectTrackingData'].forEach((project: any) => {
          project['userName'] = project['userDetails']['name'];
          project['userEmail'] = project['userDetails']['email'];
          delete project['userDetails']
        });
        return {
          status: 'success',
          code: 200,
          projectSubmissionData,
          totalPages: limit > 0 ? totalPages : 1,
          totalStudents: totalStudentsCount.length
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
      let InsertData = []; // Initialize InsertData as an array
      let updateData = []; // Initialize updateData as an array
      let updatePromises = []; // Use an array to collect update promises
      let insertPromises = []; // Use an array to collect insert promises

      // if submission already exists then update the submission
      if (submissionData.length > 0) {
        let filterQuestionId = submissionData.map((answer) => answer.questionId);

        answers.forEach((answer) => {
          if (filterQuestionId.includes(answer.questionId)) {
            // Collect update promises
            updatePromises.push(db.update(zuvyQuizTracking).set({ ...answer }).where(sql`${zuvyQuizTracking.questionId} = ${answer.questionId} and ${zuvyQuizTracking.assessmentSubmissionId} = ${assessmentSubmissionId} and ${zuvyQuizTracking.userId} = ${userId}`).returning());
          } else {
            // Prepare data for insertion
            InsertData.push({ ...answer, userId, assessmentSubmissionId });
          }
        });

        // Execute all update operations
        if (updatePromises.length > 0) {
          let updateResults = await Promise.all(updatePromises);
          updateResults.forEach(result => {
            updateData.push(result[0]);
          });
        }
      } else {
        // Prepare data for insertion if no submission data exists
        InsertData = answers.map((answer) => ({ ...answer, userId, assessmentSubmissionId }));
      }

      // Execute insert operation if there's data to insert
      if (InsertData.length > 0) {
        InsertData = await db.insert(zuvyQuizTracking).values(InsertData).returning();
      }
      // Since updateData is not directly returned from db.update, it's not included in the return statement
      return { message: 'Successfully save the Quiz.', data: [...InsertData, ...updateData] }; // Adjusted return value
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

  async submitOpenEndedQuestion(answers, userId, assessmentSubmissionId) {
    try {
      let updateData = [];
      let insertData = [];
      let submissionData = await this.getSubmissionOpenEnded(assessmentSubmissionId, userId);
      let updateResults = []; // Declare the updateResults variable

      if (submissionData.length > 0) {
        let filterQuestionId = submissionData.map((answer) => answer.questionId);
        let updatePromises = [];
        let insertPromises = [];

        for (let answer of answers) {
          if (filterQuestionId.includes(answer.questionId)) {
            let updatePromise = db.update(zuvyOpenEndedQuestionSubmission)
              .set({ ...answer })
              .where(sql`${zuvyOpenEndedQuestionSubmission.questionId} = ${answer.questionId} and ${zuvyOpenEndedQuestionSubmission.userId} = ${userId} and ${zuvyOpenEndedQuestionSubmission.assessmentSubmissionId} = ${assessmentSubmissionId}`)
              .returning();
            updatePromises.push(updatePromise);
          } else {
            insertData.push({ ...answer, userId, assessmentSubmissionId });
          }
        }

        // Await all update promises
        if (updatePromises.length > 0) {
          let updateResults = await Promise.all(updatePromises);
          updateResults.forEach(result => {
            updateData.push(result[0]);
          });
        }

        // Insert new answers if any
        if (insertData.length > 0) {
          const insertResults = await db.insert(zuvyOpenEndedQuestionSubmission).values(insertData).returning();
          insertData = insertResults;
        }
      } else {
        let quizInsertData = answers.map((answer) => ({ ...answer, userId, assessmentSubmissionId }));
        insertData = await db.insert(zuvyOpenEndedQuestionSubmission).values(quizInsertData).returning();
      }
      return { message: "Successfully save the open ended question.", data: [...insertData, ...updateData] };
    } catch (err) {
      console.error('Error in submitOpenEndedQuestion:', err);
      throw err; // Ensure proper error handling/logging here
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

  async getSubmissionOfForms(bootcampId: number) {
    try {
      const topicId = 7;
      const trackingData = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq }) =>
          eq(courseModules.bootcampId, bootcampId),
        orderBy: (courseModules, { asc }) => asc(courseModules.order),
        with: {
          moduleChapterData: {
            columns: {
              id: true,
              title: true,
            },
            where: (moduleChapter, { eq }) =>
              eq(moduleChapter.topicId, topicId),
            with: {
              chapterTrackingDetails: {
                columns: {
                  userId: true,
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


      const filteredTrackingData = trackingData.filter((course: any) => course.moduleChapterData.length > 0);

      filteredTrackingData.forEach((course: any) => {
        course.moduleChapterData.forEach((chapterTracking) => {
          chapterTracking['submitStudents'] =
            chapterTracking['chapterTrackingDetails'].length;
          delete chapterTracking['chapterTrackingDetails'];
        });
      });

      if (filteredTrackingData.length > 0) {
        return {
          status: 'success',
          code: 200,
          trackingData: filteredTrackingData,
          totalStudents: zuvyBatchEnrollmentsCount[0]?.count,
        }
      }
      else {
        return {
          status: 'error',
          code: 404,
          message: 'No forms in this course.'
        }
      }

    } catch (err) {
      throw err;
    }
  }

  async formsStatusOfStudents(
    bootcampId: number,
    chapterId: number,
    moduleId: number,
    limit: number,
    offset: number
  ) {
    try {
      if (isNaN(bootcampId) || bootcampId <= 0) {
        throw new Error('Invalid bootcampId');
      }

      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId));
      const totalStudentss = zuvyBatchEnrollmentsCount[0]?.count ?? 0;

      const statusOfIncompletedStudentForm = await db.query.zuvyBatchEnrollments.findMany({
        where: (batchEnrollments, { sql }) =>
          sql`${batchEnrollments.bootcampId} = ${bootcampId}`,
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

      const statusOfCompletedStudentForm = await db.query.zuvyChapterTracking.findMany({
        where: (chapterTracking, { sql }) =>
          sql`${chapterTracking.chapterId} = ${chapterId} AND ${chapterTracking.moduleId} = ${moduleId}`,
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

      const totalStudentsCount = totalStudentss;
      const totalPages = Math.ceil(totalStudentsCount / limit);
      
      const data1 = statusOfCompletedStudentForm.map((statusForm) => {
        return {
          id: Number(statusForm['user']['id']),
          name: statusForm['user']['name'],
          emailId: statusForm['user']['email'],
          status: 'Submitted',
        };
      });
      
      const completedIds = new Set(data1.map(item => item.id));
      const data2 = statusOfIncompletedStudentForm
        .map((statusForm) => {
          return {
            id: Number(statusForm['user']['id']),
            name: statusForm['user']['name'],
            emailId: statusForm['user']['email'],
            status: 'Not Submitted',
          };
        })
        .filter(statusForm => !completedIds.has(statusForm.id));
      const combinedData = [...data1, ...data2];

      return {
        status: "Success",
        code: 200, 
        moduleId,
        chapterId,
        combinedData, 
        totalPages, 
        totalStudentsCount };
    } catch (err) {
      throw err;
    }
  }


  async getFormDetailsById(
    moduleId: number,
    chapterId: number,
    userId: number
  ) {
    try {
      const chapterDetails = await db
        .select()
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.id, chapterId));

      const FormTracking = await db
        .select()
        .from(zuvyFormTracking)
        .where(sql`${zuvyFormTracking.userId} = ${userId} and ${zuvyFormTracking.chapterId} = ${chapterId} and ${zuvyFormTracking.moduleId} = ${moduleId}`);

      const ChapterTracking = await db
        .select()
        .from(zuvyChapterTracking)
        .where(sql`${zuvyChapterTracking.userId} = ${userId} and ${zuvyChapterTracking.chapterId} = ${chapterId} and ${zuvyChapterTracking.moduleId} = ${moduleId}`);



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
                status: "success",
                code: 200,
                message:"Form not submitted by student"
              }

            }
            else {
              const trackedData = await db.query.zuvyModuleForm.findMany({
                where: (moduleForm, { sql }) => sql`${inArray(moduleForm.id, Object.values(chapterDetails[0].formQuestions))}`,
                with: {

                  formTrackingData: {
                    columns: {
                      chosenOptions: true,
                      answer: true,
                      status: true,
                      updatedAt: true,
                    },
                    where: (formTracking, { sql }) => sql`${formTracking.userId} = ${userId} and ${formTracking.chapterId} = ${chapterId} and ${formTracking.moduleId} = ${moduleId}`,
                  }
                }
              });

              trackedData['status'] =
                ChapterTracking.length != 0
                  ? 'Completed'
                  : 'Pending';

              return {
                status: "success",
                code: 200,
                message:"Form submitted by student",
                trackedData
              }
            }
          }
        }
        else {
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
      }
      else {
        return 'No Form found';
      }
    } catch (err) {
      throw err;
    }
  }

  async getSubmissionOfAssignment(bootcampId: number) {
    try {
      const topicId = 5;
      const trackingData = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq }) =>
          eq(courseModules.bootcampId, bootcampId),
        orderBy: (courseModules, { asc }) => asc(courseModules.order),
        with: {
          moduleChapterData: {
            columns: {
              id: true,
              title:true,
            },
            where: (moduleChapter, { eq }) =>
              eq(moduleChapter.topicId, topicId),
            with: {
              chapterTrackingDetails: {
                columns: {
                  userId: true,
                },
              }
            },
          },
        }
      });

      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(sql`(${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL)`);
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
  
  async assignmentStatusOfStudents(
    chapterId: number,
    limit: number,
    offset: number
  ) {
    try {
      const chapterDeadline = await db.select({deadline : zuvyModuleChapter.completionDate})
      .from(zuvyModuleChapter)
      .where(eq(zuvyModuleChapter.id,chapterId));
      const statusOfStudentCode = await db.query.zuvyChapterTracking.findMany({
        where: (chapterTracking, { sql }) =>
          sql`${chapterTracking.chapterId} = ${chapterId}`,
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            }
          },
        },
        limit: limit,
        offset: offset
      });
      const totalStudents = await db.select().from(zuvyChapterTracking).where(sql`${zuvyChapterTracking.chapterId} = ${chapterId}`);
      const totalStudentsCount = totalStudents.length;
      const totalPages = Math.ceil(totalStudentsCount / limit);
      const deadlineDate = new Date(chapterDeadline[0].deadline).getTime();

      const data = statusOfStudentCode.map((statusCode) => {
      const studentAssignmentStatus = statusCode;
      let isLate = false;

     if (studentAssignmentStatus && studentAssignmentStatus['completedAt']) {
         const createdAtDate = new Date(studentAssignmentStatus['completedAt']).getTime();
     if (createdAtDate > deadlineDate) {
        isLate = true;
       }
     }

      return {
        id: Number(statusCode['user']['id']),
        name: statusCode['user']['name'],
        emailId: statusCode['user']['email'],
         status: isLate ? 'Late Submission' : 'On Time',
        };
     });

     const currentPage =!isNaN(limit) && !isNaN(offset) ? offset/limit + 1 : 1;

      return {status: helperVariable.success,code: 200, data, totalPages, totalStudentsCount,currentPage };
    } catch (err) {
      Logger.log(err.message)
      throw err;
    }
  }
   

   async getAssignmentSubmissionDetailForUser(chapterId:number,userId:number)
   {
    try{
      const assignmentDetails = await db.query.zuvyModuleChapter.findFirst({
        where: (moduleChapter, { eq }) =>
          eq(moduleChapter.id, chapterId),
        columns: {
          id:true,
          topicId:true,
          articleContent:true,
          completionDate:true
        },
        with: {
          chapterTrackingDetails: {
            columns: {
              completedAt:true
            },
            where : (chapterTracking,{eq}) =>
              eq(chapterTracking.userId,BigInt(userId)),
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true,
                },
                with: {
                  studentAssignmentStatus : {
                    columns : {
                      projectUrl:true
                    }
                  }
                }
              },
            },
          }
        },
      })

      let isSubmittedOnTime = true;
       if(new Date(assignmentDetails['completionDate']).getTime() < new Date(assignmentDetails['chapterTrackingDetails'][0]['completedAt']).getTime())
         {
           isSubmittedOnTime = false;
        }
         assignmentDetails['chapterTrackingDetails'][0]['user']['id'] = Number( assignmentDetails['chapterTrackingDetails'][0]['user']['id'] ) 
         assignmentDetails['chapterTrackingDetails'][0]['status'] = isSubmittedOnTime == true ? 'Submitted on time' : 'Submitted late';
        return {
          status:helperVariable.success,
          code:200,
          assignmentDetails
        };
    }
    catch(err) {
      Logger.log(err.message);
    }
   }
}