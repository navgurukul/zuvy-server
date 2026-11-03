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
    title: 'Course',
    perms: { view: 94, edit: 95, create: 96, delete: 97 },
    child: {
      id: 10,
      key: 'Course',
      name: 'course',
      perms: { create: 1, view: 2, edit: 3, delete: 4 },
    },
  },
  {
    parentResourceId: 2,
    id: 72,
    key: 'QuestionBankParent',
    title: 'Question Bank',
    perms: { view: 98, edit: 99, create: 100, delete: 101 },
    child: {
      id: 14,
      key: 'Question',
      name: 'Question',
      perms: { create: 17, view: 18, edit: 19, delete: 20 },
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
const TOP_LEVEL_ID = 57; // Organization stays outside every group

const resource = (
  id: number,
  key: string,
  name: string,
  parentResourceId: number | null,
  isParent = false,
) => ({
  id,
  key,
  name,
  description: null,
  parentResourceId,
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
  r.isParent,
  r.createdAt,
  r.updatedAt,
];
// A parent's own permission row.
const parentRow = (p: Parent) =>
  resource(p.id, p.key, p.title, p.parentResourceId, true);
// A zuvy_resources row joined to its parent's name, as /rbac/resources reads it.
const withParentName = (r: ReturnType<typeof resource>) => ({
  ...r,
  parentName:
    PARENTS.find((p) => p.parentResourceId === r.parentResourceId)?.title ??
    null,
});
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
    resource(TOP_LEVEL_ID, 'Organization', 'organization', null),
  ].map(withParentName);
  const permissions = PARENTS.flatMap((p) => [
    ...permRows(p.id, p.perms),
    ...permRows(p.child.id, p.child.perms),
  ]);
  const data = buildResourceHierarchy(resources, permissions);
  const byId = (id: number) => data.find((r) => r.id === id);

  it('returns the three parents first, each once', () => {
    expect(data.slice(0, 3).map((r) => [r.id, r.title, r.isParent])).toEqual(
      PARENTS.map((p) => [p.id, p.title, true]),
    );
    expect(data.filter((r) => r.isParent)).toHaveLength(PARENTS.length);
  });

  it('gives every entry a unique id, so parent and child ids never overlap', () => {
    const ids = data.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(data).toHaveLength(resources.length);
  });

  it.each(PARENTS)(
    'returns $title with parentId null and its parent table id',
    (p: Parent) => {
      expect(byId(p.id)).toMatchObject({
        title: p.title,
        isParent: true,
        parentId: null,
        parentResourceId: p.parentResourceId,
      });
      expect(byId(p.id)).not.toHaveProperty('parentName');
    },
  );

  it.each(PARENTS)(
    'links $title children by parentId, keeping their ids and fields',
    (p: Parent) => {
      expect(byId(p.child.id)).toMatchObject({
        id: p.child.id,
        key: p.child.key,
        name: p.child.name,
        title: p.child.name,
        isParent: false,
        parentId: p.id,
        parentResourceId: p.parentResourceId,
      });
    },
  );

  it('leaves ungrouped resources at the top level', () => {
    expect(byId(TOP_LEVEL_ID)).toMatchObject({
      isParent: false,
      parentId: null,
      parentResourceId: null,
    });
  });

  it.each(PARENTS)("lists $title's own permissions only", (p: Parent) => {
    expect(byId(p.id).permissions.map((x) => x.id)).toEqual(
      Object.values(p.perms),
    );
    expect(byId(p.child.id).permissions.map((x) => x.id)).toEqual(
      Object.values(p.child.perms),
    );
  });

  it('getAllResources reads resources and parents in one query', async () => {
    mockClient.respond = (text) =>
      /from "main"\."zuvy_resources" left join "main"\."zuvy_parent_resources"/.test(
        text,
      )
        ? resources.map((r) => [...resourceRow(r), r.parentName])
        : [];
    const result = await new RbacResourcesService().getAllResources();
    expect(result).toMatchObject({ status: 'success', code: 200 });
    expect(result.data.filter((r) => r.isParent).map((r) => r.id)).toEqual(
      PARENTS.map((p) => p.id),
    );
    expect(mockClient.queries).toHaveLength(2); // resources + permissions
  });
});

describe('migration 0047', () => {
  const read = (name: string) =>
    readFileSync(join(__dirname, '../../drizzle/migrations', name), 'utf8');
  const up = read('0047_add_parent_resources.sql');
  const down = read('0047_add_parent_resources.down.sql');
  const grouping = up.slice(up.indexOf('UPDATE "zuvy_resources" child'));
  const childrenOf = (parentName: string) =>
    [...grouping.matchAll(new RegExp(`\\('${parentName}', '(\\w+)'\\)`, 'g'))]
      .map((m) => m[1])
      .sort();

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

  it('seeds the three parents without duplicates on a re-run', () => {
    expect(up).toContain(
      "VALUES ('Course'), ('Question Bank'), ('Roles & Permissions')",
    );
    PARENTS.forEach((p) => expect(up).toContain(`('${p.title}', '${p.key}')`));
    expect(up).toContain('ON CONFLICT ("name") DO NOTHING');
    // A re-run reuses each parent's permission row instead of adding one.
    expect(up).toContain('ON CONFLICT ("key") DO UPDATE');
    ['view', 'edit', 'create', 'delete'].forEach((name) =>
      expect(up).toContain(`('${name}', `),
    );
    // Parents have the same four permissions as children; no manager.
    expect(up).not.toContain("('manager', ");
  });

  it('groups the existing resources under their parents', () => {
    expect(childrenOf('Course')).toEqual([
      'Batch',
      'Bootcamp',
      'Chapter',
      'Class',
      'Course',
      'Module',
      'Setting',
      'Student',
      'Submission',
      'Topic',
    ]);
    expect(childrenOf('Question Bank')).toEqual([
      'CodingQuestion',
      'Mcq',
      'OpendEnded',
      'Question',
    ]);
    expect(childrenOf('Roles & Permissions')).toEqual([
      'RolesAndPermission',
      'User',
    ]);
  });

  it('has a rollback that removes the column, the table and the parent rows', () => {
    expect(down).toContain('DROP COLUMN IF EXISTS "parent_resource_id"');
    expect(down).toContain('DROP COLUMN IF EXISTS "is_parent"');
    expect(down).toContain('DROP TABLE IF EXISTS "zuvy_parent_resources"');
    expect(down).toMatch(/SELECT id FROM "zuvy_resources" WHERE is_parent/);
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
