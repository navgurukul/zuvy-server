import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, inArray, and, SQL } from 'drizzle-orm';
import { error, log } from 'console';
import {
  zuvyAssignmentSubmission,
  zuvyChapterTracking,
  zuvyModuleChapter,
  zuvyModuleQuiz,
  zuvyQuizTracking,
  zuvyModuleTracking,
  zuvyBootcampTracking,
  zuvyCourseModules,
  zuvyBatchEnrollments,
  zuvyProjectTracking,
  zuvyRecentBootcamp,
  zuvyPracticeCode,
  zuvyCodingQuestions,
  zuvyFormTracking,
  zuvyModuleForm
} from 'drizzle/schema';
import {
  SubmitBodyDto,
} from './dto/assignment.dto';
import { UpdateProjectDto } from './dto/project.dto';
import { SubmitFormBodyDto } from './dto/form.dto';
import { STATUS_CODES } from 'src/helpers';
import { helperVariable } from 'src/constants/helper';

// Difficulty Points Mapping
let { ACCEPTED, SUBMIT } = helperVariable;

@Injectable()
export class TrackingService {

  async updateChapterStatus(
    bootcampId: number,
    userId: number,
    moduleId: number,
    chapterId: number,
  ): Promise<any> {
    try {
      const chapterExistsInModuleChapter = await db
        .select()
        .from(zuvyModuleChapter)
        .where(
          sql`${zuvyModuleChapter.id} = ${chapterId} and ${zuvyModuleChapter.moduleId} = ${moduleId}`,
        );
      const chapterExistsInChapterTracking = await db
        .select()
        .from(zuvyChapterTracking)
        .where(
          sql`${zuvyChapterTracking.userId} = ${userId} and ${zuvyChapterTracking.chapterId} = ${chapterId} and ${zuvyChapterTracking.moduleId} = ${moduleId}`,
        );

      if (chapterExistsInModuleChapter.length != 0) {
        if (chapterExistsInChapterTracking.length == 0) {
          let chapterTracked;
          let insertChapterTracking:any = {
            userId: BigInt(userId),
            chapterId,
            moduleId,
            completedAt: sql`NOW()`,
          }
          chapterTracked = await db
            .insert(zuvyChapterTracking)
            .values(insertChapterTracking)
            .returning();

          const moduleTracking = await db
            .select()
            .from(zuvyModuleTracking)
            .where(
              sql`${zuvyModuleTracking.userId} = ${userId} and ${zuvyModuleTracking.bootcampId} = ${bootcampId} and ${zuvyModuleTracking.moduleId} = ${moduleId}`,
            );
          const totalModuleChapter = await db
            .select()
            .from(zuvyModuleChapter)
            .where(sql`${zuvyModuleChapter.moduleId} = ${moduleId}`);
          const completedModuleChapter = await db
            .select()
            .from(zuvyChapterTracking)
            .where(
              sql`${zuvyChapterTracking.moduleId} = ${moduleId} AND ${zuvyChapterTracking.userId} = ${userId}`,
            );
          let totalChapter = totalModuleChapter.length;
          let completedChapter = completedModuleChapter.length;
          let returnedTrackingData;
          if (moduleTracking.length == 0) {
            let InsertZuvyModuleTracking:any = {
              userId: BigInt(userId),
              bootcampId,
              moduleId,
              progress: Math.ceil((completedChapter / totalChapter) * 100),
              updatedAt: sql`NOW()`,
            }
            returnedTrackingData = await db
              .insert(zuvyModuleTracking)
              .values(InsertZuvyModuleTracking)
              .returning();
          } else {
            let UpdateZuvyModuleTracking:any = {
              progress: Math.ceil((completedChapter / totalChapter) * 100),
              updatedAt: sql`NOW()`,
            }
            returnedTrackingData = await db
              .update(zuvyModuleTracking)
              .set(UpdateZuvyModuleTracking)
              .where(eq(zuvyModuleTracking.id, moduleTracking[0].id))
              .returning();
          }
          const recentBootcampForUser = await db.select().from(zuvyRecentBootcamp).where(eq(zuvyRecentBootcamp.userId, BigInt(userId)));
          if (recentBootcampForUser.length == 0) {
            let insertRecentBootcamp:any = {
              userId: BigInt(userId),
              moduleId,
              progress: Math.ceil((completedChapter / totalChapter) * 100),
              bootcampId,
              chapterId: chapterTracked[0].chapterId,
              updatedAt: sql`NOW()`,
            }
            const updatedRecentBootcamp = await db
              .insert(zuvyRecentBootcamp)
              .values(insertRecentBootcamp)
          }
          else {
            let updatedRecentBootcamp:any = {
              moduleId,
              progress: Math.ceil((completedChapter / totalChapter) * 100),
              bootcampId,
              chapterId: chapterTracked[0].chapterId,
              updatedAt: sql`NOW()`,
            }
            await db
              .update(zuvyRecentBootcamp)
              .set(updatedRecentBootcamp)
              .where(eq(zuvyRecentBootcamp.userId, BigInt(userId)))
          }
          const totalModules = await db
            .select()
            .from(zuvyCourseModules)
            .where(eq(zuvyCourseModules.bootcampId, bootcampId));
          const projectModules = totalModules.filter((module) => module.typeId === 2);
          const projectModuleIds = projectModules.length > 0 ? projectModules.map((module) => module.id) : [];
          const completedProjectForAUser = projectModuleIds.length > 0 ? await db.select().from(zuvyModuleTracking).where(sql`${inArray(zuvyModuleTracking.moduleId, projectModuleIds)} and ${zuvyModuleTracking.userId} = ${userId}`) : [];
          const moduleIds = totalModules.map((module) => module.id);
          const allChapterTracking = await db
            .select()
            .from(zuvyChapterTracking)
            .where(
              sql`${inArray(zuvyChapterTracking.moduleId, moduleIds)} AND ${zuvyChapterTracking.userId} = ${userId}`,
            );
          const allChapters = await db
            .select()
            .from(zuvyModuleChapter)
            .where(sql`${inArray(zuvyModuleChapter.moduleId, moduleIds)}`);
          const userBootcampTracking = await db
            .select()
            .from(zuvyBootcampTracking)
            .where(
              sql`${zuvyBootcampTracking.userId} = ${userId} AND ${zuvyBootcampTracking.bootcampId} = ${bootcampId}`,
            );
          if (userBootcampTracking.length > 0) {
            const updatedBootcampProgress = await db
              .update(zuvyBootcampTracking)
              .set({
                progress: Math.ceil(
                  (allChapterTracking.length + completedProjectForAUser.length) / (allChapters.length + projectModules.length) * 100,
                ),
                updatedAt: sql`NOW()`,
              })
              .where(
                sql`${zuvyBootcampTracking.userId} = ${userId} AND ${zuvyBootcampTracking.bootcampId} = ${userBootcampTracking[0].bootcampId}`
              ).returning();
          } else {
            const updatedBootcampProgress = await db
              .insert(zuvyBootcampTracking)
              .values({
                userId,
                bootcampId,
                progress: Math.ceil(
                  (allChapterTracking.length + completedProjectForAUser.length) / (allChapters.length + projectModules.length) * 100,
                ),
                updatedAt: sql`NOW()`,
              }).returning();
          }

          return {
            status: 'success',
            message: 'Your progress has been updated successfully',
          };
        } else {
          return [
            {
              status: 'error',
              message: 'Status of Chapter is already Updated',
            },
          ];
        }
      } else {
        return [
          {
            status: 'error',
            message: 'Chapter does not exist',
          },
        ];
      }
    } catch (err) {
      throw err;
    }
  }

