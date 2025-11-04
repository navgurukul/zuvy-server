import { Injectable } from '@nestjs/common';
import { db } from 'src/db';
import { correctAnswers, questionEvaluation } from 'drizzle/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class QuestionEvaluationService {
  async saveEvaluations(
    evaluationResponse: any,
    studentId: number,
    aiAssessmentId: number,
  ) {
    try {
      const evaluations = evaluationResponse?.evaluations ?? [];

      if (!Array.isArray(evaluations) || evaluations.length === 0) {
        throw new Error('No evaluations found in response');
      }

      const payload = evaluations.map((item) => ({
        question: item.question,
        topic: item.topic,
        difficulty: item.difficulty,
        options: item.options,
        selectedAnswerByStudent: item.selectedAnswerByStudent.id,
        language: item.language,
        explanation: item.explanation,
        questionId: item.id,
        summary: evaluationResponse.summary,
        recommendations: evaluationResponse.recommendations,
        studentId,
        aiAssessmentId,
      }));

      await db.insert(questionEvaluation).values(payload);
      return { inserted: payload.length };
    } catch (error) {
      console.log('Error creating evaluation', error);
    }
  }

  // async findOneByStudentId(studentId: number, aiAssessmentId: number) {
  //   const result = await db
  //     .select()
  //     .from(questionEvaluation)
  //     .where(
  //       and(
  //         eq(questionEvaluation.studentId, studentId),
  //         eq(questionEvaluation.aiAssessmentId, aiAssessmentId),
  //       ),
  //     );

  //   return result;
  // }
  async findOneByStudentId(studentId: number, aiAssessmentId: number) {
    const result = await db
      .select({
        questionEvaluation: questionEvaluation,
        correctOptionId: correctAnswers.correctOptionId,
      })
      .from(questionEvaluation)
      .leftJoin(
        correctAnswers,
        eq(questionEvaluation.questionId, correctAnswers.questionId),
      )
      .where(
        and(
          eq(questionEvaluation.studentId, studentId),
          eq(questionEvaluation.aiAssessmentId, aiAssessmentId),
        ),
      );

    return result;
  }
}
