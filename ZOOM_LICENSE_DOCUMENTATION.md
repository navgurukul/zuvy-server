# Zoom License Documentation

## Purpose

This document explains the current Zoom license allocation flow end to end: what data comes from Zoom, what is stored in the DB, how protected and transferable seats are counted, when a user becomes inactive locally, and how a scheduled session receives a real Zoom meeting.

## Core Idea

Zoom is the source of truth for which users currently exist and whether each user is Basic or Licensed.

Our DB adds one local concept that Zoom does not manage for us:

- `is_protected`

Protected means the user owns a dedicated seat in our allocation logic and must not be used as a donor for someone else.

## Current Example

If Zoom currently has 11 active users:

- 7 users are Zoom Business/Licensed users
- 4 users are Basic users
- among the 7 licensed users, 4 are protected
- the remaining 3 licensed users are transferable

Then `zuvy_user_licenses` should contain 11 active rows:

```text
4 rows -> status = active, license_type = 2, is_protected = true
3 rows -> status = active, license_type = 2, is_protected = false
4 rows -> status = active, license_type = 1, is_protected = false
```

The active licensed pool is not all rows in the table. It is:

```sql
SELECT *
FROM main.zuvy_user_licenses
WHERE status = 'active'
  AND license_type = 2;
```

## Important Tables

### `zuvy_user_licenses`

This is the current Zoom user mirror plus our local protection flag.

Important columns:

- `zoom_email`: Zoom account email.
- `zoom_user_id`: Zoom internal user id.
- `user_name`: display name from Zoom.
- `license_type`: Zoom user type. `1` means Basic, `2` means Licensed.
- `status`: local copy of the Zoom status, usually `active`, or `inactive` when the user is no longer active in Zoom.
- `is_protected`: local flag for dedicated protected seats.

This table should be read as:

```text
All current active Zoom users are active rows here.
Licensed users are active rows where license_type = 2.
Basic users are active rows where license_type = 1.
Removed/deactivated/missing Zoom users become inactive locally.
```

Useful checks:

```sql
-- All current active Zoom users
SELECT zoom_email, user_name, license_type, status, is_protected
FROM main.zuvy_user_licenses
WHERE status = 'active'
ORDER BY license_type DESC, is_protected DESC, zoom_email;
```

```sql
-- Current active licensed users
SELECT zoom_email, user_name, is_protected
FROM main.zuvy_user_licenses
WHERE status = 'active'
  AND license_type = 2
ORDER BY is_protected DESC, zoom_email;
```

```sql
-- Protected licensed users
SELECT zoom_email, user_name
FROM main.zuvy_user_licenses
WHERE status = 'active'
  AND license_type = 2
  AND is_protected = true;
```

```sql
-- Transferable licensed users
SELECT zoom_email, user_name
FROM main.zuvy_user_licenses
WHERE status = 'active'
  AND license_type = 2
  AND is_protected = false;
```

```sql
-- Active Basic users
SELECT zoom_email, user_name
FROM main.zuvy_user_licenses
WHERE status = 'active'
  AND license_type = 1;
```

### `licenses`

This is the legacy compatibility table.

It is still used because these columns still point to `licenses.id`:

- `zuvy_sessions.license_id`
- `license_assignments.license_id`

Current behavior:

- every Zoom user sync also mirrors a row into `licenses`
- `licenses.status = active` only when the Zoom user is active and licensed
- Basic, inactive, removed, or downgraded users are mirrored as `inactive`

This table is not the best table for understanding the full current Zoom user list. Use `zuvy_user_licenses` for that.

### `license_assignments`

This table stores which license row is reserved for which session window.

Important columns:

- `license_id`: points to `licenses.id`
- `instructor_id`: platform instructor user id
- `session_id`: points to `zuvy_sessions.id`
- `start_time`
- `end_time`

This table is used to answer:

```text
Which seats are already reserved for this time range?
```

The system also applies the configured cooldown after `end_time`.

### `zuvy_sessions`

This table stores class/session records.

For Zoom sessions, important fields are:

- `is_zoom_meet`
- `status`
- `meeting_id`
- `zoom_meeting_id`
- `zoom_meeting_uuid`
- `zoom_start_url`
- `hangout_link`
- `license_id`
- `start_time`
- `end_time`

Future Zoom sessions are first saved with a pending meeting id. The real Zoom meeting is created later when the session starts.

## Zoom APIs Used

### Generate token

`ZoomService.generateAccessToken()` calls:

```text
POST https://zoom.us/oauth/token
```

