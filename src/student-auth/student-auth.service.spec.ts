// Keep unit tests off the real database and auth stack.
jest.mock('src/db', () => ({ db: {} }));
jest.mock('src/auth/auth.service', () => ({ AuthService: class {} }));

import { ForbiddenException } from '@nestjs/common';
import { StudentAuthService, canEnrollInCourse } from './student-auth.service';

describe('StudentAuthService (credential helpers)', () => {
  const service = new StudentAuthService({} as any, {} as any) as any;

  it('hashes and verifies passwords with scrypt', async () => {
    const hash = await service.hashPassword('riya@2026');
    expect(hash.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(hash.length).toBeLessThanOrEqual(255);
    await expect(service.verifyPassword('riya@2026', hash)).resolves.toBe(true);
    await expect(service.verifyPassword('riya@2027', hash)).resolves.toBe(
      false,
    );
  });

  it('uses a fresh salt for every hash', async () => {
    const a = await service.hashPassword('same-password');
    const b = await service.hashPassword('same-password');
    expect(a).not.toEqual(b);
  });

  it('rejects unknown or malformed hashes without throwing', async () => {
    await expect(service.verifyPassword('x', null)).resolves.toBe(false);
    await expect(service.verifyPassword('x', 'not-a-hash')).resolves.toBe(
      false,
    );
  });

  it('generates readable Student IDs without look-alike characters', () => {
    for (let i = 0; i < 500; i++) {
      const id = service.generateStudentId();
      expect(id).toMatch(/^ZV[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('generates 8-character passwords from a readable alphabet', () => {
    const password = service.generatePassword();
    expect(password).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
  });
});

describe('canEnrollInCourse (org admins and ops)', () => {
  it('allows admin and ops of the course organisation', () => {
    expect(canEnrollInCourse(['admin'], 7, 7)).toBe(true);
    expect(canEnrollInCourse(['ops'], 7, 7)).toBe(true);
    expect(canEnrollInCourse(['instructor', 'admin'], '7' as any, 7)).toBe(
      true,
    );
  });

  it('refuses another organisation', () => {
    expect(canEnrollInCourse(['admin'], 7, 8)).toBe(false);
  });

  it('refuses instructors, students and users without an org session', () => {
    expect(canEnrollInCourse(['instructor'], 7, 7)).toBe(false);
    expect(canEnrollInCourse(['student'], 7, 7)).toBe(false);
    expect(canEnrollInCourse(['admin'], null, 7)).toBe(false);
    expect(canEnrollInCourse(['admin'], 7, null)).toBe(false);
  });
});

describe('StudentAuthService.assertCanEnroll', () => {
  const rolesFor = (globalRoles: string[], orgRoles: string[]) => ({
    getUserRoles: jest.fn(async (_userId: number, orgId: number | null) =>
      orgId === null ? globalRoles : orgRoles,
    ),
  });

  it('lets a super admin enrol into any course', async () => {
    const auth = rolesFor(['super_admin'], []);
    const service = new StudentAuthService(auth as any, {} as any) as any;
    await expect(
      service.assertCanEnroll({ userId: 1, orgId: null }, 99),
    ).resolves.toBeUndefined();
  });

  it('lets an org admin enrol into their own organisation', async () => {
    const auth = rolesFor(['student'], ['admin']);
    const service = new StudentAuthService(auth as any, {} as any) as any;
    await expect(
      service.assertCanEnroll({ userId: 2, orgId: 7 }, 7),
    ).resolves.toBeUndefined();
    expect(auth.getUserRoles).toHaveBeenCalledWith(2, 7);
  });

  it('refuses an org admin for another organisation, and an instructor', async () => {
    const admin = new StudentAuthService(
      rolesFor(['student'], ['admin']) as any,
      {} as any,
    ) as any;
    await expect(
      admin.assertCanEnroll({ userId: 2, orgId: 7 }, 8),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const instructor = new StudentAuthService(
      rolesFor(['student'], ['instructor']) as any,
      {} as any,
    ) as any;
    await expect(
      instructor.assertCanEnroll({ userId: 3, orgId: 7 }, 7),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
