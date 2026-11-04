# Mentor-slot & admin/super-admin audit — verified findings

Source: `CODE_AUDIT_REPORT_zuvy.pdf`, dated 2026-08-26 (unverified module: `controller/mentor-slot`, 19 findings; plus 5 cross-cutting guard/super-admin findings from other unverified modules, pulled in here because they directly affect the upcoming admin/super-admin dashboard work).

**Re-verification: every item below was checked against the actual current code** on `feat/md_superadmin` as of 2026-11-04 (~2 months after the audit). Result: **24/24 confirmed still true**, 0 already fixed, 3 needed a small wording correction (mechanism differs slightly, underlying bug is still real — noted inline). This audit is accurate and worth acting on.

No code has been changed yet — this is the planning note before work starts.

---

## Priority 0 — Fix before/alongside admin & super-admin dashboard work

These are foundational. Any new admin/super-admin dashboard feature will sit directly on top of this broken auth layer, so fixing it first avoids building on sand.

1. **`src/guards/roles.guard.ts` — RolesGuard denies everyone, including real admins.**
   Reads `request.user.roles` directly. Confirmed `request.user` is actually set as a bare array `[userData]` by `src/auth/strategies/jwt.strategy.ts` (Passport's `validate()` return value). An array has no `.roles`, so the guard always returns `false` for any `@Roles(...)`-protected route. Actively breaks 13 routes in `zoom.controller.ts` and at least 1 in `learner.profile.controller.ts` today. **Any `@Roles('admin')` gate added to the new dashboard will silently 403 real admins until this is fixed.**

2. **`src/super-admin/super-admin.controller.ts` — no role guard on `POST /super-admin`.**
   Only global `JwtAuthGuard` + `OrgAuthorizationGuard` apply (no `orgId` in a `{email}` body ⇒ `OrgAuthorizationGuard` short-circuits to `true`). Any logged-in user, including a student, can self-promote to `super_admin`. This is literally the surface the new super-admin dashboard extends — lock it down before adding more endpoints here.

3. **`src/rbac/rbac.controller.ts` + `src/permissions/permissions.controller.ts` — guards commented out on both parallel RBAC surfaces.**
   `PermissionsGuard` import and `@UseGuards(PermissionsGuard)` are commented out, and every `@RequirePermissions(...)` decorator is commented out per-route (e.g. `rbac.controller.ts:58,68,413`; `permissions.controller.ts:50,396`). Any authenticated user can currently grant arbitrary permissions to any role/user. If the admin dashboard includes a "manage roles/permissions" screen, it's sitting on an already wide-open backend.

4. **`src/super-admin/super-admin.service.ts` — three bugs, worth fixing together since you'll be in this file for #2 anyway:**

   - `addSuperAdmin` isn't idempotent — a second call for the same email throws a raw unique-constraint DB error instead of a clean response.
   - `addSuperAdmin` clears `zuvyUserRolesAssigned` but never clears `zuvyUserOrganizations`, despite the response message claiming "existing organization data cleared" — overstated/incorrect user-facing message.
   - `removeSuperAdmin` does two separate deletes with no transaction — a failure between them leaves an orphaned, inconsistent state.

5. **`src/guards/org-authorization.guard.ts` — narrower than the audit claims, but a real gap.**
   `extractBootcampId` _does_ resolve a bootcamp id correctly when one is present in the route/body, and _does_ perform a real enrollment check against `zuvyBatchEnrollments` in that case — this is **not dead code** as originally described. The actual gap: routes identified only by `assessmentId`/`submissionId` with no `bootcampId` field anywhere in the request silently skip the enrollment check. Real, but lower priority than 1-4 — fix opportunistically.

---

## Priority 1 — Mentor booking/dashboard correctness (user-facing)

6. **`cancelBooking` never cancels the underlying Zoom meeting** (`mentor-slot.service.ts`, cancelBooking method). Only cleanup is a Google Calendar delete, gated on `googleEventId` — which bookings never have since they're Zoom-only. Cancelled bookings leave the Zoom meeting live and orphaned.

7. **`acceptReschedule` never moves the Zoom meeting's time** (same file). Only the Google Calendar event is updated. A rescheduled session's Zoom link/time stays pointed at the original slot.

8. **`handleSessionTransitions` cron (`jobs/mentor-slot.job.ts`, `@Cron(EVERY_MINUTE)`) has no WHERE filter at all** — loads and loops over _every booking ever created_, one UPDATE per row, every minute. Gets slower forever as booking volume grows.

9. **`autoCloseExpiredSessions` (`session/session.service.ts`) fires as a side effect of the student session-listing GET endpoint**, force-marking any past-due `SCHEDULED` booking as `COMPLETED` with no attendance check — racing and pre-empting the cron job's correct `joinedAt`-aware logic (which would mark a true no-show as `MISSED`). Whichever path runs first wins; a no-show who never joined can get silently marked "completed" if a student loads their sessions list before the cron's next tick.

10. **`bookSlot` holds a `FOR UPDATE` row lock through 3 sequential live Zoom API calls** inside the same transaction (`ensureHostLicensedForWindow`, `createMeetingForUser`, `getMeeting`). Long lock-hold time under concurrent booking load on the same slot.

11. **`getMySlots` makes a live Zoom API call just to list a mentor's own slots** (`ensureMentorZoomAccountActive` → `zoomService.getUser`, a real HTTP call to Zoom). Unnecessary external dependency and latency on what should be a pure DB read — the exact kind of thing that made the "Vijay can't see his slots" dashboard bug (fixed earlier this session, on the frontend) hard to reason about.

12. **`getMentorMetrics`'s `upcomingCount` query leaks cross-mentor/cross-org counts — confirmed by me directly, narrower trigger than the audit states.** The line `sessionConditions.filter(c => !(typeof c === 'object' && filteredSlotIds.length > 0))` strips _every_ condition — including `mentorUserId`/`organizationId` scoping — whenever `filteredSlotIds.length > 0`. This only happens when `filter='30d'` or `filter='3m'` is requested (`filteredSlotIds` stays empty for the default `filter='all'`, which is what the Dashboard tab actually calls). So: **the normal dashboard load is unaffected**, but requesting the 30-day/3-month metrics view returns a platform-wide "upcoming" count instead of the mentor's own. Real data leak, just not on the default path.

---

## Priority 2 — Validation / data integrity (confirmed true)

13. **No `ValidationPipe` anywhere in the mentor-slot module, and none registered globally in `main.ts`** — every DTO decorator in this module is dead, including `CancelBookingDto.cancelledBy`'s `@IsEnum`. Correction to the audit: `cancelBooking` _does_ have a manual ownership check (`cancelledBy==='mentor' && mentorUserId!==actor`, etc.) — the real exploit is sending an invalid `cancelledBy` value (neither `'mentor'` nor `'student'`), which makes neither branch match and bypasses the check entirely, rather than the check "never running."

14. **`generateRecurringSlots` can issue up to ~600 sequential DB/Zoom round trips in one transaction** — 3 per occurrence (conflict-check, license assignment check, license assignment) × up to 200 occurrences.

15. **Recurrence conflict detection never checks newly generated occurrences against each other** — only against existing DB rows. A cadence shorter than slot duration (e.g. daily RRULE with 2h slots) can self-overlap undetected.

16. **`markAttendance` / `completeSession` never check the booking isn't already cancelled** — a mentor action can "revive" a cancelled booking.

17. **`FeedbackDto.rating` has no `@Min`/`@Max`** (not even imported) — any numeric value, including negative or absurd ones, passes validation and skews averaged ratings.

18. **`public/mentor-public.controller.ts` and `student-mentor-slot.controller.ts` are both missing `ParseIntPipe` on `:mentorUserId`** — a non-numeric path segment throws an unhandled error instead of a clean 400.

---

## Priority 3 — Cleanup (confirmed true, low urgency)

19. **`enqueueMentorRecordingJob` still writes via module-level `db` instead of the surrounding transaction's `trx`** (now at `mentor-slot.service.ts:~2801`, called from inside an open transaction at line ~1111) — cross-connection reference-to-uncommitted-row risk. Already known from earlier work this session; still present.
20. Dead code: `ensureMentorZoomVerified` (line 293, zero callers anywhere) and `enforceMinimumNotice` (line 576, every call site commented out).
21. `metrics/dto/metrics.dto.ts`'s `MentorMetricsDto` — defined, never imported or used anywhere.
22. `console.*` instead of `Logger` — 11 occurrences in `mentor-slot.service.ts` (lines 301, 315, 318, 331, 341, 352, 360, 1056, 1205, 2806, 2810); no `Logger` used in this file at all.
23. Zero test coverage for `bookSlot`'s concurrency-safe path (the exact race it's meant to prevent).

---

## Suggested order of attack

Given the upcoming admin/super-admin dashboard work specifically:

1. **Priority 0, items 1-3 first** (RolesGuard unwrap fix, super-admin guard, RBAC guards) — these are each small, high-leverage fixes that unblock everything built on top of them. Fixing #1 (RolesGuard) alone makes every existing `@Roles(...)` annotation across the codebase start working correctly, which the audit's own author suspected may be _why_ guards got commented out elsewhere (someone "fixed" broken auth by removing the check instead of fixing the guard).
2. **Priority 0, items 4-5** while already in those files.
3. **Priority 1** (6-12) — these are real user-facing mentor/booking correctness bugs, independent of the dashboard work, worth a separate pass.
4. **Priority 2-3** — can be swept opportunistically or batched into one cleanup PR.
