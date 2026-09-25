import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class TopicService {
  private requireOrgId(orgId: number): number {
    if (!Number.isInteger(orgId) || orgId <= 0) {
      throw new BadRequestException('orgId is required');
    }
    return orgId;
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
