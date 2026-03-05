import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { desc, eq, isNotNull, sql } from 'drizzle-orm';
import { pgSchema, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { zuvyLearnerInformation } from '../../../drizzle/schema';
import { db } from '../../db/index';
import {
  UpdateLearnerBoardByIdDto,
  UpdateLearnerEducationMasterDataByIdDto,
  UpdateTechnicalSkillByIdDto,
  UpsertLearnerBoardsDto,
  UpsertTechnicalSkillsDto,
  UpsertLearnerEducationMasterDataDto,
  UpsertLearnerInformationDto,
} from './dto/learner.dto';

const learnerMainSchema = pgSchema('main');

const zuvyLearnerEducationMasterDataTable = learnerMainSchema.table(
  'zuvy_learner_education_details',
  {
    id: serial('id').primaryKey().notNull(),
    collegeName: varchar('college_name', { length: 255 }),
    degreeProgram: varchar('degree_program', { length: 100 }),
    branchName: varchar('branch_name', { length: 100 }),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
);

const zuvyTechnicalSkillsTable = learnerMainSchema.table(
  'zuvy_learners_techinal_skills',
  {
    id: serial('id').primaryKey().notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
);

const zuvyLearnerBoardsTable = learnerMainSchema.table('zuvy_learners_boards', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
});

@Injectable()
export class LearnerService {
  private isLearnerSchemaMissingError(error: any): boolean {
    return ['42P01', '42703', '42704'].includes(String(error?.code || ''));
  }

  private async ensureLearnerInformationIndexes(): Promise<void> {
    await db.execute(
      sql.raw(`
DROP INDEX IF EXISTS main.zuvy_learner_information_user_id_unique;
`),
    );

    await db.execute(
      sql.raw(`
DROP INDEX IF EXISTS main.zuvy_learner_information_email_unique;
`),
    );

    await db.execute(
      sql.raw(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'main'
      AND table_name = 'zuvy_learner_information'
      AND column_name = 'full_name'
  ) THEN
    ALTER TABLE main.zuvy_learner_information ALTER COLUMN full_name DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'main'
      AND table_name = 'zuvy_learner_information'
      AND column_name = 'email'
  ) THEN
    ALTER TABLE main.zuvy_learner_information ALTER COLUMN email DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'main'
      AND table_name = 'zuvy_learner_information'
      AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE main.zuvy_learner_information ALTER COLUMN phone_number DROP NOT NULL;
  END IF;
END $$;
`),
    );
  }

  private async ensureLearnerInformationStorageReady(): Promise<void> {
    await db.execute(
      sql.raw(`
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'learner_year_of_study') THEN
		CREATE TYPE learner_year_of_study AS ENUM ('1st', '2nd', '3rd', '4th');
	END IF;
END $$;
`),
    );

    await db.execute(
      sql.raw(`
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'learner_current_status') THEN
		CREATE TYPE learner_current_status AS ENUM ('Learning', 'Looking for Job', 'Working');
	END IF;
END $$;
`),
    );

    await db.execute(
      sql.raw(`
CREATE TABLE IF NOT EXISTS main.zuvy_learner_information (
	id serial PRIMARY KEY,
	user_id bigint NOT NULL REFERENCES main.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  first_name varchar(100),
  last_name varchar(100),
  full_name varchar(255),
  email varchar(255),
  phone_number varchar(20),
  college_name varchar(255),
	other_college_name varchar(100),
	degree_program varchar(100),
  branch_specialisation varchar(100),
  year_of_study learner_year_of_study,
  expected_graduation_month integer,
  expected_graduation_year integer,
  current_status learner_current_status,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);
`),
    );

    await db.execute(
      sql.raw(`
ALTER TABLE main.zuvy_learner_information
ADD COLUMN IF NOT EXISTS first_name varchar(100);
`),
    );

    await db.execute(
      sql.raw(`
ALTER TABLE main.zuvy_learner_information
ADD COLUMN IF NOT EXISTS last_name varchar(100);
`),
    );

    await this.ensureLearnerInformationIndexes();
  }

  private async ensureLearnerEducationMasterDataStorageReady(): Promise<void> {
    await db.execute(
      sql.raw(`
CREATE TABLE IF NOT EXISTS main.zuvy_learner_education_details (
  id serial PRIMARY KEY,
  college_name varchar(255),
  degree_program varchar(100),
  branch_name varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`),
    );

    await db.execute(
      sql.raw(`
ALTER TABLE main.zuvy_learner_education_details
ADD COLUMN IF NOT EXISTS college_name varchar(255),
ADD COLUMN IF NOT EXISTS degree_program varchar(100),
ADD COLUMN IF NOT EXISTS branch_name varchar(100);
`),
    );

    await db.execute(
      sql.raw(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'main'
      AND table_name = 'zuvy_learner_education_details'
      AND column_name = 'degree_program'
      AND udt_name = '_varchar'
  ) THEN
    ALTER TABLE main.zuvy_learner_education_details
    ALTER COLUMN degree_program TYPE varchar(100)
    USING CASE
      WHEN degree_program IS NULL OR array_length(degree_program, 1) = 0 THEN NULL
      ELSE degree_program[1]
    END;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'main'
      AND table_name = 'zuvy_learner_education_details'
      AND column_name = 'branch_name'
      AND udt_name = '_varchar'
  ) THEN
    ALTER TABLE main.zuvy_learner_education_details
    ALTER COLUMN branch_name TYPE varchar(100)
    USING CASE
      WHEN branch_name IS NULL OR array_length(branch_name, 1) = 0 THEN NULL
      ELSE branch_name[1]
    END;
  END IF;
END $$;
`),
    );

    await db.execute(
      sql.raw(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'main'
      AND table_name = 'zuvy_learner_education_details'
      AND column_name = 'category'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'main'
      AND table_name = 'zuvy_learner_education_details'
      AND column_name = 'name'
  ) THEN
    UPDATE main.zuvy_learner_education_details
    SET college_name = name
    WHERE category = 'college' AND college_name IS NULL;

    UPDATE main.zuvy_learner_education_details
    SET degree_program = name
    WHERE category = 'programType' AND degree_program IS NULL;

    UPDATE main.zuvy_learner_education_details
    SET branch_name = name
    WHERE category = 'branch' AND branch_name IS NULL;
  END IF;
END $$;
`),
    );

    await db.execute(
      sql.raw(`
ALTER TABLE main.zuvy_learner_education_details
DROP COLUMN IF EXISTS category,
DROP COLUMN IF EXISTS name;
`),
    );

    await db.execute(
      sql.raw(`
DROP INDEX IF EXISTS main.zuvy_learner_education_details_category_name_unique;
DROP INDEX IF EXISTS main.zuvy_learner_education_details_college_name_unique;
DROP INDEX IF EXISTS main.zuvy_learner_education_details_degree_program_unique;
DROP INDEX IF EXISTS main.zuvy_learner_education_details_branch_name_unique;
DROP INDEX IF EXISTS main.zuvy_learner_education_details_row_unique;

CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learner_education_details_row_unique
ON main.zuvy_learner_education_details (college_name, degree_program, branch_name);
`),
    );
  }

  private async ensureTechnicalSkillsStorageReady(): Promise<void> {
    await db.execute(
      sql.raw(`
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS main.zuvy_learners_techinal_skills (
    id serial PRIMARY KEY,
    name varchar(100) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'main'
      AND table_name = 'zuvy_technical_skills'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'main'
      AND table_name = 'zuvy_technical_skills'
      AND column_name = 'name'
  ) THEN
    INSERT INTO main.zuvy_learners_techinal_skills (name)
    SELECT DISTINCT TRIM(CAST(name AS text))
    FROM main.zuvy_technical_skills
    WHERE name IS NOT NULL
      AND TRIM(CAST(name AS text)) <> ''
    ON CONFLICT DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'main'
      AND table_name = 'zuvy_learner_technical_skills'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'main'
      AND table_name = 'zuvy_learner_technical_skills'
      AND column_name = 'name'
  ) THEN
    INSERT INTO main.zuvy_learners_techinal_skills (name)
    SELECT DISTINCT TRIM(CAST(name AS text))
    FROM main.zuvy_learner_technical_skills
    WHERE name IS NOT NULL
      AND TRIM(CAST(name AS text)) <> ''
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
`),
    );

    await db.execute(
      sql.raw(`
UPDATE main.zuvy_learners_techinal_skills
SET name = TRIM(name)
WHERE name IS NOT NULL;

DELETE FROM main.zuvy_learners_techinal_skills
WHERE name IS NULL OR name = '';

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS row_num
  FROM main.zuvy_learners_techinal_skills
)
DELETE FROM main.zuvy_learners_techinal_skills current_row
USING ranked
WHERE current_row.id = ranked.id
  AND ranked.row_num > 1;
