import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  userTokens,
  zuvySessions,
  zuvyBatchEnrollments,
  users,
  zuvyStudentAttendance,
  zuvyAssessmentSubmission
} from '../../drizzle/schema';
import { db } from '../db/index';
import { eq, sql, isNull, and, gte, lt } from 'drizzle-orm';
import { google } from 'googleapis';
import { SubmissionService } from '../controller/submissions/submission.service';

const { OAuth2 } = google.auth;
const auth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_SECRET,
  process.env.GOOGLE_REDIRECT
);

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);
  private lastProcessedTime: Date = new Date(0);
  private processingActive = false;
  private currentInterval: number;
  private timeoutId: NodeJS.Timeout;
  private readonly submissionService: SubmissionService = new SubmissionService();
  
  // Simplified interval configuration
  private readonly sessionIntervals = [
    { threshold: 1, interval: 120 * 60 * 1000 }, // 2 hours for 0-1 sessions
    { threshold: 3, interval: 70 * 60 * 1000 },  // 70 minutes for 2-3 sessions
    { threshold: 6, interval: 40 * 60 * 1000 },  // 40 minutes for 4-6 sessions
    { threshold: 10, interval: 30 * 60 * 1000 }, // 30 minutes for 7-10 sessions
    { threshold: 13, interval: 20 * 60 * 1000 }, // 20 minutes for 11-13 sessions
    { threshold: Infinity, interval: 10 * 60 * 1000 } // 10 minutes for 14+ sessions
  ];

  // Run every 12 hours instead of 6 to reduce frequency
  @Cron('0 */12 * * *')
  async handleDynamicScheduling() {
    if (this.processingActive) {
      this.logger.log('Skipping: Previous job still running');
      return;
    }

    this.processingActive = true;
    try {
      const now = new Date();
      const [startOfDay, endOfDay] = this.getDayBounds(now);
      
      // Fetch only necessary data with optimized query
      const sessions = await this.fetchSessions(startOfDay, endOfDay);
      const sessionCount = sessions.length;
      
      if (sessionCount === 0) {
        this.logger.log('No sessions to process, skipping');
        this.processingActive = false;
        return;
      }
      
      this.logger.log(`Fetched ${sessionCount} sessions`);
      
      // Optimize interval selection
      this.currentInterval = this.getOptimizedInterval(sessionCount);
      this.logger.log(`Setting interval to ${this.currentInterval / 60000} minutes`);

      // Reset and start new timeout with batch processing
      this.resetTimeout();
      this.startBatchProcessing(sessions);

      this.lastProcessedTime = now;
    } catch (error) {
      this.logger.error(`Scheduling error: ${error.message}`);
    } finally {
      this.processingActive = false;
    }
  }

  private getDayBounds(date: Date): [Date, Date] {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    return [startOfDay, endOfDay];
  }

  private async fetchSessions(startOfDay: Date, endOfDay: Date) {
    // Optimize query by selecting only needed fields
    return db.select({
      id: zuvySessions.id,
      creator: zuvySessions.creator,
      meetingId: zuvySessions.meetingId,
      status: zuvySessions.status,
      startTime: zuvySessions.startTime,
      batchId: zuvySessions.batchId,
      bootcampId: zuvySessions.bootcampId
    })
    .from(zuvySessions)
    .where(
      and(
        isNull(zuvySessions.s3link),
        eq(zuvySessions.status, 'completed'),
        gte(zuvySessions.startTime, startOfDay.toISOString()),
        lt(zuvySessions.startTime, endOfDay.toISOString()),
      )
    );
  }

  private getOptimizedInterval(sessionCount: number): number {
    // More efficient interval lookup
    for (const { threshold, interval } of this.sessionIntervals) {
      if (sessionCount <= threshold) return interval;
    }
    return 10 * 60 * 1000; // Default fallback
  }

  private resetTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  private startBatchProcessing(sessions: any[]) {
    // Process in batches of 5 to reduce CPU spikes
    const batchSize = 5;
    let currentIndex = 0;
    
    this.timeoutId = setTimeout(async () => {
      try {
        const batch = sessions.slice(currentIndex, currentIndex + batchSize);
        if (batch.length > 0) {
          await this.processBatch(batch);
          currentIndex += batchSize;
          
          // If more sessions to process, continue with next batch
          if (currentIndex < sessions.length) {
            this.startBatchProcessing(sessions);
          } else {
            this.logger.log("All sessions processed");
          }
        }
      } catch (error) {
        this.logger.error(`Error processing batch: ${error.message}`);
      }
    }, this.currentInterval);
  }

  private async processBatch(batch: any[]) {
    this.logger.log(`Processing batch of ${batch.length} sessions`);
    
    // Process sessions in sequence with a pause between each
    for (const session of batch) {
      try {
        await this.processSingleSession(session);
        // Add a small delay between processing each session
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        this.logger.error(`Error processing session ${session.id}: ${error.message}`);
      }
    }
  }

  private async processSingleSession(session: any) {
    if (!session) return;
    
    try {
      const userTokenData = await this.getUserTokens(session.creator);
      if (!userTokenData) {
        return; // Skip if no tokens found
      }

      auth2Client.setCredentials({
        access_token: userTokenData.accessToken,
        refresh_token: userTokenData.refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: auth2Client });
      
      if (session.meetingId && session.status === 'completed') {
        await this.updateSessionLink(calendar, session);
        await this.handleOldSessions(session);
        
        // Check for existing attendance before trying to update
        const oldAttendance = await db.select({count: sql<number>`count(*)`})
          .from(zuvyStudentAttendance)
          .where(eq(zuvyStudentAttendance.meetingId, session.meetingId));
          
        if (oldAttendance[0].count === 0) {
          // Only fetch attendance if none exists
          const [errAtten, dataAttendance] = await this.getAttendanceByBatchId(session.batchId, session.creator);
          
          if (!errAtten && dataAttendance && 'data' in dataAttendance) {
            await db.insert(zuvyStudentAttendance).values({
              attendance: dataAttendance.data, 
              meetingId: session.meetingId, 
              batchId: session.batchId, 
              bootcampId: session.bootcampId 
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error in session ${session.id}: ${error.message}`);
    }
  }

  private async getUserTokens(email: string) {
    const result = await db
      .select()
      .from(userTokens)
      .where(eq(userTokens.userEmail, email))
      .limit(1);
    return result[0] || null;
  }

  private async updateSessionLink(calendar: any, session: any) {
    try {
      const eventDetails = await calendar.events.get({
        calendarId: 'primary',
        eventId: session.meetingId,
        fields: 'attachments' // Only request the needed fields
      });
      
      const videoAttachment = eventDetails.data.attachments?.find(
        (a: any) => a.mimeType === 'video/mp4'
      );
      let updatesession: any = { s3link: videoAttachment.fileUrl }
      if (videoAttachment) {
        await db.update(zuvySessions)
          .set(updatesession)
          .where(eq(zuvySessions.id, session.id));
      }
    } catch (error) {
      this.logger.error(`Error updating session link: ${error.message}`);
    }
  }

  private async handleOldSessions(session: any) {
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    if (new Date(session.startTime) < threeMonthsAgo) {
      let updatesession: any = { s3link: 'not found' };
      // Update the session to 'not found' if older than 3 months
      await db.update(zuvySessions)
        .set(updatesession)
        .where(eq(zuvySessions.id, session.id));
    }
  }

  private async getAttendanceByBatchId(batchId, creatorEmail: string) {
    try {
      // Simplified stub implementation since the original is commented out
      return [null, { data: [], status: 'success' }];
    } catch (error) {
      return [{ status: 'error', message: error.message }, null];
    }
  }

  // Run once daily instead of every 30 minutes
  @Cron(CronExpression.ONCE_A_DAY)
  async processPendingAssessmentSubmissions() {
    this.logger.log('Processing pending assessment submissions');
    
    try {
      // Get time threshold to reduce the number of processed submissions
      const timeThreshold = new Date();
      timeThreshold.setHours(timeThreshold.getHours() - 24); // Only process submissions from last 24 hours
      
      // Get pending submissions with time filtering
      const pendingSubmissions = await db.query.zuvyAssessmentSubmission.findMany({
        where: (submission, { and, isNull, gte }) => and(
          isNull(submission.submitedAt),
          gte(submission.startedAt, timeThreshold.toISOString())
        ),
        with: {
          submitedOutsourseAssessment: {
            columns: {
              timeLimit: true
            }
          }
        },
        columns: {
          id: true,
          userId: true,
          startedAt: true,
        }
      });
      
      this.logger.log(`Found ${pendingSubmissions.length} pending submissions`);
      
      // Process in smaller batches to reduce CPU load
      const batchSize = 10;
      for (let i = 0; i < pendingSubmissions.length; i += batchSize) {
        const batch = pendingSubmissions.slice(i, i + batchSize);
        
        // Process each submission in the batch
        await Promise.all(
          batch.map(async (submission:any) => {
            try {
              const startedAt = new Date(submission.startedAt);
              const timeLimit = submission?.submitedOutsourseAssessment?.timeLimit || 0;
              const submitTime = new Date(startedAt.getTime() + timeLimit * 60 * 1000);
              
              // Only auto-submit if time has passed
              if (submitTime < new Date()) {
                await this.submissionService.assessmentSubmission(
                  { typeOfsubmission: 'auto-submit by cron' },
                  submission.id,
                  submission.userId
                );
              }
            } catch (error) {
              this.logger.error(`Error processing submission ${submission.id}: ${error.message}`);
            }
          })
        );
        
        // Add a delay between batches to reduce CPU spikes
        if (i + batchSize < pendingSubmissions.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      this.logger.log('Completed processing pending submissions');
    } catch (error) {
      this.logger.error(`Error in processPendingAssessmentSubmissions: ${error.message}`);
    }
  }
}