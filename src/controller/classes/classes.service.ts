import { Injectable } from '@nestjs/common';
import { bootcamps,batches,userTokens } from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq,sql, } from 'drizzle-orm';
import { google } from 'googleapis';
// import { Calendar } from 'node_google_calendar_1';// import { OAuth2Client } from 'google-auth-library';

const { OAuth2 } = google.auth;

let auth2Client = new OAuth2(
    "436141535212-0ddkjom90vaksrsfod7dctiorgqvukdk.apps.googleusercontent.com",
    "ZDz8KKchBMJrjSSnbABnHruG",
    "http://localhost:3000/batch"
);
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
    async createLiveBroadcast(userId = 20230, userEmail = 'giribabu22@navgurukul.org') {
        // console.log('userId: ', userId);
        try {
            auth2Client.setCredentials({
                access_token: 'ya29.a0AWY7Ckk0yyliUq7Wz0DZk5dk9iAyx2seAEzMNaMbqdoitIywq4jCS7Cwk2x2VwVY8J8KJcCTPc-4UllH4u4qgFI4wih20X9mH7uTWLX_RaglqhRldKditQM_A6rvoW__9M7lbDvYmIwMhLa3mDPe6i4nuwf8aCgYKAdASARASFQG1tDrpSjuBa-S4O4BHD40Ij9iuZQ0163',
                refresh_token: '1//0g20K1rcEJgoiCgYIARAAGBASNwF-L9Ir1sCZcZWz63Cg4GCIHJJKVD2fY0flUj0laWOB0koSkorMCeCY5ZuLUPfidSDi0MtxcuM',
            });
            // let auth = await this.setCalendarCredentials(userId, userEmail);
            const calendar = google.calendar({ version: 'v3', auth: auth2Client });

            
            let rule = `RRULE:FREQ=WEEKLY;COUNT=1;BYDAY=SA;BYHOUR=1;BYMINUTE=30;BYSECOND=00`;
            const eventData = {
                summary: 'Event Title', // Required
                description: 'Event description', // Optional
                start: {
                    dateTime: '2024-01-20T10:00:00-07:00', // Required
                    timeZone: 'America/Los_Angeles', // Optional, specify time zone
                },
                end: {
                    dateTime: '2024-01-20T11:00:00-07:00', // Required
                    timeZone: 'America/Los_Angeles', // Optional, specify time zone
                },
                // Add other optional properties as needed:
                attendees: [
                    { email: 'giribabu@navgurukul.org' }
                ],
                location: 'Event location',
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'email', minutes: 30 }, // Reminder one day before
                        {method: 'popup', minutes: 10},
                    ],
                },
                recurrence: [rule], // Add the recurrence rule here
            };
            const createdEvent = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: {
                    ...eventData,
                },
            }) 
            console.log('createdEvent: ', createdEvent);
        } catch (error) {
            // Handle any errors
            console.error('Error creating event:', error);
        }
    }
}
