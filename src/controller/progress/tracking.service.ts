import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, inArray, and, desc, arrayContains, notInArray } from 'drizzle-orm';
import axios from 'axios';
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
  zuvyBatches,
  users,
  zuvyProjectTracking,
  zuvyRecentBootcamp,
  zuvyAssessmentSubmission,
  zuvyPracticeCode,
  zuvyCodingQuestions
} from 'drizzle/schema';
import { throwError } from 'rxjs';
import {
  CreateAssignmentDto,
  SubmitBodyDto,
  TimeLineAssignmentDto,
} from './dto/assignment.dto';
import { date } from 'drizzle-orm/mysql-core';
import { UpdateProjectDto } from './dto/project.dto';

import { quizBatchDto } from '../content/dto/content.dto';
import { BootcampController } from '../bootcamp/bootcamp.controller';

const { ZUVY_CONTENT_URL, ZUVY_CONTENTS_API_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class TrackingService {
  // async getProgress(user_id: number, module_id: number, bootcampId: number) {
  //     try {
  //         let response;
  //         try {
  //             response = await axios.get(
  //                 `${ZUVY_CONTENTS_API_URL}/zuvy-modules/${module_id}?populate=zuvy_articles&populate=zuvy_mcqs.quiz.qz`,
  //             );
  //         } catch (e) {
  //             return [{ status: 'error', message: "not found this module", code: 402 }];
  //         }

  //         let zuvy_articles = response.data.data.attributes.zuvy_articles;

  //         let zuvy_mcqs_ids = [];
  //         response.data.data.attributes.zuvy_mcqs.data.map((zuvy_mcqs) => {
  //             let mcqs_ids = zuvy_mcqs.attributes.quiz.map((mcq) => mcq.id);
  //             zuvy_mcqs_ids.push(...mcqs_ids);
  //         });
  //         let zuvy_assignment_ids = [];
  //         let zuvy_articles_ids = [];

  //         zuvy_articles.data.map((data) => {
  //             if (data.attributes.label == 'article') {
  //                 zuvy_articles_ids.push(data.id);
  //                 return;
  //             } else if (data.attributes.label == 'assignment') {
  //                 zuvy_assignment_ids.push(data.id);
  //                 return;
  //             }
  //         });

  //         let a = [];
  //         let b = [];
  //         let c = [];
  //         if (zuvy_articles_ids.length) {
  //             a = await db
  //                 .select()
  //                 .from(zuvyArticleTracking)
  //                 .where(
  //                     and(
  //                         inArray(zuvyArticleTracking.articleId, zuvy_articles_ids),
  //                         sql`${zuvyArticleTracking.userId} = ${user_id}`,
  //                     ),
  //                 ); //.where(sql`${zuvyArticleTracking.userId} = ${user_id}`);
  //         }
  //         if (zuvy_mcqs_ids.length) {
  //             b = await db
  //                 .select()
  //                 .from(quizTracking)
  //                 .where(
  //                     and(
  //                         inArray(quizTracking.mcqId, zuvy_mcqs_ids),
  //                         sql`${quizTracking.userId} = ${user_id}`,
  //                     ),
  //                 );
  //         }
  //         if (zuvy_assignment_ids.length) {
  //             c = await db
  //                 .select()
  //                 .from(assignmentSubmission)
  //                 .where(
  //                     and(
  //                         inArray(assignmentSubmission.assignmentId, zuvy_assignment_ids),
  //                         sql`${assignmentSubmission.userId} = ${user_id}`,
  //                     ),
  //                 );
  //         }

  //         let total_score = a.length + b.length + c.length;
  //         let total =
  //             zuvy_articles_ids.length +
  //             zuvy_mcqs_ids.length +
  //             zuvy_assignment_ids.length;
  //         let progress = Math.floor((total_score / total) * 100);

  //         let getmoduleTracking = await db
  //             .select()
  //             .from(moduleTracking)
  //             .where(
  //                 sql`${moduleTracking.userId} = ${user_id} and ${moduleTracking.moduleId} = ${module_id}`,
  //             );
  //         if (getmoduleTracking.length == 0) {
  //             let insertmoduleTracking = await db
  //                 .insert(moduleTracking)
  //                 .values({
  //                     userId: user_id,
  //                     moduleId: module_id,
  //                     progress,
  //                     bootcampId,
  //                 })
  //                 .returning();

  //             log(`insert the progress of the user_id:${user_id}, ${progress}`);
  //         } else {
  //             let updatemoduleTracking = await db
  //                 .update(moduleTracking)
  //                 .set({ progress: progress })
  //                 .where(
  //                     sql`${moduleTracking.userId} = ${user_id} and ${moduleTracking.moduleId} = ${module_id}`,
  //                 )
  //                 .returning();
  //             log(`update the progress of the user_id:${user_id}, ${progress}`);
  //         }
  //         await this.updateBootcampProgress(user_id, bootcampId);

  //         return [null, { progress }];
  //     } catch (e) {
  //         error(`ERROR: ${e.massage}  user_id:${user_id}`);
  //         return [{ status: 'error', message: e.message, code: 402 }];
  //     }
  // }

  // async updateBootcampProgress(user_id: number, bootcamp_id: number) {
  //     try {
  //         let getModules;
  //         try {
  //             getModules = await axios.get(
  //                 `${ZUVY_CONTENT_URL}/${bootcamp_id}?populate=zuvy_modules`,
  //             );
  //         } catch (e) {
  //             return [{ status: 'error', message: e.message, code: 402 }];
  //         }
  //         let modules = getModules.data.data.attributes.zuvy_modules.data;

  //         let getProgressByBootcampModule = await db
  //             .select()
  //             .from(moduleTracking)
  //             .where(
  //                 sql`${moduleTracking.userId} = ${user_id} and ${moduleTracking.bootcampId} = ${bootcamp_id}`,
  //             );

  //         let get_users_bootcamp = await db
  //             .select()
  //             .from(bootcampTracking)
  //             .where(
  //                 sql`${bootcampTracking.userId} = ${user_id} and ${bootcampTracking.bootcampId} = ${bootcamp_id}`,
  //             );

  //         let bootcamp_progress = 0;

  //         getProgressByBootcampModule.map((module) => {
  //             bootcamp_progress += module.progress;
  //         });

  //         bootcamp_progress = Math.floor(
  //             (bootcamp_progress / (modules.length * 100)) * 100,
  //         );
  //         if (get_users_bootcamp.length == 0) {
  //             let insertBootcampProgress = await db
  //                 .insert(bootcampTracking)
  //                 .values({
  //                     userId: user_id,
  //                     bootcampId: bootcamp_id,
  //                     progress: bootcamp_progress,
  //                 })
  //                 .returning();

  //             if (insertBootcampProgress.length) {
  //                 log(
  //                     `insert the progress of the user_id:${user_id}, ${bootcamp_progress}`,
  //                 );
  //                 return [null, { status: 'success', message: 'Progress insert' }];
  //             }
  //         } else {
  //             let updateBatch = await db
  //                 .update(bootcampTracking)
  //                 .set({ progress: bootcamp_progress })
  //                 .where(
  //                     sql`${bootcampTracking.userId} = ${user_id} and ${bootcampTracking.bootcampId} = ${bootcamp_id}`,
  //                 )
  //                 .returning();
  //             if (updateBatch.length) {
  //                 log(
  //                     `update the progress of the user_id:${user_id}, ${bootcamp_progress}`,
  //                 );
  //                 return [null, { status: 'success', message: 'Progress update' }];
  //             }
  //         }
  //     } catch (e) {
  //         return [{ status: 'error', message: e.message, code: 402 }];
  //     }
  // }

  // // Create
  // async submissionAssignment(
  //     data: any,
  //     bootcampId: number,
  //     assignmentId: number,
  //     userId: number,
  // ) {
  //     try {
  //         const res = await db
  //             .select()
  //             .from(assignmentSubmission)
  //             .where(
  //                 sql`${assignmentSubmission.userId} = ${userId} and ${assignmentSubmission.assignmentId} = ${assignmentId} and ${assignmentSubmission.bootcampId} = ${bootcampId}`,
  //             );
  //         if (res.length != 0) {
  //             const result = await db
  //                 .update(assignmentSubmission)
  //                 .set(data)
  //                 .where(
  //                     sql`${assignmentSubmission.assignmentId} = ${assignmentId} and ${assignmentSubmission.userId} = ${userId} and ${assignmentSubmission.bootcampId} = ${bootcampId}`,
  //                 )
  //                 .returning();
  //             let [err, res] = await this.getProgress(
  //                 data.userId,
  //                 data.moduleId,
  //                 bootcampId,
  //             );
  //             if (err) {
  //                 return [
  //                     null,
  //                     {
  //                         status: 'error',
  //                         message: "progrss haven't update!",
  //                         data: result[0],
  //                         code: 203,
  //                     },
  //                 ];
  //             }
  //             return [null, result[0]];
  //         }
  //         return [
  //             {
  //                 status: 'error',
  //                 message: 'Time not started to this assignment',
  //                 code: 402,
  //             },
  //         ];
  //     } catch (err) {
  //         return [{ status: 'error', message: err.message, code: 402 }];
  //     }
  // }

  // async assignmentSubmissionBy(userId: number, assignmentId: number) {
  //     try {
  //         const result = await db
  //             .select()
  //             .from(assignmentSubmission)
  //             .where(
  //                 sql`${assignmentSubmission.userId} = ${userId} and ${assignmentSubmission.assignmentId} = ${assignmentId}`,
  //             );
  //         return [null, result];
  //     } catch (err) {
  //         return [{ status: 'error', message: err.message, code: 402 }];
  //     }
  // }

  // // Read
  // async getAssignmentUpcomming(userId, bootcampId: number) {
  //     try {
  //         const result = await db
  //             .select()
  //             .from(assignmentSubmission)
  //             .where(
  //                 sql`${assignmentSubmission.userId} = ${userId} and ${assignmentSubmission.bootcampId} = ${bootcampId} and ${assignmentSubmission.projectUrl} is null`,
  //             );
  //         return [null, result];
  //     } catch (err) {
  //         return [{ status: 'error', message: err.message, code: 402 }];
  //     }
  // }

  // // Update
  // async updateAssignmentSubmission(id: number, data: any) {
  //     try {
  //         const result = await db
  //             .update(assignmentSubmission)
  //             .set(data)
  //             .where(sql`${assignmentSubmission.id} = ${id}`)
  //             .returning();
  //         return [null, result];
  //     } catch (err) {
  //         return [{ status: 'error', message: err.message, code: 402 }];
  //     }
  // }

  // // Create
  // async createzuvyArticleTracking(data: any, bootcampId: number) {
  //     try {
  //         const artical = await db
  //             .select()
  //             .from(zuvyArticleTracking)
  //             .where(
  //                 sql`${zuvyArticleTracking.articleId} = ${data.articleId} and ${zuvyArticleTracking.userId} = ${data.userId}`,
  //             );
  //         if (artical.length == 0) {
  //             const result = await db
  //                 .insert(zuvyArticleTracking)
  //                 .values(data)
  //                 .returning();
  //             let [err, out] = await this.getProgress(
  //                 data.userId,
  //                 data.moduleId,
  //                 bootcampId,
  //             );
  //             if (err) {
  //                 return [
  //                     null,
  //                     {
  //                         status: 'error',
  //                         message: "progrss haven't update!",
  //                         data: result[0],
  //                         code: 203,
  //                     },
  //                 ];
  //             }
  //             return [null, result[0]];
  //         }
  //         return [
  //             { status: 'error', message: 'Article already tracked', code: 402 },
  //         ];
  //     } catch (err) {
  //         return [{ status: 'error', message: err.message, code: 402 }];
  //     }
  // }

  // // Read
  // async zuvyArticleTrackingBy(ArticleId: number, userId: number) {
  //     try {
  //         const result = await db
  //             .select()
  //             .from(zuvyArticleTracking)
  //             .where(
  //                 sql`${zuvyArticleTracking.articleId} = ${ArticleId} and ${zuvyArticleTracking.userId} = ${userId}`,
  //             );

  //         return [null, result];
  //     } catch (err) {
  //         return [{ status: 'error', message: err.message, code: 402 }];
  //     }
  // }

  // // Read
  // async getzuvyArticleTracking(userId: number) {
  //     try {
  //         const result = await db
  //             .select()
  //             .from(zuvyArticleTracking)
  //             .where(sql`${zuvyArticleTracking.userId} = ${userId}`);
  //         return [null, result];
  //     } catch (err) {
  //         return [{ status: 'error', message: err.message, code: 402 }];
  //     }
  // }

  // // Update
  // async updatezuvyArticleTracking(id: number, data: any) {
  //     try {
  //         const result = await db
  //             .update(zuvyArticleTracking)
  //             .set(data)
  //             .where(sql`${zuvyArticleTracking.id} = ${id}`);
  //         return [null, result];
  //     } catch (err) {
  //         return [{ status: 'error', message: err.message, code: 402 }];
  //     }
  // }

  // // Create
  // async createQuizTracking(data: any, bootcampId: number) {
  //     try {
  //         const result = await db.insert(quizTracking).values(data).returning();
  //         await Promise.all(
  //             data.map((d) => this.getProgress(d.userId, d.moduleId, bootcampId)),
  //         );
  //         return [null, result];
  //     } catch (err) {
  //         return [{ status: 'error', message: err.message, code: 402 }];
  //     }
  // }

  // // Read
  // async getQuizTracking(userId: number) {
  //     try {
  //         const result = await db
  //             .select()
  //             .from(quizTracking)
  //             .where(sql`${quizTracking.userId} = ${userId}`);
  //         return [null, result];
  //     } catch (err) {
  //         return [{ status: 'error', message: err.message, code: 402 }];
  //     }
  // }

  // // Update
  // async updateQuizTracking(id: number, data: any) {
  //     try {
  //         const result = await db
  //             .update(quizTracking)
  //             .set(data)
  //             .where(sql`${quizTracking.id} = ${id}`)
  //             .returning();
  //         return [null, result];
  //     } catch (err) {
  //         return [{ status: 'error', message: err.message, code: 402 }];
  //     }
  // }

  // // Read
  // async quizTrackBy(quizId: number, userId: number) {
  //     try {
  //         const result = await db
  //             .select()
  //             .from(quizTracking)
  //             .where(
  //                 sql`${quizTracking.quizId} = ${quizId} and ${quizTracking.userId} = ${userId}`,
  //             );
  //         return [null, result];
  //     } catch (err) {
  //         return [{ status: 'error', message: err.message, code: 402 }];
  //     }
  // }
  // // get the latest artical, mcq and assignment ids, with the module id with bootcamp id
  // async getLatestIds(userId: number) {
  //     try {
  //         const latestIds = await db
  //             .select()
  //             .from(zuvyArticleTracking)
  //             .where(sql`${zuvyArticleTracking.userId} = ${userId}`)
  //             .orderBy(desc(zuvyArticleTracking.id)) // Fix: Call the desc() method on the column object
  //             .limit(1);

  //         const latestMcqIds = await db
  //             .select()
  //             .from(quizTracking)
  //             .where(sql`${quizTracking.userId} = ${userId}`)
  //             .orderBy(desc(quizTracking.id)) // Fix: Call the desc() method on the column object
  //             .limit(1);

  //         const latestAssignmentIds = await db
  //             .select()
  //             .from(assignmentSubmission)
  //             .where(sql`${assignmentSubmission.userId} = ${userId}`)
  //             .orderBy(desc(assignmentSubmission.id)) // Fix: Call the desc() method on the column object
  //             .limit(1);
  //         let totaldata = [latestIds[0], latestMcqIds[0], latestAssignmentIds[0]];
  //         if (totaldata.length == 0) {
  //             return [{ status: 'error', message: 'No data found', code: 404 }];
  //         }

  //         totaldata.sort(
  //             (a, b) =>
  //                 new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  //         );
  //         if (totaldata.length != 0) {
  //             let contents = await axios.get(
  //                 `${ZUVY_CONTENTS_API_URL}/zuvy-modules/${totaldata[0].moduleId}?populate=zuvy_contents`,
  //             );

  //             totaldata[0]['bootcampId'] =
  //                 contents.data.data.attributes.zuvy_contents.data[0].id;
  //             totaldata[0]['bootcamp_name'] =
  //                 contents.data.data.attributes.zuvy_contents.data[0].attributes.name;
  //             totaldata[0]['module_name'] = contents.data.data.attributes.name;
  //         }
  //         return [null, totaldata[0]];
  //     } catch (e) {
  //         return [{ status: 'error', message: e.message, code: 402 }];
  //     }
  // }

  // async assignmentTimeLine(data) {
  //     try {
  //         const res = await db
  //             .select()
  //             .from(assignmentSubmission)
  //             .where(
  //                 sql`${assignmentSubmission.userId} = ${data.userId} and ${assignmentSubmission.assignmentId} = ${data.assignmentId}`,
  //             );
  //         if (res.length == 0) {
  //             const result = await db
  //                 .insert(assignmentSubmission)
  //                 .values(data)
  //                 .returning();

  //             return [null, result[0]];
  //         }
  //         return [
  //             {
  //                 status: 'error',
  //                 message: 'Assignment time limit has started.',
  //                 code: 402,
  //             },
  //         ];
  //     } catch (err) {
  //         return [{ status: 'error', message: err.message, code: 402 }];
  //     }
  // }

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
          chapterTracked = await db
            .insert(zuvyChapterTracking)
            .values({
              userId: BigInt(userId),
              chapterId,
              moduleId,
              completedAt: sql`NOW()`,
            })
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
            returnedTrackingData = await db
              .insert(zuvyModuleTracking)
              .values({
                userId,
                moduleId,
                progress: Math.ceil((completedChapter / totalChapter) * 100),
                bootcampId,
                updatedAt: sql`NOW()`,
              })
              .returning();
          } else {
            returnedTrackingData = await db
              .update(zuvyModuleTracking)
              .set({
                progress: Math.ceil((completedChapter / totalChapter) * 100),
                updatedAt: sql`NOW()`,
              })
              .where(eq(zuvyModuleTracking.id, moduleTracking[0].id))
              .returning();
          }
          const recentBootcampForUser = await db.select().from(zuvyRecentBootcamp).where(eq(zuvyRecentBootcamp.userId, BigInt(userId)));
          if (recentBootcampForUser.length == 0) {
            const updatedRecentBootcamp = await db
              .insert(zuvyRecentBootcamp)
              .values({
                userId: BigInt(userId),
                moduleId,
                progress: Math.ceil((completedChapter / totalChapter) * 100),
                bootcampId,
                chapterId: chapterTracked[0].chapterId,
                updatedAt: sql`NOW()`,
              })
          }
          else {
            const updatedRecentBootcamp = await db
              .update(zuvyRecentBootcamp)
              .set({
                moduleId,
                progress: Math.ceil((completedChapter / totalChapter) * 100),
                bootcampId,
                chapterId: chapterTracked[0].chapterId,
                updatedAt: sql`NOW()`,
              })
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
        result = await db
          .insert(zuvyAssignmentSubmission)
          .values({
            userId,
            moduleId,
            chapterId,
            bootcampId,
            ...SubmitBody.submitAssignment,
            updatedAt: sql`Now()`,
          })
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
          moduleChapterData: true,
          projectData: true,
          moduleTracking: {
            columns: {
              progress: true,
            },
            where: (moduleTrack, { eq }) => eq(moduleTrack.userId, userId),
          },
        },
      });
      let modules = data.map((module: any) => {
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
          progress:
            module['moduleTracking'].length != 0
              ? module['moduleTracking'][0]['progress']
              : 0,
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
        };
      });

      if (modules.length > 0) {
        for (let i = 1; i < modules.length; i++) {
          if (modules[i - 1].progress == 100 && modules[i].isLock == false) {
            modules[i].isLock = false;
          } else {
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
        if(allChapters != 0 || projectModules.length !=0)
          {
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
       if(batchDetails['batchInfo'] != null)
        {
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

  async getAllUpcomingSubmission(userId: number,bootcampId:number)
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
      const completedChapterIds = await db.select({ id: zuvyChapterTracking.chapterId })
       .from(zuvyChapterTracking)
        .where( and( inArray(zuvyChapterTracking.chapterId, chapterIds), eq(zuvyChapterTracking.userId, BigInt(userId)) ) );
 
        const completedChapterIdsSet = new Set(completedChapterIds.map(chapter => chapter.id));

        const todayISOString = Date.now();
        
        const upcomingAssignments = [];
        const lateAssignments = [];
        
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
                        chapterTitle: chapter.title
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

      return {
        status:'success',
        code:200,
        upcomingAssignments,
        lateAssignments
      };
    }
    catch(err)
    {
        throw err;
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

      if(chapterDetails.length > 0){
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

                return{
                  status:"success",
                  code:200,
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
      else{
        return 'No Chapter found';
      }
    } catch (err) {
      throw err;
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
        const recentBootcampBody = { userId, moduleId, bootcampId, progress: 100, updatedAt: sql`NOW()` }
        const projectTracked = await db.insert(zuvyProjectTracking).values(updatedBody).returning();
        const moduleTracked = await db.insert(zuvyModuleTracking).values(moduleTrackingBody).returning();
        if (recentBootcampForUser.length == 0) {
          const updatedRecentBootcamp = await db
            .insert(zuvyRecentBootcamp)
            .values({
              userId: BigInt(userId),
              moduleId,
              progress: 100,
              bootcampId,
              updatedAt: sql`NOW()`,
            })
        }
        else {
          const updatedRecentBootcamp = await db
            .update(zuvyRecentBootcamp)
            .set({
              moduleId,
              progress: 100,
              bootcampId,
              chapterId: null,
              updatedAt: sql`NOW()`,
            })
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

  async getProjectDetailsWithStatus(projectId: number, moduleId: number, userId: number) {
    try {
      const data = await db.query.zuvyCourseModules.findFirst({
        where: (courseModules, { eq }) =>
          eq(courseModules.id, moduleId),
        with: {
          projectData: {
            where: (projectDetails, { eq }) =>
              eq(projectDetails.id, projectId),
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
      return {
        status: 'success',
        code: 200,
        projectDetails
      }
    } catch (err) {
      throw err;
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

  async getLatestUpdatedCourseForStudents(userId: number) {
    try {
      const latestTracking = await db.select().from(zuvyRecentBootcamp)
        .where(eq(zuvyRecentBootcamp.userId, BigInt(userId)));
      if (latestTracking.length > 0) {
        if (latestTracking[0].progress < 100) {
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
                }
              },
            },
          });
          const index = data['moduleChapterData'].findIndex(obj => obj.id === latestTracking[0].chapterId)
          const newChapter = data['moduleChapterData'][index + 1];
          return {
            moduleId: data.id,
            moduleName: data.name,
            typeId: data.typeId,
            bootcampId: data.bootcampId,
            bootcampName: data['moduleData'].name,
            newChapter
          }
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
            return {
              moduleId: data.id,
              moduleName: data.name,
              typeId: data.typeId,
              bootcampId: data['moduleData'].id,
              bootcampName: data['moduleData'],
              newChapter: data.typeId == 1 ? data['moduleChapterData'][0] : data['projectData'][0]
            };
          }
          else {
            return {
              status: 'error',
              code: 404,
              message: 'Start a course'
            }

          }
        }
      }
      else {
        return {
          status: 'error',
          code: 404,
          message: 'You have not yet started any course module'
        }
      }
    }
    catch (err) {
      throw err;
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

  async calculateTotalPoints(data: any) {
    const pointsMapping = {
      mcq: { "Easy": 1, "Medium": 2, "Hard": 3 },
      open: { "Easy": 3, "Medium": 5, "Hard": 7 },
      coding: { "Easy": 5, "Medium": 10, "Hard": 15 }
    };
    const totalMCQPoints = data.Quizzes.reduce((sum, q) => sum + pointsMapping.mcq[q.difficulty], 0);
    const totalOpenPoints = data.OpenEndedQuestions.reduce((sum, q) => sum + pointsMapping.open[q.difficulty], 0);
    const totalCodingPoints = data.CodingQuestions.reduce((sum, q) => sum + pointsMapping.coding[q.difficulty], 0);

    const totalPoints = totalMCQPoints + totalOpenPoints + totalCodingPoints;

    return { totalMCQPoints, totalOpenPoints, totalCodingPoints, totalPoints };
  }

  async calculateAssessmentResults(data, totalOpenEndedScore, totalQuizScore, totalCodingScore, codingSubmission) {

    let quizTotalAttemted = 0;
    let quizCorrect = 0;
    let quizScore = 0;

    let openTotalAttemted = 0;
    let openScore = 0;

    let codingTotalAttemted = 0
    let codingScore = 0

    // Difficulty Points Mapping
    const mcqPoints: { [key: string]: number } = { "Easy": 1, "Medium": 2, "Hard": 3 };
    // const openPoints: { [key: string]: number } = { "Easy": 3, "Medium": 5, "Hard": 7 };
    const codingPoints: { [key: string]: number } = { "Easy": 5, "Medium": 10, "Hard": 15 };

    // Processing Quizzes
    data.quizSubmission.forEach(quiz => {
      quizTotalAttemted += 1;
      if (quiz.chosenOption == quiz.submissionData?.Quiz.correctOption) {
        quizCorrect += 1;
        quizScore += mcqPoints[quiz.submissionData?.Quiz.difficulty];
      }
    });

    // Processing Open-Ended Questions
    // let needOpenScore = 0;
    data.openEndedSubmission.forEach(question => {
      openTotalAttemted += 1;
      // openScore += (question.marks > openPoints[question.submissionData?.OpenEndedQuestion.difficulty]) ? openPoints[question.submissionData?.OpenEndedQuestion.difficulty] : question.marks;
    });

    let needCodingScore = 0;

    data.PracticeCode.forEach(question => {
      let existingEntry = codingSubmission.find(entry => entry.id === question.questionId);      
      if (existingEntry) {
        if (!existingEntry.submissions) {
          existingEntry.submissions = [];
        }
        existingEntry.submissions.push({
          id: question.id,
          status: question.status,
          action: question.action,
          createdAt: question.createdAt,
          codingOutsourseId: question.codingOutsourseId
        });
      } else {
        codingTotalAttemted += 1;
        needCodingScore += codingPoints[question?.questionDetail.difficulty];
        codingSubmission.push({
          id: question.questionId,
          ...question.questionDetail,
          submissions: [{
            id: question.id,
            status: question.status,
            action: question.action,
            createdAt: question.createdAt,
            codingOutsourseId: question.codingOutsourseId
          }]
        });
      }
    });
    codingSubmission.forEach(question => {
      if (!question?.submissions) {
        question.submissions = [];
      }
    })
    const totalScore =  totalQuizScore + totalCodingScore;
    const needScore =  needCodingScore + quizScore

    // Calculate percentage
    const percentageScore = (needScore / totalScore) * 100;

    // Assessment pass status
    const passStatus = percentageScore >= data.submitedOutsourseAssessment?.passPercentage;

    data.openEndedSubmission = {
      openTotalAttemted,
    }
    data.quizSubmission = {
      quizTotalAttemted,
      quizCorrect,
      quizScore,
      totalQuizScore
    }
    data.PracticeCode = {
      codingTotalAttemted,
      needCodingScore,
      totalCodingScore
    }
    return { ...data, passStatus, percentageScore, passPercentage: data?.submitedOutsourseAssessment?.passPercentage, codingSubmission };
  }


  async assessmentOutsourseData(assessmentOutsourseId: number, req) {
    try {
      let { id } = req.user[0];
      const assessment = await db.query.zuvyOutsourseAssessments.findMany({
        where: (zuvyOutsourseAssessments, { eq }) =>
          eq(zuvyOutsourseAssessments.id, assessmentOutsourseId),
        with: {
          CodingQuestions: {
            columns: {
              id: true,
              assessmentOutsourseId: true,
              bootcampId: true
              
            },
            with: {
              CodingQuestion: true
            }
          },
          ModuleAssessment: true,
          Quizzes: {
            columns: {
              id: true,
              assessmentOutsourseId: true,
              bootcampId: true
            },
            with: {
              Quiz: true,
            }
          },
          OpenEndedQuestions: {
            columns: {
              id: true,
              assessmentOutsourseId: true,
              bootcampId: true
            },
            with: {
              OpenEndedQuestion: true
            }
          }
        },
      })

      if (assessment == undefined || assessment.length == 0) {
        throw ({
          status: 'error',
          statusCode: 404,
          message: 'Assessment not found',
        });
      }
      let startedAt = new Date().toISOString();
      let submission;
      submission = await db.select().from(zuvyAssessmentSubmission).where(sql`${zuvyAssessmentSubmission.userId} = ${id} AND ${zuvyAssessmentSubmission.assessmentOutsourseId} = ${assessmentOutsourseId} AND ${zuvyAssessmentSubmission.submitedAt} IS NULL`);
      if (submission.length == 0) {
        submission = await db.insert(zuvyAssessmentSubmission).values({ userId: id, assessmentOutsourseId, startedAt }).returning();
      }
      let formatedData = await this.formatedChapterDetails(assessment[0]);
      return { ...formatedData, submission: submission[0], codingQuestions:  assessment[0].CodingQuestions };
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
              email:true,
              name:true

            }
          },
          submitedOutsourseAssessment: true,
          openEndedSubmission: {
            columns: {
              id: true,
              answer: true,
              questionId: true,
              feedback: true,
              marks: true,
              startAt: true,
              submitedAt: true,
            },
            with: {
              submissionData: {
                with: {
                  OpenEndedQuestion: true
                }
              },

            }
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
                  Quiz: true
                }
              }
            }
          },
          PracticeCode: {
            columns: {
              id: true,
              questionSolved: true,
              questionId: true,
              status: true,
              action: true,
              token: true,
              createdAt: true,
              codingOutsourseId: true,
            },
            with: {
              questionDetail: true
            }
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
      let {codingQuestions, ...assessment_data} =  await this.assessmentOutsourseData(data.assessmentOutsourseId, {user: [{id: userId}]});
      const { totalMCQPoints, totalOpenPoints, totalCodingPoints, totalPoints } =  await this.calculateTotalPoints(assessment_data);  
      let total = {totalMCQPoints, totalOpenPoints, totalCodingPoints, totalPoints}
      let {OpenEndedQuestions, Quizzes, CodingQuestions} = assessment_data;
      let calData =  await this.calculateAssessmentResults(data, totalOpenPoints,totalMCQPoints, totalCodingPoints,codingQuestions);
      
      return {...calData, totalOpenEndedQuestions: OpenEndedQuestions.length,totalQuizzes:Quizzes.length, totalCodingQuestions: CodingQuestions.length};
    }
    catch (err) {
      throw err;
    }
  }
}

