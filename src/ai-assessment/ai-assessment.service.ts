import { Injectable } from '@nestjs/common';
import { CreateAiAssessmentDto } from './dto/create-ai-assessment.dto';
import { UpdateAiAssessmentDto } from './dto/update-ai-assessment.dto';
import { db } from 'src/db';
import {
  questionStudentAnswerRelation,
  studentLevelRelation,
  levels,
} from 'drizzle/schema';
import { SubmitAssessmentDto } from './dto/create-ai-assessment.dto';
import { LlmService } from 'src/llm/llm.service';
import { answerEvaluationPrompt } from './system_prompts/system_prompts';
@Injectable()
export class AiAssessmentService {
  constructor(private readonly llmService: LlmService) {}
  create(createAiAssessmentDto: CreateAiAssessmentDto) {
    return 'This action adds a new aiAssessment';
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
      const aiEvaluationResponse = await this.llmService.generate({
        systemPrompt: evaluationPrompt,
      });

      return {
        totalQuestions,
        correctAnswers,
        score: Math.round(score * 100) / 100,
        level: level.grade,
        performance: level.meaning,
        hardship: level.hardship,
        aiEvaluationResponse,
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
