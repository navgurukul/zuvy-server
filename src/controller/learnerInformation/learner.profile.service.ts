/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index';
import { zuvyLearnersCompleteProfile, users } from '../../../drizzle/schema';
import { SaveCompleteProfileDto } from './dto/learner.dto';

@Injectable()
export class LearnerProfileService {
  private async ensureCompleteProfileTableReady(): Promise<void> {
    return;
  }

  private normalizeCodingPlatformFields(payload: SaveCompleteProfileDto) {
    const normalizedPayload: SaveCompleteProfileDto = { ...payload };

    const normalizeProjects = (projects: unknown) => {
      if (!Array.isArray(projects)) return projects;

      return projects.map((project) => {
        if (!project || typeof project !== 'object') {
          return project;
        }

        const projectData = {
          ...(project as Record<string, unknown>),
        } as Record<string, unknown>;

        const githubUrlValue = projectData.githubUrl;
        const demoUrlValue = projectData.demoUrl;

        return {
          ...projectData,
          githubUrl:
            githubUrlValue === undefined ||
            githubUrlValue === null ||
            (typeof githubUrlValue === 'string' &&
              githubUrlValue.trim().length === 0)
              ? null
              : githubUrlValue,
          demoUrl:
            demoUrlValue === undefined ||
            demoUrlValue === null ||
            (typeof demoUrlValue === 'string' &&
              demoUrlValue.trim().length === 0)
              ? null
              : demoUrlValue,
        };
      });
    };

    const normalizeProfiles = (profiles: unknown) => {
      if (!Array.isArray(profiles)) return profiles;

      return profiles.map((profile) => {
        if (!profile || typeof profile !== 'object') {
          return profile;
        }

        const profileData = {
          ...(profile as Record<string, unknown>),
        } as Record<string, unknown>;

        if (profileData.rating !== undefined && profileData.rating !== null) {
          const parsedRating = Number(profileData.rating);
          if (!Number.isNaN(parsedRating)) {
            profileData.rating = parsedRating;
          }
        }

        if (profileData.rank !== undefined && profileData.rank !== null) {
          const parsedRank = Number(profileData.rank);
          if (!Number.isNaN(parsedRank)) {
            profileData.rank = parsedRank;
          }
        }

        return profileData;
      });
    };

    if (payload.hasWorkExperience === false) {
      normalizedPayload.workExperiences = [];
    }

    if (payload.hasWorkExperience === true) {
      if (
        !Array.isArray(payload.workExperiences) ||
        payload.workExperiences.length === 0
      ) {
        throw new BadRequestException(
          'workExperiences must have at least one item when hasWorkExperience is true',
        );
      }

      for (const exp of payload.workExperiences) {
        if (!exp.isCurrentlyWorking && !exp.endDate) {
          throw new BadRequestException(
            'endDate is required when isCurrentlyWorking is false',
          );
        }
      }
      normalizedPayload.workExperiences = payload.workExperiences.map(
        (exp) => ({
          ...exp,
          endDate: exp.isCurrentlyWorking ? null : exp.endDate,
        }),
      );
    }

    if (
      payload.hasWorkExperience === undefined &&
      Array.isArray(payload.workExperiences)
    ) {
      if (payload.workExperiences.length > 0) {
        normalizedPayload.hasWorkExperience = true;
      } else {
        normalizedPayload.hasWorkExperience = false;
        normalizedPayload.workExperiences = [];
      }
    }

    normalizedPayload.leetcodeProfiles = normalizeProfiles(
      payload.leetcodeProfiles,
    ) as SaveCompleteProfileDto['leetcodeProfiles'];
    normalizedPayload.codechefProfiles = normalizeProfiles(
      payload.codechefProfiles,
    ) as SaveCompleteProfileDto['codechefProfiles'];
    normalizedPayload.codeforcesProfiles = normalizeProfiles(
      payload.codeforcesProfiles,
    ) as SaveCompleteProfileDto['codeforcesProfiles'];
    normalizedPayload.projects = normalizeProjects(
      payload.projects,
    ) as SaveCompleteProfileDto['projects'];

    return normalizedPayload;
  }

