import { Injectable, Logger } from '@nestjs/common';
import { zuvyStudentAttendance } from '../../drizzle/schema';
import { db } from '../db/index';
import { eq } from 'drizzle-orm';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  /**
   * Checks if an attendance record already exists for a specific meeting ID
   * @param meetingId The meeting ID to check
   * @returns Boolean indicating if record exists
   */
  async checkAttendanceExists(meetingId: string): Promise<boolean> {
    const existingRecord = await db
      .select()
      .from(zuvyStudentAttendance)
      .where(eq(zuvyStudentAttendance.meetingId, meetingId));
    
    return existingRecord.length > 0;
  }

  /**
   * Centralized function for saving or updating attendance records
   * @param attendanceData Object containing attendance details
   * @returns The created or updated record
   */
  async saveAttendanceRecord(attendanceData: {
    meetingId: string,
    attendance: any[],
    batchId: number,
    bootcampId: number
  }): Promise<any> {
    try {
      // Check if record already exists
      const exists = await this.checkAttendanceExists(attendanceData.meetingId);

      if (exists) {
        // Update existing record
        this.logger.log(`Updating existing attendance record for meeting ID: ${attendanceData.meetingId}`);
        return await db.update(zuvyStudentAttendance)
          .set({ attendance: attendanceData.attendance })
          .where(eq(zuvyStudentAttendance.meetingId, attendanceData.meetingId))
          .returning();
      } else {
        // Insert new record
        this.logger.log(`Inserting new attendance record for meeting ID: ${attendanceData.meetingId}`);
        return await db.insert(zuvyStudentAttendance)
          .values(attendanceData)
          .returning();
      }
    } catch (error) {
      this.logger.error(`Error saving attendance record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets an attendance record for a specific meeting ID if it exists
   * @param meetingId The meeting ID to retrieve
   * @returns The attendance record or null if not found
   */
  async getAttendanceRecord(meetingId: string): Promise<any> {
    try {
      const records = await db
        .select()
        .from(zuvyStudentAttendance)
        .where(eq(zuvyStudentAttendance.meetingId, meetingId));
      
      return records.length > 0 ? records[0] : null;
    } catch (error) {
      this.logger.error(`Error retrieving attendance record: ${error.message}`);
      throw error;
    }
  }
}
