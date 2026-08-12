import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const MEETING_ID = '88090456970';

async function generateAccessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64',
  );

  const response = await axios.post(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {},
    {
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );

  return response.data.access_token;
}

async function checkWaitingRoomSetting() {
  try {
    const ACCESS_TOKEN = await generateAccessToken();

    console.log('Access token generated successfully');

    // 1. Get current waiting room setting
    const getResponse = await axios.get(
      `https://api.zoom.us/v2/meetings/${MEETING_ID}`,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    console.log(
      'Current Waiting Room:',
      getResponse.data.settings.waiting_room,
    );

    // 2. Enable waiting room
    const updateResponse = await axios.patch(
      `https://api.zoom.us/v2/meetings/${MEETING_ID}`,
      {
        settings: {
          waiting_room: true,
          // waiting_room_options: {
          //   who_goes_to_waiting_room: 'everyone',
          // },
          waiting_room_options: {
            mode: 'custom',
            who_goes_to_waiting_room: 'users_not_on_invite',
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    console.log('Waiting Room Update Status:', updateResponse.status);

    // 3. Verify update
    const verifyResponse = await axios.get(
      `https://api.zoom.us/v2/meetings/${MEETING_ID}`,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    console.log(
      'Updated Waiting Room:',
      verifyResponse.data.settings.waiting_room,
    );
  } catch (error: any) {
    console.log('Zoom API Error:', error.response?.data || error.message);
  }
}
checkWaitingRoomSetting();

// import axios from 'axios';
// import * as dotenv from 'dotenv';

// dotenv.config();

// const MEETING_ID = '87365875118';

// async function generateAccessToken() {
//   const accountId = process.env.ZOOM_ACCOUNT_ID;
//   const clientId = process.env.ZOOM_CLIENT_ID;
//   const clientSecret = process.env.ZOOM_CLIENT_SECRET;

//   const authHeader = Buffer.from(
//     `${clientId}:${clientSecret}`,
//   ).toString('base64');

//   const response = await axios.post(
//     `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
//     {},
//     {
//       headers: {
//         Authorization: `Basic ${authHeader}`,
//         'Content-Type': 'application/x-www-form-urlencoded',
//       },
//     },
//   );

//   return response.data.access_token;
// }

// async function checkWaitingRoomSetting() {
//   try {
//     const ACCESS_TOKEN = await generateAccessToken();

//     console.log('Access token generated successfully');

//     // 1. Get current settings and print the FULL object.
//     // Zoom's public docs don't clearly document the field name for the
//     // granular "who should go into the waiting room" dropdown on the
//     // per-meeting PATCH endpoint, so inspect the raw response first to
//     // find whatever key/enum your account actually returns
//     // (e.g. it may show up as something like
//     // waiting_room_options.who_goes_to_waiting_room, or it may not be
//     // exposed on this endpoint at all and instead live under the
//     // account/user-level meeting security settings).
//     const getResponse = await axios.get(
//       `https://api.zoom.us/v2/meetings/${MEETING_ID}`,
//       {
//         headers: {
//           Authorization: `Bearer ${ACCESS_TOKEN}`,
//           'Content-Type': 'application/json',
//         },
//       },
//     );

//     console.log('Full settings object:');
//     console.log(JSON.stringify(getResponse.data.settings, null, 2));

//     // 2. Update to "Users not on the meeting invite".
//     // NOTE: Zoom's public docs don't clearly spell out this field on the
//     // per-meeting PATCH endpoint, so `type: 3` is a best-effort guess based
//     // on the order options appear in the portal dropdown (Everyone=0,
//     // Users not in your account=1, Users not in account & not whitelisted
//     // domain=2, Users not on the meeting invite=3, Users not in your
//     // organization=4). VERIFY this against the "Full settings object" log
//     // above after running once — if `waiting_room_options` (or a similarly
//     // named key) appears there with a different shape, tell me what it
//     // shows and I'll correct this immediately.
//     const updateResponse = await axios.patch(
//       `https://api.zoom.us/v2/meetings/${MEETING_ID}`,
//       {
//         settings: {
//           waiting_room: true,
//           waiting_room_options: {
//             type: 3, // best-effort guess for "Users not on the meeting invite"
//           },
//         },
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${ACCESS_TOKEN}`,
//           'Content-Type': 'application/json',
//         },
//       },
//     );
//     console.log('Waiting Room Update Status:', updateResponse.status);

//     // 3. Verify by re-fetching and printing settings again
//     const verifyResponse = await axios.get(
//       `https://api.zoom.us/v2/meetings/${MEETING_ID}`,
//       {
//         headers: {
//           Authorization: `Bearer ${ACCESS_TOKEN}`,
//           'Content-Type': 'application/json',
//         },
//       },
//     );
//     console.log('Settings after update:');
//     console.log(JSON.stringify(verifyResponse.data.settings, null, 2));

//   } catch (error: any) {
//     console.log(
//       'Zoom API Error:',
//       error.response?.data || error.message,
//     );
//   }
// }
// checkWaitingRoomSetting();

// import axios from 'axios';
// import * as dotenv from 'dotenv';

// dotenv.config();

// // const USER_ID = '0OH7pmKTS4um2UmGHdD7HQ';
// const USER_ID = 'poonam@navgurukul.org';
// // Example: 30R7kT7bTIKSNUFEuH_Qlg
// // ya user ka email bhi use kar sakte ho: teacher@zuvy.org

// async function generateAccessToken() {
//   const accountId = process.env.ZOOM_ACCOUNT_ID;
//   const clientId = process.env.ZOOM_CLIENT_ID;
//   const clientSecret = process.env.ZOOM_CLIENT_SECRET;

//   const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
//     'base64',
//   );

//   const response = await axios.post(
//     `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
//     {},
//     {
//       headers: {
//         Authorization: `Basic ${authHeader}`,
//         'Content-Type': 'application/x-www-form-urlencoded',
//       },
//     },
//   );

//   return response.data.access_token;
// }

// async function checkUserWaitingRoomSetting() {
//   try {
//     const ACCESS_TOKEN = await generateAccessToken();

//     console.log('Access token generated successfully');

//     // 1. Check current USER level waiting room setting
//     const currentSetting = await axios.get(
//       `https://api.zoom.us/v2/users/${USER_ID}/settings`,
//       {
//         headers: {
//           Authorization: `Bearer ${ACCESS_TOKEN}`,
//           'Content-Type': 'application/json',
//         },
//       },
//     );

//     console.log(
//       'Current User Waiting Room:',
//       currentSetting.data.in_meeting.waiting_room,
//     );

//     // 2. Enable USER level waiting room
//     const updateSetting = await axios.patch(
//       `https://api.zoom.us/v2/users/${USER_ID}/settings`,
//       {
//         in_meeting: {
//           waiting_room: true,
//           // waiting_room_options: {
//           who_goes_to_waiting_room: 'everyone',
//           // },

//         },

//       },

//       // {
//       //   settings: {
//       //     waiting_room: true,
//       //     waiting_room_options: {
//       //       who_goes_to_waiting_room: 'everyone',
//       //     },
//       //   },
//       // },
//       {
//         headers: {
//           Authorization: `Bearer ${ACCESS_TOKEN}`,
//           'Content-Type': 'application/json',
//         },
//       },
//     );

//     console.log('User Waiting Room Update Status:', updateSetting.status);

//     // 3. Verify after update
//     const verifySetting = await axios.get(
//       `https://api.zoom.us/v2/users/${USER_ID}/settings`,
//       {
//         headers: {
//           Authorization: `Bearer ${ACCESS_TOKEN}`,
//           'Content-Type': 'application/json',
//         },
//       },
//     );

//     console.log(
//       'Updated User Waiting Room:',
//       verifySetting.data.in_meeting.waiting_room,
//     );
//   } catch (error: any) {
//     console.log('Zoom API Error:', error.response?.data || error.message);
//   }
// }

// checkUserWaitingRoomSetting();

// import axios from 'axios';
// import * as dotenv from 'dotenv';

// dotenv.config();

// const GROUP_ID = 'tIFwOa7gTcyj-h2xeV17uA';
// // Example: 30R7kT7bTIKSNUFEuH_Qlg
// // ya user ka email bhi use kar sakte ho: teacher@zuvy.org

// async function generateAccessToken() {
//   const accountId = process.env.ZOOM_ACCOUNT_ID;
//   const clientId = process.env.ZOOM_CLIENT_ID;
//   const clientSecret = process.env.ZOOM_CLIENT_SECRET;

//   const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
//     'base64',
//   );

//   const response = await axios.post(
//     `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
//     {},
//     {
//       headers: {
//         Authorization: `Basic ${authHeader}`,
//         'Content-Type': 'application/x-www-form-urlencoded',
//       },
//     },
//   );

//   return response.data.access_token;
// }
// async function checkGroupWaitingRoomSetting() {
//   try {
//     const ACCESS_TOKEN = await generateAccessToken();

//     console.log('Access token generated successfully');

//     // Check current group setting
//     const currentSetting = await axios.get(
//       `https://api.zoom.us/v2/groups/${GROUP_ID}/settings`,
//       {
//         headers: {
//           Authorization: `Bearer ${ACCESS_TOKEN}`,
//           'Content-Type': 'application/json',
//         },
//       },
//     );

//     console.log(
//       'Current Group Waiting Room:',
//       currentSetting.data.in_meeting.waiting_room,
//     );

//     // Update group waiting room
//     const updateSetting = await axios.patch(
//       `https://api.zoom.us/v2/groups/${GROUP_ID}/settings`,
//       {
//         in_meeting: {
//           waiting_room: true,
//         },
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${ACCESS_TOKEN}`,
//           'Content-Type': 'application/json',
//         },
//       },
//     );

//     console.log('Group Update Status:', updateSetting.status);

//     // Verify
//     const verifySetting = await axios.get(
//       `https://api.zoom.us/v2/groups/${GROUP_ID}/settings`,
//       {
//         headers: {
//           Authorization: `Bearer ${ACCESS_TOKEN}`,
//           'Content-Type': 'application/json',
//         },
//       },
//     );

//     console.log(
//       'Updated Group Waiting Room:',
//       verifySetting.data.in_meeting.waiting_room,
//     );
//   } catch (error: any) {
//     console.log('Zoom API Error:', error.response?.data || error.message);
//   }
// }

// checkGroupWaitingRoomSetting();

// import axios from 'axios';
// import * as dotenv from 'dotenv';

// dotenv.config();

// const GROUP_ID = 'tIFwOa7gTcyj-h2xeV17uA';

// async function generateAccessToken() {
//   const accountId = process.env.ZOOM_ACCOUNT_ID;
//   const clientId = process.env.ZOOM_CLIENT_ID;
//   const clientSecret = process.env.ZOOM_CLIENT_SECRET;

//   const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
//     'base64',
//   );

//   const response = await axios.post(
//     `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
//     {},
//     {
//       headers: {
//         Authorization: `Basic ${authHeader}`,
//         'Content-Type': 'application/x-www-form-urlencoded',
//       },
//     },
//   );

//   return response.data.access_token;
// }

// async function checkGroupWaitingRoomSetting() {
//   try {
//     const ACCESS_TOKEN = await generateAccessToken();

//     console.log('Access token generated successfully');

//     // 1. Get current group waiting room setting
//     const currentSetting = await axios.get(
//       `https://api.zoom.us/v2/groups/${GROUP_ID}/settings`,
//       {
//         headers: {
//           Authorization: `Bearer ${ACCESS_TOKEN}`,
//           'Content-Type': 'application/json',
//         },
//       },
//     );

//     console.log(
//       'Current Group Waiting Room:',
//       currentSetting.data.in_meeting.waiting_room,
//     );

//     console.log(
//       'Current Waiting Room Options:',
//       currentSetting.data.in_meeting.waiting_room_options,
//     );

//     // 2. Update group waiting room setting
//     const updateSetting = await axios.patch(
//       `https://api.zoom.us/v2/groups/${GROUP_ID}/settings`,
//       {
//         in_meeting: {
//           waiting_room: true,
//           waiting_room_options: {
//             who_goes_to_waiting_room: 'everyone',
//           },
//         },
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${ACCESS_TOKEN}`,
//           'Content-Type': 'application/json',
//         },
//       },
//     );

//     console.log('Group Waiting Room Update Status:', updateSetting.status);

//     // 3. Verify after update
//     const verifySetting = await axios.get(
//       `https://api.zoom.us/v2/groups/${GROUP_ID}/settings`,
//       {
//         headers: {
//           Authorization: `Bearer ${ACCESS_TOKEN}`,
//           'Content-Type': 'application/json',
//         },
//       },
//     );

//     console.log(
//       'Updated Group Waiting Room:',
//       verifySetting.data.in_meeting.waiting_room,
//     );

//     console.log(
//       'Updated Waiting Room Options:',

//       verifySetting.data.in_meeting.waiting_room_options,
//     );
//   } catch (error: any) {
//     console.log('Zoom API Error:', error.response?.data || error.message);
//   }
// }

// checkGroupWaitingRoomSetting();
