import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { desc, sql } from 'drizzle-orm';
import { zuvyLearnerInformation } from '../../../drizzle/schema';
import { db } from '../../db/index';
import { UpsertLearnerInformationDto } from './dto/learner.dto';

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
CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learner_information_email_unique
	ON main.zuvy_learner_information(email);
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
	full_name varchar(255) NOT NULL,
	email varchar(255) NOT NULL,
	phone_number varchar(20) NOT NULL,
	college_name varchar(255) NOT NULL,
	other_college_name varchar(100),
	degree_program varchar(100),
	branch_specialisation varchar(100) NOT NULL,
	year_of_study learner_year_of_study NOT NULL,
	expected_graduation_month integer NOT NULL,
	expected_graduation_year integer NOT NULL,
	current_status learner_current_status NOT NULL,
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

  private normalizePhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/[\s-]/g, '');
    return cleaned.startsWith('+91') ? cleaned.slice(3) : cleaned;
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
    collegeName: string,
    otherCollegeName?: string,
  ): void {
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
    userEmail: string,
    payload: UpsertLearnerInformationDto,
    retryOnMissingTable = true,
  ) {
    if (!userId || Number.isNaN(userId) || !userEmail) {
      throw new BadRequestException('Invalid authenticated user details.');
    }

    this.validateFutureGraduationDate(
      payload.expectedGraduationMonth,
      payload.expectedGraduationYear,
    );

    this.validateOtherCollegeInput(
      payload.collegeName,
      payload.otherCollegeName,
    );

    const normalizedPhoneNumber = this.normalizePhoneNumber(
      payload.phoneNumber,
    );

    const dataToPersist = {
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      fullName: `${payload.firstName.trim()} ${payload.lastName.trim()}`,
      email: payload.email?.trim().toLowerCase() || userEmail,
      phoneNumber: normalizedPhoneNumber,
      collegeName: payload.collegeName.trim(),
      otherCollegeName:
        payload.collegeName.trim().toLowerCase() === 'other'
          ? payload.otherCollegeName?.trim() || null
          : null,
      degreeProgram: payload.degreeProgram?.trim() || null,
      branchSpecialisation: payload.branchSpecialisation.trim(),
      yearOfStudy: payload.yearOfStudy,
      expectedGraduationMonth: payload.expectedGraduationMonth,
      expectedGraduationYear: payload.expectedGraduationYear,
      currentStatus: payload.currentStatus,
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
        return this.createBasicInformation(userId, userEmail, payload, false);
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

        if (violatedConstraint.includes('email')) {
          throw new ConflictException(
            'Learner information with this email already exists.',
          );
        }

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
