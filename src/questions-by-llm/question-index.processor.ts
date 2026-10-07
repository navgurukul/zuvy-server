import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { inArray } from 'drizzle-orm';
import { db } from 'src/db';
import { EmbeddingsService } from 'src/llm/embeddings.service';
import { questionIndexOutbox, zuvyQuestions } from 'drizzle/schema';
import { VectorService } from 'src/vector/vector.service';

interface IndexQuestionsJob {
  questionIds: number[];
}

@Processor('question-index')
export class QuestionIndexProcessor extends WorkerHost {
  private readonly logger = new Logger(QuestionIndexProcessor.name);

  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly vectorService: VectorService,
  ) {
    super();
  }

  override async process(job: Job<IndexQuestionsJob>): Promise<void> {
    if (job.name !== 'index-questions' || !job.data.questionIds?.length) return;

    try {
      const rows = await db
        .select({
          id: zuvyQuestions.id,
          question: zuvyQuestions.question,
          topicName: zuvyQuestions.topicName,
          topicDescription: zuvyQuestions.topicDescription,
          subtopics: zuvyQuestions.subtopics,
          difficulty: zuvyQuestions.difficulty,
          levelId: zuvyQuestions.levelId,
        })
        .from(zuvyQuestions)
        .where(inArray(zuvyQuestions.id, job.data.questionIds));

      await this.vectorService.ensureCollection(
        'QUESTIONS',
        this.embeddingsService.dimension,
      );
      const texts = rows.map((row) =>
        [
          row.question,
          row.topicName,
          row.topicDescription,
          ...(Array.isArray(row.subtopics) ? row.subtopics : []),
          row.difficulty,
        ]
          .filter(Boolean)
          .join(' '),
      );
      const vectors = await this.embeddingsService.embedMany(texts);
      await this.vectorService.upsert(
        'QUESTIONS',
        rows
          .map((row, index) => ({
            id: row.id,
            vector: vectors[index] ?? [],
            payload: {
              questionId: row.id,
              topic: row.topicName,
              difficulty: row.difficulty,
              levelId: row.levelId,
            },
          }))
          .filter((point) => point.vector.length > 0),
      );
      await db
        .update(questionIndexOutbox)
        .set({
          status: 'done',
          lastError: null,
          updatedAt: new Date().toISOString(),
        } as any)
        .where(inArray(questionIndexOutbox.questionId, job.data.questionIds));
    } catch (error) {
      this.logger.error(
        `Question indexing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await db
        .update(questionIndexOutbox)
        .set({
          status: 'failed',
          lastError: error instanceof Error ? error.message : String(error),
          updatedAt: new Date().toISOString(),
        } as any)
        .where(inArray(questionIndexOutbox.questionId, job.data.questionIds));
      throw error;
    }
  }
}
