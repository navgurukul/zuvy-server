import { Injectable, Logger } from '@nestjs/common';
import { error, log } from 'console';
import {
  zuvyBatchEnrollments,
  zuvyBootcampTracking,
  zuvyBootcamps,
  zuvyBootcampType,
  zuvySessions,
  users
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, desc, count,asc } from 'drizzle-orm';
import { ClassesService } from '../classes/classes.service'
import { query } from 'express';
import { helperVariable } from 'src/constants/helper';
import { STATUS_CODES } from 'http';
import {ErrorResponse} from 'src/errorHandler/handler';

@Injectable()
export class StudentService {
  constructor(private ClassesService: ClassesService) { }
  async enrollData(userId: number) {
    try {
      let enrolled = await db.query.zuvyBatchEnrollments.findMany({
        where: (zuvyBatchEnrollments, { sql }) => sql`${zuvyBatchEnrollments.userId} = ${userId} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`,
        columns: {
          id: true
        },
        with: {
          bootcamp: {
            columns: {
              id: true,
              name: true,
              coverImage: true,
              duration: true,
              language: true,
              bootcampTopic: true
            },
          },
          batchInfo: true,
          tracking: {
            where: (bootcampTracking, { sql }) =>
              sql`${bootcampTracking.userId} = ${userId}`,
          }
        }
      })
      let totalData = enrolled.map((e: any) => {
        const { batchInfo, tracking, bootcamp } = e;

        return {
          ...bootcamp,
          batchId: batchInfo?.id,
          batchName: batchInfo?.name,
          progress: tracking?.progress || 0
        };
      });



      return [null, totalData];
    } catch (err) {
      error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async enrollmentData(bootcampId: number) {
    try {
      let enrolled = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId}`);
      let unEnrolledBatch = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NULL`,
        );
      return [
        null,
        {
          students_in_bootcamp: enrolled.length,
          unassigned_students: unEnrolledBatch.length,
        },
      ];
    } catch (error) {
      log(`error: ${error.message}`);
      return [{ status: 'error', message: error.message, code: 500 }, null];
    }
  }