  private async getOrCreateProfile(userId: number) {
    await this.ensureCompleteProfileTableReady();

    const existing = await db
      .select()
      .from(zuvyLearnersCompleteProfile)
      .where(eq(zuvyLearnersCompleteProfile.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const inserted = await db
      .insert(zuvyLearnersCompleteProfile)
      .values({ userId })
      .returning();

    return inserted[0];
  }

  // ─── SINGLE POST API: Save Complete Profile ──────────────────────

  async saveCompleteProfile(userId: number, payload: SaveCompleteProfileDto) {
    await this.ensureCompleteProfileTableReady();
    await this.getOrCreateProfile(userId);

    const data = this.normalizeCodingPlatformFields(payload);

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    const [updatedProfile] = await db
      .update(zuvyLearnersCompleteProfile)
      .set(updateData)
      .where(eq(zuvyLearnersCompleteProfile.userId, userId))
      .returning();

    const responseData = {
      ...updatedProfile,
      termsAndCondition: updatedProfile?.termsAndCondition ?? false,
    };

    return {
      success: true,
      message: 'Profile saved successfully',
      data: responseData,
    };
  }

  // ─── GET COMPLETE PROFILE ────────────────────────────────────────

  async getCompleteProfile(userId: number) {
    await this.ensureCompleteProfileTableReady();

    const rows = await db
      .select()
      .from(zuvyLearnersCompleteProfile)
      .where(eq(zuvyLearnersCompleteProfile.userId, userId))
      .limit(1);

    if (rows.length === 0) {
      return {
        success: true,
        data: null,
      };
    }

    const responseData = {
      ...rows[0],
      termsAndCondition: rows[0]?.termsAndCondition ?? false,
    };

    return {
      success: true,
      data: responseData,
    };
  }

  // ─── PUT API: Update Profile ───────────────────────────────────

  async updateProfile(userId: number, payload: SaveCompleteProfileDto) {
    await this.ensureCompleteProfileTableReady();

    const existing = await db
      .select()
      .from(zuvyLearnersCompleteProfile)
      .where(eq(zuvyLearnersCompleteProfile.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(
        'Profile not found. Please create a profile first.',
      );
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    const normalizedPayload = this.normalizeCodingPlatformFields(payload);

    for (const [key, value] of Object.entries(normalizedPayload)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    const [updatedProfile] = await db
      .update(zuvyLearnersCompleteProfile)
      .set(updateData)
      .where(eq(zuvyLearnersCompleteProfile.userId, userId))
      .returning();

    const responseData = {
      ...updatedProfile,
      termsAndCondition: updatedProfile?.termsAndCondition ?? false,
    };

    return {
      success: true,
      message: 'Profile updated successfully',
      data: responseData,
    };
  }

  // ─── DELETE API: Delete Profile by User ID ─────────────────────

  async deleteProfile(userId: number) {
    await this.ensureCompleteProfileTableReady();

    const existing = await db
      .select()
      .from(zuvyLearnersCompleteProfile)
      .where(eq(zuvyLearnersCompleteProfile.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('Profile not found.');
    }

    await db
      .delete(zuvyLearnersCompleteProfile)
      .where(eq(zuvyLearnersCompleteProfile.userId, userId));

    return {
      success: true,
      message: 'Profile deleted successfully',
    };
  }
  private getProfileStrengthDetails(percentage: number): {
    level: string;
    message: string;
  } {
    if (percentage === 0) {
      return {
        level: 'Not Started',
        message:
          'Start by filling in your basic information to begin building your profile.',
      };
    } else if (percentage <= 20) {
      return {
        level: 'Beginner',
        message:
          'Good start! Just a few quick additions to boost your profile.',
      };
    } else if (percentage <= 40) {
      return {
        level: 'Basic',
        message:
          'You are halfway there! Keep going to unlock job opportunities.',
      };
    } else if (percentage <= 60) {
      return {
        level: 'Intermediate',
        message: 'Great progress! A few more clicks to become job ready.',
      };
    } else if (percentage <= 80) {
      return {
        level: 'Job Ready',
        message: 'You can now apply for jobs! Add more details to stand out.',
      };
    } else if (percentage <= 90) {
      return {
        level: 'Job Ready',
        message:
          'You are so close! Complete your profile to unlock opportunities.',
      };
    } else if (percentage <= 99) {
      return {
        level: 'Job Ready',
        message: 'Almost there! One step away from being job ready.',
      };
    } else {
      return {
        level: 'Complete',
        message: 'Congratulations! Your profile is now complete and job ready.',
      };
    }
  }

  async calculateProfileStrengthNew(userId: number): Promise<{
    profileCompletion: number;
    isProfileComplete: boolean;
    missingFields: Record<string, null>;
    level: string;
    message: string;
  }> {
    const profile = await db.query.zuvyLearnersCompleteProfile.findFirst({
      where: (table, { eq }) => eq(table.userId, userId),
    });

    const hasCodingPlatformData = (profiles: unknown) => {
      const hasProfiles =
        Array.isArray(profiles) &&
        profiles.some(
          (profile) =>
            profile &&
            typeof profile === 'object' &&
            typeof (profile as { username?: unknown }).username === 'string' &&
            (profile as { username: string }).username.trim().length > 0,
        );

      return hasProfiles;
    };

    const checks = [
      // PAGE 1: BASICS
      { key: 'fullName', isFilled: !!profile?.fullName },
      { key: 'phoneNumber', isFilled: !!profile?.phoneNumber },
      { key: 'email', isFilled: !!profile?.email },
      { key: 'linkedinProfile', isFilled: !!profile?.linkedinProfile },
      { key: 'collegeName', isFilled: !!profile?.collegeName },
      { key: 'degree', isFilled: !!profile?.degree },
      { key: 'branch', isFilled: !!profile?.branch },
      { key: 'yearOfStudy', isFilled: !!profile?.yearOfStudy },
      {
        key: 'graduationMonth',
        isFilled: !!profile?.graduationMonth,
      },
      { key: 'graduationYear', isFilled: !!profile?.graduationYear },
      { key: 'currentStatus', isFilled: !!profile?.currentStatus },

      // PAGE 2: SKILLS & PROJECTS
      {
        key: 'technicalSkills',
        isFilled:
          Array.isArray(profile?.technicalSkills) &&
          (profile.technicalSkills as any[]).length > 0,
      },
      {
        key: 'projects',
        isFilled:
          Array.isArray(profile?.projects) &&
          (profile.projects as any[]).length > 0,
      },

      // PAGE 3: EDUCATION & EXPERIENCE
      { key: 'collegeStream', isFilled: !!profile?.collegeStream },
      { key: 'collegeScore', isFilled: !!profile?.collegeScore },
      { key: 'collegeScoreType', isFilled: !!profile?.collegeScoreType },

      // { key: 'class12Board', isFilled: !!profile?.class12Board },
      // { key: 'class12Score', isFilled: !!profile?.class12Score },
      // {
      //   key: 'class12ScoreType',
      //   isFilled: !!profile?.class12ScoreType,
      // },
      // { key: 'class10Board', isFilled: !!profile?.class10Board },
      // { key: 'class10Score', isFilled: !!profile?.class10Score },
      // {
      //   key: 'class10ScoreType',
      //   isFilled: !!profile?.class10ScoreType,
      // },
      // Only require work experience for experienced users (not for freshers)
      ...(profile?.hasWorkExperience === true
        ? [
            {
              key: 'workExperiences',
              isFilled:
                Array.isArray(profile?.workExperiences) &&
                (profile.workExperiences as any[]).length > 0,
            },
          ]
        : []),

      // {
      //   key: 'codingPlatformProfile',
      //   isFilled:
      //     hasCodingPlatformData(profile?.leetcodeProfiles) ||
      //     hasCodingPlatformData(profile?.codechefProfiles) ||
      //     hasCodingPlatformData(profile?.codeforcesProfiles),
      // },

      // PAGE 4: PREFERENCES
      {
        key: 'targetRoles',
        isFilled:
          Array.isArray(profile?.targetRoles) &&
          (profile.targetRoles as any[]).length > 0,
      },
      {
        key: 'preferredLocations',
        isFilled:
          Array.isArray(profile?.preferredLocations) &&
          (profile.preferredLocations as any[]).length > 0,
      },
      { key: 'openToRemote', isFilled: profile?.openToRemote === true },
      // { key: 'internshipStipend', isFilled: !!profile?.internshipStipend },
      // { key: 'fullTimeCtc', isFilled: !!profile?.fullTimeCtc },
      {
        key: 'preferredContactMethods',
        isFilled:
          Array.isArray(profile?.preferredContactMethods) &&
          (profile.preferredContactMethods as any[]).length > 0,
      },
    ];

    const missingFields = checks.reduce(
      (acc, check) => {
        if (!check.isFilled) {
          acc[check.key] = null;
        }

        return acc;
      },
      {} as Record<string, null>,
    );

    const missingCount = Object.keys(missingFields).length;
    const filled = checks.length - missingCount;
    const percentage = Math.round((filled / checks.length) * 100);
    const isProfileComplete = missingCount === 0;
    const details = this.getProfileStrengthDetails(percentage);

    return {
      profileCompletion: percentage,
      isProfileComplete,
      missingFields: isProfileComplete ? {} : missingFields,
      level: details.level,
      message: details.message,
    };
  }
}
