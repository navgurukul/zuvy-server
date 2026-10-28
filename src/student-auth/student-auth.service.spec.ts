// Keep unit tests off the real database and auth stack.
jest.mock('src/db', () => ({ db: {} }));
jest.mock('src/auth/auth.service', () => ({ AuthService: class {} }));

import { ForbiddenException } from '@nestjs/common';
import { db } from 'src/db';
import { zuvyStudentIdCounters } from 'drizzle/schema';
import {
  StudentAuthService,
  canEnrollInCourse,
  formatStudentId,
  studentIdBaseFromName,
} from './student-auth.service';

describe('StudentAuthService (credential helpers)', () => {
  const service = new StudentAuthService(
    {} as any,
    {} as any,
    {} as any,
  ) as any;

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

  it('generates 8-character passwords from a readable alphabet', () => {
    const password = service.generatePassword();
    expect(password).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
  });
});

describe('Student ID from the name', () => {
  it('uses first name + last name in lowercase', () => {
    expect(studentIdBaseFromName('Arunesh Dhar')).toBe('aruneshdhar');
    expect(studentIdBaseFromName('ARUNESH DHAR')).toBe('aruneshdhar');
  });

  it('uses only the first name when there is no last name', () => {
    expect(studentIdBaseFromName('Arunesh')).toBe('arunesh');
    expect(studentIdBaseFromName('  Arunesh  ')).toBe('arunesh');
  });

  it('skips middle names and extra spaces', () => {
    expect(studentIdBaseFromName('Arunesh Kumar Dhar')).toBe('aruneshdhar');
    expect(studentIdBaseFromName(' Arunesh   Kumar  Dhar ')).toBe(
      'aruneshdhar',
    );
  });

  it('keeps only letters: accents, dots, hyphens, apostrophes and digits go', () => {
    expect(studentIdBaseFromName('José Ñúñez')).toBe('josenunez');
    expect(studentIdBaseFromName("Mary-Ann O'Brien")).toBe('maryannobrien');
    expect(studentIdBaseFromName('A. P. J. Abdul Kalam')).toBe('akalam');
    expect(studentIdBaseFromName('Riya2 Sharma')).toBe('riyasharma');
  });

  it('spells Hindi (Devanagari) names in English letters', () => {
    expect(studentIdBaseFromName('रवि')).toBe('ravi');
    expect(studentIdBaseFromName('अरुणेश धर')).toBe('aruneshdhar');
    expect(studentIdBaseFromName('प्रिया शर्मा')).toBe('priyasharma');
    expect(studentIdBaseFromName('राहुल कुमार वर्मा')).toBe('rahulvarma');
    expect(studentIdBaseFromName('Ravi शर्मा')).toBe('ravisharma');
  });

  it('falls back to "student" when the name has no usable letters', () => {
    expect(studentIdBaseFromName('ரவி')).toBe('student'); // Tamil
    expect(studentIdBaseFromName('123')).toBe('student');
  });

  it('caps very long names at 30 letters', () => {
    const base = studentIdBaseFromName(`${'a'.repeat(25)} ${'b'.repeat(25)}`);
    expect(base).toBe(`${'a'.repeat(25)}${'b'.repeat(5)}`);
  });

  it('adds "ct" and the number, without leading zeros', () => {
    expect(formatStudentId('aruneshdhar', 1)).toBe('aruneshdharct1');
    expect(formatStudentId('aruneshdhar', 2)).toBe('aruneshdharct2');
    expect(formatStudentId('ravi', 900)).toBe('ravict900');
  });

  it('keeps every ID valid for login: lowercase letters and digits, at most 40', () => {
    const longest = formatStudentId('z'.repeat(30), 9999999);
    expect(longest.length).toBeLessThanOrEqual(40);
    expect(longest).toMatch(/^[a-z0-9]{3,40}$/);
  });
});

const SCHOOL = {
  state: 'Telangana',
  city: 'Hyderabad',
  schoolName: 'ZPHS MADHAPUR',
  udiseCode: '36070700101',
};

