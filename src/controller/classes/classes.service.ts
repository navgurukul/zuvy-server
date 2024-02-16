import { Injectable, Req, Res } from '@nestjs/common';
import { bootcamps, batches, userTokens, classesGoogleMeetLink, sansaarUserRoles, users, batchEnrollments } from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, } from 'drizzle-orm';
import { google, calendar_v3 } from 'googleapis';
import { v4 as uuid } from 'uuid';
import { createReadStream } from 'fs';
import * as _ from 'lodash';
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
    "https://www.googleapis.com/auth/calendar"
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
                        studentsEmails.push( {'email':emailFetched[0].email});
                    }
                } catch (error) {
                    return [{ 'status': 'error', 'message': "Fetching emails failed", 'code': 500 }, null];
                }
            }
            console.log(studentsEmails)

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
            console.log(eventData)
            const createdEvent = await calendar.events.insert(eventData);

            const saveClassDetails = await db.insert(classesGoogleMeetLink).values({
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
            const abc = classItem.startTime
            const def = classItem.endTime
            const startTime = abc.toISOString().split('T')[0];
            const endTime = def.toISOString().split('T')[0];

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
            const classesLink = await db.select().from(classesGoogleMeetLink).where(sql`${classesGoogleMeetLink.batchId} = ${batchId}`);
            return { 'status': 'success', 'message': 'classes fetched successfully by batchId', 'code': 200, classesLink: classesLink };
        }
        catch (error) {
            return { 'success': 'not success', 'message': "Error fetching class Links", "error": error }
        }
    }

    async getClassesByBootcampId(bootcampId: string) {
        try {
            const classesLink = await db.select().from(classesGoogleMeetLink).where(sql`${classesGoogleMeetLink.bootcampId} = ${bootcampId}`);
            return { 'status': 'success', 'message': 'classes fetched successfully by bootcampId', 'code': 200, classesLink: classesLink };
        }
        catch (error) {
            return { 'success': 'not success', 'message': "Error fetching class Links", "error": error }
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
}
