import { Injectable, Req, Res } from '@nestjs/common';
import { bootcamps, batches, userTokens, classesGoogleMeetLink, sansaarUserRoles, users, batchEnrollments } from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, } from 'drizzle-orm';
import { google, calendar_v3 } from 'googleapis';
import { v4 as uuid } from 'uuid';
import { createReadStream } from 'fs';
import * as _ from 'lodash';
import Axios from 'axios'
import { S3 } from 'aws-sdk';
import { Cron } from '@nestjs/schedule';
// import { Calendar } from 'node_google_calendar_1';// import { OAuth2Client } from 'google-auth-library';

const { OAuth2 } = google.auth;

let auth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_SECRET,
    process.env.GOOGLE_REDIRECT
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
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive"
]
// export const getOAuth2Client =  () : OAuth2Client  => { // 2. So I set the return type as OAuth2Client  

//     return auth2Client; // 1. Inspecting auth2Client shows its of type OAuth2Client
// };

@Injectable()
export class ClassesService {

    // FETCHING ADMIN ROLES
    async getAdminDetails(userId) {
        try {
            let userDetails = await db.select().from(userTokens).where(eq(userTokens.userId, userId))
            if (userDetails) {
                auth2Client.setCredentials({
                    access_token: userDetails[0].accessToken,
                    refresh_token: userDetails[0].refreshToken,
                });
            }
        }
        catch (error) {
            return { 'success': 'not success', 'message': "Error fetching Admin details", "error": error }
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
            access_type: "offline",
            scope: [...scopes, "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        })
        return res.redirect(url)
    }

    async googleAuthenticationRedirect(@Req() req) {
        const { code } = req.query
        const { tokens } = await auth2Client.getToken(code)
        auth2Client.setCredentials(tokens)
        const userData = await this.getUserData(auth2Client);
        await this.saveTokensToDatabase(tokens, userData);
        return {
            message: "Authenticated",
            tokens
        }
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

            const existingUser = await db.select().from(userTokens).where(eq(userTokens.userEmail, userEmail))

            const dbUserId = await db.select().from(users).where(eq(users.email, userEmail))
            const userId = Number(dbUserId[0].id);

            const creatorDetails = {
                accessToken,
                refreshToken,
                userId,
                userEmail
            };


            if (existingUser.length !== 0) {
                await db.update(userTokens).set({ ...creatorDetails }).where(eq(userTokens.userEmail, userEmail)).returning();

            } else {
                await db.insert(userTokens).values(creatorDetails).returning();

            }
        } catch (error) {
            return { 'success': 'not success', 'message': "Error saving tokens to the database", "error": error }
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
        roles: string[]

    }) {
        try {
            const fetchedTokens = await db.select().from(userTokens).where(eq((userTokens.userId), eventDetails.userId));
            if (!fetchedTokens) {
                return { status: 'error', message: 'Unable to fetch tokens' };
            }
            auth2Client.setCredentials({
                access_token: fetchedTokens[0].accessToken,
                refresh_token: fetchedTokens[0].refreshToken,
            });

            if (eventDetails.roles.includes('admin') == false) {
                return { status: 'error', message: 'You should be an admin to create a class.' };
            }

            const studentsInTheBatchEmails = await db.select().from(batchEnrollments).where(eq(batchEnrollments.batchId, parseInt(eventDetails.batchId)));

            const studentsEmails = [];
            for (const studentEmail of studentsInTheBatchEmails) {
                try {
                    const emailFetched = await db.select().from(users).where(eq(users.id, studentEmail.userId));
                    if (emailFetched && emailFetched.length > 0) {
                        studentsEmails.push({ 'email': emailFetched[0].email });
                    }
                } catch (error) {
                    return [{ 'status': 'error', 'message': "Fetching emails failed", 'code': 500 }, null];
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
                        dateTime: eventDetails.startDateTime,
                        timeZone: eventDetails.timeZone,
                    },
                    end: {
                        dateTime: eventDetails.endDateTime,
                        timeZone: eventDetails.timeZone,
                    },

                    attendees: studentsEmails,
                    conferenceData: {
                        createRequest: {
                            conferenceSolutionKey: {
                                type: "hangoutsMeet",
                            },
                            requestId: uuid(),
                        },
                    },
                },
            };

            const createdEvent = await calendar.events.insert(eventData);

            const saveClassDetails = await db.insert(classesGoogleMeetLink).values({
                meetingid: createdEvent.data.id,
                hangoutLink: createdEvent.data.hangoutLink,
                creator: createdEvent.data.creator.email,
                startTime: createdEvent.data.start.dateTime,
                endTime: createdEvent.data.end.dateTime,
                batchId: eventDetails.batchId,
                bootcampId: eventDetails.bootcampId,
                title: createdEvent.data.summary,
                attendees: studentsEmails
            }).returning();
            if (saveClassDetails) {
                return { 'status': 'success', 'message': 'Created Class successfully', 'code': 200, saveClassDetails: saveClassDetails };
            }
            else {
                return { 'success': 'not success', 'message': "Classs creation failed" }
            }
        } catch (error) {
            return { 'status': "not success", 'message': "error creating class", error: error }
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
            const classStartTime = classItem.startTime
            const classEndTime = classItem.endTime
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

    async getClassesByBatchId(batchId: string) {
        try {
            const currentTime = new Date();

            const classes = await db.select().from(classesGoogleMeetLink).where(sql`${classesGoogleMeetLink.batchId} = ${batchId}`);

            const completedClasses = [];
            const ongoingClasses = [];
            const upcomingClasses = [];

            for (const classObj of classes) {
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

            return {
                'status': 'success',
                'message': 'Classes fetched successfully by batchId',
                'code': 200,
                completedClasses,
                ongoingClasses,
                upcomingClasses,
            };
        } catch (error) {
            return { 'success': 'not success', 'message': 'Error fetching class Links', 'error': error };
        }
    }

    // async getAttendanceReports(@Req() req):Promise<any>{
    //     try {
    //         const fetchedTokens = await db.select().from(userTokens).where(eq((userTokens.userId), 44848));
    //         if (!fetchedTokens) {
    //             return { status: 'error', message: 'Unable to fetch tokens' };
    //         }
    //         auth2Client.setCredentials({
    //             access_token: fetchedTokens[0].accessToken,
    //             refresh_token: fetchedTokens[0].refreshToken,
    //         });
    //         const calendar = google.calendar({ version: 'v3', auth: auth2Client });
    //         const allClasses = await db.select().from(classesGoogleMeetLink)
    //                     for (const classData of allClasses) {
    //             if (classData.meetingid != null) {
    //                 if (classData.s3link == null) {
    //                     const response = await calendar.events.get({
    //                         calendarId: 'primary',
    //                         eventId: classData.meetingid,
    //                     });
    //                         if (response.data.attachments){
    //                         for (const attachment of response.data.attachments){
    //                             if(attachment.mimeType=="video/mp4"){
    //                                 // const s3Url = await this.uploadVideoFromGoogleDriveToS3(attachment.fileUrl,attachment.fileId)
    //                                 let updatedS3Url = await db.update(classesGoogleMeetLink).set({ ...classData,s3link:attachment.fileUrl }).where(eq(classesGoogleMeetLink.id, classData.id)).returning();
    //                                 return { 'status': 'success', 'message': 'Meeting  updated successfully', 'code': 200, meetingDetails:updatedS3Url };
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         }
    //         return {'status': 'success', 'message': 'No meetings to update','code': 200}

    //     } catch (error) {

    //         return {'status': 'failure', error:error}
    //     }
    // }
    @Cron('8 * * * *')
    async getEventDetails(@Req() req): Promise<any> {
        try {
            const fetchedTokens = await db.select().from(userTokens).where(eq((userTokens.userId), 44848));
            if (!fetchedTokens) {
                return { status: 'error', message: 'Unable to fetch tokens' };
            }
            auth2Client.setCredentials({
                access_token: fetchedTokens[0].accessToken,
                refresh_token: fetchedTokens[0].refreshToken,
            });
            const calendar = google.calendar({ version: 'v3', auth: auth2Client });
            const allClasses = await db.select().from(classesGoogleMeetLink)
            for (const classData of allClasses) {
                if (classData.meetingid != null) {
                    if (classData.s3link == null) {
                        const response = await calendar.events.get({
                            calendarId: 'primary',
                            eventId: classData.meetingid,
                        });
                        if (response.data.attachments) {
                            for (const attachment of response.data.attachments) {
                                if (attachment.mimeType == "video/mp4") {
                                    // const s3Url = await this.uploadVideoFromGoogleDriveToS3(attachment.fileUrl,attachment.fileId)
                                    let updatedS3Url = await db.update(classesGoogleMeetLink).set({ ...classData, s3link: attachment.fileUrl }).where(eq(classesGoogleMeetLink.id, classData.id)).returning();
                                    return { 'status': 'success', 'message': 'Meeting  updated successfully', 'code': 200, meetingDetails: updatedS3Url };
                                }
                            }
                        }
                    }
                }
            }
            return { 'status': 'success', 'message': 'No meetings to update', 'code': 200 }

        } catch (error) {

            return { 'status': 'failure', error: error }
        }
    }
    async uploadVideoFromGoogleDriveToS3(googleDriveLink: string, fileId: string): Promise<string> {
        try {

            const response = await Axios.get(googleDriveLink, { responseType: 'arraybuffer' });
            const fileBuffer = Buffer.from(response.data);

            const s3Url = await this.uploadVideoToS3(fileBuffer, fileId);

            return s3Url;
        } catch (error) {

            throw new Error('Error uploading video from Google Drive to S3');
        }
    }

    private async uploadVideoToS3(fileBuffer: Buffer, fileName: string): Promise<string> {
        try {
            const s3 = new S3({
                accessKeyId: process.env.S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_KEY_ACCESS
            });
            const bucketName = process.env.S3_BUCKET_NAME;
            const s3Key = `class-recordings/${fileName}`;
            await s3.upload({
                Bucket: bucketName,
                Key: s3Key,
                Body: fileBuffer,
            }).promise();
            const s3Url = `https://${bucketName}.s3.amazonaws.com/${s3Key}`;
            return s3Url;
        } catch (error) {
            throw new Error('Error uploading video to S3');
        }
    }
    async getClassesByBootcampId(bootcampId: string) {
        try {
            const currentTime = new Date();

            const classes = await db.select().from(classesGoogleMeetLink).where(sql`${classesGoogleMeetLink.bootcampId} = ${bootcampId}`);

            const completedClasses = [];
            const ongoingClasses = [];
            const upcomingClasses = [];

            for (const classObj of classes) {
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

            return {
                'status': 'success',
                'message': 'Classes fetched successfully by bootcampId',
                'code': 200,
                completedClasses,
                ongoingClasses,
                upcomingClasses,
            };
        } catch (error) {
            return { 'success': 'not success', 'message': 'Error fetching class Links', 'error': error };
        }
    }

    async getAttendeesByMeetingId(id: number) {
        try {
            const attendeesList = await db.select().from(classesGoogleMeetLink).where(sql`${classesGoogleMeetLink.id}=${id}`);
            return { status: 'success', message: "attendees fetched successfully" }
        } catch (error) {
            return { status: 'error', message: 'Error fetching attendees', error: error }

        }
    }

    async getMeetingById(id: number) {
        try {
            const classDetails = await db.select().from(classesGoogleMeetLink).where(sql`${classesGoogleMeetLink.id}=${id}`);
            if (classDetails.length === 0) {
                return { status: 'error', message: 'class not found', code: 404 };
            }
            return { status: 'success', message: 'class fetched successfully', code: 200, class: classDetails[0] };

        } catch (error) {
            return { status: 'error', message: 'Error fetching class', error: error }

        }
    }

    async deleteMeetingById(id: number) {
        try {
            const deletedMeeting = await db.delete(classesGoogleMeetLink).where(sql`${classesGoogleMeetLink.id} = ${id}`);
            return { 'status': 'success', 'message': 'Meeting deleted successfully ', 'code': 200 };
        }
        catch (error) {
            return { 'success': 'not success', 'message': "Error deleting meeting", "error": error }
        }
    }

    async updateMeetingById(id: number, classData: any): Promise<object> {
        try {

            let updatedMeeting = await db.update(classesGoogleMeetLink).set({ ...classData }).where(eq(classesGoogleMeetLink.id, id)).returning();
            return { 'status': 'success', 'message': 'Meeting  updated successfully', 'code': 200, meetingDetails: updatedMeeting };

        } catch (e) {
            return { 'status': 'error', 'message': e.message, 'code': 405 };
        }
    }

    

    async extractMeetAttendance(responseData1: any) {
        const responseData = {
            "nextPageToken": "A:1709446841822000:-8535813813327021818:913471609310:C03lvel11", 
            "items": [
              {
                "kind": "admin#reports#activity", 
                "etag": "\"BvGfkzKoKVD0NM7VdXdzkXDD-nHLkyMjheL_9Z5X0H0/tU8rVgHXNqt64N25FmvgjAK9qhc\"", 
                "id": {
                  "uniqueQualifier": "2934178519347955099", 
                  "applicationName": "meet", 
                  "customerId": "C03lvel11", 
                  "time": "2024-03-03T06:20:41.830Z"
                }, 
                "actor": {
                  "key": "HANGOUTS_EXTERNAL_OR_ANONYMOUS", 
                  "callerType": "KEY"
                }, 
                "events": [
                  {
                    "type": "call", 
                    "name": "call_ended", 
                    "parameters": [
                      {
                        "intValue": "0", 
                        "name": "video_send_seconds"
                      }, 
                      {
                        "name": "identifier_type", 
                        "value": "email_address"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "audio_send_bitrate_kbps_mean"
                      }, 
                      {
                        "name": "endpoint_id", 
                        "value": "boq_hlane_7JrhhxcAFHh"
                      }, 
                      {
                        "name": "device_type", 
                        "value": "web"
                      }, 
                      {
                        "intValue": "240", 
                        "name": "video_recv_long_side_median_pixels"
                      }, 
                      {
                        "name": "calendar_event_id", 
                        "value": "dfh4be7vg6u1cg1bcjtel0qdu8"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "screencast_send_seconds"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "audio_send_packet_loss_max"
                      }, 
                      {
                        "intValue": "136", 
                        "name": "video_recv_short_side_median_pixels"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "video_recv_packet_loss_mean"
                      }, 
                      {
                        "intValue": "6", 
                        "name": "network_send_jitter_msec_mean"
                      }, 
                      {
                        "intValue": "7322", 
                        "name": "audio_recv_seconds"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "network_congestion"
                      }, 
                      {
                        "intValue": "283", 
                        "name": "network_estimated_download_kbps_mean"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "audio_send_packet_loss_mean"
                      }, 
                      {
                        "name": "network_transport_protocol", 
                        "value": "udp"
                      }, 
                      {
                        "intValue": "9621", 
                        "name": "duration_seconds"
                      }, 
                      {
                        "name": "identifier", 
                        "value": "budatichethana@gmail.com"
                      }, 
                      {
                        "intValue": "16", 
                        "name": "audio_recv_packet_loss_max"
                      }, 
                      {
                        "intValue": "7", 
                        "name": "video_recv_fps_mean"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "audio_recv_packet_loss_mean"
                      }, 
                      {
                        "intValue": "90", 
                        "name": "network_recv_jitter_msec_max"
                      }, 
                      {
                        "name": "organizer_email", 
                        "value": "team@zuvy.org"
                      }, 
                      {
                        "intValue": "8", 
                        "name": "network_recv_jitter_msec_mean"
                      }, 
                      {
                        "intValue": "9192", 
                        "name": "audio_send_seconds"
                      }, 
                      {
                        "name": "display_name", 
                        "value": "Budati chethana"
                      }, 
                      {
                        "intValue": "44", 
                        "name": "video_recv_seconds"
                      }, 
                      {
                        "intValue": "65", 
                        "name": "network_rtt_msec_mean"
                      }, 
                      {
                        "name": "conference_id", 
                        "value": "M72LdSgb9FV57mAVzdLaDxIWOAkIAjIAGAgIigIgBAg"
                      }, 
                      {
                        "intValue": "9548", 
                        "name": "screencast_recv_seconds"
                      }, 
                      {
                        "name": "product_type", 
                        "value": "meet"
                      }, 
                      {
                        "intValue": "8", 
                        "name": "network_estimated_upload_kbps_mean"
                      }, 
                      {
                        "intValue": "1", 
                        "name": "video_recv_packet_loss_max"
                      }, 
                      {
                        "name": "meeting_code", 
                        "value": "WKTIMXIVUK"
                      }, 
                      {
                        "boolValue": true, 
                        "name": "is_external"
                      }
                    ]
                  }
                ]
              }, 
              {
                "kind": "admin#reports#activity", 
                "etag": "\"BvGfkzKoKVD0NM7VdXdzkXDD-nHLkyMjheL_9Z5X0H0/AjjorKI7REa2IhJnXNFZvsFniXE\"", 
                "id": {
                  "uniqueQualifier": "2638660162033502599", 
                  "applicationName": "meet", 
                  "customerId": "C03lvel11", 
                  "time": "2024-03-03T06:20:41.828Z"
                }, 
                "actor": {
                  "key": "HANGOUTS_EXTERNAL_OR_ANONYMOUS", 
                  "callerType": "KEY"
                }, 
                "events": [
                  {
                    "type": "call", 
                    "name": "call_ended", 
                    "parameters": [
                      {
                        "intValue": "0", 
                        "name": "video_send_seconds"
                      }, 
                      {
                        "name": "identifier_type", 
                        "value": "email_address"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "audio_send_bitrate_kbps_mean"
                      }, 
                      {
                        "name": "endpoint_id", 
                        "value": "boq_hlane_8KvY3fzRoSq"
                      }, 
                      {
                        "name": "device_type", 
                        "value": "web"
                      }, 
                      {
                        "name": "calendar_event_id", 
                        "value": "dfh4be7vg6u1cg1bcjtel0qdu8"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "screencast_send_seconds"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "audio_send_packet_loss_max"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "network_send_jitter_msec_mean"
                      }, 
                      {
                        "intValue": "5792", 
                        "name": "audio_recv_seconds"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "network_congestion"
                      }, 
                      {
                        "intValue": "264", 
                        "name": "network_estimated_download_kbps_mean"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "audio_send_packet_loss_mean"
                      }, 
                      {
                        "name": "network_transport_protocol", 
                        "value": "udp"
                      }, 
                      {
                        "intValue": "8085", 
                        "name": "duration_seconds"
                      }, 
                      {
                        "name": "identifier", 
                        "value": "bhoomikarathore1704@gmail.com"
                      }, 
                      {
                        "intValue": "3", 
                        "name": "audio_recv_packet_loss_max"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "audio_recv_packet_loss_mean"
                      }, 
                      {
                        "intValue": "26", 
                        "name": "network_recv_jitter_msec_max"
                      }, 
                      {
                        "name": "organizer_email", 
                        "value": "team@zuvy.org"
                      }, 
                      {
                        "intValue": "7", 
                        "name": "network_recv_jitter_msec_mean"
                      }, 
                      {
                        "intValue": "7651", 
                        "name": "audio_send_seconds"
                      }, 
                      {
                        "name": "display_name", 
                        "value": "Bhoomika Rathore"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "video_recv_seconds"
                      }, 
                      {
                        "intValue": "20", 
                        "name": "network_rtt_msec_mean"
                      }, 
                      {
                        "name": "conference_id", 
                        "value": "M72LdSgb9FV57mAVzdLaDxIWOAkIAjIAGAgIigIgBAg"
                      }, 
                      {
                        "intValue": "8059", 
                        "name": "screencast_recv_seconds"
                      }, 
                      {
                        "name": "product_type", 
                        "value": "meet"
                      }, 
                      {
                        "intValue": "8", 
                        "name": "network_estimated_upload_kbps_mean"
                      }, 
                      {
                        "name": "meeting_code", 
                        "value": "WKTIMXIVUK"
                      }, 
                      {
                        "boolValue": true, 
                        "name": "is_external"
                      }
                    ]
                  }
                ]
              }, 
              {
                "kind": "admin#reports#activity", 
                "etag": "\"BvGfkzKoKVD0NM7VdXdzkXDD-nHLkyMjheL_9Z5X0H0/UywJPvRhNC2G0YkSqHt5G_gqyqQ\"", 
                "id": {
                  "uniqueQualifier": "-2574777481899936694", 
                  "applicationName": "meet", 
                  "customerId": "C03lvel11", 
                  "time": "2024-03-03T06:20:41.825Z"
                }, 
                "actor": {
                  "key": "HANGOUTS_EXTERNAL_OR_ANONYMOUS", 
                  "callerType": "KEY"
                }, 
                "events": [
                  {
                    "type": "call", 
                    "name": "call_ended", 
                    "parameters": [
                      {
                        "intValue": "0", 
                        "name": "video_send_seconds"
                      }, 
                      {
                        "name": "identifier_type", 
                        "value": "email_address"
                      }, 
                      {
                        "name": "endpoint_id", 
                        "value": "boq_hlane_lguGGjsIcVi"
                      }, 
                      {
                        "name": "device_type", 
                        "value": "web"
                      }, 
                      {
                        "name": "calendar_event_id", 
                        "value": "dfh4be7vg6u1cg1bcjtel0qdu8"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "screencast_send_seconds"
                      }, 
                      {
                        "intValue": "5115", 
                        "name": "audio_recv_seconds"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "network_congestion"
                      }, 
                      {
                        "intValue": "271", 
                        "name": "network_estimated_download_kbps_mean"
                      }, 
                      {
                        "name": "network_transport_protocol", 
                        "value": "udp"
                      }, 
                      {
                        "intValue": "6926", 
                        "name": "duration_seconds"
                      }, 
                      {
                        "name": "identifier", 
                        "value": "deekshagp14@gmail.com"
                      }, 
                      {
                        "intValue": "38", 
                        "name": "audio_recv_packet_loss_max"
                      }, 
                      {
                        "intValue": "2", 
                        "name": "audio_recv_packet_loss_mean"
                      }, 
                      {
                        "intValue": "125", 
                        "name": "network_recv_jitter_msec_max"
                      }, 
                      {
                        "name": "organizer_email", 
                        "value": "team@zuvy.org"
                      }, 
                      {
                        "intValue": "10", 
                        "name": "network_recv_jitter_msec_mean"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "audio_send_seconds"
                      }, 
                      {
                        "name": "display_name", 
                        "value": "DIVYASHREE G P"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "video_recv_seconds"
                      }, 
                      {
                        "intValue": "37", 
                        "name": "network_rtt_msec_mean"
                      }, 
                      {
                        "name": "conference_id", 
                        "value": "M72LdSgb9FV57mAVzdLaDxIWOAkIAjIAGAgIigIgBAg"
                      }, 
                      {
                        "intValue": "6904", 
                        "name": "screencast_recv_seconds"
                      }, 
                      {
                        "name": "product_type", 
                        "value": "meet"
                      }, 
                      {
                        "intValue": "8", 
                        "name": "network_estimated_upload_kbps_mean"
                      }, 
                      {
                        "name": "meeting_code", 
                        "value": "WKTIMXIVUK"
                      }, 
                      {
                        "boolValue": true, 
                        "name": "is_external"
                      }
                    ]
                  }
                ]
              }, 
              {
                "kind": "admin#reports#activity", 
                "etag": "\"BvGfkzKoKVD0NM7VdXdzkXDD-nHLkyMjheL_9Z5X0H0/O3EZMf6BE9ddvFzIG4gLfO6c63A\"", 
                "id": {
                  "uniqueQualifier": "-4149663180506549357", 
                  "applicationName": "meet", 
                  "customerId": "C03lvel11", 
                  "time": "2024-03-03T06:20:41.823Z"
                }, 
                "actor": {
                  "key": "HANGOUTS_EXTERNAL_OR_ANONYMOUS", 
                  "callerType": "KEY"
                }, 
                "events": [
                  {
                    "type": "call", 
                    "name": "call_ended", 
                    "parameters": [
                      {
                        "intValue": "0", 
                        "name": "video_send_seconds"
                      }, 
                      {
                        "intValue": "257", 
                        "name": "screencast_recv_bitrate_kbps_mean"
                      }, 
                      {
                        "name": "identifier_type", 
                        "value": "email_address"
                      }, 
                      {
                        "intValue": "21", 
                        "name": "audio_send_bitrate_kbps_mean"
                      }, 
                      {
                        "name": "endpoint_id", 
                        "value": "hub_android_3308468863578824432"
                      }, 
                      {
                        "name": "device_type", 
                        "value": "android"
                      }, 
                      {
                        "intValue": "640", 
                        "name": "video_recv_long_side_median_pixels"
                      }, 
                      {
                        "intValue": "1536", 
                        "name": "screencast_recv_long_side_median_pixels"
                      }, 
                      {
                        "name": "calendar_event_id", 
                        "value": "dfh4be7vg6u1cg1bcjtel0qdu8"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "screencast_send_seconds"
                      }, 
                      {
                        "intValue": "1", 
                        "name": "audio_send_packet_loss_max"
                      }, 
                      {
                        "intValue": "360", 
                        "name": "video_recv_short_side_median_pixels"
                      }, 
                      {
                        "intValue": "4", 
                        "name": "screencast_recv_fps_mean"
                      }, 
                      {
                        "intValue": "10096", 
                        "name": "audio_recv_seconds"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "network_congestion"
                      }, 
                      {
                        "intValue": "344", 
                        "name": "network_estimated_download_kbps_mean"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "audio_send_packet_loss_mean"
                      }, 
                      {
                        "name": "network_transport_protocol", 
                        "value": "udp"
                      }, 
                      {
                        "intValue": "10097", 
                        "name": "duration_seconds"
                      }, 
                      {
                        "name": "identifier", 
                        "value": "kartikeya@navgurukul.org"
                      }, 
                      {
                        "intValue": "61", 
                        "name": "audio_recv_packet_loss_max"
                      }, 
                      {
                        "intValue": "1", 
                        "name": "video_recv_fps_mean"
                      }, 
                      {
                        "intValue": "1", 
                        "name": "audio_recv_packet_loss_mean"
                      }, 
                      {
                        "intValue": "176", 
                        "name": "network_recv_jitter_msec_max"
                      }, 
                      {
                        "name": "organizer_email", 
                        "value": "team@zuvy.org"
                      }, 
                      {
                        "intValue": "864", 
                        "name": "screencast_recv_short_side_median_pixels"
                      }, 
                      {
                        "intValue": "12", 
                        "name": "network_recv_jitter_msec_mean"
                      }, 
                      {
                        "intValue": "10096", 
                        "name": "audio_send_seconds"
                      }, 
                      {
                        "name": "display_name", 
                        "value": "Kartikeya Gupta"
                      }, 
                      {
                        "intValue": "61", 
                        "name": "screencast_recv_packet_loss_max"
                      }, 
                      {
                        "intValue": "10", 
                        "name": "video_recv_seconds"
                      }, 
                      {
                        "intValue": "64", 
                        "name": "network_rtt_msec_mean"
                      }, 
                      {
                        "intValue": "1", 
                        "name": "screencast_recv_packet_loss_mean"
                      }, 
                      {
                        "name": "conference_id", 
                        "value": "M72LdSgb9FV57mAVzdLaDxIWOAkIAjIAGAgIigIgBAg"
                      }, 
                      {
                        "intValue": "8122", 
                        "name": "screencast_recv_seconds"
                      }, 
                      {
                        "name": "product_type", 
                        "value": "meet"
                      }, 
                      {
                        "intValue": "49", 
                        "name": "network_estimated_upload_kbps_mean"
                      }, 
                      {
                        "name": "meeting_code", 
                        "value": "WKTIMXIVUK"
                      }, 
                      {
                        "boolValue": true, 
                        "name": "is_external"
                      }
                    ]
                  }
                ]
              }, 
              {
                "kind": "admin#reports#activity", 
                "etag": "\"BvGfkzKoKVD0NM7VdXdzkXDD-nHLkyMjheL_9Z5X0H0/KYjUOGXgxfaq6FMpdQmgXdRM-K0\"", 
                "id": {
                  "uniqueQualifier": "-8535813813327021818", 
                  "applicationName": "meet", 
                  "customerId": "C03lvel11", 
                  "time": "2024-03-03T06:20:41.822Z"
                }, 
                "actor": {
                  "key": "HANGOUTS_EXTERNAL_OR_ANONYMOUS", 
                  "callerType": "KEY"
                }, 
                "events": [
                  {
                    "type": "call", 
                    "name": "call_ended", 
                    "parameters": [
                      {
                        "intValue": "0", 
                        "name": "video_send_seconds"
                      }, 
                      {
                        "name": "identifier_type", 
                        "value": "email_address"
                      }, 
                      {
                        "name": "endpoint_id", 
                        "value": "boq_hlane_iIi026bXzBT"
                      }, 
                      {
                        "name": "device_type", 
                        "value": "web"
                      }, 
                      {
                        "intValue": "240", 
                        "name": "video_recv_long_side_median_pixels"
                      }, 
                      {
                        "name": "calendar_event_id", 
                        "value": "dfh4be7vg6u1cg1bcjtel0qdu8"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "screencast_send_seconds"
                      }, 
                      {
                        "intValue": "136", 
                        "name": "video_recv_short_side_median_pixels"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "video_recv_packet_loss_mean"
                      }, 
                      {
                        "intValue": "7478", 
                        "name": "audio_recv_seconds"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "network_congestion"
                      }, 
                      {
                        "intValue": "260", 
                        "name": "network_estimated_download_kbps_mean"
                      }, 
                      {
                        "name": "network_transport_protocol", 
                        "value": "udp"
                      }, 
                      {
                        "intValue": "10023", 
                        "name": "duration_seconds"
                      }, 
                      {
                        "name": "identifier", 
                        "value": "pranayaajjapagu@gmail.com"
                      }, 
                      {
                        "intValue": "11", 
                        "name": "audio_recv_packet_loss_max"
                      }, 
                      {
                        "intValue": "6", 
                        "name": "video_recv_fps_mean"
                      }, 
                      {
                        "intValue": "1", 
                        "name": "audio_recv_packet_loss_mean"
                      }, 
                      {
                        "intValue": "68", 
                        "name": "network_recv_jitter_msec_max"
                      }, 
                      {
                        "name": "organizer_email", 
                        "value": "team@zuvy.org"
                      }, 
                      {
                        "intValue": "22", 
                        "name": "network_recv_jitter_msec_mean"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "audio_send_seconds"
                      }, 
                      {
                        "name": "display_name", 
                        "value": "pranaya ajjapagu"
                      }, 
                      {
                        "intValue": "42", 
                        "name": "video_recv_seconds"
                      }, 
                      {
                        "intValue": "54", 
                        "name": "network_rtt_msec_mean"
                      }, 
                      {
                        "name": "conference_id", 
                        "value": "M72LdSgb9FV57mAVzdLaDxIWOAkIAjIAGAgIigIgBAg"
                      }, 
                      {
                        "intValue": "9559", 
                        "name": "screencast_recv_seconds"
                      }, 
                      {
                        "name": "product_type", 
                        "value": "meet"
                      }, 
                      {
                        "intValue": "7", 
                        "name": "network_estimated_upload_kbps_mean"
                      }, 
                      {
                        "intValue": "0", 
                        "name": "video_recv_packet_loss_max"
                      }, 
                      {
                        "name": "meeting_code", 
                        "value": "WKTIMXIVUK"
                      }, 
                      {
                        "boolValue": true, 
                        "name": "is_external"
                      }
                    ]
                  }
                ]
              }
            ], 
            "kind": "admin#reports#activities", 
            "etag": "\"BvGfkzKoKVD0NM7VdXdzkXDD-nHLkyMjheL_9Z5X0H0/kbT_EUF-UYmUbxxYIYcCKvFCvjc\""
          }
        try {
            const extractedData = responseData.items.map(item => {
                const event = item.events[0];
                const durationSeconds = event.parameters.find(param => param.name === 'duration_seconds')?.intValue || '';
                const email = event.parameters.find(param => param.name === 'identifier')?.value || '';
                return {
                    email,
                    duration: durationSeconds,
                };
            });

            return extractedData;
        }
        catch (e) {
            return { "Status": 'error', 'message': e.message, 'code': 405 };
        }
    }

    async markAttendance(data: any[], thresholdPercentage: number) {
        try {
            const markedData = data.map(item => {
                const durationSeconds = parseInt(item.duration, 10);
                const threshold = (thresholdPercentage / 100) * durationSeconds;
                const isPresent = durationSeconds >= threshold;

                return {
                    "status": "Success",
                    "email": item.email,
                    "duration": item.duration,
                    "attendance": isPresent ? 'Present' : 'Absent',
                };
            });
            return markedData;
        } catch (e) {
            return { 'status': 'error', 'message': e.message, 'code': 405 };
        }
    }

    async getAverageAttendance(thresholdPercentage: number): Promise<number> {

        // const allAttendance = await db.fetch(TABLENAME).WHERE_STATEMENT
        // const totalAttendances = allAttendance.length;
        // const totalPresent = allAttendance.filter((entry) => entry.attendance === 'Present').length;
        // const averageAttendance = totalAttendances > 0 ? (totalPresent / totalAttendances) * 100 : 0;
    
        // return averageAttendance;
      }

}




