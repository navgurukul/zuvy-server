# Attendance Worker — Architecture & Design Decisions

## 1. Background / Problem

Attendance used to be computed entirely inside a single cron job:
`ScheduleService.backfillInvitedStudentsAttendanceMidnight` (`src/schedule/schedule.service.ts`), running every 6 hours (`0 */6 * * *`). On each tick it would:

1. Find every completed Zoom session missing an aggregated attendance row.
2. Batch-call `ZoomService.computeAttendance75(zoomIds)` for all of them.
3. Synchronously write `zuvy_student_attendance` (aggregated) and `zuvy_student_attendance_records` (per-student) rows.
4. Recompute batch attendance percentages.

Problems with that model:

- **Up to 6 hours of lag** between a class ending and attendance showing up.
- **Heavy, unbounded work inside one cron tick** — one slow/failing Zoom call could stall the whole batch.
- **No retry/backoff** — a transient Zoom API failure meant that session's attendance silently never got backfilled until the next tick found it still missing.
- Inconsistent with the pattern already adopted for recordings, which had already been split out of this same cron into a dedicated, webhook-triggered worker (`RecordingWorkerService`).

The ask: apply the exact same split to attendance — pull the heavy lifting out of the cron into a dedicated worker, and drive it by the Zoom `meeting.ended` webhook instead of a timer.

## 2. Reference architecture: the Recording Worker

The recording pipeline (already in the codebase, unchanged by this work) is the template:

- **`zuvy_session_recordings`** — a job-queue table with a `status` state machine (`DISCOVERED → PROCESSING_METADATA → METADATA_READY → ... → COMPLETED`, or `FAILED` / `PERMANENT_FAILED`), `retry_count`, `next_retry_at`, `last_error`.
- **`RecordingWorkerService`** (`src/services/recording-worker/`) — polls/pops one job at a time with a row-locked `UPDATE ... RETURNING` (`FOR UPDATE SKIP LOCKED`), safe to run from multiple instances.
- **`RecordingWorkerTriggerService`** — an in-memory RxJS `Subject` the webhook controller calls (`triggerNow()`) to wake the worker immediately instead of waiting for its 5s poll.
- **`zoom.webhook.controller.ts`** — on `recording.completed` / `meeting.ended`, upserts a job row and calls `triggerNow()`.
- **`ScheduleService`**'s 6-hourly cron was reduced to a **discovery-only safety net**: it doesn't do any Zoom API work or DB writes of actual data — it just inserts `DISCOVERED` rows for sessions the webhook might have missed (e.g. webhook delivery failure, server downtime during the event).

This design gives you: near-instant processing via the webhook, resilience via the poll + cron safety net, and safe retries with backoff — all without ever double-processing a session (idempotent inserts, `SKIP LOCKED` job picking).

## 3. What was built for attendance

The same shape, applied to attendance, with one simplification: attendance computation doesn't have recording's multi-stage pipeline (download → merge → upload), it's fetch-compute-persist in one shot, so the job's state machine is much shorter.

### 3.1 New table: `zuvy_session_attendance_jobs`

Added to `drizzle/schema.ts`, migration in `drizzle/migrations/0038_create_zuvy_session_attendance_jobs.sql`.

| Column                                       | Purpose                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `session_id`                                 | FK → `zuvy_sessions.id`, cascade delete                                                                               |
| `zoom_meeting_id`                            | The Zoom numeric meeting ID used to call the Zoom API                                                                 |
| `zoom_meeting_uuid`                          | Zoom's meeting UUID (nullable — see §4.3)                                                                             |
| `batch_id`, `bootcamp_id`                    | Denormalized from the session at job-creation time, used as a fallback if the session itself is later deleted/changed |
| `status`                                     | `DISCOVERED → PROCESSING → COMPLETED`, or `FAILED` / `PERMANENT_FAILED`                                               |
| `retry_count`, `next_retry_at`, `last_error` | Retry/backoff bookkeeping                                                                                             |
| `attendance_computed_at`                     | Timestamp set on successful completion                                                                                |

