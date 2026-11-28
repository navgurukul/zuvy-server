import * as fs from 'fs';
import * as path from 'path';
import { skillKey, skillSlug, splitSkillList } from './skill-key';
import { buildSkillKeyIndex } from './mentor-skills.service';

describe('skillKey: spellings that mean the same skill', () => {
  it('"React", "React.js", "ReactJS" and "react" are one skill', () => {
    const keys = ['React', 'React.js', 'ReactJS', 'react', ' react '].map(
      skillKey,
    );
    expect(new Set(keys)).toEqual(new Set(['react']));
  });

  it('a slug matches its name ("node-js" is "Node.js")', () => {
    expect(skillKey('node-js')).toBe(skillKey('Node.js'));
    expect(skillKey('NodeJS')).toBe(skillKey('Node.js'));
    expect(skillKey('ci-cd')).toBe(skillKey('CI/CD'));
  });

  it('keeps different skills apart', () => {
    expect(skillKey('React Native')).not.toBe(skillKey('React'));
    expect(skillKey('Java')).not.toBe(skillKey('JavaScript'));
    expect(skillKey('C++')).not.toBe(skillKey('C'));
    expect(skillKey('C#')).not.toBe(skillKey('C++'));
    expect(skillKey('CSS Architecture')).not.toBe(skillKey('CSS'));
  });

  it('"JS" on its own stays "js"', () => {
    expect(skillKey('JS')).toBe('js');
    expect(skillKey('js')).toBe('js');
  });

  it('slugs are URL-friendly', () => {
    expect(skillSlug('Node.js')).toBe('node-js');
    expect(skillSlug('Data Structures & Algorithms')).toBe(
      'data-structures-and-algorithms',
    );
    expect(skillSlug('UI/UX Design')).toBe('ui-ux-design');
  });

  it('splits a comma list, trimming blanks', () => {
    expect(splitSkillList('react, node-js,,React ')).toEqual([
      'react',
      'node-js',
      'React',
    ]);
    expect(splitSkillList(undefined)).toEqual([]);
    expect(splitSkillList(['a', ' ', 'b'])).toEqual(['a', 'b']);
  });
});

describe('buildSkillKeyIndex', () => {
  const rows = [
    { id: 1, name: 'React', slug: 'react', aliases: ['React.js'] },
    { id: 2, name: 'Node.js', slug: 'node-js', aliases: ['Node'] },
    {
      id: 3,
      name: 'ReactJS Duplicate',
      slug: 'reactjs-dup',
      aliases: ['React'],
    },
  ];

  it('maps every spelling to its skill', () => {
    const { byKey } = buildSkillKeyIndex(rows);
    expect(byKey.get(skillKey('react.js'))?.id).toBe(1);
    expect(byKey.get(skillKey('node-js'))?.id).toBe(2);
    expect(byKey.get(skillKey('node'))?.id).toBe(2);
  });

  it('a clash keeps the older skill and is reported', () => {
    const { byKey, conflicts } = buildSkillKeyIndex(rows);
    expect(byKey.get('react')?.id).toBe(1);
    expect(conflicts).toHaveLength(1);
  });

  it('tolerates aliases that are not a list', () => {
    const { byKey } = buildSkillKeyIndex([
      { id: 9, name: 'Git', slug: 'git', aliases: null },
    ]);
    expect(byKey.get('git')?.id).toBe(9);
  });
});

describe('the starting list in migration 0051', () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      '../../../../drizzle/migrations/0051_mentor_skills.sql',
    ),
    'utf8',
  );
  const rows = [
    ...sql.matchAll(/\('([^']+)', '([^']+)', '(\[[^\]]*\])'\)/g),
  ].map((m, i) => ({
    id: i + 1,
    name: m[1],
    slug: m[2],
    aliases: JSON.parse(m[3]),
  }));

  it('has the skills', () => {
    expect(rows.length).toBeGreaterThan(50);
  });

  it('no two skills share a spelling', () => {
    expect(buildSkillKeyIndex(rows).conflicts).toEqual([]);
  });

  it('every slug is the slug of its name', () => {
    const wrong = rows.filter((r) => r.slug !== skillSlug(r.name));
    expect(wrong).toEqual([]);
  });

  it('covers the old free-text values (React.js, NodeJS, nextjs, typescript)', () => {
    const { byKey } = buildSkillKeyIndex(rows);
    for (const value of [
      'React.js',
      'NodeJS',
      'nextjs',
      'typescript',
      'K8s',
      'CoreData',
    ]) {
      expect(byKey.get(skillKey(value))).toBeDefined();
    }
  });
});
