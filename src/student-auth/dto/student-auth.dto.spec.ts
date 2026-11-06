import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StudentSignupDto } from './student-auth.dto';

const base = {
  name: 'Riya Sharma',
  password: 'riya@2026',
  state: 'Assam',
  city: 'Karimganj',
};

// What the sign-up endpoint does with a body: transform, then validate.
const check = async (body: Record<string, unknown>) => {
  const dto = plainToInstance(StudentSignupDto, body);
  const errors = await validate(dto);
  return { dto, failed: errors.map((e) => e.property) };
};

describe('StudentSignupDto school fields', () => {
  it('accepts a school from the list (udiseCode, no schoolName)', async () => {
    const { dto, failed } = await check({ ...base, udiseCode: '18220121003' });
    expect(failed).toEqual([]);
    expect(dto.udiseCode).toBe('18220121003');
  });

  it('accepts a typed-in school with no udiseCode, spaces tidied', async () => {
    const { dto, failed } = await check({
      ...base,
      schoolName: '  Saint   Joseph School ',
    });
    expect(failed).toEqual([]);
    expect(dto.schoolName).toBe('Saint Joseph School');
    expect(dto.udiseCode).toBeUndefined();
  });

  it('accepts a null udiseCode', async () => {
    const { failed } = await check({
      ...base,
      udiseCode: null,
      schoolName: 'Saint Joseph School',
    });
    expect(failed).toEqual([]);
  });

  it('treats empty fields as not sent', async () => {
    const { dto, failed } = await check({
      ...base,
      udiseCode: '  ',
      schoolName: '   ',
    });
    expect(failed).toEqual([]);
    expect(dto.udiseCode).toBeUndefined();
    expect(dto.schoolName).toBeUndefined();
  });

  it('accepts a school name in Hindi', async () => {
    const { failed } = await check({ ...base, schoolName: 'रवि पब्लिक स्कूल' });
    expect(failed).toEqual([]);
  });

  it('refuses a typed name that is too short, too long or has no letters', async () => {
    for (const schoolName of ['ab', '123', '!!!--', 'x'.repeat(256)]) {
      const { failed } = await check({ ...base, schoolName });
      expect(failed).toEqual(['schoolName']);
    }
  });

  it('still refuses a malformed udiseCode', async () => {
    const { failed } = await check({ ...base, udiseCode: '12345' });
    expect(failed).toEqual(['udiseCode']);
  });
});
