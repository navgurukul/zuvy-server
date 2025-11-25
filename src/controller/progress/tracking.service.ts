import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, inArray, and, SQL, desc } from 'drizzle-orm';
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
  zuvyStudentAttendanceRecords,
  zuvyProjectTracking,
  zuvyRecentBootcamp,
  zuvyPracticeCode,
  zuvyCodingQuestions,
  zuvyFormTracking,
  zuvyModuleForm,
  zuvyModuleQuizVariants,
  zuvyAssessmentSubmission,
  zuvyOutsourseAssessments,
  zuvySessions,
  zuvyStudentAttendance,
  zuvyBootcamps,
  zuvyCourseProjects
} from 'drizzle/schema';
import {
  SubmitBodyDto,
} from './dto/assignment.dto';
import { UpdateProjectDto } from './dto/project.dto';
import { SubmitFormBodyDto } from './dto/form.dto';
import { STATUS_CODES } from 'src/helpers';
import { helperVariable } from 'src/constants/helper';
import * as crypto from 'crypto';
import { ContentService } from '../content/content.service';
import { ClassesService } from '../classes/classes.service';
import { ZoomService } from 'src/services/zoom/zoom.service';
import { courseEnrolments } from 'drizzle/tables';

// Difficulty Points Mapping
let { ACCEPTED, SUBMIT } = helperVariable;

@Injectable()
export class TrackingService {
  logger: any;
  constructor(private contentService: ContentService, private classesService: ClassesService , private readonly zoomService: ZoomService) { }

  /**
   * Recompute attendance percentage for all students in a batch and persist
   * it to `zuvy_batch_enrollments.attendance`.
   * Counts sessions where the batch appears as `batchId` OR `secondBatchId`.
   */
  async recomputeBatchAttendancePercentages(batchId: number) {
    try {
      
      // ensure we have a logger
      if (!this.logger) this.logger = console;

      // 1. Fetch all session ids where this batch participated (primary or secondary)
      const sessions = await db.select({ id: zuvySessions.id })
        .from(zuvySessions)
        .where(sql`${zuvySessions.batchId} = ${batchId} OR ${zuvySessions.secondBatchId} = ${batchId} AND ${zuvySessions.status} = 'completed'`);

      const sessionIds = sessions.map(s => s.id);
      // If there are no sessions, set attendance to 0 for enrolled students and return
      if (sessionIds.length === 0) {
        await db.update(zuvyBatchEnrollments)
          .set({ attendance: 0 })
          .where(eq(zuvyBatchEnrollments.batchId, batchId));
        return { success: true, updated: 0, reason: 'no_sessions' };
      }

      // 2. Fetch all enrolled students for this batch
      const enrollments = await db.select({ id: zuvyBatchEnrollments.id, userId: zuvyBatchEnrollments.userId })
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.batchId, batchId));
      console.log("Enrollments for batch:", enrollments);
      if (!enrollments || enrollments.length === 0) {
        return { success: true, updated: 0, reason: 'no_enrollments' };
      }

      // 3. Fetch present counts for all users in one grouped query (count distinct sessionId to avoid duplicates)
      const presentCountsRaw = await db.select({ userId: zuvyStudentAttendanceRecords.userId, cnt: sql<number>`cast(count(DISTINCT ${zuvyStudentAttendanceRecords.sessionId}) as int)` })
        .from(zuvyStudentAttendanceRecords)
        .where(sql`${inArray(zuvyStudentAttendanceRecords.sessionId, sessionIds)} AND lower(${zuvyStudentAttendanceRecords.status}) = ${'present'}`)
        .groupBy(zuvyStudentAttendanceRecords.userId);


      // map userId -> presentCount (string keys to support BigInt)
      const presentMap = new Map<string, number>();
      for (const r of presentCountsRaw) {
        const key = String((r as any).userId);
        presentMap.set(key, Number((r as any).cnt ?? 0));
      }

      // 4. Build a CASE expression to batch update attendance in a single query
      const sqlChunks: SQL[] = [];
      const ids: number[] = [];

      sqlChunks.push(sql`(case`);

      const totalClasses = sessionIds.length;

      for (const enroll of enrollments) {
        const key = String(enroll.userId);
        const presentCount = presentMap.get(key) ?? 0;
        const rawPercentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;
        const percentage = Math.max(0, Math.min(100, rawPercentage));

        sqlChunks.push(sql`when ${zuvyBatchEnrollments.id} = ${enroll.id} then ${sql.raw(`CAST(${percentage} AS INTEGER)`)}`);
        ids.push(enroll.id as unknown as number);
      }

      sqlChunks.push(sql`end)`);

      const finalSql: SQL = sql.join(sqlChunks, sql.raw(' '));

      // perform batch update for all enrollments in this batch
      await db.update(zuvyBatchEnrollments).set({ attendance: finalSql }).where(sql`${inArray(zuvyBatchEnrollments.id, ids)}`);

