import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { db } from 'src/db';
import { topic, zuvyQuestions } from 'drizzle/schema';
import { CreateTopicDto } from './dto/create-topic.dto';
import { AddSubtopicDto } from './dto/add-subtopic.dto';
import { topicNamesMatch } from './topic-name.util';

@Injectable()
export class TopicService {
  private requireOrgId(orgId: number): number {
    if (!Number.isInteger(orgId) || orgId <= 0) {
      throw new BadRequestException('orgId is required');
    }
    return orgId;
  }

  async create(orgId: number, createTopicDto: CreateTopicDto) {
    const scopedOrgId = this.requireOrgId(orgId);
    const [created] = await db
      .insert(topic)
      .values({
        orgId: scopedOrgId,
        name: createTopicDto.name,
        description: createTopicDto.description ?? null,
        subtopic: createTopicDto.subtopic ?? null,
      })
      .returning();
    return this.withNormalizedSubtopics(created);
  }

  async findAll(orgId: number) {
    const scopedOrgId = this.requireOrgId(orgId);
    const topics = await db
      .select({
        id: topic.id,
        orgId: topic.orgId,
        name: topic.name,
        description: topic.description,
        subtopic: topic.subtopic,
        createdAt: topic.createdAt,
        updatedAt: topic.updatedAt,
      })
      .from(topic)
      .where(eq(topic.orgId, scopedOrgId));
    return topics.map((row) => this.withNormalizedSubtopics(row));
  }

  async findOne(orgId: number, id: number) {
    const scopedOrgId = this.requireOrgId(orgId);
    const [row] = await db
      .select({
        id: topic.id,
        orgId: topic.orgId,
        name: topic.name,
        description: topic.description,
        subtopic: topic.subtopic,
        createdAt: topic.createdAt,
        updatedAt: topic.updatedAt,
      })
      .from(topic)
      .where(and(eq(topic.id, id), eq(topic.orgId, scopedOrgId)))
      .limit(1);
    if (!row) throw new NotFoundException(`Topic with id=${id} not found`);
    return this.withNormalizedSubtopics(row);
  }

  async addSubtopic(orgId: number, id: number, addSubtopicDto: AddSubtopicDto) {
    const scopedOrgId = this.requireOrgId(orgId);
    const name = addSubtopicDto.subtopic.trim();
    if (!name) {
      throw new BadRequestException('Subtopic name cannot be empty');
    }

    const existingTopic = await this.findOne(scopedOrgId, id);
    const existingSubtopics = this.normalizeSubtopics(existingTopic.subtopic);
    const duplicate = existingSubtopics.some(
      (subtopicName) =>
        subtopicName.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (duplicate) {
      throw new BadRequestException(`Subtopic \"${name}\" already exists`);
    }

    const [updated] = await db
      .update(topic)
      .set({
        subtopic: [...existingSubtopics, name],
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(topic.id, id), eq(topic.orgId, scopedOrgId)))
      .returning();
    if (!updated) throw new NotFoundException(`Topic with id=${id} not found`);
    return this.withNormalizedSubtopics(updated);
  }

  async getAllTopicsWithDifficultyLevels(
    orgId: number,
    search?: string,
    id?: number,
    limit?: number,
    offset?: number,
  ) {
    const scopedOrgId = this.requireOrgId(orgId);
    const conditions: any[] = [eq(topic.orgId, scopedOrgId)];
    const hasSearch = !!(search && search.trim());
    const trimmed = hasSearch ? search!.trim() : '';
    const pattern = hasSearch ? `%${trimmed.toLowerCase()}%` : null;

    if (id != null && !Number.isNaN(Number(id))) {
      if (hasSearch) {
        conditions.push(
          sql`(LOWER(${topic.name}) LIKE ${pattern} OR ${topic.id} = ${id})`,
        );
      } else {
        conditions.push(eq(topic.id, id));
      }
    } else if (hasSearch) {
      conditions.push(sql`LOWER(${topic.name}) LIKE ${pattern}`);
    }

    const topicQuestions = await db
      .select({
        id: topic.id,
        name: topic.name,
        difficulty: zuvyQuestions.difficulty,
      })
      .from(topic)
      .leftJoin(
        zuvyQuestions,
        and(
          topicNamesMatch(topic.name, zuvyQuestions.topicName),
          eq(zuvyQuestions.orgId, scopedOrgId),
        ),
      )
      .where(and(...conditions));

    const topicsById = new Map<
      number,
      {
        id: number;
        name: string;
        difficultyLevel: { easy: number; medium: number; hard: number };
      }
    >();

    for (const { id, name, difficulty } of topicQuestions) {
      const topicWithDifficulty = topicsById.get(id) ?? {
        id,
        name,
        difficultyLevel: { easy: 0, medium: 0, hard: 0 },
      };
      const normalizedDifficulty = difficulty?.trim().toLowerCase();

      if (normalizedDifficulty === 'easy')
        topicWithDifficulty.difficultyLevel.easy += 1;
      if (normalizedDifficulty === 'medium')
        topicWithDifficulty.difficultyLevel.medium += 1;
      if (normalizedDifficulty === 'hard')
        topicWithDifficulty.difficultyLevel.hard += 1;

      topicsById.set(id, topicWithDifficulty);
    }

    let results = [...topicsById.values()];

    if (typeof offset === 'number' && offset > 0) {
      results = results.slice(offset);
    }
    if (typeof limit === 'number' && limit >= 0) {
      results = results.slice(0, limit);
    }

    return results;
  }

  private normalizeSubtopics(value: unknown): string[] {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value.reduce<string[]>((subtopics, subtopic) => {
        if (typeof subtopic === 'string' && subtopic.trim()) {
          subtopics.push(subtopic.trim());
        }
        return subtopics;
      }, []);
    }

    if (typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).reduce<string[]>(
        (subtopics, name) => {
          if (name.trim()) {
            subtopics.push(name.trim());
          }
          return subtopics;
        },
        [],
      );
    }