`),
    );

    await db.execute(
      sql.raw(`
DROP INDEX IF EXISTS main.zuvy_technical_skills_name_unique;
DROP INDEX IF EXISTS main.zuvy_learner_technical_skills_name_unique;
DROP INDEX IF EXISTS main.zuvy_learners_techinal_skills_name_unique;

CREATE UNIQUE INDEX zuvy_learners_techinal_skills_name_unique
ON main.zuvy_learners_techinal_skills (name);
`),
    );
  }

  private normalizeMasterDataEntries(
    values: string[],
    label: string,
  ): string[] {
    const normalized = values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    if (!normalized.length) {
      throw new BadRequestException(
        `${label} must contain at least one value.`,
      );
    }

    return normalized;
  }

  private normalizeTechnicalSkills(values: string[]): string[] {
    const normalizedSkills = values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    const uniqueSkills = Array.from(new Set(normalizedSkills));

    if (!uniqueSkills.length) {
      throw new BadRequestException('skills must contain at least one value.');
    }

    return uniqueSkills;
  }

  private async fetchTechnicalSkills() {
    const skills = await db
      .select({
        id: zuvyTechnicalSkillsTable.id,
        name: zuvyTechnicalSkillsTable.name,
      })
      .from(zuvyTechnicalSkillsTable)
      .orderBy(zuvyTechnicalSkillsTable.id);

    return { skills };
  }

  async getTechnicalSkills(retryOnMissingTable = true) {
    try {
      await this.ensureTechnicalSkillsStorageReady();

      const data = await this.fetchTechnicalSkills();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureTechnicalSkillsStorageReady();
        return this.getTechnicalSkills(false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Technical skills schema is out of sync. Please run migrations and retry.',
        );
      }

      throw error;
    }
  }

  async createTechnicalSkills(
    payload: UpsertTechnicalSkillsDto,
    retryOnMissingTable = true,
  ) {
    const skills = this.normalizeTechnicalSkills(payload.skills);

    try {
      await this.ensureTechnicalSkillsStorageReady();

      await db
        .insert(zuvyTechnicalSkillsTable)
        .values(skills.map((name) => ({ name })))
        .onConflictDoNothing({
          target: zuvyTechnicalSkillsTable.name,
        });

      const data = await this.fetchTechnicalSkills();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureTechnicalSkillsStorageReady();
        return this.createTechnicalSkills(payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Technical skills schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more technical skill values exceed allowed length.',
        );
      }

      throw error;
    }
  }

  async updateTechnicalSkillById(
    id: number,
    payload: UpdateTechnicalSkillByIdDto,
    retryOnMissingTable = true,
  ) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('Valid id is required for update.');
    }

    const normalizedName = payload.name?.trim();
    if (!normalizedName) {
      throw new BadRequestException('name is required.');
    }

    try {
      await this.ensureTechnicalSkillsStorageReady();

      const [updated] = await db
        .update(zuvyTechnicalSkillsTable)
        .set({
          name: normalizedName,
        })
        .where(eq(zuvyTechnicalSkillsTable.id, id))
        .returning({ id: zuvyTechnicalSkillsTable.id });

      if (!updated) {
        throw new NotFoundException(`Technical skill not found for id ${id}.`);
      }

      const data = await this.fetchTechnicalSkills();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureTechnicalSkillsStorageReady();
        return this.updateTechnicalSkillById(id, payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Technical skills schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '23505') {
        throw new ConflictException('Technical skill already exists.');
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more technical skill values exceed allowed length.',
        );
      }

      throw error;
    }
  }

  async deleteTechnicalSkillById(id: number, retryOnMissingTable = true) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('Valid id is required for delete.');
    }

    try {
      await this.ensureTechnicalSkillsStorageReady();

      const [deleted] = await db
        .delete(zuvyTechnicalSkillsTable)
        .where(eq(zuvyTechnicalSkillsTable.id, id))
        .returning({ id: zuvyTechnicalSkillsTable.id });

      if (!deleted) {
        throw new NotFoundException(`Technical skill not found for id ${id}.`);
      }

      const data = await this.fetchTechnicalSkills();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureTechnicalSkillsStorageReady();
        return this.deleteTechnicalSkillById(id, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Technical skills schema is out of sync. Please run migrations and retry.',
        );
      }

      throw error;
    }
  }

  private async ensureLearnerBoardsStorageReady(): Promise<void> {
    await db.execute(
      sql.raw(`
