
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Store the URL so we don't regenerate it on every call
let googleAuthUrl: string | null = null;

export function getGoogleAuthUrl() {
  if (googleAuthUrl) {
    return googleAuthUrl;
  }

  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  googleAuthUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  
  return googleAuthUrl;
}

export async function getGoogleAuthTokens(code: string) {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    return tokens;
}

export function getAuthenticatedClient() {
    return oauth2Client;
}
