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
  codingQuestions,
  openEndedQuestion,
  moduleAssessment,
  questions,
  difficulty,
} from '../../../drizzle/schema';
import axios from 'axios';
import { error, log } from 'console';
import { sql, eq, count, inArray } from 'drizzle-orm';
import { db } from '../../db/index';
import { promises } from 'dns';
import {
  moduleDto,
  chapterDto,
  quizDto,
  quizBatchDto,
  ReOrderModuleBody,
  reOrderDto,
  EditChapterDto,
  openEndedDto,
  CreateAssessmentBody,
} from './dto/content.dto';
import { CreateProblemDto } from '../codingPlatform/dto/codingPlatform.dto';
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
    topicId: number
  ) {
    try {
      const existingChaptersForAModule = await db
        .select()
        .from(moduleChapter)
        .where(eq(moduleChapter.moduleId, moduleId));
      const order = existingChaptersForAModule.length + 1;
      var chapterData = { title:`Chapter ${order}`,moduleId, topicId, order };
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

  async createQuizForModule(quiz: quizBatchDto,chapterId:number) {
    try {
      const quizQuestions = quiz.questions.map((q) => ({
        question: q.question,
        options: q.options,
        correctOption: q.correctOption,
        marks: q.mark,
        difficulty: q.difficulty,
        tagId: q.tagId,
      }));

      const result = await db
        .insert(moduleQuiz)
        .values(quizQuestions)
        .returning();
        if (result.length > 0) {
            let quizIds = result.map((q) => {
              return q.id;
            });
            quizIds.push(...quiz.quizQuestionIds);
            await db
              .update(moduleChapter)
              .set({ quizQuestions: quizIds })
              .where(eq(moduleChapter.id, chapterId));
          }
      return result;
    } catch (err) {
      throw err;
    }
  }

//   async createChapterQuiz(
//     moduleId: number,
//     topicId: number,
//     module_chapter: chapterDto,
//   ) {
//     try {
//       const chapter = await this.createChapterForModule(
//         moduleId,
//         topicId,
//         module_chapter,
//       );
//       return chapter;
//     } catch (err) {
//       throw err;
//     }
//   }

  async createOpenEndedQuestions(questions: openEndedDto) {
    try {
      const openEndedQuestions = await db
        .insert(openEndedQuestion)
        .values(questions)
        .returning();
      return openEndedQuestions;
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
              timeAlloted: module.timeAlloted,
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
      const module = await db
        .select()
        .from(courseModules)
        .where(eq(courseModules.id, moduleId));
      const assessment = await db
        .select({
          assessmentTitle: moduleAssessment.title,
          assessmentId: moduleAssessment.id,
          timeDuration: moduleAssessment.timeLimit,
        })
        .from(moduleAssessment)
        .where(eq(moduleAssessment.moduleId, module[0].id));
      const chapterNameWithId = await db
        .select({
          chapterId: moduleChapter.id,
          chapterTitle: moduleChapter.title,
          topicId: moduleChapter.topicId,
          order: moduleChapter.order,
        })
        .from(moduleChapter)
        .where(eq(moduleChapter.moduleId, moduleId))
        .orderBy(moduleChapter.order);

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
          order: ch.order,
        };
      });

      return { chapterWithTopic, moduleName: module[0].name, assessment };
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
        const modifiedChapterDetails: {
            id: number;
            moduleId: number;
            topicId: number;
            order: number;
            quizQuestionDetails?: any[];
            codingQuestionDetails?: any[];
            contentDetails?: any[]
        } = {
            id: chapterDetails[0].id,
            moduleId: chapterDetails[0].moduleId,
            topicId: chapterDetails[0].topicId,
            order: chapterDetails[0].order,
        };

      if (chapterDetails.length > 0) {
        if (chapterDetails[0].topicId == 4) {
          const quizIds = Object.values(chapterDetails[0].quizQuestions);
          const quizDetails = await db
            .select()
            .from(moduleQuiz)
            .where(sql`${inArray(moduleQuiz.id, quizIds)}`);
          modifiedChapterDetails.quizQuestionDetails = quizDetails;
        }
        if (chapterDetails[0].topicId == 3) {
          const codingIds = Object.values(chapterDetails[0].codingQuestions);
          const codingProblemDetails = await db
            .select()
            .from(codingQuestions)
            .where(sql`${inArray(codingQuestions.id, codingIds)}`);
          modifiedChapterDetails.codingQuestionDetails = codingProblemDetails;
        } else {
          let content = [{
            title: chapterDetails[0].title,
            description: chapterDetails[0].description,
            links: chapterDetails[0].links,
            file: chapterDetails[0].file,
            content:chapterDetails[0].content
          }];
          modifiedChapterDetails.contentDetails = content;
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
    reorderData: ReOrderModuleBody,
    bootcampId: number,
    moduleId: number,
  ) {
    try {
      if (reorderData.moduleDto == undefined) {
        const { newOrder } = reorderData.reOrderDto;

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
      } else if (reorderData.reOrderDto == undefined) {
        await db
          .update(courseModules)
          .set(reorderData.moduleDto)
          .where(eq(courseModules.id, moduleId));
      }
      return {
        message: 'Modified successfully',
      };
    } catch (err) {
      throw err;
    }
  }

  async createCodingProblemForModule(
    moduleId: number,
    chapterId:number,
    codingProblem: CreateProblemDto,
  ) {
    try {
        let examples = [];
        let testCases = [];
        for (let i = 0; i < codingProblem.examples.length; i++) {
          examples.push(codingProblem.examples[i].inputs);
        }
        codingProblem.examples = examples;
        for (let j = 0; j < codingProblem.testCases.length; j++) {
          testCases.push(codingProblem.testCases[j].inputs);
        }
        codingProblem.testCases = testCases;
        const result = await db
          .insert(codingQuestions)
          .values(codingProblem)
          .returning();
        if (result.length > 0) {
          let codingIds = result.map((q) => {
            return q.id;
          });
          await db
            .update(moduleChapter)
            .set({ codingQuestions: codingIds })
            .where(eq(moduleChapter.id, chapterId));
        }
        return result;
     
    } catch (err) {
      throw err;
    }
  }

  async editChapter(
    editData: EditChapterDto,
    moduleId: number,
    chapterId: number,
  ) {
    try {
      if (editData.newOrder != undefined) {
        const { newOrder } = editData;

        const chapters = await db
          .select()
          .from(moduleChapter)
          .where(eq(moduleChapter.moduleId, moduleId))
          .orderBy(moduleChapter.order);

        const draggedModuleIndex = chapters.findIndex(
          (m) => m.id === chapterId,
        );

        if (draggedModuleIndex + 1 > newOrder) {
          for (
            let i = newOrder - 1;
            i <= draggedModuleIndex + 1 - newOrder;
            i++
          ) {
            await db
              .update(moduleChapter)
              .set({ order: chapters[i].order + 1 })
              .where(eq(moduleChapter.id, chapters[i].id));
          }
          await db
            .update(moduleChapter)
            .set({ order: newOrder })
            .where(eq(moduleChapter.id, chapterId));
        } else if (draggedModuleIndex + 1 < newOrder) {
          let counting = newOrder - (draggedModuleIndex + 1);
          let ordering = newOrder - 1;
          while (counting > 0) {
            await db
              .update(moduleChapter)
              .set({ order: chapters[ordering].order - 1 })
              .where(eq(moduleChapter.id, chapters[ordering].id));
            counting = counting - 1;
            ordering = ordering - 1;
          }

          await db
            .update(moduleChapter)
            .set({ order: newOrder })
            .where(eq(moduleChapter.id, chapterId));
        }
      } else if (editData.newOrder == undefined) {
        await db
          .update(moduleChapter)
          .set(editData)
          .where(eq(moduleChapter.id, chapterId));
      }
      return {
        message: 'Modified successfully',
      };
    } catch (err) {
      throw err;
    }
  }

  async createAssessment(
    moduleId: number,
    assessmentBody: CreateAssessmentBody,
  ) {
    try {
      const assessment = { ...assessmentBody, moduleId };
      const newAssessment = await db
        .insert(moduleAssessment)
        .values(assessment)
        .returning();
      return newAssessment;
    } catch (err) {
      throw err;
    }
  }

  async getAssessmentDetails(moduleId: number) {
    try {
      const assessment = await db
        .select()
        .from(moduleAssessment)
        .where(eq(moduleAssessment.moduleId, moduleId));
      if (assessment.length > 0) {
        const ab = Object.values(assessment[0].codingProblems);
        const codingQuesIds = ab.reduce((acc, obj) => {
          const key = Object.keys(obj)[0];
          const numericKey = Number(key);
          if (!isNaN(numericKey)) {
            acc.push(numericKey);
          }
          return acc;
        }, []);
        const mcqIds = Object.values(assessment[0].mcq);
        const openEndedQuesIds = Object.values(
          assessment[0].openEndedQuestions,
        );
        const mcqDetails = await db
          .select()
          .from(moduleQuiz)
          .where(sql`${inArray(moduleQuiz.id, mcqIds)}`);
        const openEndedQuesDetails = await db
          .select()
          .from(openEndedQuestion)
          .where(sql`${inArray(openEndedQuestion.id, openEndedQuesIds)}`);
        const codingProblems = await db
          .select()
          .from(codingQuestions)
          .where(sql`${inArray(codingQuestions.id, codingQuesIds)}`);
        let codingQuesDetails = [];
        for (let i = 0; i < codingProblems.length; i++) {
          codingQuesDetails.push({
            ...codingProblems[i],
            marks: Object.values(ab[i])[0],
          });
        }

        return {
          assessment,
          mcqDetails,
          openEndedQuesDetails,
          codingQuesDetails,
        };
      }
    } catch (err) {
      throw err;
    }
  }
}
