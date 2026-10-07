import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateAiAssessmentDto,
  GenerateAssessmentDto,
} from './dto/create-ai-assessment.dto';
import { UpdateAiAssessmentDto } from './dto/update-ai-assessment.dto';
import { db } from 'src/db';
import {
  questionStudentAnswerRelation,
  studentLevelRelation,
  levels,
  aiAssessment,
  correctAnswers,
  studentAnswers,
  aiAssessmentQuestions,
  zuvyBatchEnrollments,
  studentAssessment,
  users,
  zuvyQuestions,
} from 'drizzle/schema';
import {
  SubmitAssessmentDto,
  ScoreSubmitDto,
} from './dto/create-ai-assessment.dto';
import { LlmService } from 'src/llm/llm.service';
import {
  answerEvaluationPrompt,
  generateMcqPrompt,
} from './system_prompts/system_prompts';
import { parseLlmEvaluation } from 'src/llm/llm_response_parsers/evaluationParser';
import { QuestionEvaluationService } from 'src/questions-by-llm/question-evaluation.service';
import { eq, and, or, asc, desc, inArray, sum, sql } from 'drizzle-orm';
import { parseLlmMcq } from 'src/llm/llm_response_parsers/mcqParser';
import { QuestionsByLlmService } from 'src/questions-by-llm/questions-by-llm.service';
import { resolveLevelBand } from 'src/level/level-band.util';
import { LLMUsageService } from 'src/llm/llmUsage.service';
import { StorageService } from 'src/storage/storage.service';
// import { encode } from '@toon-format/toon';

@Injectable()
export class AiAssessmentService {
  private readonly logger = new Logger(AiAssessmentService.name);
  constructor(
    private readonly llmService: LlmService,
    private readonly questionEvaluationService: QuestionEvaluationService,
    private readonly questionByLlmService: QuestionsByLlmService,
    private readonly llmUsageService: LLMUsageService,
    private readonly storageService: StorageService,
  ) {}

  async saveTokenUsage(aiAssessmentId: number, response: any) {
    const usageData = {
      aiAssessmentId,
      provider: response?.provider ?? 'openai',
      prompt:
        response?.request?.messages?.map((m) => m.content).join('\n') ?? '',
      responseText: response?.message?.content ?? '',
      latencyMs: response?.latencyMs ?? 0,
      usage: response?.usage ?? null,
      createdAt: new Date(),
    };

    await this.llmUsageService.save(usageData);
  }
  async create(userId, createAiAssessmentDto: any) {
    try {
      const { inserted, enrolledStudentsCount } = await db.transaction(
        async (tx) => {
          const payload = {
            bootcampId: createAiAssessmentDto.bootcampId,
            chapterId: createAiAssessmentDto.chapterId,
            title: createAiAssessmentDto.title,
            description: createAiAssessmentDto.description ?? null,
            objective: createAiAssessmentDto.objective,
            chapterIds: createAiAssessmentDto.chapterIds ?? [],
            poolTopics: createAiAssessmentDto.poolTopics ?? [],
            // audience: createAiAssessmentDto.audience ?? null,
            totalNumberOfQuestions:
              createAiAssessmentDto.totalNumberOfQuestions,
            totalQuestionsWithBuffer: Math.floor(
              createAiAssessmentDto.totalNumberOfQuestions * 2.25,
            ),
            startDatetime: createAiAssessmentDto.startDatetime,
            endDatetime: createAiAssessmentDto.endDatetime,
          };

          const [aiRow] = await tx
            .insert(aiAssessment)
            .values(payload as any)
            .returning();

          const enrolledStudents = await tx
            .select({
              studentId: zuvyBatchEnrollments.userId,
            })
            .from(zuvyBatchEnrollments)
            .innerJoin(users, eq(zuvyBatchEnrollments.userId, users.id))
            .where(
              eq(
                zuvyBatchEnrollments.bootcampId,
                createAiAssessmentDto.bootcampId,
              ),
            );

          if (enrolledStudents.length > 0) {
            const studentAssessments = enrolledStudents.map((student) => ({
              studentId: Number(student.studentId),
              aiAssessmentId: aiRow.id,
              status: 0,
            }));
            await tx.insert(studentAssessment).values(studentAssessments);
          }

          return {
            inserted: aiRow,
            enrolledStudentsCount: enrolledStudents.length,
          };
        },
      );

      await this.generate(userId, {
        aiAssessmentId: inserted.id,
        bootcampId: inserted.bootcampId,
      });

      return {
        message:
          'AI Assessment created successfully and assigned to all enrolled students',
        data: inserted,
        totalAssignedStudents: enrolledStudentsCount,
      };
    } catch (error) {
      this.logger.error(
        'Error creating AI assessment:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException(
        'Failed to create AI assessment: ' + error.message,
      );
    }
  }

