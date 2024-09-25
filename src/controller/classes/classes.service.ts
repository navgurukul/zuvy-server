import { Injectable, Req, Res, HttpStatus, Redirect,Logger } from '@nestjs/common';
import {
  userTokens,
  sansaarUserRoles,
  users,
  zuvyBatchEnrollments,
  zuvyStudentAttendance,
  zuvySessions,
  zuvyBatches,
  zuvyBootcamps
  // ZuvyClassesGoogleMeetLink
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, count, inArray, isNull, desc, and, ilike, or } from 'drizzle-orm';
import { google, calendar_v3 } from 'googleapis';
import { v4 as uuid } from 'uuid';
import * as _ from 'lodash';
import { S3 } from 'aws-sdk';
import { Console } from 'console';
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
  GoogleCalendarService: any;

  async accessOfCalendar(creatorInfo) {
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

  async createSession(eventDetails: {
    title: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    timeZone: string;
    batchId: number;
    daysOfWeek: string[]; // New field: array of days (e.g., ['Monday', 'Wednesday', 'Friday'])
    totalClasses: number; // New field: total number of classes
  }, creatorInfo: any) {
      try {
          // Mapping days of the week to moment.js day indices
          const dayToMomentDay: { [key: string]: number } = {
              'Sunday': 0,
              'Monday': 1,
              'Tuesday': 2,
              'Wednesday': 3,
              'Thursday': 4,
              'Friday': 5,
              'Saturday': 6
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
                  message: 'Start date and time should be greater than the present time',
              };
          }

          // Validate daysOfWeek and totalClasses
          if (eventDetails?.daysOfWeek.length > 0) {
              const startDay = new Date(eventDetails.startDateTime).getDay();
              const daysOfWeek = eventDetails.daysOfWeek.map(day => dayToMomentDay[day]);

              if (!daysOfWeek.includes(startDay)) {
                  return {
                      status: 'error',
                      message: 'Start date should be one of the specified days of the week',
                  };
              }

              if (eventDetails?.totalClasses < eventDetails?.daysOfWeek.length) {
                  return {
                      status: 'error',
                      message: 'Total classes should be greater than the number of days of the week',
                  };
              }
          }

          // Fetch batch information
          let batchInfo = await db.select().from(zuvyBatches).where(eq(zuvyBatches.id, eventDetails.batchId));
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
          const getNextClassDate = (startDate: any, day: string, occurrence: number) => {
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
                  const classStartDateTime = getNextClassDate(startDateTime, day, occurrence);
                  const classEndDateTime = classStartDateTime.clone()
                      .add(endDateTime.diff(startDateTime));

                  classes.push({
                      startDateTime: classStartDateTime.format(),
                      endDateTime: classEndDateTime.format()
                  });

                  classCount++;
              }
              occurrence++;
          }

          // Create the initial event with recurrence rules
          const firstEvent = classes[0];
          const recurrenceRule = `RRULE:FREQ=WEEKLY;COUNT=${eventDetails.totalClasses};BYDAY=${eventDetails.daysOfWeek.map(day => day.slice(0, 2).toUpperCase()).join(',')}`;
          const eventData = {
              calendarId: 'primary',
              conferenceDataVersion: 1,
              requestBody: {
                  summary: eventDetails.title,
                  description: eventDetails.description,
                  start: {
                      dateTime: moment(firstEvent.startDateTime).subtract(5, 'hours').subtract(30, 'minutes').format(),
                      timeZone: eventDetails.timeZone,
                  },
                  end: {
                      dateTime: moment(firstEvent.endDateTime).subtract(5, 'hours').subtract(30, 'minutes').format(),
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
              eventId: createdEvent.data.id
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
        Logger.log(`error: ${error.message}`)
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
                .where(sql`${zuvyBatchEnrollments.userId} = ${student.id.toString()} AND ${zuvyBatchEnrollments.batchId} = ${classInfo[0]?.batchId} AND ${zuvyBatchEnrollments.bootcampId} = ${classInfo[0]?.bootcampId}`);              
              let new_attendance = old_attendance[0]?.attendance ? old_attendance[0].attendance + 1 : 1;
              let zuvyBatchEnrollmentsDetailsUpdated = await db
              .update(zuvyBatchEnrollments)
              .set({ attendance: new_attendance })
              .where(sql`${zuvyBatchEnrollments.userId} = ${student.id.toString()} AND ${zuvyBatchEnrollments.batchId} = ${classInfo[0]?.batchId} AND ${zuvyBatchEnrollments.bootcampId} = ${classInfo[0]?.bootcampId}`).returning();           
              Logger.log(`Attendance updated for new classes ${new_attendance}`);
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

  async updatingStatusOfClass(bootcamp_id:number,batch_id:number){
    try {
      const currentTime = new Date();
      let classes = await db
      .select()
      .from(zuvySessions)
      .where(sql`${zuvySessions.bootcampId} = ${bootcamp_id} 
       ${!isNaN(batch_id) ? sql`AND ${zuvySessions.batchId} = ${batch_id}` : sql``}`);
       const user = await db.select().from(users).where(eq(users.email,'team@zuvy.org'))
       let adminUser = {...user[0],roles:'admin'}
       let calendar:any = await this.accessOfCalendar(adminUser);

      for (let classObj of classes) {
        
        const event = await calendar.events.get({
          calendarId: 'primary',
          eventId: classObj.meetingId,
        });
        
        const { start, end ,status } = event.data;
        if(status=='cancelled')
        {
          await db
           .delete(zuvySessions)
             .where(eq(zuvySessions.meetingId, classObj.meetingId));
        }
        const apiStartTime = start?.dateTime || start?.date;
        const apiEndTime = end?.dateTime || end?.date;
    
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
          if (apiStartTime !== classObj.startTime || apiEndTime !== classObj.endTime || newStatus !== classObj.status) {
            // Update times in your database if they have changed
            let updatedClass:any = {startTime: apiStartTime,
              endTime: apiEndTime, status: newStatus }
            await db.update(zuvySessions)
              .set(updatedClass)
              .where(eq(zuvySessions.id, classObj.id));
           }
          // if (newStatus !== classObj.status) {
          //   let updatedClass:any = { status: newStatus }
          //   await db.update(zuvySessions).set(updatedClass).where(eq(zuvySessions.id, classObj.id)).returning();
          //   Logger.log(`Status of class with id ${classObj.id} updated to ${newStatus}`);
          // }
        } catch (error) {
        }
      }
    } catch (error) {
      Logger.log(`error: ${error.message}`)
      return {
        success: 'not success',
        message: 'Error fetching class Links',
        error: error,
      };
    }
  }
  async BootcampOrBatchEnrollments(batch_id: number, bootcamp_id: number, user_id = null) {
    let queryString;
    if (user_id && !isNaN(batch_id) && bootcamp_id) { 
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} and ${zuvyBatchEnrollments.batchId} = ${batch_id} and ${zuvyBatchEnrollments.userId} = ${user_id}`;
    } else if (bootcamp_id && !isNaN(batch_id)) {
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} and ${zuvyBatchEnrollments.batchId} = ${batch_id}`;
    } else {
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} and ${zuvyBatchEnrollments.userId} = ${user_id}`;
    }
    return queryString
  }

  async getClassesBy(bootcamp_id: number, user, batch_id: number, limit: number, offset: number, search_term: string, status: string) {
    try {
      if (user?.roles?.includes('admin')) { 
        let desiredCourse = [];
        if(isNaN(batch_id))
          {
            desiredCourse= await db.select().from(zuvyBootcamps).where(eq(zuvyBootcamps.id,bootcamp_id));
          }
         else {
          desiredCourse = await db.select().from(zuvyBatches).where(sql`${zuvyBatches.id}=${batch_id} AND ${zuvyBatches.bootcampId} = ${bootcamp_id}`)
         } 
         if(desiredCourse.length == 0)
          {
            return {
              status: 'error',
              message:
                'There is no such course or batch.',
              code: 404,
            };
          }     
        await this.updatingStatusOfClass(bootcamp_id,batch_id);
      } else if (bootcamp_id && user.id) {
          let queryString = await this.BootcampOrBatchEnrollments(batch_id, bootcamp_id,user.id);
          let zuvyBatchEnrollmentsData = await db
            .select()
            .from(zuvyBatchEnrollments)
            .where(queryString);
          if(zuvyBatchEnrollmentsData.length == 0)
            {
              return {
                status: 'error',
                message:
                  'You are not enrolled in this course or batch',
                code: 404,
              };
            }  
            batch_id = zuvyBatchEnrollmentsData[0].batchId;
            if(batch_id == null)
              {
                return {
                  status: 'error',
                  message:
                    'You are not assigned to any batch in this course',
                  code: 404,
                };
              }
          await this.updatingStatusOfClass(bootcamp_id,zuvyBatchEnrollmentsData[0].batchId);
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
       sessions:zuvySessions,
       totalCount: sql<number>`count(*) over()`.as('total_count')})
      .from(zuvySessions)
     .$dynamic()
     .where(and(
      bootcamp_id ? eq(zuvySessions.bootcampId, bootcamp_id) : undefined,
      batch_id ? eq(zuvySessions.batchId, batch_id) : undefined,
      status.toLowerCase() !== 'all'  ? eq(zuvySessions.status, status) :undefined,   
      search_term ? ilike(zuvySessions.title, `%${search_term}%`) : undefined
      ))
      .orderBy(
        status.toLowerCase() === 'completed' || status.toLowerCase() === 'all'
          ? desc(zuvySessions.startTime)
          : (zuvySessions.startTime)
      )
     .offset(offset)
     .limit(limit);
      
     const allClasses = await query;
     const classes = allClasses.map(classObj => classObj.sessions);
     const totalClasses = allClasses.length > 0 ?  Number(allClasses[0].totalCount) : 0
      return {
        status: 'success',
        message: 'Classes fetched successfully by batchId',
        code: 200,
        classes, total_items: totalClasses, total_pages: (Math.ceil(totalClasses / limit) || 1)
      };
    } catch (err) {
      return { status: 'error', message: err.message, code: 500 }
    }
  }

  async deleteSession(eventId, creatorInfo) {
    try {
      
      let calendar:any = await this.accessOfCalendar(creatorInfo);
      // Delete event from Google Calendar
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });
  
      // Delete class details from the database
      await db
        .delete(zuvySessions)
        .where(eq(zuvySessions.meetingId, eventId));
  
      return {
        status: 'success',
        message: 'Deleted Class successfully',
        code: 200,
      };
    } catch (error) {
      Logger.log(`error: ${error.message}`)
      return {
        status: 'error',
        message: 'Error deleting class',
        error: error,
      };
    }
  }
  

  async updateSession(eventId, updatedEventDetails,creatorInfo) {
    try {
      let calendar:any = await this.accessOfCalendar(creatorInfo);
  
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
}




