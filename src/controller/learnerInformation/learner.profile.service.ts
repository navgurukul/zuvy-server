import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import {
  pgSchema,
  serial,
  timestamp,
  varchar,
  integer,
  boolean,
  jsonb,
  bigint,
} from 'drizzle-orm/pg-core';
import { db } from '../../db/index';
import { SaveCompleteProfileDto } from './dto/learner.dto';

const learnerMainSchema = pgSchema('main');

const zuvyLearnersCompleteProfileTable = learnerMainSchema.table(
  'zuvy_learners_complete_profile',
  {
    id: serial('id').primaryKey().notNull(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),

    // PAGE 1: BASICS
    fullName: varchar('full_name', { length: 255 }),
    phoneNumber: varchar('phone_number', { length: 20 }),
    email: varchar('email', { length: 255 }),
    linkedinProfile: varchar('linkedin_profile', { length: 500 }),
    collegeName: varchar('college_name', { length: 255 }),
    otherCollegeName: varchar('other_college_name', { length: 100 }),
    degree: varchar('degree', { length: 100 }),
    branch: varchar('branch', { length: 100 }),
    yearOfStudy: varchar('year_of_study', { length: 10 }),
    graduationMonth: integer('graduation_month'),
    graduationYear: integer('graduation_year'),
    currentStatus: varchar('current_status', { length: 50 }),

    // PAGE 2: SKILLS & PROJECTS
    technicalSkills: jsonb('technical_skills').default([]),
    projects: jsonb('projects').default([]),

    // PAGE 3: EDUCATION & EXPERIENCE
    collegeStream: varchar('college_stream', { length: 100 }),
    collegeScore: varchar('college_score', { length: 20 }),
    collegeScoreType: varchar('college_score_type', { length: 10 }),
    class12Board: varchar('class12_board', { length: 100 }),
    class12Score: varchar('class12_score', { length: 20 }),
    class12ScoreType: varchar('class12_score_type', { length: 10 }),
    class10Board: varchar('class10_board', { length: 100 }),
    class10Score: varchar('class10_score', { length: 20 }),
    class10ScoreType: varchar('class10_score_type', { length: 10 }),
    hasWorkExperience: boolean('has_work_experience').default(false),
    workExperiences: jsonb('work_experiences').default([]),
    leetcodeUsername: varchar('leetcode_username', { length: 100 }),
    codechefUsername: varchar('codechef_username', { length: 100 }),
    codeforcesUsername: varchar('codeforces_username', { length: 100 }),

    // PAGE 4: PREFERENCES
    targetRoles: jsonb('target_roles').default([]),
    preferredLocations: jsonb('preferred_locations').default([]),
    openToRemote: boolean('open_to_remote').default(false),
    internshipStipend: varchar('internship_stipend', { length: 50 }),
    fullTimeCtc: varchar('full_time_ctc', { length: 50 }),
    preferredContactMethods: jsonb('preferred_contact_methods').default([]),

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
export class LearnerProfileService {
  private async ensureCompleteProfileTableReady(): Promise<void> {
    await db.execute(
      sql.raw(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'learner_score_type') THEN
    CREATE TYPE learner_score_type AS ENUM ('CGPA', '%');
  END IF;
END $$;
`),
    );

    await db.execute(
      sql.raw(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'learner_project_type') THEN
    CREATE TYPE learner_project_type AS ENUM ('Solo', 'Team');
  END IF;
END $$;
`),
    );

    await db.execute(
      sql.raw(`
CREATE TABLE IF NOT EXISTS main.zuvy_learners_complete_profile (
  id serial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES main.users(id) ON UPDATE CASCADE ON DELETE CASCADE,

  full_name varchar(255),
  phone_number varchar(20),
  email varchar(255),
  linkedin_profile varchar(500),
  college_name varchar(255),
  other_college_name varchar(100),
  degree varchar(100),
  branch varchar(100),
  year_of_study varchar(10),
  graduation_month integer,
  graduation_year integer,
  current_status varchar(50),

  technical_skills jsonb DEFAULT '[]'::jsonb,
  projects jsonb DEFAULT '[]'::jsonb,

  college_stream varchar(100),
  college_score varchar(20),
  college_score_type varchar(10),
  class12_board varchar(100),
  class12_score varchar(20),
  class12_score_type varchar(10),
  class10_board varchar(100),
  class10_score varchar(20),
  class10_score_type varchar(10),
  has_work_experience boolean DEFAULT false,
  work_experiences jsonb DEFAULT '[]'::jsonb,
  leetcode_username varchar(100),
  codechef_username varchar(100),
  codeforces_username varchar(100),

  target_roles jsonb DEFAULT '[]'::jsonb,
  preferred_locations jsonb DEFAULT '[]'::jsonb,
  open_to_remote boolean DEFAULT false,
  internship_stipend varchar(50),
  full_time_ctc varchar(50),
  preferred_contact_methods jsonb DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`),
    );

    await db.execute(
      sql.raw(`
CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learners_complete_profile_user_id_unique
ON main.zuvy_learners_complete_profile (user_id);
`),
    );
  }

  private async getOrCreateProfile(userId: number) {
    await this.ensureCompleteProfileTableReady();

    const existing = await db
      .select()
      .from(zuvyLearnersCompleteProfileTable)
      .where(eq(zuvyLearnersCompleteProfileTable.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const inserted = await db
      .insert(zuvyLearnersCompleteProfileTable)
      .values({ userId })
      .returning();

    return inserted[0];
  }

  // ─── SINGLE POST API: Save Complete Profile ──────────────────────

  async saveCompleteProfile(userId: number, payload: SaveCompleteProfileDto) {
    await this.ensureCompleteProfileTableReady();
    await this.getOrCreateProfile(userId);

    const data = payload;

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    const [updatedProfile] = await db
      .update(zuvyLearnersCompleteProfileTable)
      .set(updateData)
      .where(eq(zuvyLearnersCompleteProfileTable.userId, userId))
      .returning();

    return {
      success: true,
      message: 'Profile saved successfully',
      data: updatedProfile,
    };
  }

  // ─── GET COMPLETE PROFILE ────────────────────────────────────────

  async getCompleteProfile(userId: number) {
    await this.ensureCompleteProfileTableReady();

    const rows = await db
      .select()
      .from(zuvyLearnersCompleteProfileTable)
      .where(eq(zuvyLearnersCompleteProfileTable.userId, userId))
      .limit(1);

    if (rows.length === 0) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: rows[0],
    };
  }

  // ─── PUT API: Update Profile ───────────────────────────────────

  async updateProfile(userId: number, payload: SaveCompleteProfileDto) {
    await this.ensureCompleteProfileTableReady();

    const existing = await db
      .select()
      .from(zuvyLearnersCompleteProfileTable)
      .where(eq(zuvyLearnersCompleteProfileTable.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(
        'Profile not found. Please create a profile first.',
      );
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    const [updatedProfile] = await db
      .update(zuvyLearnersCompleteProfileTable)
      .set(updateData)
      .where(eq(zuvyLearnersCompleteProfileTable.userId, userId))
      .returning();

    return {
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile,
    };
  }

  // ─── DELETE API: Delete Profile by User ID ─────────────────────

  async deleteProfile(userId: number) {
    await this.ensureCompleteProfileTableReady();

    const existing = await db
      .select()
      .from(zuvyLearnersCompleteProfileTable)
      .where(eq(zuvyLearnersCompleteProfileTable.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('Profile not found.');
    }

    await db
      .delete(zuvyLearnersCompleteProfileTable)
      .where(eq(zuvyLearnersCompleteProfileTable.userId, userId));

    return {
      success: true,
      message: 'Profile deleted successfully',
    };
  }

  async calculateProfileStrengthNew(userId: number): Promise<number> {
    const profile = await db.query.zuvyLearnersCompleteProfile.findFirst({
      where: (table, { eq }) => eq(table.userId, userId),
    });

    if (!profile) return 0;

    const checks = [
      // PAGE 1: BASICS
      !!profile.fullName,
      !!profile.phoneNumber,
      !!profile.email,
      !!profile.linkedinProfile,
      !!(profile.collegeName || profile.otherCollegeName),
      !!profile.degree,
      !!profile.branch,
      !!profile.yearOfStudy,
      !!profile.graduationMonth,
      !!profile.graduationYear,
      !!profile.currentStatus,

      // PAGE 2: SKILLS & PROJECTS
      Array.isArray(profile.technicalSkills) &&
        (profile.technicalSkills as any[]).length > 0,
      Array.isArray(profile.projects) && (profile.projects as any[]).length > 0,

      // PAGE 3: EDUCATION & EXPERIENCE
      !!profile.collegeStream,
      !!profile.collegeScore,
      !!profile.collegeScoreType,
      !!profile.class12Board,
      !!profile.class12Score,
      !!profile.class12ScoreType,
      !!profile.class10Board,
      !!profile.class10Score,
      !!profile.class10ScoreType,
      profile.hasWorkExperience === false ||
        (Array.isArray(profile.workExperiences) &&
          (profile.workExperiences as any[]).length > 0),
      !!(
        profile.leetcodeUsername ||
        profile.codechefUsername ||
        profile.codeforcesUsername
      ),

      // PAGE 4: PREFERENCES
      Array.isArray(profile.targetRoles) &&
        (profile.targetRoles as any[]).length > 0,
      Array.isArray(profile.preferredLocations) &&
        (profile.preferredLocations as any[]).length > 0,
      profile.openToRemote !== null && profile.openToRemote !== undefined,
      !!profile.internshipStipend,
      !!profile.fullTimeCtc,
      Array.isArray(profile.preferredContactMethods) &&
        (profile.preferredContactMethods as any[]).length > 0,
    ];

    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  }
}
