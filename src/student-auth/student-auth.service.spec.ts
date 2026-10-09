// Keep unit tests off the real database and auth stack.
jest.mock('src/db', () => ({ db: {} }));
jest.mock('src/auth/auth.service', () => ({ AuthService: class {} }));

import { StudentAuthService } from './student-auth.service';

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
