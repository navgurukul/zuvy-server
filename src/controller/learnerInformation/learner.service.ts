/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { pgSchema, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { zuvyLearnerInformation } from '../../../drizzle/schema';
import { db } from '../../db/index';
import {
  UpdateLearnerBoardByIdDto,
  UpdateLearnerEducationBranchByIdDto,
  UpdateLearnerDegreeByIdDto,
  UpdateLearnerRemoteLocationByIdDto,
  UpdateLearnerRoleByIdDto,
  UpdateTechnicalSkillByIdDto,
  UpsertLearnerBoardsDto,
  UpsertLearnerEducationBranchesDto,
  UpsertLearnerDegreesDto,
  UpsertLearnerRemoteLocationsDto,
  UpsertLearnerRolesDto,
  UpsertTechnicalSkillsDto,
  UpsertLearnerInformationDto,
} from './dto/learner.dto';

const learnerMainSchema = pgSchema('main');

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
const zuvyLearnerDegreesTable = learnerMainSchema.table(
  'zuvy_learners_degree_details',
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

const zuvyLearnerEducationBranchesTable = learnerMainSchema.table(
  'zuvy_learner_education_branch_details',
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

const zuvyLearnerRolesTable = learnerMainSchema.table('zuvy_learnes_roles', {
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

const zuvyLearnerRemoteLocationTable = learnerMainSchema.table(
  'zuvy_learners_remote_location',
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
      .orderBy(
        sql`LOWER(${zuvyTechnicalSkillsTable.name})`,
        zuvyTechnicalSkillsTable.id,
      );

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

  private async ensureLearnerDegreesStorageReady(): Promise<void> {
    await db.execute(
      sql.raw(`
CREATE TABLE IF NOT EXISTS main.zuvy_learners_degree_details (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

UPDATE main.zuvy_learners_degree_details
SET name = TRIM(name)
WHERE name IS NOT NULL;

DELETE FROM main.zuvy_learners_degree_details
WHERE name IS NULL OR name = '';

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS row_num
  FROM main.zuvy_learners_degree_details
)
DELETE FROM main.zuvy_learners_degree_details current_row
USING ranked
WHERE current_row.id = ranked.id
  AND ranked.row_num > 1;

DROP INDEX IF EXISTS main.zuvy_learners_degree_details_name_unique;
CREATE UNIQUE INDEX zuvy_learners_degree_details_name_unique
ON main.zuvy_learners_degree_details (name);
`),
    );
  }

  private normalizeLearnerDegrees(values: string[]): string[] {
    const normalizedDegrees = values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    const uniqueDegrees = Array.from(new Set(normalizedDegrees));

    if (!uniqueDegrees.length) {
      throw new BadRequestException('degrees must contain at least one value.');
    }

    return uniqueDegrees;
  }

  private async fetchLearnerDegrees() {
    const degrees = await db
      .select({
        id: zuvyLearnerDegreesTable.id,
        name: zuvyLearnerDegreesTable.name,
      })
      .from(zuvyLearnerDegreesTable)
      .orderBy(
        sql`LOWER(${zuvyLearnerDegreesTable.name})`,
        zuvyLearnerDegreesTable.id,
      );

    return { degrees };
  }

  async getLearnerDegrees(retryOnMissingTable = true) {
    try {
      await this.ensureLearnerDegreesStorageReady();

      const data = await this.fetchLearnerDegrees();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerDegreesStorageReady();
        return this.getLearnerDegrees(false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner degrees schema is out of sync. Please run migrations and retry.',
        );
      }

      throw error;
    }
  }

  async createLearnerDegrees(
    payload: UpsertLearnerDegreesDto,
    retryOnMissingTable = true,
  ) {
    const degrees = this.normalizeLearnerDegrees(payload.degrees);

    try {
      await this.ensureLearnerDegreesStorageReady();

      await db
        .insert(zuvyLearnerDegreesTable)
        .values(degrees.map((name) => ({ name })))
        .onConflictDoNothing({
          target: zuvyLearnerDegreesTable.name,
        });

      const data = await this.fetchLearnerDegrees();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerDegreesStorageReady();
        return this.createLearnerDegrees(payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner degrees schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more learner degree values exceed allowed length.',
        );
      }

      throw error;
    }
  }

  async updateLearnerDegreeById(
    id: number,
    payload: UpdateLearnerDegreeByIdDto,
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
      await this.ensureLearnerDegreesStorageReady();

      const [updated] = await db
        .update(zuvyLearnerDegreesTable)
        .set({
          name: normalizedName,
        })
        .where(eq(zuvyLearnerDegreesTable.id, id))
        .returning({ id: zuvyLearnerDegreesTable.id });

      if (!updated) {
        throw new NotFoundException(`Learner degree not found for id ${id}.`);
      }

      const data = await this.fetchLearnerDegrees();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerDegreesStorageReady();
        return this.updateLearnerDegreeById(id, payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner degrees schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '23505') {
        throw new ConflictException('Learner degree already exists.');
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more learner degree values exceed allowed length.',
        );
      }

      throw error;
    }
  }

  async deleteLearnerDegreeById(id: number, retryOnMissingTable = true) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('Valid id is required for delete.');
    }

    try {
      await this.ensureLearnerDegreesStorageReady();

      const [deleted] = await db
        .delete(zuvyLearnerDegreesTable)
        .where(eq(zuvyLearnerDegreesTable.id, id))
        .returning({ id: zuvyLearnerDegreesTable.id });

      if (!deleted) {
        throw new NotFoundException(`Learner degree not found for id ${id}.`);
      }

      const data = await this.fetchLearnerDegrees();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerDegreesStorageReady();
        return this.deleteLearnerDegreeById(id, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner degrees schema is out of sync. Please run migrations and retry.',
        );
      }

      throw error;
    }
  }

  private async ensureLearnerEducationBranchesStorageReady(): Promise<void> {
    await db.execute(
      sql.raw(`
CREATE TABLE IF NOT EXISTS main.zuvy_learner_education_branch_details (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

UPDATE main.zuvy_learner_education_branch_details
SET name = TRIM(name)
WHERE name IS NOT NULL;

DELETE FROM main.zuvy_learner_education_branch_details
WHERE name IS NULL OR name = '';

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS row_num
  FROM main.zuvy_learner_education_branch_details
)
DELETE FROM main.zuvy_learner_education_branch_details current_row
USING ranked
WHERE current_row.id = ranked.id
  AND ranked.row_num > 1;

DROP INDEX IF EXISTS main.zuvy_learner_education_branch_details_name_unique;
CREATE UNIQUE INDEX zuvy_learner_education_branch_details_name_unique
ON main.zuvy_learner_education_branch_details (name);
`),
    );
  }

  private normalizeLearnerEducationBranches(values: string[]): string[] {
    const normalizedBranches = values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    const uniqueBranches = Array.from(new Set(normalizedBranches));

    if (!uniqueBranches.length) {
      throw new BadRequestException(
        'branches must contain at least one value.',
      );
    }

    return uniqueBranches;
  }

  private async fetchLearnerEducationBranches() {
    const branches = await db
      .select({
        id: zuvyLearnerEducationBranchesTable.id,
        name: zuvyLearnerEducationBranchesTable.name,
      })
      .from(zuvyLearnerEducationBranchesTable)
      .orderBy(
        sql`LOWER(${zuvyLearnerEducationBranchesTable.name})`,
        zuvyLearnerEducationBranchesTable.id,
      );

    return { branches };
  }

  async getLearnerEducationBranches(retryOnMissingTable = true) {
    try {
      await this.ensureLearnerEducationBranchesStorageReady();

      const data = await this.fetchLearnerEducationBranches();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerEducationBranchesStorageReady();
        return this.getLearnerEducationBranches(false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner education branches schema is out of sync. Please run migrations and retry.',
        );
      }

      throw error;
    }
  }

  async createLearnerEducationBranches(
    payload: UpsertLearnerEducationBranchesDto,
    retryOnMissingTable = true,
  ) {
    const branches = this.normalizeLearnerEducationBranches(payload.branches);

    try {
      await this.ensureLearnerEducationBranchesStorageReady();

      await db
        .insert(zuvyLearnerEducationBranchesTable)
        .values(branches.map((name) => ({ name })))
        .onConflictDoNothing({
          target: zuvyLearnerEducationBranchesTable.name,
        });

      const data = await this.fetchLearnerEducationBranches();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerEducationBranchesStorageReady();
        return this.createLearnerEducationBranches(payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner education branches schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more learner education branch values exceed allowed length.',
        );
      }

      throw error;
    }
  }

  async updateLearnerEducationBranchById(
    id: number,
    payload: UpdateLearnerEducationBranchByIdDto,
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
      await this.ensureLearnerEducationBranchesStorageReady();

      const [updated] = await db
        .update(zuvyLearnerEducationBranchesTable)
        .set({
          name: normalizedName,
        })
        .where(eq(zuvyLearnerEducationBranchesTable.id, id))
        .returning({ id: zuvyLearnerEducationBranchesTable.id });

      if (!updated) {
        throw new NotFoundException(
          `Learner education branch not found for id ${id}.`,
        );
      }

      const data = await this.fetchLearnerEducationBranches();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerEducationBranchesStorageReady();
        return this.updateLearnerEducationBranchById(id, payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner education branches schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '23505') {
        throw new ConflictException('Learner education branch already exists.');
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more learner education branch values exceed allowed length.',
        );
      }

      throw error;
    }
  }

  async deleteLearnerEducationBranchById(
    id: number,
    retryOnMissingTable = true,
  ) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('Valid id is required for delete.');
    }

    try {
      await this.ensureLearnerEducationBranchesStorageReady();

      const [deleted] = await db
        .delete(zuvyLearnerEducationBranchesTable)
        .where(eq(zuvyLearnerEducationBranchesTable.id, id))
        .returning({ id: zuvyLearnerEducationBranchesTable.id });

      if (!deleted) {
        throw new NotFoundException(
          `Learner education branch not found for id ${id}.`,
        );
      }

      const data = await this.fetchLearnerEducationBranches();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerEducationBranchesStorageReady();
        return this.deleteLearnerEducationBranchById(id, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner education branches schema is out of sync. Please run migrations and retry.',
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
      .orderBy(
        sql`LOWER(${zuvyLearnerBoardsTable.name})`,
        zuvyLearnerBoardsTable.id,
      );

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

  private async ensureLearnerRolesStorageReady(): Promise<void> {
    await db.execute(
      sql.raw(`
CREATE TABLE IF NOT EXISTS main.zuvy_learnes_roles (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

UPDATE main.zuvy_learnes_roles
SET name = TRIM(name)
WHERE name IS NOT NULL;

DELETE FROM main.zuvy_learnes_roles
WHERE name IS NULL OR name = '';

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS row_num
  FROM main.zuvy_learnes_roles
)
DELETE FROM main.zuvy_learnes_roles current_row
USING ranked
WHERE current_row.id = ranked.id
  AND ranked.row_num > 1;

DROP INDEX IF EXISTS main.zuvy_learnes_roles_name_unique;
CREATE UNIQUE INDEX zuvy_learnes_roles_name_unique
ON main.zuvy_learnes_roles (name);
`),
    );
  }

  private normalizeLearnerRoles(values: string[]): string[] {
    const normalizedRoles = values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    const uniqueRoles = Array.from(new Set(normalizedRoles));

    if (!uniqueRoles.length) {
      throw new BadRequestException('roles must contain at least one value.');
    }

    return uniqueRoles;
  }

  private async fetchLearnerRoles() {
    const roles = await db
      .select({
        id: zuvyLearnerRolesTable.id,
        name: zuvyLearnerRolesTable.name,
      })
      .from(zuvyLearnerRolesTable)
      .orderBy(
        sql`LOWER(${zuvyLearnerRolesTable.name})`,
        zuvyLearnerRolesTable.id,
      );

    return { roles };
  }

  async getLearnerRoles(retryOnMissingTable = true) {
    try {
      await this.ensureLearnerRolesStorageReady();

      const data = await this.fetchLearnerRoles();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerRolesStorageReady();
        return this.getLearnerRoles(false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner roles schema is out of sync. Please run migrations and retry.',
        );
      }

      throw error;
    }
  }

  async createLearnerRoles(
    payload: UpsertLearnerRolesDto,
    retryOnMissingTable = true,
  ) {
    const roles = this.normalizeLearnerRoles(payload.roles);

    try {
      await this.ensureLearnerRolesStorageReady();

      await db
        .insert(zuvyLearnerRolesTable)
        .values(roles.map((name) => ({ name })))
        .onConflictDoNothing({
          target: zuvyLearnerRolesTable.name,
        });

      const data = await this.fetchLearnerRoles();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerRolesStorageReady();
        return this.createLearnerRoles(payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner roles schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more learner role values exceed allowed length.',
        );
      }

      throw error;
    }
  }

  async updateLearnerRoleById(
    id: number,
    payload: UpdateLearnerRoleByIdDto,
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
      await this.ensureLearnerRolesStorageReady();

      const [updated] = await db
        .update(zuvyLearnerRolesTable)
        .set({
          name: normalizedName,
        })
        .where(eq(zuvyLearnerRolesTable.id, id))
        .returning({ id: zuvyLearnerRolesTable.id });

      if (!updated) {
        throw new NotFoundException(`Learner role not found for id ${id}.`);
      }

      const data = await this.fetchLearnerRoles();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerRolesStorageReady();
        return this.updateLearnerRoleById(id, payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner roles schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '23505') {
        throw new ConflictException('Learner role already exists.');
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more learner role values exceed allowed length.',
        );
      }

      throw error;
    }
  }

  async deleteLearnerRoleById(id: number, retryOnMissingTable = true) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('Valid id is required for delete.');
    }

    try {
      await this.ensureLearnerRolesStorageReady();

      const [deleted] = await db
        .delete(zuvyLearnerRolesTable)
        .where(eq(zuvyLearnerRolesTable.id, id))
        .returning({ id: zuvyLearnerRolesTable.id });

      if (!deleted) {
        throw new NotFoundException(`Learner role not found for id ${id}.`);
      }

      const data = await this.fetchLearnerRoles();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerRolesStorageReady();
        return this.deleteLearnerRoleById(id, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner roles schema is out of sync. Please run migrations and retry.',
        );
      }

      throw error;
    }
  }

  private async ensureLearnerRemoteLocationsStorageReady(): Promise<void> {
    await db.execute(
      sql.raw(`
CREATE TABLE IF NOT EXISTS main.zuvy_learners_remote_location (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

UPDATE main.zuvy_learners_remote_location
SET name = TRIM(name)
WHERE name IS NOT NULL;

DELETE FROM main.zuvy_learners_remote_location
WHERE name IS NULL OR name = '';

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS row_num
  FROM main.zuvy_learners_remote_location
)
DELETE FROM main.zuvy_learners_remote_location current_row
USING ranked
WHERE current_row.id = ranked.id
  AND ranked.row_num > 1;

DROP INDEX IF EXISTS main.zuvy_learners_remote_location_name_unique;
CREATE UNIQUE INDEX zuvy_learners_remote_location_name_unique
ON main.zuvy_learners_remote_location (name);
`),
    );
  }

  private normalizeLearnerRemoteLocations(values: string[]): string[] {
    const normalizedLocations = values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    const uniqueLocations = Array.from(new Set(normalizedLocations));

    if (!uniqueLocations.length) {
      throw new BadRequestException(
        'remoteLocations must contain at least one value.',
      );
    }

    return uniqueLocations;
  }

  private async fetchLearnerRemoteLocations() {
    const remoteLocations = await db
      .select({
        id: zuvyLearnerRemoteLocationTable.id,
        name: zuvyLearnerRemoteLocationTable.name,
      })
      .from(zuvyLearnerRemoteLocationTable)
      .orderBy(
        sql`LOWER(${zuvyLearnerRemoteLocationTable.name})`,
        zuvyLearnerRemoteLocationTable.id,
      );

    return { remoteLocations };
  }

  async getLearnerRemoteLocations(retryOnMissingTable = true) {
    try {
      await this.ensureLearnerRemoteLocationsStorageReady();

      const data = await this.fetchLearnerRemoteLocations();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerRemoteLocationsStorageReady();
        return this.getLearnerRemoteLocations(false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner remote locations schema is out of sync. Please run migrations and retry.',
        );
      }

      throw error;
    }
  }

  async createLearnerRemoteLocations(
    payload: UpsertLearnerRemoteLocationsDto,
    retryOnMissingTable = true,
  ) {
    const remoteLocations = this.normalizeLearnerRemoteLocations(
      payload.remoteLocations,
    );

    try {
      await this.ensureLearnerRemoteLocationsStorageReady();

      await db
        .insert(zuvyLearnerRemoteLocationTable)
        .values(remoteLocations.map((name) => ({ name })))
        .onConflictDoNothing({
          target: zuvyLearnerRemoteLocationTable.name,
        });

      const data = await this.fetchLearnerRemoteLocations();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerRemoteLocationsStorageReady();
        return this.createLearnerRemoteLocations(payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner remote locations schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more learner remote location values exceed allowed length.',
        );
      }

      throw error;
    }
  }

  async updateLearnerRemoteLocationById(
    id: number,
    payload: UpdateLearnerRemoteLocationByIdDto,
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
      await this.ensureLearnerRemoteLocationsStorageReady();

      const [updated] = await db
        .update(zuvyLearnerRemoteLocationTable)
        .set({
          name: normalizedName,
        })
        .where(eq(zuvyLearnerRemoteLocationTable.id, id))
        .returning({ id: zuvyLearnerRemoteLocationTable.id });

      if (!updated) {
        throw new NotFoundException(
          `Learner remote location not found for id ${id}.`,
        );
      }

      const data = await this.fetchLearnerRemoteLocations();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerRemoteLocationsStorageReady();
        return this.updateLearnerRemoteLocationById(id, payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner remote locations schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '23505') {
        throw new ConflictException('Learner remote location already exists.');
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more learner remote location values exceed allowed length.',
        );
      }

      throw error;
    }
  }

  async deleteLearnerRemoteLocationById(
    id: number,
    retryOnMissingTable = true,
  ) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('Valid id is required for delete.');
    }

    try {
      await this.ensureLearnerRemoteLocationsStorageReady();

      const [deleted] = await db
        .delete(zuvyLearnerRemoteLocationTable)
        .where(eq(zuvyLearnerRemoteLocationTable.id, id))
        .returning({ id: zuvyLearnerRemoteLocationTable.id });

      if (!deleted) {
        throw new NotFoundException(
          `Learner remote location not found for id ${id}.`,
        );
      }

      const data = await this.fetchLearnerRemoteLocations();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerRemoteLocationsStorageReady();
        return this.deleteLearnerRemoteLocationById(id, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner remote locations schema is out of sync. Please run migrations and retry.',
        );
      }

      throw error;
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
}
