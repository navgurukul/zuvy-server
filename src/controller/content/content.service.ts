import { Injectable, Logger } from '@nestjs/common';
import {
  zuvyModuleTracking,
  zuvyAssignmentSubmission,
  zuvyQuizTracking,
  zuvyModuleChapter,
  zuvyModuleTopics,
  zuvyCourseModules,
  zuvyModuleQuiz,
  zuvyCodingQuestions,
  zuvyOpenEndedQuestions,
  zuvyModuleAssessment,
  zuvyCourseProjects,
  zuvyTags,
  zuvyOutsourseAssessments,
  zuvyOutsourseCodingQuestions,
  zuvyOutsourseOpenEndedQuestions,
  zuvyOutsourseQuizzes,
  zuvyAssessmentSubmission,
  zuvyModuleForm,
  questionType,
  zuvyQuestionTypes,
} from '../../../drizzle/schema';

import { error, log } from 'console';
import {
  SQL,
  sql,
  eq,
  count,
  inArray,
  and,
  or,
  isNull,
  getTableColumns,
} from 'drizzle-orm';
import { db } from '../../db/index';
import { PgTable } from 'drizzle-orm/pg-core';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
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
  editQuizBatchDto,
  UpdateProblemDto,
  deleteQuestionDto,
  UpdateOpenEndedDto,
  CreateTagDto,
  projectDto,
  formBatchDto,
  editFormBatchDto,
  CreateTypeDto,
  CreateAndEditFormBody,
  formDto
} from './dto/content.dto';
;
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

  async createModuleForCourse(bootcampId: number, module: moduleDto, typeId: number) {
    try {
      const noOfModuleOfBootcamp = await db
        .select({ count: count(zuvyCourseModules.id) })
        .from(zuvyCourseModules)
        .where(eq(zuvyCourseModules.bootcampId, bootcampId));
      let projectId = null;
      if (typeId == 2) {
        const newProject = await db.insert(zuvyCourseProjects).values({title:module.name}).returning();
        projectId = newProject.length > 0 ? newProject[0].id : null;
      }
      var moduleWithBootcamp = {
        bootcampId,
        ...module,
        typeId,
        projectId,
        order: noOfModuleOfBootcamp[0].count + 1,
      };
      const moduleData = await db
        .insert(zuvyCourseModules)
        .values(moduleWithBootcamp)
        .returning();
      if (moduleData.length > 0) {
        return {
          status: 'success',
          message: 'Module created successfully for this course',
          code: 200,
          module: moduleData,
        };
      }
      else {
        return {
          status: 'error',
          code: 400,
          message: 'Module creation failed.Please try again'
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async createProjectForCourse(bootcampId: number, project: projectDto, typeId: number) {
    try {
      const newProject = await db.insert(zuvyCourseProjects).values(project).returning();
      if (newProject.length > 0) {
        const newModule = {
          bootcampId,
          isLock: project.isLock,
          name: null,
          timeAlloted: null,
          description: null,
          projectId: newProject[0].id
        }
        const moduleCreated = await this.createModuleForCourse(bootcampId, newModule, typeId);
        if (moduleCreated.status == 'success') {
          return {
            status: 'success',
            code: 200,
            projectCreated: {
              ...newProject[0],
              order: moduleCreated.module[0]?.order
            }
          }
        }
      }
    }
    catch (err) {
      throw err;
    }
  }

  async getProjectDetails(bootcampId: number, projectId: number) {
    try {
      const project = await db.select().from(zuvyCourseProjects).where(eq(zuvyCourseProjects.id, projectId));
      const correspondingModule = await db.select().from(zuvyCourseModules).where(sql`${zuvyCourseModules.bootcampId} = ${bootcampId} and ${zuvyCourseModules.projectId} = ${projectId}`);
      if (project.length > 0) {
        return {
          status: 'success',
          code: 200,
          project,
          bootcampId,
          moduleId: correspondingModule[0].id,
        }
      }
      else {
        return {
          status: 'error',
          code: 404,
          message: 'There is no such project with this id'
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async updateProjectDetails(projectId: number, project: projectDto) {
    try {
      const updatedProjects = await db.update(zuvyCourseProjects).set(project).where(eq(zuvyCourseProjects.id, projectId)).returning();
      if (updatedProjects.length > 0) {
        return {
          status: 'success',
          code: 200,
          message: 'The project has been updated successfully'
        }
      }
      else {
        return {
          status: 'error',
          code: 400,
          message: 'Update failed.Please try again'
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async deleteProjectForBootcamp(projectId: number, moduleId: number, bootcampId: number) {
    try {
      let deletedProject = await db
        .delete(zuvyCourseProjects)
        .where(eq(zuvyCourseProjects.id, projectId))
        .returning();
      if (deletedProject.length > 0) {
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
          code: 200,
          message: 'Project has been deleted successfully'
        }
      }
      else {
        return {
          status: 'error',
          code: 404,
          message: 'Project not found with this id'
        }
      }
    }
    catch (err) {
      throw err;
    }
  }

  async createChapterForModule(moduleId: number, topicId: number, bootcampId: number,) {
    try {
      let newAssessment;
      let chapterData;
      const noOfChaptersOfAModule = await db
        .select({ count: count(zuvyModuleChapter.id) })
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.moduleId, moduleId));
      const order = noOfChaptersOfAModule[0].count + 1  
      if (topicId == 6) {
        newAssessment = await this.createAssessment(moduleId);
        chapterData = {
          title: `Chapter ${order}`,
          moduleId,
          topicId,
          order,
          assessmentId: newAssessment[0].id,
        };

      } else {
        chapterData = { title: `Chapter ${order}`, moduleId, topicId, order };
      }
      const chapter = await db
        .insert(zuvyModuleChapter)
        .values(chapterData)
        .returning();
      if (chapter.length == 0) {
        return {
          status: 'error',
          code: 400,
          message: 'Not able to create chapter for this module',
          module: chapter,
        };
      }
      if (topicId == 6) {
        let insertedAssessmentOutsourse:any = { assessmentId: newAssessment[0].id, moduleId, bootcampId, chapterId: chapter[0].id, order }
        let outsourseAssessmentData = await db.insert(zuvyOutsourseAssessments).values(insertedAssessmentOutsourse).returning();
        if (outsourseAssessmentData.length == 0) {
          return {
            status: 'error',
            code: 400,
            message: 'Not able to create outsourse assessment for this chapter',
            module: chapter,
          };
        }
      }

      return {
        status: 'success',
        message: 'Chapter created successfully for this module',
        code: 200,
        module: chapter,
      };
    } catch (err) {
      Logger.error({err})
      throw err;
    }
  }

  async createQuizForModule(quiz: quizBatchDto) {
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
        return {
          status: "success",
          code: 200,
          result
        }
      }
      else {
        return {
          status: "error",
          code: 404,
          message: "Quiz questions did not create successfully.Please try again"
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async createOpenEndedQuestions(questions: openEndedDto) {
    try {
      const openEndedQuestions = await db
        .insert(zuvyOpenEndedQuestions)
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
          projectData: true
        },
      });
      let modules = data.map((module: any) => {
        return {
          id: module.id,
          name: module.name,
          description: module.description,
          typeId: module.typeId,
          order: module.order,
          projectId: module.projectId,
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
          formCount: module.moduleChapterData.filter(
            (chapter) => chapter.topicId === 7,
          ).length,
        };
      });
      modules.sort((a, b) => a.order - b.order);
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

      // const assessment = await db.query.zuvyOutsourseAssessments.findMany({
      //   where: (outsourseAssessments, { eq }) =>
      //     eq(outsourseAssessments.moduleId, module[0].id),
      //   with: {
      //     ModuleAssessment: true
      //   },
      // })

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

      return { chapterWithTopic, moduleName: module[0].name };
    } catch (err) {
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
        let codingOutsourseId = CodingQuestions.id
        let codingDetails = { codingOutsourseId, ...CodingQuestions.CodingQuestion }
        delete CodingQuestions.CodingQuestion
        return { ...CodingQuestions, ...codingDetails }
      })
      
      return chapterDetails
    } catch (err) {
      throw err;
    }
  }

  async getChapterDetailsById(chapterId: number, bootcampId: number, moduleId: number, topicId: number) {
    try {
      if (topicId == 6) {
        console.log({ chapterId, bootcampId, moduleId, topicId })
        const chapterDetails = await db.query.zuvyOutsourseAssessments.findMany({
          where: (zuvyOutsourseAssessments, { eq }) => eq(zuvyOutsourseAssessments.chapterId, chapterId),
          with: {
            ModuleAssessment: {
              columns: {
                id: true,
                title: true,
                description: true,

              }
            },
            Quizzes: {
              columns: {
                id: true,
                assessmentOutsourseId: true,
                bootcampId: true
              },
              where: (zuvyOutsourseQuizzes, { sql }) => sql`${zuvyOutsourseQuizzes.bootcampId} = ${bootcampId} AND ${zuvyOutsourseQuizzes.chapterId} = ${chapterId}`,
              with: {
                Quiz: true
              }
            },
            OpenEndedQuestions: {
              columns: {
                id: true,
                assessmentOutsourseId: true,
                bootcampId: true
              },
              where: (zuvyOutsourseOpenEndedQuestions, { sql }) => sql`${zuvyOutsourseOpenEndedQuestions.bootcampId} = ${bootcampId} AND ${zuvyOutsourseOpenEndedQuestions.chapterId} = ${chapterId} AND ${zuvyOutsourseOpenEndedQuestions.moduleId} = ${moduleId}`,
              with: {
                OpenEndedQuestion: true
              }
            },
            CodingQuestions: {
              columns: {
                id: true,
                assessmentOutsourseId: true,
                bootcampId: true
              },
              where: (zuvyOutsourseCodingQuestions, { sql }) => sql`${zuvyOutsourseCodingQuestions.bootcampId} = ${bootcampId} AND ${zuvyOutsourseCodingQuestions.chapterId} = ${chapterId}`,
              with: {
                CodingQuestion: {
                  columns: {
                    id: true,
                    title: true,
                    description: true,
                    difficulty: true,
                    tagId: true
                  },
                }
              }
            }
          },
        });
        console.log({ chapterDetails })
        chapterDetails[0]["assessmentOutsourseId"] = chapterDetails[0].id
        let formatedData = this.formatedChapterDetails(chapterDetails[0])
        return formatedData;
      }
      const chapterDetails = await db
        .select()
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.id, chapterId));

      const modifiedChapterDetails: {
        id: number;
        title: string;
        description: string;
        moduleId: number;
        topicId: number;
        order: number;
        completionDate: string;
        quizQuestionDetails?: any[];
        codingQuestionDetails?: any[];
        formQuestionDetails?: any[];
        contentDetails?: any[];
      } = {
        id: chapterDetails[0].id,
        title: chapterDetails[0].title,
        description: chapterDetails[0].description,
        moduleId: chapterDetails[0].moduleId,
        topicId: chapterDetails[0].topicId,
        order: chapterDetails[0].order,
        completionDate:chapterDetails[0].completionDate
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
                  eq(
                    zuvyCodingQuestions.id,
                    chapterDetails[0].codingQuestions,
                  ),
                )
              : [];
          modifiedChapterDetails.codingQuestionDetails = codingProblemDetails;
        } else if (chapterDetails[0].topicId == 7) {
          const formDetails =
            chapterDetails[0].formQuestions !== null
              ? await db
                .select()
                .from(zuvyModuleForm)
                .where(
                  sql`${inArray(zuvyModuleForm.id, Object.values(chapterDetails[0].formQuestions))}`,
                )
              : [];
          modifiedChapterDetails.formQuestionDetails = formDetails;
        } else {
          let content = [
            {
              title: chapterDetails[0].title,
              description: chapterDetails[0].description,
              links: chapterDetails[0].links,
              file: chapterDetails[0].file,
              content: chapterDetails[0].articleContent
            },
          ];
          modifiedChapterDetails.contentDetails = content;
        }
        return modifiedChapterDetails;
      } else {
        return 'No Chapter found';
      }
      // const chapterDetails = await db.query.zuvyModuleChapter.findMany({
      //   where: (moduleChapter, { eq }) => eq(moduleChapter.id, chapterId),
      //   with: {
      //     quizTrackingDetails: {
      //       where: (moduleQuiz, { eq }) => eq(moduleQuiz.bootcampId, bootcampId),
      //     },
      //     OpenEndedQuestion: {
      //       where: (openEndedQuestion, { eq }) => eq(openEndedQuestion.bootcampId, bootcampId),
      //     },
      //     CodingQuestion: {
      //       where: (codingQuestion, { eq }) => eq(codingQuestion.bootcampId, bootcampId),
      //     },
      //   },
      // });
      // return chapterDetails
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
          for (let i = newOrder - 1; i <= draggedModuleIndex - 1; i++) {
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

  async updateCodingProblemForModule(
    questionId: number,
    codingProblem: UpdateProblemDto & { usage?: string },
  ) {
    try {
      let examples = [];
      let testCases = [];
  
      if (codingProblem.examples) {
        for (let i = 0; i < codingProblem.examples.length; i++) {
          examples.push(codingProblem.examples[i].inputs);
        }
        codingProblem.examples = examples;
      }
      if (codingProblem.testCases) {
        for (let j = 0; j < codingProblem.testCases.length; j++) {
          testCases.push(codingProblem.testCases[j].inputs);
        }
        codingProblem.testCases = testCases;
      }
      const updatedQuestion = await db
        .update(zuvyCodingQuestions)
        .set({ usage: sql`${zuvyCodingQuestions.usage}::numeric - 1`, ...codingProblem })
        .where(eq(zuvyCodingQuestions.id, questionId))
        .returning();
      if (updatedQuestion.length > 0) {
        return {
          status: 'success',
          code: 200,
          message: 'Coding question has been updated successfully',
        };
      } else {
        return {
          status: 'error',
          code: 404,
          message: 'Coding question not available',
        };
      }
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
          for (let i = newOrder - 1; i <= draggedModuleIndex - 1; i++) {
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
        const chapter = await db
          .select()
          .from(zuvyModuleChapter)
          .where(eq(zuvyModuleChapter.id, chapterId));

        if (editData.quizQuestions) {
          const earlierQuizIds =
            chapter[0].quizQuestions != null
              ? Object.values(chapter[0].quizQuestions)
              : [];
          const remainingQuizIds =
            editData.quizQuestions != null && earlierQuizIds.length > 0
              ? earlierQuizIds.filter(
                (questionId) => !editData.quizQuestions.includes(questionId),
              )
              : [];
          const toUpdateIds =
            editData.quizQuestions != null && earlierQuizIds.length > 0
              ? editData.quizQuestions.filter(
                (questionId) => !earlierQuizIds.includes(questionId),
              )
              : editData.quizQuestions;
          if (remainingQuizIds.length > 0) {
            await db
              .update(zuvyModuleQuiz)
              .set({ usage: sql`${zuvyModuleQuiz.usage}::numeric - 1` })
              .where(sql`${inArray(zuvyModuleQuiz.id, remainingQuizIds)}`);
          }
          if (toUpdateIds.length > 0) {
            await db
              .update(zuvyModuleQuiz)
              .set({ usage: sql`${zuvyModuleQuiz.usage}::numeric + 1` })
              .where(sql`${inArray(zuvyModuleQuiz.id, toUpdateIds)}`);
          }
          if (editData.quizQuestions.length == 0) {
            editData.quizQuestions = null;
          }
        } else if (
          editData.codingQuestions ||
          (editData.codingQuestions == null &&
            chapter[0].codingQuestions != null)
        ) {
          const earlierCodingId = chapter[0].codingQuestions;

          if (earlierCodingId !== editData.codingQuestions) {
            let updatedCodingQuestion:any = { usage: sql`${zuvyCodingQuestions.usage}::numeric - 1` }
            await db
              .update(zuvyCodingQuestions)
              .set(updatedCodingQuestion)
              .where(eq(zuvyCodingQuestions.id, editData.codingQuestions));
          }
        } else if (editData.formQuestions) {
          const earlierFormIds =
            chapter[0].formQuestions != null
              ? Object.values(chapter[0].formQuestions)
              : [];
          const remainingFormIds =
            editData.formQuestions != null && earlierFormIds.length > 0
              ? earlierFormIds.filter(
                (questionId) => !editData.formQuestions.includes(questionId),
              )
              : [];
          const toUpdateIds =
            editData.formQuestions != null && earlierFormIds.length > 0
              ? editData.formQuestions.filter(
                (questionId) => !earlierFormIds.includes(questionId),
              )
              : editData.formQuestions;
          if (remainingFormIds.length > 0) {
            await db
              .update(zuvyModuleForm)
              .set({ usage: sql`${zuvyModuleForm.usage}::numeric - 1` })
              .where(sql`${inArray(zuvyModuleForm.id, remainingFormIds)}`);
          }
          if (toUpdateIds.length > 0) {
            await db
              .update(zuvyModuleForm)
              .set({ usage: sql`${zuvyModuleForm.usage}::numeric + 1` })
              .where(sql`${inArray(zuvyModuleForm.id, toUpdateIds)}`);
          }
          if (editData.formQuestions.length == 0) {
            editData.formQuestions = null;
          }
        }
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
      };
      const newAssessment = await db
        .insert(zuvyModuleAssessment)
        .values(assessment)
        .returning();

      return newAssessment;
    } catch (err) {
      console.error({err});
      throw err;
    }
  }

  async editAssessment(
    assessmentOutsourseId: number,
    assessmentBody: CreateAssessmentBody,
  ) {
    try {
      const assessment = await db.query.zuvyOutsourseAssessments.findMany({
        where: (zuvyOutsourseAssessments, { eq }) =>
          eq(zuvyOutsourseAssessments.id, assessmentOutsourseId),
        with: {
          ModuleAssessment: true,
          OutsourseQuizzes: true,
          OutsourseOpenEndedQuestions: true,
          OutsourseCodingQuestions: true
        },
      });

      if (assessment == undefined || assessment.length == 0) {
        throw ({
          status: 'error',
          statusCode: 404,
          message: 'Assessment not found',
        });
      } else {
        let { bootcampId, moduleId, chapterId, ModuleAssessment, OutsourseQuizzes, OutsourseOpenEndedQuestions, OutsourseCodingQuestions } = assessment[0];
        let { mcqIds, openEndedQuestionIds, codingProblemIds, title, description, ...OutsourseAssessmentData__ } = assessmentBody;

        let assessment_id = ModuleAssessment.id;

        let assessmentData = { title, description };

        // filter out the ids that are not in the assessment
        let existingQuizIds = OutsourseQuizzes.map((q) => q.quiz_id).filter(id => id !== null);
        let existingOpenEndedQuestionIds = OutsourseOpenEndedQuestions.map((q) => q.openEndedQuestionId).filter(id => id !== null);
        let existingCodingQuestionIds = OutsourseCodingQuestions.map((q) => q.codingQuestionId).filter(id => id !== null);

        let quizIdsToDelete = existingQuizIds.filter((id) => !mcqIds.includes(id));
        let openEndedQuestionIdsToDelete = existingOpenEndedQuestionIds.filter((id) => !openEndedQuestionIds.includes(id));
        let codingQuestionIdsToDelete = existingCodingQuestionIds.filter((id) => !codingProblemIds.includes(id));

        let quizIdsToAdd = mcqIds.filter((id) => !existingQuizIds.includes(id));
        let openEndedQuestionIdsToAdd = openEndedQuestionIds.filter((id) => !existingOpenEndedQuestionIds.includes(id));
        let codingQuestionIdsToAdd = codingProblemIds.filter((id) => !existingCodingQuestionIds.includes(id));

        // Delete operations
        if (quizIdsToDelete.length > 0) {
          await db
            .delete(zuvyOutsourseQuizzes)
            .where(sql`${zuvyOutsourseQuizzes.assessmentOutsourseId} = ${assessmentOutsourseId} AND ${inArray(zuvyOutsourseQuizzes.quiz_id, quizIdsToDelete)}`);
        }
        if (openEndedQuestionIdsToDelete.length > 0) {
          await db
            .delete(zuvyOutsourseOpenEndedQuestions)
            .where(sql`${zuvyOutsourseOpenEndedQuestions.assessmentOutsourseId} = ${assessmentOutsourseId} AND ${inArray(zuvyOutsourseOpenEndedQuestions.openEndedQuestionId, openEndedQuestionIdsToDelete)}`);
        }
        if (codingQuestionIdsToDelete.length > 0) {
          await db
            .delete(zuvyOutsourseCodingQuestions)
            .where(sql`${zuvyOutsourseCodingQuestions.assessmentOutsourseId} = ${assessmentOutsourseId} AND ${inArray(zuvyOutsourseCodingQuestions.codingQuestionId, codingQuestionIdsToDelete)}`);
        }

        // Update assessment data
        let updatedOutsourseAssessment = await db.update(zuvyOutsourseAssessments).set(OutsourseAssessmentData__).where(eq(zuvyOutsourseAssessments.id, assessmentOutsourseId)).returning();

        let updatedAssessment = await db
          .update(zuvyModuleAssessment)
          .set(assessmentData)
          .where(eq(zuvyModuleAssessment.id, assessment_id))
          .returning();

        // Insert new data
        let mcqArray = quizIdsToAdd.map(id => ({ quiz_id: id, bootcampId, chapterId, assessmentOutsourseId }));
        let openEndedQuestionsArray = openEndedQuestionIdsToAdd.map(id => ({ openEndedQuestionId: id, bootcampId, moduleId, chapterId, assessmentOutsourseId }));
        let codingProblemsArray = codingQuestionIdsToAdd.map(id => ({ codingQuestionId: id, bootcampId, moduleId, chapterId, assessmentOutsourseId }));

        if (mcqArray.length > 0) {
          let createZOMQ = await db.insert(zuvyOutsourseQuizzes).values(mcqArray).returning();
          if (createZOMQ.length > 0) {
            const toUpdateIds = createZOMQ.filter((c) => c.quiz_id).map((c) => c.quiz_id);
            let modelsData = await db
              .update(zuvyModuleQuiz)
              .set({ usage: sql`${zuvyModuleQuiz.usage}::numeric + 1` })
              .where(sql`${inArray(zuvyModuleQuiz.id, toUpdateIds)}`);
          }
        }

        if (openEndedQuestionsArray.length > 0) {
          let createZOOQ = await db.insert(zuvyOutsourseOpenEndedQuestions).values(openEndedQuestionsArray).returning();
          if (createZOOQ.length > 0) {
            const toUpdateIds = createZOOQ.filter((c) => c.openEndedQuestionId).map((c) => c.openEndedQuestionId);
            let updateOpendEndedQuestions:any = { usage: sql`${zuvyOpenEndedQuestions.usage}::numeric + 1` }
            await db.update(zuvyOpenEndedQuestions)
              .set(updateOpendEndedQuestions)
              .where(sql`${inArray(zuvyOpenEndedQuestions.id, toUpdateIds)}`);
          }
        }

        if (codingProblemsArray.length > 0) {
          let createZOCQ = await db.insert(zuvyOutsourseCodingQuestions).values(codingProblemsArray).returning();
          if (createZOCQ.length > 0) {
            const toUpdateIds = createZOCQ.filter((c) => c.codingQuestionId).map((c) => c.codingQuestionId);
            let updateCodingQuestions:any = { usage: sql`${zuvyCodingQuestions.usage}::numeric + 1` }
            await db
              .update(zuvyCodingQuestions)
              .set(updateCodingQuestions)
              .where(sql`${inArray(zuvyCodingQuestions.id, toUpdateIds)}`);
          }
        }
      }
      return {
        status: 'success',
        code: 200,
        message: 'Updated successfully',
      };
    } catch (err) {
      throw err;
    }
  }

  async getAssessmentDetails(assessmentOutsourseId: number) {
    try {
      const assessment = await db.query.zuvyOutsourseAssessments.findMany({
        where: (zuvyOutsourseAssessments, { eq }) =>
          eq(zuvyOutsourseAssessments.id, assessmentOutsourseId),
        with: {
          ModuleAssessment: true,
          Quizzes: true,
          OpenEndedQuestions: true,
          CodingQuestions: true
        },
      })
      return assessment;
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
        queryString = sql`${zuvyCodingQuestions.tagId} = ${tagId}`;
      } else if (Number.isNaN(tagId) && difficulty != undefined) {
        queryString = sql`${zuvyCodingQuestions.difficulty} = ${difficulty}`;
      } else if (!Number.isNaN(tagId) && difficulty != undefined) {
        queryString = and(
          eq(zuvyCodingQuestions.difficulty, difficulty),
          eq(zuvyCodingQuestions.tagId, tagId),
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

  async editQuizQuestions(editQuesDetails: editQuizBatchDto) {
    try {
      await db
        .insert(zuvyModuleQuiz)
        .values(editQuesDetails.questions)
        .onConflictDoUpdate({
          target: zuvyModuleQuiz.id,
          set: {
            question: sql`excluded.question`,
            options: sql`excluded.options`,
            difficulty: sql`excluded.difficulty`,
            tagId: sql`excluded.tag_id`,
            marks: sql`excluded.marks`,
            correctOption: sql`excluded.correct_option`,
          },
        });

      return {
        status: 'success',
        code: 200,
        message: 'Quiz questions are updated successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  async updateOpenEndedQuestion(
    questionId: number,
    openEndedBody: UpdateOpenEndedDto,
  ) {
    try {
      const updatedQuestion = await db
        .update(zuvyOpenEndedQuestions)
        .set(openEndedBody)
        .where(eq(zuvyOpenEndedQuestions.id, questionId))
        .returning();
      if (updatedQuestion.length > 0) {
        return {
          status: 'success',
          code: 200,
          message: 'Open ended question has been updated successfully',
        };
      } else {
        return {
          status: 'error',
          code: 404,
          message: 'Open ended question not available',
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async deleteQuiz(id: deleteQuestionDto) {
    try {
      const usedQuiz = await db
        .select()
        .from(zuvyModuleQuiz)
        .where(
          sql`${inArray(zuvyModuleQuiz.id, id.questionIds)} and ${zuvyModuleQuiz.usage} > 0`,
        );
      let deletedQuestions;
      if (usedQuiz.length > 0) {
        const usedIds = usedQuiz.map((quiz) => quiz.id);
        const remainingIds = id.questionIds.filter(
          (questionId) => !usedIds.includes(questionId),
        );
        deletedQuestions =
          remainingIds.length > 0
            ? await db
              .delete(zuvyModuleQuiz)
              .where(sql`${inArray(zuvyModuleQuiz.id, remainingIds)}`)
              .returning()
            : [];
        if (deletedQuestions.length > 0) {
          return {
            status: 'success',
            code: 200,
            message: `Quiz questions which is used in other places like chapters and assessment cannot be deleted`,
          };
        } else {
          return {
            status: 'error',
            code: 400,
            message: `Questions cannot be deleted`,
          };
        }
      }
      deletedQuestions = await db
        .delete(zuvyModuleQuiz)
        .where(sql`${inArray(zuvyModuleQuiz.id, id.questionIds)}`)
        .returning();
      if (deletedQuestions.length > 0) {
        return {
          status: 'success',
          code: 200,
          message: 'The quiz questions has been deleted successfully',
        };
      } else {
        return {
          status: 'error',
          code: 400,
          message: `Questions cannot be deleted`,
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async deleteCodingProblem(id: deleteQuestionDto) {
    try {
      const usedCodingQuestions = await db
        .select()
        .from(zuvyCodingQuestions)
        .where(
          sql`${inArray(zuvyCodingQuestions.id, id.questionIds)} and ${zuvyCodingQuestions.usage} > 0`,
        );
      let deletedQuestions;
      if (usedCodingQuestions.length > 0) {
        const usedIds = usedCodingQuestions.map((problem) => problem.id);
        const remainingIds = id.questionIds.filter(
          (questionId) => !usedIds.includes(questionId),
        );
        deletedQuestions =
          remainingIds.length > 0
            ? await db
              .delete(zuvyCodingQuestions)
              .where(sql`${inArray(zuvyCodingQuestions.id, remainingIds)}`)
              .returning()
            : [];
        if (deletedQuestions.length > 0) {
          return {
            status: 'success',
            code: 200,
            message: `Coding question which is used in other places like chapters and assessment cannot be deleted`,
          };
        } else {
          return {
            status: 'error',
            code: 400,
            message: `Questions cannot be deleted`,
          };
        }
      }
      deletedQuestions = await db
        .delete(zuvyCodingQuestions)
        .where(sql`${inArray(zuvyCodingQuestions.id, id.questionIds)}`)
        .returning();
      if (deletedQuestions.length > 0) {
        return {
          status: 'success',
          code: 200,
          message: 'The coding question has been deleted successfully',
        };
      } else {
        return {
          status: 'error',
          code: 400,
          message: `Questions cannot be deleted`,
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async deleteOpenEndedQuestion(id: deleteQuestionDto) {
    try {
      const usedOpenEndedQuestions = await db
        .select()
        .from(zuvyOpenEndedQuestions)
        .where(
          sql`${inArray(zuvyOpenEndedQuestions.id, id.questionIds)} and ${zuvyOpenEndedQuestions.usage} > 0`,
        );
      let deletedQuestions;
      if (usedOpenEndedQuestions.length > 0) {
        const usedIds = usedOpenEndedQuestions.map(
          (openEndedQues) => openEndedQues.id,
        );
        const remainingIds = id.questionIds.filter(
          (questionId) => !usedIds.includes(questionId),
        );

        deletedQuestions =
          remainingIds.length > 0
            ? await db
              .delete(zuvyOpenEndedQuestions)
              .where(sql`${inArray(zuvyOpenEndedQuestions.id, remainingIds)}`)
              .returning()
            : [];
        if (deletedQuestions.length > 0) {
          return {
            status: 'success',
            code: 200,
            message: `Open ended question which is used in other places like chapters and assessment cannot be deleted`,
          };
        } else {
          return {
            status: 'error',
            code: 400,
            message: `Questions cannot be deleted`,
          };
        }
      }
      deletedQuestions = await db
        .delete(zuvyOpenEndedQuestions)
        .where(sql`${inArray(zuvyOpenEndedQuestions.id, id.questionIds)}`)
        .returning();
      if (deletedQuestions.length > 0) {
        return {
          status: 'success',
          code: 200,
          message: 'The open ended question has been deleted successfully',
        };
      } else {
        return {
          status: 'error',
          code: 400,
          message: `Questions cannot be deleted`,
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async getAllTags() {
    try {
      const allTags = await db.select().from(zuvyTags);
      if (allTags.length > 0) {
        return {
          status: 'success',
          code: 200,
          allTags,
        };
      } else {
        return {
          status: 'error',
          code: 404,
          message: 'No tags found.Please create one',
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async createTag(tag: CreateTagDto) {
    try {
      const newTag = await db.insert(zuvyTags).values(tag).returning();
      if (newTag.length > 0) {
        return {
          status: 'success',
          code: 200,
          newTag,
        };
      } else {
        return {
          status: 'error',
          code: 404,
          message: 'Tag is not created.Please try again.',
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async getAllOpenEndedQuestions(
    tagId: number,
    difficulty: 'Easy' | 'Medium' | 'Hard',
    searchTerm: string = '',
    pageNo: number,
    limit_: number
  ) {
    try {
      let queryString;
      if (!Number.isNaN(tagId) && difficulty == undefined) {
        queryString = sql`${zuvyOpenEndedQuestions.tagId} = ${tagId}`;
      } else if (Number.isNaN(tagId) && difficulty != undefined) {
        queryString = sql`${zuvyOpenEndedQuestions.difficulty} = ${difficulty}`;
      } else if (!Number.isNaN(tagId) && difficulty != undefined) {
        queryString = and(
          eq(zuvyOpenEndedQuestions.difficulty, difficulty),
          eq(zuvyOpenEndedQuestions.tagId, tagId),
        );
      }
      const totalRows = await db
        .select()
        .from(zuvyOpenEndedQuestions)
        .where(
          and(
            queryString,
            sql`((LOWER(${zuvyOpenEndedQuestions.question}) LIKE '%' || ${searchTerm.toLowerCase()} || '%'))`,
          ),
        )
        .execute();

      const result = await db
        .select()
        .from(zuvyOpenEndedQuestions)
        .where(
          and(
            queryString,
            sql`((LOWER(${zuvyOpenEndedQuestions.question}) LIKE '%' || ${searchTerm.toLowerCase()} || '%'))`,
          ),
        ).offset(pageNo).limit(limit_);
      return { data: result, totalRows: totalRows.length, totalPages: Math.ceil(totalRows.length / limit_) };
    } catch (err) {
      throw err;
    }
  }
  async getStudentsOfAssessment(assessmentId: number, chapterId: number, moduleId: number, bootcampId: number, req) {
    try {
      let { id } = req.user[0];
      const assessment = await db.query.zuvyOutsourseAssessments.findMany({
        where: (zuvyOutsourseAssessments, { eq }) =>
          sql`${zuvyOutsourseAssessments.assessmentId} = ${assessmentId} AND ${zuvyOutsourseAssessments.bootcampId} = ${bootcampId} AND ${zuvyOutsourseAssessments.chapterId} = ${chapterId} AND ${zuvyOutsourseAssessments.moduleId} = ${moduleId}`,
        with: {
          submitedOutsourseAssessments: {
            where: (zuvyAssessmentSubmission, { eq }) => eq(zuvyAssessmentSubmission.userId, id),
            columns: {
              id: true,
              marks: true,
              userId: true,
              assessmentOutsourseId: true,
              startedAt: true,
              submitedAt: true,
            },
          },
          ModuleAssessment: true,
          Quizzes: {
            columns: {
              // id: true,
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
          },
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
        },
      })
      if (assessment == undefined || assessment.length == 0) {
        throw ({
          status: 'error',
          statusCode: 404,
          message: 'Assessment not found',
        });
      }
      assessment[0]["totalQuizzes"] = assessment[0]?.Quizzes.length || 0;
      assessment[0]["totalOpenEndedQuestions"] = assessment[0]?.OpenEndedQuestions.length || 0;
      assessment[0]["totalCodingQuestions"] = assessment[0]?.CodingQuestions.length || 0;

      delete assessment[0].Quizzes;
      delete assessment[0].OpenEndedQuestions;
      delete assessment[0].CodingQuestions;
      return assessment[0];
    } catch (err) {
      throw err;
    }
  }

  /**
 * Initiates an assessment for a student.
 * This function might set up necessary variables, database entries, or other prerequisites 
 * for a student to begin taking an assessment.
 */
  async startAssessmentForStudent(assessmentOutsourseId: number, req) {
    try {
      let { id } = req.user[0];
      const assessment = await db.query.zuvyOutsourseAssessments.findMany({
        where: (zuvyOutsourseAssessments, { eq }) =>
          eq(zuvyOutsourseAssessments.id, assessmentOutsourseId),
        with: {
          ModuleAssessment: true,
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

      formatedData.Quizzes = formatedData.Quizzes.length
      formatedData.OpenEndedQuestions = formatedData.OpenEndedQuestions.length

      return { ...formatedData, submission: submission[0] };
    } catch (err) {
      throw err;
    }
  }

  async getAssessmentDetailsOfQuiz(assessment_outsourse_id: number, userId) {
    try {
      const assessment = await db.query.zuvyOutsourseQuizzes.findMany({
        where: (zuvyOutsourseQuizzes, { eq }) =>
          eq(zuvyOutsourseQuizzes.assessmentOutsourseId, assessment_outsourse_id),
        with: {
          submissionsData: {
            where: (zuvyQuizTracking, { eq }) => eq(zuvyQuizTracking.userId, userId),
            columns: {
              id: true,
              userId: true,
              chosenOption: true,
              questionId: true,
              attemptCount: true,
            }
          },
          Quiz: {
            columns: {
              id: true,
              question: true,
              options: true,
              difficulty: true,
              correctOption: true,
              marks: true,
            }
          },
        }
      })
      if (assessment.length == 0) {
        return [];
      }
      return assessment;
    } catch (err) {
      throw err;
    }
  }

  async getAssessmentDetailsOfOpenEnded(assessment_outsourse_id: number, userId) {
    try {
      const assessment = await db.query.zuvyOutsourseOpenEndedQuestions.findMany({
        where: (zuvyOutsourseOpenEndedQuestions, { eq }) =>
          eq(zuvyOutsourseOpenEndedQuestions.assessmentOutsourseId, assessment_outsourse_id),
        with: {
          submissionsData: {
            where: (zuvyOpenEndedQuestionSubmission, { eq }) => eq(zuvyOpenEndedQuestionSubmission.userId, userId),
            columns: {
              id: true,
              userId: true,
              answer: true,
              questionId: true,
              submitAt: true,
              assessmentSubmissionId: true
            }
          },
          OpenEndedQuestion: {
            columns: {
              id: true,
              question: true,
              difficulty: true,
            }
          }
        }
      })
      if (assessment.length == 0) {
        return [];
      }
      return assessment;
    } catch (err) {
      throw err;
    }
  }


  async getAllQuestionTypes() {
    try {
      const allQuestionTypes = await db.select().from(zuvyQuestionTypes);
      if (allQuestionTypes.length > 0) {
        return {
          status: 'success',
          code: 200,
          allQuestionTypes,
        };
      } else {
        return [];
      }
    } catch (err) {
      throw err;
    }
  }

  async createQuestionType(questionType: CreateTypeDto) {
    try {
      const newQuestionType = await db.insert(zuvyQuestionTypes).values(questionType).returning();
      if (newQuestionType.length > 0) {
        return {
          status: 'success',
          code: 200,
          newQuestionType,
        };
      } else {
        return {
          status: 'error',
          code: 404,
          message: 'Question Type is not created.Please try again.',
        };
      }
    } catch (err) {
      throw err;
    }
  }


  async createFormForModule(chapterId: number, form: formBatchDto) {
    try {

      if (isNaN(chapterId)) {
        return {
          status: "error",
          code: 400,
          message: "Invalid chapterId. Please provide a valid number."
        };
      }

      const formQuestion = form.questions.map((f) => ({
        chapterId,
        question: f.question,
        options: f.options,
        typeId: f.typeId,
        isRequired: f.isRequired,
      }));

      const allFieldsFilled = formQuestion.every(question => question.question !== null && question.options !== null && question.typeId !== null && question.isRequired !== null);
      if (!allFieldsFilled) {
        return {
          status: "error",
          code: 400,
          message: " One or more fields are empty. Please try again."
        };
      }

      const result = await db
        .insert(zuvyModuleForm)
        .values(formQuestion)
        .returning();


      const formIds = result.length > 0 ? result.map(obj => obj.id) : [];

      const existingChapter = await db
        .select()
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.id, chapterId))
        .limit(1);

      const chapter = existingChapter[0] as { formQuestions: number[] };

      const existingFormQuestions = chapter.formQuestions || [];

      const updatedFormQuestions = [...existingFormQuestions, ...formIds];

      const updatedChapter = await db
        .update(zuvyModuleChapter)
        .set({
          formQuestions: updatedFormQuestions
        })
        .where(eq(zuvyModuleChapter.id, formQuestion[0].chapterId))
        .returning();



      if (result.length > 0 || updatedChapter.length > 0) {
        return {

          status: "success",
          code: 200,
          result,
          updatedChapter
        }
      }
      else {
        return {
          status: "error",
          code: 404,
          message: "Form questions did not create successfully.Please try again"
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async getAllFormQuestions(
    chapterId: number,
    typeId: number,
    searchTerm: string = '',
  ) {
    try {
      let queryString;
      if (!Number.isNaN(typeId) && questionType == undefined) {
        queryString = sql`${zuvyModuleForm.typeId} = ${typeId}`;
      }
      const result = await db
        .select()
        .from(zuvyModuleForm)
        .where(
          and(
            queryString,
            sql`${zuvyModuleForm.chapterId} = ${chapterId}`,
            sql`((LOWER(${zuvyModuleForm.question}) LIKE '%' || ${searchTerm.toLowerCase()} || '%'))`,
          ),
        );
      return result;
    } catch (err) {
      throw err;
    }
  }


  async editFormQuestions(chapterId: number, editFormDetails: editFormBatchDto) {
    try {
      const editFormQuestions = editFormDetails.questions.map((f) => ({
        chapterId,
        id: f.id,
        question: f.question,
        options: f.options,
        typeId: f.typeId,
        isRequired: f.isRequired,
      }));

      const allFieldsFilled = editFormQuestions.every(
        (question) =>
          question.question !== null &&
          question.options !== null &&
          question.typeId !== null &&
          question.isRequired !== null
      );

      if (!allFieldsFilled) {
        return {
          status: "error",
          code: 400,
          message: "One or more fields are empty. Please try again.",
        };
      }

      const results = [];

      const existingFormRecords = await db
        .select()
        .from(zuvyModuleForm)
        .where(eq(zuvyModuleForm.chapterId, chapterId));

      const existingFormIds = existingFormRecords.map((record) => record.id);
      const providedFormIds = editFormQuestions.map((question) => question.id);
      const idsToRemove = existingFormIds.filter(id => !providedFormIds.includes(id));


      if (idsToRemove.length > 0) {
        await db
          .delete(zuvyModuleForm)
          .where(inArray(zuvyModuleForm.id, idsToRemove));
      }

      for (const formQuestion of editFormQuestions) {
        if (formQuestion.id) {
          const existingRecord = await db
            .select()
            .from(zuvyModuleForm)
            .where(eq(zuvyModuleForm.id, formQuestion.id))

          if (existingRecord) {
            const result = await db
              .update(zuvyModuleForm)
              .set({
                chapterId: formQuestion.chapterId,
                question: formQuestion.question,
                options: formQuestion.options,
                typeId: formQuestion.typeId,
                isRequired: formQuestion.isRequired,
              })
              .where(eq(zuvyModuleForm.id, formQuestion.id))
              .returning();
            results.push(result);
          } else {
            return {
              status: "Error",
              code: 400,
              message: "Form question id(s) are invalid",
            };
          }
        } else {
          return {
            status: "Error",
            code: 400,
            message: "Form question ids(s) are missing",
          };
        }
      }


      const formIds = results.flat().map((obj) => obj.id);

      const updatedChapter = await db
        .update(zuvyModuleChapter)
        .set({
          formQuestions: formIds,
        })
        .where(eq(zuvyModuleChapter.id, chapterId))
        .returning();

      return {
        status: "success",
        code: 200,
        message: "Form questions are updated successfully",
        results,
        updatedChapter,
      };
    } catch (error) {
      throw error;
    }
  }


  // async deleteForm(id: deleteQuestionDto) {
  //   try {
  //     const usedForm = await db
  //       .select()
  //       .from(zuvyModuleForm)
  //       .where(
  //         sql`${inArray(zuvyModuleForm.id, id.questionIds)} and ${zuvyModuleForm.usage} > 0`,
  //       );
  //     let deletedQuestions;
  //     if (usedForm.length > 0) {
  //       const usedIds = usedForm.map((form) => form.id);
  //       const remainingIds = id.questionIds.filter(
  //         (questionId) => !usedIds.includes(questionId),
  //       );
  //       deletedQuestions =
  //         remainingIds.length > 0
  //           ? await db
  //             .delete(zuvyModuleForm)
  //             .where(sql`${inArray(zuvyModuleForm.id, remainingIds)}`)
  //             .returning()
  //           : [];
  //       if (deletedQuestions.length > 0) {
  //         return {
  //           status: 'success',
  //           code: 200,
  //           message: `Form questions which is used in other places like chapters and assessment cannot be deleted`,
  //         };
  //       } else {
  //         return {
  //           status: 'error',
  //           code: 400,
  //           message: `Questions cannot be deleted`,
  //         };
  //       }
  //     }
  //     deletedQuestions = await db
  //       .delete(zuvyModuleForm)
  //       .where(sql`${inArray(zuvyModuleForm.id, id.questionIds)}`)
  //       .returning();
  //     if (deletedQuestions.length > 0) {
  //       return {
  //         status: 'success',
  //         code: 200,
  //         message: 'The form questions has been deleted successfully',
  //       };
  //     } else {
  //       return {
  //         status: 'error',
  //         code: 400,
  //         message: `Questions cannot be deleted`,
  //       };
  //     }
  //   } catch (err) {
  //     throw err;
  //   }
  // }




  async createAndEditFormQuestions(chapterId: number, form: CreateAndEditFormBody) {
    try {

      if (isNaN(chapterId)) {
        return {
          status: "error",
          code: 400,
          message: "Invalid chapterId. Please provide a valid number."
        };
      }




      if (form.formQuestionDto && !(form.editFormQuestionDto)) {
        await this.createFormForModule(chapterId, form.formQuestionDto);


      } else if (form.editFormQuestionDto && !(form.formQuestionDto)) {
        await this.editFormQuestions(chapterId, form.editFormQuestionDto);

      } else if (form.editFormQuestionDto && form.formQuestionDto) {

        await this.editFormQuestions(chapterId, form.editFormQuestionDto);
        await this.createFormForModule(chapterId, form.formQuestionDto);
      }else{
        return {
          status: "error",
          code: 400,
          message: "Invalid input."
        };
      }

      const res1 = await db
        .select()
        .from(zuvyModuleForm)
        .where(eq(zuvyModuleForm.chapterId, chapterId))

      const res2 = await db
        .select()
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.id, chapterId))


      return {
        status: "success",
        code: 200,
        message: "Form questions are updated successfully",
        res1,
        res2,
      };

    } catch (err) {
      throw err;
    }
  }

}
