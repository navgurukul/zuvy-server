import { Injectable, Logger } from '@nestjs/common';
import {
  moduleTracking,
  assignmentSubmission,
  articleTracking,
  quizTracking,
  zuvyModuleChapter,
  zuvyModuleTopics,
  zuvyCourseModules,
  zuvyModuleQuiz,
  zuvyCodingQuestions,
  zuvyOpenEndedQuestion,
  zuvyModuleAssessment,
  zuvyChapterTracking,
  batchEnrollments,
  moduleChapterRelations,
  questions,
  difficulty,
  assessment,
  postsRelations,
} from '../../../drizzle/schema';
import axios from 'axios';
import { error, log } from 'console';
import { sql, eq, count, inArray, and, or } from 'drizzle-orm';
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
import { PatchBootcampSettingDto } from '../bootcamp/dto/bootcamp.dto';
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
        .select({ count: count(zuvyCourseModules.id) })
        .from(zuvyCourseModules)
        .where(eq(zuvyCourseModules.bootcampId, bootcampId));

      var moduleWithBootcamp = {
        bootcampId,
        ...module,
        order: noOfModuleOfBootcamp[0].count + 1,
      };
      const moduleData = await db
        .insert(zuvyCourseModules)
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

  async createChapterForModule(moduleId: number, topicId: number) {
    try {
      const existingChaptersForAModule = await db
        .select()
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.moduleId, moduleId));
      const order = existingChaptersForAModule.length + 1;
      var chapterData = { title: `Chapter ${order}`, moduleId, topicId, order };
      const chapter = await db
        .insert(zuvyModuleChapter)
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

  async createQuizForModule(quiz: quizBatchDto, chapterId: number) {
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
        .insert(zuvyModuleQuiz)
        .values(quizQuestions)
        .returning();
      if (result.length > 0) {
        let quizIds = result.map((q) => {
          return q.id;
        });
        quizIds.push(...quiz.quizQuestionIds);
        await db
          .update(zuvyModuleChapter)
          .set({ quizQuestions: quizIds })
          .where(eq(zuvyModuleChapter.id, chapterId));
      }
      return result;
    } catch (err) {
      throw err;
    }
  }

  async createOpenEndedQuestions(questions: openEndedDto) {
    try {
      const openEndedQuestions = await db
        .insert(zuvyOpenEndedQuestion)
        .values(questions)
        .returning();
      return openEndedQuestions;
    } catch (err) {
      throw err;
    }
  }

  async getAllModuleByBootcampId(bootcampId: number) {
    try {
      const data = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq }) =>
          eq(courseModules.bootcampId, bootcampId),
        with: {
          moduleChapterData: true,
        },
      });
      let modules = data.map((module) => {
        return {
          id: module.id,
          name: module.name,
          description: module.description,
          order: module.order,
          timeAlloted: module.timeAlloted,
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

      return modules;
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  async getAllChaptersOfModule(moduleId: number) {
    try {
      const module = await db
        .select()
        .from(zuvyCourseModules)
        .where(eq(zuvyCourseModules.id, moduleId));
      const assessment = await db
        .select({
          assessmentTitle: zuvyModuleAssessment.title,
          assessmentId: zuvyModuleAssessment.id,
          timeDuration: zuvyModuleAssessment.timeLimit,
        })
        .from(zuvyModuleAssessment)
        .where(eq(zuvyModuleAssessment.moduleId, module[0].id));
      const chapterNameWithId = await db
        .select({
          chapterId: zuvyModuleChapter.id,
          chapterTitle: zuvyModuleChapter.title,
          topicId: zuvyModuleChapter.topicId,
          order: zuvyModuleChapter.order,
        })
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.moduleId, moduleId))
        .orderBy(zuvyModuleChapter.order);

      const topicNames = await db
        .select({
          topicId: zuvyModuleTopics.id,
          topicName: zuvyModuleTopics.name,
        })
        .from(zuvyModuleTopics);

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
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.id, chapterId));
      const modifiedChapterDetails: {
        id: number;
        moduleId: number;
        topicId: number;
        order: number;
        quizQuestionDetails?: any[];
        codingQuestionDetails?: any[];
        contentDetails?: any[];
      } = {
        id: chapterDetails[0].id,
        moduleId: chapterDetails[0].moduleId,
        topicId: chapterDetails[0].topicId,
        order: chapterDetails[0].order,
      };

      if (chapterDetails.length > 0) {
        if (chapterDetails[0].topicId == 4) {
          const quizDetails =
            chapterDetails[0].quizQuestions !== null
              ? await db
                  .select()
                  .from(zuvyModuleQuiz)
                  .where(
                    sql`${inArray(zuvyModuleQuiz.id, Object.values(chapterDetails[0].quizQuestions))}`,
                  )
              : [];
          modifiedChapterDetails.quizQuestionDetails = quizDetails;
        } else if (chapterDetails[0].topicId == 3) {
          const codingProblemDetails =
            chapterDetails[0].codingQuestions !== null
              ? await db
                  .select()
                  .from(zuvyCodingQuestions)
                  .where(
                    eq(zuvyCodingQuestions.id,chapterDetails[0].codingQuestions),
                  )
              : [];
          modifiedChapterDetails.codingQuestionDetails = codingProblemDetails;
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
          .from(zuvyCourseModules)
          .where(eq(zuvyCourseModules.bootcampId, bootcampId))
          .orderBy(zuvyCourseModules.order);

        const draggedModuleIndex = modules.findIndex((m) => m.id === moduleId);

        if (draggedModuleIndex + 1 > newOrder) {
          for (
            let i = newOrder - 1;
            i <= draggedModuleIndex + 1 - newOrder;
            i++
          ) {
            await db
              .update(zuvyCourseModules)
              .set({ order: modules[i].order + 1 })
              .where(eq(zuvyCourseModules.id, modules[i].id));
          }
          await db
            .update(zuvyCourseModules)
            .set({ order: newOrder })
            .where(eq(zuvyCourseModules.id, moduleId));
        } else if (draggedModuleIndex + 1 < newOrder) {
          let counting = newOrder - (draggedModuleIndex + 1);
          let ordering = newOrder - 1;
          while (counting > 0) {
            await db
              .update(zuvyCourseModules)
              .set({ order: modules[ordering].order - 1 })
              .where(eq(zuvyCourseModules.id, modules[ordering].id));
            counting = counting - 1;
            ordering = ordering - 1;
          }

          await db
            .update(zuvyCourseModules)
            .set({ order: newOrder })
            .where(eq(zuvyCourseModules.id, moduleId));
        }
      } else if (reorderData.reOrderDto == undefined) {
        await db
          .update(zuvyCourseModules)
          .set(reorderData.moduleDto)
          .where(eq(zuvyCourseModules.id, moduleId));
      }
      return {
        message: 'Modified successfully',
      };
    } catch (err) {
      throw err;
    }
  }

  async createCodingProblemForModule(
    chapterId: number,
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
        .insert(zuvyCodingQuestions)
        .values(codingProblem)
        .returning();
      if (result.length > 0) {
        let codingIds = result.map((q) => {
          return q.id;
        });
        const questionId = codingIds[0];
        await db
          .update(zuvyModuleChapter)
          .set({ codingQuestions: questionId })
          .where(eq(zuvyModuleChapter.id, chapterId));
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
          .from(zuvyModuleChapter)
          .where(eq(zuvyModuleChapter.moduleId, moduleId))
          .orderBy(zuvyModuleChapter.order);

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
              .update(zuvyModuleChapter)
              .set({ order: chapters[i].order + 1 })
              .where(eq(zuvyModuleChapter.id, chapters[i].id));
          }
          await db
            .update(zuvyModuleChapter)
            .set({ order: newOrder })
            .where(eq(zuvyModuleChapter.id, chapterId));
        } else if (draggedModuleIndex + 1 < newOrder) {
          let counting = newOrder - (draggedModuleIndex + 1);
          let ordering = newOrder - 1;
          while (counting > 0) {
            await db
              .update(zuvyModuleChapter)
              .set({ order: chapters[ordering].order - 1 })
              .where(eq(zuvyModuleChapter.id, chapters[ordering].id));
            counting = counting - 1;
            ordering = ordering - 1;
          }

          await db
            .update(zuvyModuleChapter)
            .set({ order: newOrder })
            .where(eq(zuvyModuleChapter.id, chapterId));
        }
      } else if (editData.newOrder == undefined) {
        await db
          .update(zuvyModuleChapter)
          .set(editData)
          .where(eq(zuvyModuleChapter.id, chapterId));
      }
      return {
        message: 'Modified successfully',
      };
    } catch (err) {
      throw err;
    }
  }

  async createAssessment(moduleId: number) {
    try {
      const assessment = {
        title: `Assessment for module number ${moduleId}`,
        moduleId,
      };
      const newAssessment = await db
        .insert(zuvyModuleAssessment)
        .values(assessment)
        .returning();
      return newAssessment;
    } catch (err) {
      throw err;
    }
  }

  async editAssessment(
    assessmentId: number,
    assessmentBody: CreateAssessmentBody,
  ) {
    try {
      await db
        .update(zuvyModuleAssessment)
        .set(assessmentBody)
        .where(eq(zuvyModuleAssessment.id, assessmentId))
        .returning();
      return {
        status: 'success',
        code: 200,
        message: 'Updated successfully',
      };
    } catch (err) {
      throw err;
    }
  }

  async getAssessmentDetails(moduleId: number) {
    try {
      const assessment = await db
        .select()
        .from(zuvyModuleAssessment)
        .where(eq(zuvyModuleAssessment.moduleId, moduleId));

      if (assessment.length > 0) {
        let ab = [];
        ab = Object.values(assessment[0].codingProblems);
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
          .from(zuvyModuleQuiz)
          .where(sql`${inArray(zuvyModuleQuiz.id, mcqIds)}`);
        const openEndedQuesDetails = await db
          .select()
          .from(zuvyOpenEndedQuestion)
          .where(sql`${inArray(zuvyOpenEndedQuestion.id, openEndedQuesIds)}`);
        const codingProblems = await db
          .select()
          .from(zuvyCodingQuestions)
          .where(sql`${inArray(zuvyCodingQuestions.id, codingQuesIds)}`);
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

  async deleteModule(moduleId: number, bootcampId: number): Promise<any> {
    try {
      let data = await db
        .delete(zuvyCourseModules)
        .where(eq(zuvyCourseModules.id, moduleId))
        .returning();
      if (data.length === 0) {
        return [
          { status: 'error', message: 'Module not found', code: 404 },
          null,
        ];
      }
      await db
        .update(zuvyCourseModules)
        .set({ order: sql`${zuvyCourseModules.order}::numeric - 1` })
        .where(
          sql`${zuvyCourseModules.order} > ${data[0].order} and ${zuvyCourseModules.bootcampId} = ${bootcampId}`,
        );
      return {
        status: 'success',
        message: 'Module deleted successfully',
        code: 200,
      };
    } catch (error) {
      log(`error: ${error.message}`);
      return [{ status: 'error', message: error.message, code: 404 }, null];
    }
  }

  async deleteChapter(chapterId: number, moduleId: number): Promise<any> {
    try {
      let spyMan = await db
        .delete(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.id, chapterId))
        .returning();
      if (spyMan.length === 0) {
        return [
          { status: 'error', message: 'Chapter not found', code: 404 },
          null,
        ];
      }

      await db
        .update(zuvyModuleChapter)
        .set({ order: sql`${zuvyModuleChapter.order}::numeric - 1` })
        .where(
          sql`${zuvyModuleChapter.order} > ${spyMan[0].order} and ${zuvyModuleChapter.moduleId} = ${moduleId}`,
        );

      return {
        status: 'success',
        message: 'Chapter deleted successfully',
        code: 200,
      };
    } catch (error) {
      log(`error: ${error.message}`);
      return [{ status: 'error', message: error.message, code: 404 }, null];
    }
  }

  async getAllQuizQuestions(
    tagId: number,
    difficulty: 'Easy' | 'Medium' | 'Hard',
    searchTerm: string = '',
  ) {
    try {
      let queryString;
      if (!Number.isNaN(tagId) && difficulty == undefined) {
        queryString = sql`${zuvyModuleQuiz.tagId} = ${tagId}`;
      } else if (Number.isNaN(tagId) && difficulty != undefined) {
        queryString = sql`${zuvyModuleQuiz.difficulty} = ${difficulty}`;
      } else if (!Number.isNaN(tagId) && difficulty != undefined) {
        queryString = and(
          eq(zuvyModuleQuiz.difficulty, difficulty),
          eq(zuvyModuleQuiz.tagId, tagId),
        );
      }
      const result = await db
        .select()
        .from(zuvyModuleQuiz)
        .where(
          and(
            queryString,
            sql`((LOWER(${zuvyModuleQuiz.question}) LIKE '%' || ${searchTerm.toLowerCase()} || '%'))`,
          ),
        );
      return result;
    } catch (err) {
      throw err;
    }
  }

  async getAllCodingQuestions(
    tagId: number,
    difficulty: 'Easy' | 'Medium' | 'Hard',
    searchTerm: string = '',
  ) {
    try {
      let queryString;
      if (!Number.isNaN(tagId) && difficulty == undefined) {
        queryString = sql`${zuvyCodingQuestions.tags} = ${tagId}`;
      } else if (Number.isNaN(tagId) && difficulty != undefined) {
        queryString = sql`${zuvyCodingQuestions.difficulty} = ${difficulty}`;
      } else if (!Number.isNaN(tagId) && difficulty != undefined) {
        queryString = and(
          eq(zuvyCodingQuestions.difficulty, difficulty),
          eq(zuvyCodingQuestions.tags, tagId),
        );
      }
      const result = await db
        .select()
        .from(zuvyCodingQuestions)
        .where(
          and(
            queryString,
            sql`((LOWER(${zuvyCodingQuestions.title}) LIKE '%' || ${searchTerm.toLowerCase()} || '%'))`,
          ),
        );
      return result;
    } catch (err) {
      throw err;
    }
  }
}
