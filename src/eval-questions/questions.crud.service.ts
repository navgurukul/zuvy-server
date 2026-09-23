import { BadRequestException, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from 'src/db';
import { topicNameEquals } from 'src/eval-topic/topic-name.util';
import { zuvyQuestions } from 'drizzle/schema';

@Injectable()
export class QuestionsCrudService {
  async findAll(params: {
    orgId: number;
    page?: number | string;
    limit?: number | string;
    difficulty?: string;
    topicName?: string;
  }): Promise<{
    data: unknown[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const pageRaw = params?.page ?? 1;
    const limitRaw = params?.limit ?? 20;

    const page =
      typeof pageRaw === 'string' ? Number.parseInt(pageRaw, 10) : pageRaw;
    const limit =
      typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : limitRaw;

    if (!Number.isFinite(page) || page < 1) {
      throw new BadRequestException('page must be a positive integer');
    }
    if (!Number.isFinite(limit) || limit < 1) {
      throw new BadRequestException('limit must be a positive integer');
    }

    const safeLimit = Math.min(100, Math.floor(limit));
    const safePage = Math.floor(page);
    const offset = (safePage - 1) * safeLimit;

    const orgId = params?.orgId;
    if (!orgId) {
      throw new BadRequestException('orgId is required');
    }

    const difficulty = params?.difficulty?.trim();
    const topicName = params?.topicName?.trim();

    const conditions = [
      eq(zuvyQuestions.orgId, orgId),
      difficulty ? eq(zuvyQuestions.difficulty, difficulty) : undefined,
      topicName
        ? topicNameEquals(zuvyQuestions.topicName, topicName)
        : undefined,
    ].filter(Boolean);

    const whereClause = and(...(conditions as any));

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(zuvyQuestions)
      .where(whereClause as any);

    const total = Number(count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    const data = await db
      .select()
      .from(zuvyQuestions)
      .where(whereClause as any)
      .orderBy(desc(zuvyQuestions.createdAt))
      .limit(safeLimit)
      .offset(offset);

    return {
      data,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
    };
  }
}
