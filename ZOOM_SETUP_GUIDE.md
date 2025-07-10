# Zoom API Setup Guide

## Overview
This guide will help you set up Zoom API access for the LMS backend to create and manage Zoom meetings.

## Step 1: Create a Zoom Account
1. Go to [Zoom](https://zoom.us/) and create an account if you don't have one
2. Sign in to your Zoom account

## Step 2: Create a Server-to-Server OAuth App
1. Go to [Zoom Marketplace](https://marketplace.zoom.us/)
2. Click "Develop" → "Build App"
3. Choose "Server-to-Server OAuth" app type
4. Fill in the basic information:
   - App Name: "Zuvy LMS Integration"
   - Company Name: Your organization name
   - Developer Name: Your name
   - Developer Email: Your email

## Step 3: Configure App Information
1. **App Information**: Fill in required details
2. **Feature**: No additional features needed for basic meeting creation
3. **Scopes**: Add the following **NEW GRANULAR SCOPES** (required as of 2024):
   - `meeting:read:meeting:admin` - Read meeting details
   - `meeting:write:meeting:admin` - Create meetings
   - `meeting:update:meeting:admin` - Update meetings
   - `cloud_recording:read:recording:admin` - Access meeting recordings
   - `report:read:admin` - Read meeting reports for attendance
   - `user:read:user:admin` - Read user information

   ⚠️ **Important**: Zoom has transitioned to granular scopes. The old scopes like `meeting:write:admin` may not work in new apps.

## Step 4: Get Your Access Token
1. Go to the "Basic Information" tab of your app
2. Find the "App Credentials" section
3. Copy the following:
   - **Account ID**
   - **Client ID** 
   - **Client Secret**

## Step 5: Generate Access Token
You have two options to get an access token:

### Option A: Manual Token Generation (Temporary - for testing)
1. In your app's "Basic Information" tab
2. Scroll down to "App Credentials"
3. Click "View JWT Token" or generate a token
4. Copy the token (this will expire after some time)

### Option B: Programmatic Token Generation (Recommended for production)
Use the following code to generate tokens programmatically:

```javascript
const axios = require('axios');

async function getZoomAccessToken() {
  const accountId = 'YOUR_ACCOUNT_ID';
  const clientId = 'YOUR_CLIENT_ID';
  const clientSecret = 'YOUR_CLIENT_SECRET';
  
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  try {
    const response = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {},
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error generating access token:', error.response?.data || error.message);
    throw error;
  }
}
```

## Step 6: Configure Environment Variables
Add the following to your `.env` file:

```env
# Zoom API Configuration
ZOOM_ACCESS_TOKEN=your_access_token_here

# Optional: For programmatic token generation
ZOOM_ACCOUNT_ID=your_account_id_here
ZOOM_CLIENT_ID=your_client_id_here
ZOOM_CLIENT_SECRET=your_client_secret_here
```

## Step 7: Test the Integration
1. Restart your application
2. Try creating a Zoom session using the API:

```bash
curl -X POST http://localhost:5000/classes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Zoom Class",
    "startDateTime": "2024-07-21T10:00:00Z",
    "endDateTime": "2024-07-21T11:00:00Z",
    "timeZone": "Asia/Kolkata",
    "batchId": 1,
    "moduleId": 2,
    "isZoomMeet": true
  }'
```

## Troubleshooting

### Error: "Invalid access token"
- **Cause**: Token is expired, invalid, or not set
- **Solution**: Regenerate the access token and update your environment variable

### Error: "Insufficient permissions" or "scope not authorized"
- **Cause**: App doesn't have required granular scopes
- **Solution**: 
  1. Go to your Zoom app in Marketplace
  2. Navigate to **Scopes** tab
  3. Add the new granular scopes listed above
  4. **Regenerate your credentials** after adding scopes
  5. Get a new access token (old tokens won't include new scopes)

### Error: "403 Forbidden" on meeting operations
- **Cause**: Using old classic scopes instead of new granular scopes
- **Solution**: Update to granular scopes like `meeting:write:meeting:admin` instead of `meeting:write:admin`

### Error: "User not found"
- **Cause**: The Zoom account doesn't exist or isn't properly configured
- **Solution**: Verify your Zoom account and app configuration

### Error: "Rate limit exceeded"
- **Cause**: Too many API calls in a short time
- **Solution**: Implement rate limiting and retry logic

### Verifying Your Scopes
Check if your token has the correct scopes:
```bash
curl -X POST "https://zoom.us/oauth/token?grant_type=account_credentials&account_id=YOUR_ACCOUNT_ID" \
  -H "Authorization: Basic base64(client_id:client_secret)"
```

Look for the `scope` field in the response:
```json
{
  "access_token": "...",
  "scope": "meeting:write:meeting:admin user:read:user:admin ..."
}
```

## Token Management for Production

For production environments, implement automatic token refresh:

```typescript
// Add to your ZoomService
private async refreshAccessToken(): Promise<string> {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await axios.post(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {},
    {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  
  this.accessToken = response.data.access_token;
  return this.accessToken;
}
```

## Security Best Practices

1. **Never commit tokens to version control**
2. **Use environment variables for all credentials**
3. **Implement token rotation in production**
4. **Monitor API usage and rate limits**
5. **Use HTTPS for all API communications**

## Additional Resources

- [Zoom API Documentation](https://developers.zoom.us/docs/api/)
- [Server-to-Server OAuth Guide](https://developers.zoom.us/docs/internal-apps/)
- [Zoom API Scopes](https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/accountManagedUserCreate)