Constraints: `UNIQUE (session_id, zoom_meeting_uuid)` (restart-safe insert), plus indexes on `status` and `zoom_meeting_id` for the job-picker query.

**Important**: this table stores no attendance _data_. It is purely a queue/orchestration record — same role `zuvy_session_recordings` plays for videos. The actual attendance data continues to live in the two tables that already existed:

- **`zuvy_student_attendance`** — one aggregated row per meeting (`meetingId`, `attendance` jsonb, `batchId`, `bootcampId`)
- **`zuvy_student_attendance_records`** — one row per student per session (`userId`, `sessionId`, `status`, `duration`, ...)

Nothing about those two tables' schema, meaning, or the ~10 other files that already read from them (leaderboard, batch enrollment %, student dashboards, etc.) changes.

### 3.2 New module: `src/services/attendance-worker/`

- **`attendance-worker-trigger.service.ts`** — verbatim copy of `RecordingWorkerTriggerService`'s pattern: an RxJS `Subject`, `triggerNow()` debounced to once per 3 seconds.
- **`attendance-worker.service.ts`** (`AttendanceWorkerService`, `OnModuleInit`):
  - Gated by `ATTENDANCE_WORKER_ENABLED=true` env flag (mirrors `RECORDING_WORKER_ENABLED`).
  - `onModuleInit` subscribes to the trigger's `onTrigger()` observable (instant wake-up) **and**, when enabled, also runs a `setInterval(..., 5000)` poll as a fallback in case a trigger event is ever missed.
  - `runWorkerOnce()` — guarded by an `isWorkerRunning` flag, loops `pickJob()` → `processJob()` until no jobs remain.
  - `pickJob()` — single `UPDATE zuvy_session_attendance_jobs SET status = 'PROCESSING' WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`. Safe for multiple app instances running the worker concurrently — no two instances can pick the same row.
  - `processJob(job)` → `computeAndPersistAttendance(job)`:
    1. Calls the **existing, unmodified** `ZoomService.computeAttendance75(job.zoom_meeting_id)` — this already does the live-meeting check, batch/host lookup, participant report fetch, 75%-of-host-duration threshold calculation, and fills in `absent` for invited students who never joined.
    2. If the meeting is still live (`data.live`/`data.skipped`), the job is reverted to `DISCOVERED` with `next_retry_at = NOW() + 5 minutes` — **no retry-count penalty**, since "still live" isn't a failure.
    3. Otherwise, persists exactly what the old cron persisted: an aggregated row into `zuvy_student_attendance` and per-student rows into `zuvy_student_attendance_records` (de-duplicated against any existing records for that session), then calls the existing `TrackingService.recomputeBatchAttendancePercentages(batchId)`.
    4. Marks the job `COMPLETED`.
  - `markFailed(job, error)` — exponential backoff with jitter (1m, 2m, 4m, ... capped at 15m), `PERMANENT_FAILED` after 5 attempts. Identical helper shape to the recording worker's.
- **`attendance-worker.module.ts`** — provides `AttendanceWorkerService`, `AttendanceWorkerTriggerService`, `ZoomService`; imports `TrackingModule` (for `TrackingService`); exports both worker services.

**No changes were made to `ZoomService`.** `computeAttendance75` already had everything the worker needed.

### 3.3 Webhook wiring

`zoom.webhook.controller.ts`'s `meeting.ended` branch (which already existed for recordings) now does one additional thing: it inserts a `zuvy_session_attendance_jobs` row (idempotent, `NOT EXISTS` guard) and calls `attendanceWorkerTrigger.triggerNow()`.

The insert sets `next_retry_at = NOW() + INTERVAL '3 minutes'` rather than leaving it immediately pickable. This is deliberate: `computeAttendance75`'s "meeting still live" check only guards against the meeting not having ended yet — it does **not** guard against Zoom's participant report endpoint simply not having finished populating yet right after `meeting.ended` fires. The 3-minute buffer avoids a wasted first attempt (and a retry-count decrement) for that near-universal race condition.

