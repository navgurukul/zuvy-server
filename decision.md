# Dynamic Zoom License Allocation Decisions

## Purpose

This document records the decisions behind the current Zoom license allocation design so the flow can be explained clearly to product, operations, and engineering managers.

## Problem Statement

The system needs to create Zoom sessions for instructors without permanently giving every instructor a paid Zoom license.

The required behavior is:

- keep the real paid-seat count within Zoom limits
- allow Basic instructors to host when a transferable paid seat is available
- keep protected users permanently licensed
- avoid using protected users as donors
- create the real Zoom meeting under the actual instructor email
- keep local DB state aligned with manual Zoom admin changes

## Final Decision

We use a dynamic transfer model.

That means:

- Zoom remains the source of truth for active users and user license type
- `zuvy_user_licenses` mirrors current active Zoom users
- `is_protected` is our local business flag
- protected licensed users keep dedicated seats
- non-protected licensed users form the transferable pool
- Basic users can receive a transferable seat when their session starts

## Why `zuvy_user_licenses` Should Have 11 Rows In The Current Example

If Zoom has 11 active users, `zuvy_user_licenses` should have 11 active rows.

Example:

```text
11 active Zoom users total
7 licensed users
4 basic users
```

The 7 licensed users split into:

```text
4 protected licensed users
3 transferable licensed users
```

So the table should contain:

```text
4 active rows with license_type = 2 and is_protected = true
3 active rows with license_type = 2 and is_protected = false
4 active rows with license_type = 1 and is_protected = false
```

The table is not only for licensed users. It is the current active Zoom user mirror.

## Why We Do Not Trust All Rows Blindly

Old rows can exist from previous syncs or previous bugs.

So every license query must filter by:

```sql
status = 'active'
```

and every licensed-seat query must also filter by:

```sql
license_type = 2
```

Correct licensed pool query:

```sql
SELECT *
FROM main.zuvy_user_licenses
WHERE status = 'active'
  AND license_type = 2;
```

## Why We Keep Basic Users In The Table

Basic users matter because they are the users who may need a transferable license later.

Keeping them in `zuvy_user_licenses` lets us see:

- who exists in Zoom
- who is active
- who is Basic
- who can potentially be upgraded during session activation

Without Basic users in the mirror, the DB would only show paid users and would hide part of the actual Zoom account state.

## Why We Still Use `licenses`

The old schema still points session data to `licenses.id`.

Existing foreign keys:

- `zuvy_sessions.license_id`
- `license_assignments.license_id`

Because of that, we still mirror Zoom users into `licenses`.

Decision:

```text
Use zuvy_user_licenses for real Zoom user state.
Use licenses only as a compatibility bridge for existing session foreign keys.
```

## Why Protected Users Are Local DB State

Zoom tells us:

- user exists or not
- user status
- user type: Basic or Licensed

Zoom does not tell us:

- whether this user is protected in Zuvy's license allocation rules

So `is_protected` belongs in our DB.

Protection rule:

```text
Protected users cannot be donors.
Protected users reserve dedicated seats.
```

## Seat Count Decision

Configured total seats come from:

```text
ZOOM_TOTAL_LICENSES
```

If missing, the code defaults to `7`.

Transferable capacity is calculated as:

```text
configured total seats - active protected licensed users
```

Example:

```text
configured total seats = 7
protected licensed users = 4
transferable capacity = 3
```

The 4 Basic users do not increase capacity. They can consume one of the 3 transferable seats only when assigned.

## Why We Sync From Zoom Before Trusting Logs

Manual changes can happen directly in Zoom.

Examples:

- Prashant removes a paid license from one user
- Prashant grants a paid license to another user
- a user is deactivated or removed in Zoom

If the app only trusts old DB data, the allocator can use stale users.

Decision:

```text
Before detailed license status logging, sync from Zoom first.
```

