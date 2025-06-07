import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { db } from '../db';
import { zuvyOutsourseAssessments } from '../../drizzle/schema';
import { eq, sql, and, lte } from 'drizzle-orm';
import { SseService } from './sse.service';

@Injectable()
export class AssessmentStateService {
  private readonly logger = new Logger(AssessmentStateService.name);

  constructor(private sseService: SseService) {}

  // Event-based update when assessment is created or modified
  async handleAssessmentUpdate(assessmentId: number) {
    try {
      const assessment = await db.query.zuvyOutsourseAssessments.findFirst({
        where: eq(zuvyOutsourseAssessments.id, assessmentId)
      });

      if (!assessment) {
        this.logger.warn(`Assessment ${assessmentId} not found`);
        return;
      }

      await this.updateAssessmentState(assessment);
    } catch (error) {
      this.logger.error(`Error handling assessment update for ${assessmentId}:`, error);
    }
  }

  // Backup check every 5 minutes for any assessments that might need state updates
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkPendingStates() {
    try {
      const now = new Date();
      
      // Only get assessments that might need state updates
      const assessments = await db.query.zuvyOutsourseAssessments.findMany({
        where: sql`
          ${zuvyOutsourseAssessments.publishDatetime} IS NOT NULL AND
          (
            ${zuvyOutsourseAssessments.publishDatetime} <= ${now.toISOString()} OR
            ${zuvyOutsourseAssessments.startDatetime} <= ${now.toISOString()} OR
            ${zuvyOutsourseAssessments.endDatetime} <= ${now.toISOString()}
          )
        `
      });

      this.logger.log(`Checking ${assessments.length} assessments for state updates`);

      for (const assessment of assessments) {
        await this.updateAssessmentState(assessment);
      }
    } catch (error) {
      this.logger.error('Error checking pending states:', error);
    }
  }

  // Helper method to update assessment state
  private async updateAssessmentState(assessment: any) {
    const now = new Date();
    const oldState = assessment.currentState;
    let newState = oldState;

    // Calculate new state based on dates
    if (assessment.publishDatetime) {
      const publishDate = new Date(assessment.publishDatetime);

      if (now < publishDate) {
        newState = 0; // DRAFT
      } else if (assessment.startDatetime) {
        const startDate = new Date(assessment.startDatetime);

        if (now >= publishDate && now < startDate) {
          newState = 1; // PUBLISHED
        } else if (assessment.endDatetime) {
          const endDate = new Date(assessment.endDatetime);

          if (now >= startDate && now < endDate) {
            newState = 2; // ACTIVE
          } else if (now >= endDate) {
            newState = 3; // CLOSED
          }
        } else if (now >= startDate) {
          newState = 2; // ACTIVE - no end date
        }
      } else if (now >= publishDate) {
        newState = 1; // PUBLISHED - no start date
      }
    }

    // If state has changed, update it and notify clients
    if (newState !== oldState) {
      await db
        .update(zuvyOutsourseAssessments)
        .set({
          currentState: newState,
          updatedAt: now.toISOString()
        } as any)
        .where(eq(zuvyOutsourseAssessments.id, assessment.id));

      // Notify connected clients about the state change
      this.sseService.notifyAssessmentStateChange(assessment.id, newState);
      
      this.logger.log(`Assessment ${assessment.id} state changed from ${oldState} to ${newState}`);
    }
  }
}