  async getAllChapterWithStatus(moduleId: number, userId: number) {
    try {
      const moduleDetails = await db
        .select()
        .from(zuvyCourseModules)
        .where(eq(zuvyCourseModules.id, moduleId));
      if (moduleDetails.length > 0) {
        const trackingData = await db.query.zuvyModuleChapter.findMany({
          where: (moduleChapter, { eq }) =>
            eq(moduleChapter.moduleId, moduleId),
          orderBy: (moduleChapter, { asc }) => asc(moduleChapter.order),
          columns: {
            id: true,
            title: true,
            topicId: true,
          },
          with: {
            chapterTrackingDetails: {
              columns: {
                id: true,
              },
              where: (chapterTracking, { eq }) =>
                eq(chapterTracking.userId, BigInt(userId)),
            },
          },
        });

        trackingData.forEach((chapter) => {
          chapter['status'] =
            chapter['chapterTrackingDetails'].length > 0
              ? 'Completed'
              : 'Pending';
        });

        return {
          status: 'success',
          code: 200,
          trackingData,
          moduleDetails,
        };
      } else {
        return {
          status: 'error',
          code: 404,
          message: 'No module found',
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async updateQuizAndAssignmentStatus(
    userId: number,
    moduleId: number,
    chapterId: number,
    bootcampId: number,
    SubmitBody: SubmitBodyDto,
  ): Promise<any> {
    try {
      let result;
      if (SubmitBody.submitAssignment != undefined) {
        let updatedAssignmentBody:any = {
          userId,
          moduleId,
          chapterId,
          bootcampId,
          ...SubmitBody.submitAssignment,
          updatedAt: sql`Now()`,
        }
        result = await db
          .insert(zuvyAssignmentSubmission)
          .values(updatedAssignmentBody)
          .returning();
      } else if (SubmitBody.submitQuiz != undefined) {
        SubmitBody.submitQuiz.sort((a, b) => a.mcqId - b.mcqId);
        const mcqIdArray = SubmitBody.submitQuiz.map((obj) => obj.mcqId);
        const choosenOptions = SubmitBody.submitQuiz.map(
          (obj) => obj.chossenOption,
        );
        const questions = await db
          .select({ correctOption: zuvyModuleQuiz.correctOption })
          .from(zuvyModuleQuiz)
          .where(sql`${inArray(zuvyModuleQuiz.id, mcqIdArray)}`)
          .orderBy(zuvyModuleQuiz.id);
        let updatedQuizBody = [];
        for (let i = 0; i < questions.length; i++) {
          let status = 'fail';
          if (choosenOptions[i] == questions[i].correctOption) {
            status = 'pass';
          }
          updatedQuizBody[i] = {
            userId,
            moduleId,
            chapterId,
            status,
            chosenOption:choosenOptions[i],
            ...SubmitBody.submitQuiz[i],
            attemptCount: 1,
            updatedAt: sql`Now()`,
          };
        }
        result = await db
          .insert(zuvyQuizTracking)
          .values(updatedQuizBody)
          .returning();
      }
      return result;
    } catch (err) {
      throw err;
    }
  }

  async getAllModuleByBootcampIdForStudent(bootcampId: number, userId: number) {
    try {
      const data = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq }) =>
          eq(courseModules.bootcampId, bootcampId),
        orderBy: (courseModules, { asc }) => asc(courseModules.order),
        with: {
          moduleChapterData: {
            columns: {
              topicId:true,
              order:true
            },
            orderBy: (courseChapters, { asc }) => asc(courseChapters.order),
              with: {
                chapterTrackingDetails: {
                  columns: {
                    id: true,
                  },
                  where: (chapterTracking, { eq }) =>
                    eq(chapterTracking.userId, BigInt(userId)),
                },
              }
          },
          projectData: true,
          moduleTracking: {
            columns: {
              id:true,
              progress: true,
            },
            where: (moduleTrack, { eq }) => eq(moduleTrack.userId, userId),
          },
        },
      });
      
      const result = data.map((module: any) => {
        if (module.typeId == 2) {
          return null;
        }
        const totalChapters = module['moduleChapterData'].length;
        const completedChapters = module.moduleChapterData.filter(chapter => chapter['chapterTrackingDetails'].length > 0).length;
        const calculatedProgress = Math.ceil((completedChapters / totalChapters) * 100);
        if (module.moduleTracking.length > 0 && calculatedProgress !== module.moduleTracking[0].progress) {
          return {
            id: module.moduleTracking[0].id,
            progress: calculatedProgress,
            moduleId:module.id
          };
        }
        return null;
      })
      .filter(module => module !== null);
      let modules = data.map((module: any) => {
        const moduleFound = result.find(obj => obj.moduleId === module.id);
        let updatedProgress = module['moduleTracking'].length != 0
        ? module['moduleTracking'][0]['progress']
        : 0;
        if(moduleFound)
          {
            updatedProgress = moduleFound.progress
            delete moduleFound.moduleId;
          }
        return {
          id: module.id,
          name:
            module['projectData'].length > 0
              ? module['projectData'][0]['title']
              : module.name,
          description: module.description,
          typeId: module.typeId,
          order: module.order,
          projectId: module.projectId,
          isLock: module.isLock,
          timeAlloted: module.timeAlloted,
          progress:updatedProgress,
          quizCount: module.moduleChapterData.filter(
            (chapter) => chapter.topicId === 4,
          ).length,
          assignmentCount: module.moduleChapterData.filter(
            (chapter) => chapter.topicId === 5,
          ).length,
          codingProblemsCount: module.moduleChapterData.filter(
            (chapter) => chapter.topicId === 3,
          ).length,
          articlesCount: module.moduleChapterData.filter(
            (chapter) => chapter.topicId === 2,
          ).length,
          formCount: module.moduleChapterData.filter(
            (chapter) => chapter.topicId === 7,
          ).length,
        };
      });

      if (result.length > 0) {
       
       const sqlChunks: SQL[] = [];
       const ids: number[] = [];
       
       sqlChunks.push(sql`(case`);
       
       for (const input of result) {
        sqlChunks.push(sql`when ${zuvyModuleTracking.id} = ${input.id} then ${sql.raw(`CAST(${input.progress} AS INTEGER)`)}`);
        ids.push(input.id);
       }
       
       sqlChunks.push(sql`end)`);
       
       const finalSql: SQL = sql.join(sqlChunks, sql.raw(' '));
       let updateProgress:any = { progress: finalSql}

       await db.update(zuvyModuleTracking).set(updateProgress)
         .where(sql`${inArray(zuvyModuleTracking.id, ids)}`);
      } 
      if (modules.length > 0) {
        for (let i = 1; i < modules.length; i++) {
          if (modules[i - 1].progress == 100 && modules[i].isLock == false) {
            modules[i].isLock = false;
          }
          else if(modules[i-1].progress < 100 && modules[i-1].progress > 0 && modules[i].progress > 0)
            {
              modules[i].isLock = false;
            } 
          else {
            modules[i].isLock = true;
          }
        }
      }

      return modules;
    } catch (err) {
      error(err);
      return [];
    }
  }

