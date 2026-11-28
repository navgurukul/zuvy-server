/**
 * End-to-end check for browsing mentors by skill (ST1), against the DEV
 * database only (refuses any other DB_NAME).
 *
 *   npx ts-node -r tsconfig-paths/register --transpile-only scripts/e2e-mentor-skills.ts
 *
 * Runs the real services and database. Read-only, except the profile-save
 * cases, which change the test mentor's skills and put them back exactly
 * at the end. Needs migration 0051 and scripts/map-mentor-skills.ts --apply.
 */
export {};

process.env.RECORDING_WORKER_ENABLED = 'false';
process.env.ATTENDANCE_WORKER_ENABLED = 'false';
process.env.MENTOR_ATTENDANCE_JOB_ENABLED = 'false';
process.env.GMAIL_MONITOR_ENABLED = 'false';

/* eslint-disable @typescript-eslint/no-var-requires */
const { NestFactory } = require('@nestjs/core');
const { SchedulerRegistry } = require('@nestjs/schedule');
const { AppModule } = require('../src/app.module');
const {
  MentorPublicService,
} = require('../src/controller/mentor-slot/public/mentor-public.service');
const {
  MentorSlotService,
} = require('../src/controller/mentor-slot/mentor-slot.service');
const { db } = require('../src/db');
const schema = require('../drizzle/schema');
const { eq, sql } = require('drizzle-orm');

const MENTOR = Number(process.env.E2E_MENTOR_ID ?? 66142);
const ORG = Number(process.env.E2E_ORG_ID ?? 1);

let passed = 0;
let failed = 0;
const failures: string[] = [];
const report = (label: string, ok: boolean, detail?: string) => {
  ok ? passed++ : failed++;
  if (!ok) failures.push(label);
  console.log(
    `${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`,
  );
};
async function section(name: string, run: () => Promise<void>) {
  console.log(`\n--- ${name} ---`);
  try {
    await run();
  } catch (error: any) {
    report(`${name}: stopped by an unexpected error`, false, error.message);
  }
}

let list: any;
let lists: any;
let mentors: any;

/** Every mentor matching the filters, across all pages. */
async function allPages(
  opts: {
    expertise?: string;
    search?: string;
    available?: boolean;
    org?: number;
  },
  pageSize = 100,
) {
  const out: any[] = [];
  let first: any;
  for (let offset = 0; ; offset += pageSize) {
    const page = await list.getAllMentors(
      pageSize,
      offset,
      undefined,
      opts.expertise,
      undefined,
      opts.search,
      opts.org,
      opts.available,
    );
    first ??= page;
    out.push(...page.data);
    if (!page.hasMore) break;
  }
  return { rows: out, first };
}
const ids = (rows: any[]) => rows.map((m) => String(m.userId));
const hasSkill = (m: any, slug: string) =>
  (m.skills ?? []).some((s: any) => s.slug === slug);

