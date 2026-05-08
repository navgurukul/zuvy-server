# Dynamic Zoom License Allocation Decisions

## Purpose

This document records the decisions taken while implementing dynamic Zoom license allocation for live class scheduling.

## Problem Statement

The system needs to let instructors host Zoom sessions even when they do not permanently own a licensed Zoom seat.

The required behavior is:

- use Zoom dynamically
- move a paid Zoom seat from one user to another when needed
- create meetings under the actual instructor email
- avoid exceeding the real paid-seat count in Zoom

## Final Direction Chosen

We chose a dynamic transfer model instead of a permanent-seat or team-host-only model.

That means:

- meetings are hosted by the instructor
- basic users can be upgraded when a seat is available
- currently licensed users can be downgraded if they are free and not protected

## Why Team-Hosted Meetings Were Rejected

An early workaround created meetings under `team@zuvy.org`.

That was rejected because:

- it does not reflect the product requirement
- it does not actually transfer the seat to the instructor
- it hides real Zoom licensing problems instead of solving them

## Why We Needed Zoom User Provisioning

Dynamic licensing only works if the instructor:

- exists in Zoom
- belongs to the Zoom account
- is active

So the system now treats Zoom user existence and activation as prerequisites.

## Why We Use Donor Downgrade Before Upgrade

Zoom enforces a real paid-user limit.

So when a basic instructor needs a seat:

- the system cannot just promote them blindly
- it must first free a paid seat by downgrading a currently licensed donor who is free in that session window

## Why We Use `zuvy_user_licenses`

`zuvy_user_licenses` represents the actual Zoom-side host pool:

- Zoom email
- Zoom user id
- license type
- status

This is the right place to track the current licensed seat holders.

## Why We Still Use `licenses`

The old schema still has foreign keys pointing to `licenses.id`:

- `zuvy_sessions.license_id`
- `license_assignments.license_id`

So we kept `licenses` as a compatibility mirror while moving the real pool logic to `zuvy_user_licenses`.

Current rule:

- read the real pool from `zuvy_user_licenses`
- mirror the same users into `licenses`
- save `licenses.id` into session/assignment rows

## Why Auto-Sync Was Added

We observed cases where:

- local pool count was zero
- Zoom still had active licensed users

To recover from stale local state, the allocator now:

- syncs currently licensed active users from Zoom
- updates `zuvy_user_licenses`
- mirrors them into `licenses`
- retries allocation once

## Protected Accounts Decision

Some licensed users must never be used as donors.

Protected accounts:

- `team@zuvy.org`
- `laasya@navgurukul.org`
- `vinit@navgurukul.org`

Reason:

- these users must retain their seat even if they are free
- system should not downgrade them for another instructor

## Error Handling Decision

We intentionally changed generic failures into actionable messages.

Important examples:

- missing Zoom scopes
- user does not exist
- user pending instead of active
- no active licensed pool
- overlapping assignments already consuming the pool

Reason:

- operations users need to know whether the fix is in Zoom admin, account activation, or scheduling data

## Current Known Tradeoff

The architecture is correct functionally but still transitional technically because both `zuvy_user_licenses` and `licenses` are used.

This is acceptable short-term because it preserves compatibility with existing foreign keys.

## Recommended Next Cleanup

Future cleanup should:

1. move `zuvy_sessions.license_id` to `zuvy_user_licenses.id`
2. move `license_assignments.license_id` to `zuvy_user_licenses.id`
3. remove legacy dependence on `licenses`
4. make protected donor accounts configurable through environment or admin settings

## Current Outcome

The current system now supports:

- dynamic instructor-hosted Zoom scheduling
- donor downgrade before upgrade
- Zoom pool sync from live Zoom state
- protected donor accounts
- meaningful operational errors

That is the current accepted behavior of dynamic Zoom license allocation in this codebase.
