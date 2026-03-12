import { google } from 'googleapis';

export class GoogleCalendarService {
  private createAuth(refreshToken: string) {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    auth.setCredentials({
      refresh_token: refreshToken,
    });

    return auth;
  }

  async createMeeting(
    start: Date,
    end: Date,
    mentorEmail: string,
    studentEmail: string,
    refreshToken: string,
  ) {
    const auth = this.createAuth(refreshToken);

    const calendar = google.calendar({
      version: 'v3',
      auth,
    });

    const event = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: 'Mentorship Session',

        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },

        attendees: [{ email: mentorEmail }, { email: studentEmail }],

        conferenceData: {
          createRequest: {
            requestId: Date.now().toString(),
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
      },
    });

    const meetLink = event.data.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === 'video',
    )?.uri;

    return {
      eventId: event.data.id,
      meetLink,
    };
  }

  async deleteMeeting(eventId: string, refreshToken: string) {
    const auth = this.createAuth(refreshToken);

    const calendar = google.calendar({
      version: 'v3',
      auth,
    });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });
  }

  async updateMeeting(
    eventId: string,
    start: Date,
    end: Date,
    refreshToken: string,
  ) {
    const auth = this.createAuth(refreshToken);

    const calendar = google.calendar({
      version: 'v3',
      auth,
    });

    await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: {
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });
  }

  async checkCalendarConflict(start: Date, end: Date, refreshToken: string) {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    auth.setCredentials({
      refresh_token: refreshToken,
    });

    const calendar = google.calendar({
      version: 'v3',
      auth,
    });

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    const busySlots = response.data.calendars?.primary?.busy ?? [];

    return busySlots.length > 0;
  }
}