  async getDistinctLevelsByAssessment(aiAssessmentId: number) {
    const results = await db
      .select({
        id: levels.id,
        grade: levels.grade,
        scoreRange: levels.scoreRange,
        scoreMin: levels.scoreMin,
        scoreMax: levels.scoreMax,
        hardship: levels.hardship,
        meaning: levels.meaning,
        createdAt: levels.createdAt,
        updatedAt: levels.updatedAt,
      })
      .from(studentLevelRelation)
      .innerJoin(levels, eq(levels.id, studentLevelRelation.levelId))
      .where(eq(studentLevelRelation.aiAssessmentId, aiAssessmentId))
      .groupBy(levels.id);

    return results;
  }

  async generateMcqPromptsForEachLevel(
    levels,
    aiAssessmentId,
    allQuestions,
    topicOfCurrentAssessment,
    totalQuestions,
  ) {
    // const systemPrompts = [];
    if (levels.length == 0) {
      const levelDescription = 'Base Level.';
      // const audience = 'student';
      let previous_mcqs_str;
      let baseLinePrompt = '';
      if (allQuestions.length == 0) {
        previous_mcqs_str =
          'There is no previous assessment for your reference. This is a base line assessment. Hence produce average level questions on the selected topics.';
      } else {
        previous_mcqs_str = JSON.stringify(allQuestions);
      }

      const prompt = generateMcqPrompt(
        'Beginners Level.',
        levelDescription,
        // audience,
        previous_mcqs_str,
        topicOfCurrentAssessment,
        totalQuestions,
      );

      const aiResponse = await this.llmService.generate({
        systemPrompt: prompt,
      });
      const parsedAiResponse = await parseLlmMcq(aiResponse);
      await this.questionByLlmService.create(
        { questions: parsedAiResponse.evaluations, levelId: null },
        aiAssessmentId,
      );
    }
    for (const level of levels) {
      const levelName = level.grade;
      const levelDescription =
        level.meaning || `${levelName} — ${level.scoreRange}`;
      // const audience = 'student';
      let previous_mcqs_str;
      let baseLinePrompt = '';
      if (allQuestions.length == 0) {
        previous_mcqs_str =
          'There is no previous assessment for your reference. This is a base line assessment. Hence produce average level questions on the selected topics.';
      } else {
        previous_mcqs_str = JSON.stringify(allQuestions);
      }

      const prompt = generateMcqPrompt(
        levelName,
        levelDescription,
        // audience,
        previous_mcqs_str,
        topicOfCurrentAssessment,
        totalQuestions,
      );

      const aiResponse = await this.llmService.generate({
        systemPrompt: prompt,
      });
      const parsedAiResponse = await parseLlmMcq(aiResponse);
      await this.questionByLlmService.create(
        { questions: parsedAiResponse.evaluations, levelId: level.id },
        aiAssessmentId,
      );
      // systemPrompts.push({
      //   levelId: level.id,
      //   grade: level.grade,
      //   prompt,
      // });
    }
    // return systemPrompts;
  }

  async generate(userId, generateAssessmentDto: GenerateAssessmentDto) {
    const { aiAssessmentId } = generateAssessmentDto;
    const distinctLevels =
      await this.getDistinctLevelsByAssessment(aiAssessmentId);
    const allAssessmentOfABootcamp = await this.findAll(
      userId,
      generateAssessmentDto.bootcampId,
    );
    const assessmentIds = allAssessmentOfABootcamp.map((a) => a.id);
    const allQuestionsOfAllAssessmentsInABootcamp =
      await this.questionByLlmService.getAllLlmQuestionsOfAllAssessments(
        assessmentIds,
      );
    const topicOfCurrentAssessment = await this.getTopicsOfAssessments([
      generateAssessmentDto.aiAssessmentId,
    ]);
    const totalQuestions = await this.getTotalQuestions([
      generateAssessmentDto.aiAssessmentId,
    ]);
    await this.generateMcqPromptsForEachLevel(
      distinctLevels,
      aiAssessmentId,
      allQuestionsOfAllAssessmentsInABootcamp,
      topicOfCurrentAssessment[0].topics,
      totalQuestions,
    );
  }

