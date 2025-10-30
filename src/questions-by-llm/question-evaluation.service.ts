import { Injectable } from '@nestjs/common';
import { db } from 'src/db';
import { questionEvaluation } from 'drizzle/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class QuestionEvaluationService {
  async saveEvaluations(evaluationResponse: any, studentId: number) {
    const evaluations = evaluationResponse?.evaluations ?? [];

    if (!Array.isArray(evaluations) || evaluations.length === 0) {
      throw new Error('No evaluations found in response');
    }

    const payload = evaluations.map((item) => ({
      question: item.question,
      topic: item.topic,
      difficulty: item.difficulty,
      options: item.options,
      correctOption: item.correctOption,
      selectedAnswerByStudent: item.selectedAnswerByStudent,
      language: item.language,
      status: item.status,
      explanation: item.explanation,
      summary: evaluationResponse.summary,
      recommendations: evaluationResponse.recommendations,
      studentId,
    }));

    await db.insert(questionEvaluation).values(payload);
    return { inserted: payload.length };
  }

  async findOneByStudentId(studentId: number) {
    const result = await db
      .select()
      .from(questionEvaluation)
      .where(eq(questionEvaluation.studentId, studentId));

    return result;
  }
}
