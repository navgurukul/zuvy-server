import { Injectable, Req, Res } from '@nestjs/common';
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
import { eq, sql, count } from 'drizzle-orm';
import { google, calendar_v3 } from 'googleapis';
import { v4 as uuid } from 'uuid';
import { createReadStream } from 'fs';
import * as _ from 'lodash';
import Axios from 'axios';
import { S3 } from 'aws-sdk';
import { Cron } from '@nestjs/schedule';
const moment = require('moment-timezone');
// import { Calendar } from 'node_google_calendar_1';// import { OAuth2Client } from 'google-auth-library';

const { OAuth2 } = google.auth;

let auth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_SECRET,
  process.env.GOOGLE_REDIRECT,
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
// export const getOAuth2Client =  () : OAuth2Client  => { // 2. So I set the return type as OAuth2Client

//     return auth2Client; // 1. Inspecting auth2Client shows its of type OAuth2Client
// };

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

  // async setCalendarCredentials(userId, userEmail) {
  //     let tokens = await db.select().from(userTokens).where(eq(userTokens.userId, userId));
  //     console.log('tokens: ', tokens);
  //     // const tokens = await db.select().from(userTokens).where(sql`${userTokens.userId} = ${userId} && ${userTokens.userEmail} = ${userEmail}`)
  //     return auth2Client;
  // }

  async googleAuthentication(@Res() res) {
    const url = auth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        ...scopes,
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/admin.reports.audit.readonly',
      ],
    });
    return res.redirect(url);
  }

  async googleAuthenticationRedirect(@Req() req) {
    const { code } = req.query;
    const { tokens } = await auth2Client.getToken(code);
    auth2Client.setCredentials(tokens);
    const userData = await this.getUserData(auth2Client);
    await this.saveTokensToDatabase(tokens, userData);
    return {
      message: 'Authenticated',
      tokens,
    };
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
      console.log('userData: ', userData)
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
      console.log('existingUser: ', existingUser);
      if (existingUser.length == 0) {
        console.log('Tokens saved to the database')
        console.log('creatorDetails: ', creatorDetails);
        let res = await db.insert(userTokens).values(creatorDetails).returning();
        console.log('res: ', res);
      } else {
        console.log('Tokens update to the database')
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
          meetingid: createdEvent.data.id,
          hangoutLink: createdEvent.data.hangoutLink,
          creator: createdEvent.data.creator.email,
          startTime: createdEvent.data.start.dateTime,
          endTime: createdEvent.data.end.dateTime,
          batchId: eventDetails.batchId,
          bootcampId: eventDetails.bootcampId,
          title: createdEvent.data.summary,
          attendees: studentsEmails,
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
  //   async getAttendanceByEmailId(email:any, batchId:any) {
  //     try {

  //         const fetchClasses = await db.select().from(classesGoogleMeetLink).where(eq(classesGoogleMeetLink.batchId, batchId));
  //         const numberOfClasses = fetchClasses.length;
  //         const classesAttended = await db.select().from(zuvyStudentAttendance)
  //             .where(sql`${zuvyStudentAttendance.email}=${email}
  //                 and ${zuvyStudentAttendance.batchId}=${batchId}`);
  //         const attendedClasses = classesAttended.length;

  //         const attendancePercentage = numberOfClasses > 0 ? (attendedClasses / numberOfClasses) * 100 : 0;

  //         return {attendancePercentage:attendancePercentage};
  //     } catch (error) {
  //       throw new Error(`Error executing request: ${error.message}`);
  //     }
  // }

  async getAttendance(meetingId) {
    try {
      const fetchedTokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, 44848));
      if (!fetchedTokens || fetchedTokens.length === 0) {
        return { status: 'error', message: 'Unable to fetch tokens' };
      }
      const auth2Client = new google.auth.OAuth2();
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
      });

      const attendanceSheet = {};
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
        return {
          attendanceSheet: mergedAttendance.filter(
            (attendance) => attendance.email !== 'team@zuvy.org',
          ),
          status: 'success',
        };
      }
    } catch (error) {
      throw new Error(`Error executing request: ${error.message}`);
    }
  }

  async getAttendanceByBatchId(batchId: any) {
    try {
      const fetchedStudents = await db
        .select()
        .from(batchEnrollments)
        .where(eq(batchEnrollments.batchId, batchId));
      const fetchedTokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, 44848));
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
          filters: `calendar_event_id==${singleMeeting.meetingid}`,
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

  async meetingAttendance(): Promise<any> {
    try {
      const allMeets = await db.select().from(classesGoogleMeetLink);
      for (const meet of allMeets) {
        const isMarked = await db
          .select()
          .from(zuvyMeetingAttendance)
          .where(eq(zuvyMeetingAttendance.meetingId, meet.meetingid));
        if (isMarked.length == 0) {
          const fetchedAttendance = await this.getAttendance(meet.meetingid);
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
              meetingId: meet.meetingid,
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

  @Cron('*/3 * * * *')
  async getEventDetails(@Req() req): Promise<any> {
    try {
      const fetchedTokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, 44848));
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
        if (classData.meetingid != null) {
          if (classData.s3link == null) {
            const response = await calendar.events.get({
              calendarId: 'primary',
              eventId: classData.meetingid,
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
      const deletedMeeting = await db
        .delete(classesGoogleMeetLink)
        .where(sql`${classesGoogleMeetLink.id} = ${id}`);
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
}
