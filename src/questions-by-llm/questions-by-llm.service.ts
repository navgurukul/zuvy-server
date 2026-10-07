import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CreateCorrectAnswerDto,
  CreateMcqQuestionOptionDto,
  CreateQuestionsByLlmDto,
} from './dto/create-questions-by-llm.dto';
import { db } from 'src/db';
import {
  questionsByLLM,
  questionLevelRelation,
  mcqQuestionOptions,
  correctAnswers,
  studentAssessment,
  studentLevelRelation,
  aiAssessment,
  zuvyQuestions,
  questionIndexOutbox,
} from 'drizzle/schema';
import { and, asc, desc, inArray, ilike } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { randomizeAssessmentQuestions } from 'src/global-utils';
import { generateMcqPromptFromSpec } from 'src/ai-assessment/system_prompts/system_prompts';
import { parseLlmMcq } from 'src/llm/llm_response_parsers/mcqParser';
import { LlmService } from 'src/llm/llm.service';

const GENERATION_QUEUE = 'llm-generation';
const GENERATION_JOB = 'generate-topic-batch';
const BATCH_SIZE = 10;

export interface QuestionGenerationJob {
  orgId: number;
  topic: string;
  topicDescription: string;
  count: number;
  subtopics?: string[];
  learningObjectives?: string;
  targetAudience?: string;
  focusAreas?: string;
  bloomsLevel?: string;
  questionStyle?: string;
  difficultyDistribution?: { easy?: number; medium?: number; hard?: number };
  questionCounts?: { easy?: number; medium?: number; hard?: number };
  batchQuestionCounts?: { easy?: number; medium?: number; hard?: number };
  levelId?: string | null;
  requestedByUserId?: string;
}

@Injectable()
export class QuestionsByLlmService {
  private readonly logger = new Logger(QuestionsByLlmService.name);

  constructor(
    @InjectQueue(GENERATION_QUEUE) private readonly generationQueue: Queue,
    @InjectQueue('question-index') private readonly questionIndexQueue: Queue,
    private readonly llmService: LlmService,
  ) {}

  async processGenerationJob(job: QuestionGenerationJob) {
    const existing = await db
      .select({ question: zuvyQuestions.question })
      .from(zuvyQuestions)
      .where(
        and(
          eq(zuvyQuestions.orgId, job.orgId),
          ilike(zuvyQuestions.topicName, job.topic),
        ),
      )
      .limit(200);
    const prompt = generateMcqPromptFromSpec(
      job,
      existing.map((row) => row.question),
    );
    const response = await this.llmService.generate({ systemPrompt: prompt });
    const parsed = parseLlmMcq(response);
    if (parsed.evaluations.length !== job.count) {
      throw new Error(
        `Generation job expected ${job.count} questions but received ${parsed.evaluations.length}.`,
      );
    }

    return this.insertGeneratedQuestions(parsed.evaluations, job);
  }

