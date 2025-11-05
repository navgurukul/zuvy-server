import {
  BadRequestException,
  Injectable,
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
  zuvyBatchEnrollments,
  studentAssessment,
} from 'drizzle/schema';
import { SubmitAssessmentDto } from './dto/create-ai-assessment.dto';
import { LlmService } from 'src/llm/llm.service';
import {
  answerEvaluationPrompt,
  generateMcqPrompt,
} from './system_prompts/system_prompts';
import { parseLlmEvaluation } from 'src/llm/llm_response_parsers/evaluationParser';
import { QuestionEvaluationService } from 'src/questions-by-llm/question-evaluation.service';
import { eq, and, inArray, sum } from 'drizzle-orm';
import { parseLlmMcq } from 'src/llm/llm_response_parsers/mcqParser';
import { QuestionsByLlmService } from 'src/questions-by-llm/questions-by-llm.service';
// import { encode } from '@toon-format/toon';

@Injectable()
export class AiAssessmentService {
  constructor(
    private readonly llmService: LlmService,
    private readonly questionEvaluationService: QuestionEvaluationService,
    private readonly questionByLlmService: QuestionsByLlmService,
  ) {}
  async create(userId, createAiAssessmentDto: CreateAiAssessmentDto) {
    try {
      const { inserted, enrolledStudentsCount } = await db.transaction(
        async (tx) => {
          const payload = {
            bootcampId: createAiAssessmentDto.bootcampId,
            title: createAiAssessmentDto.title,
            description: createAiAssessmentDto.description ?? null,
            topics: createAiAssessmentDto.topics,
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
            .values(payload)
            .returning();

          const enrolledStudents = await tx
            .select({ studentId: zuvyBatchEnrollments.userId })
            .from(zuvyBatchEnrollments)
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

    for (const q of answers) {
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

      if (correct.length > 0) {
        score++;
      }
    }
    return { score, totalQuestions: answers.length };
  }

  async submitLlmAssessment(
    studentId: number,
    submitAssessmentDto: SubmitAssessmentDto,
  ) {
    try {
      return await db.transaction(async (tx) => {
        const { answers, aiAssessmentId } = submitAssessmentDto;

        // const totalQuestions = answers.length;
        const { score, totalQuestions } =
          await this.countScore(submitAssessmentDto);
        const totalScore = (score / totalQuestions) * 100;

        // Prepare payloads
        const answerPayloads = answers.map((q) => ({
          studentId,
          questionId: q.id,
          answer: q.selectedAnswerByStudent.id,
          answeredAt: new Date().toISOString(),
        }));

        await Promise.all(
          answerPayloads.map((payload) =>
            tx.insert(questionStudentAnswerRelation).values(payload),
          ),
        );

        const level = await this.calculateStudentLevel(totalScore);

        const levelPayload = {
          studentId,
          levelId: level.id,
          aiAssessmentId,
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
        const llmResponse = await this.llmService.generate({
          systemPrompt: evaluationPrompt,
        });

        let rawEvaluationText: string | null = null;
        if (!llmResponse) rawEvaluationText = null;
        else if (typeof llmResponse === 'string')
          rawEvaluationText = llmResponse;
        else if (typeof llmResponse === 'object') {
          rawEvaluationText =
            (llmResponse as any).text ??
            (llmResponse as any).content ??
            (llmResponse as any).response ??
            (llmResponse as any).output ??
            JSON.stringify(llmResponse);
        } else {
          rawEvaluationText = String(llmResponse);
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
      throw error;
    }
  }

  private async calculateStudentLevel(score: number) {
    const allLevels = await db.select().from(levels); // Renamed to avoid conflict

    const level = allLevels.find((level) => {
      const min = level.scoreMin ?? -Infinity;
      const max = level.scoreMax ?? Infinity;

      if (level.grade === 'A+') {
        return score >= min;
      } else if (level.grade === 'E') {
        return score <= max;
      } else {
        return score >= min && score <= max;
      }
    });

    if (!level) {
      // Default to E level if no match found
      return (
        allLevels.find((l) => l.grade === 'E') ||
        allLevels[allLevels.length - 1]
      );
    }

    return level;
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

  async findAllAssessmentOfAStudent(userId: number) {
    if (!userId) return [];

    const assessments = await db
      .select({
        id: aiAssessment.id,
        bootcampId: aiAssessment.bootcampId,
        title: aiAssessment.title,
        description: aiAssessment.description,
        topics: aiAssessment.topics,
        audience: aiAssessment.audience,
        totalNumberOfQuestions: aiAssessment.totalNumberOfQuestions,
        totalQuestionsWithBuffer: aiAssessment.totalQuestionsWithBuffer,
        startDatetime: aiAssessment.startDatetime,
        endDatetime: aiAssessment.endDatetime,
        createdAt: aiAssessment.createdAt,
        updatedAt: aiAssessment.updatedAt,
      })
      .from(studentAssessment)
      .innerJoin(
        aiAssessment,
        eq(studentAssessment.aiAssessmentId, aiAssessment.id),
      )
      .where(eq(studentAssessment.studentId, userId));

    if (assessments.length === 0) {
      const defaultAssessment = await db
        .select()
        .from(aiAssessment)
        .where(eq(aiAssessment.id, 1))
        .limit(1);
      return defaultAssessment;
    }

    return assessments;
  }

  async getTopicsOfAssessments(assessmentIds: number[]) {
    try {
      if (!assessmentIds || assessmentIds.length === 0) {
        return [];
      }

      const topicsData = await db
        .select({
          id: aiAssessment.id,
          topics: aiAssessment.topics,
        })
        .from(aiAssessment)
        .where(inArray(aiAssessment.id, assessmentIds));

      return topicsData;
    } catch (error) {
      console.error('Error fetching topics of assessments:', error);
      // throw new InternalServerErrorException('Failed to fetch topics');
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
      console.error('Error fetching total questions:', error);
      // throw new InternalServerErrorException('Failed to fetch total questions');
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
      console.error('Error fetching total buffered questions:', error);
      // throw new InternalServerErrorException('Failed to fetch total buffered questions');
    }
  }
}
