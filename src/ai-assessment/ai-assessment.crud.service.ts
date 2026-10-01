import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from 'src/db';
import {
  aiAssessment,
  studentAssessment,
  users,
  zuvyBatchEnrollments,
} from 'drizzle/schema';
import { CreateAiAssessmentDto } from './dto/create-ai-assessment.dto';

@Injectable()
export class AiAssessmentCrudService {
  private readonly logger = new Logger(AiAssessmentCrudService.name);

  async create(userId: number, dto: CreateAiAssessmentDto) {
    const { inserted, enrolledStudentsCount, wasUpdated } =
      await db.transaction(async (tx) => {
        // A chapter has one assessment. Reusing POST for an existing chapter
        // updates that assessment instead of creating another row (and another
        // set of student-assessment assignments).
        const [existingAssessment] = await tx
          .select()
          .from(aiAssessment)
          .where(eq(aiAssessment.chapterId, dto.chapterId))
          .limit(1);

        const assessmentValues = {
          bootcampId: dto.bootcampId,
          chapterId: dto.chapterId,
          moduleId: dto.moduleId ?? null,
          title: dto.title,
          objective: dto.objective,
          description: dto.description ?? null,
          audience: dto.audience ?? null,
          chapterIds: dto.chapterIds ?? [],
          poolTopics: dto.poolTopics ?? [],
          expectedOutcomes: dto.expectedOutcomes ?? null,
          totalNumberOfQuestions: dto.totalNumberOfQuestions,
          totalQuestionsWithBuffer: Math.floor(
            dto.totalNumberOfQuestions * 2.25,
          ),
          updatedAt: new Date().toISOString(),
        };

        if (existingAssessment) {
          if (
            this.hasSameAssessmentValues(existingAssessment, assessmentValues)
          ) {
            throw new ConflictException(
              'An identical AI assessment already exists for this chapter',
            );
          }

          const [updatedAssessment] = await tx
            .update(aiAssessment)
            .set(assessmentValues as any)
            .where(eq(aiAssessment.id, existingAssessment.id))
            .returning();

          return {
            inserted: updatedAssessment,
            enrolledStudentsCount: 0,
            wasUpdated: true,
          };
        }

        const [aiRow] = await tx
          .insert(aiAssessment)
          .values({
            scope: 'bootcamp',
            ...assessmentValues,
          } as any)
          .returning();

        const enrolledStudents = await tx
          .select({ studentId: zuvyBatchEnrollments.userId })
          .from(zuvyBatchEnrollments)
          .innerJoin(users, eq(zuvyBatchEnrollments.userId, users.id))
          .where(eq(zuvyBatchEnrollments.bootcampId, dto.bootcampId));

        if (enrolledStudents.length > 0) {
          await tx.insert(studentAssessment).values(
            enrolledStudents.map((s) => ({
              studentId: Number(s.studentId),
              aiAssessmentId: aiRow.id,
              status: 0,
            })),
          );
        }

        return {
          inserted: aiRow,
          enrolledStudentsCount: enrolledStudents.length,
          wasUpdated: false,
        };
      });

    return {
      message: wasUpdated
        ? 'AI Assessment updated for this chapter'
        : 'AI Assessment created and assigned to all enrolled students',
      data: inserted,
      totalAssignedStudents: enrolledStudentsCount,
    };
  }

  /**
   * Compare only fields that can be changed through the create payload. System
   * fields such as id, status, timestamps, and publication dates are ignored.
   */
  private hasSameAssessmentValues(existing: any, values: any): boolean {
    return (
      existing.bootcampId === values.bootcampId &&
      existing.chapterId === values.chapterId &&
      existing.moduleId === values.moduleId &&
      existing.title === values.title &&
      existing.objective === values.objective &&
      existing.description === values.description &&
      existing.expectedOutcomes === values.expectedOutcomes &&
      existing.totalNumberOfQuestions === values.totalNumberOfQuestions &&
      existing.totalQuestionsWithBuffer === values.totalQuestionsWithBuffer &&
      this.stableJson(existing.audience) === this.stableJson(values.audience) &&
      this.stableJson(existing.chapterIds ?? []) ===
        this.stableJson(values.chapterIds ?? []) &&
      this.stableJson(existing.poolTopics ?? []) ===
        this.stableJson(values.poolTopics ?? [])
    );
  }

  private stableJson(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableJson(item)).join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.stableJson(record[key])}`)
      .join(',')}}`;
  }

  private assessmentReturnColumns() {
    return {
      id: aiAssessment.id,
      bootcampId: aiAssessment.bootcampId,
      chapterId: aiAssessment.chapterId,
      moduleId: aiAssessment.moduleId,
      scope: aiAssessment.scope,
      status: aiAssessment.status,
      title: aiAssessment.title,
      objective: aiAssessment.objective,
      description: aiAssessment.description,
      audience: aiAssessment.audience,
      chapterIds: aiAssessment.chapterIds,
      poolTopics: aiAssessment.poolTopics,
      expectedOutcomes: aiAssessment.expectedOutcomes,
      totalNumberOfQuestions: aiAssessment.totalNumberOfQuestions,
      totalQuestionsWithBuffer: aiAssessment.totalQuestionsWithBuffer,
      startDatetime: aiAssessment.startDatetime,
      endDatetime: aiAssessment.endDatetime,
      publishedAt: aiAssessment.publishedAt,
      createdAt: aiAssessment.createdAt,
      updatedAt: aiAssessment.updatedAt,
    };
  }
}
