import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
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

@Injectable()
export class QuestionExplanationService {
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
      return {
        questionId,
        explanation: `${heading}\n\nA detailed explanation is not available for this question right now.`,
        cached: false,
      };
    const response = await this.llmService.generateCompletion(
      correctOptionExplanationPrompt({
        question: qRow.question,
        options,
        correctOption: qRow.correctOption,
        correctOptionText: text,
        language: qRow.language ?? null,
      }),
    );
    const parsed = parseQuestionExplanation(response?.text ?? null);
    if (!parsed || parsed.statedCorrectOption !== qRow.correctOption)
      return {
        questionId,
        explanation: `${heading}\n\nA detailed explanation is not available for this question right now.`,
        cached: false,
      };
    const explanation = `${heading}\n\n${parsed.explanation.replace(/^\s*(correct(ed)?\s*option|correction)\s*:.*$/gim, '').trim()}`;
    if (!explanation.trim())
      throw new InternalServerErrorException(
        'Failed to persist explanation. Please try again.',
      );
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
}
