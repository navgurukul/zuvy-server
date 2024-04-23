import { Injectable, Req, Res, HttpStatus, Redirect } from '@nestjs/common';
import {
  bootcamps,
  batches,
  userTokens,
  classesGoogleMeetLink,
  sansaarUserRoles,
  users,
  batchEnrollments,
  zuvyStudentAttendance,
  zuvyMeetingAttendance,
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, count, inArray } from 'drizzle-orm';
import { google, calendar_v3 } from 'googleapis';
import { v4 as uuid } from 'uuid';
import { createReadStream } from 'fs';
import * as _ from 'lodash';
import Axios from 'axios';
import { S3 } from 'aws-sdk';
import { Cron } from '@nestjs/schedule';
const moment = require('moment-timezone');

const { OAuth2 } = google.auth;
let { GOOGLE_CLIENT_ID, GOOGLE_SECRET, GOOGLE_REDIRECT, ZUVY_REDIRECT_URL } = process.env

let auth2Client = new OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_SECRET,
  GOOGLE_REDIRECT
);


enum ClassStatus {
  COMPLETED = 'completed',
  ONGOING = 'ongoing',
  UPCOMING = 'upcoming',
}

interface Class {
  startTime: String;
  endTime: string;
}

const scopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
];

@Injectable()
export class ClassesService {
  // FETCHING ADMIN ROLES
  async getAdminDetails(userId) {
    try {
      let userDetails = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, userId));
      if (userDetails) {
        auth2Client.setCredentials({
          access_token: userDetails[0].accessToken,
          refresh_token: userDetails[0].refreshToken,
        });
      }
    } catch (error) {
      return {
        success: 'not success',
        message: 'Error fetching Admin details',
        error: error,
      };
    }
  }

  async googleAuthentication(@Res() res, userEmail: string, userId: number) {
    let url = auth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        ...scopes,
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/admin.reports.audit.readonly',
      ],
      prompt: 'consent',
      state: `redirect_uri=https://dev.api.zuvy.org/classes/redirect/+user_id=${userId}+user_email=${userEmail}`,
    });
    return res.send({ url });
  }

  async googleAuthenticationRedirect(@Req() req, @Res() res) {
    const { code } = req.query;
    const { tokens } = await auth2Client.getToken(code);
    auth2Client.setCredentials(tokens);
    const userData = await this.getUserData(auth2Client);
    await this.saveTokensToDatabase(tokens, userData);
    return `
      <a id="redirect-link" href="${ZUVY_REDIRECT_URL}" style="display: inline-block; padding: 15px 30px; background-color: #28a745; color: white; text-decoration: none; font-weight: bold; border-radius: 8px; box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1); transition: background-color 0.3s ease;">Visit Zuvy Again</a>
    <script>
      // Function to redirect after a delay
      function redirectWithDelay(url, delay) {
        setTimeout(function() {
          window.location.href = url;
        }, delay);
      }
      // Call the function with the desired URL and delay (0.01 seconds)
      redirectWithDelay('${ZUVY_REDIRECT_URL}', 10);
    </script>
  `
  }

  private async getUserData(auth2Client) {
    const oauth2 = google.oauth2({ version: 'v2', auth: auth2Client });
    const { data } = await oauth2.userinfo.get();
    return data;
  }

  async saveTokensToDatabase(tokens, userData) {
    try {
      const { access_token, refresh_token } = tokens;
      const accessToken = access_token;
      const refreshToken = refresh_token;
      const userEmail = userData.email;

      const existingUser = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userEmail, userEmail));

      const dbUserId = await db
        .select()
        .from(users)
        .where(eq(users.email, userEmail));
      const userId = Number(dbUserId[0].id);

      const creatorDetails = {
        accessToken,
        refreshToken,
        userId,
        userEmail,
      };
      if (existingUser.length == 0) {
        await db.insert(userTokens).values(creatorDetails).returning();
      } else {
        await db
          .update(userTokens)
          .set({ ...creatorDetails })
          .where(eq(userTokens.userEmail, userEmail))
          .returning();
      }
      return {
        success: 'success',
        message: 'Tokens saved to the database',
      };
    } catch (error) {
      return {
        success: 'not success',
        message: 'Error saving tokens to the database',
        error: error,
      };
    }
  }

  async createLiveBroadcast(eventDetails: {
    title: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    timeZone: string;
    attendees: string[];
    batchId: string;
    bootcampId: string;
    userId: number;
    roles: string[];
  }) {
    try {
      const fetchedTokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, eventDetails.userId));
      if (!fetchedTokens) {
        return { status: 'error', message: 'Unable to fetch tokens' };
      }
      auth2Client.setCredentials({
        access_token: fetchedTokens[0].accessToken,
        refresh_token: fetchedTokens[0].refreshToken,
      });

      if (eventDetails.roles.includes('admin') == false) {
        return {
          status: 'error',
          message: 'You should be an admin to create a class.',
        };
      }

      const studentsInTheBatchEmails = await db
        .select()
        .from(batchEnrollments)
        .where(eq(batchEnrollments.batchId, parseInt(eventDetails.batchId)));

      const studentsEmails = [];
      for (const studentEmail of studentsInTheBatchEmails) {
        try {
          const emailFetched = await db
            .select()
            .from(users)
            .where(eq(users.id, studentEmail.userId));
          if (emailFetched && emailFetched.length > 0) {
            studentsEmails.push({ email: emailFetched[0].email });
          }
        } catch (error) {
          return [
            { status: 'error', message: 'Fetching emails failed', code: 500 },
            null,
          ];
        }
      }

      const calendar = google.calendar({ version: 'v3', auth: auth2Client });
      const eventData = {
        calendarId: 'primary',
        conferenceDataVersion: 1,
        requestBody: {
          summary: eventDetails.title,
          description: eventDetails.description,
          start: {
            dateTime: moment(eventDetails.startDateTime)
              .subtract(5, 'hours')
              .subtract(30, 'minutes')
              .format(),
            timeZone: eventDetails.timeZone,
          },
          end: {
            dateTime: moment(eventDetails.endDateTime)
              .subtract(5, 'hours')
              .subtract(30, 'minutes')
              .format(),
            timeZone: eventDetails.timeZone,
          },

          attendees: studentsEmails,
          conferenceData: {
            createRequest: {
              conferenceSolutionKey: {
                type: 'hangoutsMeet',
              },
              requestId: uuid(),
            },
          },
        },
      };

      const createdEvent = await calendar.events.insert(eventData);

      const saveClassDetails = await db
        .insert(classesGoogleMeetLink)
        .values({
          meetingId: createdEvent.data.id,
          hangoutLink: createdEvent.data.hangoutLink,
          creator: createdEvent.data.creator.email,
          startTime: createdEvent.data.start.dateTime,
          endTime: createdEvent.data.end.dateTime,
          batchId: eventDetails.batchId,
          bootcampId: eventDetails.bootcampId,
          title: createdEvent.data.summary,
        })
        .returning();
      if (saveClassDetails) {
        return {
          status: 'success',
          message: 'Created Class successfully',
          code: 200,
          saveClassDetails: saveClassDetails,
        };
      } else {
        return { success: 'not success', message: 'Classs creation failed' };
      }
    } catch (error) {
      return {
        status: 'not success',
        message: 'error creating class',
        error: error,
      };
    }
  }

  async getAttendanceByBatchId(batchId: any, userData) {
    try {
      const fetchedStudents = await db
        .select()
        .from(batchEnrollments)
        .where(eq(batchEnrollments.batchId, batchId));

      const fetchedTokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, userData[0].id));

      if (!fetchedTokens || fetchedTokens.length === 0) {
        return { status: 'error', message: 'Unable to fetch tokens' };
      }
      const auth2Client = new google.auth.OAuth2();
      auth2Client.setCredentials({
        access_token: fetchedTokens[0].accessToken,
        refresh_token: fetchedTokens[0].refreshToken,
      });

      const client = google.admin({ version: 'reports_v1', auth: auth2Client });
      const allMeetings = await db
        .select()
        .from(classesGoogleMeetLink)
        .where(eq(classesGoogleMeetLink.batchId, batchId));
      const attendanceByTitle = {};

      for (const singleMeeting of allMeetings) {
        const response = await client.activities.list({
          userKey: 'all',
          applicationName: 'meet',
          eventName: 'call_ended',
          maxResults: 1000,
          filters: `calendar_event_id==${singleMeeting.meetingId}`,
        });

        const meetingAttendance = {};

        for (const student of fetchedStudents) {
          const emailFetched = await db
            .select()
            .from(users)
            .where(sql`${users.id} = ${student.userId}`);
          meetingAttendance[emailFetched[0].email] = {
            email: emailFetched[0].email,
          };
        }

        const extractedData = response.data.items.map((item) => {
          const event = item.events[0];
          const durationSeconds =
            event.parameters.find((param) => param.name === 'duration_seconds')
              ?.intValue || '';
          const email =
            event.parameters.find((param) => param.name === 'identifier')
              ?.value || '';
          const attendanceStatus = durationSeconds ? 'present' : 'absent';
          if (!meetingAttendance[email]) {
            meetingAttendance[email] = {};
          }

          meetingAttendance[email][
            `meeting_${singleMeeting.title}_duration_seconds`
          ] = durationSeconds;
          meetingAttendance[email][
            `meeting_${singleMeeting.title}_attendance`
          ] = attendanceStatus;

          return {
            email,
            duration: durationSeconds,
            attendance: attendanceStatus,
          };
        });

        Object.values(meetingAttendance).forEach((student) => {
          const email = student['email'];
          if (!attendanceByTitle[email]) {
            attendanceByTitle[email] = {};
          }
          Object.assign(attendanceByTitle[email], student);
        });
      }

      const formattedAttendance = Object.values(attendanceByTitle);
      return { attendanceByTitle: formattedAttendance, status: 'success' };
    } catch (error) {
      throw new Error(`Error executing request: ${error.message}`);
    }
  }

  async getAllClasses(): Promise<any> {
    try {
      const allClasses = await db.select().from(classesGoogleMeetLink);

      const classifiedClasses = this.classifyClasses(allClasses);

      return [null, { allClasses, classifiedClasses }];
    } catch (e) {
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async classifyClasses(classes: Class[]): Promise<ClassStatus[]> {
    const now = new Date();

    return _.map(classes, (classItem) => {
      const classStartTime = classItem.startTime;
      const classEndTime = classItem.endTime;
      const startTime = classStartTime.toISOString().split('T')[0];
      const endTime = classEndTime.toISOString().split('T')[0];

      if (endTime < now) {
        return ClassStatus.COMPLETED;
      } else if (startTime <= now && endTime >= now) {
        return ClassStatus.ONGOING;
      } else {
        return ClassStatus.UPCOMING;
      }
    });
  }


  @Cron('*/3 * * * *')
  async getEventDetails(@Req() req): Promise<any> {
    try {
      const fetchedTokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, req.user[0].id));
      if (!fetchedTokens) {
        return { status: 'error', message: 'Unable to fetch tokens' };
      }
      auth2Client.setCredentials({
        access_token: fetchedTokens[0].accessToken,
        refresh_token: fetchedTokens[0].refreshToken,
      });
      const calendar = google.calendar({ version: 'v3', auth: auth2Client });
      const allClasses = await db.select().from(classesGoogleMeetLink);
      for (const classData of allClasses) {
        if (classData.meetingId != null) {
          if (classData.s3link == null) {
            const response = await calendar.events.get({
              calendarId: 'primary',
              eventId: classData.meetingId,
            });
            if (response.data.attachments) {
              for (const attachment of response.data.attachments) {
                if (attachment.mimeType == 'video/mp4') {
                  // const s3Url = await this.uploadVideoFromGoogleDriveToS3(attachment.fileUrl,attachment.fileId)
                  let updatedS3Url = await db
                    .update(classesGoogleMeetLink)
                    .set({ ...classData, s3link: attachment.fileUrl })
                    .where(eq(classesGoogleMeetLink.id, classData.id))
                    .returning();
                  return {
                    status: 'success',
                    message: 'Meeting  updated successfully',
                    code: 200,
                    meetingDetails: updatedS3Url,
                  };
                }
              }
            }
          }
        }
      }
      return { status: 'success', message: 'No meetings to update', code: 200 };
    } catch (error) {
      return { status: 'failure', error: error };
    }
  }


  private async uploadVideoToS3(
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<string> {
    try {
      const s3 = new S3({
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_KEY_ACCESS,
      });
      const bucketName = process.env.S3_BUCKET_NAME;
      const s3Key = `class-recordings/${fileName}`;
      await s3
        .upload({
          Bucket: bucketName,
          Key: s3Key,
          Body: fileBuffer,
        })
        .promise();
      const s3Url = `https://${bucketName}.s3.amazonaws.com/${s3Key}`;
      return s3Url;
    } catch (error) {
      throw new Error('Error uploading video to S3');
    }
  }
  async getClassesByBootcampId(
    bootcampId: string,
    limit: number,
    offset: number,
  ) {
    try {
      const currentTime = new Date();
      const classes = await db
        .select()
        .from(classesGoogleMeetLink)
        .where(sql`${classesGoogleMeetLink.bootcampId} = ${bootcampId}`);

      const sortedClasses = _.orderBy(
        classes,
        (classObj) => new Date(classObj.startTime),
        'desc',
      );
      const completedClasses = [];
      const ongoingClasses = [];
      const upcomingClasses = [];

      for (const classObj of sortedClasses) {
        const startTime = new Date(classObj.startTime);
        const endTime = new Date(classObj.endTime);

        if (currentTime > endTime) {
          completedClasses.push(classObj);
        } else if (currentTime >= startTime && currentTime <= endTime) {
          ongoingClasses.push(classObj);
        } else {
          upcomingClasses.push(classObj);
        }
      }
      const paginatedCompletedClasses = completedClasses.slice(
        (offset - 1) * limit,
        (offset - 1) * limit + limit,
      );
      const paginatedOngoingClasses = ongoingClasses.slice(
        (offset - 1) * limit,
        (offset - 1) * limit + limit,
      );
      const paginatedUpcomingClasses = upcomingClasses.slice(
        (offset - 1) * limit,
        (offset - 1) * limit + limit,
      );

      return {
        status: 'success',
        message: 'Classes fetched successfully by bootcampId',
        code: 200,
        completedClasses: paginatedCompletedClasses,
        ongoingClasses: paginatedOngoingClasses,
        upcomingClasses: paginatedUpcomingClasses,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Error fetching class Links',
        error: error.message,
      };
    }
  }

  async getAttendeesByMeetingId(id: number) {
    try {
      const attendeesList = await db
        .select()
        .from(classesGoogleMeetLink)
        .where(sql`${classesGoogleMeetLink.id}=${id}`);
      return { status: 'success', message: 'attendees fetched successfully' };
    } catch (error) {
      return {
        status: 'error',
        message: 'Error fetching attendees',
        error: error,
      };
    }
  }

  async getMeetingById(id: number) {
    try {
      const classDetails = await db
        .select()
        .from(classesGoogleMeetLink)
        .where(sql`${classesGoogleMeetLink.id}=${id}`);
      if (classDetails.length === 0) {
        return { status: 'error', message: 'class not found', code: 404 };
      }
      return {
        status: 'success',
        message: 'class fetched successfully',
        code: 200,
        class: classDetails[0],
      };
    } catch (error) {
      return { status: 'error', message: 'Error fetching class', error: error };
    }
  }

  async deleteMeetingById(id: number) {
    try {
      db
        .delete(classesGoogleMeetLink)
        .where(sql`${classesGoogleMeetLink.id} = ${id}`).then((res) => { });
      return {
        status: 'success',
        message: 'Meeting deleted successfully ',
        code: 200,
      };
    } catch (error) {
      return {
        success: 'not success',
        message: 'Error deleting meeting',
        error: error,
      };
    }
  }

  async updateMeetingById(id: number, classData: any): Promise<object> {
    try {
      let updatedMeeting = await db
        .update(classesGoogleMeetLink)
        .set({ ...classData })
        .where(eq(classesGoogleMeetLink.id, id))
        .returning();
      return {
        status: 'success',
        message: 'Meeting  updated successfully',
        code: 200,
        meetingDetails: updatedMeeting,
      };
    } catch (e) {
      return { status: 'error', message: e.message, code: 405 };
    }
  }

  async meetingAttendanceAnalytics(meeting_id: string, user) {
    try {
      await this.getAttendance(meeting_id, user);
      let classInfo = await db.select().from(classesGoogleMeetLink).where(sql`${classesGoogleMeetLink.meetingId}=${meeting_id}`);
      if (classInfo.length > 0) {
        const Meeting = await db.select().from(zuvyStudentAttendance).where(sql`${zuvyStudentAttendance.meetingId}=${meeting_id}`);
        let { bootcampId, batchId, s3link } = classInfo[0];
        let students = await db.select().from(batchEnrollments).where(sql`${batchEnrollments.batchId}=${batchId}`);

        let attendance: Array<any> = Meeting[0]?.attendance as Array<any> || [];
        let no_of_students = students.length > attendance.length ? students.length : attendance.length;
        let present = attendance.filter((student) => student?.attendance === 'present').length;

        return [null, { status: 'success', message: 'Meetings fetched successfully', studentsInfo: { total_students: no_of_students, present: present, s3link: s3link } }];
      } else {
        return [{ status: 'error', message: 'Meeting not found', code: 404 }];
      }
    } catch (error) {
      return [{
        status: 'error',
        message: 'Error fetching meetings',
        error: error.message,
      }];
    }
  }

  async getAttendance(meetingId, user = null): Promise<any> {
    try {
      let attendanceSheet = await db.select().from(zuvyStudentAttendance).where(eq(zuvyStudentAttendance.meetingId, meetingId));
      if (attendanceSheet.length > 0) {
        return [null, {
          attendanceSheet: attendanceSheet[0].attendance,
          status: 'success',
        }]
      }
      let classInfo = await db.select().from(classesGoogleMeetLink).where(sql`${classesGoogleMeetLink.meetingId}=${meetingId}`);
      if (classInfo.length == 0) {
        return [{ status: 'error', message: 'Meeting not found', code: 404 }];
      }
      const fetchedTokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, user.id));
      if (!fetchedTokens || fetchedTokens.length === 0) {
        return { status: 'error', message: 'Unable to fetch tokens' };
      }

      auth2Client.setCredentials({
        access_token: fetchedTokens[0].accessToken,
        refresh_token: fetchedTokens[0].refreshToken,
      });
      const client = google.admin({ version: 'reports_v1', auth: auth2Client });
      const response = await client.activities.list({
        userKey: 'all',
        applicationName: 'meet',
        eventName: 'call_ended',
        maxResults: 1000,
        filters: `calendar_event_id==${meetingId}`,
      }).catch((error) => {
        throw new Error(`Error executing request: ${error.message}`);
      });
      if (response.data.items) {
        response.data.items.forEach((item) => {
          const event = item.events[0];
          const durationSeconds =
            event.parameters.find((param) => param.name === 'duration_seconds')
              ?.intValue || '';
          const email =
            event.parameters.find((param) => param.name === 'identifier')
              ?.value || '';

          if (email in attendanceSheet) {
            attendanceSheet[email] += parseInt(durationSeconds) || 0;
          } else {
            attendanceSheet[email] = parseInt(durationSeconds) || 0;
          }
        });
        const zuvyEmail = attendanceSheet['team@zuvy.org'];
        const totalDuration = zuvyEmail || 0;
        const threshold = 0.7 * totalDuration;
        const mergedAttendance = Object.entries(attendanceSheet).map(
          ([email, duration]) => ({ email, duration }),
        );
        for (const attendance of mergedAttendance) {
          if (attendance.email !== 'team@zuvy.org') {
            attendance['attendance'] =
              Number(attendance.duration) >= threshold ? 'present' : 'absent';
          }
        }
        let attendanceSheetData = mergedAttendance.filter(
          (attendance) => attendance.email !== 'team@zuvy.org',
        )
        if (attendanceSheetData.length > 0) {
          const zuvy_student_attendance = await db
            .insert(zuvyStudentAttendance).values({ meetingId, attendance: attendanceSheetData, batchId: parseInt(classInfo[0]?.batchId), bootcampId: parseInt(classInfo[0]?.bootcampId) }).returning();
          if (zuvy_student_attendance.length > 0) {
            let batchStudets = attendanceSheetData
              .filter((student: any) => student.attendance === 'present')
              .map(student => student.email);
            let students = await db.select().from(users).where(inArray(users.email, [...batchStudets])) //.where(sql`${users.email} in ${batchStudets}`);
            let total_classes: any = await db.select().from(zuvyStudentAttendance).where(sql`${zuvyStudentAttendance.batchId} = ${parseInt(classInfo[0]?.batchId)}`); // 4
            students.forEach(async (student) => {
              let studentAttendance: any = attendanceSheetData.find(attendance => attendance.email === student.email);
              let old_attendance = await db.select().from(batchEnrollments).where(sql`${batchEnrollments.userId} = ${student.id.toString()}`);
              let new_attendance = old_attendance[0]?.attendance ? old_attendance[0].attendance + 1 : 1;
              let batchEnrollmentsDetailsUpdated = await db
                .update(batchEnrollments)
                .set({ attendance: new_attendance })
                .where(sql`${batchEnrollments.userId} = ${student.id.toString()}`).returning();
              console.log('Attendance updated in batchEnrollments  successfully:');
            });
          }
          return [null, {
            attendanceSheetData,
            status: 'success',
          }];
        }
      }
      return [{ status: 'error', message: 'No attendance found', code: 404 }];
    } catch (error) {
      return [{ status: 'error', message: error.message, code: 402 }];
    }
  }

  async getClassesByBatchId(batchId: string, limit: number, offset: number) {
    try {
      const currentTime = new Date();

      const classes = await db
        .select()
        .from(classesGoogleMeetLink)
        .where(sql`${classesGoogleMeetLink.batchId} = ${batchId}`);
      const sortedClasses = _.orderBy(
        classes,
        (classObj) => new Date(classObj.startTime),
        'desc',
      );
      const completedClasses = [];
      const ongoingClasses = [];
      const upcomingClasses = [];

      for (const classObj of sortedClasses) {
        const startTime = new Date(classObj.startTime);
        const endTime = new Date(classObj.endTime);

        if (currentTime > endTime) {
          completedClasses.push(classObj);
        } else if (currentTime >= startTime && currentTime <= endTime) {
          ongoingClasses.push(classObj);
        } else {
          upcomingClasses.push(classObj);
        }
      }
      const paginatedCompletedClasses = completedClasses.slice(
        (offset - 1) * limit,
        (offset - 1) * limit + limit,
      );
      const paginatedOngoingClasses = ongoingClasses.slice(
        (offset - 1) * limit,
        (offset - 1) * limit + limit,
      );
      const paginatedUpcomingClasses = upcomingClasses.slice(
        (offset - 1) * limit,
        (offset - 1) * limit + limit,
      );
      return {
        status: 'success',
        message: 'Classes fetched successfully by batchId',
        code: 200,
        completedClasses: paginatedCompletedClasses,
        ongoingClasses: paginatedOngoingClasses,
        upcomingClasses: paginatedUpcomingClasses,
      };
    } catch (error) {
      return {
        success: 'not success',
        message: 'Error fetching class Links',
        error: error,
      };
    }
  }

  async uploadVideoFromGoogleDriveToS3(
    googleDriveLink: string,
    fileId: string,
  ): Promise<string> {
    try {
      const response = await Axios.get(googleDriveLink, {
        responseType: 'arraybuffer',
      });
      const fileBuffer = Buffer.from(response.data);

      const s3Url = await this.uploadVideoToS3(fileBuffer, fileId);

      return s3Url;
    } catch (error) {
      throw new Error('Error uploading video from Google Drive to S3');
    }
  }

  async meetingAttendance(meetingId: number): Promise<any> {
    try {
      const allMeets = await db.select().from(classesGoogleMeetLink);
      for (const meet of allMeets) {
        const isMarked = await db
          .select()
          .from(zuvyMeetingAttendance)
          .where(eq(zuvyMeetingAttendance.meetingId, meet.meetingId));
        if (isMarked.length == 0) {
          const fetchedAttendance = await this.getAttendance(meet.meetingId);
          const fetchedAttendanceList = fetchedAttendance.attendanceSheet;
          const totalMeetsMarked = await db
            .select()
            .from(zuvyMeetingAttendance)
            .where(eq(zuvyMeetingAttendance.batchid, meet.batchId));
          const totalMeetsMarkedLength = totalMeetsMarked.length;
          const fetchedStudents = await db
            .select()
            .from(batchEnrollments)
            .where(sql`${batchEnrollments.batchId}=${meet.batchId}`);
          for (const student of fetchedStudents) {
            const studentDetails = await db
              .select()
              .from(users)
              .where(sql`${users.id} = ${student.userId}`);
            const studentEmail = studentDetails[0].email;
            const isPresent = fetchedAttendanceList.some(
              (entry) => entry.email === studentEmail,
            );
            if (isPresent) {
              const studentAttendanceDetails = fetchedAttendanceList.find(
                (entry) => entry.email === studentEmail,
              );
              const attendancePercentage = await db
                .select()
                .from(batchEnrollments)
                .where(sql`${batchEnrollments.userId}=${student.userId}`);
              const fetchedAttendancePercentage =
                attendancePercentage[0].attendance;
              if (fetchedAttendancePercentage != null) {
                if (studentAttendanceDetails['attendance'] == 'absent') {
                  const calculatedPercentage = ~~(
                    (attendancePercentage[0].attendance *
                      totalMeetsMarkedLength) /
                    (totalMeetsMarkedLength + 1)
                  );
                  const updateAttendance = await db
                    .update(batchEnrollments)
                    .set({
                      attendance: calculatedPercentage,
                      classesAttended:
                        attendancePercentage[0].classesAttended + 1,
                    })
                    .where(sql`${batchEnrollments.userId}=${student.userId}`);
                } else {
                  const calculatedPercentage = ~~(
                    (attendancePercentage[0].attendance *
                      totalMeetsMarkedLength +
                      100) /
                    (totalMeetsMarkedLength + 1)
                  );
                  const updateAttendance = await db
                    .update(batchEnrollments)
                    .set({
                      attendance: calculatedPercentage,
                      classesAttended:
                        attendancePercentage[0].classesAttended + 1,
                    })
                    .where(sql`${batchEnrollments.userId}=${student.userId}`);
                }
              } else {
                if (studentAttendanceDetails['attendance'] == 'absent') {
                  const percentage = 0;
                  const classes = 1;
                  const updateAttendance = await db
                    .update(batchEnrollments)
                    .set({ attendance: percentage, classesAttended: classes })
                    .where(sql`${batchEnrollments.userId}=${student.userId}`);
                } else {
                  const percentage = 100;
                  const classes = 1;
                  const updateAttendance = await db
                    .update(batchEnrollments)
                    .set({ attendance: percentage, classesAttended: classes })
                    .where(sql`${batchEnrollments.userId}=${student.userId}`);
                }
              }
            } else {
              const attendancePercentage = await db
                .select()
                .from(batchEnrollments)
                .where(sql`${batchEnrollments.userId}=${student.userId}`);
              if (attendancePercentage.length > 0) {
                const fetchedAttendancePercentage =
                  attendancePercentage[0].attendance;
                if (fetchedAttendancePercentage == null) {
                  const percentage = 0;
                  const classes = 1;
                  const updateAttendance = await db
                    .update(batchEnrollments)
                    .set({ attendance: percentage, classesAttended: classes })
                    .where(sql`${batchEnrollments.userId}=${student.userId}`);
                } else {
                  const attendancePercentage = await db
                    .select()
                    .from(batchEnrollments)
                    .where(sql`${batchEnrollments.userId}=${student.userId}`);
                  const fetchedAttendancePercentage =
                    attendancePercentage[0].attendance;
                  if (fetchedAttendancePercentage != null) {
                    const calculatedPercentage = ~~(
                      (attendancePercentage[0].attendance *
                        totalMeetsMarkedLength) /
                      (totalMeetsMarkedLength + 1)
                    );
                    const updateAttendance = await db
                      .update(batchEnrollments)
                      .set({
                        attendance: calculatedPercentage,
                        classesAttended:
                          attendancePercentage[0].classesAttended + 1,
                      })
                      .where(sql`${batchEnrollments.userId}=${student.userId}`);
                  } else {
                    const percentage = 0;
                    const classes = 1;
                    const updateAttendance = await db
                      .update(batchEnrollments)
                      .set({ attendance: percentage, classesAttended: classes })
                      .where(sql`${batchEnrollments.userId}=${student.userId}`);
                  }
                }
              }
            }
          }
          const updateMeetingDetails = await db
            .insert(zuvyMeetingAttendance)
            .values({
              meetingId: meet.meetingId,
              bootcampid: meet.bootcampId,
              batchid: meet.batchId,
            })
            .returning();
        }
      }
      return { success: true };
    } catch (err) {
      return { error: err, success: false };
    }
  }

}
