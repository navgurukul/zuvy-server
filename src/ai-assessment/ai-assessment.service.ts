import { Injectable } from '@nestjs/common';
import { CreateAiAssessmentDto } from './dto/create-ai-assessment.dto';
import { UpdateAiAssessmentDto } from './dto/update-ai-assessment.dto';
import { db } from 'src/db';
import {
  questionStudentAnswerRelation,
  studentLevelRelation,
  levels,
} from 'drizzle/schema';
import { CreateSubmitAssessmentDto } from './dto/create-ai-assessment.dto';
@Injectable()
export class AiAssessmentService {
  create(createAiAssessmentDto: CreateAiAssessmentDto) {
    return 'This action adds a new aiAssessment';
  }

  async submitLlmAssessment(
    studentId: number,
    submitAssessmentDto: CreateSubmitAssessmentDto,
  ) {
    try {
      const { questions } = submitAssessmentDto; // Changed from 'answers' to 'questions'

      // 1. Calculate marks
      const totalQuestions = questions.length;
      const correctAnswers = questions.filter(
        (question) =>
          question.selectedAnswerByStudent === question.correctOption, // Changed from 'answer' to 'correctOption'
      ).length;
      const score = (correctAnswers / totalQuestions) * 100;

      // 2. Insert into question_student_answer_relation
      const answerPromises = questions.map(async (question) => {
        // Changed from 'answers' to 'questions'
        const status =
          question.selectedAnswerByStudent === question.correctOption ? 1 : 0; // Changed from 'answer' to 'correctOption'

        return this.db
          .insert(questionStudentAnswerRelation)
          .values({
            studentId,
            questionId: question.id,
            answer: question.selectedAnswerByStudent,
            status,
            answeredAt: new Date().toISOString(),
          })
          .onConflictDoUpdate({
            target: [
              questionStudentAnswerRelation.studentId,
              questionStudentAnswerRelation.questionId,
            ],
            set: {
              answer: question.selectedAnswerByStudent,
              status,
              answeredAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          });
      });

      await Promise.all(answerPromises);

      // 3. Calculate student level based on score
      const level = await this.calculateStudentLevel(score);

      // 4. Update student_level_relation
      await this.db
        .insert(studentLevelRelation)
        .values({
          studentId,
          levelId: level.id,
          assignedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [
            studentLevelRelation.studentId,
            studentLevelRelation.levelId,
          ],
          set: {
            assignedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });

      return {
        totalQuestions,
        correctAnswers,
        score: Math.round(score * 100) / 100,
        level: level.grade,
        performance: level.meaning,
        hardship: level.hardship,
      };
    } catch (error) {
      throw error;
    }
  }

  private async calculateStudentLevel(score: number) {
    const allLevels = await this.db.select().from(levels); // Renamed to avoid conflict

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

  findAll() {
    return `This action returns all aiAssessment`;
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