  async searchPublicBootcampByStudent(searchTerm: string) {
    try {
      let getPubliczuvyBootcamps = await db
        .select()
        .from(zuvyBootcamps)
        .innerJoin(zuvyBootcampType, eq(zuvyBootcamps.id, zuvyBootcampType.bootcampId))
        .where(
          sql`${zuvyBootcampType.type} = 'Public' AND (LOWER(${zuvyBootcamps.name
            }) LIKE ${searchTerm.toLowerCase()} || '%')`,
        );
      let data = await Promise.all(
        getPubliczuvyBootcamps.map(async (bootcamp) => {
          let [err, res] = await this.enrollmentData(bootcamp.zuvy_bootcamp_type.bootcampId);
          if (err) {
            return [err, null];
          }
          return { ...bootcamp, ...res };
        }),
      );
      return [null, data];
    } catch (err) {
      error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async getPublicBootcamp() {
    try {
      let getPubliczuvyBootcamps = await db
        .select()
        .from(zuvyBootcamps)
        .innerJoin(zuvyBootcampType, eq(zuvyBootcamps.id, zuvyBootcampType.bootcampId))
        .where(
          sql`${zuvyBootcampType.type} = 'Public'`,
        );
      let data = await Promise.all(
        getPubliczuvyBootcamps.map(async (bootcamp) => {
          let [err, res] = await this.enrollmentData(bootcamp.zuvy_bootcamp_type.bootcampId);
          if (err) {
            return [err, null];
          }
          return { ...bootcamp, ...res };
        }),
      );
      return [null, data];
    } catch (err) {
      error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async removingStudent(user_id: number, bootcamp_id) {
    try {
      let enrolled = await db
        .delete(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.userId} = ${user_id} AND ${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} `,
        )
        .returning();
      if (enrolled.length == 0) {
        return [{ status: 'error', message: 'id not found', code: 404 }, null];
      }
      return [
        null,
        {
          status: 'true',
          message: 'Student removed for the bootcamp',
          code: 200,
        },
      ];
    } catch (e) {
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async getUpcomingClass(student_id: number, batchID: number,limit:number,offset:number):Promise<any> {
    try {
      let queryString;
      if (batchID) {
        queryString = sql`${zuvyBatchEnrollments.userId} = ${student_id} AND ${zuvyBatchEnrollments.batchId} = ${batchID}`
      } else {
        queryString = sql`${zuvyBatchEnrollments.userId} = ${student_id} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`
      }
      let enrolled = await db.select().from(zuvyBatchEnrollments).where(queryString);

      if (enrolled.length == 0) {
        return [null,{message:'not enrolled in any course.',statusCode: STATUS_CODES.OK,data:[]}]
      }
      let bootcampAndbatchIds = await Promise.all(
        enrolled
          .filter(e => e.batchId !== null) 
          .map(async e => {
            await this.ClassesService.updatingStatusOfClass(e.bootcampId, e.batchId);
            return {bootcampId:e.bootcampId,batchId: e.batchId};
          })
      );
      let upcomingClasses = await db.query.zuvySessions.findMany({
        where: (session, { and, or, eq, ne }) =>
          and(
            or(...bootcampAndbatchIds.map(({ bootcampId, batchId }) => 
              and(
                eq(session.bootcampId, bootcampId),
                eq(session.batchId, batchId)
              )
            )),
            ne(session.status, helperVariable.completed)
          ),
        orderBy: (session, { asc }) => asc(session.startTime),
        with : {
          bootcampDetail : {
            columns : {
              id:true,
              name:true
            }
          }
        },
        extras: {
          totalCount: sql<number>`coalesce(count(*) over(), 0)`.as('total_count')
        },
        limit,
        offset
       })
      const totalCount = upcomingClasses.length > 0 ? upcomingClasses[0]['totalCount'] : 0;
        
       const totalClasses =totalCount;
      let filterClasses = upcomingClasses.reduce((acc, e) => {
          e['bootcampName'] = e['bootcampDetail'].name;
          e['bootcampId'] = e['bootcampDetail'].id;
          delete  e['bootcampDetail'];
          delete e['totalCount']
        if (e.status == helperVariable.upcoming) {
          acc.upcoming.push(e);
        } else {
          acc.ongoing.push(e);
        }
        return acc;
      }, {upcoming: [], ongoing: [] });
      if(Number(totalClasses) == 0)
        {
        return [null,{message:'No upcoming classes',statusCode: STATUS_CODES.OK,data:[]}]
          
        }
      return [null,{message:'Upcoming classes fetched successfully',statusCode: STATUS_CODES.OK,data:{filterClasses,totalClasses:Number(totalClasses),totalPages : !isNaN(limit) ? Math.ceil(totalClasses/limit) : 1}}]
    } catch (error) {
      return [{message:error.message,statusCode: STATUS_CODES.BAD_REQUEST}]
    }
  }

  async getAttendanceClass(student_id: number) {
    try {
      let enrolled = await db.query.zuvyBatchEnrollments.findMany({
        where: (zuvyBatchEnrollments, { sql }) => sql`${zuvyBatchEnrollments.userId} = ${student_id}`,
        with: {
          bootcamp: {
            id: true,
            name: true
          }
        }
      });

      if (enrolled.length == 0) {
        return [{ status: 'error', message: 'not enrolled in any course.', code: 404 }, null];
      }

      let totalAttendance = await Promise.all(enrolled.map(async (e: any) => {
        let classes = await db.select().from(zuvySessions).where(sql`${zuvySessions.batchId} = ${e.batchId} AND ${zuvySessions.status} = 'completed'`).orderBy(desc(zuvySessions.startTime));
        e.attendance = e.attendance != null ? e.attendance : 0;
        e.totalClasses = classes.length;
        e.attendedClasses = classes.length > 0 && e.attendance > 0 ? ((e.attendance / classes.length) * 100).toFixed(2): 0;
        delete e.userId;
        delete e.bootcamp
        return e;
      }));
      return totalAttendance;
    } catch (err) {
      throw err;
    }

  }

  
  //This function returns the rank of a particular course based on avg of attendance and course progress
  //The query has a hierarchy from:-
  //zuvyBootcamp->zuvyBatchEnrollments(It has all the students of that particular bootcamp along with attendance)
  //ZuvyBatchEnrollments has a relation with userInfo and bootcamp Tracking table(contains course Progress)
  async getLeaderBoardDetailByBootcamp(bootcampId:number,limit:number,offset:number)
  {
    try {
      const data = await db.query.zuvyBootcamps.findMany({
        where: (bootcamp, { eq }) => eq(bootcamp.id, bootcampId),
        with: {
          students: {
            columns: { attendance: true },
            where: (batchEnrolled,{sql}) => sql `${batchEnrolled.batchId} IS NOT NULL`,
            with: {
              userInfo: {
                columns: { id:true, name: true ,email:true},
              },
              userTracking: {
                columns: { progress: true, updatedAt: true },
                where: (track, { eq }) => eq(track.bootcampId, bootcampId)
              },
            }
          },
        },
      });
      const processedData = data.map(bootcamp => {
        const studentsWithAvg = bootcamp['students'].map(student => {
          if (student['userTracking'] == null) {
            student['userTracking'] = {};
        }
          student['userTracking']['progress'] = student['userTracking']['progress'] != null ? student['userTracking']['progress'] : 0;
          const progress =student['userTracking']['progress'];
          student['userTracking']['updatedAt'] = student['userTracking']['updatedAt'] != null ? student['userTracking']['updatedAt'] : new Date().toISOString();
          const attendance = student['attendance'] != null ?student['attendance']: 0;
          const averageScore = (attendance + progress) / 2;
          student['attendance'] = attendance;
          return {
            ...student,
            userInfo: {
              id:Number(student.userInfo.id),
              name:student.userInfo.name,
              email:student.userInfo.email,
              averageScore,
            },
          };
        }).sort((a, b) => {
          if (b.userInfo.averageScore === a.userInfo.averageScore) {
            return new Date(a.userTracking['updatedAt']).getTime() - new Date(b.userTracking.updatedAt).getTime();
          }
          return b.userInfo.averageScore - a.userInfo.averageScore;
        });
        const totalStudents = studentsWithAvg.length;
        const totalPages =!isNaN(limit) ? Math.ceil(totalStudents / limit) : 1;
        return {
          ...bootcamp,
          students: !isNaN(limit) && !isNaN(offset) ? studentsWithAvg.slice(offset, limit+offset) : studentsWithAvg,
          totalStudents,
          totalPages
        };
      });
      return processedData;
    }
    catch(err)
    {
         throw err;
=======
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
          totalStudents : totalStudentsCount.length
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
      return { message: 'Successfully save the Quiz.', data: [...InsertData, ...updateData]}; // Adjusted return value
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
      return {message: "Successfully save the open ended question.", data: [...insertData, ...updateData]};
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
}
