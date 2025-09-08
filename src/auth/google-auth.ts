import { OAuth2Client } from 'google-auth-library';

export const auth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
); 
const url = auth2Client.generateAuthUrl({
  access_type: 'offline',                     
  scope: ['https://www.googleapis.com/auth/youtube'],
});