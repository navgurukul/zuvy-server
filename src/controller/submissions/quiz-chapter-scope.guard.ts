import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index';
import { zuvyCourseModules, zuvyModuleChapter } from '../../../drizzle/schema';

// The quiz report can be called with only `chapter_id`. PermissionsGuard
// scopes org / instructor access by bootcamp id, so resolve the chapter's
// bootcamp first and expose it as a route param. Must run before
// PermissionsGuard.
@Injectable()
export class QuizChapterScopeGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawChapterId = request.query?.chapter_id;
    if (rawChapterId === undefined || rawChapterId === '') {
      throw new BadRequestException('chapter_id is required');
    }
    const chapterId = Number(rawChapterId);
    if (!Number.isInteger(chapterId) || chapterId <= 0) {
      throw new BadRequestException('chapter_id must be a positive integer');
    }

    const [chapter] = await db
      .select({ bootcampId: zuvyCourseModules.bootcampId })
      .from(zuvyModuleChapter)
      .innerJoin(
        zuvyCourseModules,
        eq(zuvyCourseModules.id, zuvyModuleChapter.moduleId),
      )
      .where(eq(zuvyModuleChapter.id, chapterId));
    if (!chapter?.bootcampId) {
      throw new NotFoundException('Quiz chapter not found');
    }

    const rawBootcampId = request.query?.bootcamp_id;
    if (
      rawBootcampId !== undefined &&
      rawBootcampId !== '' &&
      Number(rawBootcampId) !== chapter.bootcampId
    ) {
      throw new BadRequestException(
        'chapter_id does not belong to the given bootcamp_id',
      );
    }

    request.params = { ...request.params, bootcampId: chapter.bootcampId };
    return true;
  }
}
