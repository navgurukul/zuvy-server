import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from 'src/db';
import { questionIndexOutbox, topic, zuvyQuestions } from 'drizzle/schema';
import {
  normalizeTopicName,
  topicNameEquals,
} from 'src/eval-topic/topic-name.util';
import { CreateQuestionDto } from './dto/create-question.dto';
import {
  GenerateQuestionsDto,
  GenerateTopicBatchJobPayload,
} from './dto/generate-questions.dto';

const BATCH_SIZE = 10;
const JOB_NAME = 'generate-topic-batch';
type DifficultyCounts = { easy: number; medium: number; hard: number };

const JOB_OPTS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 10_000,
  },
};

@Injectable()
export class QuestionsService {
  constructor(@InjectQueue('llm-generation') private readonly queue: Queue) {}

  expandPayloadToJobs(
    payload: GenerateQuestionsDto,
    orgId: number,
  ): GenerateTopicBatchJobPayload[] {
    const jobs: GenerateTopicBatchJobPayload[] = [];
    const {
      topicConfigurations,
      levelId,
      learningObjectives,
      targetAudience,
      focusAreas,
      bloomsLevel,
      questionStyle,
      difficultyDistribution,
      questionCounts,
      subtopics,
    } = payload;

    if (
      !topicConfigurations ||
      !Array.isArray(topicConfigurations) ||
      topicConfigurations.length === 0
    ) {
      throw new BadRequestException(
        'topicConfigurations must be a non-empty array',
      );
    }

    const baseContext: Omit<GenerateTopicBatchJobPayload, 'topic' | 'count'> = {
      orgId,
      levelId: levelId ?? null,
      learningObjectives,
      targetAudience,
      focusAreas,
      bloomsLevel,
      questionStyle,
      difficultyDistribution,
      questionCounts,
      subtopics,
    };

    for (const cfg of topicConfigurations) {
      const topic = cfg.topicName;
      const count = cfg.totalQuestions;
      if (!topic || !Number.isInteger(count) || count <= 0) continue;

      const perTopicCtx: Omit<GenerateTopicBatchJobPayload, 'topic' | 'count'> =
        {
          ...baseContext,
          topicName: cfg.topicName,
          topicDescription: cfg.topicDescription,
          subtopics: cfg.subtopics ?? subtopics,
          difficultyDistribution:
            cfg.difficultyDistribution ?? difficultyDistribution,
          questionCounts: cfg.questionCounts ?? questionCounts,
        };

      const numBatches = Math.ceil(count / BATCH_SIZE);
      const batchSizes: number[] = [];
      for (let i = 0; i < numBatches; i++) {
        batchSizes.push(
          i < numBatches - 1
            ? BATCH_SIZE
            : count - (numBatches - 1) * BATCH_SIZE,
        );
      }
      const topicCounts = this.toDifficultyCounts(
        perTopicCtx.questionCounts ?? perTopicCtx.difficultyDistribution,
      );
      const perBatchCounts = topicCounts
        ? this.splitDifficultyCountsAcrossBatches(
            topicCounts,
            batchSizes,
            count,
          )
        : null;

      for (let i = 0; i < numBatches; i++) {
        jobs.push({
          topic,
          count: batchSizes[i],
          batchQuestionCounts: perBatchCounts?.[i],
          ...perTopicCtx,
        });
      }
    }

    if (jobs.length === 0) {
      throw new BadRequestException(
        'No valid topic counts (each topic must have a positive integer count)',
      );
    }

    return jobs;
  }

  private toDifficultyCounts(source?: {
    easy?: number;
    medium?: number;
    hard?: number;
  }): DifficultyCounts | null {
    if (!source) return null;
    const easy = source.easy ?? 0;
    const medium = source.medium ?? 0;
    const hard = source.hard ?? 0;
    const sum = easy + medium + hard;
    if (sum <= 0) return null;
    return { easy, medium, hard };
  }