`zoom.webhook.module.ts` now imports `AttendanceWorkerModule` alongside `RecordingWorkerModule`.

### 3.4 Cron: reduced to a discovery-only safety net

`ScheduleService.backfillInvitedStudentsAttendanceMidnight` (still runs every 6 hours) keeps its existing query for "completed sessions with no attendance row yet," but instead of calling the now-deleted `backfillAttendanceForSessions` (which used to do the Zoom fetch + DB writes inline), it does a lightweight, idempotent `INSERT ... WHERE NOT EXISTS` into `zuvy_session_attendance_jobs` — the exact same shape as the pre-existing "Step 2: DISCOVER recordings" block right below it — then calls `attendanceWorkerTrigger.triggerNow()`.

`backfillAttendanceForSessions` (the old ~150-line method that did the batch Zoom fetch + persistence) was deleted entirely; its logic now lives in `AttendanceWorkerService.computeAndPersistAttendance`, operating one job at a time instead of one giant batch.

As a side effect, `ScheduleService` no longer needs `TrackingService` (its only use was inside the deleted method), so that injection was removed, and `TrackingModule` was dropped from `ScheduleModule`'s imports (it now only reaches `TrackingService` transitively via `AttendanceWorkerModule`, which `ScheduleModule` imports for `AttendanceWorkerTriggerService`).

### 3.5 App wiring

`app.module.ts` imports `AttendanceWorkerModule`.

**Deliberate deviation from the recording pattern**: `RecordingWorkerService`/`RecordingWorkerTriggerService` are currently declared _both_ inside `RecordingWorkerModule` (which `ZoomWebhookModule` imports) _and_ directly in `AppModule`'s own `providers` array. In Nest, a class provided in two module scopes that don't import/export from each other gets **two separate singleton instances**. That means the webhook controller's `triggerNow()` call and the worker's `onModuleInit` subscription could be talking to two different `Subject` instances — silently downgrading "instant webhook trigger" to "eventually picked up by the 5s poll" for recordings.

This looks like a pre-existing bug, not a pattern worth copying. `AttendanceWorkerService`/`AttendanceWorkerTriggerService` are **only** declared inside `AttendanceWorkerModule`; `AppModule` and `ZoomWebhookModule` both reach the same singleton purely via the module import graph. The existing recording registration was left untouched (out of scope for this change) but is worth fixing separately if instant recording triggers matter.

## 4. Key design decisions

### 4.1 Keep the cron as a discovery-only safety net (not pure webhook-only)

Zoom webhook delivery isn't guaranteed (network blips, app downtime during the event, etc.). A pure webhook-only design would mean a missed `meeting.ended` event = that session's attendance never gets computed, silently, forever. The cron now costs almost nothing (~a few lightweight `INSERT ... WHERE NOT EXISTS` per tick) while guaranteeing eventual consistency. Confirmed with the team as the preferred approach over pure webhook-only.

### 4.2 Reuse `ZoomService.computeAttendance75` as-is

It already encapsulated every piece of business logic the worker needed (live-check, threshold math, invited-student absent-fill). Rewriting or forking it would have duplicated ~100 lines of already-correct logic and risked behavior drift between the "old" and "new" attendance math. The worker is a thin orchestration/persistence layer around an unchanged core.

### 4.3 `zoom_meeting_uuid` is often `NULL` on job rows created by the cron

The cron's session query never selected `zuvySessions.zoomMeetingUuid`, so cron-created discovery rows only populate `zoom_meeting_id`. This is fine: the `NOT EXISTS` dedup checks on `zoom_meeting_id` alone are sufficient to prevent duplicate jobs for the same session, and `computeAttendance75` is called with `zoom_meeting_id`, not the UUID, so processing is unaffected.

