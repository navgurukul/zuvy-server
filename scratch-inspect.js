const axios = require('./node_modules/axios');
require('./node_modules/dotenv').config();

async function inspectSecurityAndInMeeting() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64',
  );
  const tokenRes = await axios.post(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {},
    {
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );

  const token = tokenRes.data.access_token;
  const email = 'poonam@navgurukul.org';

  const getRes = await axios.get(
    `https://api.zoom.us/v2/users/${encodeURIComponent(email)}/settings`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  console.log('=== ALL SECURITY SETTINGS ===');
  console.log(JSON.stringify(getRes.data?.security, null, 2));

  console.log('=== WAITING ROOM KEYS IN IN_MEETING ===');
  const inMeetingKeys = Object.keys(getRes.data?.in_meeting || {}).filter(
    (k) =>
      k.includes('waiting') ||
      k.includes('pass') ||
      k.includes('bypass') ||
      k.includes('join') ||
      k.includes('guest'),
  );
  inMeetingKeys.forEach((k) => {
    console.log(`${k}:`, JSON.stringify(getRes.data?.in_meeting[k]));
  });
}

inspectSecurityAndInMeeting();