  private async insertGeneratedQuestions(
    evaluations: any[],
    job: QuestionGenerationJob,
  ) {
    return db.transaction(async (tx) => {
      const inserted = await tx
        .insert(zuvyQuestions)
        .values(
          evaluations.map((question) => ({
            orgId: job.orgId,
            topicName: question.topic || job.topic,
            topicDescription: job.topicDescription || job.topic,
            subtopics: job.subtopics ?? null,
            learningObjectives: job.learningObjectives ?? null,
            targetAudience: job.targetAudience ?? null,
            focusAreas: job.focusAreas ?? null,
            bloomsLevel: job.bloomsLevel ?? null,
            questionStyle: job.questionStyle ?? null,
            question: question.question,
            difficulty: question.difficulty ?? null,
            language: question.language ?? null,
            options: question.options,
            correctOption: Number(question.correctOption),
            difficultyDistribution: job.difficultyDistribution ?? null,
            questionCounts: job.questionCounts ?? null,
            levelId: job.levelId ?? null,
          })),
        )
        .returning({ id: zuvyQuestions.id });

      if (inserted.length) {
        await tx.insert(questionIndexOutbox).values(
          inserted.map((question) => ({
            questionId: question.id,
            requestedByUserId: job.requestedByUserId ?? null,
            status: 'pending',
          })),
        );
      }
      if (inserted.length) {
        await this.questionIndexQueue.add(
          'index-questions',
          { questionIds: inserted.map((question) => question.id) },
          { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
        );
      }
      return inserted;
    });
  }

  async createMcqQuestionOption(dto: CreateMcqQuestionOptionDto) {
    return await db.insert(mcqQuestionOptions).values(dto).returning();
  }

  async createCorrectAnswer(dto: CreateCorrectAnswerDto) {
    return await db.insert(correctAnswers).values(dto).returning();
  }

  async create(
    createQuestionsByLlmDto: CreateQuestionsByLlmDto,
    aiAssessmentId,
  ) {
    const { questions, levelId } = createQuestionsByLlmDto;

    const questionsPayload = questions.map((q) => ({
      topic: q.topic ?? null,
      difficulty: q.difficulty ?? null,
      question: q.question,
      language: q.language,
    }));

    try {
      const result = await db.transaction(async (tx) => {
        let insertedQuestions;

        // 1️⃣ Insert questions
        try {
          insertedQuestions = await tx
            .insert(questionsByLLM)
            .values(questionsPayload)
            .returning({
              id: questionsByLLM.id,
              question: questionsByLLM.question,
              topic: questionsByLLM.topic,
              difficulty: questionsByLLM.difficulty,
              language: questionsByLLM.language,
            });
        } catch (err) {
          this.logger.error('Error inserting questionsByLLM:', err);
          throw new InternalServerErrorException('Failed to insert questions');
        }

        // 2️⃣ Insert question-level relations
        if (levelId) {
          try {
            const relationsPayload = insertedQuestions.map((q) => ({
              questionId: q.id,
              levelId: Number(levelId),
            }));
            await tx.insert(questionLevelRelation).values(relationsPayload);
          } catch (err) {
            this.logger.error('Error inserting questionLevelRelation:', err);
            throw new InternalServerErrorException(
              'Failed to insert question-level relations',
            );
          }
        }

        // 3️⃣ Insert options & 4️⃣ correct answers
        for (let i = 0; i < insertedQuestions.length; i++) {
          const insertedQ = insertedQuestions[i];
          const originalQ = questions[i];
          if (!originalQ?.options) continue;

          let insertedOptions;

          // Insert options
          try {
            const optionPayloads = Object.entries(originalQ.options).map(
              ([num, text]) => ({
                questionId: insertedQ.id,
                optionText: text,
                optionNumber: Number(num),
              }),
            );

            insertedOptions = await tx
              .insert(mcqQuestionOptions)
              .values(optionPayloads)
              .returning({
                id: mcqQuestionOptions.id,
                optionNumber: mcqQuestionOptions.optionNumber,
              });
          } catch (err) {
            this.logger.error(
              `Error inserting mcqQuestionOptions for questionId ${insertedQ.id}:`,
              err,
            );
            throw new InternalServerErrorException(
              `Failed to insert options for questionId ${insertedQ.id}`,
            );
          }

          // Insert correct answer
          try {
            const correctOptionNumber = Number(originalQ.correctOption);
            const matched = insertedOptions.find(
              (o) => Number(o.optionNumber) === correctOptionNumber,
            );

            if (matched) {
              await tx.insert(correctAnswers).values({
                questionId: insertedQ.id,
                correctOptionId: matched.id,
              });
            } else {
              this.logger.warn(
                `No matching option found for questionId ${insertedQ.id}`,
              );
            }
          } catch (err) {
            this.logger.error(
              `Error inserting correctAnswers for questionId ${insertedQ.id}:`,
              err,
            );
            throw new InternalServerErrorException(
              `Failed to insert correct answer for questionId ${insertedQ.id}`,
            );
          }
        }

        return { insertedQuestions };
      });

      return {
        message:
          'Questions, options and answers (and relations) created successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error('Transaction failed:', error);
      throw new InternalServerErrorException('Failed to create questions');
    }
  }

  async getAllLlmQuestions(aiAssessmentId: number, userId: number) {
    try {
      const assessmentStatus = await db
        .select()
        .from(studentAssessment)
        .where(
          and(
            eq(studentAssessment.studentId, userId),
            eq(studentAssessment.aiAssessmentId, aiAssessmentId),
          ),
        )
        .limit(1);

      const isCompleted =
        assessmentStatus.length > 0 && assessmentStatus[0].status === 1;

      const bootcamp = await db
        .select({ bootcampId: aiAssessment.bootcampId })
        .from(aiAssessment)
        .where(eq(aiAssessment.id, aiAssessmentId))
        .limit(1);

      const bootcampId = bootcamp?.[0]?.bootcampId;

      const studentLevel = await db
        .select({
          levelId: studentLevelRelation.levelId,
        })
        .from(studentLevelRelation)
        .innerJoin(
          aiAssessment,
          eq(studentLevelRelation.aiAssessmentId, aiAssessment.id),
        )
        .where(
          and(
            eq(studentLevelRelation.studentId, userId),
            eq(aiAssessment.bootcampId, bootcampId),
          ),
        )
        .orderBy(desc(studentLevelRelation.createdAt))
        .limit(1);

      const levelId = studentLevel?.[0]?.levelId;

      let questions;

      if (!levelId) {
        questions = await db.select().from(questionsByLLM);
      } else {
        questions = await db
          .select()
          .from(questionsByLLM)
          .innerJoin(
            questionLevelRelation,
            eq(questionsByLLM.id, questionLevelRelation.questionId),
          )
          .where(eq(questionLevelRelation.levelId, levelId))
          .then((rows) => rows.map((r) => r.questions_by_llm));
      }

      if (!questions || questions.length === 0) {
        return { isCompleted, questions: [] };
      }

      const populated = await Promise.all(
        questions.map(async (q) => {
          const options = await db
            .select()
            .from(mcqQuestionOptions)
            .where(eq(mcqQuestionOptions.questionId, q.id))
            .orderBy(asc(mcqQuestionOptions.optionNumber));

          const correctRow = await db
            .select()
            .from(correctAnswers)
            .where(eq(correctAnswers.questionId, q.id))
            .limit(1);

          let correctOption: CreateMcqQuestionOptionDto | null = null;
          if (correctRow && correctRow.length > 0) {
            const correctOptionRows = await db
              .select()
              .from(mcqQuestionOptions)
              .where(eq(mcqQuestionOptions.id, correctRow[0].correctOptionId))
              .limit(1);

            correctOption =
              correctOptionRows && correctOptionRows.length > 0
                ? correctOptionRows[0]
                : null;
          }

          return {
            ...q,
            options,
            correctOption,
          };
        }),
      );

      const randomizedAssessment = randomizeAssessmentQuestions(populated);

      return {
        isCompleted,
        questions: randomizedAssessment,
      };
    } catch (error) {
      this.logger.error('Error fetching LLM questions:', error);
      throw new InternalServerErrorException('Failed to fetch LLM questions');
    }
  }

  async getAllLlmQuestionsOfAllAssessments(aiAssessmentIds: number[]) {
    try {
      if (!aiAssessmentIds || aiAssessmentIds.length === 0) {
        return [];
      }

      // Fetch all questions that belong to any of the given aiAssessmentIds
      const questions = await db
        .select()
        .from(questionsByLLM)
        .where(inArray(questionsByLLM.aiAssessmentId, aiAssessmentIds));

      if (questions.length === 0) {
        return [];
      }

      // Populate options & correct options for each question
      const populated = await Promise.all(
        questions.map(async (q) => {
          // Fetch options for this question
          const options = await db
            .select()
            .from(mcqQuestionOptions)
            .where(eq(mcqQuestionOptions.questionId, q.id))
            .orderBy(asc(mcqQuestionOptions.optionNumber));

          // Fetch correct answer (if any)
          const correctRow = await db
            .select()
            .from(correctAnswers)
            .where(eq(correctAnswers.questionId, q.id))
            .limit(1);

          let correctOption = null;
          if (correctRow.length > 0) {
            const correctOptionRows = await db
              .select()
              .from(mcqQuestionOptions)
              .where(eq(mcqQuestionOptions.id, correctRow[0].correctOptionId))
              .limit(1);

            correctOption =
              correctOptionRows.length > 0 ? correctOptionRows[0] : null;
          }

          return {
            ...q,
            options,
            correctOption,
          };
        }),
      );

      return populated;
    } catch (error) {
      this.logger.error('Error fetching LLM questions:', error);
      throw new InternalServerErrorException('Failed to fetch LLM questions');
    }
  }
  // async getAllLlmQuestions(id) {
  //   try {
  //     const questions = await db.select().from(questionsByLLM);
  //     return questions;
  //   } catch (error) {
  //     this.logger.error('Error fetching LLM questions:', error);
  //     throw new InternalServerErrorException('Failed to fetch LLM questions');
  //   }
  //   // return `This action returns all questionsByLlm`;
  // }

  findOne(id: number) {
    return `This action returns a #${id} questionsByLlm`;
  }

  update(id: number) {
    return `This action updates a #${id} questionsByLlm`;
  }

  remove(id: number) {
    return `This action removes a #${id} questionsByLlm`;
  }
}
