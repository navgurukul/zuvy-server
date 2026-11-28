import { Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, notInArray } from 'drizzle-orm';
import { db } from '../../../db';
import { zuvyMentorSkills, zuvySkills } from '../../../../drizzle/schema';
import { skillKey } from './skill-key';

/** A skill as the API returns it. */
export interface SkillRef {
  id: number;
  name: string;
  slug: string;
}

interface SkillIndex {
  skills: SkillRef[];
  byKey: Map<string, SkillRef>;
  loadedAt: number;
}

const CACHE_MS = 60_000;

/**
 * The fixed skill list (zuvy_skills) and which mentors have which skill
 * (zuvy_mentor_skills). Matching a typed or stored skill to the list goes
 * through skillKey, so "React", "React.js" and "react" are one skill; a
 * skill's name, slug and aliases all match it.
 */
@Injectable()
export class MentorSkillsService {
  private readonly logger = new Logger(MentorSkillsService.name);
  private index: SkillIndex | null = null;
  private loading: Promise<SkillIndex> | null = null;
  private reported = new Set<string>();

  /** Active skills, by name. Cached for 60 s (Ops edits reach every server within a minute). */
  async activeSkills(): Promise<SkillRef[]> {
    return (await this.getIndex()).skills;
  }

  /** Forget the cached list; the next call reads the table. */
  invalidate() {
    this.index = null;
  }

  /**
   * The skills these values name (any spelling the list knows), without
   * duplicates, and the values that match no active skill.
   */
  async resolve(
    values: string[],
  ): Promise<{ skills: SkillRef[]; unknown: string[] }> {
    const { byKey } = await this.getIndex();
    const found = new Map<number, SkillRef>();
    const unknown: string[] = [];
    for (const value of values) {
      const skill = byKey.get(skillKey(value));
      if (skill) found.set(skill.id, skill);
      else if (String(value).trim()) unknown.push(String(value).trim());
    }
    return { skills: [...found.values()], unknown };
  }

  /** Each mentor's skills (active ones), keyed by the mentor's user id as a string. */
  async skillsForMentors(
    mentorUserIds: Array<bigint | number | string>,
    executor: any = db,
  ): Promise<Map<string, SkillRef[]>> {
    const result = new Map<string, SkillRef[]>();
    if (!mentorUserIds.length) return result;
    const rows = await executor
      .select({
        mentorUserId: zuvyMentorSkills.mentorUserId,
        id: zuvySkills.id,
        name: zuvySkills.name,
        slug: zuvySkills.slug,
      })
      .from(zuvyMentorSkills)
      .innerJoin(zuvySkills, eq(zuvySkills.id, zuvyMentorSkills.skillId))
      .where(
        and(
          inArray(
            zuvyMentorSkills.mentorUserId,
            mentorUserIds.map((id) => BigInt(id)),
          ),
          eq(zuvySkills.isActive, true),
        ),
      )
      .orderBy(asc(zuvySkills.name));
    for (const row of rows) {
      const key = String(row.mentorUserId);
      if (!result.has(key)) result.set(key, []);
      result.get(key)!.push({ id: row.id, name: row.name, slug: row.slug });
    }
    return result;
  }

  /** Makes the mentor's skills exactly these (adds the missing, removes the rest). */
  async setMentorSkills(
    executor: any,
    mentorUserId: bigint,
    skillIds: number[],
  ) {
    const ids = [...new Set(skillIds)];
    await executor
      .delete(zuvyMentorSkills)
      .where(
        ids.length
          ? and(
              eq(zuvyMentorSkills.mentorUserId, mentorUserId),
              notInArray(zuvyMentorSkills.skillId, ids),
            )
          : eq(zuvyMentorSkills.mentorUserId, mentorUserId),
      );
    await this.addMentorSkills(executor, mentorUserId, ids);
  }

  /** Adds these skills to the mentor, keeping the ones they have. */
  async addMentorSkills(
    executor: any,
    mentorUserId: bigint,
    skillIds: number[],
  ) {
    const ids = [...new Set(skillIds)];
    if (!ids.length) return;
    await executor
      .insert(zuvyMentorSkills)
      .values(ids.map((skillId) => ({ mentorUserId, skillId })))
      .onConflictDoNothing();
  }

  private async getIndex(): Promise<SkillIndex> {
    if (this.index && Date.now() - this.index.loadedAt < CACHE_MS) {
      return this.index;
    }
    if (!this.loading) {
      this.loading = this.load().finally(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  private async load(): Promise<SkillIndex> {
    const rows = await db
      .select({
        id: zuvySkills.id,
        name: zuvySkills.name,
        slug: zuvySkills.slug,
        aliases: zuvySkills.aliases,
      })
      .from(zuvySkills)
      .where(eq(zuvySkills.isActive, true))
      .orderBy(asc(zuvySkills.id));
    const { byKey, conflicts } = buildSkillKeyIndex(rows);
    for (const conflict of conflicts) this.reportOnce(conflict);
    const skills = rows
      .map((row) => ({ id: row.id, name: row.name, slug: row.slug }))
      .sort((a, b) => a.name.localeCompare(b.name));
    this.index = { skills, byKey, loadedAt: Date.now() };
    return this.index;
  }

  private reportOnce(message: string) {
    if (this.reported.has(message)) return;
    this.reported.add(message);
    this.logger.warn(`Skill list: ${message}`);
  }
}

/**
 * Every spelling key (name, slug, aliases) -> its skill. When two skills
 * share a key, the older one (lower id) keeps it and the clash is reported.
 */
export function buildSkillKeyIndex(
  rows: Array<{ id: number; name: string; slug: string; aliases: unknown }>,
): { byKey: Map<string, SkillRef>; conflicts: string[] } {
  const byKey = new Map<string, SkillRef>();
  const conflicts: string[] = [];
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    const skill = { id: row.id, name: row.name, slug: row.slug };
    const aliases = Array.isArray(row.aliases) ? row.aliases : [];
    for (const spelling of [row.name, row.slug, ...aliases]) {
      const key = skillKey(String(spelling));
      if (!key) continue;
      const owner = byKey.get(key);
      if (!owner) byKey.set(key, skill);
      else if (owner.id !== skill.id) {
        conflicts.push(
          `"${spelling}" of "${row.name}" means the same as "${owner.name}"; it matches "${owner.name}".`,
        );
      }
    }
  }
  return { byKey, conflicts };
}