describe('StudentAuthService Student ID allocation', () => {
  const mockDb = db as any;
  const service = new StudentAuthService(
    {} as any,
    {} as any,
    {} as any,
  ) as any;

  // insert(counters).values().onConflictDoUpdate().returning() hands out the
  // next number; insert(credentials).values() stores the account.
  const setup = (
    numbers: number[],
    outcomes: Array<'ok' | 'duplicate' | Error>,
  ) => {
    const returning = jest.fn();
    numbers.forEach((n) =>
      returning.mockResolvedValueOnce([{ lastNumber: n }]),
    );
    const counterValues = jest.fn(() => ({
      onConflictDoUpdate: () => ({ returning }),
    }));
    const credentialValues = jest.fn();
    outcomes.forEach((outcome) =>
      outcome === 'ok'
        ? credentialValues.mockResolvedValueOnce(undefined)
        : credentialValues.mockRejectedValueOnce(
            outcome === 'duplicate'
              ? Object.assign(new Error('duplicate key'), { code: '23505' })
              : outcome,
          ),
    );
    mockDb.insert = jest.fn((table) =>
      table === zuvyStudentIdCounters
        ? { values: counterValues }
        : { values: credentialValues },
    );
    return { counterValues, credentialValues };
  };

  it('gives the first student with a name number 1', async () => {
    const { counterValues, credentialValues } = setup([1], ['ok']);
    await expect(
      service.insertCredentialWithUniqueId(1n, 'Arunesh Dhar', 'hash', SCHOOL),
    ).resolves.toBe('aruneshdharct1');
    expect(counterValues).toHaveBeenCalledWith({
      base: 'aruneshdhar',
      lastNumber: 1,
    });
    expect(credentialValues).toHaveBeenCalledWith({
      userId: 1n,
      studentId: 'aruneshdharct1',
      passwordHash: 'hash',
      state: 'Telangana',
      city: 'Hyderabad',
      schoolName: 'ZPHS MADHAPUR',
      udiseCode: '36070700101',
    });
  });

  it('gives the next same-name student the next number', async () => {
    setup([2], ['ok']);
    await expect(
      service.insertCredentialWithUniqueId(2n, 'Arunesh Dhar', 'hash', SCHOOL),
    ).resolves.toBe('aruneshdharct2');
  });

  it('uses only the first name when there is no last name', async () => {
    const { counterValues } = setup([1], ['ok']);
    await expect(
      service.insertCredentialWithUniqueId(3n, 'Arunesh', 'hash', SCHOOL),
    ).resolves.toBe('aruneshct1');
    expect(counterValues).toHaveBeenCalledWith({
      base: 'arunesh',
      lastNumber: 1,
    });
  });

  it('builds the ID for a Hindi name from its English spelling', async () => {
    setup([3], ['ok']);
    await expect(
      service.insertCredentialWithUniqueId(4n, 'रवि', 'hash', SCHOOL),
    ).resolves.toBe('ravict3');
  });

  it('takes the next number if the ID already exists (safety net)', async () => {
    const { credentialValues } = setup([5, 6], ['duplicate', 'ok']);
    await expect(
      service.insertCredentialWithUniqueId(5n, 'Arunesh Dhar', 'hash', SCHOOL),
    ).resolves.toBe('aruneshdharct6');
    expect(credentialValues).toHaveBeenCalledTimes(2);
  });

  it('does not retry on other database errors', async () => {
    const { credentialValues } = setup([1], [new Error('db down')]);
    await expect(
      service.insertCredentialWithUniqueId(6n, 'Arunesh Dhar', 'hash', SCHOOL),
    ).rejects.toThrow('db down');
    expect(credentialValues).toHaveBeenCalledTimes(1);
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
    const service = new StudentAuthService(
      auth as any,
      {} as any,
      {} as any,
    ) as any;
    await expect(
      service.assertCanEnroll({ userId: 1, orgId: null }, 99),
    ).resolves.toBeUndefined();
  });

  it('lets an org admin enrol into their own organisation', async () => {
    const auth = rolesFor(['student'], ['admin']);
    const service = new StudentAuthService(
      auth as any,
      {} as any,
      {} as any,
    ) as any;
    await expect(
      service.assertCanEnroll({ userId: 2, orgId: 7 }, 7),
    ).resolves.toBeUndefined();
    expect(auth.getUserRoles).toHaveBeenCalledWith(2, 7);
  });

  it('refuses an org admin for another organisation, and an instructor', async () => {
    const admin = new StudentAuthService(
      rolesFor(['student'], ['admin']) as any,
      {} as any,
      {} as any,
    ) as any;
    await expect(
      admin.assertCanEnroll({ userId: 2, orgId: 7 }, 8),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const instructor = new StudentAuthService(
      rolesFor(['student'], ['instructor']) as any,
      {} as any,
      {} as any,
    ) as any;
    await expect(
      instructor.assertCanEnroll({ userId: 3, orgId: 7 }, 7),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('StudentAuthService sign-up school check', () => {
  const mockDb = db as any;
  const listed = {
    id: 1,
    udiseCode: '36070700101',
    schoolName: 'ZPHS MADHAPUR',
    state: 'Telangana',
    district: 'Hyderabad',
    isActive: true,
  };
  const build = (school: any = listed, place: any = null) => {
    const auth = {
      issueLoginSession: jest.fn().mockResolvedValue({
        access_token: 'a',
        refresh_token: 'r',
        sessionId: 's-1',
      }),
    };
    const captcha = { verify: jest.fn().mockResolvedValue(undefined) };
    const schools = {
      findActiveByUdise: jest.fn().mockResolvedValue(school),
      findPlace: jest.fn().mockResolvedValue(place),
    };
    const service = new StudentAuthService(
      auth as any,
      captcha as any,
      schools as any,
    ) as any;
    return { service, auth, captcha, schools };
  };
  const input = {
    name: 'Riya Sharma',
    password: 'riya@2026',
    state: 'telangana',
    city: ' Hyderabad ',
    udiseCode: '36070700101',
    captchaToken: 'token',
    ip: '203.0.113.10',
    userAgent: 'test-agent',
  };
  // The user row comes back from the insert; the Student ID is stubbed.
  const stubAccountCreation = (service: any) => {
    const user = { id: 42n, name: 'Riya Sharma' };
    mockDb.insert = jest.fn(() => ({
      values: () => ({ returning: async () => [user] }),
    }));
    const insertCredential = jest
      .spyOn(service, 'insertCredentialWithUniqueId')
      .mockResolvedValue('riyasharmact1');
    return { user, insertCredential };
  };

  describe('a school picked from the list', () => {
    it('accepts the state and city in any case and saves the listed spelling', async () => {
      const { service } = build();
      await expect(
        service.resolveSchool({
          state: 'telangana',
          city: 'hyderabad',
          udiseCode: '36070700101',
        }),
      ).resolves.toEqual(SCHOOL);
    });

    it('refuses a school that is not in the list', async () => {
      const { service } = build(null);
      await expect(
        service.resolveSchool({
          state: 'Telangana',
          city: 'Hyderabad',
          udiseCode: '99999999999',
        }),
      ).rejects.toThrow('School not found');
    });

    it('refuses a school from another city or state', async () => {
      const { service } = build();
      await expect(
        service.resolveSchool({
          state: 'Telangana',
          city: 'WARANGAL',
          udiseCode: '36070700101',
        }),
      ).rejects.toThrow('not in the selected state and city');
      await expect(
        service.resolveSchool({
          state: 'KARNATAKA',
          city: 'Hyderabad',
          udiseCode: '36070700101',
        }),
      ).rejects.toThrow('not in the selected state and city');
    });

    it('uses the picked school when a typed name is sent too', async () => {
      const { service, schools } = build();
      await expect(
        service.resolveSchool({
          state: 'Telangana',
          city: 'Hyderabad',
          udiseCode: '36070700101',
          schoolName: 'Something Else',
        }),
      ).resolves.toEqual(SCHOOL);
      expect(schools.findPlace).not.toHaveBeenCalled();
    });

    it('checks the school before the captcha and writes nothing when it is wrong', async () => {
      const { service, captcha } = build(null);
      mockDb.insert = jest.fn();
      await expect(service.signup(input)).rejects.toThrow('School not found');
      expect(captcha.verify).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('saves the school and starts a student_id session with its code', async () => {
      const { service, auth, captcha } = build();
      const { user, insertCredential } = stubAccountCreation(service);

      const result = await service.signup(input);

      expect(captcha.verify).toHaveBeenCalledWith('token', '203.0.113.10');
      expect(insertCredential).toHaveBeenCalledWith(
        42n,
        'Riya Sharma',
        expect.any(String),
        SCHOOL,
      );
      expect(auth.issueLoginSession).toHaveBeenCalledWith(user, {
        method: 'student_id',
        ip: '203.0.113.10',
        userAgent: 'test-agent',
        udiseCode: '36070700101',
        unlistedSchool: false,
      });
      expect(result).toMatchObject({
        studentId: 'riyasharmact1',
        school: SCHOOL,
        sessionId: 's-1',
      });
    });
  });

  describe('a school that is not in the list (typed in)', () => {
    const place = { state: 'Assam', city: 'Karimganj' };
    const typed = {
      ...input,
      state: 'assam',
      city: 'KARIMGANJ',
      udiseCode: undefined,
      schoolName: '  Saint   Joseph School,  Badarpur ',
    };
    const TYPED_SCHOOL = {
      state: 'Assam',
      city: 'Karimganj',
      schoolName: 'Saint Joseph School, Badarpur',
      udiseCode: null,
    };

    it("saves the typed name with no UDISE code and the list's spelling of state and city", async () => {
      const { service, schools } = build(listed, place);
      await expect(service.resolveSchool(typed)).resolves.toEqual(TYPED_SCHOOL);
      expect(schools.findPlace).toHaveBeenCalledWith('assam', 'KARIMGANJ');
      expect(schools.findActiveByUdise).not.toHaveBeenCalled();
    });

    it('refuses a state or city that is not in the list', async () => {
      const { service } = build(listed, null);
      await expect(service.resolveSchool(typed)).rejects.toThrow(
        'Please choose your state and city from the list.',
      );
    });

    it('refuses a sign-up with no school at all', async () => {
      const { service, captcha } = build(listed, place);
      mockDb.insert = jest.fn();
      for (const schoolName of [undefined, null, '', '   ']) {
        await expect(service.signup({ ...typed, schoolName })).rejects.toThrow(
          'Please pick your school from the list, or type its name if it is not listed.',
        );
      }
      expect(captcha.verify).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('creates the account and starts a session marked as an unlisted school', async () => {
      const { service, auth } = build(listed, place);
      const { user, insertCredential } = stubAccountCreation(service);

      const result = await service.signup(typed);

      expect(insertCredential).toHaveBeenCalledWith(
        42n,
        'Riya Sharma',
        expect.any(String),
        TYPED_SCHOOL,
      );
      expect(auth.issueLoginSession).toHaveBeenCalledWith(user, {
        method: 'student_id',
        ip: '203.0.113.10',
        userAgent: 'test-agent',
        udiseCode: null,
        unlistedSchool: true,
      });
      expect(result).toMatchObject({
        studentId: 'riyasharmact1',
        school: TYPED_SCHOOL,
      });
    });
  });

  describe('login', () => {
    // A credential row as stored, with the password "riya@2026".
    const loginWith = async (school: {
      udiseCode: string | null;
      schoolName: string | null;
    }) => {
      const { service, auth } = build();
      const passwordHash = await service.hashPassword('riya@2026');
      const credential = {
        id: 7,
        userId: 42n,
        studentId: 'riyasharmact1',
        passwordHash,
        lockedUntil: null,
        state: school.schoolName ? 'Assam' : null,
        city: school.schoolName ? 'Karimganj' : null,
        ...school,
      };
      const user = { id: 42n, name: 'Riya Sharma' };
      const rows = [[credential], [user]];
      const query: any = {
        from: () => query,
        where: () => query,
        limit: async () => rows.shift(),
      };
      mockDb.select = jest.fn(() => query);
      mockDb.update = jest.fn(() => ({
        set: () => ({ where: async () => undefined }),
      }));
      const result = await service.login('riyasharmact1', 'riya@2026', {});
      return { result, context: auth.issueLoginSession.mock.calls[0][1] };
    };

    it('marks a typed-in school so the session ID gets NUDISE', async () => {
      const { result, context } = await loginWith({
        udiseCode: null,
        schoolName: 'Saint Joseph School, Badarpur',
      });
      expect(context).toMatchObject({ udiseCode: null, unlistedSchool: true });
      expect(result.school).toEqual({
        state: 'Assam',
        city: 'Karimganj',
        schoolName: 'Saint Joseph School, Badarpur',
        udiseCode: null,
      });
    });

    it('passes the code of a listed school', async () => {
      const { context } = await loginWith({
        udiseCode: '18220121003',
        schoolName: 'SAINT JOSEPH SCHOOL',
      });
      expect(context).toMatchObject({
        udiseCode: '18220121003',
        unlistedSchool: false,
      });
    });

    it('gives an account from before schools were asked no school (random session ID)', async () => {
      const { result, context } = await loginWith({
        udiseCode: null,
        schoolName: null,
      });
      expect(context).toMatchObject({ udiseCode: null, unlistedSchool: false });
      expect(result.school).toBeNull();
    });
  });
});
