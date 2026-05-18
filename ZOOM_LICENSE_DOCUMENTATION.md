# Zoom License Documentation

## Purpose

This document captures the current Zoom license allocation system in the codebase, including:

- dynamic license transfer
- protected license seats
- scheduling rules
- Zoom user requirements
- current APIs
- database tables involved
- migration required for `is_protected`

## Current Business Model

The system supports a mixed Zoom seat model:

- some Zoom users have protected seats
- remaining seats form a transferable pool
- non-protected instructors compete only for the transferable pool
- a transferable seat remains blocked until:
  - session end time
  - plus a 1-hour cooldown buffer

The cooldown exists to reduce recording-loss issues after class completion.

## Protected vs Transferable Seats

Protected users keep a dedicated seat and are not used as donors.

Transferable seats are shared among non-protected instructors.

Current protection is now DB-driven through:

- `main.zuvy_user_licenses.is_protected`

This replaces the older hardcoded-email protection approach in the allocator.

## Core Scheduling Rules

### 1. Protected instructor

If the instructor is protected:

- they are checked only against their own protected seat
- they do not consume the shared transferable pool

### 2. Non-protected instructor

If the instructor is not protected:

- they can use only the transferable pool
- protected seats are excluded from their capacity calculation

### 3. Cooldown rule

A seat is not reusable immediately after class end.

If a session runs from `6:00 PM` to `7:00 PM`, that seat stays blocked until:

- `8:00 PM`

That means a new class using the same pool cannot start before `8:00 PM`.

### 4. Helpful rejection message

If the requested slot cannot fit, the API returns:

- `No Zoom licenses available for this time period. You can create session after ...`

The suggested time is computed as the earliest start where the full requested duration can fit.

## Deferred License Assignment

The system does not immediately transfer a Zoom seat for future sessions.

### Current behavior

When a future Zoom class is created:

1. the backend checks whether the requested slot is feasible
2. it reserves internal assignment capacity
3. it stores the session as `upcoming`
4. it does **not** immediately downgrade/upgrade Zoom users

### When the real Zoom transfer happens

The actual Zoom seat transfer happens:

- when the session enters its live window
- or when the session is transitioned to `ongoing`

At that point the backend:

1. ensures the instructor is a Zoom user
2. checks whether the instructor is already licensed
3. if not, finds a free non-protected donor
4. downgrades the donor
5. upgrades the instructor
6. applies Zoom host settings
7. creates the real Zoom meeting

## Zoom User Preconditions

For an instructor to host a Zoom class dynamically, they must:

- exist in the connected Zoom account
- be accepted/activated in Zoom
- be `active`, not `pending`

If the user is:

- missing: session creation/license activation fails
- pending: session creation/license activation fails

## Zoom Settings Applied on License Upgrade

When a user becomes licensed, the backend now applies a best-effort Zoom user settings payload.

This runs from:

- [zoom.service.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/src/services/zoom/zoom.service.ts)

It currently applies API-supported settings in these areas:

- `scheduled_meeting`
- `in_meeting`
- `email_notification`
- `recording`

Important:

- settings are best-effort
- if Zoom locks a setting at the account/group level, license assignment still succeeds
- unsupported or locked settings are logged, not used to fail the transfer

## Database Tables

### 1. `zuvy_user_licenses`

Primary local table for Zoom user seat state.

Important fields:

- `zoom_email`
- `zoom_user_id`
- `user_name`
- `license_type`
- `status`
- `is_protected`

This table is now the source of truth for:

- who is protected
- which Zoom users are currently licensed/basic locally
- local pool synchronization

### 2. `licenses`

Legacy compatibility table.

Still used because:

- `zuvy_sessions.license_id` points to `licenses.id`
- `license_assignments.license_id` points to `licenses.id`

Current behavior:

- Zoom users are mirrored into `licenses`
- session and assignment foreign keys still use `licenses.id`

### 3. `license_assignments`

Tracks reserved/used license windows.

Used for:

- overlap validation
- cooldown enforcement
- donor free/busy checks
- final transactional capacity guard

## APIs

### Zoom user APIs

#### `GET /zoom/users/authorized`

Returns all Zoom users from the connected Zoom account.

Optional query params:

- `hostType=licensed`
- `hostType=basic`
- `status=active`
- `page_size=100`
- `search=...`

Response now includes local metadata too:

- `isProtected`
- `localLicenseType`
- `localStatus`

Examples:

- `GET /zoom/users/authorized`
- `GET /zoom/users/authorized?hostType=licensed`

#### `PATCH /zoom/user`

Updates a Zoom user and local protection metadata.

Supported inputs:

- `email`
- `firstName`
- `lastName`
- `displayName`
- `phoneNumber`
- `timezone`
- `type`
- `isProtected`

Examples:

```json
{
  "email": "user@example.com",
  "isProtected": true
}
```

```json
{
  "email": "user@example.com",
  "type": 2,
  "isProtected": false
}
```

`type` values:

- `1` = Basic
- `2` = Licensed
- `3` = On-Prem

### Zoom license APIs

#### `POST /zoom-license/seed`

Syncs currently licensed active Zoom users into the local pool tables.

#### `GET /zoom-license/dashboard`

Returns:

- total licensed pool count
- used seats
- available seats

## Migration Required

The protection flag requires a DB migration.

Migration file:

- [0034_add_zoom_user_protection.sql](/C:/Users/SAMA/Documents/Work/zuvy-server/drizzle/migrations/0034_add_zoom_user_protection.sql)

This adds:

- `main.zuvy_user_licenses.is_protected boolean not null default false`

### How to apply

Run from repo root:

```powershell
npm run migration:up
```

If your setup needs schema sync instead of SQL migration replay:

```powershell
npm run migration:push
```

Then restart the backend.

## Main Code Files

Core files involved in this system:

- [classes.service.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/src/controller/classes/classes.service.ts)
- [zoom-license.service.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/src/controller/zoom-license/zoom-license.service.ts)
- [zoom.service.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/src/services/zoom/zoom.service.ts)
- [zoom.controller.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/src/services/zoom/zoom.controller.ts)
- [zoom.dto.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/src/services/zoom/dto/zoom.dto.ts)
- [schema.ts](/C:/Users/SAMA/Documents/Work/zuvy-server/drizzle/schema.ts)

## Current Known Limitations

### 1. Legacy table bridge still exists

The system still mirrors Zoom users into `licenses` for foreign-key compatibility.

### 2. Some Zoom settings are account-level

Not every screenshot-level setting can always be overridden at user level through API.

### 3. Zoom provisioning is still a prerequisite

Dynamic transfer cannot work for a user who:

- does not exist in Zoom
- is still pending
- cannot be updated due to missing Zoom scopes

## Recommended Next Cleanup

Future cleanup can simplify the system further by:

1. migrating `zuvy_sessions.license_id` to `zuvy_user_licenses.id`
2. migrating `license_assignments.license_id` to `zuvy_user_licenses.id`
3. removing the legacy `licenses` bridge
4. adding a dedicated admin API for listing only protected users
5. optionally storing configurable seat totals instead of relying on env/default

## Current Outcome

The current implementation now supports:

- dynamic Zoom instructor hosting
- protected seat reservation
- transferable seat pooling
- 1-hour post-session cooldown
- deferred transfer at session start time
- donor downgrade / instructor upgrade flow
- Zoom host settings sync on license upgrade
- API-based protection management through `PATCH /zoom/user`
- visibility of `isProtected` in `GET /zoom/users/authorized`
