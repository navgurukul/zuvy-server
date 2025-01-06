import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql } from 'drizzle-orm';
import * as _ from 'lodash';
import { zuvyBatchEnrollments, zuvyChapterTracking, zuvyModuleChapter, zuvyOutsourseAssessments } from '../../../drizzle/schema';
import { STATUS_CODES } from 'src/helpers';

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
            totalSubmitedAssessments: submitedOutsourseAssessments.length,
            qualifiedStudents,
          },
        ];
      } else {
        result[moduleName].push({
          ...assessmentInfo,
          ...ModuleAssessment,
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

  async getAssessmentStudents(req, assessmentID:number,searchStudent:string) {
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
            ${searchStudent ? sql`
              AND EXISTS (
                SELECT 1
                FROM main.users
                WHERE main.users.id = ${submitedOutsourseAssessments.userId}
                AND (
                  lower(main.users.name) LIKE lower(${searchStudent + '%'})
                  OR lower(main.users.email) LIKE lower(${searchStudent + '%'})
                )
              )
            ` : sql``}
          `,
            with: {
              user: {
                columns: {
                  name: true,
                  email: true,
                }
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

  async getAssessmentsAndStudents(bootcampID: number): Promise<any> {
    try {  
      const assessments = await db.query.zuvyOutsourseAssessments.findMany({
        where: (zuvyOutsourseAssessments, { eq }) =>
          eq(zuvyOutsourseAssessments.bootcampId, bootcampID),
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
            },
            where: (submitedOutsourseAssessments, { sql }) => sql`
              ${submitedOutsourseAssessments.submitedAt} IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM main.zuvy_batch_enrollments
                WHERE main.zuvy_batch_enrollments.user_id = ${submitedOutsourseAssessments.userId}
                AND main.zuvy_batch_enrollments.bootcamp_id = ${bootcampID}
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
    
}