This is why `logLicenseStatus(...)` calls `syncLicensedUsersFromZoom()` before printing counts.

## Active To Inactive Decision

A local user becomes inactive when Zoom no longer returns them in the active user list during sync.

This includes cases like:

- removed from Zoom account
- deactivated in Zoom
- no longer active
- pending/not accepted and not returned by `status=active`

When that happens locally:

```text
status = inactive
license_type = 1
is_protected = false
```

The matching legacy `licenses` row becomes:

```text
status = inactive
```

Important:

If Zoom still returns the user as active but with Basic license type, they are not inactive. They remain:

```text
status = active
license_type = 1
is_protected = false
```

So the rule is:

```text
Missing from active Zoom list -> inactive locally.
Present as active Basic -> active locally, not licensed.
Present as active Licensed -> active locally, licensed.
```

## Scheduling Decision

Future sessions should not immediately move Zoom licenses.

When a future session is created:

1. validate that capacity exists for the requested time
2. reserve the internal seat window in `license_assignments`
3. save the session as `upcoming`
4. save a pending Zoom meeting id
5. wait until session start time to do real Zoom transfer

Reason:

If a session is tomorrow, moving the license today would unnecessarily disturb current Zoom users.

## Activation Decision

The real Zoom license transfer happens when the session reaches its start window.

At activation:

1. verify instructor exists in Zoom
2. verify instructor is active
3. if instructor is already licensed, create meeting directly
4. if instructor is Basic, find a free transferable donor
5. downgrade donor to Basic
6. upgrade instructor to Licensed
7. apply Zoom host settings
8. create meeting under instructor
9. update `zuvy_sessions` with real Zoom meeting data

## Why Donor Downgrade Happens Before Instructor Upgrade

Zoom enforces the paid-user limit.

If all paid seats are already used, upgrading an instructor first can fail.

So the system frees a transferable paid seat by downgrading a non-protected donor first, then upgrades the instructor.

## Donor Selection Decision

A donor must be:

- active in Zoom
- licensed in Zoom
- non-protected
- not the same email as the target instructor
- free for the requested time window

This prevents stealing a seat from:

- a protected user
- an instructor who already has an overlapping session

## Cooldown Decision

A license stays blocked after session end for the cooldown window.

Reason:

Zoom recordings/reports may still need the host license shortly after the session ends.

The overlap check is:

```text
existing start < requested end
existing end + cooldown > requested start
```

So a session ending at `1:00 PM` may continue blocking the seat until the cooldown finishes.

## Why Team-Hosted Meetings Were Rejected

Creating every meeting under `team@zuvy.org` was rejected.

Reason:

- it does not satisfy the requirement that the real instructor hosts
- it hides license problems instead of solving them
- it makes Zoom ownership, recordings, and host controls less accurate

## Current Debugging Rule

When checking the license pool, use:

```text
logLicenseStatus(...)
```

because it syncs from Zoom first.

When checking allocation for a specific session window, use:

```text
logLicensePoolSnapshot(...)
```

because it shows protected users, reserved users, transfer direction, and availability for that requested window.

## Current Accepted Behavior

The accepted behavior is:

- `zuvy_user_licenses` contains all active Zoom users after sync
- only active licensed rows count as licensed pool
- protected active licensed rows reserve dedicated seats
- non-protected active licensed rows represent transferable users
- Basic active users can receive transferable seats
- removed/deactivated/missing Zoom users become inactive locally
- actual Zoom transfer happens at session start, not at future session creation

## Recommended Follow-Up Decisions

1. Rename `syncLicensedUsersFromZoom()` to `syncZoomUsersFromZoom()`.
2. Add scheduled sync so manual Zoom admin changes reflect without waiting for logs or allocation.
3. Move session foreign keys from `licenses.id` to `zuvy_user_licenses.id`.
4. Remove the legacy `licenses` table from the allocation flow after migration.
5. Add a clear admin screen/API for protected license management.
