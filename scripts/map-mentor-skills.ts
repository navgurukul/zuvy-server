/**
 * One-off: link every mentor's free-text skills (zuvy_mentor_profile.expertise)
 * to the fixed skill list (zuvy_skills), so the skill filter finds them.
 * Needs migration 0051_mentor_skills.sql.
 *
 * Dry run by default: prints what it would link and changes nothing.
 *
 *   npx ts-node -r tsconfig-paths/register --transpile-only scripts/map-mentor-skills.ts
 *   npx ts-node -r tsconfig-paths/register --transpile-only scripts/map-mentor-skills.ts --apply
 *
 * Values that match no skill (any spelling the list knows) are written to a
 * CSV (default ./unmapped-mentor-skills.csv, or --csv=path) for Ops to
 * review: add them to the list as a new skill or as an alias, then run this
 * again. It only adds links, never removes one, and is safe to run again.
 * The free-text expertise itself is not changed.
 */
export {};

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const { db } = require('../src/db');
const schema = require('../drizzle/schema');
const {
  MentorSkillsService,
} = require('../src/controller/mentor-slot/skills/mentor-skills.service');
const {
  splitSkillList,
} = require('../src/controller/mentor-slot/skills/skill-key');

const APPLY = process.argv.includes('--apply');
const CSV_PATH =
  process.argv.find((a: string) => a.startsWith('--csv='))?.slice(6) ||
  './unmapped-mentor-skills.csv';

const csvCell = (value: unknown) =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

async function main() {
  console.log(
    `DB: ${process.env.DB_NAME} — ${APPLY ? 'APPLY' : 'dry run (nothing is changed)'}`,
  );
  const skills = new MentorSkillsService();
  if (!(await skills.activeSkills()).length) {
    console.log(
      'The skill list is empty: run migration 0051_mentor_skills.sql first.',
    );
    process.exit(1);
  }

  const profiles = await db
    .select({
      mentorUserId: schema.zuvyMentorProfile.mentorUserId,
      email: schema.zuvyMentorProfile.email,
      expertise: schema.zuvyMentorProfile.expertise,
    })
    .from(schema.zuvyMentorProfile);

  const unmapped = new Map<string, { count: number; mentors: Set<string> }>();
  let linksToAdd = 0;
  let mentorsWithSkills = 0;
  const plan: Array<{ mentorUserId: bigint; skillIds: number[] }> = [];

  for (const profile of profiles) {
    let values: string[] = [];
    let raw: any = profile.expertise;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = raw.split(',');
      }
    }
    if (Array.isArray(raw)) values = splitSkillList(raw.map(String));

    const { skills: matched, unknown } = await skills.resolve(values);
    for (const value of unknown) {
      const entry = unmapped.get(value) ?? { count: 0, mentors: new Set() };
      entry.count += 1;
      entry.mentors.add(String(profile.email ?? profile.mentorUserId));
      unmapped.set(value, entry);
    }
    if (!matched.length) continue;
    mentorsWithSkills += 1;

    const existing = await skills.skillsForMentors([profile.mentorUserId]);
    const have = new Set(
      (existing.get(String(profile.mentorUserId)) ?? []).map((s: any) => s.id),
    );
    const missing = matched.filter((s: any) => !have.has(s.id));
    linksToAdd += missing.length;
    if (missing.length) {
      plan.push({
        mentorUserId: profile.mentorUserId,
        skillIds: missing.map((s: any) => s.id),
      });
      console.log(
        `${profile.email ?? profile.mentorUserId}: + ${missing.map((s: any) => s.name).join(', ')}` +
          (unknown.length ? `   (not on the list: ${unknown.join(', ')})` : ''),
      );
    }
  }

  console.log(
    `\n${profiles.length} mentor profiles, ${mentorsWithSkills} with at least one listed skill, ${linksToAdd} links to add, ${unmapped.size} values not on the list.`,
  );

  const rows = [...unmapped.entries()].sort((a, b) => b[1].count - a[1].count);
  fs.writeFileSync(
    CSV_PATH,
    ['value,mentors_using_it,mentors']
      .concat(
        rows.map(([value, e]) =>
          [csvCell(value), e.count, csvCell([...e.mentors].join('; '))].join(
            ',',
          ),
        ),
      )
      .join('\n') + '\n',
  );
  console.log(`Values not on the list: ${CSV_PATH}`);

  if (APPLY && plan.length) {
    await db.transaction(async (trx: any) => {
      for (const item of plan) {
        await skills.addMentorSkills(trx, item.mentorUserId, item.skillIds);
      }
    });
    console.log(`Added ${linksToAdd} links.`);
  } else if (!APPLY) {
    console.log('Dry run: nothing changed. Run with --apply to add the links.');
  }
  process.exit(0);
}

main().catch((error) => {
  console.error('map-mentor-skills failed:', error.message);
  process.exit(1);
});