It uses the server-to-server OAuth account credentials and caches the token.

### List Zoom users

`ZoomService.listAuthorizedUsers()` calls:

```text
GET https://api.zoom.us/v2/users
```

It supports:

- `status=active`
- `hostType=all`
- `hostType=licensed`
- `hostType=basic`
- pagination through `next_page_token`

This is the main API used to refresh local Zoom user state.

### Get one Zoom user

`ZoomService.getUser(email)` calls:

```text
GET https://api.zoom.us/v2/users/{email}
```

This verifies whether a user exists, their status, and their current Zoom type.

### Change user license

`ZoomService.setUserLicense(email, type)` calls:

```text
PATCH https://api.zoom.us/v2/users/{email}
```

with:

```json
{ "type": 1 }
```

or:

```json
{ "type": 2 }
```

Meaning:

- `1` = Basic
- `2` = Licensed

### Apply host settings

`ZoomService.applyLicensedUserSettings(email)` calls:

```text
PATCH https://api.zoom.us/v2/users/{email}/settings
```

This applies best-effort user settings, including waiting room. If Zoom locks a setting at account/group level, the license flow should still continue and log the warning.

### Create meeting for instructor

`ZoomService.createMeetingForUser(email, meetingData)` calls:

```text
POST https://api.zoom.us/v2/users/{email}/meetings
```

The meeting is created under the actual instructor after the instructor has an active licensed Zoom account.

The session activation payload sets:

```json
{
  "settings": {
    "waiting_room": true,
    "join_before_host": false,
    "auto_recording": "cloud"
  }
}
```

## Sync Flow

The sync entry point is:

```text
ZoomLicenseService.syncLicensedUsersFromZoom()
```

Despite the method name, it now syncs all active Zoom users, not only licensed users.

Step by step:

1. Call `ZoomService.listAuthorizedUsers({ status: 'active', hostType: 'all', page_size: 300 })`.
2. Build `activeZoomEmails` from every active Zoom user returned.
3. Build `activeLicensedZoomEmails` from active Zoom users where `userType === 2`.
4. For every active Zoom user, call `ZoomService.syncZoomLicenseUser(...)`.
5. `syncZoomLicenseUser(...)` upserts into `zuvy_user_licenses`.
6. The same user is mirrored into `licenses`.
7. Any local `zuvy_user_licenses` row whose email is not in `activeZoomEmails` becomes inactive.
8. Any local row whose email is not in `activeLicensedZoomEmails` has `is_protected` cleared.
9. Any `licenses` row whose email is not in `activeLicensedZoomEmails` becomes inactive.

## When Does An Active User Become Inactive?

An active local user becomes inactive when a sync runs and Zoom no longer returns that email in the active user list.

That happens when the user is no longer considered active in Zoom, for example:

- removed from the Zoom account
- deactivated in Zoom
- moved out of the connected account
- pending/not accepted and not returned by `status=active`

The local update is:

```text
status = inactive
license_type = 1
is_protected = false
updated_at = now()
```

The matching legacy `licenses` row also becomes:

```text
status = inactive
```

Important distinction:

If Zoom still returns the user as active but the user is now Basic, the local row should not become inactive. It stays:

```text
status = active
license_type = 1
is_protected = false
```

So:

- missing from active Zoom list -> inactive locally
- present in Zoom as active Basic -> active locally but not licensed and not protected
- present in Zoom as active Licensed -> active locally and license_type `2`

## Seat Counting Rules

Configured total seat count comes from:

```text
ZOOM_TOTAL_LICENSES
```

If missing, the code defaults to `7`.

Protected seat count:

```sql
SELECT count(*)
FROM main.zuvy_user_licenses
WHERE status = 'active'
  AND license_type = 2
  AND is_protected = true;
```

Transferable seat capacity:

```text
configured total seats - protected licensed users
```

With 7 total seats and 4 protected users:

```text
7 - 4 = 3 transferable seats
```

Transferable DB rows are the currently licensed, non-protected Zoom users:

```sql
SELECT zoom_email
FROM main.zuvy_user_licenses
WHERE status = 'active'
  AND license_type = 2
  AND is_protected = false;
```

Basic users are not counted as available licensed seats. They can only receive a transferred seat when a transferable seat is available.

## Scheduling Flow

When a Zoom session is created from `ClassesService`:

1. The instructor email is loaded from the batch/instructor relation.
2. `ZoomLicenseService.assignLicense(...)` runs inside a DB transaction.
3. It checks protected emails from `zuvy_user_licenses`.
4. It decides whether the instructor is protected.
5. It checks existing `license_assignments` that overlap the requested time range.
6. The overlap check includes session end time plus the Zoom license cooldown.
7. If the instructor is protected, only that instructor's own protected seat is considered.
8. If the instructor is not protected, protected users are excluded and only the transferable pool is considered.
9. One available `licenses.id` is selected and returned.
10. The session is saved in `zuvy_sessions` as `upcoming` with a pending Zoom meeting id.
11. `license_assignments` receives the reservation row for the session time window.

The real Zoom meeting is not created immediately for future sessions.

## Activation Flow

The actual Zoom transfer happens when the session reaches its start time.

The entry points are:

- `ClassesService.activateScheduledZoomSessions()`
- `ClassesService.activateZoomSession(sessionId)`

Step by step:

1. Find upcoming Zoom sessions where `start_time <= now` and `end_time > now`.
2. Skip sessions that already have a real Zoom meeting id.
3. Load the instructor email.
4. Call `ensureInstructorHasZoomLicenseForSession(...)`.
5. If the instructor is already active and licensed in Zoom, continue.
6. If the instructor is Basic and needs a seat, find a free donor.
7. Donor search calls Zoom for active licensed users.
8. Protected users are excluded from donors.
9. Donors that have overlapping sessions are excluded.
10. The selected donor is downgraded to Basic through Zoom API.
11. The instructor is upgraded to Licensed through Zoom API.
12. Licensed-user settings are applied.
13. The Zoom meeting is created under the instructor.
14. `zuvy_sessions` is updated with real Zoom ids, URLs, password, UUID, and status `ongoing`.

## Donor Rules

A donor must be:

- active in Zoom
- licensed in Zoom
- not the same as the instructor
- not protected
- free for the requested session time range

Protected users are never donors.

## Cooldown Rule

A license is not reusable immediately at session end.

The overlap check uses:

```text
assignment.end_time + cooldown > requested.start_time
```

The cooldown constant is currently defined in:

- [zoom-license.constants.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/src/common/constants/zoom-license.constants.ts)

This prevents the system from taking the license too quickly after a session, which helps avoid recording/reporting issues.

## Logs

### `logLicensePoolSnapshot(...)`

This log is used during allocation and shows:

- configured total seats
- protected seat count
- transferable capacity
- reserved seats for the requested window
- available seats
- protected user emails/names
- reserved license transfer details

### `logLicenseStatus(...)`

This log first runs `syncLicensedUsersFromZoom()`, then prints:

- configured total seats
- active licensed rows in DB
- protected licenses with email/name
- transferable capacity
- transferable DB rows with email/name
- currently reserved protected seats
- currently reserved transferable seats
- available protected seats
- available transferable seats
- available total seats

This is the best debug log when checking whether DB and Zoom are aligned.

## Current Known Limitations

### Legacy table bridge

The system still uses both:

- `zuvy_user_licenses`
- `licenses`

The real current Zoom user state lives in `zuvy_user_licenses`, but session foreign keys still use `licenses.id`.

### Protection is local

Zoom tells us whether a user is Basic or Licensed. Zoom does not own our `is_protected` business rule.

So if a user should be protected, `is_protected` must be set locally through DB/admin/API flow.

### Sync is not continuous

Manual Zoom changes are reflected after sync runs. Current sync happens during license status logging and allocation recovery paths, and through the seed/sync endpoint.

## Main Code Files

- [zoom-license.service.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/src/controller/zoom-license/zoom-license.service.ts)
- [classes.service.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/src/controller/classes/classes.service.ts)
- [zoom.service.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/src/services/zoom/zoom.service.ts)
- [zoom.controller.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/src/services/zoom/zoom.controller.ts)
- [zoom.dto.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/src/services/zoom/dto/zoom.dto.ts)
- [schema.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/drizzle/schema.ts)

## Recommended Next Cleanup

1. Rename `syncLicensedUsersFromZoom()` to `syncZoomUsersFromZoom()` because it now syncs all active Zoom users.
2. Add a scheduled sync job so manual Zoom admin changes are reflected even without a log/status call.
3. Migrate `zuvy_sessions.license_id` from `licenses.id` to `zuvy_user_licenses.id`.
4. Migrate `license_assignments.license_id` from `licenses.id` to `zuvy_user_licenses.id`.
5. Remove the legacy `licenses` bridge after the foreign keys are migrated.
6. Add a dedicated admin API to list and update protected users.