  async countScore(submitAssessmentDto: SubmitAssessmentDto) {
    const { answers } = submitAssessmentDto;
    let score = 0;
    const correctByQuestionId = new Map<string, boolean>();

    for (const q of answers) {
      if (!q.selectedAnswerByStudent) {
        correctByQuestionId.set(String(q.id), false);
        continue;
      }
      const correct = await db
        .select()
        .from(correctAnswers)
        .where(
          and(
            eq(correctAnswers.questionId, q.id),
            eq(correctAnswers.correctOptionId, q.selectedAnswerByStudent.id),
          ),
        )
        .limit(1);

      const isCorrect = correct.length > 0;
      correctByQuestionId.set(String(q.id), isCorrect);
      if (isCorrect) {
        score++;
      }
    }
    return { score, totalQuestions: answers.length, correctByQuestionId };
  }

  async submitAndScore(studentId: number, dto: ScoreSubmitDto) {
    const { assessmentId, questions } = dto;

    return await db.transaction(async (tx) => {
      const [assessmentRow] = await tx
        .select({
          status: aiAssessment.status,
          startDatetime: aiAssessment.startDatetime,
          bootcampId: aiAssessment.bootcampId,
        })
        .from(aiAssessment)
        .where(eq(aiAssessment.id, assessmentId))
        .limit(1);

      if (
        !assessmentRow ||
        !this.isAssessmentAvailable(
          assessmentRow.status,
          assessmentRow.startDatetime,
        )
      ) {
        throw new BadRequestException('Assessment is not yet available');
      }

      const questionIds = questions.map((q) => q.questionId);
      const correctRows = await tx
        .select({
          id: zuvyQuestions.id,
          correctOption: zuvyQuestions.correctOption,
        })
        .from(zuvyQuestions)
        .where(inArray(zuvyQuestions.id, questionIds));

      const correctMap = new Map<number, number>();
      for (const row of correctRows) {
        correctMap.set(row.id, row.correctOption);
      }

      let score = 0;
      const totalQuestions = questions.length;

      const questionDetails = questions.map((q) => {
        const correctOption = correctMap.get(q.questionId) ?? null;
        const selectedOption = q.correctOptionSelectedByStudents ?? null;
        const isCorrect =
          selectedOption !== null &&
          correctOption !== null &&
          selectedOption === correctOption;

        if (isCorrect) score++;

        return {
          questionId: q.questionId,
          correctOption,
          selectedOption,
          isCorrect,
        };
      });

      const percentage =
        totalQuestions > 0
          ? Math.round((score / totalQuestions) * 100 * 100) / 100
          : 0;

      const answerPayloads = questionDetails.map((detail) => ({
        studentId,
        aiAssessmentId: assessmentId,
        questionId: detail.questionId,
        selectedOption: detail.selectedOption,
        isCorrect: detail.isCorrect ? 1 : 0,
        answeredAt: new Date().toISOString(),
      }));

      await Promise.all(
        answerPayloads.map((payload) =>
          tx.insert(studentAnswers).values(payload),
        ),
      );

      await tx
        .update(studentAssessment)
        .set({
          status: 1,
          updatedAt: new Date().toISOString(),
        } as any)
        .where(
          and(
            eq(studentAssessment.studentId, studentId),
            eq(studentAssessment.aiAssessmentId, assessmentId),
          ),
        );

      const level = await this.calculateStudentLevel(percentage);

      await tx.insert(studentLevelRelation).values({
        studentId,
        levelId: level.id,
        aiAssessmentId: assessmentId,
        bootcampId: assessmentRow.bootcampId,
        assignedAt: new Date().toISOString(),
      });

      return {
        score,
        totalQuestions,
        percentage,
        level: {
          grade: level.grade,
          meaning: level.meaning,
          hardship: level.hardship,
        },
        questions: questionDetails,
      };
    });
  }

