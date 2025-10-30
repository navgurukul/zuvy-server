import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAiAssessmentDto } from './dto/create-ai-assessment.dto';
import { UpdateAiAssessmentDto } from './dto/update-ai-assessment.dto';
import { db } from 'src/db';
import {
  questionStudentAnswerRelation,
  studentLevelRelation,
  levels,
  aiAssessment,
} from 'drizzle/schema';
import { SubmitAssessmentDto } from './dto/create-ai-assessment.dto';
import { LlmService } from 'src/llm/llm.service';
import { answerEvaluationPrompt } from './system_prompts/system_prompts';
import { parseLlmEvaluation } from 'src/llm/llm_response_parsers/evaluationParser';
import { QuestionEvaluationService } from 'src/questions-by-llm/question-evaluation.service';
import { eq } from 'drizzle-orm';

@Injectable()
export class AiAssessmentService {
  constructor(
    private readonly llmService: LlmService,
    private readonly questionEvaluationService: QuestionEvaluationService,
  ) {}
  async create(createAiAssessmentDto: CreateAiAssessmentDto) {
    try {
      const payload = {
        bootcampId: createAiAssessmentDto.bootcampId,
        title: createAiAssessmentDto.title,
        description: createAiAssessmentDto.description ?? null,
        difficulty: createAiAssessmentDto.difficulty ?? null,
        topics: createAiAssessmentDto.topics,
        audience: createAiAssessmentDto.audience ?? null,
        totalNumberOfQuestions: createAiAssessmentDto.totalNumberOfQuestions,
      };

      const [inserted] = await db
        .insert(aiAssessment)
        .values(payload)
        .returning();

      return {
        message: 'AI Assessment created successfully',
        data: inserted,
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to create AI assessment: ' + error.message,
      );
    }
  }

  async submitLlmAssessment(
    studentId: number,
    submitAssessmentDto: SubmitAssessmentDto,
  ) {
    try {
      const { answers } = submitAssessmentDto;

      const totalQuestions = answers.length;
      const correctAnswers = answers.filter(
        (q) => q.selectedAnswerByStudent === q.correctOption,
      ).length;
      const score = (correctAnswers / totalQuestions) * 100;

      // Prepare payloads
      const answerPayloads = answers.map((q) => ({
        studentId,
        questionId: q.id,
        answer: q.selectedAnswerByStudent,
        status: q.selectedAnswerByStudent === q.correctOption ? 1 : 0,
        answeredAt: new Date().toISOString(),
      }));

      await Promise.all(
        answerPayloads.map((payload) =>
          db.insert(questionStudentAnswerRelation).values(payload),
        ),
      );

      const level = await this.calculateStudentLevel(score);

      const levelPayload = {
        studentId,
        levelId: level.id,
        assignedAt: new Date().toISOString(),
      };

      await db.insert(studentLevelRelation).values(levelPayload);

      //here evaluate the answers by the LLM.
      const evaluationPrompt = answerEvaluationPrompt(answers);
      const llmResponse = await this.llmService.generate({
        systemPrompt: evaluationPrompt,
      });

      let rawEvaluationText: string | null = null;
      if (!llmResponse) rawEvaluationText = null;
      else if (typeof llmResponse === 'string') rawEvaluationText = llmResponse;
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
      );

      return {
        totalQuestions,
        correctAnswers,
        score: Math.round(score * 100) / 100,
        level: level.grade,
        performance: level.meaning,
        hardship: level.hardship,
        evaluation: parsedEvaluation ?? null,
        rawEvaluationText: parsedEvaluation ? null : rawEvaluationText,
        parseError,
      };
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

  async findAll(bootcampId?: number) {
    const query = db.select().from(aiAssessment);

    const results = bootcampId
      ? await query.where(eq(aiAssessment.bootcampId, bootcampId))
      : await query;

    if (bootcampId && results.length === 0) {
      throw new NotFoundException(
        `No assessments found for bootcampId ${bootcampId}`,
      );
    }

    return results;
  }

  findOne(id: number) {
    return `This action returns a #${id} aiAssessment`;
  }

  update(id: number, updateAiAssessmentDto: UpdateAiAssessmentDto) {
    return `This action updates a #${id} aiAssessment`;
  }

  remove(id: number) {
    return `This action removes a #${id} aiAssessment`;
  }
}
