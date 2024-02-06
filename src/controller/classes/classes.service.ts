import { Injectable, Req, Res } from '@nestjs/common';
import { bootcamps, batches, userTokens, classesGoogleMeetLink, sansaarUserRoles, users } from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, } from 'drizzle-orm';
import { google, calendar_v3 } from 'googleapis';
import { v4 as uuid } from 'uuid';
import { createReadStream } from 'fs';
// import { Calendar } from 'node_google_calendar_1';// import { OAuth2Client } from 'google-auth-library';

const { OAuth2 } = google.auth;

let auth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_SECRET,
    process.env.GOOGLE_REDIRECT
);

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
            console.log("Error fetching Admin Details", error)
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

            if (existingUser) {
                await db.update(userTokens).set({ ...creatorDetails }).where(eq(userTokens.userEmail, userEmail)).returning();
                console.log('Tokens updated in the database.');
            } else {
                await db.insert(userTokens).values(creatorDetails).returning();
                console.log('Tokens saved to the database.');
            }
        } catch (error) {
            console.error('Error saving tokens to the database:', error.message);
        }
    }

    async createLiveBroadcast(eventDetails: {
        summary: string;
        description?: string;
        startDateTime: string;
        endDateTime: string;
        timeZone: string;
        attendees: string[];
        batchId: string;
        moduleId: string;
        userId: number

    }) {
        try {
            const fetchedTokens = await db.select().from(userTokens).where(eq((userTokens.userId), eventDetails.userId));

            auth2Client.setCredentials({
                access_token: fetchedTokens[0].accessToken,
                refresh_token: fetchedTokens[0].refreshToken,
            });
            const isAdmin = await db.select().from(sansaarUserRoles).where(eq(sansaarUserRoles.userId, eventDetails.userId))
            if (!isAdmin ) {
                return { status: 'error', message: 'You should be an admin to create a class.' };
            }
            if( isAdmin[0].role !== 'admin'){
                return { status: 'error', message: 'You should be an admin to create a class.' };
            }
            const calendar = google.calendar({ version: 'v3', auth: auth2Client });
            const eventData = {
                calendarId: 'primary',
                conferenceDataVersion: 1,
                requestBody: {
                    summary: eventDetails.summary,
                    description: eventDetails.description,
                    start: {
                        dateTime: eventDetails.startDateTime,
                        timeZone: eventDetails.timeZone,
                    },
                    end: {
                        dateTime: eventDetails.endDateTime,
                        timeZone: eventDetails.timeZone,
                    },

                    attendees: eventDetails.attendees.map(email => ({ email })),
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
                hangoutLink: createdEvent.data.hangoutLink,
                creator: createdEvent.data.creator.email,
                startTime: createdEvent.data.start.dateTime,
                endTime: createdEvent.data.end.dateTime,
                batchId: eventDetails.batchId,
                moduleId: eventDetails.moduleId

            }).returning();
            return saveClassDetails
        } catch (error) {
            console.error('Error creating event:', error);
        }
    }

    async getClassesByBatchId(batchId: string) {
        try {
            const classesLink = await db.select().from(classesGoogleMeetLink).where(sql`${classesGoogleMeetLink.batchId} = ${batchId}`);
            return { 'status': 'success', 'message': 'classes fetched successfully by batchId', 'code': 200, classesLink: classesLink };
        }
        catch (error) {
            console.log("Error fetching class Links", error)
        }
    }
}