  async getSubmitScoreResult(studentId: number, assessmentId: number) {
    const [assignment] = await db
      .select({
        status: studentAssessment.status,
        questionSetId: studentAssessment.questionSetId,
      })
      .from(studentAssessment)
      .where(
        and(
          eq(studentAssessment.studentId, studentId),
          eq(studentAssessment.aiAssessmentId, assessmentId),
        ),
      )
      .limit(1);

    if (!assignment || assignment.status !== 1) {
      throw new NotFoundException(
        'Assessment result not found or not completed',
      );
    }

    const answerRows = await db
      .select({
        questionId: studentAnswers.questionId,
        selectedOption: studentAnswers.selectedOption,
      })
      .from(studentAnswers)
      .where(
        and(
          eq(studentAnswers.studentId, studentId),
          eq(studentAnswers.aiAssessmentId, assessmentId),
        ),
      );

    if (!answerRows.length) {
      throw new NotFoundException('Assessment result not found');
    }

    const questionIds = answerRows.map((r) => r.questionId);
    const correctRows = await db
      .select({
        id: zuvyQuestions.id,
        correctOption: zuvyQuestions.correctOption,
      })
      .from(zuvyQuestions)
      .where(inArray(zuvyQuestions.id, questionIds));

    const correctMap = new Map<number, number>();
    for (const row of correctRows) {
      correctMap.set(row.id, row.correctOption);
    }

    const ordered = [...answerRows];
    if (assignment.questionSetId) {
      const positions = await db
        .select({
          questionId: aiAssessmentQuestions.questionId,
          position: aiAssessmentQuestions.position,
        })
        .from(aiAssessmentQuestions)
        .where(
          and(
            eq(aiAssessmentQuestions.questionSetId, assignment.questionSetId),
            inArray(aiAssessmentQuestions.questionId, questionIds),
          ),
        );

      const posMap = new Map(
        positions.map((p) => [p.questionId, p.position] as const),
      );
      ordered.sort((a, b) => {
        const pa = posMap.get(a.questionId) ?? 999999;
        const pb = posMap.get(b.questionId) ?? 999999;
        if (pa !== pb) return pa - pb;
        return a.questionId - b.questionId;
      });
    } else {
      ordered.sort((a, b) => a.questionId - b.questionId);
    }

    const questionDetails = ordered.map((r) => {
      const correctOption = correctMap.get(r.questionId) ?? null;
      const selectedOption = r.selectedOption ?? null;
      const isCorrect =
        selectedOption !== null &&
        correctOption !== null &&
        selectedOption === correctOption;

      return {
        questionId: r.questionId,
        correctOption,
        selectedOption,
        isCorrect,
      };
    });

    let score = 0;
    for (const q of questionDetails) {
      if (q.isCorrect) score++;
    }
    const totalQuestions = questionDetails.length;
    const percentage =
      totalQuestions > 0
        ? Math.round((score / totalQuestions) * 100 * 100) / 100
        : 0;

    const [levelFromDb] = await db
      .select({
        grade: levels.grade,
        meaning: levels.meaning,
        hardship: levels.hardship,
      })
      .from(studentLevelRelation)
      .innerJoin(levels, eq(studentLevelRelation.levelId, levels.id))
      .where(
        and(
          eq(studentLevelRelation.studentId, studentId),
          eq(studentLevelRelation.aiAssessmentId, assessmentId),
        ),
      )
      .orderBy(desc(studentLevelRelation.id))
      .limit(1);

    let levelPayload: {
      grade: string;
      meaning: string | null;
      hardship: string | null;
    };
    if (levelFromDb) {
      levelPayload = levelFromDb;
    } else {
      const level = await this.calculateStudentLevel(percentage);
      levelPayload = {
        grade: level.grade,
        meaning: level.meaning,
        hardship: level.hardship,
      };
    }

    return {
      score,
      totalQuestions,
      percentage,
      level: levelPayload,
      questions: questionDetails,
    };
  }

  async getAssessmentTimeStatus(assessmentId: number) {
    const [row] = await db
      .select({
        id: aiAssessment.id,
        status: aiAssessment.status,
        startDatetime: aiAssessment.startDatetime,
        endDatetime: aiAssessment.endDatetime,
      })
      .from(aiAssessment)
      .where(eq(aiAssessment.id, assessmentId))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Assessment not found');
    }

