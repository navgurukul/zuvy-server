import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { users, zuvyLearnerInformation } from '../../../drizzle/schema';
import { db } from '../../db/index';
import { UpsertLearnerInformationDto } from './dto/learner.dto';

@Injectable()
export class LearnerService {
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
CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learner_information_user_id_unique
	ON main.zuvy_learner_information(user_id);
`),
    );

    await db.execute(
      sql.raw(`
CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learner_information_email_unique
	ON main.zuvy_learner_information(email);
`),
    );
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

  async getBasicInformation(userId: number, retryOnMissingTable = true) {
    if (!userId || Number.isNaN(userId)) {
      throw new BadRequestException('Invalid authenticated user id.');
    }

    try {
      const [user] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      const [existing] = await db
        .select()
        .from(zuvyLearnerInformation)
        .where(eq(zuvyLearnerInformation.userId, userId));

      if (existing) {
        return {
          status: 'success',
          message: 'Learner information fetched successfully.',
          data: existing,
        };
      }

      return {
        status: 'success',
        message: 'No learner information found. Returning prefilled defaults.',
        data: {
          fullName: user.name,
          email: user.email,
        },
      };
    } catch (error) {
      if (error?.code === '42P01' && retryOnMissingTable) {
        await this.ensureLearnerInformationStorageReady();
        return this.getBasicInformation(userId, false);
      }
      throw error;
    }
  }

  async upsertBasicInformation(
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
      userId,
      fullName: payload.fullName.trim(),
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
      updatedAt: new Date().toISOString(),
    };

    try {
      const [existing] = await db
        .select({ id: zuvyLearnerInformation.id })
        .from(zuvyLearnerInformation)
        .where(eq(zuvyLearnerInformation.userId, userId));

      if (existing) {
        const [updated] = await db
          .update(zuvyLearnerInformation)
          .set(dataToPersist)
          .where(
            and(
              eq(zuvyLearnerInformation.userId, userId),
              eq(zuvyLearnerInformation.id, existing.id),
            ),
          )
          .returning();

        return {
          status: 'success',
          message: 'Learner information updated successfully.',
          data: updated,
        };
      }

      const [created] = await db
        .insert(zuvyLearnerInformation)
        .values({
          ...dataToPersist,
          createdAt: new Date().toISOString(),
        })
        .returning();

      return {
        status: 'success',
        message: 'Learner information saved successfully.',
        data: created,
      };
    } catch (error) {
      if (error?.code === '42P01' && retryOnMissingTable) {
        await this.ensureLearnerInformationStorageReady();
        return this.upsertBasicInformation(userId, userEmail, payload, false);
      }

      if (error?.code === '42P01') {
        throw new InternalServerErrorException(
          'Learner information table is missing in DB and auto-creation failed. Please run migrations.',
        );
      }
      throw error;
    }
  }
}
