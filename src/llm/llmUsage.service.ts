import { Injectable, Logger } from '@nestjs/common';
import { db } from 'src/db';
import { InsertLLMUsage, llmUsage } from 'drizzle/schema';
import { desc, eq } from 'drizzle-orm';

@Injectable()
export class LLMUsageService {
  private readonly logger = new Logger(LLMUsageService.name);

  async save(data: InsertLLMUsage) {
    try {
      await db.insert(llmUsage).values(data);

      this.logger.log(
        `LLM usage saved | aiAssessmentId=${data.aiAssessmentId}, provider=${data.provider}, latency=${data.latencyMs}ms`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save LLM usage for aiAssessmentId=${data.aiAssessmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async getByAssessment(aiAssessmentId: number) {
    try {
      const rows = await db
        .select()
        .from(llmUsage)
        .where(eq(llmUsage.aiAssessmentId, aiAssessmentId));

      this.logger.log(
        `Fetched ${rows.length} LLM usage rows for aiAssessmentId=${aiAssessmentId}`,
      );

      return rows;
    } catch (error) {
      this.logger.error(
        `Failed to fetch LLM usage for aiAssessmentId=${aiAssessmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async getAll() {
    try {
      const rows = await db.select().from(llmUsage).orderBy(desc(llmUsage.id));

      this.logger.log(`Fetched total ${rows.length} LLM usage records`);

      return rows;
    } catch (error) {
      this.logger.error(
        'Failed to fetch all LLM usage records',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