  private splitDifficultyCountsAcrossBatches(
    totalCounts: DifficultyCounts,
    batchSizes: number[],
    totalQuestions: number,
  ): DifficultyCounts[] {
    const totalByDifficulty =
      totalCounts.easy + totalCounts.medium + totalCounts.hard;
    if (totalByDifficulty !== totalQuestions) {
      throw new BadRequestException(
        `questionCounts sum (${totalByDifficulty}) must equal totalQuestions (${totalQuestions}) per topic`,
      );
    }

    const levels: (keyof DifficultyCounts)[] = ['easy', 'medium', 'hard'];
    const remaining: DifficultyCounts = { ...totalCounts };
    const perBatch: DifficultyCounts[] = [];

    for (let batchIndex = 0; batchIndex < batchSizes.length; batchIndex++) {
      const batchSize = batchSizes[batchIndex];
      const isLastBatch = batchIndex === batchSizes.length - 1;

      if (isLastBatch) {
        perBatch.push({ ...remaining });
        continue;
      }

      const rawShares = levels.map((level) => ({
        level,
        raw: (remaining[level] * batchSize) / this.sumCounts(remaining),
      }));

      const allocated: DifficultyCounts = { easy: 0, medium: 0, hard: 0 };
      let assigned = 0;

      for (const share of rawShares) {
        const base = Math.min(Math.floor(share.raw), remaining[share.level]);
        allocated[share.level] = base;
        assigned += base;
      }

      const sortedRemainders = rawShares
        .map((share) => ({
          level: share.level,
          remainder: share.raw - Math.floor(share.raw),
        }))
        .sort((a, b) => b.remainder - a.remainder);

      let pointer = 0;
      while (assigned < batchSize) {
        const current = sortedRemainders[pointer % sortedRemainders.length];
        if (allocated[current.level] < remaining[current.level]) {
          allocated[current.level] += 1;
          assigned += 1;
        }
        pointer += 1;
      }

      levels.forEach((level) => {
        remaining[level] -= allocated[level];
      });

      perBatch.push(allocated);
    }

    return perBatch;
  }

  private sumCounts(counts: DifficultyCounts): number {
    return counts.easy + counts.medium + counts.hard;
  }

  async resolveCanonicalTopic(
    orgId: number | undefined,
    topicName: string,
  ): Promise<{ topicName: string; topicDescription: string | null }> {
    const trimmed = normalizeTopicName(topicName);
    if (!trimmed) {
      return { topicName: '', topicDescription: null };
    }

    const scopedOrgId = orgId;
    if (!scopedOrgId) {
      return { topicName: trimmed, topicDescription: null };
    }

    const [ownedTopic] = await db
      .select({ name: topic.name, description: topic.description })
      .from(topic)
      .where(
        and(eq(topic.orgId, scopedOrgId), topicNameEquals(topic.name, trimmed)),
      )
      .limit(1);
    if (ownedTopic?.name) {
      return {
        topicName: ownedTopic.name,
        topicDescription: ownedTopic.description ?? null,
      };
    }

    const [existingQuestion] = await db
      .select({
        topicName: zuvyQuestions.topicName,
        topicDescription: zuvyQuestions.topicDescription,
      })
      .from(zuvyQuestions)
      .where(
        and(
          eq(zuvyQuestions.orgId, scopedOrgId),
          topicNameEquals(zuvyQuestions.topicName, trimmed),
        ),
      )
      .orderBy(zuvyQuestions.createdAt)
      .limit(1);
    if (existingQuestion?.topicName) {
      return {
        topicName: existingQuestion.topicName,
        topicDescription: existingQuestion.topicDescription ?? null,
      };
    }

    return { topicName: trimmed, topicDescription: null };
  }

  async enqueueGeneration(
    payload: GenerateQuestionsDto,
    orgId: number,
    requestedByUserId?: string,
  ): Promise<{
    message: string;
    totalJobs: number;
    jobIds: string[];
  }> {
    const jobs = this.expandPayloadToJobs(payload, orgId);
    const jobIds: string[] = [];

    for (let i = 0; i < jobs.length; i++) {
      const resolved = await this.resolveCanonicalTopic(
        orgId,
        jobs[i].topicName ?? jobs[i].topic,
      );
      if (resolved.topicName) {
        jobs[i].topic = resolved.topicName;
        jobs[i].topicName = resolved.topicName;
      }
      if (!jobs[i].topicDescription?.trim() && resolved.topicDescription) {
        jobs[i].topicDescription = resolved.topicDescription;
      }

      const jobPayload = { ...jobs[i], requestedByUserId };
      const job = await this.queue.add(JOB_NAME, jobPayload, {
        jobId: `gen-${Date.now()}-${i}-${jobs[i].topic}-${jobs[i].count}`,
        ...JOB_OPTS,
      });
      jobIds.push(job.id ?? String(i));
    }

    return {
      message: 'Question generation jobs enqueued. You are not blocked.',
      totalJobs: jobs.length,
      jobIds,
    };
  }