    return [];
  }

  private withNormalizedSubtopics<T extends { subtopic: unknown }>(row: T) {
    return { ...row, subtopic: this.normalizeSubtopics(row.subtopic) };
  }

  async resolveTagsFromChapterIds(
    orgId: number,
    body: { chapterIds: number[]; bootcampId?: number; moduleId: number },
    authorization?: string,
  ) {
    this.requireOrgId(orgId);
    const { chapterIds, bootcampId, moduleId } = body;
    if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
      throw new BadRequestException('chapterIds must be a non-empty array');
    }

    const ZUVY_BASE = process.env.ZUVY_LEGACY_BASE_URL;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authorization) headers['Authorization'] = authorization;

    const allChaptersRaw = await fetch(
      `${ZUVY_BASE}/Content/allChaptersOfModule/${moduleId}`,
      { headers },
    )
      .then(
        (res) =>
          res.json() as Promise<{
            chapterWithTopic?: Array<{ chapterId: number; topicId: number }>;
          }>,
      )
      .catch(() => ({ chapterWithTopic: [] }));

    const chapterTopicMap = new Map<number, number>();
    for (const entry of allChaptersRaw?.chapterWithTopic ?? []) {
      chapterTopicMap.set(entry.chapterId, entry.topicId);
    }

    const chapterDetailsResponses = await Promise.all(
      chapterIds.map((chapterId) => {
        const topicId = chapterTopicMap.get(chapterId);
        const params = new URLSearchParams();
        if (bootcampId != null) params.set('bootcampId', String(bootcampId));
        params.set('moduleId', String(moduleId));
        if (topicId != null) params.set('topicId', String(topicId));
        const qs = params.toString() ? '?' + params.toString() : '';
        return fetch(
          `${ZUVY_BASE}/Content/chapterDetailsById/${chapterId}${qs}`,
          { headers },
        )
          .then((res) => res.json() as Promise<Record<string, unknown>>)
          .catch(() => ({}) as Record<string, unknown>);
      }),
    );

    const tagIdSet = new Set<number>();
    for (const detail of chapterDetailsResponses) {
      if (detail?.statusCode && Number(detail.statusCode) >= 400) continue;
      const quizDetails = Array.isArray(detail?.quizQuestionDetails)
        ? (detail.quizQuestionDetails as { tagId?: number }[])
        : [];
      for (const q of quizDetails) {
        if (typeof q.tagId === 'number') tagIdSet.add(q.tagId);
      }
    }

    if (tagIdSet.size === 0) return [];

    const allTagsRaw = await fetch(`${ZUVY_BASE}/Content/allTags`, {
      headers,
    }).then(
      (res) =>
        res.json() as Promise<{
          allTags?: Array<{ id: number; tagName?: string }>;
        }>,
    );
    const allTags = Array.isArray(allTagsRaw?.allTags)
      ? allTagsRaw.allTags
      : [];

    return allTags
      .filter((t) => tagIdSet.has(t.id))
      .map((t) => ({ tagId: t.id, topicName: t.tagName }));
  }
}
