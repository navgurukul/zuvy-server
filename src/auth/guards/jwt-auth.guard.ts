import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { db } from 'src/db/index';
import {
  users,
  zuvyBootcampType,
  zuvyCourseModules,
  zuvyModuleChapter,
  zuvyOutsourseAssessments,
  zuvyBatchEnrollments,
  zuvyBatches,
} from '../../../drizzle/schema';
import { and, eq, asc, count, isNotNull, isNull } from 'drizzle-orm';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // ABSOLUTE BYPASS FOR ZOOM WEBHOOKS
    if (request.originalUrl?.startsWith('/webhooks/zoom')) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Run passport auth
    const allowed = (await super.canActivate(context)) as boolean;
    if (!allowed) return false;

    // At this point Passport has populated request.user
    const user = request.user?.[0] || request.user;
    if (!user || !user.id) return true; // defensive

    const roles = Array.isArray(user.roles) ? user.roles : [];
    const isStudent =
      roles.includes('student') || roles.length === 0 || user.roles == null;

    if (!isStudent) return true;

    // Best-effort auto-enroll flow — don't block auth on failures
    try {
      // Ensure user exists in `users` table
      await this.ensureUserExists(user);

      // Resolve bootcampId from request (params/query/body or via module/chapter/assessment)
      const bootcampId = await this.resolveBootcampIdFromRequest(request);
      if (!bootcampId) return true;

      // Check bootcamp type is Public
      const bootcampType = await db
        .select()
        .from(zuvyBootcampType)
        .where(
          and(
            eq(zuvyBootcampType.bootcampId, bootcampId),
            eq(zuvyBootcampType.type, 'Public'),
          ),
        )
        .limit(1);

      if (!bootcampType || bootcampType.length === 0) return true;

      // Enroll if not already enrolled
      await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(zuvyBatchEnrollments)
          .where(
            and(
              eq(zuvyBatchEnrollments.userId, BigInt(user.id)),
              eq(zuvyBatchEnrollments.bootcampId, bootcampId),
            ),
          )
          .limit(1);

        if (existing) return;

        // Find a batch with capacity (or fallback to most recent batch or null)
        const batches = await tx
          .select()
          .from(zuvyBatches)
          .where(eq(zuvyBatches.bootcampId, bootcampId))
          .orderBy(asc(zuvyBatches.createdAt));

        let selectedBatchId: number | null = null;
        for (const batch of batches) {
          const enrollmentsCounts = await tx
            .select({ count: count() })
            .from(zuvyBatchEnrollments)
            .where(eq(zuvyBatchEnrollments.batchId, batch.id));

          const currentCount = Number(enrollmentsCounts[0]?.count || 0);
          if (!batch.capEnrollment || currentCount < batch.capEnrollment) {
            selectedBatchId = batch.id;
            break;
          }
        }

        await tx
          .insert(zuvyBatchEnrollments)
          .values({
            userId: BigInt(user.id),
            bootcampId,
            batchId: selectedBatchId,
            enrolledDate: new Date(),
            status: 'active',
          })
          .returning();
      });
    } catch (e) {
      // Log and continue — don't fail auth due to enrollment issues
      // eslint-disable-next-line no-console
      console.error('auto-enroll failed', e?.message || e);
    }

    return true;
  }

  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user as TUser;
  }

  private async ensureUserExists(user: any): Promise<void> {
    try {
      const userId = BigInt(user.id);
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (existing) return;

      // Insert minimal user row. Use available fields when present.
      await db
        .insert(users)
        .values({
          id: userId,
          email: user.email || null,
          name: user.name || '',
          googleUserId: user.googleUserId || user.googleId || null,
          createdAt: new Date(),
        })
        .returning();
    } catch (e) {
      // swallow — best-effort
      // eslint-disable-next-line no-console
      console.error('ensureUserExists failed', e?.message || e);
    }
  }

  private async resolveBootcampIdFromRequest(
    request: any,
  ): Promise<number | null> {
    // 1) explicit bootcamp fields
    const explicitBootcampId =
      request.params?.bootcampId ??
      request.params?.bootcamp_id ??
      request.query?.bootcampId ??
      request.query?.bootcamp_id ??
      request.body?.bootcampId ??
      request.body?.bootcamp_id;

    const parsedExplicit = Number(explicitBootcampId);
    if (Number.isFinite(parsedExplicit) && parsedExplicit > 0)
      return parsedExplicit;

    // 2) moduleId -> courseModules.bootcampId
    const rawModuleId =
      request.params?.moduleId ??
      request.query?.moduleId ??
      request.body?.moduleId ??
      request.params?.module_id ??
      request.query?.module_id ??
      request.body?.module_id;
    const moduleId = Number(rawModuleId);
    if (Number.isFinite(moduleId) && moduleId > 0) {
      const [mod] = await db
        .select({ bootcampId: zuvyCourseModules.bootcampId })
        .from(zuvyCourseModules)
        .where(eq(zuvyCourseModules.id, moduleId))
        .limit(1);
      if (mod?.bootcampId) return Number(mod.bootcampId);
    }

    // 3) chapterId -> moduleId -> bootcampId
    const rawChapterId =
      request.params?.chapterId ??
      request.query?.chapterId ??
      request.body?.chapterId ??
      request.params?.chapter_id ??
      request.query?.chapter_id ??
      request.body?.chapter_id;
    const chapterId = Number(rawChapterId);
    if (Number.isFinite(chapterId) && chapterId > 0) {
      const [chapter] = await db
        .select({ moduleId: zuvyModuleChapter.moduleId })
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.id, chapterId))
        .limit(1);
      const modId = chapter?.moduleId ? Number(chapter.moduleId) : null;
      if (modId) {
        const [mod] = await db
          .select({ bootcampId: zuvyCourseModules.bootcampId })
          .from(zuvyCourseModules)
          .where(eq(zuvyCourseModules.id, modId))
          .limit(1);
        if (mod?.bootcampId) return Number(mod.bootcampId);
      }
    }

    // 4) assessment ids
    const rawAssessmentId =
      request.params?.assessmentId ??
      request.query?.assessmentId ??
      request.body?.assessmentId ??
      request.params?.assessment_outsourse_id ??
      request.query?.assessment_outsourse_id ??
      request.body?.assessment_outsourse_id ??
      request.params?.assessmentOutsourseId ??
      request.query?.assessmentOutsourseId ??
      request.body?.assessmentOutsourseId;
    const assessmentId = Number(rawAssessmentId);
    if (Number.isFinite(assessmentId) && assessmentId > 0) {
      const [ass] = await db
        .select({ bootcampId: zuvyOutsourseAssessments.bootcampId })
        .from(zuvyOutsourseAssessments)
        .where(eq(zuvyOutsourseAssessments.id, assessmentId))
        .limit(1);
      if (ass?.bootcampId) return Number(ass.bootcampId);
    }

    return null;
  }
}