    const now = new Date();
    const end = row.endDatetime ? new Date(row.endDatetime) : null;
    const start = row.startDatetime ? new Date(row.startDatetime) : null;

    const expired = end !== null && now > end;

    let active = false;
    if (row.status !== 'draft' && !expired) {
      if (row.status === 'published') {
        active = start === null || now >= start;
      } else if (row.status === 'scheduled') {
        active = start !== null && now >= start;
      }
    }

    return {
      assessmentId: row.id,
      status: row.status,
      startDatetime: row.startDatetime,
      endDatetime: row.endDatetime,
      expired,
      active,
    };
  }

  async getStudentQuestions(userId: number, aiAssessmentId: number) {
    const rows = await db
      .select({
        studentStatus: studentAssessment.status,
        questionSetId: studentAssessment.questionSetId,
        assessmentStatus: aiAssessment.status,
        startDatetime: aiAssessment.startDatetime,
      })
      .from(studentAssessment)
      .innerJoin(
        aiAssessment,
        eq(studentAssessment.aiAssessmentId, aiAssessment.id),
      )
      .where(
        and(
          eq(studentAssessment.studentId, userId),
          eq(studentAssessment.aiAssessmentId, aiAssessmentId),
        ),
      )
      .limit(1);

    if (!rows.length) {
      throw new NotFoundException(
        'No assessment assignment found for this student',
      );
    }

    const row = rows[0];

    if (!this.isAssessmentAvailable(row.assessmentStatus, row.startDatetime)) {
      throw new BadRequestException('Assessment is not yet available');
    }

    if (!row.questionSetId) {
      throw new BadRequestException(
        'No question set has been assigned to this student yet',
      );
    }

    const questions = await db
      .select({
        questionId: aiAssessmentQuestions.questionId,
        position: aiAssessmentQuestions.position,
        question: zuvyQuestions.question,
        options: zuvyQuestions.options,
        difficulty: zuvyQuestions.difficulty,
        topic: zuvyQuestions.topicName,
        language: zuvyQuestions.language,
      })
      .from(aiAssessmentQuestions)
      .innerJoin(
        zuvyQuestions,
        eq(aiAssessmentQuestions.questionId, zuvyQuestions.id),
      )
      .where(eq(aiAssessmentQuestions.questionSetId, row.questionSetId))
      .orderBy(asc(aiAssessmentQuestions.position));

    return {
      aiAssessmentId,
      questionSetId: row.questionSetId,
      studentStatus: row.studentStatus,
      questions,
    };
  }

  async generateAudioSummary(
    text: string,
    language: string,
    studentId: string,
    assessmentId: string,
  ) {
    try {
      const audioBuffer = await this.llmService.generateAudioSummary(
        text,
        language,
      );
      const { audioUrl } = await this.storageService.uploadAudioToS3(
        audioBuffer,
        studentId,
        assessmentId,
      );

      return { audioUrl };
    } catch (error) {
      this.logger.error(
        `Audio generation failed for student=${studentId}, assessment=${assessmentId}`,
        error.stack,
      );

      throw new InternalServerErrorException(
        'Failed to generate audio. Please try again later.',
      );
    }
  }

  async submitLlmAssessment(
    studentId: number,
    submitAssessmentDto: SubmitAssessmentDto,
  ) {
    try {
      return await db.transaction(async (tx) => {
        const { answers, aiAssessmentId } = submitAssessmentDto;

        const [assessmentRow] = await db
          .select({
            status: aiAssessment.status,
            startDatetime: aiAssessment.startDatetime,
          })
          .from(aiAssessment)
          .where(eq(aiAssessment.id, aiAssessmentId))
          .limit(1);

        if (
          !assessmentRow ||
          !this.isAssessmentAvailable(
            assessmentRow.status,
            assessmentRow.startDatetime,
          )
        ) {
          throw new BadRequestException('Assessment is not yet available');
        }

        const { score, totalQuestions, correctByQuestionId } =
          await this.countScore(submitAssessmentDto);
        const totalScore = (score / totalQuestions) * 100;

        // Prepare payloads
        const answerPayloads = answers.map((q) => ({
          studentId,
          questionId: q.id,
          answer: q.selectedAnswerByStudent?.id ?? null,
          answeredAt: new Date().toISOString(),
        }));

        await Promise.all(
          answerPayloads.map((payload) =>
            tx.insert(questionStudentAnswerRelation).values(payload),
          ),
        );

        const level = await this.calculateStudentLevel(totalScore);
        const bootcamp = await db
          .select({ bootcampId: aiAssessment.bootcampId })
          .from(aiAssessment)
          .where(eq(aiAssessment.id, aiAssessmentId))
          .limit(1);

        const bootcampId = bootcamp?.[0]?.bootcampId;

        const levelPayload = {
          studentId,
          levelId: level.id,
          aiAssessmentId,
          bootcampId,
          assignedAt: new Date().toISOString(),
        };

        await tx.insert(studentLevelRelation).values(levelPayload);

        //here evaluate the answers by the LLM.
        // const encodedQuestionWithAsnwers = encode(answers);
        // const evaluationPrompt = answerEvaluationPrompt(
        //   encodedQuestionWithAsnwers,
        // );

        await tx
          .update(studentAssessment)
          .set({
            status: 1, // completed
            updatedAt: new Date().toISOString(),
          } as any)
          .where(
            and(
              eq(studentAssessment.studentId, studentId),
              eq(studentAssessment.aiAssessmentId, aiAssessmentId),
            ),
          );

        const evaluationPrompt = answerEvaluationPrompt(answers);
        const llmResponse =
          await this.llmService.generateCompletion(evaluationPrompt);
        const responseText = llmResponse.text;
        const aiUsage = await this.saveTokenUsage(aiAssessmentId, llmResponse);

        let rawEvaluationText: string | null = null;
        if (!responseText) rawEvaluationText = null;
        else if (typeof responseText === 'string')
          rawEvaluationText = responseText;
        else if (typeof llmResponse === 'object') {
          rawEvaluationText =
            llmResponse.text ??
            llmResponse.content ??
            llmResponse.response ??
            llmResponse.output ??
            JSON.stringify(llmResponse);
        } else {
          rawEvaluationText = String(responseText);
        }

        // Parse & validate BEFORE returning to client
        let parsedEvaluation: any = null;
        let parseError: string | null = null;

        if (rawEvaluationText) {
          try {
            parsedEvaluation = parseLlmEvaluation(rawEvaluationText);
          } catch (err) {
            parseError = (err as Error).message;
          }
        } else {
          parseError = 'Empty LLM response.';
        }

        if (Array.isArray(parsedEvaluation?.evaluations)) {
          for (const item of parsedEvaluation.evaluations) {
            item.status = correctByQuestionId.get(String(item.id))
              ? 'correct'
              : 'incorrect';
          }
        }

        // Optionally: persist parsedEvaluation to DB here if successful
        // if (parsedEvaluation) { await db.insert(...).values({ ... }) }
        await this.questionEvaluationService.saveEvaluations(
          parsedEvaluation,
          studentId,
          aiAssessmentId,
        );

        return {
          totalQuestions,
          score: Math.round(score * 100) / 100,
          level: level.grade,
          performance: level.meaning,
          hardship: level.hardship,
          evaluation: parsedEvaluation ?? null,
          rawEvaluationText: parsedEvaluation ? null : rawEvaluationText,
          parseError,
        };
      });
    } catch (error) {
      this.logger.error(
        'Error submitting LLM assessment:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private isAssessmentAvailable(
    status: string,
    startDatetime: string | null,
  ): boolean {
    if (status === 'published') return true;
    if (status === 'scheduled') {
      if (!startDatetime) return false;
      return new Date(startDatetime) <= new Date();
    }
    return false;
  }

  private async calculateStudentLevel(score: number) {
    const allLevels = await db.select().from(levels);

    const level = resolveLevelBand(allLevels, score);
    if (level) return level;

    this.logger?.warn?.(
      'No level bands found; run POST /level/seed for this schema.',
    );
    return allLevels[allLevels.length - 1];
  }

  async findAll(userId: number, bootcampId?: number) {
    const query = db.select().from(aiAssessment);

    const results = bootcampId
      ? await query.where(eq(aiAssessment.bootcampId, bootcampId))
      : await query;

    if (bootcampId && results.length === 0) {
      return [];
    }

    return results;
  }

  async findAllAssessmentOfAStudent(
    userId: number,
    bootcampId: number | string,
    chapterId?: number | string,
    moduleId?: number | string,
  ) {
    if (!userId) return [];

    const parsedBootcampId = Number(bootcampId);
    if (Number.isNaN(parsedBootcampId)) return [];

    const conditions: any[] = [
      eq(studentAssessment.studentId, Number(userId)),
      eq(aiAssessment.bootcampId, parsedBootcampId),
      or(
        eq(aiAssessment.status, 'published'),
        and(
          eq(aiAssessment.status, 'scheduled'),
          sql`${aiAssessment.startDatetime} <= now()`,
        ),
      ),
    ];

    const parsedChapterId =
      chapterId !== undefined && chapterId !== null && chapterId !== ''
        ? Number(chapterId)
        : undefined;
    const parsedModuleId =
      moduleId !== undefined && moduleId !== null && moduleId !== ''
        ? Number(moduleId)
        : undefined;

    if (typeof parsedChapterId === 'number' && !Number.isNaN(parsedChapterId)) {
      conditions.push(eq(aiAssessment.chapterId, parsedChapterId));
    }
    if (typeof parsedModuleId === 'number' && !Number.isNaN(parsedModuleId)) {
      conditions.push(eq(aiAssessment.moduleId, parsedModuleId));
    }

    const assessments = await db
      .select({
        id: aiAssessment.id,
        bootcampId: aiAssessment.bootcampId,
        chapterId: aiAssessment.chapterId,
        chapterIds: aiAssessment.chapterIds,
        moduleId: aiAssessment.moduleId,
        title: aiAssessment.title,
        description: aiAssessment.description,
        totalNumberOfQuestions: aiAssessment.totalNumberOfQuestions,
        startDatetime: aiAssessment.startDatetime,
        endDatetime: aiAssessment.endDatetime,
        assessmentStatus: aiAssessment.status,
        studentStatus: studentAssessment.status,
        questionSetId: studentAssessment.questionSetId,
      })
      .from(studentAssessment)
      .innerJoin(
        aiAssessment,
        eq(studentAssessment.aiAssessmentId, aiAssessment.id),
      )
      .where(and(...conditions));

    return assessments.map(({ chapterIds, ...assessment }) => ({
      ...assessment,
      selectedChapterids: Array.from(
        new Set([
          assessment.chapterId,
          ...(Array.isArray(chapterIds) ? chapterIds : []),
        ]),
      ),
    }));
  }

  async getTopicsOfAssessments(assessmentIds: number[]) {
    try {
      if (!assessmentIds || assessmentIds.length === 0) {
        return [];
      }

      const topicsData = await db
        .select({
          id: aiAssessment.id,
          topics: aiAssessment.poolTopics,
        })
        .from(aiAssessment)
        .where(inArray(aiAssessment.id, assessmentIds));

      return topicsData;
    } catch (error) {
      this.logger.error('Error fetching topics of assessments:', error);
      throw new InternalServerErrorException(
        'Failed to fetch topics of assessments',
      );
    }
  }

  async getTotalQuestions(assessmentIds: number[]) {
    try {
      if (!assessmentIds || assessmentIds.length === 0) return 0;

      const [result] = await db
        .select({
          totalQuestions: sum(aiAssessment.totalNumberOfQuestions).as(
            'totalQuestions',
          ),
        })
        .from(aiAssessment)
        .where(inArray(aiAssessment.id, assessmentIds));

      return Number(result?.totalQuestions || 0);
    } catch (error) {
      this.logger.error('Error fetching total questions:', error);
      throw new InternalServerErrorException('Failed to fetch total questions');
    }
  }

  async getTotalBufferedQuestions(assessmentIds: number[]) {
    try {
      if (!assessmentIds || assessmentIds.length === 0) return 0;

      const [result] = await db
        .select({
          totalBufferedQuestions: sum(aiAssessment.totalQuestionsWithBuffer).as(
            'totalBufferedQuestions',
          ),
        })
        .from(aiAssessment)
        .where(inArray(aiAssessment.id, assessmentIds));

      return Number(result?.totalBufferedQuestions || 0);
    } catch (error) {
      this.logger.error('Error fetching total buffered questions:', error);
      throw new InternalServerErrorException(
        'Failed to fetch total buffered questions',
      );
    }
  }
}
