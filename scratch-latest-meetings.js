const axios = require('./node_modules/axios');
require('./node_modules/dotenv').config();

async function inspectLatestMeetings() {
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

  const listRes = await axios.get(
    `https://api.zoom.us/v2/users/${encodeURIComponent(email)}/meetings?page_size=30`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  console.log('=== MEETINGS LIST FOR poonam@navgurukul.org ===');
  for (const m of listRes.data?.meetings || []) {
    const detail = await axios.get(`https://api.zoom.us/v2/meetings/${m.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(
      `Meeting ID: ${m.id} | Topic: ${m.topic} | Created: ${m.created_at} | waiting_room: ${detail.data?.settings?.waiting_room}`,
    );
  }
}

inspectLatestMeetings().catch((err) =>
  console.error('Error:', err.response?.data || err.message),
);