  async getBootcampTrackingForAUser(bootcampId: number, userId: number) {
    try {
      const moduleDetails = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq }) =>
          eq(courseModules.bootcampId, bootcampId),
        with: {
          moduleChapterData: true
        },
      });
      const totalLength = moduleDetails.reduce((accumulator, currentObj) => {
        return accumulator + currentObj['moduleChapterData'].length;
      }, 0);
      const projectModules = moduleDetails.filter((module) => module.typeId === 2);
      const projectModuleIds = projectModules.length > 0 ? projectModules.map((module) => module.id) : [];
      const completedProjectForAUser = projectModuleIds.length > 0 ? await db.select().from(zuvyModuleTracking).where(sql`${inArray(zuvyModuleTracking.moduleId, projectModuleIds)} and ${zuvyModuleTracking.userId} = ${userId}`) : [];
      const moduleIds = moduleDetails.map((module) => module.id);
      const allChapterTracking = moduleIds.length > 0 ? await db
        .select()
        .from(zuvyChapterTracking)
        .where(
          sql`${inArray(zuvyChapterTracking.moduleId, moduleIds)} AND ${zuvyChapterTracking.userId} = ${userId}`,
        ) : [];
      const allChapters = moduleIds.length > 0 ? totalLength : [];
      let initialProgress = 0;
      if (allChapters != 0 || projectModules.length != 0) {
        initialProgress = Math.ceil(
          (allChapterTracking.length + completedProjectForAUser.length) / (allChapters + projectModules.length) * 100,
        )
      }
      const userBootcampTracking = await db
        .select()
        .from(zuvyBootcampTracking)
        .where(
          sql`${zuvyBootcampTracking.userId} = ${userId} AND ${zuvyBootcampTracking.bootcampId} = ${bootcampId}`,
        );
      if (userBootcampTracking.length > 0) {
        const updatedBootcampProgress = await db
          .update(zuvyBootcampTracking)
          .set({
            progress: initialProgress,
          })
          .where(
            sql`${zuvyBootcampTracking.userId} = ${userId} AND ${zuvyBootcampTracking.bootcampId} = ${userBootcampTracking[0].bootcampId}`
          ).returning();
      } else {
        const updatedBootcampProgress = await db
          .insert(zuvyBootcampTracking)
          .values({
            userId,
            bootcampId,
            progress: initialProgress
          }).returning();
      }
      const data = await db.query.zuvyBootcampTracking.findFirst({
        where: (bootcampTracking, { sql }) =>
          sql`${bootcampTracking.bootcampId} = ${bootcampId} AND ${bootcampTracking.userId} = ${userId}`,
        with: {
          bootcampTracking: true,
        },
      });
      const batchDetails = await db.query.zuvyBatchEnrollments.findFirst({
        where: (batchEnroll, { sql }) =>
          sql`${batchEnroll.userId} = ${BigInt(userId)} AND ${batchEnroll.bootcampId} = ${bootcampId}`,
        with: {
          batchInfo: {
            with: {
              instructorDetails: {
                columns: {
                  id: true,
                  name: true,
                  profilePicture: true
                }
              }
            }
          }
        },
      });
      let instructorDetails = {}
      if (batchDetails['batchInfo'] != null) {
        instructorDetails = {
          instructorId: Number(batchDetails['batchInfo']['instructorDetails']['id']),
          instructorName: batchDetails['batchInfo']['instructorDetails']['name'],
          instructorProfilePicture: batchDetails['batchInfo']['instructorDetails']['profilePicture']
        }
      }
      return {
        status: 'success',
        message: 'Bootcamp progress fetched successfully',
        data,
        instructorDetails
      };
    } catch (err) {
      throw err;
    }
  }

  async getPendingAssignmentForStudent(bootcampId: number, userId: number) {
    try {
      const pendingModules = await db
        .select()
        .from(zuvyModuleTracking)
        .where(
          sql`${zuvyModuleTracking.bootcampId} = ${bootcampId} and ${zuvyModuleTracking.userId} = ${userId} and ${zuvyModuleTracking.progress} < 100`,
        );
      const moduleIds = pendingModules.map((obj) => obj.moduleId);
      if (pendingModules.length > 0) {
        const data = await db.query.zuvyModuleChapter.findMany({
          where: (moduleChapter, { sql }) =>
            and(
              sql`${inArray(moduleChapter.moduleId, moduleIds)}`,
              eq(moduleChapter.topicId, 5),
            ),
          with: {
            chapterTrackingDetails: {
              columns: {
                id: true,
              },
              where: (chapterTracking, { eq }) =>
                eq(chapterTracking.userId, BigInt(userId)),
            },
          },
        });
        const pendingAssignment = data.filter(
          (obj) => obj['chapterTrackingDetails'].length === 0,
        );
        return pendingAssignment;
      }
    } catch (err) {
      throw err;
    }
  }

  async getAllUpcomingSubmission(userId: number,bootcampId:number):Promise<any>
  {
    try {
      const data = await db.query.zuvyBatchEnrollments.findMany({
        where: (zuvybatchenrollment, { eq, and }) => {
          const conditions = [eq(zuvybatchenrollment.userId, BigInt(userId))];
          if (bootcampId) {
            conditions.push(eq(zuvybatchenrollment.bootcampId, bootcampId));
          }
          return and(...conditions);
        },
        with: {
          bootcamp : {
            columns : {
              id:true,
              name:true
            },
            with : {
              bootcampModules : {
                columns : {
                  id:true,
                  name: true
                },
                with : {
                  moduleTracking : {
                    where: (moduleTracked, { sql }) =>
                      sql`${moduleTracked.userId} = ${userId} and ${moduleTracked.progress} < 100`,
                    columns : {
                      id: true,
                      progress:true
                    },
                    with : {
                      chapterDetailss : {
                        columns:{
                          id:true,
                          title:true,
                          completionDate:true
                        },
                        where: (moduleChapter, { eq }) =>
                          eq(moduleChapter.topicId,5)
                     } 
                    }
                   }
                 }
               }
             }
          }
        }
      })
      const chapterIds = [];
      var upcomingAssignments = [];
      var lateAssignments = [];
      if(data.length > 0)
        {
      data.forEach(item => {
       item['bootcamp']['bootcampModules'].forEach(module => {
         if (module['moduleTracking'].length > 0) {
         module['moduleTracking'].forEach(tracking => {
         if (tracking['chapterDetailss'].length > 0) {
          tracking['chapterDetailss'].forEach(chapter => {
            chapterIds.push(chapter.id);
               });
             }
          });
          }
        });
      });
      if(chapterIds.length > 0)
        {
      const completedChapterIds = await db.select({ id: zuvyChapterTracking.chapterId })
       .from(zuvyChapterTracking)
        .where( and( inArray(zuvyChapterTracking.chapterId, chapterIds), eq(zuvyChapterTracking.userId, BigInt(userId)) ) );
 
        const completedChapterIdsSet = new Set(completedChapterIds.map(chapter => chapter.id));

        const todayISOString = Date.now();
        data.forEach(item => {
          item['bootcamp']['bootcampModules'].forEach(module => {
            if (module['moduleTracking'].length > 0) {
              module['moduleTracking'].forEach(tracking => {
                if (tracking['chapterDetailss'].length > 0) {
                  tracking['chapterDetailss'].forEach(chapter => {
                    if (!completedChapterIdsSet.has(chapter.id)) {
                      const completionDateISOString = new Date(chapter.completionDate).getTime();
                      const chapterInfo = {
                        bootcampName: item['bootcamp'].name,
                        bootcampId: item['bootcamp'].id,
                        moduleName: module.name,
                        moduleId: module.id,
                        chapterId: chapter.id,
                        chapterTitle: chapter.title,
                        chapterDeadline: chapter.completionDate
                      };
                      if (completionDateISOString > todayISOString) {
                        upcomingAssignments.push(chapterInfo);
                      } else {
                        lateAssignments.push(chapterInfo);
                      }
                    }
                  });
                }
              });
            }
          });
        });
       }
       else {
        return [{message:'No content found', statusCode: STATUS_CODES.NO_CONTENT},null]
       }
      }
      else {
        return [{message:'No content found', statusCode: STATUS_CODES.NO_CONTENT},null]
      }
      
      return [null,{message:'Upcoming submission fetched successfully',statusCode: STATUS_CODES.OK,data:{upcomingAssignments,lateAssignments}}]
    }
    catch(error)
    {
      return [{message:error.message, statusCode: STATUS_CODES.BAD_REQUEST},null]
    }
  }

  async getChapterDetailsWithStatus(chapterId: number, userId: number) {
    try {

      const trackingData = await db.query.zuvyModuleChapter.findFirst({
        where: (moduleChapter, { eq }) => eq(moduleChapter.id, chapterId),
        orderBy: (moduleChapter, { asc }) => asc(moduleChapter.order),
        with: {

          chapterTrackingDetails: {
            columns: {
              id: true,
            },
            where: (chapterTracking, { eq }) =>
              eq(chapterTracking.userId, BigInt(userId)),
          },
        },
      });

      trackingData['status'] =
        trackingData['chapterTrackingDetails'].length > 0
          ? 'Completed'
          : 'Pending';

      return {
        status: 'success',
        code: 200,
        trackingData,
      };
    } catch (err) {
      throw err;
    }
  }

  async getAllQuizAndAssignmentWithStatus(
    userId: number,
    moduleId: number,
    chapterId: number,
  ) {
    try {
      const chapterDetails = await db
        .select()
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.id, chapterId));
      const AssignmentTracking = await db
        .select()
        .from(zuvyAssignmentSubmission)
        .where(sql`${zuvyAssignmentSubmission.userId} = ${userId} and ${zuvyAssignmentSubmission.chapterId} = ${chapterId} and ${zuvyAssignmentSubmission.moduleId} = ${moduleId} `);

      const QuizTracking = await db
        .select()
        .from(zuvyQuizTracking)
        .where(sql`${zuvyQuizTracking.userId} = ${userId} and ${zuvyQuizTracking.chapterId} = ${chapterId} and ${zuvyQuizTracking.moduleId} = ${moduleId}`);

      const codingQuestionTracking = await db
        .select()
        .from(zuvyPracticeCode)
        .where(sql`${zuvyPracticeCode.userId} = ${userId}`);

      if (chapterDetails.length > 0) {
        if (chapterDetails[0].topicId == 4) {
          if (chapterDetails[0].quizQuestions !== null) {
            if (QuizTracking.length == 0) {
              const questions = await db
                .select({
                  id: zuvyModuleQuiz.id,
                  question: zuvyModuleQuiz.question,
                  options: zuvyModuleQuiz.options,
                })
                .from(zuvyModuleQuiz)
                .where(
                  sql`${inArray(zuvyModuleQuiz.id, Object.values(chapterDetails[0].quizQuestions))}`,
                );
              questions['status'] =
                QuizTracking.length != 0
                  ? 'Completed'
                  : 'Pending';

              return [{
                questions
              }]

            }
            else {
              const trackedData = await db.query.zuvyModuleQuiz.findMany({
                where: (moduleQuiz, { sql }) => sql`${inArray(moduleQuiz.id, Object.values(chapterDetails[0].quizQuestions))}`,
                with: {

                  quizTrackingData: {
                    columns: {
                      chosenOption: true,
                      status: true
                    },
                    where: (quizTracking, { sql }) => sql`${quizTracking.userId} = ${userId} and ${quizTracking.chapterId} = ${chapterId} and ${quizTracking.moduleId} = ${moduleId}`,
                  }
                }
              });

              trackedData['status'] =
                QuizTracking.length != 0
                  ? 'Completed'
                  : 'Pending';

              return {
                status: "success",
                code: 200,
                trackedData
              }
            }
          }
        }

        else if (chapterDetails[0].topicId == 5) {
          if (AssignmentTracking.length != 0) {
            return [{
              status: 'success',
              code: 200,
              AssignmentTracking,
            }]
          } else {
            return 'No Assignment found';
          }
        }
        else if (chapterDetails[0].topicId == 3) {
          if (chapterDetails[0].codingQuestions !== null) {
            if (codingQuestionTracking.length == 0) {
              const codingProblemDetails = await db
                .select({
                  title: zuvyCodingQuestions.title,
                  description: zuvyCodingQuestions.description,
                })
                .from(zuvyCodingQuestions)
                .where(
                  eq(
                    zuvyCodingQuestions.id,
                    chapterDetails[0].codingQuestions,
                  ),
                )
              codingProblemDetails['status'] =
                codingQuestionTracking.length != 0
                  ? 'Completed'
                  : 'Pending';

              return [{
                codingProblemDetails,
              }]
            }
            else {
              const codingProblemSubmitted = await db
                .select()
                .from(zuvyCodingQuestions)
                .where(
                  eq(
                    zuvyCodingQuestions.id,
                    chapterDetails[0].codingQuestions,
                  ),
                )
              codingProblemSubmitted['status'] =
                codingQuestionTracking.length != 0
                  ? 'Completed'
                  : 'Pending';

              return [{
                codingProblemSubmitted,
              }]
            }

          } else {
            return 'No coding Problem found';
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
      }
      else {
        return 'No Chapter found';
      }
    } catch (err) {
      throw err;
    }
  }

  async getQuizAndAssignmentWithStatus(
    userId: number,
    chapterId: number,
  ):Promise<any>
   {
    try {
       const chapter = await db.select().from(zuvyModuleChapter).where(eq(zuvyModuleChapter.id,chapterId));
       if(chapter.length > 0)
        {
          if(chapter[0].topicId == 4)
            {
              if(chapter[0].quizQuestions !== null)
                {
                  const trackedData = await db.query.zuvyModuleQuiz.findMany({
                    where: (moduleQuiz, { sql }) => sql`${inArray(moduleQuiz.id, Object.values(chapter[0].quizQuestions))}`,
                    orderBy: (moduleQuiz, { asc }) => asc(moduleQuiz.id),
                    with: {
    
                      quizTrackingData: {
                        columns: {
                          chosenOption: true,
                          status: true
                        },
                        where: (quizTracking, { sql }) => sql`${quizTracking.userId} = ${userId} and ${quizTracking.chapterId} = ${chapterId}`,
                      }
                    }
                  });
                  const quizQuestionsLength = Object.values(chapter[0].quizQuestions).length;
                  const quizQuestionsWithTrackingData = trackedData.filter(quiz => quiz['quizTrackingData'].length > 0).length;

                  const allQuestionsHaveTrackingData = quizQuestionsLength === quizQuestionsWithTrackingData;
                  const status = allQuestionsHaveTrackingData ? 'Completed' : 'Pending';
                  return [null,{message:'Chapter details fetched successfully',statusCode: STATUS_CODES.OK,data:{chapterTitle:chapter[0].title,chapterId:chapter[0].id,chapterOrder:chapter[0].order,quizDetails:trackedData,status}}]
                }
              else {
                return [null,{message:'No quiz questions found in this quiz chapter',statusCode: STATUS_CODES.OK,data:{chapterTitle:chapter[0].title,chapterId:chapter[0].id,chapterOrder:chapter[0].order,quizDetails: [],status:'Pending'}}]
              }  
            }
            else if(chapter[0].topicId == 5)
              {
                const assignmentTracking = await db
               .select()
               .from(zuvyAssignmentSubmission)
               .where(sql`${zuvyAssignmentSubmission.userId} = ${userId}
                AND ${zuvyAssignmentSubmission.chapterId} = ${chapterId}`);

                const status = assignmentTracking.length > 0 ? 'Completed' : 'Pending';

                return [null,{message:'Assignment chapter fetched succesfully',statusCode: STATUS_CODES.OK,data:{chapterDetails:chapter[0],assignmentTracking,status}}]
              }
              else if(chapter[0].topicId == 3)
                {
                  const ChapterTracking = await db
                   .select()
                   .from(zuvyChapterTracking)
                   .where(sql`${zuvyChapterTracking.userId} = ${userId} and ${zuvyChapterTracking.chapterId} = ${chapterId}`);
                   const status = ChapterTracking.length > 0 ? 'Completed' : 'Pending';
                   const codingProblem = await db
                      .select()
                      .from(zuvyCodingQuestions)
                      .where(
                        eq(
                          zuvyCodingQuestions.id,
                          chapter[0].codingQuestions,
                        ),
                      )
                  if(chapter[0].codingQuestions != null && codingProblem.length > 0)
                    {
                      return [null,{message:'Coding chapter fetched succesfully',statusCode: STATUS_CODES.OK,data:{chapterDetails:chapter[0],codingProblem,status}}]
                    } 
                    else {
                      return [null,{message:'There is no coding question in this chapter',statusCode: STATUS_CODES.OK,data:null}]
                    }
                }
              else {
                return [null,{message:'It is not a quiz or assignment chapter',statusCode: STATUS_CODES.OK,data:null}]
              }
        }
        else {
          return [null,{message:'No chapter found',statusCode: STATUS_CODES.OK,data:null}]
        }
    }catch(error)
    {
      return [{message:error.message,statusCode: STATUS_CODES.BAD_REQUEST}]
    }
  }

  async submitProjectForAUser(
    userId: number,
    bootcampId: number,
    moduleId: number,
    projectId: number,
    projectBody: UpdateProjectDto
  ) {
    try {
      const projectTrackingForUser = await db
        .select()
        .from(zuvyProjectTracking)
        .where(
          sql`${zuvyProjectTracking.userId}=${userId} and ${zuvyProjectTracking.projectId}=${projectId} and ${zuvyProjectTracking.moduleId} =${moduleId} and ${zuvyProjectTracking.bootcampId} = ${bootcampId}`,
        );
      let updatedBody = { bootcampId, moduleId, projectId, userId, ...projectBody, updatedAt: sql`NOW()` }
      if (projectTrackingForUser.length > 0) {
        let updateProject = await db.update(zuvyProjectTracking).set(updatedBody).where(eq(zuvyProjectTracking.id, projectTrackingForUser[0].id)).returning();
        if (updateProject.length > 0) {
          return {
            status: 'success',
            code: 200,
            message: 'Your project has been submitted and course progress has been updated successfully',
            updateProject
          }
        }
        else {
          return {
            status: 'error',
            code: 400,
            message: 'There is some error while submitting your project.Try again'
          }
        }
      }
      else {
        const recentBootcampForUser = await db.select().from(zuvyRecentBootcamp).where(eq(zuvyRecentBootcamp.userId, BigInt(userId)));
        const moduleTrackingBody = { userId, moduleId, bootcampId, progress: 100, createdAt: sql`NOW()`, updatedAt: sql`NOW()` }
        const projectTracked = await db.insert(zuvyProjectTracking).values(updatedBody).returning();
        const moduleTracked = await db.insert(zuvyModuleTracking).values(moduleTrackingBody).returning();
        if (recentBootcampForUser.length == 0) {
          let updatedRecentBootcamp:any = {
            userId: BigInt(userId),
            moduleId,
            progress: 100,
            bootcampId,
            updatedAt: sql`NOW()`,
          }
          await db
            .insert(zuvyRecentBootcamp)
            .values(updatedRecentBootcamp)
        }
        else {
          let UpdatedRecentBootcamp:any = {
            moduleId,
            progress: 100,
            bootcampId,
            chapterId: null,
            updatedAt: sql`NOW()`,
          }
          const updatedRecentBootcamp = await db
            .update(zuvyRecentBootcamp)
            .set(UpdatedRecentBootcamp)
            .where(eq(zuvyRecentBootcamp.userId, BigInt(userId)))
        }
        if (projectTracked.length > 0 && moduleTracked.length > 0) {
          return {
            status: 'success',
            code: 200,
            message: 'Your project has been submitted and course progress has been updated successfully',
            projectTracked
          }
        }
        else {
          return {
            status: 'error',
            code: 400,
            message: 'There is some error while submitting your project.Try again'
          }
        }
      }
    } catch (err) { }
  }

  async getProjectDetailsWithStatus(projectId: number, moduleId: number, userId: number):Promise<any> {
    try {
      const data = await db.query.zuvyCourseModules.findFirst({
        where: (courseModules, { eq }) =>
          eq(courseModules.id, moduleId),
        with: {
          projectData: {
            where: (projectDetails, { eq }) =>
              eq(projectDetails.id, projectId),
            with: {
              projectTrackingData: {
                columns: {
                  projectLink:true,
                  isChecked:true,
                  grades:true,
                  updatedAt:true
                },
                where: (projectTrack, { eq }) => eq(projectTrack.userId, userId)
              }
            }
          },
          moduleTracking: {
            columns: {
              progress: true,
            },
            where: (moduleTrack, { eq }) => eq(moduleTrack.userId, userId),
          },
        },
      });
      const projectDetails = {
        moduleId: data.id,
        bootcampId: data.bootcampId,
        typeId: data.typeId,
        projectData: data['projectData'],
        status: data['moduleTracking'].length > 0 ? 'Completed' : 'Pending'
      }
      return [null,{message:'Project details successfully fetched',statusCode: STATUS_CODES.OK,data:projectDetails}]
    } catch (err) {
      return [{message:err.message,statusCode: STATUS_CODES.BAD_REQUEST}]
    }
  }

  async allBootcampProgressForStudents(userId: number) {
    try {
      const data = await db.query.zuvyBatchEnrollments.findMany({
        columns: {
          bootcampId: true
        },
        where: (batchEnroll, { eq }) =>
          eq(batchEnroll.userId, BigInt(userId)),
        with: {
          bootcamp: {
            columns: {
              id: true,
              name: true,
              coverImage: true
            },
            with: {
              bootcampTracking: {
                where: (bootcampTrack, { eq }) =>
                  eq(bootcampTrack.userId, userId)
              }
            }
          }
        },
      });

      return data;
    }
    catch (err) {
      throw err;
    }
  }

  async getLatestUpdatedCourseForStudents(userId: number):Promise<any> {
    try {
      const latestTracking = await db.select().from(zuvyRecentBootcamp)
        .where(eq(zuvyRecentBootcamp.userId, BigInt(userId)));  
      if (latestTracking.length > 0) {
        const ifEnrolled = await db.select().from(zuvyBatchEnrollments).where(sql`${zuvyBatchEnrollments.bootcampId} = ${latestTracking[0].bootcampId} AND ${zuvyBatchEnrollments.userId} = ${BigInt(userId)}`);
        if(ifEnrolled.length == 0)
          {
            return [null,{message:'You have been removed from the recent course that you are studying.Please ask your instructor about this!!',statusCode: STATUS_CODES.OK,data:[]}]
          }
          const data = await db.query.zuvyCourseModules.findFirst({
            where: (courseModules, { sql }) =>
              sql`${courseModules.id} = ${latestTracking[0].moduleId} and ${courseModules.bootcampId} = ${latestTracking[0].bootcampId}`,
            with: {
              moduleData: true,
              moduleChapterData: {
                columns: {
                  id: true,
                  title: true,
                  topicId: true
                },
                orderBy: (moduleChapter, { asc }) => asc(moduleChapter.order),
                with: {
                  chapterTrackingDetails: {
                    columns: {
                      id: true,
                    },
                    where: (chapterTracking, { eq }) =>
                      eq(chapterTracking.userId, BigInt(userId)),
                  }
                }
              },
            },
          });  
          
          const chapters = data['moduleChapterData'];
          let progress = latestTracking[0].progress;
          const incompleteChaptersCount = chapters.filter(chapter => chapter['chapterTrackingDetails'].length === 0).length;
          const chaptersCompleted = chapters.length - incompleteChaptersCount;
          if(progress == 100 && incompleteChaptersCount > 0)
            {
              let UpdateProgress:any = { progress: Math.ceil((chaptersCompleted/chapters.length)*100) }
              const updatedRecentCourse = await db.update(zuvyRecentBootcamp)
               .set(UpdateProgress)
               .where(eq(zuvyRecentBootcamp.userId, BigInt(userId))).returning(); 
              if(updatedRecentCourse.length == 0)
                {
                  return [null,{message:'There was some error',statusCode: STATUS_CODES.OK,data:[]}] 
                }
            }
        if (progress < 100) {
          const currentIndex = chapters.findIndex(obj => obj.id === latestTracking[0].chapterId)
          let newChapter = null;
          for (let i = currentIndex + 1; i < chapters.length; i++) {
            if (chapters[i]['chapterTrackingDetails'].length === 0) {
                newChapter = chapters[i];
                break;
                }
             }
           if (!newChapter) {
               newChapter = chapters.find(chapter => chapter['chapterTrackingDetails'].length === 0);
              } 
          return [null,{message:'Your latest updated course',statusCode: STATUS_CODES.OK,data:{moduleId: data.id,
            moduleName: data.name,
            typeId: data.typeId,
            bootcampId: data.bootcampId,
            bootcampName: data['moduleData'].name,
            newChapter}}]
        }
        else {
          const moduleInfo = await db.select().from(zuvyCourseModules).where(eq(zuvyCourseModules.id, latestTracking[0].moduleId))
          const data = await db.query.zuvyCourseModules.findFirst({
            columns: {
              id: true,
              typeId: true,
              name: true
            },
            where: (courseModules, { sql }) =>
              sql`${courseModules.order} = ${moduleInfo[0].order + 1} and ${courseModules.bootcampId} = ${latestTracking[0].bootcampId}`,
            with: {
              moduleData: {
                columns: {
                  id: true,
                  name: true
                }
              },
              moduleChapterData: {
                columns: {
                  id: true,
                  title: true,
                  topicId: true
                },
                where: (chapterDetails, { sql }) =>
                  sql`${chapterDetails.order} = 1`,
              },
              projectData: true,
            },
          });
          if (data) {
            return [null,{message:'Your latest updated course',statusCode: STATUS_CODES.OK,data:{ moduleId: data.id,
              moduleName:  data['projectData'].length == 0 ? data.name : data['projectData'][0]['title'],
              typeId: data.typeId,
              bootcampId: data['moduleData'].id,
              bootcampName: data['moduleData'].name,
              newChapter: data.typeId == 1 ? (data['moduleChapterData'].length > 0 ? data['moduleChapterData'][0] : 'There is no chapter in the module') : data['projectData'][0]}}]
            
          }
          else {
            return [null,{message:'Start a course',statusCode: STATUS_CODES.OK,data:[]}]  

          }
        }
      }
      else {
        return [null,{message:'You have not yet started any course module',statusCode: STATUS_CODES.OK,data:[]}]
      }
    }
    catch (err) {
      return [{message:err.message,statusCode: STATUS_CODES.BAD_REQUEST}]
    }
  }

  async formatedChapterDetails(chapterDetails: any) {
    try {
      chapterDetails.Quizzes = chapterDetails?.Quizzes.map((Quizzes) => {
        let quizDetails = { ...Quizzes.Quiz, }
        delete Quizzes.Quiz
        return { ...Quizzes, ...quizDetails }
      })

      chapterDetails.OpenEndedQuestions = chapterDetails?.OpenEndedQuestions.map((OpenEndedQuestions) => {
        let openEndedDetails = { ...OpenEndedQuestions.OpenEndedQuestion, }
        delete OpenEndedQuestions.OpenEndedQuestion
        return { ...OpenEndedQuestions, ...openEndedDetails }
      })

      chapterDetails.CodingQuestions = chapterDetails?.CodingQuestions.map((CodingQuestions) => {
        let codingDetails = { ...CodingQuestions.CodingQuestion, }
        delete CodingQuestions.CodingQuestion
        return { ...CodingQuestions, ...codingDetails }
      })

      return chapterDetails
    } catch (err) {
      throw err;
    }
  }


  async getAssessmentSubmission(assessmentSubmissionId: number, userId: number) {
    try {
      const data: any = await db.query.zuvyAssessmentSubmission.findFirst({
        where: (zuvyAssessmentSubmission, { eq }) =>
          eq(zuvyAssessmentSubmission.id, assessmentSubmissionId),
        with: {
          user: {
            columns: {
              email: true,
              name: true
            }
          },
          submitedOutsourseAssessment: true,
          PracticeCode: {
            where: (zuvyPracticeCode, { eq,and, or, ne}) =>  and(
              eq(zuvyPracticeCode.userId, userId),
            ),
            columns: {
              id: true,
              questionSolved: true,
              questionId: true,
              status: true,
              action: true,
              token: true,
              createdAt: true,
              codingOutsourseId: true,
              sourceCode: true
            },
            distinct: [zuvyPracticeCode.questionId],
            with: {
              questionDetail: true
            },
          }
        }
      });
      if (data == undefined || data.length == 0) {
        throw ({
          status: 'error',
          statusCode: 404,
          message: 'Assessment not found',
        });
      }
      if (data.submitedAt == null) {
        throw ({
          status: 'error',
          statusCode: 400,
          message: 'Assessment not submitted yet',
        });
      }
      const filteredData = data.PracticeCode.reduce((acc, curr) => {
        const existing = acc.find(item => item.questionId === curr.questionId);
        
        if (!existing) {
          acc.push(curr);
        } else if (curr.status === "Accepted") {
          acc = acc.filter(item => item.questionId !== curr.questionId);
          acc.push(curr);
        } else if (existing.status !== "Accepted" && curr.createdAt > existing.createdAt) {
          acc = acc.filter(item => item.questionId !== curr.questionId);
          acc.push(curr);
        }
        
        return acc;
      }, []);
      data.PracticeCode = filteredData
      return data;
    }
    catch (err) {
      throw err;
    }
  }


  async getAllFormsWithStatus(
    userId: number,
    moduleId: number,
    chapterId: number,
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
              const questions = await db
                .select({
                  id: zuvyModuleForm.id,
                  question: zuvyModuleForm.question,
                  options: zuvyModuleForm.options,
                  typeId: zuvyModuleForm.typeId,
                  isRequired: zuvyModuleForm.isRequired
                })
                .from(zuvyModuleForm)
                .where(
                  sql`${inArray(zuvyModuleForm.id, Object.values(chapterDetails[0].formQuestions))}`,
                );
              questions['status'] =
                ChapterTracking.length != 0
                  ? 'Completed'
                  : 'Pending';

              return {
                status: "success",
                code: 200,
                message:"Form not submitted by student",
                questions
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
                      status: true
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
        return 'No Chapter found';
      }
    } catch (err) {
      throw err;
    }
  }


  async updateFormStatus(
    userId: number,
    moduleId: number,
    chapterId: number,
    bootcampId: number,
    submitFormBody: SubmitFormBodyDto,
  ): Promise<any> {
    try {
      let result;
      if (submitFormBody.submitForm !== undefined) {
        submitFormBody.submitForm.sort((a, b) => a.questionId - b.questionId);
        const questionIdArray = submitFormBody.submitForm.map((obj) => obj.questionId);
        const formQuestions = await db
          .select()
          .from(zuvyModuleForm)
          .where(sql`${inArray(zuvyModuleForm.id, questionIdArray)}`)
          .orderBy(zuvyModuleForm.id);

        let updatedFormBody = [];
        for (let i = 0; i < formQuestions.length; i++) {

          const chosenOptions = Array.isArray(submitFormBody.submitForm[i].chosenOptions) ? submitFormBody.submitForm[i].chosenOptions : [];
          const answer = submitFormBody.submitForm[i].answer || null;

          let status = 'pending';
          if (chosenOptions !== null || answer !== null)
            status = 'completed';

          updatedFormBody[i] = {
            userId,
            moduleId,
            chapterId,
            chosenOptions: chosenOptions,
            answer: answer,
            questionId: submitFormBody.submitForm[i].questionId,
            attemptCount: 1,
            updatedAt: sql`Now()`,
            status
          };
        }

        result = await db
          .insert(zuvyFormTracking)
          .values(updatedFormBody)
          .returning();
      }
      return result;
    } catch (err) {
      throw err;
    }
  }

}

