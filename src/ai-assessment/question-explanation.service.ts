import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { db } from 'src/db';
import {
  aiAssessmentQuestions,
  studentAssessment,
  zuvyQuestionExplanations,
  zuvyQuestions,
} from 'drizzle/schema';
import { LlmService } from 'src/llm/llm.service';
import { parseQuestionExplanation } from 'src/llm/llm_response_parsers/explanationParser';
import { correctOptionExplanationPrompt } from './system_prompts/system_prompts';

type ExplanationFailure =
  | 'missing_option_text'
  | 'provider_backoff'
  | 'provider_failure'
  | 'failure_threshold'
  | 'unparseable'
  | 'option_mismatch'
  | 'empty_after_strip';

const PROVIDER_BACKOFF_MS = 60_000;
const MAX_CONTENT_FAILURES = 3;

@Injectable()
export class QuestionExplanationService {
  private readonly logger = new Logger(QuestionExplanationService.name);
  private providerBackoffUntil = 0;
  private readonly contentFailures = new Map<number, number>();

  constructor(private readonly llmService: LlmService) {}

  async getOrCreateQuestionExplanation(
    studentId: number,
    assessmentId: number,
    questionId: number,
  ) {
    if (studentId == null || Number.isNaN(Number(studentId)))
      throw new UnauthorizedException();
    const [assignment] = await db
      .select({ questionSetId: studentAssessment.questionSetId })
      .from(studentAssessment)
      .where(
        and(
          eq(studentAssessment.studentId, studentId),
          eq(studentAssessment.aiAssessmentId, assessmentId),
        ),
      )
      .limit(1);
    if (!assignment)
      throw new NotFoundException(
        'No assessment assignment found for this student',
      );
    if (!assignment.questionSetId)
      throw new BadRequestException(
        'No question set has been assigned for this assessment yet',
      );
    const [inSet] = await db
      .select({ questionId: aiAssessmentQuestions.questionId })
      .from(aiAssessmentQuestions)
      .where(
        and(
          eq(aiAssessmentQuestions.questionSetId, assignment.questionSetId),
          eq(aiAssessmentQuestions.questionId, questionId),
        ),
      )
      .limit(1);
    if (!inSet)
      throw new ForbiddenException(
        'This question is not part of your assessment attempt',
      );
    const [cached] = await db
      .select({ explanation: zuvyQuestionExplanations.explanation })
      .from(zuvyQuestionExplanations)
      .where(eq(zuvyQuestionExplanations.questionId, questionId))
      .limit(1);
    if (cached?.explanation)
      return { questionId, explanation: cached.explanation, cached: true };
    const [qRow] = await db
      .select({
        question: zuvyQuestions.question,
        options: zuvyQuestions.options,
        correctOption: zuvyQuestions.correctOption,
        language: zuvyQuestions.language,
      })
      .from(zuvyQuestions)
      .where(eq(zuvyQuestions.id, questionId))
      .limit(1);
    if (!qRow) throw new NotFoundException('Question not found');
    const options =
      qRow.options &&
      typeof qRow.options === 'object' &&
      !Array.isArray(qRow.options)
        ? (qRow.options as Record<string, string>)
        : {};
    const text = options[String(qRow.correctOption)];
    const heading = text
      ? `Correct option: ${qRow.correctOption} - ${text}`
      : `Correct option: ${qRow.correctOption}`;
    if (!text?.trim())
      return this.degraded(
        questionId,
        qRow.correctOption,
        text,
        'missing_option_text',
      );
    const backoffRemaining = this.providerBackoffUntil - Date.now();
    if (backoffRemaining > 0)
      return this.degraded(
        questionId,
        qRow.correctOption,
        text,
        'provider_backoff',
        `retryInMs=${backoffRemaining}`,
      );
    const priorFailures = this.contentFailures.get(questionId) ?? 0;
    if (priorFailures >= MAX_CONTENT_FAILURES)
      return this.degraded(
        questionId,
        qRow.correctOption,
        text,
        'failure_threshold',
        `failures=${priorFailures}`,
      );
    const response = await this.llmService.generateCompletion(
      correctOptionExplanationPrompt({
        question: qRow.question,
        options,
        correctOption: qRow.correctOption,
        correctOptionText: text,
        language: qRow.language ?? null,
      }),
    );
    const rawText = this.extractLlmText(response);
    if (!rawText?.trim()) {
      this.providerBackoffUntil = Date.now() + PROVIDER_BACKOFF_MS;
      return this.degraded(
        questionId,
        qRow.correctOption,
        text,
        'provider_failure',
        `backoffMs=${PROVIDER_BACKOFF_MS}`,
      );
    }
    const parsed = parseQuestionExplanation(rawText);
    if (!parsed)
      return this.degraded(
        questionId,
        qRow.correctOption,
        text,
        'unparseable',
        `failures=${this.recordContentFailure(questionId)}`,
      );
    if (parsed.statedCorrectOption !== qRow.correctOption)
      return this.degraded(
        questionId,
        qRow.correctOption,
        text,
        'option_mismatch',
        `stated=${parsed.statedCorrectOption} stored=${qRow.correctOption} failures=${this.recordContentFailure(questionId)}`,
      );
    const body = this.stripStatedOptionLines(parsed.explanation);
    if (!body)
      return this.degraded(
        questionId,
        qRow.correctOption,
        text,
        'empty_after_strip',
        `failures=${this.recordContentFailure(questionId)}`,
      );
    this.contentFailures.delete(questionId);
    const explanation = `${heading}\n\n${body}`;
    await db
      .insert(zuvyQuestionExplanations)
      .values({
        questionId,
        explanation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing({ target: zuvyQuestionExplanations.questionId });
    const [after] = await db
      .select({ explanation: zuvyQuestionExplanations.explanation })
      .from(zuvyQuestionExplanations)
      .where(eq(zuvyQuestionExplanations.questionId, questionId))
      .limit(1);
    if (!after?.explanation)
      throw new InternalServerErrorException(
        'Failed to persist explanation. Please try again.',
      );
    return { questionId, explanation: after.explanation, cached: false };
  }

  private logDegraded(
    questionId: number,
    reason: ExplanationFailure,
    detail?: string,
  ): void {
    const line =
      `[explanation-degraded] questionId=${questionId} reason=${reason}` +
      (detail ? ` ${detail}` : '');
    if (reason === 'provider_failure' || reason === 'provider_backoff') {
      this.logger.error(line);
    } else {
      this.logger.warn(line);
    }
  }

  private degraded(
    questionId: number,
    correctOption: number,
    correctOptionText: string | undefined,
    reason: ExplanationFailure,
    detail?: string,
  ): { questionId: number; explanation: string; cached: boolean } {
    this.logDegraded(questionId, reason, detail);
    return {
      questionId,
      explanation: this.fallbackExplanation(correctOption, correctOptionText),
      cached: false,
    };
  }

  private recordContentFailure(questionId: number): number {
    const next = (this.contentFailures.get(questionId) ?? 0) + 1;
    this.contentFailures.set(questionId, next);
    return next;
  }

  private fallbackExplanation(
    correctOption: number,
    correctOptionText?: string,
  ): string {
    const heading = correctOptionText
      ? `Correct option: ${correctOption} - ${correctOptionText}`
      : `Correct option: ${correctOption}`;
    return `${heading}\n\nA detailed explanation is not available for this question right now.`;
  }

  private stripStatedOptionLines(text: string): string {
    return text
      .split('\n')
      .filter(
        (line) => !/^\s*(correct(ed)?\s*option|correction)\s*:/i.test(line),
      )
      .join('\n')
      .trim();
  }

  private extractLlmText(llmResponse: any): string | null {
    if (!llmResponse) return null;
    if (typeof llmResponse === 'string') return llmResponse;
    return (
      llmResponse.text ??
      llmResponse.message?.content ??
      llmResponse.content ??
      llmResponse.response ??
      llmResponse.output ??
      null
    );
  }
}
