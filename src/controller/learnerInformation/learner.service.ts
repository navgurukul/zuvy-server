import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { desc, isNotNull, sql } from 'drizzle-orm';
import { pgSchema, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { zuvyLearnerInformation } from '../../../drizzle/schema';
import { db } from '../../db/index';
import {
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
}
