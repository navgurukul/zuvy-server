import { Injectable, Logger } from '@nestjs/common';
import {
  moduleTracking,
  assignmentSubmission,
  articleTracking,
  quizTracking,
  moduleChapter,
  topics,
  courseModules,
  moduleQuiz,
  questions,
} from '../../../drizzle/schema';
import axios from 'axios';
import { error, log } from 'console';
import { sql, eq, count } from 'drizzle-orm';
import { db } from '../../db/index';
import { promises } from 'dns';
import {
  moduleDto,
  chapterDto,
  quizDto,
  quizBatchDto,
} from './dto/content.dto';
// import Strapi from "strapi-sdk-js"

const { ZUVY_CONTENT_URL, ZUVY_CONTENTS_API_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

// const strapi = new Strapi({url: ZUVY_CONTENTS_API_URL})
@Injectable()
export class ContentService {
  async lockContent(modules__, module_id = null) {
    let index = 0;
    while (index < modules__.length) {
      let index_run = index + 1;
      if (index == 0) {
        modules__[index]['lock'] = true;
      }
      if (index_run < modules__.length) {
        if (modules__[index].progress >= 100) {
          modules__[index_run]['lock'] = true;
        } else {
          modules__[index_run]['lock'] = false;
        }
      }
      index++;
    }
    return modules__;
  }

  async getModules(bootcamp_id, user_id) {
    try {
      let respo = await axios.get(
        ZUVY_CONTENT_URL + `/${bootcamp_id}?populate=zuvy_modules`,
      );
      let modules = respo.data.data.attributes.zuvy_modules.data;

      // if (user_id){
      let modulePromises = modules.map(async (m) => {
        if (user_id) {
          let getModuleTracking = await db
            .select()
            .from(moduleTracking)
            .where(
              sql`${moduleTracking.userId} = ${user_id} and ${moduleTracking.moduleId} = ${m.id}`,
            );
          if (getModuleTracking.length == 0) {
            m.attributes['progress'] = 0;
          } else {
            m.attributes['progress'] = getModuleTracking[0].progress || 0;
          }
        }
        return {
          id: m.id,
          ...m.attributes,
        };
      });

      modules = await Promise.all(modulePromises);
      modules = await this.lockContent(modules);
      // }
      return [null, modules];
    } catch (err) {
      error(`Error posting data: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }
  async getChapter(module_id: number, user_id: number) {
    try {
      const response = await axios.get(
        `${ZUVY_CONTENTS_API_URL}/zuvy-modules/${module_id}?populate=zuvy_articles&populate=zuvy_mcqs.quiz.qz&populate=zuvy_contents`,
      );
      const zuvy_articles = response.data.data.attributes.zuvy_articles.data;
      const zuvy_mcqs = response.data.data.attributes.zuvy_mcqs;
      const zuvy_contents = response.data.data.attributes.zuvy_contents.data[0];
      delete response.data.data.attributes.zuvy_contents;

      interface QuizItem {
        id: number;
        question: string;
        qz: {
          number: number;
          value: { children: { text: string }[] }[];
          correct: boolean;
        }[];
      }

      interface McqItem {
        attributes: any;
        id: number;
        label: string;
        quiz: QuizItem[];
      }
      const formattedData = zuvy_mcqs.data.map((item: McqItem) => {
        const questions = item.attributes.quiz.map((quizItem: QuizItem) => {
          const options = quizItem.qz.map((q) => ({
            text: q.value[0].children[0].text,
            correct: q.correct,
            number: q.number,
          }));
          return { id: quizItem.id, question: quizItem.question, options };
        });
        return {
          id: item.id,
          label: item.attributes.label,
          index: item.attributes.index,
          questions,
        };
      });
      const formattedArticles = zuvy_articles.map((article: any) => ({
        id: article.id,
        ...article.attributes,
      }));

      let chapter = [...formattedArticles, ...formattedData];

      if (user_id) {
        let [error, bootcampLock] = await this.getModules(
          zuvy_contents.id,
          user_id,
        );
        if (error) {
          return [error, null];
        }
        let hasUnlockedModule = bootcampLock.some(
          (b) => b.id == module_id && b.lock == false,
        );

        if (hasUnlockedModule) {
          return [
            {
              status: 'error',
              message:
                "you can't open this module because you haven't completed the last module",
              code: 402,
            },
          ];
        }
        const getModuleTracking = await db
          .select()
          .from(moduleTracking)
          .where(
            sql`${moduleTracking.userId} = ${user_id} and ${moduleTracking.moduleId} = ${module_id}`,
          );
        if (getModuleTracking.length == 0) {
          chapter['progress'] = 0;
        } else {
          chapter['progress'] = getModuleTracking[0].progress || 0;
        }

        let promises = chapter.map(async (c) => {
          if (c.label == 'article') {
            let getArticleTracking = await db
              .select()
              .from(articleTracking)
              .where(
                sql`${articleTracking.userId} = ${user_id} and ${articleTracking.moduleId} = ${module_id} and ${articleTracking.articleId} = ${c.id}`,
              );
            if (getArticleTracking.length == 0) {
              c['completed'] = false;
            } else {
              c['completed'] = true;
            }
          } else if (c.label == 'assignment') {
            let getAssignmentSubmission = await db
              .select()
              .from(assignmentSubmission)
              .where(
                sql`${assignmentSubmission.userId} = ${user_id} and ${assignmentSubmission.moduleId} =  ${module_id} and ${assignmentSubmission.assignmentId} = ${c.id}`,
              );
            if (getAssignmentSubmission.length == 0) {
              c['completed'] = false;
            } else {
              c['completed'] = true;
            }
          } else if (c.label == 'quiz') {
            let getQuizSubmission = await db
              .select()
              .from(quizTracking)
              .where(
                sql`${quizTracking.userId} = ${user_id} and ${quizTracking.moduleId} = ${module_id} and ${quizTracking.quizId} = ${c.id}`,
              );
            if (getQuizSubmission.length == 0) {
              c['completed'] = false;
            } else {
              c['completed'] = true;
            }
          }
          return c;
        });

        chapter = await Promise.all(promises);
      }

      return [null, chapter];
    } catch (err) {
      error(`Error posting data: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async createModuleForCourse(bootcampId: number, module: moduleDto) {
    try {
      const noOfModuleOfBootcamp = await db
        .select({ count: count(courseModules.id) })
        .from(courseModules)
        .where(eq(courseModules.bootcampId, bootcampId));

      var moduleWithBootcamp = {
        bootcampId,
        ...module,
        order: noOfModuleOfBootcamp[0].count + 1,
      };
      const moduleData = await db
        .insert(courseModules)
        .values(moduleWithBootcamp)
        .returning();

      return {
        status: 'success',
        message: 'Module created successfully for this course',
        code: 200,
        module: moduleData,
      };
    } catch (err) {
      throw err;
    }
  }

  async createChapterForModule(
    moduleId: number,
    topicId: number,
    module_chapter: chapterDto,
  ) {
    try {
      var chapterData = { moduleId, topicId, ...module_chapter };
      const chapter = await db
        .insert(moduleChapter)
        .values(chapterData)
        .returning();

      return {
        status: 'success',
        message: 'Chapter created successfully for this module',
        code: 200,
        module: chapter,
      };
    } catch (err) {
      throw err;
    }
  }

  async createQuizForModule(
    moduleId: number,
    topicId: number,
    module_chapter: chapterDto,
    quiz: quizBatchDto,
  ) {
    try {
      const chapter = await this.createChapterForModule(
        moduleId,
        topicId,
        module_chapter,
      );
      if (chapter.status === 'success') {
        const quizQuestions = quiz.questions.map((q) => ({
          question: q.question,
          options: q.options,
          correctOption: q.correctOption,
        }));
        const quizData = {
          chapterId: chapter.module[0].id,
          questions: quizQuestions,
        };
        const result = await db.insert(moduleQuiz).values(quizData).returning();
        return result;
      } else {
        throw new Error('Failed to create chapter');
      }
    } catch (err) {
      throw err;
    }
  }

  async getAllModuleByBootcampId(bootcampId: number) {
    try {
      const allModules = await db
        .select()
        .from(courseModules)
        .where(eq(courseModules.bootcampId, bootcampId))
        .orderBy(courseModules.order);

      if (allModules.length > 0) {
        const modulesWithDetails = await Promise.all(
          allModules.map(async (module) => {
            const quizCount = await db
              .select({ count: count(moduleChapter.topicId) })
              .from(moduleChapter)
              .where(
                sql`${moduleChapter.moduleId} = ${module.id} AND ${moduleChapter.topicId} = 4`,
              );
            const assignmentCount = await db
              .select({ count: count(moduleChapter.topicId) })
              .from(moduleChapter)
              .where(
                sql`${moduleChapter.moduleId} = ${module.id} AND ${moduleChapter.topicId} = 5`,
              );
            const codingQuestionCount = await db
              .select({ count: count(moduleChapter.topicId) })
              .from(moduleChapter)
              .where(
                sql`${moduleChapter.moduleId} = ${module.id} AND ${moduleChapter.topicId} = 3`,
              );
            const articleCount = await db
              .select({ count: count(moduleChapter.topicId) })
              .from(moduleChapter)
              .where(
                sql`${moduleChapter.moduleId} = ${module.id} AND ${moduleChapter.topicId} = 2`,
              );

            return {
              id: module.id,
              name: module.name,
              description: module.description,
              order: module.order,
              quizCount: quizCount[0].count,
              assignmentCount: assignmentCount[0].count,
              codingProblemsCount: codingQuestionCount[0].count,
              articlesCount: articleCount[0].count,
              //chapters: chapters,
            };
          }),
        );

        return modulesWithDetails;
      }

      return [];
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  async getAllChaptersOfModule(moduleId: number) {
    try {
      const chapterNameWithId = await db
        .select({
          chapterId: moduleChapter.id,
          chapterTitle: moduleChapter.title,
          topicId: moduleChapter.topicId,
        })
        .from(moduleChapter)
        .where(eq(moduleChapter.moduleId, moduleId));

      const topicNames = await db
        .select({
          topicId: topics.id,
          topicName: topics.name,
        })
        .from(topics);

      const chapterWithTopic = chapterNameWithId.map((ch) => {
        const topicInfo = topicNames.find(
          (topic) => topic.topicId === ch.topicId,
        );
        return {
          chapterId: ch.chapterId,
          chapterTitle: ch.chapterTitle,
          topicId: ch.topicId,
          topicName: topicInfo?.topicName || 'Unknown',
        };
      });

      return chapterWithTopic;
    } catch (err) {
      throw err;
    }
  }

  async getChapterDetailsById(chapterId: number) {
    try {
      const chapterDetails = await db
        .select()
        .from(moduleChapter)
        .where(eq(moduleChapter.id, chapterId));
      var modifiedChapterDetails = { ...chapterDetails, questionDetails: [] };
      if (chapterDetails.length > 0) {
        if (chapterDetails[0].topicId == 4) {
          const quizDetails = await db
            .select()
            .from(moduleQuiz)
            .where(eq(moduleQuiz.chapterId, chapterId));
          modifiedChapterDetails.questionDetails = quizDetails;
        }
        return modifiedChapterDetails;
      } else {
        return 'No Chapter found';
      }
    } catch (err) {
      throw err;
    }
  }

  async updateOrderOfModules(
    reorderData: {
      moduleId: number;
      newOrder: number;
    },
    bootcampId: number,
  ) {
    try {
      const { moduleId, newOrder } = reorderData;

      const modules = await db
        .select()
        .from(courseModules)
        .where(eq(courseModules.bootcampId, bootcampId))
        .orderBy(courseModules.order);

      const draggedModuleIndex = modules.findIndex((m) => m.id === moduleId);

      if (draggedModuleIndex + 1 > newOrder) {
        for (
          let i = newOrder - 1;
          i <= draggedModuleIndex + 1 - newOrder;
          i++
        ) {
          await db
            .update(courseModules)
            .set({ order: modules[i].order + 1 })
            .where(eq(courseModules.id, modules[i].id));
        }
        await db
          .update(courseModules)
          .set({ order: newOrder })
          .where(eq(courseModules.id, moduleId));
      } else if (draggedModuleIndex + 1 < newOrder) {
        let counting = newOrder - (draggedModuleIndex + 1);
        let ordering = newOrder - 1;
        while (counting > 0) {
          await db
            .update(courseModules)
            .set({ order: modules[ordering].order - 1 })
            .where(eq(courseModules.id, modules[ordering].id));
          counting = counting - 1;
          ordering = ordering - 1;
        }

        await db
          .update(courseModules)
          .set({ order: newOrder })
          .where(eq(courseModules.id, moduleId));
      }
      return {
        message: 'Re-ordered successfully',
      };
    } catch (err) {
      throw err;
    }
  }
}