CREATE TABLE IF NOT EXISTS main.zuvy_learners_boards (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

UPDATE main.zuvy_learners_boards
SET name = TRIM(name)
WHERE name IS NOT NULL;

DELETE FROM main.zuvy_learners_boards
WHERE name IS NULL OR name = '';

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS row_num
  FROM main.zuvy_learners_boards
)
DELETE FROM main.zuvy_learners_boards current_row
USING ranked
WHERE current_row.id = ranked.id
  AND ranked.row_num > 1;

DROP INDEX IF EXISTS main.zuvy_learners_boards_name_unique;
CREATE UNIQUE INDEX zuvy_learners_boards_name_unique
ON main.zuvy_learners_boards (name);
`),
    );
  }

  private normalizeLearnerBoards(values: string[]): string[] {
    const normalizedBoards = values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    const uniqueBoards = Array.from(new Set(normalizedBoards));

    if (!uniqueBoards.length) {
      throw new BadRequestException('boards must contain at least one value.');
    }

    return uniqueBoards;
  }

  private async fetchLearnerBoards() {
    const boards = await db
      .select({
        id: zuvyLearnerBoardsTable.id,
        name: zuvyLearnerBoardsTable.name,
      })
      .from(zuvyLearnerBoardsTable)
      .orderBy(zuvyLearnerBoardsTable.id);

    return { boards };
  }

  async getLearnerBoards(retryOnMissingTable = true) {
    try {
      await this.ensureLearnerBoardsStorageReady();

      const data = await this.fetchLearnerBoards();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerBoardsStorageReady();
        return this.getLearnerBoards(false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner boards schema is out of sync. Please run migrations and retry.',
        );
      }

      throw error;
    }
  }

  async createLearnerBoards(
    payload: UpsertLearnerBoardsDto,
    retryOnMissingTable = true,
  ) {
    const boards = this.normalizeLearnerBoards(payload.boards);

    try {
      await this.ensureLearnerBoardsStorageReady();

      await db
        .insert(zuvyLearnerBoardsTable)
        .values(boards.map((name) => ({ name })))
        .onConflictDoNothing({
          target: zuvyLearnerBoardsTable.name,
        });

      const data = await this.fetchLearnerBoards();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerBoardsStorageReady();
        return this.createLearnerBoards(payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner boards schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more learner board values exceed allowed length.',
        );
      }

      throw error;
    }
  }

  async updateLearnerBoardById(
    id: number,
    payload: UpdateLearnerBoardByIdDto,
    retryOnMissingTable = true,
  ) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('Valid id is required for update.');
    }

    const normalizedName = payload.name?.trim();
    if (!normalizedName) {
      throw new BadRequestException('name is required.');
    }

    try {
      await this.ensureLearnerBoardsStorageReady();

      const [updated] = await db
        .update(zuvyLearnerBoardsTable)
        .set({
          name: normalizedName,
        })
        .where(eq(zuvyLearnerBoardsTable.id, id))
        .returning({ id: zuvyLearnerBoardsTable.id });

      if (!updated) {
        throw new NotFoundException(`Learner board not found for id ${id}.`);
      }

      const data = await this.fetchLearnerBoards();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerBoardsStorageReady();
        return this.updateLearnerBoardById(id, payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner boards schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '23505') {
        throw new ConflictException('Learner board already exists.');
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more learner board values exceed allowed length.',
        );
      }

      throw error;
    }
  }

  async deleteLearnerBoardById(id: number, retryOnMissingTable = true) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('Valid id is required for delete.');
    }

    try {
      await this.ensureLearnerBoardsStorageReady();

      const [deleted] = await db
        .delete(zuvyLearnerBoardsTable)
        .where(eq(zuvyLearnerBoardsTable.id, id))
        .returning({ id: zuvyLearnerBoardsTable.id });

      if (!deleted) {
        throw new NotFoundException(`Learner board not found for id ${id}.`);
      }

      const data = await this.fetchLearnerBoards();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerBoardsStorageReady();
        return this.deleteLearnerBoardById(id, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner boards schema is out of sync. Please run migrations and retry.',
        );
      }

      throw error;
    }
  }

  private validateFutureGraduationDate(month: number, year: number): void {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const isNotFuture =
      year < currentYear || (year === currentYear && month <= currentMonth);

    if (isNotFuture) {
      throw new BadRequestException(
        'Expected graduation date must be a future month/year.',
      );
    }
  }

  private validateOtherCollegeInput(
    collegeName?: string,
    otherCollegeName?: string,
  ): void {
    if (!collegeName?.trim()) {
      return;
    }

    const isOtherSelected = collegeName.trim().toLowerCase() === 'other';
    if (isOtherSelected && !otherCollegeName?.trim()) {
      throw new BadRequestException(
        'otherCollegeName is required when collegeName is Other.',
      );
    }
  }

  private async fetchEducationMasterDataGrouped() {
    const collegesData = await db
      .select({
        id: zuvyLearnerEducationMasterDataTable.id,
        name: zuvyLearnerEducationMasterDataTable.collegeName,
      })
      .from(zuvyLearnerEducationMasterDataTable)
      .where(isNotNull(zuvyLearnerEducationMasterDataTable.collegeName))
      .orderBy(zuvyLearnerEducationMasterDataTable.id);

    const programTypesData = await db
      .select({
        id: zuvyLearnerEducationMasterDataTable.id,
        name: zuvyLearnerEducationMasterDataTable.degreeProgram,
      })
      .from(zuvyLearnerEducationMasterDataTable)
      .where(isNotNull(zuvyLearnerEducationMasterDataTable.degreeProgram))
      .orderBy(zuvyLearnerEducationMasterDataTable.id);

    const branchesData = await db
      .select({
        id: zuvyLearnerEducationMasterDataTable.id,
        name: zuvyLearnerEducationMasterDataTable.branchName,
      })
      .from(zuvyLearnerEducationMasterDataTable)
      .where(isNotNull(zuvyLearnerEducationMasterDataTable.branchName))
      .orderBy(zuvyLearnerEducationMasterDataTable.id);

    return {
      colleges: collegesData,
      programTypes: programTypesData,
      branches: branchesData,
    };
  }

  async getEducationMasterData(retryOnMissingTable = true) {
    try {
      await this.ensureLearnerEducationMasterDataStorageReady();

      const groupedData = await this.fetchEducationMasterDataGrouped();

      return {
        success: true,
        data: groupedData,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerEducationMasterDataStorageReady();
        return this.getEducationMasterData(false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner education master data schema is out of sync. Please run migrations and retry.',
        );
      }

      throw error;
    }
  }

  async getAllBasicInformation(
    page = 1,
    limit = 10,
    retryOnMissingTable = true,
  ) {
    const offset = (page - 1) * limit;

    try {
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(zuvyLearnerInformation);

      const total = Number(totalResult?.count || 0);

      const learners = await db
        .select()
        .from(zuvyLearnerInformation)
        .orderBy(desc(zuvyLearnerInformation.updatedAt))
        .limit(limit)
        .offset(offset);

      return {
        status: 'success',
        message: 'Learner information fetched successfully.',
        data: learners,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerInformationStorageReady();
        return this.getAllBasicInformation(page, limit, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner information schema is out of sync. Please run migrations and retry.',
        );
      }

      throw error;
    }
  }

  async createBasicInformation(
    userId: number,
    payload: UpsertLearnerInformationDto,
    retryOnMissingTable = true,
  ) {
    if (!userId || Number.isNaN(userId)) {
      throw new BadRequestException('Invalid authenticated user details.');
    }

    this.validateOtherCollegeInput(
      payload.collegeName,
      payload.otherCollegeName,
    );

    const normalizedCollegeName = payload.collegeName?.trim();
    const isOtherCollege = normalizedCollegeName?.toLowerCase() === 'other';

    const dataToPersist = {
      collegeName: normalizedCollegeName || null,
      otherCollegeName: isOtherCollege
        ? payload.otherCollegeName?.trim() || null
        : null,
      degreeProgram: payload.degreeProgram?.trim() || null,
      branchSpecialisation: payload.branchSpecialisation?.trim() || null,
    };

    try {
      await this.ensureLearnerInformationIndexes();

      const [created] = await db
        .insert(zuvyLearnerInformation)
        .values({
          userId: sql`${userId}::bigint`,
          ...dataToPersist,
        })
        .returning();

      return {
        status: 'success',
        message: 'Learner information saved successfully.',
        data: created,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerInformationStorageReady();
        return this.createBasicInformation(userId, payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner information schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '23505') {
        const violatedConstraint = String(
          error?.constraint || '',
        ).toLowerCase();

        if (violatedConstraint.includes('user_id')) {
          throw new ConflictException(
            'Duplicate learner record blocked by user_id unique constraint. Please run migrations and retry.',
          );
        }

        throw new ConflictException('Duplicate learner information detected.');
      }

      if (error?.code === '23503') {
        throw new BadRequestException(
          'Invalid user reference for learner record.',
        );
      }

      if (error?.code === '22P02') {
        throw new BadRequestException(
          'Invalid data format in learner payload.',
        );
      }

      throw error;
    }
  }

  async createEducationMasterData(
    payload: UpsertLearnerEducationMasterDataDto,
    retryOnMissingTable = true,
  ) {
    const colleges = this.normalizeMasterDataEntries(
      payload.colleges,
      'colleges',
    );
    const programTypes = this.normalizeMasterDataEntries(
      payload.programTypes,
      'programTypes',
    );
    const branches = this.normalizeMasterDataEntries(
      payload.branches,
      'branches',
    );

    const totalRows = Math.max(
      colleges.length,
      programTypes.length,
      branches.length,
    );

    const pickValue = (values: string[], index: number): string | null =>
      values[index] ?? null;

    const rowValues = Array.from({ length: totalRows }, (_, index) => ({
      collegeName: pickValue(colleges, index),
      degreeProgram: pickValue(programTypes, index),
      branchName: pickValue(branches, index),
      updatedAt: sql`now()`,
    }));

    try {
      await this.ensureLearnerEducationMasterDataStorageReady();

      await db.transaction(async (tx) => {
        await tx.delete(zuvyLearnerEducationMasterDataTable);
        await tx.insert(zuvyLearnerEducationMasterDataTable).values(rowValues);
      });

      const groupedData = await this.fetchEducationMasterDataGrouped();

      return {
        success: true,
        data: groupedData,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerEducationMasterDataStorageReady();
        return this.createEducationMasterData(payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner education master data schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more education master data values exceed allowed length.',
        );
      }

      throw error;
    }
  }

  async updateEducationMasterDataById(
    id: number,
    payload: UpdateLearnerEducationMasterDataByIdDto,
    retryOnMissingTable = true,
  ) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('Valid id is required for update.');
    }

    const hasAnyField =
      payload.collegeName !== undefined ||
      payload.degreeProgram !== undefined ||
      payload.branchName !== undefined;

    if (!hasAnyField) {
      throw new BadRequestException(
        'At least one of collegeName, degreeProgram, or branchName is required.',
      );
    }

    const updatePayload = {
      ...(payload.collegeName !== undefined
        ? { collegeName: payload.collegeName?.trim() || null }
        : {}),
      ...(payload.degreeProgram !== undefined
        ? { degreeProgram: payload.degreeProgram?.trim() || null }
        : {}),
      ...(payload.branchName !== undefined
        ? { branchName: payload.branchName?.trim() || null }
        : {}),
      updatedAt: sql`now()`,
    };

    try {
      await this.ensureLearnerEducationMasterDataStorageReady();

      const [updated] = await db
        .update(zuvyLearnerEducationMasterDataTable)
        .set(updatePayload)
        .where(eq(zuvyLearnerEducationMasterDataTable.id, id))
        .returning({ id: zuvyLearnerEducationMasterDataTable.id });

      if (!updated) {
        throw new NotFoundException(
          `Learner education master data not found for id ${id}.`,
        );
      }

      const groupedData = await this.fetchEducationMasterDataGrouped();

      return {
        success: true,
        data: groupedData,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerEducationMasterDataStorageReady();
        return this.updateEducationMasterDataById(id, payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner education master data schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more education master data values exceed allowed length.',
        );
      }

      throw error;
    }
  }
}