### 4.4 `zuvy_student_attendance.meeting_id` stores the session's own `meetingId`, not the Zoom meeting ID

This looks like an inconsistency at first glance but it's intentional and preserves prior behavior exactly: the old cron code stored `session.meetingId` (the session's internal/calendar identifier) into `zuvy_student_attendance.meetingId`, while using `session.zoomMeetingId` only to call the Zoom API. The worker re-fetches the session row and mirrors this exactly (`attendance-worker.service.ts`, `computeAndPersistAttendance`) so existing consumers of `zuvy_student_attendance.meeting_id` see no change in the values they get.

### 4.5 No new columns/behavior on `ZoomService`, `TrackingService`, or the two attendance data tables

Scoping the change to "new job table + new worker + webhook wiring + shrink the cron" kept the blast radius small and made it possible to verify no new TypeScript errors were introduced (see verification below) without touching any code the rest of the app depends on.

## 5. Files touched

| File                                                                  | Change                                                                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `drizzle/schema.ts`                                                   | Added `zuvySessionAttendanceJobs` table definition                                                                 |
| `drizzle/migrations/0038_create_zuvy_session_attendance_jobs.sql`     | New — idempotent `CREATE TABLE`/`CREATE INDEX`/constraint SQL                                                      |
| `src/services/attendance-worker/attendance-worker-trigger.service.ts` | New                                                                                                                |
| `src/services/attendance-worker/attendance-worker.service.ts`         | New                                                                                                                |
| `src/services/attendance-worker/attendance-worker.module.ts`          | New                                                                                                                |
| `src/webhooks/zoom/zoom.webhook.module.ts`                            | Import `AttendanceWorkerModule`                                                                                    |
| `src/webhooks/zoom/zoom.webhook.controller.ts`                        | `meeting.ended` branch also upserts an attendance job + triggers the worker                                        |
| `src/schedule/schedule.service.ts`                                    | Cron shrunk to discovery-only; `backfillAttendanceForSessions` deleted; unused `TrackingService` injection removed |
| `src/schedule/schedule.module.ts`                                     | Swapped `TrackingModule` import for `AttendanceWorkerModule`                                                       |
| `src/app.module.ts`                                                   | Import `AttendanceWorkerModule` (not re-declared in `providers`, see §3.5)                                         |

## 6. Environment / deployment requirements

- **Run the migration** (`drizzle/migrations/0038_create_zuvy_session_attendance_jobs.sql`) against every environment (dev/stage/prod) before deploying this code — the worker and webhook handler will error on `zuvy_session_attendance_jobs` not existing otherwise.
- **Set `ATTENDANCE_WORKER_ENABLED=true`** in `.env` for the worker's poll loop and job processing to actually run. Without it, jobs will pile up as `DISCOVERED` and never get processed (mirrors `RECORDING_WORKER_ENABLED`'s behavior).
- **Zoom App → Feature → Event Subscriptions**: confirm `meeting.ended` and `recording.completed` are both subscribed, pointing at `POST /webhooks/zoom`, with the app's Secret Token matching `ZOOM_WEBHOOK_SECRET`.

## 7. Known limitations / follow-ups (not addressed in this change)

- The `RecordingWorkerService`/`RecordingWorkerTriggerService` duplicate-provider issue described in §3.5 still exists for the recording pipeline. Worth a dedicated fix if instant recording-webhook triggering matters in practice (currently likely falls back to the 5s poll).
- `ZoomWebhookService.handleMeetingStarted`/`handleMeetingEnded`/`handleRecordingCompleted` (`src/webhooks/zoom/zoom.webhook.service.ts`) are not actually invoked by `ZoomWebhookController` — the controller reimplements the logic it needs directly. This predates this change and wasn't touched.
- Mentor-session attendance was intentionally left out of scope — no mentor attendance flow exists in the codebase today (only `zuvy_mentor_session_recordings` exists for recordings), so `zuvy_session_attendance_jobs` only covers `zuvy_sessions` (batch class sessions).
