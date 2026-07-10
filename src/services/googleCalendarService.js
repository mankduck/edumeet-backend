import { google } from "googleapis";

function getCalendarClient() {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GOOGLE_REFRESH_TOKEN,
  } = process.env;

  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID chưa được khai báo");
  }

  if (!GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_SECRET chưa được khai báo");
  }

  if (!GOOGLE_REDIRECT_URI) {
    throw new Error("GOOGLE_REDIRECT_URI chưa được khai báo");
  }

  if (!GOOGLE_REFRESH_TOKEN) {
    throw new Error("GOOGLE_REFRESH_TOKEN chưa được khai báo");
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: GOOGLE_REFRESH_TOKEN,
  });

  return google.calendar({
    version: "v3",
    auth: oauth2Client,
  });
}

export async function createGoogleMeetEvent({
  title,
  description,
  startAt,
  endAt,
  attendees = [],
}) {
  const calendar = getCalendarClient();

  const startDate = startAt ? new Date(startAt) : new Date();

  const endDate = endAt
    ? new Date(endAt)
    : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  const event = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: title,
      description,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: "Asia/Ho_Chi_Minh",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "Asia/Ho_Chi_Minh",
      },
      attendees: attendees.map((email) => ({
        email,
      })),
      conferenceData: {
        createRequest: {
          requestId: `edumeet-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
      },
    },
  });

  const meetUrl =
    event.data.hangoutLink ||
    event.data.conferenceData?.entryPoints?.find(
      (entry) => entry.entryPointType === "video"
    )?.uri ||
    "";

  return {
    googleEventId: event.data.id,
    meetUrl,
    htmlLink: event.data.htmlLink,
    startAt: event.data.start?.dateTime,
    endAt: event.data.end?.dateTime,
  };
}