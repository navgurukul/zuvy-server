import {
  Injectable,
  Req,
  Res,
  HttpStatus,
  Redirect,
  Logger,
} from '@nestjs/common';
import {
  userTokens,
  sansaarUserRoles,
  users,
  zuvyBatchEnrollments,
  zuvyStudentAttendance,
  zuvySessions,
  zuvyBatches,
  zuvyBootcamps,
  zuvySessionRecordViews,
  // ZuvyClassesGoogleMeetLink
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import {
  eq,
  sql,
  count,
  inArray,
  isNull,
  desc,
  and,
  ilike,
  or,
} from 'drizzle-orm';
import { google, calendar_v3 } from 'googleapis';
import { v4 as uuid } from 'uuid';
import * as _ from 'lodash';
import { S3 } from 'aws-sdk';
import { Console } from 'console';
//import {client_email,private_key} from '../../service-account.json'
const moment = require('moment-timezone');


const { OAuth2 } = google.auth;
let { GOOGLE_CLIENT_ID, GOOGLE_SECRET, GOOGLE_REDIRECT, ZUVY_REDIRECT_URL } =
  process.env;

let auth2Client = new OAuth2(GOOGLE_CLIENT_ID, GOOGLE_SECRET, GOOGLE_REDIRECT);
// const jwtttt = new google.auth.JWT({
//   email:   client_email,
//   key:     private_key,
//   scopes: [
//     'https://www.googleapis.com/auth/drive.metadata.readonly',
//     'https://www.googleapis.com/auth/calendar.events.readonly',
//   ],
//   subject: 'arunesh@navgurukul.org'
// });
enum ClassStatus {
  COMPLETED = 'completed',
  ONGOING = 'ongoing',
  UPCOMING = 'upcoming',
}

interface Class {
  startTime: String;
  endTime: string;
  views?: any; // Add this line to include the views property
}

interface ClassDetails {
  id: number;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
  recurringId: number;
  meetingId: string;
  hangoutLink: string;
  creator: string;
  bootcampId: number;
  batchId: number;
  s3link: string;
  views?: any; // Add this line to include the views property
}

const scopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
];

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  async accessOfCalendar(creatorInfo) {
    const userId = Number(creatorInfo.id);
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
        message: 'Unauthorized email id.',
      };
    }

    if (!creatorInfo.roles?.includes('admin')) {
      return {
        status: 'error',
        message: 'You should be an admin to create a class.',
      };
    }
    const calendar = google.calendar({ version: 'v3', auth: auth2Client });
    return calendar;
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
  `;
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

  async createSession(
    eventDetails: {
      title: string;
      description?: string;
      startDateTime: string;
      endDateTime: string;
      timeZone: string;
      batchId: number;
      daysOfWeek: string[]; // New field: array of days (e.g., ['Monday', 'Wednesday', 'Friday'])
      totalClasses: number; // New field: total number of classes
    },
    creatorInfo: any,
  ) {
    try {
      // Mapping days of the week to moment.js day indices
      const dayToMomentDay: { [key: string]: number } = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
      };

      // Validate totalClasses
      if (eventDetails?.totalClasses <= 0) {
        return {
          status: 'error',
          message: 'Total classes should be greater than 0',
        };
      }

      const startDateTime__ = new Date(eventDetails.startDateTime);
      const presentTime = new Date();

      // Validate start and end date times
      if (startDateTime__ >= new Date(eventDetails.endDateTime)) {
        return {
          status: 'error',
          message: 'Start date and time should be less than end date and time',
        };
      }

      if (startDateTime__ <= presentTime) {
        return {
          status: 'error',
          message:
            'Start date and time should be greater than the present time',
        };
      }

      // Validate daysOfWeek and totalClasses
      if (eventDetails?.daysOfWeek.length > 0) {
        const startDay = new Date(eventDetails.startDateTime).getDay();
        const daysOfWeek = eventDetails.daysOfWeek.map(
          (day) => dayToMomentDay[day],
        );

        if (!daysOfWeek.includes(startDay)) {
          return {
            status: 'error',
            message:
              'Start date should be one of the specified days of the week',
          };
        }

        if (eventDetails?.totalClasses < eventDetails?.daysOfWeek.length) {
          return {
            status: 'error',
            message:
              'Total classes should be greater than the number of days of the week',
          };
        }
      }

      // Fetch batch information
      let batchInfo = await db
        .select()
        .from(zuvyBatches)
        .where(eq(zuvyBatches.id, eventDetails.batchId));
      if (batchInfo.length === 0) {
        return {
          status: 'error',
          message: 'Batch not found',
          code: 404,
        };
      }
      let bootcampId = batchInfo[0].bootcampId;

      // Access calendar
      let calendar: any = await this.accessOfCalendar(creatorInfo);

      // Fetch students' emails in the batch
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

      // Function to get the next class date
      const getNextClassDate = (
        startDate: any,
        day: string,
        occurrence: number,
      ) => {
        const dayIndex = dayToMomentDay[day];
        let nextDate = startDate.clone().day(dayIndex);
        if (nextDate.isBefore(startDate)) {
          nextDate.add(1, 'week');
        }
        nextDate.add(occurrence, 'week');
        return nextDate;
      };

      const startDateTime = moment(eventDetails.startDateTime);
      const endDateTime = moment(eventDetails.endDateTime);

      const classes = [];
      let classCount = 0;
      let occurrence = 0;

      // Generate class dates
      while (classCount < eventDetails.totalClasses) {
        for (const day of eventDetails.daysOfWeek) {
          if (classCount >= eventDetails.totalClasses) break;
          const classStartDateTime = getNextClassDate(
            startDateTime,
            day,
            occurrence,
          );
          const classEndDateTime = classStartDateTime
            .clone()
            .add(endDateTime.diff(startDateTime));

          classes.push({
            startDateTime: classStartDateTime.format(),
            endDateTime: classEndDateTime.format(),
          });

          classCount++;
        }
        occurrence++;
      }

      // Create the initial event with recurrence rules
      const firstEvent = classes[0];
      const recurrenceRule = `RRULE:FREQ=WEEKLY;COUNT=${eventDetails.totalClasses};BYDAY=${eventDetails.daysOfWeek.map((day) => day.slice(0, 2).toUpperCase()).join(',')}`;
      const eventData = {
        calendarId: 'primary',
        conferenceDataVersion: 1,
        requestBody: {
          summary: eventDetails.title,
          description: eventDetails.description,
          start: {
            dateTime: moment(firstEvent.startDateTime)
              .subtract(5, 'hours')
              .subtract(30, 'minutes')
              .format(),
            timeZone: eventDetails.timeZone,
          },
          end: {
            dateTime: moment(firstEvent.endDateTime)
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
          recurrence: [recurrenceRule],
        },
      };

      const createdEvent = await calendar.events.insert(eventData);

      // Fetch instances of the recurring event
      const instances = await calendar.events.instances({
        calendarId: 'primary',
        eventId: createdEvent.data.id,
      });

      let totalClasses = [];

      // Map instances to class details
      instances.data.items.map((instance) => {
        totalClasses.push({
          hangoutLink: instance.hangoutLink,
          creator: instance.creator.email,
          startTime: instance.start.dateTime,
          endTime: instance.end.dateTime,
          batchId: eventDetails.batchId,
          bootcampId,
          title: instance.summary,
          meetingId: instance.id,
        });
      });

      // Save class details to the database
      const savedClassDetail = await db
        .insert(zuvySessions)
        .values(totalClasses)
        .returning();

      if (savedClassDetail.length > 0) {
        return {
          status: 'success',
          message: 'Created Classes successfully',
          code: 200,
          savedClassDetail: savedClassDetail,
        };
      } else {
        return { success: 'not success', message: 'Class creation failed' };
      }
    } catch (error) {
      Logger.log(`error: ${error.message}`);
      return {
        status: 'not success',
        message: 'error creating class',
        error: error,
      };
    }
  }

  // async calculateAttendance(meetings: any[], students: any[]) {
  //     const attendanceByTitle: Record<string, any> = {};
      
  //     const client = google.admin({ version: 'reports_v1', auth: auth2Client });
      
      
  //     for (const meeting of meetings) {
  //       const response = await client.activities.list({
  //         userKey:         'all',
  //         applicationName: 'meet',
  //         eventName:       'call_ended',
  //         maxResults:      1000,
  //         filters:         `calendar_event_id==${meeting.meetingId}`,
  //       });
  //       const items = response.data.items || [];
    
  //       // 2️⃣ Extract the host’s email from the first log entry
  //       const organizerParam = items[0].events?.[0].parameters?.find(p => p.name === 'organizer_email');
  //       const hostEmail = organizerParam?.value; 
  //       console.log("hostEmail",hostEmail)  
  //       const jwtClient = new google.auth.JWT({
  //         email:   client_email,
  //         key:     private_key,
  //         scopes: [
  //           'https://www.googleapis.com/auth/drive.metadata.readonly',
  //           'https://www.googleapis.com/auth/calendar.events.readonly',
  //         ],
  //         subject: hostEmail
  //       })
  //       await jwtClient.authorize();
  //       const calendar = google.calendar({ version: 'v3', auth: jwtClient });
  //       const drive    = google.drive({ version: 'v3', auth: jwtClient });
  //       const { data: event } = await calendar.events.get({
  //         calendarId: 'primary',
  //         eventId:    meeting.meetingId,
  //         fields:     'attachments(fileId,mimeType)',
  //       });
  //       console.log("eventlog",event.attachments)
  //       const videoAttach = event.attachments?.find(
  //         (a: any) => a.mimeType === 'video/mp4'
  //       );
  //       if (!videoAttach) {
  //         console.warn(`No recording for ${meeting.meetingId}, skipping.`);
  //         continue;
  //       }
    
  //       // 3️⃣ Fetch the recording’s duration from Drive metadata
  //       const { data: fileMeta } = await drive.files.get({
  //         fileId: videoAttach.fileId,
  //         fields: 'videoMediaMetadata(durationMillis)'
  //       });
  //       const durationMillisStr = fileMeta.videoMediaMetadata?.durationMillis;
  
  //       const durationMillis = Number(durationMillisStr) || 0;
  
  //       const totalSeconds = durationMillis / 1000;
  //      console.log("totalSeconds",totalSeconds)
  //     const cutoff       = totalSeconds * 0.75;
  //     const attendance: Record<string, { email: string; duration: number; attendance: string }> = {};
  //     for (const student of students) {
  //       const user = await db
  //           .select()
  //           .from(users)
  //           .where(sql`${users.id} = ${BigInt(student.userId)}`);
  
  //         attendance[user[0].email] = {
  //           email:      user[0].email,
  //           duration:   0,
  //           attendance: 'absent'
  //         };
  //     }
  
  //     response.data.items?.forEach((item: any) => {
  //       const e      = item.events[0];
  //       const email  = e.parameters.find((p: any) => p.name === 'identifier')?.value;
  //       const secs   = e.parameters.find((p: any) => p.name === 'duration_seconds')?.intValue || 0;
  //       if (email && attendance[email]) {
  //         attendance[email].duration += Number(secs);
  //       }
  //     });
  //     for (const rec of Object.values(attendance)) {
  //       rec.attendance = rec.duration >= cutoff ? 'present' : 'absent';
  //     }
  //     for (const [email, rec] of Object.entries(attendance)) {
  //       attendanceByTitle[email] = {
  //         ...(attendanceByTitle[email] || {}),
  //         ...rec
  //       };
  //     }
  //   }
  
  //   // 7️⃣ Flatten for return
  //   const attendanceOfStudents = Object.values(attendanceByTitle);
  //   return [ null, attendanceOfStudents ];
  //   }

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
        let adminData;
        response.data.items.forEach((item: any) => {
          const event = item.events[0];
          const email =
            event.parameters.find((param: any) => param.name === 'identifier')
              ?.value || '';
          const duration =
            event.parameters.find(
              (param: any) => param.name === 'duration_seconds',
            )?.intValue || '';
          if (email.includes('@zuvy.org')) {
            adminData = { email, duration };
          }
        });
        if (!adminData) return;

        const extractedData = response.data.items.map((item) => {
          const event = item.events[0];
          const durationSeconds =
            event.parameters.find((param) => param.name === 'duration_seconds')
              ?.intValue || '';
          const email =
            event.parameters.find((param) => param.name === 'identifier')
              ?.value || '';
          if (email.length > 0) {
            const attendanceStatus =
              Number(durationSeconds) >= 0.75 * Number(adminData.duration)
                ? 'present'
                : 'absent';
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
          }
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
        } else if (
          currentTime >= startTime &&
          currentTime <= endTime &&
          status === 'ongoing'
        ) {
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

  async updateMeetingById(id: number, classData: any): Promise<object> {
    try {
      let newStatus = 'upcoming';
      let updatedMeeting = await db
        .update(zuvySessions)
        .set({ ...classData, status: newStatus })
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

  // Get OAuth tokens for the designated account.
  private async getUserTokens(email: string) {
    const result = await db
      .select()
      .from(userTokens)
      .where(eq(userTokens.userEmail, email));
    return result.length ? result[0] : null;
  }

  /**
   * Fetches the meeting recording using the Google Calendar API and updates the session record.
   * @param meetingId - The Google Calendar meeting/event ID.
   */
  async fetchRecordingForMeeting(meetingId: string) {
    // Retrieve tokens for the designated account.
    const userTokenData = await this.getUserTokens('team@zuvy.org');
    if (!userTokenData) {
      this.logger.warn('No tokens found for team@zuvy.org');
      return;
    }

    // Set credentials for OAuth2 client.
    auth2Client.setCredentials({
      access_token: userTokenData.accessToken,
      refresh_token: userTokenData.refreshToken,
    });

    // Initialize the Calendar client.
    const calendar = google.calendar({ version: 'v3', auth: auth2Client });

    try {
      // Fetch the Calendar event.
      const eventResponse = await calendar.events.get({
        calendarId: 'primary', // Use appropriate calendar ID if needed.
        eventId: meetingId,
      });

      // Find the recording attachment (typically video/mp4 or title including 'recording').
      const recording = eventResponse.data.attachments?.find(
        (att) =>
          att.mimeType === 'video/mp4' ||
          att.fileUrl?.includes('meet') ||
          (att.title && att.title.toLowerCase().includes('recording'))
      );
      this.logger.log(`recording: ${JSON.stringify(recording)}`);
      const newS3Link = recording ? recording.fileUrl : null;
      let updateData: any = { s3link: newS3Link }
      // Update the session record in zuvySessions with the recording link.
      await db.update(zuvySessions)
        .set(updateData)
        .where(eq(zuvySessions.meetingId, meetingId))
        .execute();

      this.logger.log(
        `Meeting ${meetingId} updated with recording link: ${newS3Link}`
      );

      return newS3Link;
    } catch (err) {
      this.logger.error(`Error fetching recording for meeting ${meetingId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Fetches attendance data for a meeting from the Admin Reports API.
   * Checks if there is an existing attendance record in zuvyStudentAttendance.
   * If found, updates the record; otherwise, inserts a new attendance record.
   * @param meetingId - The Google Calendar meeting/event ID.
   */
  async fetchAttendanceForMeeting(meetingId: string, students, batchId, bootcampId) {
    // Retrieve tokens for the designated account.
    const userTokenData = await this.getUserTokens('team@zuvy.org');
    if (!userTokenData) {
      this.logger.warn('No tokens found for team@zuvy.org');
      return;
    }

    // Set credentials for OAuth2 client.
    auth2Client.setCredentials({
      access_token: userTokenData.accessToken,
      refresh_token: userTokenData.refreshToken,
    });

    // Initialize the Admin Reports API client.
    const adminClient = google.admin({ version: 'reports_v1', auth: auth2Client });

    try {
      // Fetch attendance details using the Admin Reports API.
      const attendanceResponse = await adminClient.activities.list({
        userKey: 'all',
        applicationName: 'meet',
        eventName: 'call_ended',
        maxResults: 1000,
        filters: `calendar_event_id==${meetingId}`,  // Note the backticks for a string template.
      });

      // Prepare an attendance record.
      // We'll use an admin record (e.g. with '@zuvy.org') as a benchmark.
      const attendance: Record<string, any> = {};
      let adminData: { email: string; duration: number } | null = null;

      // Identify the benchmark admin data.
      attendanceResponse.data.items?.forEach((item: any) => {
        const eventDetails = item.events[0];
        const email = eventDetails.parameters.find((param: any) => param.name === 'identifier')?.value || '';
        const duration = eventDetails.parameters.find((param: any) => param.name === 'duration_seconds')?.intValue || 0;
        if (email.includes('@zuvy.org')) {
          adminData = { email, duration };
        }
      });

      if (!adminData) {
        this.logger.warn(`No admin attendance data found for meeting ${meetingId}`);
      }

      // Process each attendance record, comparing duration to adminData.
      attendanceResponse.data.items?.forEach((item: any) => {
        const eventDetails = item.events[0];
        const email = eventDetails.parameters.find((param: any) => param.name === 'identifier')?.value || '';
        const duration = eventDetails.parameters.find((param: any) => param.name === 'duration_seconds')?.intValue || 0;
        // Mark present if duration reaches at least 75% of the admin's duration.
        const status = adminData && (duration >= 0.75 * adminData.duration) ? 'present' : 'absent';
        attendance[email] = { duration, attendance: status };
      });

      // Check if an attendance record already exists for this meeting.
      const existingRecord = await db
        .select()
        .from(zuvyStudentAttendance)
        .where(eq(zuvyStudentAttendance.meetingId, meetingId));

      let arrayOfAttendanceStudents = [];
      this.logger.log(`existingRecord: ${JSON.stringify(attendance)}`);
      for (const student in attendance) {
        if (student.length > 0 && !student.includes('@zuvy.org')) {
          arrayOfAttendanceStudents.push({email: student, ...attendance[student]});
        }
      }
      students.forEach((enrollStudent)=>{
        let presenStudent = arrayOfAttendanceStudents.find((student)=> student.email == enrollStudent.user.email);
        if (!presenStudent){
          arrayOfAttendanceStudents.push({email: enrollStudent.user.email, attendance: 'absent'});
        }
      })
      if (existingRecord.length) {
        // Update the existing attendance record.
        await db.update(zuvyStudentAttendance)
          .set({ attendance: arrayOfAttendanceStudents })
          .where(eq(zuvyStudentAttendance.meetingId, meetingId))
          .execute();
        this.logger.log(`Attendance updated for meeting ${meetingId}: ${JSON.stringify(arrayOfAttendanceStudents)}`);
      } else {
         // Prepare the attendance data object.
      const attendanceData = {
        attendance: arrayOfAttendanceStudents,
        meetingId,
        batchId,
        bootcampId
        // Optionally include other fields (such as batchId or bootcampId) if needed.
      };
        // Insert a new attendance record.
          await db.insert(zuvyStudentAttendance)
            .values(attendanceData)
            .execute();
          this.logger.log(`Attendance inserted for meeting ${meetingId}: ${JSON.stringify(arrayOfAttendanceStudents)}`);
      }

      return arrayOfAttendanceStudents;
    } catch (err) {
      this.logger.error(`Error fetching attendance for meeting ${meetingId}: ${err.message}`);
      return null;
    }
  }

  async getSessionAttendanceAndS3Link(
    session: any,
    students: any[],
    ): Promise<any> {
    try {
      const userData = await db.select().from(users).where(eq(users.email, session.creator));
      if (!userData.length) {
        this.logger.warn(`No user found for email: ${session.creator}`);
        return[{ status: 'error', message: 'User not found' }];
      }

      const tokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, Number(userData[0].id)));

      if (!tokens.length) return [{ status: 'error', message: 'Unable to fetch tokens' }];

      auth2Client.setCredentials({
        access_token: tokens[0].accessToken,
        refresh_token: tokens[0].refreshToken,
      });
      
      const client = google.admin({ version: 'reports_v1', auth: auth2Client });
      // 1. Fetch Google Meet activity logs for this session
      const response = await client.activities.list({
        userKey: 'all',
        applicationName: 'meet',
        eventName: 'call_ended',
        maxResults: 1000,
        filters: `calendar_event_id==${session.meetingId}`,
      });
      const items = response.data.items || [];

      // 2. Extract host email
      const organizerParam = items[0]?.events?.[0]?.parameters?.find(p => p.name === 'organizer_email');
      const hostEmail = organizerParam?.value;

      // 3. Create JWT client as host
      const { PRIVATE_KEY, CLIENT_EMAIL } = process.env;
      const formattedPrivateKey = PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
      const jwtClient = new google.auth.JWT({
        email: CLIENT_EMAIL,
        key: formattedPrivateKey,
        scopes: [
          'https://www.googleapis.com/auth/drive.metadata.readonly',
          'https://www.googleapis.com/auth/calendar.events.readonly',
        ],
        subject: hostEmail,
      });
      await jwtClient.authorize();

      // 4. Get event attachments (find video/mp4)
      const calendar = google.calendar({ version: 'v3', auth: jwtClient });
      const { data: event } = await calendar.events.get({
        calendarId: 'primary',
        eventId: session.meetingId,
        fields: 'attachments(fileId,mimeType,fileUrl)',
      });
      const videoAttach = event.attachments?.find((a: any) => a.mimeType === 'video/mp4');
      const s3link = videoAttach?.fileUrl || null;
      
      // If no recording is available, return a proper message
      if (!s3link) {
        return [{ status: 'error', message: 'Recording not yet updated. You can download attendance once recording is available' }];
      }

      // 5. Get video duration from Drive
      let totalSeconds = 0;
      if (videoAttach) {
        const drive = google.drive({ version: 'v3', auth: jwtClient });
        const { data: fileMeta } = await drive.files.get({
          fileId: videoAttach.fileId,
          fields: 'videoMediaMetadata(durationMillis)',
        });
        const durationMillis = Number(fileMeta.videoMediaMetadata?.durationMillis) || 0;
        totalSeconds = durationMillis / 1000;
      }

      // 6. Calculate attendance for each student
      const cutoff = totalSeconds * 0.75;
      const attendance: Record<string, { email: string; duration: number; attendance: string }> = {};
      for (const student of students) {
        const user = student.user;
        attendance[user.email] = {
          email: user.email,
          duration: 0,
          attendance: 'absent',
        };
      }
      response.data.items?.forEach((item: any) => {
        const e = item.events[0];
        const email = e.parameters.find((p: any) => p.name === 'identifier')?.value;
        const secs = e.parameters.find((p: any) => p.name === 'duration_seconds')?.intValue || 0;
        if (email && attendance[email]) {
          attendance[email].duration += Number(secs);
        }
      });
      for (const rec of Object.values(attendance)) {
        rec.attendance = rec.duration >= cutoff ? 'present' : 'absent';
      }

      // 7. Return attendance and s3link
      return [null, { s3link, attendance: Object.values(attendance) }];
    } catch (error) {
      console.error(error);
      return [{ status: 'error', message: 'Error fetching session data' }];
    }
  }

  async meetingAttendanceAnalytics(meeting_id: number, user) {
    try {
      await this.getAttendance(meeting_id, user);
      let classInfo:any = await   db.query.zuvySessions.findMany({
        where: (zuvySessions, { eq }) => eq(zuvySessions.id, meeting_id),
        with: {
          views: {
            with: {
              user: {
                columns: {
                  email: true,
                  name: true,
                }
              },
            },
          },
        }
      });
      if (classInfo.length > 0) {
        let { batchId, s3link, views, meetingId, bootcampId} = classInfo[0]
        const Meeting = await db
          .select()
          .from(zuvyStudentAttendance)
          .where(sql`${zuvyStudentAttendance.meetingId}=${meetingId}`);

          let students = await db.query.zuvyBatchEnrollments.findMany({
            where: (zuvyBatchEnrollments, { eq }) =>
              eq(zuvyBatchEnrollments.batchId, batchId),
            with: {
              user: {
                columns: {
                  email: true,
                  name: true,
                },
              },
            },
          })
          
        let attendance: Array<any> =
          (Meeting[0]?.attendance as Array<any>) || [];
          
        let no_of_students =
          students.length > attendance.length
            ? students.length
            : attendance.length;

        if (s3link == null || s3link == undefined ) {
          let [errorSessionAttendanceAndS3Link, result] = await this.getSessionAttendanceAndS3Link(classInfo[0], students);
          if (errorSessionAttendanceAndS3Link) {
            return [
              {
                status: 'error',
                message: errorSessionAttendanceAndS3Link.message || 'Recording not yet updated. You can download attendance once recording is available',
                code: 400
              },
              null
            ];
          } else {
            s3link = result.s3link;
            attendance = result.attendance;
            let classUpdateData:any = {
              s3link: s3link
            }
            await db.update(zuvySessions)
              .set(classUpdateData)
              .where(eq(zuvySessions.meetingId, meetingId))
            // insert the attendance data into the database
            await db.insert(zuvyStudentAttendance)
              .values({
                attendance: attendance,
                meetingId: meetingId,
                batchId: batchId,
                bootcampId: bootcampId
              })
          }
        }
        
        let present = attendance.filter(
          (student) => student?.attendance === 'present',
        ).length;

        return [
          null,
          {
            status: 'success',
            message: 'Meetings fetched successfully',
            studentsInfo: {
              total_students: no_of_students,
              present: present,
              s3link: s3link,
              attendance: attendance,
              views
            },
          },
        ];
      } else {
        return [{ status: 'error', message: 'Meeting not found', code: 404 }];
      }
    } catch (error) {
      return [
        {
          status: 'error',
          message: 'Error fetching meetings',
          error: error.message,
        },
      ];
    }
  }

  async getAttendance(meetingId, user = null): Promise<any> {
    try {
      let attendanceSheet = await db
        .select()
        .from(zuvyStudentAttendance)
        .where(eq(zuvyStudentAttendance.meetingId, meetingId));

      if (attendanceSheet.length > 0) {
        return [
          null,
          {
            attendanceSheet: attendanceSheet[0].attendance,
            status: 'success',
          },
        ];
      }
      let classInfo = await db
        .select()
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
      const response = await client.activities
        .list({
          userKey: 'all',
          applicationName: 'meet',
          eventName: 'call_ended',
          maxResults: 1000,
          filters: `calendar_event_id==${meetingId}`,
        })
        .catch((error) => {
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
        );
        if (attendanceSheetData.length > 0) {
          const zuvy_student_attendance = await db
            .insert(zuvyStudentAttendance)
            .values({
              meetingId,
              attendance: attendanceSheetData,
              batchId: classInfo[0]?.batchId,
              bootcampId: classInfo[0]?.bootcampId,
            })
            .returning();
          if (zuvy_student_attendance.length > 0) {
            let batchStudets = attendanceSheetData
              .filter((student: any) => student.attendance === 'present')
              .map((student) => student.email);
            let students = await db
              .select()
              .from(users)
              .where(inArray(users.email, [...batchStudets]));

            students.forEach(async (student) => {
              let old_attendance = await db
                .select()
                .from(zuvyBatchEnrollments)
                .where(
                  sql`${zuvyBatchEnrollments.userId} = ${student.id.toString()} AND ${zuvyBatchEnrollments.batchId} = ${classInfo[0]?.batchId} AND ${zuvyBatchEnrollments.bootcampId} = ${classInfo[0]?.bootcampId}`,
                );
              let new_attendance = old_attendance[0]?.attendance
                ? old_attendance[0].attendance + 1
                : 1;
              let zuvyBatchEnrollmentsDetailsUpdated = await db
                .update(zuvyBatchEnrollments)
                .set({ attendance: new_attendance })
                .where(
                  sql`${zuvyBatchEnrollments.userId} = ${student.id.toString()} AND ${zuvyBatchEnrollments.batchId} = ${classInfo[0]?.batchId} AND ${zuvyBatchEnrollments.bootcampId} = ${classInfo[0]?.bootcampId}`,
                )
                .returning();
              Logger.log(
                `Attendance updated for new classes ${new_attendance}`,
              );
            });
          }
          return [
            null,
            {
              attendanceSheetData,
              status: 'success',
            },
          ];
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
      const classes = await db
        .select()
        .from(zuvySessions)
        .where(sql`${zuvySessions.bootcampId}=${bootcampId}`);
      let classIds = classes.map((classObj) => classObj.meetingId);
      let attendance = await db
        .select()
        .from(zuvyStudentAttendance)
        .where(inArray(zuvyStudentAttendance.meetingId, [...classIds]));
      let unattendedClassIds = classIds.filter(
        (classId) => !attendance.some((attend) => attend.meetingId === classId),
      );
      return {
        status: 'success',
        message: 'Classes fetched successfully by bootcampId',
        code: 200,
        unattendedClassIds: unattendedClassIds,
      };
    } catch (error) {
      return {
        success: 'not success',
        message: 'Error fetching class Links',
        error: error,
      };
    }
  }

  async updatingStatusOfClass(bootcamp_id: number, batch_id: number) {
    try {
      const currentTime = new Date();

      // Fetch classes based on bootcamp_id and batch_id
      let classes = await db.select().from(zuvySessions)
        .where(sql`${zuvySessions.bootcampId} = ${bootcamp_id} AND ${zuvySessions.status} not in ('completed')
                ${!isNaN(batch_id) ? sql`AND ${zuvySessions.batchId} = ${batch_id}` : sql``}`);

      // Fetch admin user details
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, process.env.TEAM_EMAIL));
      let adminUser = { ...user[0], roles: 'admin' };

      // Get access to the calendar
      let calendar: any = await this.accessOfCalendar(adminUser);

      // Array to hold classes that need updating
      let classesToUpdate = [];
      let deleteClassIds: any = [];
      // Process each class
      for (let classObj of classes) {
        // Fetch calendar event
        const event = await calendar.events.get({
          calendarId: 'primary',
          eventId: classObj.meetingId,
        });
        const { start, end, status } = event.data;

        // If the event was canceled, delete the class
        if (status === 'cancelled') {
          deleteClassIds.push(classObj.meetingId);
          continue;
        }

        const apiStartTime = start?.dateTime || start?.date;
        const apiEndTime = end?.dateTime || end?.date;
        const startTime = new Date(classObj.startTime);
        const endTime = new Date(classObj.endTime);

        // Determine new status
        let newStatus;
        if (currentTime > endTime) {
          newStatus = 'completed';
        } else if (currentTime >= startTime && currentTime <= endTime) {
          newStatus = 'ongoing';
        } else {
          newStatus = 'upcoming';
        }

        // Check if an update is needed
        if (
          apiStartTime !== classObj.startTime ||
          apiEndTime !== classObj.endTime ||
          newStatus !== classObj.status
        ) {
          // Prepare the update object
          let updatedClass = {
            startTime: apiStartTime,
            endTime: apiEndTime,
            status: newStatus,
          };

          // Add the class to the batch update list
          classesToUpdate.push({ id: classObj.id, updatedClass });
        }
      }

      await db
        .delete(zuvySessions)
        .where(inArray(zuvySessions.meetingId, deleteClassIds));

      // Batch update all classes that need updates
      if (classesToUpdate.length > 0) {
        for (let classUpdate of classesToUpdate) {
          await db
            .update(zuvySessions)
            .set(classUpdate.updatedClass)
            .where(eq(zuvySessions.id, classUpdate.id));
        }
      }

      Logger.log(
        `${classesToUpdate.length} class statuses updated successfully.`,
      );
    } catch (error) {
      Logger.log(`Error: ${error.message}`);
      return {
        success: 'not success',
        message: 'Error updating class statuses',
        error: error,
      };
    }
  }

  async BootcampOrBatchEnrollments(
    batch_id: number,
    bootcamp_id: number,
    user_id = null,
  ) {
    let queryString;
    if (user_id && !isNaN(batch_id) && bootcamp_id) {
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} and ${zuvyBatchEnrollments.batchId} = ${batch_id} and ${zuvyBatchEnrollments.userId} = ${user_id}`;
    } else if (bootcamp_id && !isNaN(batch_id)) {
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} and ${zuvyBatchEnrollments.batchId} = ${batch_id}`;
    } else {
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} and ${zuvyBatchEnrollments.userId} = ${user_id}`;
    }
    return queryString;
  }

  async getClassesBy(
    bootcamp_id: number,
    user,
    batch_id: number,
    limit: number,
    offset: number,
    search_term: string,
    status: string,
  ) {
    try {
      if (user?.roles?.includes('admin')) {
        let desiredCourse = [];
        if (isNaN(batch_id)) {
          desiredCourse = await db
            .select()
            .from(zuvyBootcamps)
            .where(eq(zuvyBootcamps.id, bootcamp_id));
        } else {
          desiredCourse = await db
            .select()
            .from(zuvyBatches)
            .where(
              sql`${zuvyBatches.id}=${batch_id} AND ${zuvyBatches.bootcampId} = ${bootcamp_id}`,
            );
        }
        if (desiredCourse.length == 0) {
          return {
            status: 'error',
            message: 'There is no such course or batch.',
            code: 404,
          };
        }
        await this.updatingStatusOfClass(bootcamp_id, batch_id);
      } else if (bootcamp_id && user.id) {
        let queryString = await this.BootcampOrBatchEnrollments(
          batch_id,
          bootcamp_id,
          user.id,
        );
        let zuvyBatchEnrollmentsData = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(queryString);
        if (zuvyBatchEnrollmentsData.length == 0) {
          return {
            status: 'error',
            message: 'You are not enrolled in this course or batch',
            code: 404,
          };
        }
        batch_id = zuvyBatchEnrollmentsData[0].batchId;
        if (batch_id == null) {
          return {
            status: 'error',
            message: 'You are not assigned to any batch in this course',
            code: 404,
          };
        }
        await this.updatingStatusOfClass(
          bootcamp_id,
          zuvyBatchEnrollmentsData[0].batchId,
        );
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
      const query = db
        .select({
          sessions: zuvySessions,
          totalCount: sql<number>`count(*) over()`.as('total_count'),
        })
        .from(zuvySessions)
        .$dynamic()
        .where(
          and(
            bootcamp_id ? eq(zuvySessions.bootcampId, bootcamp_id) : undefined,
            batch_id ? eq(zuvySessions.batchId, batch_id) : undefined,
            status.toLowerCase() !== 'all'
              ? eq(zuvySessions.status, status)
              : undefined,
            search_term
              ? ilike(zuvySessions.title, `%${search_term}%`)
              : undefined,
          ),
        )
        .orderBy(
          status.toLowerCase() === 'completed' || status.toLowerCase() === 'all'
            ? desc(zuvySessions.startTime)
            : zuvySessions.startTime,
        )
        .offset(offset)
        .limit(limit);

      const allClasses = await query;
      const classes = allClasses.map((classObj) => classObj.sessions);
      const totalClasses =
        allClasses.length > 0 ? Number(allClasses[0].totalCount) : 0;
      return {
        status: 'success',
        message: 'Classes fetched successfully by batchId',
        code: 200,
        classes,
        total_items: totalClasses,
        total_pages: Math.ceil(totalClasses / limit) || 1,
      };
    } catch (err) {
      return { status: 'error', message: err.message, code: 500 };
    }
  }

  async deleteSession(eventId, creatorInfo) {
    try {
      let calendar: any = await this.accessOfCalendar(creatorInfo);
      // Delete event from Google Calendar
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });

      // Delete class details from the database
      await db.delete(zuvySessions).where(eq(zuvySessions.meetingId, eventId));

      return {
        status: 'success',
        message: 'Deleted Class successfully',
        code: 200,
      };
    } catch (error) {
      Logger.log(`error: ${error.message}`);
      return {
        status: 'error',
        message: 'Error deleting class',
        error: error,
      };
    }
  }

  async updateSession(eventId, updatedEventDetails, creatorInfo) {
    try {
      let calendar: any = await this.accessOfCalendar(creatorInfo);

      // Update event in Google Calendar
      const eventUpdateData = {
        calendarId: 'primary',
        eventId: eventId,
        requestBody: {
          summary: updatedEventDetails.title,
          description: updatedEventDetails.description,
          start: {
            dateTime: moment(updatedEventDetails.startDateTime),
            // .subtract(5, 'hours')
            // .subtract(30, 'minutes')
            // .format(),
            timeZone: updatedEventDetails.timeZone,
          },
          end: {
            dateTime: moment(updatedEventDetails.endDateTime),
            // .subtract(5, 'hours')
            // .subtract(30, 'minutes')
            // .format(),
            timeZone: updatedEventDetails.timeZone,
          },
        },
      };

      const updatedEvent = await calendar.events.update(eventUpdateData);

      // Update class details in the database
      const updatedClassDetails = await db
        .update(zuvySessions)
        .set({
          title: updatedEventDetails.title,
          startTime: updatedEvent.data.start.dateTime,
          endTime: updatedEvent.data.end.dateTime,
        })
        .where(eq(zuvySessions.meetingId, eventId))
        .returning();

      return {
        status: 'success',
        message: 'Updated Class successfully',
        code: 200,
        updatedClassDetails: updatedClassDetails,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Error updating class',
        error: error,
      };
    }
  }

  async createSessionRecordViews(
    viewSessionData,
    userId: number,
  ): Promise<any> {
    try {
      let [errorGetViews, viewsRecord] = await this.getSessionRecordViews(
        viewSessionData.sessionId,
        userId,
      );
      if (viewsRecord.data.length > 0) {
        return [
          null,
          {
            status: 'success',
            message: 'Session record view already exists',
            code: 203,
          },
        ];
      }
      const sessionRecordView = await db
        .insert(zuvySessionRecordViews)
        .values({ ...viewSessionData, userId })
        .returning();

      return [
        null,
        {
          status: 'success',
          message: 'Session record view created successfully',
          code: 200,
          sessionRecordView: sessionRecordView,
        },
      ];
    } catch (error) {
      return [
        {
          status: 'error',
          code: 500,
          message: 'Error creating session record view: ' + error.message,
        },
      ];
    }
  }

  async getSessionRecordViews(sessionId, user_id): Promise<any> {
    try {
      if (!sessionId && !user_id) {
        return [
          {
            status: 'error',
            message: 'session id or user id is required',
            code: 500,
          },
        ];
      } else if (sessionId && !user_id) {
        const sessionRecordViews = await db
          .select()
          .from(zuvySessionRecordViews)
          .where(sql`${zuvySessionRecordViews.sessionId} = ${sessionId}`);
        return [
          null,
          {
            status: 'success',
            message: 'Session record views fetched successfully',
            code: 200,
            data: sessionRecordViews,
          },
        ];
      } else if (!sessionId && user_id) {
        const sessionRecordViews = await db
          .select()
          .from(zuvySessionRecordViews)
          .where(sql`${zuvySessionRecordViews.userId} = ${user_id}`);
        return [
          null,
          {
            status: 'success',
            message: 'Session record views fetched successfully',
            code: 200,
            data: sessionRecordViews,
          },
        ];
      } else {
        const sessionRecordViews = await db
          .select()
          .from(zuvySessionRecordViews)
          .where(
            sql`${zuvySessionRecordViews.userId} = ${user_id} AND ${zuvySessionRecordViews.sessionId} = ${sessionId}`,
          );
        return [
          null,
          {
            status: 'success',
            message: 'Session record views fetched successfully',
            code: 200,
            data: sessionRecordViews[0],
          },
        ];
      }
    } catch (error) {
      return [
        {
          status: 'error',
          code: 500,
          message: 'Error fetching session record views: ' + error.message,
        },
      ];
    }
  }
}
