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
  zuvyModuleQuizVariants,
  zuvyPracticeCode
} from '../../../drizzle/schema';

import { error, log } from 'console';
import {
  sql,
  eq,
  count,
  inArray,
  and,
  getTableColumns,
  asc,
  ne,
  SQL,
} from 'drizzle-orm';
import { db } from '../../db/index';
import {
  moduleDto,
  quizBatchDto,
  ReOrderModuleBody,
  EditChapterDto,
  openEndedDto,
  CreateAssessmentBody,
  EditQuizBatchDto,
  UpdateProblemDto,
  deleteQuestionDto,
  UpdateOpenEndedDto,
  CreateTagDto,
  projectDto,
  formBatchDto,
  editFormBatchDto,
  CreateTypeDto,
  CreateAndEditFormBody,
  formDto,
  CreateQuizzesDto,
  EditQuizVariantDto,
  CreateQuizVariantDto,
  AddQuizVariantsDto,
  deleteQuestionOrVariantDto
} from './dto/content.dto';
import { STATUS_CODES } from '../../helpers';
import { helperVariable } from '../../constants/helper';
let {DIFFICULTY} = helperVariable;

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
        const newProject = await db.insert(zuvyCourseProjects).values({ title: module.name }).returning();
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
        let insertedAssessmentOutsourse: any = { assessmentId: newAssessment[0].id, moduleId, bootcampId, chapterId: chapter[0].id, order }
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
      Logger.error({ err })
      throw err;
    }
  }

  async createQuizForModule(quizData: CreateQuizzesDto): Promise<any> {
    try {
      // Ensure quizzes is an array
      const quizzes = Array.isArray(quizData.quizzes) ? quizData.quizzes : [quizData.quizzes];
      const quizUploadResults = [];
      let validationErrors = [];
      
      // Validate required fields for each quiz and its variants
      for (const quiz of quizzes) {
        if (!quiz.difficulty || !quiz.tagId) {
          validationErrors.push('All fields are required');
        }
  
        // Validate variants if they exist
        if (quiz.variantMCQs) {
          for (const variant of quiz.variantMCQs) {
            if (!variant.question || typeof variant.options !== 'object' || Object.keys(variant.options).length === 0 || variant.correctOption === undefined) {
              validationErrors.push('All fields are required.');            }
          }
        }
      }

      if (validationErrors.length === 0) {
        const quizzesData = quizzes.map((quiz) => ({
          title: quiz.title, // Optional
          difficulty: quiz.difficulty,
          tagId: quiz.tagId,
          content: quiz.content, // Optional
          isRandom: quiz.isRandomOptions, // Optional
        }));
    
        // Insert quizzes into the database
        const insertedQuizzes = await db
          .insert(zuvyModuleQuiz)
          .values(quizzesData)
          .returning();
    
        // Prepare all variants in one array, associating each with its quiz ID
        const allVariantsData = [];
        insertedQuizzes.forEach((insertedQuiz, quizIndex) => {
          const quizId = insertedQuiz.id;
          const variants = quizzes[quizIndex].variantMCQs?.map((variant, index) => ({
            quizId,
            question: variant.question,
            options: variant.options,
            correctOption: variant.correctOption,
            variantNumber: index + 1,
          }));
    
          // Push quiz data along with variants into the result array
          quizUploadResults.push({
            difficulty: insertedQuiz.difficulty,
            tagId: insertedQuiz.tagId,
            content: insertedQuiz.content,
            isRandom: insertedQuiz.isRandomOptions,
            variantMCQs: variants,
          });
    
          allVariantsData.push(...variants);
        });
    
        // Insert all variants in batch
        await db.insert(zuvyModuleQuizVariants).values(allVariantsData).returning();
    
        return [null, {
          message: 'MCQ and variants have been created successfully.',
          statusCode: STATUS_CODES.CREATED,
          data: quizUploadResults,
        }];
      } else {
        return[{message: validationErrors[0], statusCode: STATUS_CODES.BAD_REQUEST}, null]
      }  
    } catch (err) {
      return [{ message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }, null];
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
          name: module['projectData'].length == 0 ? module.name : module['projectData'][0]['title'],
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
                Quiz: {
                  with: {
                    quizVariants: true
                  }
                }

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
        completionDate: chapterDetails[0].completionDate
      };
      if (chapterDetails.length > 0) {
        if (chapterDetails[0].topicId == 4) {
          const quizDetails =
            chapterDetails[0].quizQuestions !== null
              ? await db.query.zuvyModuleQuiz.findMany({
                where: (quiz, { inArray }) =>
                  inArray(quiz.id, Object.values(chapterDetails[0].quizQuestions)),
                with: {
                  quizVariants: {
                    where: (variants, { eq }) => eq(variants.variantNumber, 1), // Filter for variantNumber = 1
                  },
                },
              })
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
            let updatedCodingQuestion: any = { usage: sql`${zuvyCodingQuestions.usage}::numeric - 1` }
            const updatedquestion = await db
              .update(zuvyCodingQuestions)
              .set(updatedCodingQuestion)
              .where(eq(zuvyCodingQuestions.id, earlierCodingId)).returning();
            if (editData.codingQuestions) {
              updatedCodingQuestion = { usage: sql`${zuvyCodingQuestions.usage}::numeric + 1` }
              await db
                .update(zuvyCodingQuestions)
                .set(updatedCodingQuestion)
                .where(eq(zuvyCodingQuestions.id, editData.codingQuestions)).returning();
            }
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
            let updateModuleForm: any = { usage: sql`${zuvyModuleForm.usage}::numeric - 1` }

            await db
              .update(zuvyModuleForm)
              .set(updateModuleForm)
              .where(sql`${inArray(zuvyModuleForm.id, remainingFormIds)}`);
          }
          if (toUpdateIds.length > 0) {
            let updateModuleForm: any = { usage: sql`${zuvyModuleForm.usage}::numeric + 1` }
            await db
              .update(zuvyModuleForm)
              .set(updateModuleForm)
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
      console.error({ err });
      throw err;
    }
  }

  // Helper function to calculate the score for each question based on the weightage and counts
  async calculateQuestionScores(totalScore, weightage, questionCounts, type = 'MCQ') {
    const sectionScore = (totalScore * (weightage / 100));
    const { easy, medium, hard } = questionCounts;

    // Use the appropriate points for the type of questions (MCQ or Coding)
    const points = type === 'MCQ' ? helperVariable.MCQ_POINTS : helperVariable.CODING_POINTS;

    const totalWeight = (easy * points.Easy) + (medium * points.Medium) + (hard * points.Hard);

    const scores = {
      easy: (points.Easy / totalWeight) * sectionScore,
      medium: (points.Medium / totalWeight) * sectionScore,
      hard: (points.Hard / totalWeight) * sectionScore,
    };

    return scores;
  }

  async editAssessment(
    assessmentOutsourseId: number,
    assessmentBody: CreateAssessmentBody,
    chapterId: number
  ) {
    try {

      if (assessmentBody.weightageCodingQuestions + assessmentBody.weightageMcqQuestions != 100) {
        throw ({
          status: 'error',
          statusCode: 404,
          message: 'The total weightage must equal 100.',
        });
      }
      if (assessmentBody.passPercentage > 100) {
        throw ({
          status: 'error',
          statusCode: 404,
          message: 'Pass percentage cannot be greater than 100.',
        })
      }
      if (assessmentBody.title) {
        const updatedChapterName = await db.update(zuvyModuleChapter).set({ title: assessmentBody.title }).where(eq(zuvyModuleChapter.id, chapterId)).returning();
        if (updatedChapterName.length == 0) {
          throw ({
            status: 'error',
            statusCode: 404,
            message: 'Chapter title not updated properly.Please try again',
          });
        }
      }
      const assessment:any = await db.query.zuvyOutsourseAssessments.findMany({
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
        let existingQuizIds = OutsourseQuizzes.length > 0 ? OutsourseQuizzes.map((q) => q.quiz_id).filter(id => id !== null) : [];
        let existingOpenEndedQuestionIds = OutsourseOpenEndedQuestions.length > 0 ? OutsourseOpenEndedQuestions.map((q) => q.openEndedQuestionId).filter(id => id !== null) : [];
        let existingCodingQuestionIds = OutsourseCodingQuestions.length > 0 ? OutsourseCodingQuestions.map((q) => q.codingQuestionId).filter(id => id !== null) : [];

        let quizIdsToDelete = existingQuizIds.filter((id) => !mcqIds.includes(id));
        let openEndedQuestionIdsToDelete = existingOpenEndedQuestionIds.filter((id) => !openEndedQuestionIds.includes(id));
        let codingQuestionIdsToDelete = existingCodingQuestionIds.filter((id) => !codingProblemIds.includes(id));

        let quizIdsToAdd = mcqIds.filter((id) => !existingQuizIds.includes(id));
        let openEndedQuestionIdsToAdd = openEndedQuestionIds.filter((id) => !existingOpenEndedQuestionIds.includes(id));
        let codingQuestionIdsToAdd = codingProblemIds.filter((id) => !existingCodingQuestionIds.includes(id));
        // Delete operations
        if (quizIdsToDelete.length > 0) {
          let updatedMcqQuestions: any = { usage: sql`${zuvyModuleQuiz.usage}::numeric - 1` }
          await db
            .update(zuvyModuleQuiz)
            .set(updatedMcqQuestions)
            .where(inArray(zuvyModuleQuiz.id, quizIdsToDelete));
          await db
            .delete(zuvyOutsourseQuizzes)
            .where(sql`${zuvyOutsourseQuizzes.assessmentOutsourseId} = ${assessmentOutsourseId} AND ${inArray(zuvyOutsourseQuizzes.quiz_id, quizIdsToDelete)}`);
        }
        if (openEndedQuestionIdsToDelete.length > 0) {
          let updatedOpenEndedQuestions: any = { usage: sql`${zuvyOpenEndedQuestions.usage}::numeric - 1` }
          await db
            .update(zuvyOpenEndedQuestions)
            .set(updatedOpenEndedQuestions)
            .where(inArray(zuvyOpenEndedQuestions.id, openEndedQuestionIdsToDelete));
          await db
            .delete(zuvyOutsourseOpenEndedQuestions)
            .where(sql`${zuvyOutsourseOpenEndedQuestions.assessmentOutsourseId} = ${assessmentOutsourseId} AND ${inArray(zuvyOutsourseOpenEndedQuestions.openEndedQuestionId, openEndedQuestionIdsToDelete)}`);
        }
        if (codingQuestionIdsToDelete.length > 0) {
          let updatedCodingQuestion: any = { usage: sql`${zuvyCodingQuestions.usage}::numeric - 1` }
          await db
            .update(zuvyCodingQuestions)
            .set(updatedCodingQuestion)
            .where(inArray(zuvyCodingQuestions.id, codingQuestionIdsToDelete));
          await db
            .delete(zuvyOutsourseCodingQuestions)
            .where(sql`${zuvyOutsourseCodingQuestions.assessmentOutsourseId} = ${assessmentOutsourseId} AND ${inArray(zuvyOutsourseCodingQuestions.codingQuestionId, codingQuestionIdsToDelete)}`);
        }

        // Extract counts for each question type and difficulty
        const codingQuestionsCount = {
          easy: OutsourseAssessmentData__.easyCodingQuestions || 0,
          medium: OutsourseAssessmentData__.mediumCodingQuestions || 0,
          hard: OutsourseAssessmentData__.hardCodingQuestions || 0,
        };

        const mcqQuestionsCount = {
          easy: OutsourseAssessmentData__.easyMcqQuestions || 0,
          medium: OutsourseAssessmentData__.mediumMcqQuestions || 0,
          hard: OutsourseAssessmentData__.hardMcqQuestions || 0,
        };
        // let TOTAL_SCORE = 100;

        // Calculate the scores for each type
        const codingScores: any = await this.calculateQuestionScores(helperVariable.TOTAL_SCORE, OutsourseAssessmentData__.weightageCodingQuestions, codingQuestionsCount, 'Coding');
        const mcqScores: any = await this.calculateQuestionScores(helperVariable.TOTAL_SCORE, OutsourseAssessmentData__.weightageMcqQuestions, mcqQuestionsCount);
        // Update marks in the assessment
        let marks = {
          easyCodingMark: codingScores.easy,
          mediumCodingMark: codingScores.medium,
          hardCodingMark: codingScores.hard,
          easyMcqMark: mcqScores.easy,
          mediumMcqMark: mcqScores.medium,
          hardMcqMark: mcqScores.hard,
        }

        let updatedOutsourse: any = { ...OutsourseAssessmentData__, ...marks };
        let updatedOutsourseAssessment = await db
          .update(zuvyOutsourseAssessments)
          .set(updatedOutsourse)
          .where(eq(zuvyOutsourseAssessments.id, assessmentOutsourseId))
          .returning();

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
            await db
              .update(zuvyModuleQuiz)
              .set({ usage: sql`${zuvyModuleQuiz.usage}::numeric + 1` })
              .where(sql`${inArray(zuvyModuleQuiz.id, toUpdateIds)}`);
          }
        }

        if (openEndedQuestionsArray.length > 0) {
          let createZOOQ = await db.insert(zuvyOutsourseOpenEndedQuestions).values(openEndedQuestionsArray).returning();
          if (createZOOQ.length > 0) {
            const toUpdateIds = createZOOQ.filter((c) => c.openEndedQuestionId).map((c) => c.openEndedQuestionId);
            let updateOpendEndedQuestions: any = { usage: sql`${zuvyOpenEndedQuestions.usage}::numeric + 1` }
            await db.update(zuvyOpenEndedQuestions)
              .set(updateOpendEndedQuestions)
              .where(sql`${inArray(zuvyOpenEndedQuestions.id, toUpdateIds)}`);
          }
        }

        if (codingProblemsArray.length > 0) {
          let createZOCQ = await db.insert(zuvyOutsourseCodingQuestions).values(codingProblemsArray).returning();
          if (createZOCQ.length > 0) {
            const toUpdateIds = createZOCQ.filter((c) => c.codingQuestionId).map((c) => c.codingQuestionId);
            let updateCodingQuestions: any = { usage: sql`${zuvyCodingQuestions.usage}::numeric + 1` }
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
      console.log(err)
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
    tagId: number | number[],
    difficulty: ('Easy' | 'Medium' | 'Hard') | ('Easy' | 'Medium' | 'Hard')[],
    searchTerm: string = '',
    limit: number,
    offSet: number,
  ) {
    try {
      const where: SQL[] = [];

      let tagIds;
      if (tagId) {
        tagIds = Array.isArray(tagId) ? tagId : [tagId];
        where.push(inArray(zuvyModuleQuiz.tagId, tagIds));
      }

      let difficultyArray;
      if (difficulty) {
        difficultyArray = Array.isArray(difficulty) ? difficulty : [difficulty];
        where.push(inArray(zuvyModuleQuiz.difficulty, difficultyArray));
      }

      // First get the quiz IDs that match the search term
      const matchingQuizIds = searchTerm
        ? await db.query.zuvyModuleQuizVariants.findMany({
          columns: {
            quizId: true
          },
          where: (variants, { and, eq }) =>
            and(
              eq(variants.variantNumber, 1),
              sql`LOWER(${variants.question}) ~ ${sql.raw(`'\\m${searchTerm.toLowerCase()}'`)}`
            )
        }).then(results => results.map(r => r.quizId))
        : null;

      // Add the quiz ID condition if we have search results
      if (searchTerm && matchingQuizIds) {
        where.push(inArray(zuvyModuleQuiz.id, matchingQuizIds));
      }

      // Get total count
      const totalCount = await db.query.zuvyModuleQuiz.findMany({
        where: and(...where)
      });

      // Get paginated results
      const result = await db.query.zuvyModuleQuiz.findMany({
        with: {
          quizVariants: {
            where: (variants, { eq }) => eq(variants.variantNumber, 1),
            orderBy: (quizVariants, { sql }) => {
              if (searchTerm) {
                return [
                  sql`CASE 
                                  WHEN LOWER(${quizVariants.question}) LIKE ${sql.raw(`'${searchTerm.toLowerCase()}%'`)} THEN 0
                                  WHEN LOWER(${quizVariants.question}) ~ ${sql.raw(`'\\m${searchTerm.toLowerCase()}'`)} THEN 
                                      POSITION(${sql.raw(`'${searchTerm.toLowerCase()}'`)} IN LOWER(${quizVariants.question})) - 1
                                  ELSE 9999
                              END`
                ];
              } else {
                return [sql`${quizVariants.id} ASC`];
              }
            }
          }
        },
        where: and(...where),
        orderBy: (quiz, { desc }) => desc(quiz.id),
        limit: limit,
        offset: offSet
      });

      return {
        data: result,
        totalRows: totalCount.length,
        totalPages: !Number.isNaN(limit) ? Math.ceil(totalCount.length / limit) : 1
      };

    } catch (err) {
      throw err;
    }
  }

  async getAllCodingQuestions(
    tagId: number | number[],
    difficulty: ('Easy' | 'Medium' | 'Hard') | ('Easy' | 'Medium' | 'Hard')[],
    searchTerm: string = '',
    limit: number,
    offSet: number,
  ) {
    try {
      let conditions = [];

      let tagIds;

      if (tagId) {
        tagIds = Array.isArray(tagId) ? tagId : [tagId];
        conditions.push(inArray(zuvyCodingQuestions.tagId, tagIds));
      }

      let difficultyArray;

      if (difficulty) {
        difficultyArray = Array.isArray(difficulty) ? difficulty : [difficulty];
        conditions.push(inArray(zuvyCodingQuestions.difficulty, difficultyArray));
      }

      if (searchTerm) {
        conditions.push(
          sql`LOWER(${zuvyCodingQuestions.title}) ~ ${sql.raw(`'\\m${searchTerm.toLowerCase()}'`)}`
        );
      }

      // Query for total number of rows that match the conditions
      const totalRowsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(zuvyCodingQuestions)
        .where(and(...conditions))
        .execute();

      const totalRows = Number(totalRowsResult[0].count);

      // Calculate totalPages based on totalRows and limit
      const totalPages = !Number.isNaN(limit) ? Math.ceil(totalRows / limit) : 1;


      const question = await db.query.zuvyCodingQuestions.findMany({
        where: and(...conditions),
        columns: {
          id: true,
          title: true,
          description: true,
          difficulty: true,
          constraints: true,
          content: true,
          tagId: true,
          createdAt: true,
          usage: true,
        },
        with: {
          testCases: {
            columns: {
              id: true,
              inputs: true,
              expectedOutput: true,
            },
            orderBy: (testCase, { asc }) => asc(testCase.id),
          },
        },
        orderBy: (zuvyCodingQuestions, { sql }) => {
          if (searchTerm) {
            return [
              sql`
                CASE 
                  WHEN LOWER(${zuvyCodingQuestions.title}) LIKE ${sql.raw(`'${searchTerm.toLowerCase()}%'`)} THEN 1
                  WHEN LOWER(${zuvyCodingQuestions.title}) ~ ${sql.raw(`'\\m${searchTerm.toLowerCase()}'`)} THEN 
                    POSITION(${sql.raw(`'${searchTerm.toLowerCase()}'`)} IN LOWER(${zuvyCodingQuestions.title})) + 1
                  ELSE 9999
                END
              `
            ];
          } else {
            return [sql`${zuvyCodingQuestions.id} DESC`];
          }
        },
        limit, // Apply limit as a number
        offset: offSet, // Apply offset
      });

      // Return the results along with totalRows and totalPages
      return {
        data: question,
        totalRows,
        totalPages,
      };
    } catch (err) {
      throw err;
    }
  }

  async editQuizQuestion(quizUpdates: EditQuizBatchDto): Promise<any> {
    try {
      // Prepare an object to store updated data to return in response
      const resultData: any = {
        quizDetails: null,
        variantMCQs: [],
      };

      // Prepare update object for quiz details
      const updateData: any = {};
      if (quizUpdates.title !== undefined) updateData.title = quizUpdates.title;
      if (quizUpdates.difficulty !== undefined) updateData.difficulty = quizUpdates.difficulty;
      if (quizUpdates.tagId !== undefined) updateData.tagId = quizUpdates.tagId;
      if (quizUpdates.content !== undefined) updateData.content = quizUpdates.content;
      if (quizUpdates.isRandomOptions !== undefined) updateData.isRandomOptions = quizUpdates.isRandomOptions;

      // Update the main quiz details only if there's something to update
      if (Object.keys(updateData).length > 0) {
        await db.update(zuvyModuleQuiz)
          .set(updateData)
          .where(eq(zuvyModuleQuiz.id, quizUpdates.id));
        resultData.quizDetails = updateData;  // Store updated quiz details
      }

      // Update specific quiz variants only if variantMCQs is provided
      if (quizUpdates.variantMCQs) {
        // Use forEach to ensure sequential execution
        await Promise.all(quizUpdates.variantMCQs.map(async (variant) => {
          const variantData: EditQuizVariantDto = {
            question: variant.question,
            options: variant.options,
            correctOption: variant.correctOption,
            variantNumber: variant.variantNumber,
          };

          await db.update(zuvyModuleQuizVariants)
            .set(variantData)
            .where(
              and(
                eq(zuvyModuleQuizVariants.quizId, quizUpdates.id),
                eq(zuvyModuleQuizVariants.variantNumber, variant.variantNumber)
              )
            );

          // Add each updated variant data to resultData array
          resultData.variantMCQs.push(variantData);
        }));
      }

      return [null, {
        message: 'Quiz and variants have been updated successfully.',
        statusCode: STATUS_CODES.OK,
        data: resultData,
      }];

    } catch (err) {
      return [{ message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }, null];
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
    tagId: number | number[],
    difficulty: ('Easy' | 'Medium' | 'Hard') | ('Easy' | 'Medium' | 'Hard')[],
    searchTerm: string = '',
    limit: number,
    offset: number
  ) {
    try {
      let conditions = [];

      let tagIdsArray;

      if (tagId) {
        tagIdsArray = Array.isArray(tagId) ? tagId : [tagId];
        conditions.push(inArray(zuvyOpenEndedQuestions.tagId, tagIdsArray));
      }

      let difficultyArray;

      if (difficulty) {
        difficultyArray = Array.isArray(difficulty) ? difficulty : [difficulty];
        conditions.push(inArray(zuvyOpenEndedQuestions.difficulty, difficultyArray));
      }
      if (searchTerm) {
        conditions.push(
          sql`LOWER(${zuvyOpenEndedQuestions.question}) ~ ${sql.raw(`'\\m${searchTerm.toLowerCase()}'`)}`
        );
      }

      const totalRows = await db
        .select({ count: sql<number>`count(*)` })
        .from(zuvyOpenEndedQuestions)
        .where(and(...conditions))
        .execute();


      const result = await db
        .select()
        .from(zuvyOpenEndedQuestions)
        .where(and(...conditions))
        .orderBy(searchTerm ?
          sql`
            CASE 
              WHEN LOWER(${zuvyOpenEndedQuestions.question}) LIKE ${sql.raw(`'${searchTerm.toLowerCase()}%'`)} THEN 1
              WHEN LOWER(${zuvyOpenEndedQuestions.question}) ~ ${sql.raw(`'\\m${searchTerm.toLowerCase()}'`)} THEN 
                POSITION(${sql.raw(`'${searchTerm.toLowerCase()}'`)} IN LOWER(${zuvyOpenEndedQuestions.question})) + 1
              ELSE 9999 -- Push non-matching to end
            END
          `
          :
          sql`${zuvyOpenEndedQuestions.id} DESC`
        )
        .limit(limit)
        .offset(offset);

      return {
        data: result,
        totalRows: Number(totalRows[0].count),
        totalPages: !Number.isNaN(limit) ? Math.ceil(totalRows[0].count / limit) : 1
      };

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
          },
          ModuleAssessment: true,
          Quizzes: {
            columns: {
              assessmentOutsourseId: true,
              bootcampId: true
            },
            with: {
              Quiz: {
                with: {
                  quizVariants: true
                }
              },
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

  async getCodingQuestionsByDifficulty(difficultyLevel, assessmentOutsourseId, limit, selectedTagIds,userId, assessmentSubmissionId) {
    try {
      // Fetching the combined results with a join
      const questions = await db
        .select({
          id:zuvyOutsourseCodingQuestions.codingQuestionId,
          codingQuestionId: zuvyCodingQuestions.id,
          codingOutsourseId: zuvyOutsourseCodingQuestions.id,
          assessmentOutsourseId: zuvyOutsourseCodingQuestions.assessmentOutsourseId,
          title: zuvyCodingQuestions.title, // Add other fields you need
          description: zuvyCodingQuestions.description,
          constraints: zuvyCodingQuestions.constraints,
          difficulty: zuvyCodingQuestions.difficulty,
          content: zuvyCodingQuestions.content,
          submissionData:{
            status: zuvyPracticeCode.status,
            sourceCode: zuvyPracticeCode.sourceCode,
            createdAt: zuvyPracticeCode.createdAt
          }
        })
        .from(zuvyOutsourseCodingQuestions)
        .innerJoin(
          zuvyCodingQuestions,
          and(
            eq(zuvyCodingQuestions.id, zuvyOutsourseCodingQuestions.codingQuestionId),
            eq(zuvyCodingQuestions.difficulty, difficultyLevel),
            inArray(zuvyCodingQuestions.tagId, selectedTagIds)
          )
        )
        .leftJoin(
          zuvyPracticeCode,
          and(
            eq(zuvyPracticeCode.questionId, zuvyCodingQuestions.id),
            eq(zuvyPracticeCode.submissionId, assessmentSubmissionId),
            eq(zuvyPracticeCode.userId, userId),
          )
        )
        .where(eq(zuvyOutsourseCodingQuestions.assessmentOutsourseId, assessmentOutsourseId))
        .orderBy(sql`md5(${zuvyOutsourseCodingQuestions.id}::text || ${parseInt(userId)})`) // Using seed for randomization
        .limit(limit);
  
  
      return questions;
    } catch (error) {
      console.error("Error in getCodingQuestionsByDifficulty: ", error);
      throw error;
    }
  }
  
  
  

  async getCodingQuestionsByAllDifficulties(assessmentOutsourseId, assessmentOutsourseData,userId, assessmentSubmissionId): Promise<any> {
    try {
      const difficulties = [DIFFICULTY.EASY, DIFFICULTY.MEDIUM, DIFFICULTY.HARD];
  
      const promises = difficulties.map(difficulty => 
        this.getCodingQuestionsByDifficulty(
          difficulty, 
          assessmentOutsourseId, 
          assessmentOutsourseData[`${difficulty.toLowerCase()}CodingQuestions`],
          assessmentOutsourseData.codingQuestionTagId,
          userId, assessmentSubmissionId
        ).then(result => {
          return { difficulty, result };
        })
      );
  
      const results = await Promise.all(promises);

      const questionsByDifficulty = results.reduce((acc, curr) => {
        acc[curr.difficulty] = curr.result;
        return acc;
      }, {});
  
      return [null, questionsByDifficulty];
    } catch (err) {
      Logger.error(JSON.stringify(err));
      return [{ message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }
  
  /**
 * Initiates an assessment for a student.
 * This function might set up necessary variables, database entries, or other prerequisites 
 * for a student to begin taking an assessment.
 */
  async startAssessmentForStudent(assessmentOutsourseId: number, user): Promise<any> {
    try {
      let { id, roles } = user;
    const assessmentOutsourseData = await db.query.zuvyOutsourseAssessments.findFirst({
      where: (zuvyOutsourseAssessments, { eq }) =>
        eq(zuvyOutsourseAssessments.id, assessmentOutsourseId),
      with: {
        ModuleAssessment: true,
        submitedOutsourseAssessments:true,
      },
    });
    if ( roles.includes('admin') ){
      id = Math.floor(Math.random() * (99999 - 1000 + 1)) + 1000;
    }
    let assessmentSubmissionId
    if (assessmentOutsourseData.hasOwnProperty('submitedOutsourseAssessments')){
      if (assessmentOutsourseData.submitedOutsourseAssessments.length > 0){
        assessmentSubmissionId = assessmentOutsourseData.submitedOutsourseAssessments[0].id
      }
    } 
    // Fetching all coding questions at once
    const [err, codingQuestions] = await this.getCodingQuestionsByAllDifficulties(assessmentOutsourseId, assessmentOutsourseData, id, assessmentSubmissionId);
    if (err){
      Logger.error(JSON.stringify(err));
      return [{ message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
    
    // Accessing the questions for each difficulty level
    const easyCodingQuestions = codingQuestions[DIFFICULTY.EASY];
    const mediumCodingQuestions = codingQuestions[DIFFICULTY.MEDIUM];
    const hardCodingQuestions = codingQuestions[DIFFICULTY.HARD];
      
      let startedAt = new Date().toISOString();
      let submission = await db.select().from(zuvyAssessmentSubmission).where(sql`${zuvyAssessmentSubmission.userId} = ${id} AND ${zuvyAssessmentSubmission.assessmentOutsourseId} = ${assessmentOutsourseId} AND ${zuvyAssessmentSubmission.submitedAt} IS NULL`);
      if (submission.length == 0) {
        let insertAssessmentSubmission: any = { userId: id, assessmentOutsourseId, startedAt }
        submission = await db.insert(zuvyAssessmentSubmission).values(insertAssessmentSubmission).returning();
      }
      let quizzes = await db.select().from(zuvyQuizTracking).where(sql`${zuvyQuizTracking.assessmentSubmissionId} = ${submission[0].id}`)
      console.log({quizzes});
      let assessment = {
        ...assessmentOutsourseData,
        IsQuizzSubmission: quizzes.length > 0? true : false,
        codingQuestions:[
          ...easyCodingQuestions,
          ...mediumCodingQuestions,
          ...hardCodingQuestions
        ],
        submission: submission[0]
      }
      // return [null, assessment];
      return [null, { message: 'Coding question fetched successfully', data: assessment, statusCode: STATUS_CODES.OK }];

    } catch (err) {
      console.log({err})
      Logger.error(JSON.stringify(err));
      return [{ message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }]; 
    }
  }

  async getQuizQuestionsByDifficulty(
    difficultyLevel,
    assessmentOutsourseId,
    limit,
    selectedTagIds,
    userId,
    assessmentSubmissionId
  ): Promise<any> {
    try {
      let quizzes;
      if (!assessmentSubmissionId){
        quizzes = await db
        .select({
          quizId: zuvyModuleQuiz.id, // ID of the main quiz
          quizTitle: zuvyModuleQuiz.title, // Title of the main quiz
          difficulty: zuvyModuleQuiz.difficulty, // Difficulty level of the main quiz
          variantId: zuvyModuleQuizVariants.id, // ID of the variant
          question: zuvyModuleQuizVariants.question, // Question text of the variant
          options: zuvyModuleQuizVariants.options, // Options for the variant question
          correctOption: zuvyModuleQuizVariants.correctOption, // Correct option of the variant
          variantNumber: zuvyModuleQuizVariants.variantNumber, // Variant number
          assessmentId: zuvyOutsourseQuizzes.assessmentOutsourseId, // Associated assessment ID
        })
        .from(zuvyOutsourseQuizzes)
        .innerJoin(
          zuvyModuleQuizVariants,
          eq(zuvyOutsourseQuizzes.quiz_id, zuvyModuleQuizVariants.quizId) // Joining with quiz variants
        )
        .innerJoin(
          zuvyModuleQuiz,
          and(
            eq(zuvyModuleQuiz.id, zuvyModuleQuizVariants.quizId), // Joining with the main quiz
            eq(zuvyModuleQuiz.difficulty, difficultyLevel), // Filtering by difficulty level
            inArray(zuvyModuleQuiz.tagId, selectedTagIds) // Filtering by tag IDs
          )
        ).orderBy(
          sql`md5(CAST(${zuvyOutsourseQuizzes.id} AS text) || ${userId}::text)` // Randomized order by user ID
        )
        .limit(limit);
      } else {
        quizzes = await db
          .select({
            quizId: zuvyModuleQuiz.id, // ID of the main quiz
            quizTitle: zuvyModuleQuiz.title, // Title of the main quiz
            difficulty: zuvyModuleQuiz.difficulty, // Difficulty level of the main quiz
            variantId: zuvyModuleQuizVariants.id, // ID of the variant
            question: zuvyModuleQuizVariants.question, // Question text of the variant
            options: zuvyModuleQuizVariants.options, // Options for the variant question
            correctOption: zuvyModuleQuizVariants.correctOption, // Correct option of the variant
            variantNumber: zuvyModuleQuizVariants.variantNumber, // Variant number
            outsourseQuizzesId: zuvyOutsourseQuizzes.id, // Associated assessment ID
            submissionsData: {   
              id: zuvyQuizTracking.id, // ID from zuvyQuizTracking
              userId: zuvyQuizTracking.userId, // User ID from zuvyQuizTracking
              attemptCount: zuvyQuizTracking.attemptCount, // Attempt count from zuvyQuizTracking
              chosenOption: zuvyQuizTracking.chosenOption, // Chosen option from zuvyQuizTracking
              status: zuvyQuizTracking.status, // Status from zuvyQuizTracking
              createdAt: zuvyQuizTracking.createdAt, 
            }
          })
          .from(zuvyOutsourseQuizzes)
          .innerJoin(
            zuvyModuleQuizVariants,
            eq(zuvyOutsourseQuizzes.quiz_id, zuvyModuleQuizVariants.quizId) // Joining with quiz variants
          )
          .innerJoin(
            zuvyModuleQuiz,
            and(
              eq(zuvyModuleQuiz.id, zuvyModuleQuizVariants.quizId), // Joining with the main quiz
              eq(zuvyModuleQuiz.difficulty, difficultyLevel), // Filtering by difficulty level
              inArray(zuvyModuleQuiz.tagId, selectedTagIds) // Filtering by tag IDs
            )
          )
          .leftJoin(
            zuvyQuizTracking,
            and(
              eq(zuvyQuizTracking.mcqId, zuvyModuleQuizVariants.id),
              eq(zuvyQuizTracking.assessmentSubmissionId, assessmentSubmissionId),
              eq(zuvyQuizTracking.userId, userId),
            )
          )
          .where(eq(zuvyOutsourseQuizzes.assessmentOutsourseId, assessmentOutsourseId)) // Filtering by assessment ID
          .orderBy(
            sql`md5(CAST(${zuvyOutsourseQuizzes.id} AS text) || ${userId}::text)` // Randomized order by user ID
          )
          .limit(limit);
      }    
  
      return quizzes;
    } catch (err) {
      console.error("Error fetching quiz questions: ", err);
      return { message: err.message, statusCode: STATUS_CODES.BAD_REQUEST };
    }
  }
  
  async getQuizQuestionsByAllDifficulties(
    assessmentOutsourseId,
    quizConfig,
    userId,
    assessmentSubmissionId
  ): Promise<[null | Error, { [key: string]: any[] }]> {
    try {
      const difficulties = ['easy', 'medium', 'hard'];
      const questionsByDifficulty: { [key: string]: any[] } = {};
  
      // Fetching quiz questions for all difficulties in parallel
      await Promise.all(
        difficulties.map(async (difficulty) => {
          const capitalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  
          questionsByDifficulty[difficulty] = await this.getQuizQuestionsByDifficulty(
            capitalizedDifficulty,
            assessmentOutsourseId,
            quizConfig[`${difficulty}McqQuestions`],
            quizConfig.mcqTagId,
            userId,
            assessmentSubmissionId
          );
        })
      );
  
      return [null, questionsByDifficulty];
    } catch (error) {
      console.error("Error fetching questions by all difficulties: ", error);
      return [error, {}];
    }
  }  
  

  async getAssessmentDetailsOfQuiz(assessmentOutsourseId: number, user, userId): Promise<any> {
    try {
      const assessmentOutsourseData = await db.query.zuvyOutsourseAssessments.findFirst({
        where: (zuvyOutsourseAssessments, { eq }) =>
          eq(zuvyOutsourseAssessments.id, assessmentOutsourseId),
        with: {
          ModuleAssessment: true,
          submitedOutsourseAssessments: true
        },
      });  
      if (user.roles.includes('admin') ){
        userId = Math.floor(Math.random() * (99999 - 1000 + 1)) + 1000;
      }
      let assessmentSubmissionId = null
      // Fetching all quiz questions at once
    if (assessmentOutsourseData.hasOwnProperty('submitedOutsourseAssessments')){
      if (assessmentOutsourseData.submitedOutsourseAssessments.length > 0){
        assessmentSubmissionId = assessmentOutsourseData.submitedOutsourseAssessments[0].id
      }
    } 
      const [err, quizQuestions] = await this.getQuizQuestionsByAllDifficulties(assessmentOutsourseId, assessmentOutsourseData, userId, assessmentSubmissionId);
      if (err){
        Logger.error(JSON.stringify(err));
        return [null, { message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }];      
      }
      // Accessing the questions for each difficulty level
      const easyQuizQuestions = quizQuestions['easy'] || [];
      const mediumQuizQuestions = quizQuestions['medium'] || [];
      const hardQuizQuestions = quizQuestions['hard'] || [];
  
      // Do something with the fetched quiz questions
      return [null, { message: 'quiz question fetched successfully', data: {
        mcqs: [
        ...easyQuizQuestions,
        ...mediumQuizQuestions,
        ...hardQuizQuestions,
      ]}, statusCode: STATUS_CODES.OK }];
    } catch (err) {
      Logger.error(JSON.stringify(err));
      return [null, { message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }];    }
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
            let updateModuleForm: any = {
              chapterId: formQuestion.chapterId,
              question: formQuestion.question,
              options: formQuestion.options,
              typeId: formQuestion.typeId,
              isRequired: formQuestion.isRequired,
            }
            const result = await db
              .update(zuvyModuleForm)
              .set(updateModuleForm)
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
      } else {
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

  async getOpenendedQuestionDetails(id: number): Promise<any> {
    try {
      const openEnded = await db.select().from(zuvyOpenEndedQuestions).where(eq(zuvyOpenEndedQuestions.id, id));
      if (openEnded.length > 0) {
        return [null, { data: openEnded }]
      }
      return [{ statusCode: STATUS_CODES.NOT_FOUND, message: 'The openended question is not found' }];
    }
    catch (err) {
      return [{ message: err.message }]
    }
  }

  async getCodingQuestionDetails(id: number): Promise<any> {
    try {
      const codingQuestion = await db.select().from(zuvyCodingQuestions).where(eq(zuvyCodingQuestions.id, id));
      if (codingQuestion.length > 0) {
        return [null, { data: codingQuestion }]
      }
      return [{ statusCode: STATUS_CODES.NOT_FOUND, message: 'The coding question is not found' }];
    }
    catch (err) {
      return [{ message: err.message }]
    }
  }

  async getQuizQuestionDetails(id: number): Promise<any> {
    try {
      const quizQuestion = await db.select().from(zuvyModuleQuiz).where(eq(zuvyModuleQuiz.id, id));
      if (quizQuestion.length > 0) {
        return [null, { data: quizQuestion }]
      }
      return [{ statusCode: STATUS_CODES.NOT_FOUND, message: 'The quiz question is not found' }];
    }
    catch (err) {
      return [{ message: err.message }]
    }
  }

  async getAllQuizVariants(quizId: number): Promise<any> {
    try {
      const result = await db.query.zuvyModuleQuiz.findMany({
        where: (zuvyModuleQuiz, { eq }) =>
          eq(zuvyModuleQuiz.id, quizId),
        with: {
          quizVariants: {
            where: (zuvyModuleQuizVariants, { eq }) =>
              eq(zuvyModuleQuizVariants.quizId, quizId),
            orderBy: (quizVariants, { asc }) => asc(quizVariants.id),
          },
        }
      })
        .execute();

      if (result.length === 0) {
        return [
          null,
          {
            message: 'No variants found for the provided quiz ID',
            statusCode: STATUS_CODES.NOT_FOUND,
            data: []
          }
        ];
      }

      return [
        null,
        {
          message: 'Variants retrieved successfully',
          statusCode: STATUS_CODES.OK,
          data: result
        }
      ];
    } catch (err) {
      return [{ message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }, null];
    }
  }

  async addQuizVariants(addQuizVariantsDto: AddQuizVariantsDto): Promise<any> {
    const { quizId, variantMCQs } = addQuizVariantsDto;

    try {
      // Check if quizId exists in the main quiz table
      const mainQuizExists = await db
        .select({ id: zuvyModuleQuiz.id })
        .from(zuvyModuleQuiz)
        .where(eq(zuvyModuleQuiz.id, quizId));

      if (mainQuizExists.length === 0) {
        return [
          { message: `Quiz ID ${quizId} does not exist in the main quiz table.`, statusCode: STATUS_CODES.NOT_FOUND },
          null,
        ];
      }

      // Fetch all variants for this quiz and find the current highest variant number
      const existingVariants = await db
        .select({ variantNumber: zuvyModuleQuizVariants.variantNumber })
        .from(zuvyModuleQuizVariants)
        .where(eq(zuvyModuleQuizVariants.quizId, quizId));

      const maxVariantNumber = existingVariants.reduce((max, variant) => Math.max(max, variant.variantNumber), 0);
      let nextVariantNumber = maxVariantNumber + 1;

      // Prepare new variant data with incremented variant numbers
      const variantData = variantMCQs.map((variant: CreateQuizVariantDto) => ({
        quizId,
        variantNumber: nextVariantNumber++,
        question: variant.question,
        options: variant.options,
        correctOption: variant.correctOption,
      }));

      // Insert new variants into the variants table
      await db.insert(zuvyModuleQuizVariants).values(variantData);

      return [null, {
        message: 'Variants added successfully.',
        statusCode: STATUS_CODES.CREATED,
        data: variantData
      }];
    } catch (err) {
      return [{ message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }, null];
    }
  }

  async deleteQuizOrVariant(deleteDto: deleteQuestionOrVariantDto): Promise<any> {
    try {
      let mainQuizIds: number[] = [];
      let variantDeletions: { id: number; quizId: number }[] = [];
  
      // Process deleteDto based on its type
      for (const item of deleteDto.questionIds) {
        if (item.type === 'main') {
          mainQuizIds.push(item.id);
        } else if (item.type === 'variant') {
          const variant = await db
            .select({ quizId: zuvyModuleQuizVariants.quizId })
            .from(zuvyModuleQuizVariants)
            .where(sql`${zuvyModuleQuizVariants.id} = ${item.id}`)
            .limit(1);
  
          if (variant.length) {
            variantDeletions.push({ id: item.id, quizId: variant[0].quizId });
          }
        }
      }
  
      // Deletion logic for main quizzes
      if (mainQuizIds.length > 0) {
        const usedQuizzes = await db
          .select()
          .from(zuvyModuleQuiz)
          .where(sql`${inArray(zuvyModuleQuiz.id, mainQuizIds)} AND ${zuvyModuleQuiz.usage} > 0`);
  
        const usedQuizIds = usedQuizzes.map(quiz => quiz.id);
        const deletableQuizIds = mainQuizIds.filter(id => !usedQuizIds.includes(id));
  
        if (deletableQuizIds.length > 0) {
          await db
            .delete(zuvyModuleQuizVariants)
            .where(sql`${inArray(zuvyModuleQuizVariants.quizId, deletableQuizIds)}`);
          await db
            .delete(zuvyModuleQuiz)
            .where(sql`${inArray(zuvyModuleQuiz.id, deletableQuizIds)}`)
            .returning();
        }
  
        if (usedQuizIds.length > 0) {
          return [{
            message: `Quizzes with IDs ${usedQuizIds.join(', ')} cannot be deleted as they are in use.`,
            statusCode: STATUS_CODES.BAD_REQUEST,
          }, null];
        }
      }
  
      // Deletion logic for quiz variants
      for (const { id: variantId, quizId } of variantDeletions) {
        const variantCount = await db
          .select()
          .from(zuvyModuleQuizVariants)
          .where(sql`${zuvyModuleQuizVariants.quizId} = ${quizId}`);
  
        if (variantCount.length <= 1) {
          return [{
            message: `Quiz with ID ${quizId} cannot delete its last remaining variant.`,
            statusCode: STATUS_CODES.BAD_REQUEST,
          }, null];
        }
  
        // Check if the main quiz of this variant has `usage` > 0
        const mainQuizUsage = await db
          .select({ usage: zuvyModuleQuiz.usage })
          .from(zuvyModuleQuiz)
          .where(sql`${zuvyModuleQuiz.id} = ${quizId}`)
          .limit(1);
  
        if (mainQuizUsage.length && mainQuizUsage[0].usage > 0) {
          return [{
            message: `Variant with ID ${variantId} cannot be deleted as its main quiz with ID ${quizId} is in use.`,
            statusCode: STATUS_CODES.BAD_REQUEST,
          }, null];
        }
  
        const variantToDelete = await db
          .select({ variantNumber: zuvyModuleQuizVariants.variantNumber })
          .from(zuvyModuleQuizVariants)
          .where(sql`${zuvyModuleQuizVariants.id} = ${variantId}`);
        
        if (!variantToDelete.length) {
          return [{
            message: `Variant with ID ${variantId} not found.`,
            statusCode: STATUS_CODES.NOT_FOUND,
          }, null];
        }
  
        const { variantNumber } = variantToDelete[0];
        await db
          .delete(zuvyModuleQuizVariants)
          .where(sql`${zuvyModuleQuizVariants.id} = ${variantId}`)
          .returning();
  
        // Update the variant numbers for remaining variants
        await db
          .update(zuvyModuleQuizVariants)
          .set({ variantNumber: sql`${zuvyModuleQuizVariants.variantNumber} - 1` })
          .where(sql`${zuvyModuleQuizVariants.variantNumber} > ${variantNumber} AND ${zuvyModuleQuizVariants.quizId} = ${quizId}`)
          .returning();
      }
  
      return [null, {
        message: 'Selected quizzes and/or variants have been deleted and renumbered successfully where applicable.',
        statusCode: STATUS_CODES.OK,
      }];
    } catch (error) {
      Logger.log(`Error in deleteQuizOrVariant: ${error.message}`);
      return [{
        message: error.message,
        statusCode: STATUS_CODES.BAD_REQUEST,
      }, null];
    }
  }
  
}

