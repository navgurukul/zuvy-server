import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, inArray, and, desc, arrayContains } from 'drizzle-orm';
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
          const result = await db
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
          if (moduleTracking.length == 0) {
            const results = await db
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
            const results = await db
              .update(zuvyModuleTracking)
              .set({
                progress: Math.ceil((completedChapter / totalChapter) * 100),
                updatedAt: sql`NOW()`,
              })
              .where(eq(zuvyModuleTracking.id, moduleTracking[0].id))
              .returning();
          }

          const totalModules = await db
            .select()
            .from(zuvyCourseModules)
            .where(eq(zuvyCourseModules.bootcampId, bootcampId));
          const projectModules = totalModules.filter((module) => module.typeId === 2);
          const projectModuleIds = projectModules.length > 0 ? projectModules.map((module) => module.id) : [];
          const completedProjectForAUser = projectModuleIds.length > 0 ? await db.select().from(zuvyModuleTracking).where(sql`${inArray(zuvyModuleTracking.moduleId,projectModuleIds)} and ${zuvyModuleTracking.userId} = ${userId}`) : [];
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
                  (allChapterTracking.length + completedProjectForAUser.length) / (allChapters.length+projectModules.length) * 100,
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
                    (allChapterTracking.length + completedProjectForAUser.length) / (allChapters.length+projectModules.length) * 100,
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
          .where(sql`${inArray(zuvyModuleQuiz.id, mcqIdArray)}`);
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
      console.error(err);
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
          const completedProjectForAUser = projectModuleIds.length > 0 ? await db.select().from(zuvyModuleTracking).where(sql`${inArray(zuvyModuleTracking.moduleId,projectModuleIds)} and ${zuvyModuleTracking.userId} = ${userId}`) : [];
          const moduleIds = moduleDetails.map((module) => module.id);
          const allChapterTracking = moduleIds.length > 0 ? await db
            .select()
            .from(zuvyChapterTracking)
            .where(
              sql`${inArray(zuvyChapterTracking.moduleId, moduleIds)} AND ${zuvyChapterTracking.userId} = ${userId}`,
            ): [];
          const allChapters = moduleIds.length > 0 ? totalLength :[];
          if(moduleIds.length == 0 || allChapters.length  == 0)
            {
                return {
                    status: 'error',
                    code: 404,
                    message: 'No chapters created for this course yet.'
                }
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
                progress: Math.ceil(
                  (allChapterTracking.length + completedProjectForAUser.length) / (allChapters+projectModules.length) * 100,
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
                    (allChapterTracking.length + completedProjectForAUser.length) / (allChapters+projectModules.length) * 100,
                  ),
                updatedAt: sql`NOW()`,
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
            where: (batchEnroll, { eq }) =>
                sql`${batchEnroll.userId} = ${BigInt(userId)} AND ${batchEnroll.bootcampId} = ${bootcampId}`,
            with: {
                batchInfo: {
                    with : {
                        instructorDetails : {
                            columns:{
                                id:true,
                                name:true,
                                profilePicture:true
                            }
                        }
                    }
                }
            },
          });
          
          
          const instructorDetails = {
            instructorId: Number(batchDetails['batchInfo']['instructorDetails']['id']),
            instructorName: batchDetails['batchInfo']['instructorDetails']['name'],
            instructorProfilePicture : batchDetails['batchInfo']['instructorDetails']['profilePicture']
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
      const AssignmentTracking = await db
        .select()
        .from(zuvyAssignmentSubmission)
        .where(
          sql`${zuvyAssignmentSubmission.userId} = ${userId} and ${zuvyAssignmentSubmission.chapterId} = ${chapterId} and ${zuvyAssignmentSubmission.moduleId} = ${moduleId} `,
        );

      const QuizTracking = await db
        .select()
        .from(zuvyQuizTracking)
        .where(
          sql`${zuvyQuizTracking.userId} = ${userId} and ${zuvyQuizTracking.chapterId} = ${chapterId} and ${zuvyQuizTracking.moduleId} = ${moduleId}`,
        );

      if (QuizTracking.length == 0) {
        const questions = await db
          .select({
            id: zuvyModuleQuiz.id,
            question: zuvyModuleQuiz.question,
            options: zuvyModuleQuiz.options,
          })
          .from(zuvyModuleQuiz);

        if (AssignmentTracking.length != 0) {
          return [
            {
              AssignmentTracking,
              questions,
            },
          ];
        } else {
          return [
            {
              questions,
            },
          ];
        }
      } else {
        const trackedData = await db
          .select({
            id: zuvyModuleQuiz.id,
            question: zuvyModuleQuiz.question,
            options: zuvyModuleQuiz.options,
            correctOption: zuvyModuleQuiz.correctOption,
            chosenOption: zuvyQuizTracking.chossenOption,
            status: zuvyQuizTracking.status,
          })
          .from(zuvyModuleQuiz)
          .leftJoin(
            zuvyQuizTracking,
            eq(zuvyModuleQuiz.id, zuvyQuizTracking.mcqId),
          );

        if (AssignmentTracking.length != 0) {
          return [
            {
              AssignmentTracking,
              trackedData,
            },
          ];
        } else {
          return [
            {
              trackedData,
            },
          ];
        }
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
    projectBody:UpdateProjectDto
  ) {
    try {
      const projectTrackingForUser = await db
        .select()
        .from(zuvyProjectTracking)
        .where(
          sql`${zuvyProjectTracking.userId}=${userId} and ${zuvyProjectTracking.projectId}=${projectId} and ${zuvyProjectTracking.moduleId} =${moduleId} and ${zuvyProjectTracking.bootcampId} = ${bootcampId}`,
        );
        let updatedBody = {bootcampId,moduleId,projectId,userId,...projectBody,updatedAt:sql`NOW()`}
       if(projectTrackingForUser.length > 0)
        {
            let updateProject = await db.update(zuvyProjectTracking).set(updatedBody).where(eq(zuvyProjectTracking.id,projectTrackingForUser[0].id)).returning();
            if(updateProject.length > 0)
                {
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
            const moduleTrackingBody = {userId,moduleId,bootcampId,progress: 100,createdAt: sql`NOW()`,updatedAt: sql `NOW()`}
            const projectTracked = await db.insert(zuvyProjectTracking).values(updatedBody).returning();
            const moduleTracked = await db.insert(zuvyModuleTracking).values(moduleTrackingBody).returning();
            if(projectTracked.length > 0 && moduleTracked.length > 0)
                {
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
    } catch (err) {}
  }

  async getProjectDetailsWithStatus(projectId:number,moduleId:number,userId:number)
  {
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
    }catch(err)
    {
       throw err;
    }
  }

  async allBootcampProgressForStudents(userId : number)
  {
    try {
        const data = await db.query.zuvyBatchEnrollments.findMany({
            columns : {
                bootcampId : true
            },
            where: (batchEnroll, { eq }) =>
              eq(batchEnroll.userId, BigInt(userId)),
            with: {
              bootcamp: {
                columns: {
                    id:true,
                    name:true,
                    coverImage: true
                },
                with : {
                    bootcampTracking: {
                        where: (bootcampTrack,{eq}) => 
                            eq(bootcampTrack.userId,userId)
                    }
                }
              }
            },
          });

          return data;
    }
    catch(err)
    {
       throw err;
    }
  }

  async getLatestUpdatedCourseForStudents(userId: number)
  {
    try {
        const latestTracking = await db.select().from(zuvyBootcampTracking)
        .where(eq(zuvyBootcampTracking.userId, userId))
        .orderBy(desc(zuvyBootcampTracking.updatedAt))
        .limit(1);
       
    }
    catch(err)
    {
      throw err;
    }
  }
  
}