  async createManyWithOutbox(
    rows: CreateQuestionDto[],
    requestedByUserId?: string,
  ) {
    if (!rows || rows.length === 0) return [];
    if (rows.some((r) => !r.orgId)) {
      throw new BadRequestException('orgId is required for each row');
    }

    return db.transaction(async (tx) => {
      const inserted = await tx
        .insert(zuvyQuestions)
        .values(
          rows.map((r) => ({
            orgId: r.orgId as number,
            domainName: null,
            topicName: normalizeTopicName(r.topicName),
            topicDescription: r.topicDescription,
            subtopics: r.subtopics ?? null,
            learningObjectives: r.learningObjectives ?? null,
            targetAudience: r.targetAudience ?? null,
            focusAreas: r.focusAreas ?? null,
            bloomsLevel: r.bloomsLevel ?? null,
            questionStyle: r.questionStyle ?? null,
            question: r.question,
            difficulty: r.difficulty ?? null,
            language: r.language ?? null,
            options: r.options,
            correctOption: r.correctOption,
            difficultyDistribution: r.difficultyDistribution ?? null,
            questionCounts: r.questionCounts ?? null,
            levelId: r.levelId ?? null,
          })),
        )
        .returning();

      if (inserted.length > 0) {
        await tx.insert(questionIndexOutbox).values(
          inserted.map((q) => ({
            questionId: q.id,
            requestedByUserId: requestedByUserId ?? null,
            status: 'pending',
          })),
        );
      }

      return inserted;
    });
  }

  async getQuestionTextsByTopic(
    topicName: string,
    orgId?: number,
    limit = 200,
  ): Promise<string[]> {
    const normalizedTopic = normalizeTopicName(topicName);
    if (!normalizedTopic) return [];

    const conditions = [
      topicNameEquals(zuvyQuestions.topicName, normalizedTopic),
    ];
    const scopedOrgId = orgId;
    if (scopedOrgId) {
      conditions.push(eq(zuvyQuestions.orgId, scopedOrgId));
    }

    const rows = await db
      .select({ question: zuvyQuestions.question })
      .from(zuvyQuestions)
      .where(and(...conditions))
      .limit(limit);
    return rows.map((r) => r.question).filter(Boolean);
  }

  async getQuestionTextsByIds(
    ids: number[],
    orgId?: number,
  ): Promise<string[]> {
    if (!ids.length) return [];

    const conditions = [inArray(zuvyQuestions.id, ids)];
    if (orgId) {
      conditions.push(eq(zuvyQuestions.orgId, orgId));
    }

    const rows = await db
      .select({ id: zuvyQuestions.id, question: zuvyQuestions.question })
      .from(zuvyQuestions)
      .where(and(...conditions));

    const byId = new Map(rows.map((row) => [row.id, row.question]));
    return ids
      .map((id) => byId.get(id))
      .filter(
        (question): question is string =>
          typeof question === 'string' && question.length > 0,
      );
  }

  async getRecentQuestionTextsByTopic(
    topicName: string,
    orgId?: number,
    limit = 60,
  ): Promise<string[]> {
    const rows = await this.getRecentQuestionsByTopic(topicName, orgId, limit);
    return rows.map((row) => row.question).filter(Boolean);
  }

  async getRecentQuestionsByTopic(
    topicName: string,
    orgId?: number,
    limit = 60,
  ): Promise<
    Array<{
      question: string;
      options: Record<string, string> | null;
      correctOption: number | null;
    }>
  > {
    const normalizedTopic = normalizeTopicName(topicName);
    if (!normalizedTopic) return [];

    const conditions = [
      topicNameEquals(zuvyQuestions.topicName, normalizedTopic),
    ];
    if (orgId) {
      conditions.push(eq(zuvyQuestions.orgId, orgId));
    }

    const rows = await db
      .select({
        question: zuvyQuestions.question,
        options: zuvyQuestions.options,
        correctOption: zuvyQuestions.correctOption,
      })
      .from(zuvyQuestions)
      .where(and(...conditions))
      .orderBy(desc(zuvyQuestions.id))
      .limit(limit);

    return rows
      .filter((row) => row.question)
      .map((row) => ({
        question: row.question,
        options: (row.options ?? null) as Record<string, string> | null,
        correctOption: (row.correctOption ?? null) as number | null,
      }));
  }
}
