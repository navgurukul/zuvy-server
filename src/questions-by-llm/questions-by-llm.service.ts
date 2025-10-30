import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateQuestionsByLlmDto } from './dto/create-questions-by-llm.dto';
import { UpdateQuestionsByLlmDto } from './dto/update-questions-by-llm.dto';
import { db } from 'src/db';
import { questionsByLLM, questionLevelRelation } from 'drizzle/schema';

@Injectable()
export class QuestionsByLlmService {
  async create(createQuestionsByLlmDto: CreateQuestionsByLlmDto) {
    // const { questions, levelId } = createQuestionsByLlmDto;
    const { questions } = createQuestionsByLlmDto;

    const questionsPayload = questions.map((q) => ({
      topic: q.topic ?? null,
      difficulty: q.difficulty ?? null,
      question: q.question,
      options: q.options,
      answer: q.correctOption,
      language: q.language,
    }));

    try {
      const result = await db.transaction(async (tx) => {
        const insertedQuestions = await tx
          .insert(questionsByLLM)
          .values(questionsPayload)
          .returning({
            id: questionsByLLM.id,
            question: questionsByLLM.question,
            topic: questionsByLLM.topic,
            difficulty: questionsByLLM.difficulty,
            options: questionsByLLM.options,
            answer: questionsByLLM.answer,
            language: questionsByLLM.language,
          });

        // const relationsPayload = insertedQuestions.map((q) => ({
        //   questionId: q.id,
        //   levelId: Number(levelId),
        // }));

        // await tx.insert(questionLevelRelation).values(relationsPayload);

        // return { insertedQuestions, relationsCount: relationsPayload.length };
        return { insertedQuestions };
      });

      return {
        message: 'Questions and question-level relations created successfully',
        data: result,
      };
    } catch (error) {
      console.error('Failed to create questions + relations:', error);
      throw new InternalServerErrorException('Failed to create questions');
    }
  }

  async getAllLlmQuestions() {
    try {
      const questions = await db.select().from(questionsByLLM);
      return questions;
    } catch (error) {
      console.error('Error fetching LLM questions:', error);
      throw new InternalServerErrorException('Failed to fetch LLM questions');
    }
    // return `This action returns all questionsByLlm`;
  }

  findOne(id: number) {
    return `This action returns a #${id} questionsByLlm`;
  }

  update(id: number, updateQuestionsByLlmDto: UpdateQuestionsByLlmDto) {
    return `This action updates a #${id} questionsByLlm`;
  }

  remove(id: number) {
    return `This action removes a #${id} questionsByLlm`;
  }
}
