import { Injectable } from '@nestjs/common';
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

    // PAGE 5: REVIEW
    reviewCompleted: boolean('review_completed').default(false),

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

  review_completed boolean DEFAULT false,

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

    // PAGE 1: BASICS fields
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.phoneNumber !== undefined)
      updateData.phoneNumber = data.phoneNumber;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.linkedinProfile !== undefined)
      updateData.linkedinProfile = data.linkedinProfile;
    if (data.collegeName !== undefined)
      updateData.collegeName = data.collegeName;
    if (data.otherCollegeName !== undefined)
      updateData.otherCollegeName = data.otherCollegeName;
    if (data.degree !== undefined) updateData.degree = data.degree;
    if (data.branch !== undefined) updateData.branch = data.branch;
    if (data.yearOfStudy !== undefined)
      updateData.yearOfStudy = data.yearOfStudy;
    if (data.graduationMonth !== undefined)
      updateData.graduationMonth = data.graduationMonth;
    if (data.graduationYear !== undefined)
      updateData.graduationYear = data.graduationYear;
    if (data.currentStatus !== undefined)
      updateData.currentStatus = data.currentStatus;

    // PAGE 2: SKILLS & PROJECTS fields
    if (data.technicalSkills !== undefined)
      updateData.technicalSkills = data.technicalSkills;
    if (data.projects !== undefined) updateData.projects = data.projects;

    // PAGE 3: EDUCATION & EXPERIENCE fields
    if (data.collegeStream !== undefined)
      updateData.collegeStream = data.collegeStream;
    if (data.collegeScore !== undefined)
      updateData.collegeScore = data.collegeScore;
    if (data.collegeScoreType !== undefined)
      updateData.collegeScoreType = data.collegeScoreType;
    if (data.class12Board !== undefined)
      updateData.class12Board = data.class12Board;
    if (data.class12Score !== undefined)
      updateData.class12Score = data.class12Score;
    if (data.class12ScoreType !== undefined)
      updateData.class12ScoreType = data.class12ScoreType;
    if (data.class10Board !== undefined)
      updateData.class10Board = data.class10Board;
    if (data.class10Score !== undefined)
      updateData.class10Score = data.class10Score;
    if (data.class10ScoreType !== undefined)
      updateData.class10ScoreType = data.class10ScoreType;
    if (data.hasWorkExperience !== undefined)
      updateData.hasWorkExperience = data.hasWorkExperience;
    if (data.workExperiences !== undefined)
      updateData.workExperiences = data.workExperiences;
    if (data.leetcodeUsername !== undefined)
      updateData.leetcodeUsername = data.leetcodeUsername;
    if (data.codechefUsername !== undefined)
      updateData.codechefUsername = data.codechefUsername;
    if (data.codeforcesUsername !== undefined)
      updateData.codeforcesUsername = data.codeforcesUsername;

    // PAGE 4: PREFERENCES fields
    if (data.targetRoles !== undefined)
      updateData.targetRoles = data.targetRoles;
    if (data.preferredLocations !== undefined)
      updateData.preferredLocations = data.preferredLocations;
    if (data.openToRemote !== undefined)
      updateData.openToRemote = data.openToRemote;
    if (data.internshipStipend !== undefined)
      updateData.internshipStipend = data.internshipStipend;
    if (data.fullTimeCtc !== undefined)
      updateData.fullTimeCtc = data.fullTimeCtc;
    if (data.preferredContactMethods !== undefined)
      updateData.preferredContactMethods = data.preferredContactMethods;

    // PAGE 5: REVIEW fields
    if (data.reviewCompleted !== undefined) {
      updateData.reviewCompleted = data.reviewCompleted;
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

  //priya yaha se
  // async calculateProfileStrengthNew(userId: number): Promise<number> {
  //   const profile = await db.query.zuvyLearnersCompleteProfile.findFirst({
  //     where: (table, { eq }) => eq(table.userId, userId),
  //   });

  //   if (!profile) return 0;

  //   let filled = 0;

  //   for (const field of PROFILE_STRENGTH_FIELDS) {
  //     if (profile[field] !== null) filled++;
  //   }

  //   return Math.round((filled / PROFILE_STRENGTH_FIELDS.length) * 100);
  // }

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