      return { success: true, updated: ids.length };
    } catch (err: any) {
      if (this.logger) this.logger.error(`recomputeBatchAttendancePercentages failed: ${err?.message ?? err}`);
      return { success: false, error: err?.message ?? String(err) };
    }
  }

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
          let insertChapterTracking: any = {
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
            let InsertZuvyModuleTracking: any = {
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
            let UpdateZuvyModuleTracking: any = {
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
            let insertRecentBootcamp: any = {
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
            let updatedRecentBootcamp: any = {
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
        let trackingData = await db.query.zuvyModuleChapter.findMany({
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

        // Fetch all assessment chapters' IDs
        const assessmentChapterIds = trackingData
          .filter(chapter => chapter.topicId === 6)
          .map(chapter => chapter.id);

        let assessmentStates: Record<number, number> = {};
        if (assessmentChapterIds.length > 0) {
          // Query zuvyOutsourseAssessments for these chapters
          const assessments = await db
            .select()
            .from(zuvyOutsourseAssessments)
            .where(inArray(zuvyOutsourseAssessments.chapterId, assessmentChapterIds));

          for (const assessment of assessments) {
            await this.contentService.updateAssessmentState(assessment);
          }
          const updatedAssessments = await db
            .select({
              chapterId: zuvyOutsourseAssessments.chapterId,
              currentState: zuvyOutsourseAssessments.currentState,
            })
            .from(zuvyOutsourseAssessments)
            .where(inArray(zuvyOutsourseAssessments.chapterId, assessmentChapterIds));

          // Map chapterId to currentState
          assessmentStates = Object.fromEntries(
            updatedAssessments.map(a => [a.chapterId, a.currentState])
          );
        }

        // Filter assessment chapters based on their state
        trackingData = trackingData.filter(chapter => {
          if (chapter.topicId === 6) {
            const state = assessmentStates[chapter.id];
            // include null/undefined plus any of [1,2,3]
            return state == null || [1, 2, 3].includes(state);
          }
          return true;
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
        throw new NotFoundException('Module not found or deleted!');
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
        let updatedAssignmentBody: any = {
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
        const chapterStatus = await db
          .select()
          .from(zuvyChapterTracking)
          .where(sql`${zuvyChapterTracking.userId} = ${userId} AND ${zuvyChapterTracking.chapterId} = ${chapterId}`);
        if (chapterStatus.length > 0) {
          return {
            status: "success",
            message: "Already submitted.",
            code: STATUS_CODES.OK,
          };
        }
        SubmitBody.submitQuiz.sort((a, b) => a.mcqId - b.mcqId);
        const mcqIdArray = SubmitBody.submitQuiz.map((obj) => obj.mcqId);
        const chosenOptions = SubmitBody.submitQuiz.map((obj) => obj.chossenOption);

        // Fetch the correct answers for the submitted questions
        const questions = await db
          .select({
            id: zuvyModuleQuizVariants.id,
            correctOption: zuvyModuleQuizVariants.correctOption,
          })
          .from(zuvyModuleQuizVariants)
          .where(sql`${inArray(zuvyModuleQuizVariants.id, mcqIdArray)}`);

        // Prepare the data for insertion
        const insertData = questions.map((question, index) => {
          const chosenOption = chosenOptions[index];
          const status = chosenOption === question.correctOption ? "pass" : "fail";

          return {
            mcqId: question.id,
            chosenOption,
            status,
            userId,
            chapterId,
            moduleId,
            createdAt: sql`NOW()`,
            updatedAt: sql`NOW()`,
          };
        });

        // Insert data into the quiz tracking table
        await db
          .insert(zuvyQuizTracking)
          .values(insertData);

        return {
          status: "success",
          message: "Quiz submitted successfully.",
          code: STATUS_CODES.OK,
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async getAllModuleByBootcampIdForStudent(bootcampId: number, userId: number) {
    try {
      const bootcamp = await db.query.zuvyBootcampType.findFirst({
        where: (bootcamp, { eq }) => eq(bootcamp.bootcampId, bootcampId),
      });
      if (!bootcamp) {
        throw new NotFoundException('Bootcamp not found or deleted!');
      }
      const isCourseLocked = bootcamp?.isModuleLocked || false;

      const data = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq }) => eq(courseModules.bootcampId, bootcampId),
        orderBy: (courseModules, { asc }) => asc(courseModules.order),
        with: {
          moduleChapterData: {
            columns: {
              id: true,
              topicId: true,
              order: true
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
              id: true,
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
            moduleId: module.id
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
        if (moduleFound) {
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
          progress: updatedProgress,
          ChapterId: module.moduleChapterData.find((chapter) => chapter.order === 1)?.id || null,
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
        let updateProgress: any = { progress: finalSql }

        await db.update(zuvyModuleTracking).set(updateProgress)
          .where(sql`${inArray(zuvyModuleTracking.id, ids)}`);
      }

      if (modules.length > 0) {
        if (!isCourseLocked) {
          // Course is unlocked: All modules are accessible
          modules = modules.map(module => ({ ...module, isLock: false }));
        } else {
          // Course is locked: restrict access based on last started/completed module
          let lastStartedOrCompletedIndex = -1;

          // Find the last module which was started (progress > 0)
          for (let i = modules.length - 1; i >= 0; i--) {
            if (modules[i].progress > 0) {
              lastStartedOrCompletedIndex = i;
              break;
            }
          }

          // If none started, only first module is unlocked
          if (lastStartedOrCompletedIndex === -1) {
            modules = modules.map((module, index) => ({
              ...module,
              isLock: index !== 0,
            }));
          } else {
            const isLastCompleted = modules[lastStartedOrCompletedIndex].progress === 100;

            modules = modules.map((module, index) => {
              if (index <= lastStartedOrCompletedIndex) {
                // Unlock previously accessed modules
                return { ...module, isLock: false };
              }

              if (isLastCompleted && index === lastStartedOrCompletedIndex + 1) {
                // Unlock only the next module if last one is fully completed
                return { ...module, isLock: false };
              }

              // Lock all others
              return { ...module, isLock: true };
            });
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
      const bootcampInfo = await db.select().from(zuvyBootcamps).where(eq(zuvyBootcamps.id, bootcampId))
      if (bootcampInfo.length == 0) {
        throw new NotFoundException('Bootcamp not found or deleted!');
      }
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

      // Get batch details with proper typing
      const batchDetails = await db.query.zuvyBatchEnrollments.findFirst({
        where: (batchEnroll, { sql }) =>
          sql`${batchEnroll.userId} = ${BigInt(userId)} AND ${batchEnroll.bootcampId} = ${bootcampId}`,
        with: {
          batchInfo: {
            columns: {
              id: true,
              name: true,
              capEnrollment: true,
              createdAt: true
            },
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

      // Get total enrolled students in the batch
      const totalEnrolledStudents = batchDetails['batchInfo'].id ? await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.batchId, batchDetails['batchInfo'].id))
        .then(results => results.length) : 0;

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
        instructorDetails,
        batchInfo: batchDetails['batchInfo'] ? {
          batchName: batchDetails['batchInfo'].name,
          totalEnrolledStudents
        } : null
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

  async getAllUpcomingSubmission(userId: number, bootcampId: number): Promise<any> {
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
          bootcamp: {
            columns: {
              id: true,
              name: true
            },
            with: {
              bootcampModules: {
                columns: {
                  id: true,
                  name: true
                },
                with: {
                  moduleTracking: {
                    where: (moduleTracked, { sql }) =>
                      sql`${moduleTracked.userId} = ${userId} and ${moduleTracked.progress} < 100`,
                    columns: {
                      id: true,
                      progress: true
                    },
                    with: {
                      chapterDetailss: {
                        columns: {
                          id: true,
                          title: true,
                          completionDate: true
                        },
                        where: (moduleChapter, { eq }) =>
                          eq(moduleChapter.topicId, 5)
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
      if (data.length > 0) {
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
        if (chapterIds.length > 0) {
          const completedChapterIds = await db.select({ id: zuvyChapterTracking.chapterId })
            .from(zuvyChapterTracking)
            .where(and(inArray(zuvyChapterTracking.chapterId, chapterIds), eq(zuvyChapterTracking.userId, BigInt(userId))));

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
          return [{ message: 'No content found', statusCode: STATUS_CODES.NO_CONTENT }, null]
        }
      }
      else {
        return [{ message: 'No content found', statusCode: STATUS_CODES.NO_CONTENT }, null]
      }

      return [null, { message: 'Upcoming submission fetched successfully', statusCode: STATUS_CODES.OK, data: { upcomingAssignments, lateAssignments } }]
    }
    catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }, null]
    }
  }

 async getChapterDetailsWithStatus(chapterId: number, userId: number) {
    try {
      // This initial block to update class status can remain the same
      const chapter = await db.query.zuvyModuleChapter.findFirst({
        where: (moduleChapter, { eq }) => eq(moduleChapter.id, chapterId),
      });

      if (chapter) {
        const courseModule = await db.query.zuvyCourseModules.findFirst({
          where: (cm, { eq }) => eq(cm.id, chapter.moduleId),
          columns: { bootcampId: true }
        });
        if (courseModule?.bootcampId) {
          const enrollment = await db.query.zuvyBatchEnrollments.findFirst({
            where: (be, { and, eq }) => and(
              eq(be.userId, BigInt(userId)),
              eq(be.bootcampId, courseModule.bootcampId)
            ),
            columns: { batchId: true }
          });
          if (enrollment?.batchId) {
            await this.classesService.updatingStatusOfClass(courseModule.bootcampId, enrollment.batchId, chapterId);
          }
        }
      } else {
        throw new NotFoundException('Chapter not found or deleted by admin!');
      }

      // Fetch the chapter details along with user-specific tracking info
      const trackingData = await db.query.zuvyModuleChapter.findFirst({
        where: (moduleChapter, { eq }) => eq(moduleChapter.id, chapterId),
        with: {
          chapterTrackingDetails: {
            columns: { id: true },
            where: (chapterTracking, { eq }) =>
              eq(chapterTracking.userId, BigInt(userId)),
          }
        },
      });

      if (!trackingData) {
        // This case should be handled as the chapter was confirmed to exist above
        throw new NotFoundException('Chapter details could not be fetched.');
      }
      
      // Fetch the single session linked to this chapter
      const session = await db.query.zuvySessions.findFirst({
        where: (sessions, { eq }) => eq(sessions.chapterId, chapterId),
        columns: {
          id: true,
          meetingId: true,
          hangoutLink: true,
          startTime: true,
          endTime: true,
          title: true,
          s3link: true,
          status: true,
          isZoomMeet: true,
          batchId:true,
          bootcampId:true,
          zoomMeetingId:true // Fetch the new flag
        }
      });
      
      // If a session exists, fetch its attendance conditionally
      if (session) {
        if(session.s3link !== null && session.s3link !== '' && session.status === 'completed' && session.isZoomMeet && !session.s3link.includes('www.youtube.com')) {
          const updatedRecordingLink = await this.zoomService.getMeetingRecordingLink(session.zoomMeetingId);
          if(updatedRecordingLink.success) {
            session.s3link = updatedRecordingLink.data.playUrl !== null ? updatedRecordingLink.data.playUrl : session.s3link;
          }
        }
        let attendanceStatus = 'absent';
        let durationSeconds = 0;

        // ✅ --- NEW CONDITIONAL LOGIC ---
        if (session.isZoomMeet === true) {
          // --- Zoom Path: Fetch from zuvy_student_attendance_records ---
          const zoomAttendance = await db.query.zuvyStudentAttendanceRecords.findFirst({
              where: (rec, { and, eq }) => and(
                  eq(rec.sessionId, session.id),
                  eq(rec.userId, userId)
              ),
              columns: { status: true, duration: true }
          });

          if (zoomAttendance) {
              attendanceStatus = zoomAttendance.status;
              durationSeconds = zoomAttendance.duration ?? 0;
          }
        } else {
          // --- Google Meet Path (Original Logic): Fetch from zuvy_student_attendance ---
          const userDetails = await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.id, BigInt(userId)),
            columns: { email: true }
          });
          
          const sessionAttendance = await db.query.zuvyStudentAttendance.findFirst({
              where: (att, { eq }) => eq(att.meetingId, session.meetingId),
              columns: { attendance: true }
          });

          if (sessionAttendance?.attendance && userDetails?.email) {
            const attendanceArray = Array.isArray(sessionAttendance.attendance) ? sessionAttendance.attendance as any[] : [];
            const studentAttendance = attendanceArray.find((record: any) => 
                (record.email || record.student)?.toLowerCase() === userDetails.email.toLowerCase()
            );

            if (studentAttendance) {
              attendanceStatus = studentAttendance.attendance || 'absent';
              // Ensure duration is treated as a number
              durationSeconds = Number(studentAttendance.duration) || 0;
            }
          }
        }
        // ✅ --- END OF CONDITIONAL LOGIC ---

        const durationMinutes = Math.round(durationSeconds / 60);

        // Attach the session with attendance details to the response
        trackingData['sessions'] = [{
          ...session,
          attendance: attendanceStatus,
          duration: durationMinutes
        }];
      } else {
        trackingData['sessions'] = []; // Ensure sessions is an empty array if none found
      }
      trackingData['status'] =
        trackingData.chapterTrackingDetails.length > 0
          ? 'Completed'
          : 'Pending';
      if(trackingData['sessions'].length > 0 && trackingData['sessions'][0].status === 'completed') {
        if(trackingData['sessions'][0].attendance === 'present') {
           await this.updateChapterStatus(trackingData['sessions'][0].bootcampId, userId, trackingData['moduleId'], chapterId);
           trackingData['status'] = 'Completed';
           const newLiveChapterStatusId = await db.select({id:zuvyChapterTracking.id}).from(zuvyChapterTracking).where(
             sql`${zuvyChapterTracking.userId} = ${userId} AND ${zuvyChapterTracking.chapterId} = ${chapterId}`
           )
            if (newLiveChapterStatusId.length > 0) {
              trackingData['chapterTrackingDetails'] = newLiveChapterStatusId;
            } else {
              trackingData['chapterTrackingDetails'] = [];
            }
        }
      }
      
      
      return {
        status: 'success',
        code: 200,
        trackingData,
      };
    } catch (err) {
      // Re-throw the error to be handled by NestJS's global exception filter
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
        .from(zuvyChapterTracking)
        .where(sql`${zuvyChapterTracking.userId} = ${userId} and ${zuvyChapterTracking.chapterId} = ${chapterId}`);

      if (chapterDetails.length > 0) {
        if (chapterDetails[0].topicId == 4) {
          if (chapterDetails[0].quizQuestions !== null) {
            if (QuizTracking.length == 0) {
              const questions = await db
                .select({
                  id: zuvyModuleQuiz.id,
                  question: zuvyModuleQuizVariants.question,  // Use zuvyModuleQuizVariants
                  options: zuvyModuleQuizVariants.options,    // Use zuvyModuleQuizVariants
                })
                .from(zuvyModuleQuiz)
                .innerJoin(zuvyModuleQuizVariants, eq(zuvyModuleQuiz.id, zuvyModuleQuizVariants.quizId)) // Join to get the variants
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
              const trackedData = await db.query.zuvyModuleQuizVariants.findMany({
                where: (moduleQuiz, { sql }) =>
                  sql`${inArray(moduleQuiz.quizId, Object.values(chapterDetails[0].quizQuestions))}`,
                with: {
                  quizVariants: {
                    columns: {
                      question: true,
                      options: true,
                    },
                  },
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
  ): Promise<any> {
    try {
      const chapter = await db.select().from(zuvyModuleChapter).where(eq(zuvyModuleChapter.id, chapterId));
      if (chapter.length > 0) {
        if (chapter[0].topicId == 4) {
          if (chapter[0].quizQuestions !== null) {
            const quizQuestionIds = Object.values(chapter[0].quizQuestions);
            quizQuestionIds.sort((a, b) => a - b);

            // Check if chapter was tracked
            const chapterTracking = await db
              .select()
              .from(zuvyChapterTracking)
              .where(
                sql`${zuvyChapterTracking.userId} = ${userId} AND ${zuvyChapterTracking.chapterId} = ${chapterId}`
              )
              .limit(1);

            const quizTrack = await db
              .select()
              .from(zuvyQuizTracking)
              .where(
                sql`${zuvyQuizTracking.userId} = ${userId} AND ${zuvyQuizTracking.chapterId} = ${chapterId} AND ${zuvyQuizTracking.chosenOption} IS NOT NULL`
              );

            const isAttempted = quizTrack.length > 0;
            const status = isAttempted ? 'Completed' : 'Pending';

            if (isAttempted) {
              // Fetch all quiz variants for the chapter questions
              const allVariants = await db.query.zuvyModuleQuizVariants.findMany({
                where: (moduleQuiz, { sql }) => sql`${inArray(moduleQuiz.quizId, quizQuestionIds)}`,
                orderBy: (moduleQuiz, { asc }) => asc(moduleQuiz.quizId),
                with: {
                  quizTrackingData: {
                    columns: {
                      chosenOption: true,
                      status: true,
                    },
                    where: (quizTracking, { sql }) =>
                      sql`${quizTracking.userId} = ${userId} AND ${quizTracking.chapterId} = ${chapterId}`,
                  },
                },
              });

              // Add empty quizTrackingData for unattempted variants
              const enrichedVariants = allVariants.map((variant) => ({
                ...variant,
                quizTrackingData: variant['quizTrackingData'].length > 0 ? variant['quizTrackingData'] : [],
              }));

              return [
                null,
                {
                  message: 'Chapter details fetched successfully',
                  statusCode: STATUS_CODES.OK,
                  data: {
                    chapterTitle: chapter[0].title,
                    chapterId: chapter[0].id,
                    chapterOrder: chapter[0].order,
                    quizDetails: enrichedVariants,
                    status,
                  },
                },
              ];
            }

            // If not attempted yet, deterministically pick variants
            const randomVariants = await Promise.all(
              quizQuestionIds.map(async (quizId) => {
                const allVariants = await db.query.zuvyModuleQuizVariants.findMany({
                  where: (moduleQuiz) => eq(moduleQuiz.quizId, quizId),
                });

                if (allVariants.length === 0) {
                  throw new Error(`No variants found for quizId: ${quizId}`);
                }

                const hash = crypto.createHash('sha256')
                  .update(`${userId}-${quizId}`)
                  .digest('hex');
                const hashValue = parseInt(hash.substring(0, 8), 16);
                const selectedVariantIndex = hashValue % allVariants.length;

                return {
                  ...allVariants[selectedVariantIndex],
                  quizTrackingData: [],
                };
              })
            );

            return [
              null,
              {
                message: 'Random quiz variants fetched for the first attempt.',
                statusCode: STATUS_CODES.OK,
                data: {
                  chapterTitle: chapter[0].title,
                  chapterId: chapter[0].id,
                  chapterOrder: chapter[0].order,
                  quizDetails: randomVariants.map((variant) => ({
                    id: variant.id,
                    quizId: variant.quizId,
                    question: variant.question,
                    options: variant.options,
                    variantNumber: variant.variantNumber
                  })),
                  status,
                },
              },
            ];
          } else {
            return [
              null,
              {
                message: 'No quiz questions found in this quiz chapter',
                statusCode: STATUS_CODES.OK,
                data: {
                  chapterTitle: chapter[0].title,
                  chapterId: chapter[0].id,
                  chapterOrder: chapter[0].order,
                  quizDetails: [],
                  status: 'Pending',
                },
              },
            ];
          }
        }
        else if (chapter[0].topicId == 5) {
          const assignmentTracking = await db
            .select()
            .from(zuvyAssignmentSubmission)
            .where(sql`${zuvyAssignmentSubmission.userId} = ${userId}
                AND ${zuvyAssignmentSubmission.chapterId} = ${chapterId}`);

          const status = assignmentTracking.length > 0 ? 'Completed' : 'Pending';

          return [null, { message: 'Assignment chapter fetched succesfully', statusCode: STATUS_CODES.OK, data: { chapterDetails: chapter[0], assignmentTracking, status } }]
        }
        else if (chapter[0].topicId == 3) {

          const ChapterTracking = await db
            .select()
            .from(zuvyChapterTracking)
            .where(sql`${zuvyChapterTracking.userId} = ${userId} and ${zuvyChapterTracking.chapterId} = ${chapterId}`);
          let statusCount = ChapterTracking.length > 0 ? 1 : 0;

          const status = statusCount > 0 ? 'Completed' : 'Pending';
          const codingProblem = await db
            .select()
            .from(zuvyCodingQuestions)
            .where(
              eq(
                zuvyCodingQuestions.id,
                chapter[0].codingQuestions,
              ),
            )
          if (chapter[0].codingQuestions != null && codingProblem.length > 0) {
            return [null, { message: 'Coding chapter fetched succesfully', statusCode: STATUS_CODES.OK, data: { chapterDetails: chapter[0], codingProblem, status } }]
          }
          else {
            return [null, { message: 'There is no coding question in this chapter', statusCode: STATUS_CODES.OK, data: null }]
          }
        }
        else {
          return [null, { message: 'It is not a quiz or assignment chapter', statusCode: STATUS_CODES.OK, data: null }]
        }
      }
      else {
        return [null, { message: 'No chapter found', statusCode: STATUS_CODES.OK, data: null }]
      }
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }]
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
          let updatedRecentBootcamp: any = {
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
          let UpdatedRecentBootcamp: any = {
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

  async getProjectDetailsWithStatus(projectId: number, moduleId: number, userId: number): Promise<any> {
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
                  projectLink: true,
                  isChecked: true,
                  grades: true,
                  updatedAt: true
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
      return [null, { message: 'Project details successfully fetched', statusCode: STATUS_CODES.OK, data: projectDetails }]
    } catch (err) {
      return [{ message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }]
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

  async getLatestUpdatedCourseForStudents(userId: number, bootcampId: number): Promise<any> {
  try {
    // 1. Load modules in order (removed early bootcamp completion check)
    const modules = await db.select().from(zuvyCourseModules)
      .where(eq(zuvyCourseModules.bootcampId, bootcampId))
      .orderBy(zuvyCourseModules.order);
    
    if (!modules.length) {
      return [null, { message: 'No modules found for this bootcamp', statusCode: STATUS_CODES.OK, data: [] }];
    }

    const bootcamp = await db.select().from(zuvyBootcamps).where(eq(zuvyBootcamps.id, bootcampId));
    const bootcampName = bootcamp.length ? bootcamp[0].name : '';

    // 2. Fetch all tracking data
    const moduleIds = modules.map(m => m.id);
    
    const [chapterRecsAll, projectRecsAll, moduleRecs] = await Promise.all([
      db.select().from(zuvyChapterTracking)
        .where(and(eq(zuvyChapterTracking.userId, BigInt(userId)), inArray(zuvyChapterTracking.moduleId, moduleIds))),
      db.select().from(zuvyProjectTracking)
        .where(and(eq(zuvyProjectTracking.userId, userId), inArray(zuvyProjectTracking.moduleId, moduleIds))),
      db.select().from(zuvyModuleTracking)
        .where(and(eq(zuvyModuleTracking.userId, userId), inArray(zuvyModuleTracking.moduleId, moduleIds)))
    ]);

    const trackedChapterIds = new Set(chapterRecsAll.map(r => Number(r.chapterId)));
    const trackedProjMods = new Set(projectRecsAll.map(r => Number(r.moduleId)));
    const moduleProgMap = new Map(moduleRecs.map(r => [Number(r.moduleId), Number(r.progress)]));

    // 4. Helper function to calculate actual module progress based on current chapters vs tracking
    const getActualModuleProgress = async (module: typeof modules[0]): Promise<{ progress: number, hasAvailableChapters: boolean }> => {
      if (module.typeId === 2) { // Project module
        return { 
          progress: trackedProjMods.has(module.id) ? 100 : 0, 
          hasAvailableChapters: true 
        };
      } else { // Chapter module
        // Get current chapters for this module
        const currentChapters = await db.select().from(zuvyModuleChapter)
          .where(eq(zuvyModuleChapter.moduleId, module.id))
          .orderBy(zuvyModuleChapter.order);
        
        if (!currentChapters.length) {
          return { progress: 0, hasAvailableChapters: false }; // No chapters = 0% progress
        }
        
        // Get assessment statuses for these chapters
        const chapterIds = currentChapters.map(c => c.id);
        const assessmentRecs = chapterIds.length > 0 
          ? await db.select().from(zuvyOutsourseAssessments)
              .where(inArray(zuvyOutsourseAssessments.chapterId, chapterIds))
          : [];
        const assessmentStatus = new Map<number, number>(
          assessmentRecs.map(r => [Number(r.chapterId), r.currentState])
        );
        
        // Count available (non-blocked) chapters
        const availableChapters = currentChapters.filter(chapter => 
          !(chapter.topicId === 6 && (assessmentStatus.get(chapter.id) ?? 0) !== 1 && (assessmentStatus.get(chapter.id) ?? 0) !== 2)
        );
        
        if (!availableChapters.length) {
          return { progress: 0, hasAvailableChapters: false }; // No available chapters
        }
        
        // Count completed chapters from actual tracking
        const completedChapters = availableChapters.filter(chapter => 
          trackedChapterIds.has(chapter.id)
        );
        
        // CRITICAL: Check if zuvyModuleTracking shows 100% but we have new chapters
        const recordedModuleProgress = moduleProgMap.get(module.id);
        const actualCompletionRate = completedChapters.length / availableChapters.length;
        
        if (recordedModuleProgress === 100 && actualCompletionRate < 1) {
          // Module was marked complete but new chapters were added
          // Return actual progress based on current chapters
          return { 
            progress: Math.round(actualCompletionRate * 100), 
            hasAvailableChapters: true 
          };
        }
        
        if (completedChapters.length === 0) {
          return { progress: 0, hasAvailableChapters: true }; // No chapters completed but has available ones
        } else if (completedChapters.length === availableChapters.length) {
          return { progress: 100, hasAvailableChapters: true }; // All available chapters completed = 100% progress
        } else {
          return { 
            progress: Math.round(actualCompletionRate * 100), 
            hasAvailableChapters: true 
          }; // Partial progress
        }
      }
    };

    // 6. Categorize modules by completion status (using actual current progress)
    const partialModules: Array<{ module: typeof modules[0], lastActivity: number }> = [];
    const untouchedModules: typeof modules = [];
    const blockedModules: typeof modules = []; // Modules with no available chapters
    
    for (const module of modules) {
      const { progress, hasAvailableChapters } = await getActualModuleProgress(module);
      
      if (!hasAvailableChapters) {
        // Module has no available chapters (all blocked by assessments)
        blockedModules.push(module);
        continue;
      }
      
      if (progress === 100) {
        // Skip completed modules
        continue;
      } else if (progress > 0) {
        // Partial modules - find last activity timestamp
        let lastActivity = 0;
        
        if (module.typeId === 2) {
          // Project module - check project tracking dates
          const projDates = projectRecsAll
            .filter(r => Number(r.moduleId) === module.id && r.updatedAt)
            .map(r => new Date(r.updatedAt).getTime());
          lastActivity = Math.max(...projDates, 0);
        } else {
          // Chapter module - check chapter tracking dates
          const chapDates = chapterRecsAll
            .filter(r => Number(r.moduleId) === module.id && r.completedAt)
            .map(r => new Date(r.completedAt).getTime());
          lastActivity = Math.max(...chapDates, 0);
        }
        
        // Important: If lastActivity is 0 but module has progress > 0,
        // it means new content was added to a previously completed module
        // In this case, use a recent timestamp to prioritize it
        if (lastActivity === 0 && progress > 0) {
          lastActivity = Date.now() - 1000; // 1 second ago to prioritize over truly untouched
        }
        
        partialModules.push({ module, lastActivity });
      } else {
        // Untouched modules with available chapters
        untouchedModules.push(module);
      }
    }

    // 7. Determine current module: most recent partial, or first untouched with available chapters
    let currentModule: typeof modules[0] | null = null;
    
    if (partialModules.length > 0) {
      // Sort by most recent activity and take the most recent
      partialModules.sort((a, b) => b.lastActivity - a.lastActivity);
      currentModule = partialModules[0].module;
    } else if (untouchedModules.length > 0) {
      // Take first untouched module that has available chapters
      currentModule = untouchedModules[0];
    }

    // 8. Check if bootcamp is actually complete (after analyzing all modules)
    if (!currentModule) {
      // Double-check: verify bootcamp completion by examining actual progress
      let allModulesComplete = true;
      for (const module of modules) {
        const { progress, hasAvailableChapters } = await getActualModuleProgress(module);
        if (hasAvailableChapters && progress < 100) {
          allModulesComplete = false;
          break;
        }
      }
      
      if (allModulesComplete) {
        return [null, { message: 'You have completed this course. Well done!!', statusCode: STATUS_CODES.OK, data: [] }];
      } else {
        // This shouldn't happen, but as safety fallback
        return [null, { message: 'No available content found', statusCode: STATUS_CODES.OK, data: [] }];
      }
    }

    // 9. Handle project module
    if (currentModule.typeId === 2) {
      if (!trackedProjMods.has(currentModule.id)) {
        const proj = await db.select().from(zuvyCourseProjects)
          .where(eq(zuvyCourseProjects.id, currentModule.projectId));
        
        return [null, {
          message: 'Your latest updated course',
          statusCode: STATUS_CODES.OK,
          data: {
            moduleId: currentModule.id,
            moduleName: currentModule.name,
            typeId: 2,
            bootcampId: currentModule.bootcampId,
            bootcampName,
            newProject: proj.length ? proj[0] : null
          }
        }];
      }
    }

    // 10. Handle chapter module
    let chapters = await db.select().from(zuvyModuleChapter)
      .where(eq(zuvyModuleChapter.moduleId, currentModule.id))
      .orderBy(zuvyModuleChapter.order);

    if (!chapters.length) {
      // Empty module - try to find next available module instead of returning error
      console.log(`Module ${currentModule.id} is empty, searching for next available module...`);
      
      // Look for next untouched module with content
      let foundAlternative = false;
      
      for (const module of untouchedModules) {
        if (module.id === currentModule.id) continue; // Skip current empty module
        
        if (module.typeId === 2) {
          // Project module - check if not tracked
          if (!trackedProjMods.has(module.id)) {
            const proj = await db.select().from(zuvyCourseProjects)
              .where(eq(zuvyCourseProjects.id, module.projectId));
            
            return [null, {
              message: 'Your latest updated course',
              statusCode: STATUS_CODES.OK,
              data: {
                moduleId: module.id,
                moduleName: module.name,
                typeId: 2,
                bootcampId: module.bootcampId,
                bootcampName,
                newProject: proj.length ? proj[0] : null
              }
            }];
          }
        } else {
          // Chapter module - check if it has chapters
          const moduleChapters = await db.select().from(zuvyModuleChapter)
            .where(eq(zuvyModuleChapter.moduleId, module.id))
            .orderBy(zuvyModuleChapter.order);
          
          if (moduleChapters.length > 0) {
            // Found a module with content
            currentModule = module;
            chapters = moduleChapters;
            foundAlternative = true;
            break;
          }
        }
      }
      
      // If still no chapters found after checking all modules
      if (!foundAlternative) {
        return [null, { message: 'No available content found in any module', statusCode: STATUS_CODES.OK, data: [] }];
      }
    }

    // 11. Get assessment statuses for chapters (reuse from progress calculation if same module)
    const chapterIds = chapters.map(r => r.id);
    const assessmentRecs = chapterIds.length > 0 
      ? await db.select().from(zuvyOutsourseAssessments)
          .where(inArray(zuvyOutsourseAssessments.chapterId, chapterIds))
      : [];
    const assessmentStatus = new Map<number, number>(
      assessmentRecs.map(r => [Number(r.chapterId), r.currentState])
    );

    // 12. Helper function to check if chapter is available
    const isChapterAvailable = (chapter: typeof chapters[0]): boolean => {
      return !trackedChapterIds.has(chapter.id) && 
        !(chapter.topicId === 6 && (assessmentStatus.get(chapter.id) ?? 0) !== 1 && (assessmentStatus.get(chapter.id) ?? 0) !== 2);
    };

    // 13. Find next available chapter with improved logic for blocked assessments
    let nextChapter = null;
    const moduleChapterRecs = chapterRecsAll.filter(r => Number(r.moduleId) === currentModule.id);
    
    if (moduleChapterRecs.length > 0) {
      // Find the most recently completed chapter in this module
      moduleChapterRecs.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      const lastCompletedChapterId = Number(moduleChapterRecs[0].chapterId);
      const lastCompletedIndex = chapters.findIndex(c => c.id === lastCompletedChapterId);
      
      // Look for next available chapter after the last completed one
      if (lastCompletedIndex >= 0) {
        for (let i = lastCompletedIndex + 1; i < chapters.length; i++) {
          if (isChapterAvailable(chapters[i])) {
            nextChapter = chapters[i];
            break;
          }
        }
      }
    }

    // 14. If no next chapter found after last completed, find first available chapter
    // This handles the case where first chapter is blocked assessment
    if (!nextChapter) {
      for (const chapter of chapters) {
        if (isChapterAvailable(chapter)) {
          nextChapter = chapter;
          break;
        }
      }
    }

    // 15. If no available chapters in current module, try next untouched module
    if (!nextChapter) {
      // Look for next untouched module with available chapters
      for (const module of untouchedModules) {
        if (module.id === currentModule.id) continue; // Skip current module
        
        const moduleChapters = await db.select().from(zuvyModuleChapter)
          .where(eq(zuvyModuleChapter.moduleId, module.id))
          .orderBy(zuvyModuleChapter.order);
        
        if (moduleChapters.length > 0) {
          // Get assessment statuses for this module's chapters
          const moduleChapterIds = moduleChapters.map(c => c.id);
          const moduleAssessmentRecs = moduleChapterIds.length > 0 
            ? await db.select().from(zuvyOutsourseAssessments)
                .where(inArray(zuvyOutsourseAssessments.chapterId, moduleChapterIds))
            : [];
          const moduleAssessmentStatus = new Map<number, number>(
            moduleAssessmentRecs.map(r => [Number(r.chapterId), r.currentState])
          );
          
          // Find first available chapter in this module
          for (const chapter of moduleChapters) {
            const isAvailable = !trackedChapterIds.has(chapter.id) && 
              !(chapter.topicId === 6 && (moduleAssessmentStatus.get(chapter.id) ?? 0) !== 1 && (moduleAssessmentStatus.get(chapter.id) ?? 0) !== 2);
            
            if (isAvailable) {
              // Update current module to this one
              currentModule = module;
              nextChapter = chapter;
              break;
            }
          }
          
          if (nextChapter) break; // Found a chapter, exit module loop
        }
      }
    }

    // 16. Return result or handle completion
    if (nextChapter) {
      return [null, {
        message: 'Your latest updated course',
        statusCode: STATUS_CODES.OK,
        data: {
          moduleId: currentModule.id,
          moduleName: currentModule.name,
          typeId: 1,
          bootcampId: currentModule.bootcampId,
          bootcampName,
          newChapter: nextChapter
        }
      }];
    }

    // 17. Final fallback - no available chapters found in any module
    return [null, { message: 'You have completed this course. Well done!!', statusCode: STATUS_CODES.OK, data: [] }];

  } catch (err) {
    return [{ message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }];
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
      // First get the submission with assessment data
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
            where: (zuvyPracticeCode, { eq, and, or, ne }) => and(
              eq(zuvyPracticeCode.userId, userId),
              eq(zuvyPracticeCode.action, helperVariable.SUBMIT)
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

      // Now get the chapter separately using the chapterId from the assessment
      if (data.submitedOutsourseAssessment?.chapterId) {
        const chapter = await db.query.zuvyModuleChapter.findFirst({
          where: (zuvyModuleChapter, { eq }) =>
            eq(zuvyModuleChapter.id, data.submitedOutsourseAssessment.chapterId),
          columns: {
            id: true,
            title: true
          }
        });

        if (chapter) {
          data.submitedOutsourseAssessment.chapterName = chapter.title;
        }
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

      data.PracticeCode = filteredData;

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
                message: "Form not submitted by student",
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
                message: "Form submitted by student",
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

  async getProperting(assessmentSubmissionId): Promise<any> {
    try {
      let assessmentProperting = await db.select({ eyeMomentCount: zuvyAssessmentSubmission.eyeMomentCount, fullScreenExit: zuvyAssessmentSubmission.fullScreenExit, copyPaste: zuvyAssessmentSubmission.copyPaste, tabChange: zuvyAssessmentSubmission.tabChange }).from(zuvyAssessmentSubmission).where(eq(zuvyAssessmentSubmission.id, assessmentSubmissionId));
      if (assessmentProperting.length == 0) {
        return [null, { message: "Assessment properting not found", statusCode: STATUS_CODES.NOT_FOUND, data: {} }]
      }
      return [null, { message: 'Get Assignment properting', statusCode: STATUS_CODES.OK, data: assessmentProperting[0] }]
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }, null]
    }
  }
}

