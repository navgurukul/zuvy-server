# Zoom API Granular Scopes Migration Checklist

## 🚨 **ACTION REQUIRED: Update Your Zoom App Scopes**

Zoom has transitioned to **granular scopes** as of 2024. If you're experiencing permission errors or 403 responses, follow this checklist:

## ✅ **Pre-Migration Check**

**Do you need to update?** Check if your current scopes include granular ones:

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/) → Your App → **Scopes** tab
2. Look for scopes like: `meeting:write:meeting:admin`
3. If you only see `meeting:write:admin` (old format), **you need to update**

## 🔄 **Migration Steps**

### Step 1: Update Scopes in Zoom App
1. Go to your Zoom app in Marketplace
2. Navigate to **Scopes** tab
3. **Remove old scopes** (if any):
   - ❌ `meeting:write:admin`
   - ❌ `meeting:read:admin` 
   - ❌ `recording:read:admin`

4. **Add new granular scopes**:
   - ✅ `meeting:read:meeting:admin`
   - ✅ `meeting:write:meeting:admin`
   - ✅ `meeting:update:meeting:admin`
   - ✅ `cloud_recording:read:recording:admin`
   - ✅ `report:read:admin`
   - ✅ `user:read:user:admin`

### Step 2: Regenerate Credentials
1. Click **Save** in the Scopes tab
2. Go to **Basic Information** tab
3. **Regenerate** your Client Secret
4. Copy the new credentials

### Step 3: Get New Access Token
```bash
# Replace with your actual values
curl -X POST "https://zoom.us/oauth/token?grant_type=account_credentials&account_id=YOUR_ACCOUNT_ID" \
  -H "Authorization: Basic $(echo -n 'CLIENT_ID:CLIENT_SECRET' | base64)"
```

### Step 4: Update Environment Variables
```env
# Update your .env file
ZOOM_ACCESS_TOKEN=your_new_access_token_here
ZOOM_CLIENT_SECRET=your_new_client_secret_here
```

### Step 5: Restart Application
```bash
# Restart your LMS backend
npm run start:dev
# or
docker-compose restart
```

## 🧪 **Verification**

### Test 1: Check Token Scopes
```bash
curl -X POST "https://zoom.us/oauth/token?grant_type=account_credentials&account_id=YOUR_ACCOUNT_ID" \
  -H "Authorization: Basic $(echo -n 'CLIENT_ID:CLIENT_SECRET' | base64)"
```

Expected response should include:
```json
{
  "access_token": "...",
  "scope": "meeting:write:meeting:admin meeting:read:meeting:admin user:read:user:admin ..."
}
```

### Test 2: Create Test Meeting
```bash
curl -X POST http://localhost:5000/classes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Scope Test Meeting",
    "startDateTime": "2024-07-21T10:00:00Z",
    "endDateTime": "2024-07-21T11:00:00Z",
    "timeZone": "Asia/Kolkata",
    "batchId": 1,
    "moduleId": 2,
    "isZoomMeet": true
  }'
```

Expected: `✅ 200 OK` with Zoom meeting data
Error: `❌ 403 Forbidden` = scopes still need updating

## 🚨 **Common Issues After Migration**

| Error | Cause | Solution |
|-------|-------|----------|
| `403 Forbidden` | Old scopes still active | Clear browser cache, regenerate token |
| `Invalid scope` | Typo in scope name | Double-check granular scope format |
| `Token invalid` | Using old token | Generate new token after scope update |
| `App not found` | Wrong credentials | Verify Client ID/Secret from app |

## 📋 **Rollback Plan**

If you need to rollback (not recommended):
1. Re-add old scopes in Zoom app
2. Generate new token with old scopes
3. Update environment variables
4. Restart application

**⚠️ Note**: Old scopes may stop working entirely in future Zoom API versions.

## 🔄 **What Changes in Code**

**Good news**: No code changes required! The LMS backend automatically:
- ✅ Detects scope permission errors
- ✅ Provides helpful error messages
- ✅ Falls back to Google Meet if Zoom fails
- ✅ Logs detailed error information

## 📞 **Need Help?**

If you encounter issues:
1. Check application logs for detailed error messages
2. Verify all scopes are added correctly
3. Ensure new access token is generated after scope changes
4. Contact Zoom support for account-specific issues

---

**Timeline**: Complete this migration ASAP to ensure continued Zoom functionality in your LMS.