async function main() {
  console.log(`DB: ${process.env.DB_NAME}`);
  if (process.env.DB_NAME !== 'dev') {
    console.log('Refusing: this script only runs against the dev database.');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  app
    .get(SchedulerRegistry)
    .getCronJobs()
    .forEach((cron: any) => cron.stop());
  list = app.get(MentorPublicService);
  mentors = app.get(MentorSlotService);
  lists = mentors.mentorSkills;

  // The test mentor's profile skills, to put back at the end.
  const [savedProfile] = await db
    .select({
      expertise: schema.zuvyMentorProfile.expertise,
      updatedAt: schema.zuvyMentorProfile.updatedAt,
    })
    .from(schema.zuvyMentorProfile)
    .where(eq(schema.zuvyMentorProfile.mentorUserId, BigInt(MENTOR)));
  const savedLinks = (
    await db
      .select({ skillId: schema.zuvyMentorSkills.skillId })
      .from(schema.zuvyMentorSkills)
      .where(eq(schema.zuvyMentorSkills.mentorUserId, BigInt(MENTOR)))
  ).map((r: any) => r.skillId);

  try {
    const everyone = (await allPages({})).rows;
    // The skills mentors in the list actually have, most common first.
    const counts = new Map<string, number>();
    everyone.forEach((m) =>
      (m.skills ?? []).forEach((s: any) =>
        counts.set(s.slug, (counts.get(s.slug) ?? 0) + 1),
      ),
    );
    const common = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([slug]) => slug);
    const [skillA, skillB] = [
      common[0],
      common.find(
        (s) => s !== common[0] && counts.get(s)! < counts.get(common[0])!,
      ) ?? common[1],
    ];
    console.log(
      `${everyone.length} mentors; testing with "${skillA}" (${counts.get(skillA)}) and "${skillB}" (${counts.get(skillB)})`,
    );

    await section('S1. The list', async () => {
      report(
        'one row per mentor (a mentor in two orgs appears once)',
        new Set(ids(everyone)).size === everyone.length,
        `${everyone.length} rows`,
      );
      const multiOrg = everyone.find((m) => (m.organizations ?? []).length > 1);
      report(
        'a mentor in two orgs lists both in `organizations`',
        !!multiOrg,
        multiOrg ? JSON.stringify(multiOrg.organizations) : 'none in the list',
      );
      const noSkills = everyone.filter((m) => !(m.skills ?? []).length);
      report(
        'mentors with no skills are listed, with skills: []',
        noSkills.length > 0 && noSkills.every((m) => Array.isArray(m.skills)),
        `${noSkills.length}`,
      );
      const sorted = everyone.every(
        (m, i) =>
          i === 0 ||
          Number(everyone[i - 1].availableSlots) >= Number(m.availableSlots),
      );
      report('mentors with open slots come first', sorted);
      const page = await list.getAllMentors(5, 0);
      report(
        'old fields still there',
        [
          'userId',
          'name',
          'email',
          'role',
          'organizationId',
          'orgName',
          'bio',
          'expertise',
          'title',
          'availableSlots',
          'fullSlots',
          'completedSlots',
          'availabilityStatus',
        ].every((k) => k in page.data[0]) &&
          'totalAvailable' in page &&
          'hasMore' in page,
      );
    });

    await section('S2. Filter by skill', async () => {
      const a = (await allPages({ expertise: skillA })).rows;
      report(
        `one skill: only mentors with "${skillA}"`,
        a.length > 0 && a.every((m) => hasSkill(m, skillA)),
        `${a.length}`,
      );
      const expectedA = everyone.filter((m) => hasSkill(m, skillA));
      report(
        'and every such mentor',
        a.length === expectedA.length,
        `${a.length} vs ${expectedA.length}`,
      );

      const ab = (await allPages({ expertise: `${skillA},${skillB}` })).rows;
      const expectedAB = everyone.filter(
        (m) => hasSkill(m, skillA) || hasSkill(m, skillB),
      );
      report(
        'two skills: mentors with either',
        ab.length === expectedAB.length &&
          ab.every((m) => hasSkill(m, skillA) || hasSkill(m, skillB)),
        `${ab.length} vs ${expectedAB.length}`,
      );

      // Any spelling the list knows gives the same result.
      const [react] = await db
        .select()
        .from(schema.zuvySkills)
        .where(eq(schema.zuvySkills.slug, skillA));
      const spellings = [
        react.slug,
        react.name,
        react.name.toUpperCase(),
        `${react.name}.js`.replace('.js.js', '.js'),
        ...(react.aliases ?? []),
      ];
      const results = await Promise.all(
        spellings.map(async (s) =>
          ids((await allPages({ expertise: s })).rows)
            .sort()
            .join(),
        ),
      );
      report(
        `"${spellings.join('", "')}" give the same result`,
        new Set(results).size === 1,
        `${new Set(results).size} different`,
      );

      const reactSlug = 'react';
      const r1 = ids((await allPages({ expertise: 'React' })).rows)
        .sort()
        .join();
      const r2 = ids((await allPages({ expertise: 'React.js' })).rows)
        .sort()
        .join();
      const r3 = ids((await allPages({ expertise: 'reactjs' })).rows)
        .sort()
        .join();
      report(
        '"React", "React.js" and "reactjs" give the same result',
        r1 === r2 && r2 === r3,
        reactSlug,
      );

      const unknown = await list.getAllMentors(
        10,
        0,
        undefined,
        'no-such-skill-xyz',
      );
      report(
        'an unknown skill: empty list, not an error',
        unknown.total === 0 &&
          unknown.data.length === 0 &&
          unknown.filter.unknownSkills[0] === 'no-such-skill-xyz',
      );
      const mixed = await list.getAllMentors(
        100,
        0,
        undefined,
        `${skillA},no-such-skill-xyz`,
      );
      report(
        'known + unknown: filters by the known one, reports the other',
        mixed.total === expectedA.length &&
          mixed.filter.unknownSkills.length === 1 &&
          mixed.filter.skills[0].slug === skillA,
      );
    });

    await section('S3. Paging follows the filter', async () => {
      const full = ids(
        (await allPages({ expertise: `${skillA},${skillB}` })).rows,
      );
      const paged = await allPages({ expertise: `${skillA},${skillB}` }, 2);
      report(
        'pages 1, 2, 3… of 2 add up to the full list, no repeats, same order',
        ids(paged.rows).join() === full.join() &&
          new Set(ids(paged.rows)).size === full.length,
        `${full.length} mentors`,
      );
      report(
        'total counts the filtered mentors',
        paged.first.total === full.length &&
          paged.first.hasMore === full.length > 2,
      );
    });

    await section('S4. Search with skills', async () => {
      const someone = everyone.find((m) => hasSkill(m, skillA) && m.name);
      const word = String(someone.name).split(' ')[0];
      const both = (await allPages({ expertise: skillA, search: word })).rows;
      const expected = everyone.filter(
        (m) =>
          (hasSkill(m, skillA) &&
            [m.name, m.email, m.title, JSON.stringify(m.expertise ?? '')].some(
              (t) =>
                String(t ?? '')
                  .toLowerCase()
                  .includes(word.toLowerCase()),
            )) ||
          (hasSkill(m, skillA) &&
            (m.skills ?? []).some((s: any) =>
              s.name.toLowerCase().includes(word.toLowerCase()),
            )),
      );
      report(
        `search "${word}" + "${skillA}": right result`,
        both.length > 0 &&
          ids(both).sort().join() === ids(expected).sort().join(),
        `${both.length} vs ${expected.length}`,
      );
      const bySkillName = (await allPages({ search: 'Kotlin' })).rows;
      report(
        'search finds a mentor by skill name',
        bySkillName.some((m) => hasSkill(m, 'kotlin')),
        `${bySkillName.length}`,
      );
      const percent = await list.getAllMentors(
        10,
        0,
        undefined,
        undefined,
        undefined,
        '%',
      );
      report(
        'a % in the search is taken literally',
        percent.total === 0,
        `${percent.total}`,
      );
    });

    await section('S5. Only mentors with open slots', async () => {
      const only = await allPages({ available: true });
      report(
        'available=true: every mentor has a bookable slot',
        only.rows.every((m) => m.availableSlots > 0),
        `${only.rows.length}`,
      );
      report(
        'and the count matches totalAvailable of the full list',
        only.rows.length === (await list.getAllMentors(1, 0)).totalAvailable,
      );
    });

    await section('S6. Skill chips', async () => {
      const chips = await list.getSkillChips();
      report(
        'every active skill is a chip, with a mentor count',
        chips.skills.length === (await lists.activeSkills()).length &&
          chips.skills.every(
            (c: any) => typeof c.mentorCount === 'number' && c.slug,
          ),
      );
      for (const slug of [skillA, skillB]) {
        const chip = chips.skills.find((c: any) => c.slug === slug);
        const t = (await list.getAllMentors(1, 0, undefined, slug)).total;
        report(
          `chip "${slug}" count = mentors the filter returns`,
          chip.mentorCount === t,
          `${chip.mentorCount} vs ${t}`,
        );
      }
      const word = String(everyone.find((m) => hasSkill(m, skillA)).name).split(
        ' ',
      )[0];
      const searched = await list.getSkillChips(word);
      const chip = searched.skills.find((c: any) => c.slug === skillA);
      const t = (
        await list.getAllMentors(1, 0, undefined, skillA, undefined, word)
      ).total;
      report(
        'chip counts follow the search',
        chip.mentorCount === t &&
          searched.totalMentors ===
            (
              await list.getAllMentors(
                1,
                0,
                undefined,
                undefined,
                undefined,
                word,
              )
            ).total,
        `${chip.mentorCount} vs ${t}`,
      );
    });

    await section('S7. Mentor profile skills', async () => {
      await mentors.updateMentorProfile(
        MENTOR,
        { skills: ['react', 'Node.js', 'System Design'] },
        ORG,
      );
      const [p] = await db
        .select({ expertise: schema.zuvyMentorProfile.expertise })
        .from(schema.zuvyMentorProfile)
        .where(eq(schema.zuvyMentorProfile.mentorUserId, BigInt(MENTOR)));
      const profile = await list.getMentorProfile(MENTOR, ORG);
      report(
        'saving skills: linked, and expertise set to their names',
        JSON.stringify(p.expertise) ===
          JSON.stringify(['React', 'Node.js', 'System Design']) &&
          profile.skills
            .map((s: any) => s.slug)
            .sort()
            .join() === 'node-js,react,system-design',
        JSON.stringify(profile.skills),
      );
      const found = (await allPages({ expertise: 'node-js' })).rows;
      report(
        'the mentor now comes up for that skill',
        ids(found).includes(String(MENTOR)),
      );

      let refused: any = null;
      try {
        await mentors.updateMentorProfile(
          MENTOR,
          { skills: ['react', 'Basket Weaving'] },
          ORG,
        );
      } catch (e: any) {
        refused = e;
      }
      report(
        "a skill that isn't on the list is refused, naming it",
        refused?.getStatus?.() === 400 &&
          /Basket Weaving/.test(refused.message),
        refused?.message,
      );
      const after = await list.getMentorProfile(MENTOR, ORG);
      report('and nothing changed', after.skills.length === 3);

      await mentors.createOrUpdateMentorProfile(
        MENTOR,
        { expertise: ['ReactJS', 'Something New'] },
        ORG,
      );
      const legacy = await list.getMentorProfile(MENTOR, ORG);
      report(
        'old free-text expertise: saved as sent, known values linked',
        JSON.stringify(legacy.expertise) ===
          JSON.stringify(['ReactJS', 'Something New']) &&
          legacy.skills.map((s: any) => s.slug).join() === 'react',
        JSON.stringify(legacy.skills),
      );
      const mine = await mentors.getMyMentorProfile(MENTOR, ORG);
      report(
        "the mentor's own profile shows the skills",
        mine.skills.map((s: any) => s.slug).join() === 'react',
      );
    });
  } finally {
    console.log('\n--- Clean-up ---');
    await db
      .update(schema.zuvyMentorProfile)
      .set({
        expertise: savedProfile.expertise,
        updatedAt: savedProfile.updatedAt,
      })
      .where(eq(schema.zuvyMentorProfile.mentorUserId, BigInt(MENTOR)));
    await lists.setMentorSkills(db, BigInt(MENTOR), savedLinks);
    const [p] = await db
      .select({ expertise: schema.zuvyMentorProfile.expertise })
      .from(schema.zuvyMentorProfile)
      .where(eq(schema.zuvyMentorProfile.mentorUserId, BigInt(MENTOR)));
    const links = (
      await db
        .select({ skillId: schema.zuvyMentorSkills.skillId })
        .from(schema.zuvyMentorSkills)
        .where(eq(schema.zuvyMentorSkills.mentorUserId, BigInt(MENTOR)))
    ).map((r: any) => r.skillId);
    report(
      "test mentor's skills put back",
      JSON.stringify(p.expertise) === JSON.stringify(savedProfile.expertise) &&
        links.sort().join() === [...savedLinks].sort().join(),
    );
    void sql;
    await app.close();
  }
  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failures.length) console.log(`Failed: ${failures.join(' ; ')}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E script crashed:', e);
  process.exit(1);
});
