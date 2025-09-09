
'use server';

import { google } from 'googleapis';
import { getGoogleOauth2Client } from '@/services/google-client-service';

export async function getGoogleAuthUrl() {
  const oauth2Client = getGoogleOauth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  
  return url;
}

export async function getGoogleAuthTokens(code: string) {
    const oauth2Client = getGoogleOauth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    return tokens;
}
