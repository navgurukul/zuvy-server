import axios from 'axios';
import { db } from '../../db'; // adjust path
import { zuvyUserLicenses } from '../../../drizzle/schema'; // adjust path
import { sql } from 'drizzle-orm';

// 🔐 Replace with your Zoom config
const BASE_URL = 'https://api.zoom.us/v2';
const ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1ODA4MyIsImVtYWlsIjoidGVhbUB6dXZ5Lm9yZyIsImdvb2dsZVVzZXJJZCI6IjEwMjM4NTU0NjEzNjI3NDM0NTg5NyIsInJvbGUiOiJ3ZWIiLCJyb2xlc0xpc3QiOlsic3VwZXJfYWRtaW4iXSwib3JnSWQiOm51bGwsIm9yZ05hbWUiOm51bGwsImlzUG9jIjpmYWxzZSwiaWF0IjoxNzc2MDczMTA0LCJleHAiOjE3NzYxNTk1MDR9.yWva4CJe9mGBruGwP1Z7MENKtPIOKqZ9Nl5sqyjgz34';
const authHeader = Buffer.from(
  `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`,
).toString('base64');
const tokenUrl = 'https://zoom.us/oauth/token';

// Get headers
async function getHeaders() {
  const response = await axios.post(
    tokenUrl,
    new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: process.env.ZOOM_ACCOUNT_ID || '',
    }),
    {
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );
  const accessToken = response.data.access_token;
  console.log(`Retrieved access token: ${accessToken}`);
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

// Fetch users from Zoom
async function listUsers() {
  try {
    const url = `${BASE_URL}/users?page_size=300`;
    const res = await axios.get(url, { headers: await getHeaders() });
    return res.data.users;
  } catch (error: any) {
    console.error(
      'Error fetching Zoom users:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// Seed function
async function seedZuvyUserLicenses() {
  try {
    console.log('🚀 Seeding zuvy_user_licenses table...');

    const users = await listUsers();

    // Filter licensed users (type = 2) and take first 6
    const licensedUsers = users.filter((u: any) => u.type === 2).slice(0, 6);

    console.log(`Found ${licensedUsers.length} licensed users`);

    for (const u of licensedUsers) {
      await db
        .insert(zuvyUserLicenses)
        .values({
          zoomEmail: u.email,
          zoomUserId: u.id,
          userName:
            `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
          licenseType: u.type,
          status: u.status,
          createdAt: sql`NOW()`,
          updatedAt: sql`NOW()`,
        } as unknown as typeof zuvyUserLicenses.$inferInsert)
        .onConflictDoUpdate({
          target: zuvyUserLicenses.zoomEmail,
          set: {
            zoomUserId: u.id,
            userName:
              `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
            licenseType: u.type,
            status: u.status,
            updatedAt: sql`NOW()`,
          } as unknown as typeof zuvyUserLicenses.$inferInsert, // Type assertion to satisfy Drizzle's typings
        });
    }

    console.log('✅ Seeding completed successfully!');
    console.log(
      'Seeded users:',
      licensedUsers.map((u: any) => u.email),
    );

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

// Run script
seedZuvyUserLicenses();
