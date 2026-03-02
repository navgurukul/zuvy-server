import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import {
  zuvyLearnerInformation,
  zuvyLearnerPersonalDetails,
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import {
  UpsertLearnerInformationDto,
  UpsertLearnerPersonalDetailsDto,
} from './dto/learner.dto';

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

  private async ensureLearnerPersonalDetailsStorageReady(): Promise<void> {
    await db.execute(
      sql.raw(`
CREATE TABLE IF NOT EXISTS main.zuvy_learner_personal_details (
  id serial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES main.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  full_name varchar(255) NOT NULL,
  phone_number varchar(20) NOT NULL,
  email varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`),
    );

    await db.execute(
      sql.raw(`
DROP INDEX IF EXISTS main.zuvy_learner_personal_details_user_id_unique;
`),
    );
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

    if (
      payload.expectedGraduationMonth != null &&
      payload.expectedGraduationYear != null
    ) {
      this.validateFutureGraduationDate(
        payload.expectedGraduationMonth,
        payload.expectedGraduationYear,
      );
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
      yearOfStudy: payload.yearOfStudy ?? null,
      expectedGraduationMonth: payload.expectedGraduationMonth ?? null,
      expectedGraduationYear: payload.expectedGraduationYear ?? null,
      currentStatus: payload.currentStatus ?? null,
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

  async createPersonalDetails(
    userId: number,
    payload: UpsertLearnerPersonalDetailsDto,
    retryOnMissingTable = true,
  ) {
    if (!userId || Number.isNaN(userId)) {
      throw new BadRequestException('Invalid authenticated user details.');
    }

    const requestEmail = payload.email?.trim().toLowerCase();

    if (!requestEmail) {
      throw new BadRequestException('Email is required.');
    }

    const normalizedPayload = {
      fullName: payload.fullName.trim(),
      email: requestEmail,
      phoneNumber: payload.phoneNumber.trim(),
    };

    try {
      await this.ensureLearnerPersonalDetailsStorageReady();

      const [existingLearnerByEmail] = await db
        .select({ id: zuvyLearnerPersonalDetails.id })
        .from(zuvyLearnerPersonalDetails)
        .where(eq(zuvyLearnerPersonalDetails.email, normalizedPayload.email))
        .limit(1);

      if (existingLearnerByEmail) {
        throw new ConflictException('User already exists in database.');
      }

      const [saved] = await db
        .insert(zuvyLearnerPersonalDetails)
        .values({
          userId: sql`${userId}::bigint`,
          ...normalizedPayload,
        })
        .returning();

      return {
        status: 'success',
        message: 'Learner personal details saved successfully.',
        data: saved,
      };
    } catch (error) {
      if (this.isLearnerSchemaMissingError(error) && retryOnMissingTable) {
        await this.ensureLearnerPersonalDetailsStorageReady();
        return this.createPersonalDetails(userId, payload, false);
      }

      if (this.isLearnerSchemaMissingError(error)) {
        throw new InternalServerErrorException(
          'Learner personal details schema is out of sync. Please run migrations and retry.',
        );
      }

      if (error?.code === '23503') {
        throw new BadRequestException(
          'Invalid user reference for learner personal details.',
        );
      }

      if (error?.code === '22001') {
        throw new BadRequestException(
          'One or more personal detail fields exceed allowed length.',
        );
      }

      if (error?.code === '22P02') {
        throw new BadRequestException(
          'Invalid data format in learner personal details payload.',
        );
      }

      if (error?.code === '23505') {
        throw new ConflictException(
          'Duplicate constraint violation while saving learner personal details.',
        );
      }

      throw error;
    }
  }
}
