import { Injectable, Req, Res } from '@nestjs/common';
import { bootcamps,batches,userTokens } from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq,sql, } from 'drizzle-orm';
import { google } from 'googleapis';
import { v4 as uuid } from 'uuid';
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
    // Create live broadcasts on YouTube
    async setCalendarCredentials(userId, userEmail) {
        let tokens = await db.select().from(userTokens).where(eq(userTokens.userId, userId));
        console.log('tokens: ', tokens);
        // const tokens = await db.select().from(userTokens).where(sql`${userTokens.userId} = ${userId} && ${userTokens.userEmail} = ${userEmail}`) 
        return auth2Client;
    }

    async googleAuthentication(@Res() res) {
        const url = auth2Client.generateAuthUrl({
            access_type: "offline",
            scope: scopes
        })
        return res.redirect(url)
    }

    async googleAuthenticationRedirect(@Req() req) {
        const { code } = req.query
        const { tokens } = await auth2Client.getToken(code)
        auth2Client.setCredentials(tokens)
        return {
            message: "Authenticated",
            tokens
        }
    }

    async createLiveBroadcast() {
        try {
            const calendar = google.calendar({ version: 'v3', auth: auth2Client });
            const eventData = {
                summary: 'Event Title', // Required
                description: 'Event description', // Optional
                start: {
                    dateTime: '2024-01-20T10:00:00-07:00', // Required
                    timeZone: 'Asia/Kolkata', // Optional, specify time zone
                },
                end: {
                    dateTime: '2024-01-20T11:00:00-07:00', // Required
                    timeZone: 'Asia/Kolkata', // Optional, specify time zone
                },
                attendees: [
                    { email: 'ankur.mazumder54@gmail.com' },
                    { email: 'ankuranime54@gmail.com' }
                ],
                conferenceData: {
                    createRequest: {
                        conferenceSolutionKey: {
                            type: "hangoutsMeet",
                        },
                        requestId: uuid()
                    }
                }
            };
            const createdEvent = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: eventData,
                conferenceDataVersion: 1
            })
            console.log('createdEvent: ', createdEvent);
        } catch (error) {
            // Handle any errors
            console.error('Error creating event:', error);
        }
    }
}
