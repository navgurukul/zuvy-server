// Parent-level RBAC permissions for Course, Question Bank and Roles &
// Permissions. Queries are built by the real drizzle query builder and sent to
// a fake pg client, so these tests check the SQL that would run without
// needing a database.
jest.mock('src/db', () => {
  const { drizzle } = require('drizzle-orm/node-postgres');
  const schema = require('drizzle/schema');
  const mockClient = {
    queries: [] as Array<{ text: string; params: unknown[] }>,
    // (text, params) => rows; rows are arrays for selects (rowMode: 'array').
    respond: (_text: string, _params: unknown[]) => [] as unknown[],
    query: async (config: any, params?: unknown[]) => {
      const text = typeof config === 'string' ? config : config.text;
      const values = params ?? config.values ?? [];
      mockClient.queries.push({ text, params: values });
      const rows = mockClient.respond(text, values);
      return { rows, rowCount: rows.length };
    },
  };
  return { db: drizzle(mockClient, { schema }), mockClient };
});
jest.mock('src/auth/auth.service', () => ({ AuthService: class {} }));
jest.mock('src/user-tokens/user-tokens.service', () => ({
  UserTokensService: class {},
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildResourceHierarchy,
  RbacResourcesService,
} from './rbac.resources.service';
import { RbacPermissionService } from './rbac.permission.service';
import { PermissionsService } from 'src/permissions/permissions.service';

const { mockClient } = jest.requireMock('src/db');

// IDs as a fresh migration would leave them: children keep their IDs, each
// parent gets a zuvy_parent_resources row (parentResourceId) and one new
// zuvy_resources row (id, is_parent) that its permissions belong to.
const PARENTS = [
  {
    parentResourceId: 1,
    id: 71,
    key: 'CourseParent',
    title: 'Course Studio',
    perms: { view: 94, edit: 95, create: 96, delete: 97 },
    child: {
      id: 11,
      key: 'Module',
      name: 'module',
      perms: { create: 5, view: 6, edit: 7, delete: 8 },
    },
  },
  {
    parentResourceId: 2,
    id: 72,
    key: 'QuestionBankParent',
    title: 'Question Bank',
    perms: { view: 98, edit: 99, create: 100, delete: 101 },
    child: {
      id: 51,
      key: 'Mcq',
      name: 'mcqs',
      perms: { create: 57, view: 58, edit: 59, delete: 60 },
    },
  },
  {
    parentResourceId: 3,
    id: 73,
    key: 'RolesAndPermissionParent',
    title: 'Roles & Permissions',
    perms: { view: 102, edit: 103, create: 104, delete: 105 },
    child: {
      id: 13,
      key: 'RolesAndPermission',
      name: 'Roles/Permissions',
      perms: { create: 13, view: 14, edit: 15, delete: 16 },
    },
  },
];
type Parent = (typeof PARENTS)[number];
// Resources outside every group.
const STANDALONE = [
  { id: 10, key: 'Course', name: 'course' },
  { id: 57, key: 'Organization', name: 'organization' },
];

const resource = (
  id: number,
  key: string,
  name: string,
  parentResourceId: number | null,
  isParent = false,
  parentId: number | null = null,
) => ({
  id,
  key,
  name,
  description: null,
  parentResourceId,
  parentId,
  isParent,
  createdAt: null,
  updatedAt: null,
});
// zuvy_resources columns in table order, as returned with rowMode 'array'.
const resourceRow = (r: ReturnType<typeof resource>) => [
  r.id,
  r.key,
  r.name,
  r.description,
  r.parentResourceId,
  r.parentId,
  r.isParent,
  r.createdAt,
  r.updatedAt,
];
// A parent's own permission row.
const parentRow = (p: Parent) =>
  resource(p.id, p.key, p.title, p.parentResourceId, true);
const parentRows = PARENTS.map((p) => ({
  id: p.parentResourceId,
  name: p.title,
  createdAt: null,
  updatedAt: null,
}));
const permRows = (resourceId: number, perms: Record<string, number>) =>
  Object.entries(perms).map(([name, id]) => ({
    id,
    name,
    description: null,
    resourceId,
  }));

const queriesMatching = (pattern: RegExp) =>
  mockClient.queries.filter((q) => pattern.test(q.text));

beforeEach(() => {
  mockClient.queries = [];
  mockClient.respond = () => [];
});

describe('GET /rbac/resources hierarchy', () => {
  const resources = [
    ...PARENTS.flatMap((p) => [
      parentRow(p),
      resource(p.child.id, p.child.key, p.child.name, p.parentResourceId),
    ]),
    ...STANDALONE.map((r) => resource(r.id, r.key, r.name, null)),
  ];
  const permissions = PARENTS.flatMap((p) => [
    ...permRows(p.id, p.perms),
    ...permRows(p.child.id, p.child.perms),
  ]);
  const data = buildResourceHierarchy(parentRows, resources, permissions);
  const groups = data.filter((r) => r.isParent) as any[];
  const groupOf = (p: Parent) =>
    groups.find((g) => g.id === p.parentResourceId);

  it('returns exactly the three parents, in order, each with parentId null', () => {
    expect(groups.map((g) => [g.id, g.name, g.parentId])).toEqual(
      PARENTS.map((p) => [p.parentResourceId, p.title, null]),
    );
    expect(data.slice(0, 3)).toEqual(groups);
  });

  it.each(PARENTS)(
    "nests $title's children with parentId = the parent id",
    (p: Parent) => {
      expect(groupOf(p).children).toEqual([
        expect.objectContaining({
          id: p.child.id,
          key: p.child.key,
          name: p.child.name,
          title: p.child.name,
          isParent: false,
          parentId: p.parentResourceId,
          resourceId: p.child.id,
        }),
      ]);
    },
  );

  it('puts no child under more than one parent and leaves none out', () => {
    const nested = groups.flatMap((g) => g.children.map((c) => c.id));
    expect(new Set(nested).size).toBe(nested.length);
    const placed = [
      ...nested,
      ...data.filter((r) => !r.isParent).map((r) => r.id),
    ];
    expect(placed.sort()).toEqual(
      resources
        .filter((r) => !r.isParent)
        .map((r) => r.id)
        .sort(),
    );
  });

  it("does not list a parent's own permission row as a child", () => {
    const listed = [
      ...groups.flatMap((g) => g.children.map((c) => c.id)),
      ...data.filter((r) => !r.isParent).map((r) => r.id),
    ];
    PARENTS.forEach((p) => expect(listed).not.toContain(p.id));
  });

  it('returns resources with no parent after the groups, with parentId null', () => {
    expect(data.slice(3).map((r) => [r.id, r.parentId, r.isParent])).toEqual(
      STANDALONE.map((r) => [r.id, null, false]),
    );
  });

  it.each(PARENTS)(
    "gives $title its permission row id and that row's permissions",
    (p: Parent) => {
      expect(groupOf(p).resourceId).toBe(p.id);
      expect(groupOf(p).permissions.map((x) => x.id)).toEqual(
        Object.values(p.perms),
      );
      expect(groupOf(p).children[0].permissions.map((x) => x.id)).toEqual(
        Object.values(p.child.perms),
      );
    },
  );

  it('still returns a parent whose permission row or children are missing', () => {
    const [course] = buildResourceHierarchy(parentRows, [], []) as any[];
    expect(course).toMatchObject({
      name: 'Course Studio',
      resourceId: null,
      permissions: [],
      children: [],
    });
  });

  it('getAllResources runs three queries and keeps the existing envelope', async () => {
    mockClient.respond = (text) => {
      if (/from "main"\."zuvy_parent_resources"/.test(text))
        return parentRows.map((r) => [r.id, r.name, r.createdAt, r.updatedAt]);
      if (/from "main"\."zuvy_resources"/.test(text))
        return resources.map(resourceRow);
      return [];
    };
    const result = await new RbacResourcesService().getAllResources();
    expect(result).toMatchObject({ status: 'success', code: 200 });
    expect(
      result.data.filter((r) => r.isParent).map((r: any) => r.children.length),
    ).toEqual([1, 1, 1]);
    expect(mockClient.queries).toHaveLength(3);
  });
});

describe('migration 0047', () => {
  const read = (name: string) =>
    readFileSync(join(__dirname, '../../drizzle/migrations', name), 'utf8');
  const up = read('0047_add_parent_resources.sql');
  const down = read('0047_add_parent_resources.down.sql');
  const mapping = up.slice(up.indexOf('mapping jsonb'));
  const childrenOf = (parentKey: string) =>
    [...mapping.matchAll(new RegExp(`"(\\w+)":\\s+"${parentKey}"`, 'g'))]
      .map((m) => m[1])
      .sort();

  it('runs as one transaction', () => {
    expect(up).toMatch(/^BEGIN;$/m);
    expect(up.trim().endsWith('COMMIT;')).toBe(true);
  });

  it('creates zuvy_parent_resources with only id, unique name and timestamps', () => {
    const start = up.indexOf(
      'CREATE TABLE IF NOT EXISTS "zuvy_parent_resources"',
    );
    const table = up.slice(start, up.indexOf(');', start));
    const columns = [...table.matchAll(/^\s+"(\w+)" /gm)].map((m) => m[1]);
    expect(columns).toEqual(['id', 'name', 'created_at', 'updated_at']);
    expect(table).toContain('UNIQUE ("name")');
  });

  it('links resources to parents with one foreign key, from zuvy_resources', () => {
    expect(up).toContain(
      'ADD COLUMN IF NOT EXISTS "parent_resource_id" integer',
    );
    expect(up).toMatch(
      /FOREIGN KEY \("parent_resource_id"\) REFERENCES "zuvy_parent_resources"\("id"\)/,
    );
    expect(up.match(/FOREIGN KEY/g)).toHaveLength(1);
  });

  it('allows one permission row per parent', () => {
    expect(up).toContain(
      'ADD COLUMN IF NOT EXISTS "is_parent" boolean DEFAULT false NOT NULL',
    );
    expect(up).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "zuvy_resources_parent_row_unique"\s+ON "zuvy_resources" \("parent_resource_id"\) WHERE "is_parent"/,
    );
  });

  it('seeds the three parents under one name each, without duplicates', () => {
    expect(up).toContain(
      "VALUES ('Course Studio'), ('Question Bank'), ('Roles & Permissions')",
    );
    PARENTS.forEach((p) => expect(up).toContain(`('${p.title}', '${p.key}')`));
    expect(up).toContain('ON CONFLICT ("name") DO NOTHING');
    expect(up).toContain('ON CONFLICT ("key") DO UPDATE');
    // A parent created as "Course" by an earlier version is renamed.
    expect(up).toMatch(
      /SET "name" = 'Course Studio'[\s\S]*WHERE "name" = 'Course'/,
    );
  });

  it('gives parents view, edit, create and delete, and no manager', () => {
    ['view', 'edit', 'create', 'delete'].forEach((name) =>
      expect(up).toContain(`('${name}', `),
    );
    expect(up).not.toContain("('manager', ");
  });

  it('maps exactly the listed children, by key', () => {
    expect(childrenOf('CourseParent')).toEqual([
      'Batch',
      'Bootcamp',
      'Chapter',
      'Module',
      'Setting',
      'Student',
      'Submission',
    ]);
    expect(childrenOf('QuestionBankParent')).toEqual([
      'CodingQuestion',
      'Mcq',
      'OpendEnded',
      'Topic',
    ]);
    expect(childrenOf('RolesAndPermissionParent')).toEqual([
      'RolesAndPermission',
      'User',
    ]);
  });

  it('corrects existing links: listed children get their parent, the rest none', () => {
    // One update sets every non-parent row to its mapped parent, or to NULL.
    expect(mapping).toMatch(
      /LEFT JOIN jsonb_each_text\(mapping\)[\s\S]*WHERE NOT r\.is_parent/,
    );
    expect(mapping).toContain(
      'child.parent_resource_id IS DISTINCT FROM target.parent_id',
    );
    expect(mapping).toContain('RAISE WARNING');
  });

  it('needs no temporary table, so it also works run statement by statement', () => {
    expect(up).not.toMatch(/TEMP TABLE/i);
  });

  it('has a rollback that removes the column, the table and the parent rows', () => {
    expect(down).toContain('DROP COLUMN IF EXISTS "parent_resource_id"');
    expect(down).toContain('DROP COLUMN IF EXISTS "is_parent"');
    expect(down).toContain('DROP TABLE IF EXISTS "zuvy_parent_resources"');
    expect(down).toMatch(/SELECT id FROM "zuvy_resources" WHERE is_parent/);
  });
});

describe('GET /rbac/resources Course Studio tree', () => {
  // Course Studio as it is in the database after migration 0048.
  const GROUP = 1;
  const CURRICULUM = 90;
  const rows = [
    resource(71, 'CourseParent', 'Course Studio', GROUP, true),
    resource(64, 'Bootcamp', 'bootcamp', GROUP),
    resource(CURRICULUM, 'Curriculum', 'Curriculum', GROUP),
    resource(11, 'Module', 'module', GROUP, false, CURRICULUM),
    resource(31, 'Chapter', 'chapter', GROUP, false, 11),
    resource(18, 'Student', 'student', GROUP),
    resource(12, 'Batch', 'batch', GROUP),
    resource(17, 'Submission', 'submission', GROUP),
    resource(30, 'Setting', 'setting', GROUP),
    resource(10, 'Course', 'course', null),
  ];
  const perms = [
    ...permRows(CURRICULUM, { create: 133, view: 134, edit: 135, delete: 136 }),
    ...permRows(31, { create: 53, view: 54, edit: 55, delete: 56 }),
  ];
  const [courseStudio, , , standalone] = buildResourceHierarchy(
    parentRows,
    rows,
    perms,
  ) as any[];
  const outline = (node: any): any => [
    node.key ?? node.name,
    node.parentId,
    node.children.map(outline),
  ];

  it('nests Curriculum > Module > Chapter and keeps the rest directly under Course Studio', () => {
    expect(outline(courseStudio)).toEqual([
      'Course Studio',
      null,
      [
        ['Bootcamp', GROUP, []],
        ['Curriculum', GROUP, [['Module', CURRICULUM, [['Chapter', 11, []]]]]],
        ['Student', GROUP, []],
        ['Batch', GROUP, []],
        ['Submission', GROUP, []],
        ['Setting', GROUP, []],
      ],
    ]);
  });

  it('keeps every nested resource in the Course Studio group, with its own permissions', () => {
    const chapter = courseStudio.children[1].children[0].children[0];
    expect(chapter).toMatchObject({
      id: 31,
      resourceId: 31,
      parentId: 11,
      parentResourceId: GROUP,
      isParent: false,
      children: [],
    });
    expect(chapter.permissions.map((p) => p.id)).toEqual([53, 54, 55, 56]);
    expect(courseStudio.children[1].permissions.map((p) => p.id)).toEqual([
      133, 134, 135, 136,
    ]);
  });

  it('lists every resource exactly once', () => {
    const ids: number[] = [];
    const walk = (node: any) => {
      ids.push(node.id);
      node.children.forEach(walk);
    };
    walk(courseStudio);
    walk(standalone);
    expect(ids.slice(1).sort()).toEqual(
      rows
        .filter((r) => !r.isParent)
        .map((r) => r.id)
        .sort(),
    );
    expect(standalone).toMatchObject({
      key: 'Course',
      parentId: null,
      children: [],
    });
  });

  it('still lists resources caught in a parent_id cycle, once each', () => {
    const looped = [
      resource(1, 'A', 'a', null, false, 2),
      resource(2, 'B', 'b', null, false, 1),
    ];
    const data = buildResourceHierarchy([], looped, []) as any[];
    const ids: number[] = [];
    const walk = (node: any) => {
      ids.push(node.id);
      node.children.forEach(walk);
    };
    data.forEach(walk);
    expect(ids.sort()).toEqual([1, 2]);
  });
});

describe('migration 0048', () => {
  const read = (name: string) =>
    readFileSync(join(__dirname, '../../drizzle/migrations', name), 'utf8');
  const up = read('0048_nest_course_studio_resources.sql');
  const down = read('0048_nest_course_studio_resources.down.sql');
  const nesting = up.slice(up.indexOf('nesting jsonb'));

  it('runs as one transaction without temporary tables', () => {
    expect(up).toMatch(/^BEGIN;$/m);
    expect(up.trim().endsWith('COMMIT;')).toBe(true);
    expect(up).not.toMatch(/TEMP TABLE/i);
  });

  it('adds parent_id as a self-reference that cannot point at itself', () => {
    expect(up).toContain('ADD COLUMN IF NOT EXISTS "parent_id" integer');
    expect(up).toMatch(
      /FOREIGN KEY \("parent_id"\) REFERENCES "zuvy_resources"\("id"\) ON DELETE SET NULL/,
    );
    expect(up).toContain('CHECK ("parent_id" <> "id")');
  });

  it('adds Curriculum once, in Course Studio, with view/edit/create/delete', () => {
    expect(up).toMatch(
      /INSERT INTO "zuvy_resources"[\s\S]*'Curriculum', 'Curriculum'[\s\S]*ON CONFLICT \("key"\) DO NOTHING/,
    );
    ['create', 'view', 'edit', 'delete'].forEach((name) =>
      expect(up).toContain(`('${name}', `),
    );
    expect(up).toMatch(/WHERE p\.resource_id = r\.id AND p\.name = v\.name/);
  });

  it('nests Module under Curriculum and Chapter under Module, by key', () => {
    const pairs = [...nesting.matchAll(/"(\w+)":\s+"(\w+)"/g)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(pairs).toEqual([
      ['Curriculum', 'CourseParent'],
      ['Module', 'Curriculum'],
      ['Chapter', 'Module'],
    ]);
    // Everything not listed sits directly under its group.
    expect(nesting).toMatch(
      /LEFT JOIN jsonb_each_text\(nesting\)[\s\S]*WHERE NOT r\.is_parent/,
    );
    expect(nesting).toContain(
      'child.parent_id IS DISTINCT FROM target.parent_id',
    );
  });

  it('has a rollback that removes Curriculum and parent_id', () => {
    expect(down).toContain(
      'DELETE FROM "zuvy_resources" WHERE key = \'Curriculum\'',
    );
    expect(down).toContain('DROP COLUMN IF EXISTS "parent_id"');
  });
});

describe('resource parentResourceId validation', () => {
  const service = new RbacResourcesService();
  const [course] = PARENTS;
  // Answers "is this resource a parent's own row?" and "does the parent exist?".
  const respond = ({
    parentExists,
    selfIsParent,
  }: {
    parentExists: boolean;
    selfIsParent: boolean;
  }) => {
    mockClient.respond = (text) => {
      if (/select "is_parent" from "main"\."zuvy_resources"/.test(text))
        return [[selfIsParent]];
      if (/from "main"\."zuvy_parent_resources"/.test(text))
        return parentExists ? [[course.parentResourceId]] : [];
      if (/^update "main"\."zuvy_resources"/.test(text))
        return [
          resourceRow(
            resource(11, 'Module', 'module', course.parentResourceId),
          ),
        ];
      return [];
    };
  };

  it('rejects a parent that does not exist', async () => {
    respond({ parentExists: false, selfIsParent: false });
    await expect(
      service.updateResource(11, { parentResourceId: 999 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects moving a parent's own permission row", async () => {
    respond({ parentExists: true, selfIsParent: true });
    await expect(
      service.updateResource(course.id, { parentResourceId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(queriesMatching(/^update/)).toHaveLength(0);
  });

  it('moves a child resource under an existing parent', async () => {
    respond({ parentExists: true, selfIsParent: false });
    await service.updateResource(11, {
      parentResourceId: course.parentResourceId,
    });
    const [update] = queriesMatching(/^update "main"\."zuvy_resources"/);
    expect(update.text).toContain('"parent_resource_id" = $1');
    expect(update.params).toEqual([course.parentResourceId, 11]);
  });
});

describe('resource parentId (nesting) validation', () => {
  const service = new RbacResourcesService();
  const GROUP = 1;
  // id -> [is_parent, parent_resource_id, parent_id]
  const table: Record<number, [boolean, number | null, number | null]> = {
    71: [true, GROUP, null], // Course Studio's own row
    90: [false, GROUP, null], // Curriculum
    11: [false, GROUP, 90], // Module
    31: [false, GROUP, 11], // Chapter
  };
  beforeEach(() => {
    mockClient.respond = (text, params) => {
      const row = table[params[0] as number];
      if (
        /select "is_parent", "parent_resource_id" from "main"\."zuvy_resources"/.test(
          text,
        )
      )
        return row ? [[row[0], row[1]]] : [];
      if (/select "parent_id" from "main"\."zuvy_resources"/.test(text))
        return row ? [[row[2]]] : [];
      if (/select "is_parent" from "main"\."zuvy_resources"/.test(text))
        return row ? [[row[0]]] : [];
      if (/from "main"\."zuvy_parent_resources"/.test(text)) return [[GROUP]];
      if (/^update "main"\."zuvy_resources"/.test(text))
        return [
          resourceRow(resource(31, 'Chapter', 'chapter', GROUP, false, 11)),
        ];
      return [];
    };
  });

  it('nests a resource and puts it in its new parent group', async () => {
    await service.updateResource(31, { parentId: 11 });
    const [update] = queriesMatching(/^update "main"\."zuvy_resources"/);
    expect(update.text).toContain('"parent_resource_id" = $');
    expect(update.text).toContain('"parent_id" = $');
    expect(update.params).toEqual(expect.arrayContaining([11, GROUP, 31]));
  });

  it.each([
    ['itself', 31, 31, BadRequestException],
    ['one of its own children', 90, 31, BadRequestException],
    ["a parent's own permission row", 11, 71, BadRequestException],
    ['a resource that does not exist', 11, 999, NotFoundException],
  ])('refuses nesting under %s', async (_label, selfId, parentId, error) => {
    await expect(
      service.updateResource(selfId as number, {
        parentId: parentId as number,
      }),
    ).rejects.toBeInstanceOf(error);
    expect(queriesMatching(/^update/)).toHaveLength(0);
  });

  it('refuses a parentResourceId that disagrees with the parent resource group', async () => {
    await expect(
      service.updateResource(31, { parentId: 11, parentResourceId: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe.each(PARENTS)(
  'POST /rbac/assign/permissionsToRole for $title',
  (p: Parent) => {
    const ROLE_ID = 26;
    const ORG_ID = 7;
    const service = new RbacPermissionService(
      {} as any,
      { getUserTokens: async () => ({ success: false }) } as any,
    );

    // Answers the existence checks and lists the resource's permissions.
    const respondForResource = (
      resourceId: number,
      permIds: number[],
      roleOrgId = ORG_ID,
    ) => {
      mockClient.respond = (text, params) => {
        if (/from "main"\."zuvy_resources"/.test(text))
          return [
            resourceRow(
              resource(
                resourceId,
                p.key,
                p.title,
                p.parentResourceId,
                resourceId === p.id,
              ),
            ),
          ];
        if (/from "main"\."zuvy_user_roles"/.test(text))
          return [[ROLE_ID, roleOrgId]];
        if (/select "id" from "main"\."zuvy_permissions"/.test(text))
          return params[0] === resourceId ? permIds.map((id) => [id]) : [];
        return [];
      };
    };

    it('saves parent grants for the role and org, without touching children', async () => {
      respondForResource(p.id, Object.values(p.perms));

      const result = await service.assignPermissionsToRole(
        {
          resourceId: p.id,
          roleId: ROLE_ID,
          permissions: {
            [p.perms.view]: true,
            [p.perms.edit]: false,
            [p.perms.create]: false,
            [p.perms.delete]: false,
          },
        },
        ORG_ID,
      );
      expect(result.status).toBe('success');
      expect(result.data.resourceId).toBe(p.id);

      const [insert] = queriesMatching(
        /^insert into "main"\."zuvy_permissions_roles"/,
      );
      // Params follow column order: permission_id, role_id, org_id.
      expect(insert.params).toEqual([p.perms.view, ROLE_ID, ORG_ID]);
      // Re-saving the same grant is a no-op rather than a duplicate row.
      expect(insert.text).toMatch(
        /on conflict \("role_id","permission_id"\) do nothing/,
      );

      const [remove] = queriesMatching(
        /^delete from "main"\."zuvy_permissions_roles"/,
      );
      expect(remove.text).toMatch(/"org_id" = \$2/);
      expect(remove.params).toEqual([
        ROLE_ID,
        ORG_ID,
        p.perms.edit,
        p.perms.create,
        p.perms.delete,
      ]);

      // Nothing was written for any child permission.
      const permissionIds = [insert.params[0], ...remove.params.slice(2)];
      Object.values(p.child.perms).forEach((id) =>
        expect(permissionIds).not.toContain(id),
      );
    });

    it('saves all four parent permissions at once', async () => {
      respondForResource(p.id, Object.values(p.perms));
      await service.assignPermissionsToRole(
        {
          resourceId: p.id,
          roleId: ROLE_ID,
          permissions: Object.fromEntries(
            Object.values(p.perms).map((id) => [id, true]),
          ),
        },
        ORG_ID,
      );
      const [insert] = queriesMatching(
        /^insert into "main"\."zuvy_permissions_roles"/,
      );
      expect(insert.params).toEqual([
        p.perms.view,
        ROLE_ID,
        ORG_ID,
        p.perms.edit,
        ROLE_ID,
        ORG_ID,
        p.perms.create,
        ROLE_ID,
        ORG_ID,
        p.perms.delete,
        ROLE_ID,
        ORG_ID,
      ]);
      expect(queriesMatching(/^delete from/)).toHaveLength(0);
    });

    it.each(['view', 'edit', 'create', 'delete'])(
      'a parent %s grant assigns nothing on any child',
      async (level: string) => {
        respondForResource(p.id, Object.values(p.perms));
        await service.assignPermissionsToRole(
          {
            resourceId: p.id,
            roleId: ROLE_ID,
            permissions: { [p.perms[level]]: true },
          },
          ORG_ID,
        );
        const writes = queriesMatching(
          /^(insert into|delete from) "main"\."zuvy_permissions_roles"/,
        );
        expect(writes).toHaveLength(1);
        expect(writes[0].params).toEqual([p.perms[level], ROLE_ID, ORG_ID]);
      },
    );

    it('refuses child permission ids sent against the parent resource', async () => {
      respondForResource(p.id, Object.values(p.perms));
      await expect(
        service.assignPermissionsToRole(
          {
            resourceId: p.id,
            roleId: ROLE_ID,
            permissions: { [p.child.perms.view]: true },
          },
          ORG_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(queriesMatching(/^insert into/)).toHaveLength(0);
    });

    it('saves child permissions on their own resource id without touching the parent', async () => {
      respondForResource(p.child.id, Object.values(p.child.perms));
      await service.assignPermissionsToRole(
        {
          resourceId: p.child.id,
          roleId: ROLE_ID,
          permissions: {
            [p.child.perms.view]: true,
            [p.child.perms.edit]: false,
          },
        },
        ORG_ID,
      );
      const [insert] = queriesMatching(
        /^insert into "main"\."zuvy_permissions_roles"/,
      );
      expect(insert.params).toEqual([p.child.perms.view, ROLE_ID, ORG_ID]);
      const [remove] = queriesMatching(
        /^delete from "main"\."zuvy_permissions_roles"/,
      );
      expect(remove.params).toEqual([ROLE_ID, ORG_ID, p.child.perms.edit]);
      Object.values(p.perms).forEach((id) =>
        expect([...insert.params, ...remove.params]).not.toContain(id),
      );
    });

    it('refuses a role from another organization', async () => {
      respondForResource(p.id, Object.values(p.perms), ORG_ID + 1);
      await expect(
        service.assignPermissionsToRole(
          {
            resourceId: p.id,
            roleId: ROLE_ID,
            permissions: { [p.perms.view]: true },
          },
          ORG_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(queriesMatching(/^(insert into|delete from)/)).toHaveLength(0);
    });

    it('accepts a global role (no organization) in any organization', async () => {
      respondForResource(p.id, Object.values(p.perms), null);
      await service.assignPermissionsToRole(
        {
          resourceId: p.id,
          roleId: ROLE_ID,
          permissions: { [p.perms.view]: true },
        },
        ORG_ID,
      );
      expect(
        queriesMatching(/^insert into "main"\."zuvy_permissions_roles"/),
      ).toHaveLength(1);
    });
  },
);

describe('POST /permissions/assign/toRole', () => {
  it('saves through the same code, inside one transaction with the audit log', async () => {
    const [course] = PARENTS;
    const auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new PermissionsService(
      auditLog as any,
      {} as any,
      {} as any,
    );
    mockClient.respond = (text, params) => {
      if (/from "main"\."zuvy_resources"/.test(text)) return [[course.id]];
      if (/from "main"\."zuvy_user_roles"/.test(text)) return [[26, 7]];
      if (/select "id" from "main"\."zuvy_permissions"/.test(text))
        return params[0] === course.id
          ? Object.values(course.perms).map((id) => [id])
          : [];
      return [];
    };

    const result = await service.assignPermissionsToRole(
      '5',
      {
        resourceId: course.id,
        roleId: 26,
        permissions: { [course.perms.view]: true },
      },
      7,
    );

    expect(result.data).toMatchObject({ roleId: 26, resourceId: course.id });
    expect(auditLog.log).toHaveBeenCalledWith(
      'perm_to_role',
      expect.objectContaining({ roleId: 26 }),
    );
    const texts = mockClient.queries.map((q) => q.text);
    const begin = texts.indexOf('begin');
    const commit = texts.indexOf('commit');
    const insert = texts.findIndex((t) =>
      /^insert into "main"\."zuvy_permissions_roles"/.test(t),
    );
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(insert).toBeGreaterThan(begin);
    expect(commit).toBeGreaterThan(insert);
  });
});

describe('permission checks', () => {
  it('never let a parent grant satisfy a permission check', async () => {
    const service = new RbacPermissionService({} as any, {} as any);
    await service.getUserPermissions(5, 7);
    const [lookup] = queriesMatching(/from "main"\."zuvy_permissions"/);
    const filter = lookup.text.match(/"zuvy_resources"\."is_parent" = \$(\d+)/);
    expect(filter).not.toBeNull();
    expect(lookup.params[Number(filter[1]) - 1]).toBe(false);
  });
});

describe.each(PARENTS)(
  'GET /permissions/:roleId/permissions/:resourceId for $title',
  (p: Parent) => {
    const service = new PermissionsService({} as any, {} as any, {} as any);
    const ROLE_ID = 26;

    beforeEach(() => {
      mockClient.respond = (text) => {
        if (/from "main"\."zuvy_user_roles"/.test(text)) return [[ROLE_ID]];
        if (/from "main"\."zuvy_resources"/.test(text))
          return [resourceRow(parentRow(p))];
        if (/from "main"\."zuvy_permissions"/.test(text))
          return [[p.perms.view, 'view', null, p.id, null, null, true]];
        return [];
      };
    });

    it("returns only the parent's permissions with the saved state", async () => {
      const result = await service.getPermissionsByRoleAndResource(
        ROLE_ID,
        p.id,
      );
      expect(result).toEqual([
        expect.objectContaining({
          id: p.perms.view,
          resourceId: p.id,
          granted: true,
        }),
      ]);
      const [lookup] = queriesMatching(/from "main"\."zuvy_permissions"/);
      expect(lookup.text).toMatch(
        /where "zuvy_permissions"\."resource_id" = \$\d+/,
      );
      expect(lookup.params).toContain(p.id);
      expect(lookup.params).not.toContain(p.child.id);
    });

    it('scopes the granted state to the org when orgId is given', async () => {
      await service.getPermissionsByRoleAndResource(ROLE_ID, p.id, 3);
      const [lookup] = queriesMatching(/from "main"\."zuvy_permissions"/);
      expect(lookup.text).toMatch(/"zuvy_permissions_roles"\."org_id" = \$\d+/);
      expect(lookup.params).toEqual(expect.arrayContaining([ROLE_ID, 3, p.id]));
    });
  },
);

describe('GET /permissions/:roleId/permissions/:resourceId organization', () => {
  const {
    PermissionsController,
  } = require('src/permissions/permissions.controller');
  const service = {
    getPermissionsByRoleAndResource: jest.fn().mockResolvedValue([]),
  };
  const controller = new PermissionsController(service as any, {} as any);
  const [course] = PARENTS;

  beforeEach(() => service.getPermissionsByRoleAndResource.mockClear());

  it("reads the caller's organization when none is given, like the save does", async () => {
    await controller.getPermissionsByRoleAndResource(26, course.id, {
      user: [{ orgId: '7' }],
    });
    expect(service.getPermissionsByRoleAndResource).toHaveBeenCalledWith(
      26,
      course.id,
      7,
    );
  });

  it('uses an explicit orgId over the caller organization', async () => {
    await controller.getPermissionsByRoleAndResource(
      26,
      course.id,
      { user: [{ orgId: '7' }] },
      '3',
    );
    expect(service.getPermissionsByRoleAndResource).toHaveBeenCalledWith(
      26,
      course.id,
      3,
    );
  });
});
