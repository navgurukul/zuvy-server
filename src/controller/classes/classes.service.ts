import { Injectable, Req, Res, HttpStatus, Redirect,Logger } from '@nestjs/common';
import {
  userTokens,
  sansaarUserRoles,
  users,
  zuvyBatchEnrollments,
  zuvyStudentAttendance,
  zuvySessions,
  // ZuvyClassesGoogleMeetLink
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, count, inArray, isNull, desc } from 'drizzle-orm';
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
    batchId: number;
    bootcampId: number;
  },creatorInfo : any) {
    try {
      const userId = Number(creatorInfo.id)
      const fetchedTokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, userId));
      if (!fetchedTokens) {
        return { status: 'error', message: 'Unable to fetch tokens' };
      }
      auth2Client.setCredentials({
        access_token: fetchedTokens[0].accessToken,
        refresh_token: fetchedTokens[0].refreshToken,
      });
      if (!creatorInfo.email.endsWith('@zuvy.org')) {
        return {
          status: 'error',
          message: 'Unauthorized email id.'
        };
      }

      if (!creatorInfo.roles.includes('admin')) {
        return {
          status: 'error',
          message: 'You should be an admin to create a class.',
        };
      }

      const studentsInTheBatchEmails = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.batchId, eventDetails.batchId));

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
      let saveClassDetails;
      const createdEvent = await calendar.events.insert(eventData);
      try{
        saveClassDetails = await db
          .insert(zuvySessions)
          .values({
            hangoutLink: createdEvent.data.hangoutLink,
            creator: createdEvent.data.creator.email,
            startTime: createdEvent.data.start.dateTime,
            endTime: createdEvent.data.end.dateTime,
            batchId: eventDetails.batchId,
            bootcampId: eventDetails.bootcampId,
            title: createdEvent.data.summary,
            meetingId: createdEvent.data.id,
          })
          .returning();
      } catch (error) {
        return {
          status: 'error',
          message: 'Error saving class details to the database',
          error: error,
        };
      }
      if (saveClassDetails != undefined && saveClassDetails != null && saveClassDetails) {
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
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.batchId, batchId));

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
        .from(zuvySessions)
        .where(eq(zuvySessions.batchId, batchId));
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
      const allClasses = await db.select().from(zuvySessions);

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

  // async seedingClass(){
  //   const classesRow = await db.select().from(ZuvyClassesGoogleMeetLink);

  //   const newClassesData = classesRow.map((row) => {
  //     return {
  //         id: row.id,
  //         meetingId: row.meetingId,
  //         hangoutLink: row.hangoutLink,
  //         creator: row.creator,
  //         startTime: row.startTime,
  //         endTime: row.endTime ,
  //         batchId: parseInt(row.batchId),
  //         bootcampId: parseInt(row.bootcampId),
  //         title: row.title,
  //         s3link: row.s3link
  //     }
  //   });
  //   newClassesData.map(async (batch__) =>{
  //     try{
  //       await db.insert(zuvySessions).values(batch__);

  //     } catch (err){
  //       console.error(err)
  //     }
  //   })
  //   return { status: 'success', message: 'meetings to update', code: 200 };
  // }

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
    batch_id: string,
    status: string,
    limit: number,
    offset: number,
  ) {
    try {
      const currentTime = new Date();
      const classes = await db
        .select()
        .from(zuvySessions)
        .where(sql`${zuvySessions.batchId} = ${batch_id}`);

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

        if (currentTime > endTime && status === 'completed') {
          completedClasses.push(classObj);
        } else if (currentTime >= startTime && currentTime <= endTime && status === 'ongoing') {
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
        message: 'Classes fetched successfully by batch_id',
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
        .from(zuvySessions)
        .where(sql`${zuvySessions.id}=${id}`);
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
        .from(zuvySessions)
        .where(sql`${zuvySessions.id}=${id}`);
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
        .delete(zuvySessions)
        .where(sql`${zuvySessions.id} = ${id}`).then((res) => { });
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
        .update(zuvySessions)
        .set({ ...classData })
        .where(eq(zuvySessions.id, id))
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
      let classInfo = await db.select().from(zuvySessions).where(sql`${zuvySessions.meetingId}=${meeting_id}`);
      if (classInfo.length > 0) {
        const Meeting = await db.select().from(zuvyStudentAttendance).where(sql`${zuvyStudentAttendance.meetingId}=${meeting_id}`);
        let { bootcampId, batchId, s3link } = classInfo[0];
        let students = await db.select().from(zuvyBatchEnrollments).where(sql`${zuvyBatchEnrollments.batchId}=${batchId}`);

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
      let attendanceSheet = await db.select()
        .from(zuvyStudentAttendance)
        .where(eq(zuvyStudentAttendance.meetingId, meetingId));

      if (attendanceSheet.length > 0) {
        return [null, {
          attendanceSheet: attendanceSheet[0].attendance,
          status: 'success',
        }]
      }
      let classInfo = await db.select()
        .from(zuvySessions)
        .where(sql`${zuvySessions.meetingId}=${meetingId}`);

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
            .insert(zuvyStudentAttendance)
            .values({ meetingId, attendance: attendanceSheetData, batchId:classInfo[0]?.batchId, bootcampId: classInfo[0]?.bootcampId }).returning();
          if (zuvy_student_attendance.length > 0) {
            let batchStudets = attendanceSheetData
              .filter((student: any) => student.attendance === 'present')
              .map(student => student.email);
            let students = await db.select()
              .from(users)
              .where(inArray(users.email, [...batchStudets]))

            students.forEach(async (student) => {
              let old_attendance = await db.select()
                .from(zuvyBatchEnrollments)
                .where(sql`${zuvyBatchEnrollments.userId} = ${student.id.toString()}`);
              let new_attendance = old_attendance[0]?.attendance ? old_attendance[0].attendance + 1 : 1;
              let zuvyBatchEnrollmentsDetailsUpdated = await db
                .update(zuvyBatchEnrollments)
                .set({ attendance: new_attendance })
                .where(sql`${zuvyBatchEnrollments.userId} = ${student.id.toString()}`).returning();
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
        .from(zuvySessions)
        .where(sql`${zuvySessions.batchId} = ${batchId}`);
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


  async unattendanceClassesByBootcampId(bootcampId) {
    try {
      const classes = await db.select().from(zuvySessions).where(sql`${zuvySessions.bootcampId}=${bootcampId}`);
      let classIds = classes.map((classObj) => classObj.meetingId);
      let attendance = await db.select().from(zuvyStudentAttendance).where(inArray(zuvyStudentAttendance.meetingId, [...classIds]));
      let unattendedClassIds = classIds.filter((classId) => !attendance.some((attend) => attend.meetingId === classId));
      return { status: 'success', message: 'Classes fetched successfully by bootcampId', code: 200, unattendedClassIds: unattendedClassIds };
    } catch (error) {
      return { success: 'not success', message: 'Error fetching class Links', error: error };
    }
  }

  async updatingStatusOfClass(bootcamp_id:number){
    try {
      const currentTime = new Date();
      // Fetch all classes
      let classes = await db
        .select()
        .from(zuvySessions)
        .where(sql`${zuvySessions.bootcampId} = ${bootcamp_id}`);

      // Update the status of each class in the database
      for (let classObj of classes) {
        const startTime = new Date(classObj.startTime);
        const endTime = new Date(classObj.endTime);
        let newStatus;

        if (currentTime > endTime) {
          newStatus = 'completed';
        } else if (currentTime >= startTime && currentTime <= endTime) {
          newStatus = 'ongoing';
        } else if (currentTime < startTime) {
          newStatus = 'upcoming';
        }
        // Update the status in the database
        try {
          if (newStatus !== classObj.status) {
            let newObj = await db.update(zuvySessions).set({ status: newStatus }).where(eq(zuvySessions.id, classObj.id)).returning();
            Logger.log(`Status of class with id ${classObj.id} updated to ${newStatus}`);
          }
        } catch (error) {
        }
      }
    } catch (error) {
      console.log('Error fetching class Links', error);
      return {
        success: 'not success',
        message: 'Error fetching class Links',
        error: error,
      };
    }
  }
  async BootcampOrBatchEnrollments(batch_id: number, bootcamp_id: number, user_id = null) {
    let queryString;

    if (user_id && batch_id && bootcamp_id) { 
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} and ${zuvyBatchEnrollments.batchId} = ${batch_id} and ${zuvyBatchEnrollments.userId} = ${user_id}`;
    } else if (bootcamp_id && batch_id) {
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} and ${zuvyBatchEnrollments.batchId} = ${batch_id}`;
    } else {
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id}`;
    }
    return queryString
  }

  async getClassesBy(bootcamp_id: number, user, batch_id: number, limit: number, offset: number, search_term: string, status: string) {
    try {
      // update the status of the classes in the database
      await this.updatingStatusOfClass(bootcamp_id);
      
      if (user?.roles?.includes('admin')) {
      } else if (bootcamp_id && user.id) {
          let queryString = await this.BootcampOrBatchEnrollments(batch_id, bootcamp_id, user.id);
      
          let zuvyBatchEnrollmentsData = await db
            .select()
            .from(zuvyBatchEnrollments)
            .where(queryString);
      
          if (zuvyBatchEnrollmentsData.length === 0) {
            return {
              status: 'error',
              message:
                'No matching batch enrollments found for the provided bootcampId and userId',
              code: 404,
            };
          } 
        } else {
          return {
            status: 'error',
            message: 'Unauthorized access',
            code: 401,
          };
        }
    
      
        let zuvy_sessions_query;
        if (search_term && status && bootcamp_id && !batch_id) {
          if (status.toLowerCase() == 'all') {
            zuvy_sessions_query = sql`${zuvySessions.bootcampId} = ${bootcamp_id} AND ${zuvySessions.status} IN ('completed', 'ongoing', 'upcoming') AND ${zuvySessions.title} LIKE '%' ||${search_term} || '%'`;
          } else {
            zuvy_sessions_query = sql`${zuvySessions.bootcampId} = ${bootcamp_id} AND ${zuvySessions.status} = ${status} AND ${zuvySessions.title} LIKE '%' ||${search_term} || '%'`;
          }
        }else if (search_term && status && bootcamp_id && batch_id) {
          zuvy_sessions_query = sql`${zuvySessions.bootcampId} = ${bootcamp_id} AND ${zuvySessions.batchId} = ${batch_id} AND ${zuvySessions.status} = ${status} AND ${zuvySessions.title} LIKE '%' ||${search_term} || '%'`;
        } else if (search_term && status && bootcamp_id) {
          zuvy_sessions_query = sql`${zuvySessions.bootcampId} = ${bootcamp_id} AND ${zuvySessions.status} = ${status} AND ${zuvySessions.title} LIKE '%' ||${search_term} || '%'`;
        } else if (search_term && bootcamp_id && batch_id) {
          zuvy_sessions_query = sql`${zuvySessions.bootcampId} = ${bootcamp_id} AND ${zuvySessions.batchId} = ${batch_id} AND ${zuvySessions.title} LIKE '%' || ${search_term} || '%'`;
        } else if (bootcamp_id && batch_id && status.toLowerCase() == 'all') {
          zuvy_sessions_query = sql`${zuvySessions.bootcampId} = ${bootcamp_id} AND ${zuvySessions.status} IN ('completed', 'ongoing', 'upcoming') AND ${zuvySessions.batchId} = ${batch_id}`;
        } else if (bootcamp_id && batch_id && status) {
          zuvy_sessions_query = sql`${zuvySessions.bootcampId} = ${bootcamp_id} AND ${zuvySessions.batchId} = ${batch_id} AND ${zuvySessions.status} = ${status}`;
        } else if (bootcamp_id && !batch_id && status.toLowerCase() == 'all') {
          zuvy_sessions_query = sql`${zuvySessions.bootcampId} = ${bootcamp_id} AND ${zuvySessions.status} IN ('completed', 'ongoing', 'upcoming')`;
        } else if (bootcamp_id && !batch_id && status) {
          zuvy_sessions_query = sql`${zuvySessions.bootcampId} = ${bootcamp_id} AND ${zuvySessions.status} = ${status}`;
        } else if (bootcamp_id && !batch_id && !status) {
          zuvy_sessions_query = sql`${zuvySessions.bootcampId} = ${bootcamp_id} AND ${zuvySessions.status} IN ('completed', 'ongoing', 'upcoming')`;
        } else {
          zuvy_sessions_query = sql`${zuvySessions.bootcampId} = ${bootcamp_id}`;
        }
      // Fetch the classes again  
      
      let classes = await db
        .select()
        .from(zuvySessions)
        .orderBy(desc(zuvySessions.id))
        .where(() => zuvy_sessions_query)
        .offset(offset)
        .limit(limit);

      let total_zuvy_sessions = await db
        .select({ count: count(zuvySessions.id) })
        .from(zuvySessions)
        .where(() => zuvy_sessions_query);


      return {
        status: 'success',
        message: 'Classes fetched successfully by batchId',
        code: 200,
        classes, total_items: total_zuvy_sessions[0].count, total_pages: (Math.ceil(total_zuvy_sessions[0].count / limit) || 0)
      };
    } catch (err) {
      return { status: 'error', message: err.message, code: 500 }
    }
  }


}




