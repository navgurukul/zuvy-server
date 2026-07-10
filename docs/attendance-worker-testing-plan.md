# Attendance Worker — Testing Plan

Companion to `docs/attendance-worker-architecture.md`. Use this to verify the webhook-driven attendance pipeline end-to-end before/after deploying.

Legend: 🖥️ = run locally, 🌐 = requires a real Zoom meeting, 🗄️ = SQL against your dev DB.

---

## 0. Prerequisites (do this first, once)

- [ ] **Run the migration**: apply `drizzle/migrations/0038_create_zuvy_session_attendance_jobs.sql` to your target DB.
  ```sql
  -- sanity check after running it
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'zuvy_session_attendance_jobs' ORDER BY ordinal_position;
  ```
  Expect: `id, session_id, zoom_meeting_id, zoom_meeting_uuid, batch_id, bootcamp_id, status, retry_count, next_retry_at, last_error, attendance_computed_at, created_at, updated_at`.
- [ ] **Set env vars** in `.env`:
  ```
  ATTENDANCE_WORKER_ENABLED=true
  ZOOM_WEBHOOK_SECRET=<must match the Secret Token shown in Zoom Marketplace app → Feature tab>
  ```
- [ ] **Zoom App → Feature → Event Subscriptions**: confirm `meeting.ended` and `recording.completed` are subscribed, pointing at `https://<your-host>/webhooks/zoom`. If testing locally, point this at an `ngrok`/tunnel URL.
- [ ] **Build/typecheck** passes:
  ```bash
  npx tsc --noEmit -p tsconfig.json
  ```
  Expect the same pre-existing error count as `main` (22 as of this change) — none should reference `attendance-worker`, `schedule.service`, `zoom.webhook.controller`, `app.module`, or `drizzle/schema.ts`.
- [ ] **Start the server** and confirm clean boot — watch for:
  ```
  [Nest] ... AttendanceWorkerService ...
  ```
  and no DI resolution errors (`Nest can't resolve dependencies of AttendanceWorkerService...`). If `TrackingService` fails to resolve, check `AttendanceWorkerModule` imports `TrackingModule`.

---

## 1. Static / data-safety checks 🖥️🗄️

| #   | Check                                             | How                                                                                                                                  | Pass criteria                                                                 |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1.1 | Migration didn't touch existing attendance tables | `git diff` the migration file, or `\d zuvy_student_attendance` / `\d zuvy_student_attendance_records` before/after                   | Schemas identical to pre-migration                                            |
| 1.2 | New table has the unique constraint               | `\d zuvy_session_attendance_jobs` in psql                                                                                            | `uniq_session_attendance_uuid UNIQUE (session_id, zoom_meeting_uuid)` present |
| 1.3 | Status CHECK constraint works                     | `INSERT INTO zuvy_session_attendance_jobs (session_id, zoom_meeting_id, status) VALUES (<real_session_id>, 'test', 'BOGUS_STATUS');` | Insert **fails** with a check-constraint violation                            |
| 1.4 | Rerunning the migration is safe                   | Run the `.sql` file a second time against the same DB                                                                                | No errors (all `IF NOT EXISTS` / `DROP ... IF EXISTS` guards)                 |

---

## 2. Happy-path webhook flow 🖥️🌐

The most important test: a real (or simulated) `meeting.ended` webhook should result in a `COMPLETED` job and correct rows in the two attendance data tables within seconds.

### 2a. End-to-end with a real Zoom meeting (preferred, run at least once before shipping)

1. Pick (or create) a `zuvy_sessions` row with `is_zoom_meet = true`, a real `zoom_meeting_id`, and at least one entry in `invited_students` whose email matches a real participant.
2. Start that Zoom meeting, have the invited participant join for >75% of the host's duration, then end the meeting.
3. Watch server logs for, in order:
   - `Meeting ended: <meetingId>` (existing recording-discovery log)
   - the attendance job insert (no explicit log currently, but check DB — see step 4)
   - after ~3 minutes (the deferral built into the webhook insert): `⚡ Immediate attendance worker execution triggered by webhook` and `Processing attendance job`
   - `Attendance computed and persisted` with a `recordCount > 0`
4. 🗄️ Verify the job:
   ```sql
   SELECT id, session_id, status, retry_count, attendance_computed_at, last_error
   FROM zuvy_session_attendance_jobs
   WHERE zoom_meeting_id = '<meetingId>'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Expect `status = 'COMPLETED'`, `attendance_computed_at` set, `last_error IS NULL`.
5. 🗄️ Verify the data landed in the real tables:

   ```sql
   SELECT * FROM zuvy_student_attendance WHERE meeting_id = (
     SELECT meeting_id FROM zuvy_sessions WHERE zoom_meeting_id = '<meetingId>'
   ) ORDER BY id DESC LIMIT 1;

   SELECT user_id, status, duration FROM zuvy_student_attendance_records
   WHERE session_id = (SELECT id FROM zuvy_sessions WHERE zoom_meeting_id = '<meetingId>');
   ```

   Expect the aggregated `attendance` jsonb array to list your test participant as `present`, and a matching per-student row with `status = 'present'`.

6. 🗄️ Verify batch % recompute fired:
   ```sql
   SELECT user_id, attendance FROM zuvy_batch_enrollments WHERE batch_id = <batchId>;
   ```
   Expect the attending student's `attendance` percentage to reflect the new session.

### 2b. Simulated webhook (no real meeting needed — for local/dev iteration)

Since the controller validates `x-zm-signature` against the **exact raw request body string**, use a small script rather than hand-crafted `curl` (JSON key ordering/whitespace must match exactly what's hashed).

```js
// scripts/simulate-zoom-webhook.js  (temporary, not committed)
const crypto = require('crypto');
const http = require('http');

const SECRET = process.env.ZOOM_WEBHOOK_SECRET;
const HOST = 'localhost';
const PORT = 3000; // match your app's port

const payload = {
  event: 'meeting.ended',
  event_ts: Date.now(),
  payload: {
    object: {
      id: '<real zoom_meeting_id from a zuvy_sessions row>',
      uuid: 'test-uuid-' + Date.now(),
    },
  },
};

const body = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000).toString();
const message = `v0:${timestamp}:${body}`;
const signature =
  'v0=' + crypto.createHmac('sha256', SECRET).update(message).digest('hex');

const req = http.request(
  {
    host: HOST,
    port: PORT,
    path: '/webhooks/zoom',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-zm-request-timestamp': timestamp,
      'x-zm-signature': signature,
    },
  },
  (res) => {
    console.log('status', res.statusCode);
    res.on('data', (d) => process.stdout.write(d));
  },
);
req.write(body);
req.end();
```

Run: `ZOOM_WEBHOOK_SECRET=... node scripts/simulate-zoom-webhook.js`

Expect: `200`, a new row in `zuvy_zoom_webhook_events` with `processing_status = 'PROCESSED'`, and a new `DISCOVERED` row in `zuvy_session_attendance_jobs` with `next_retry_at` ~3 minutes out.

⚠️ This simulated event will hit the real `ZoomService.computeAttendance75`, which calls the real Zoom API — it will only succeed end-to-end if `zoom_meeting_id` corresponds to a real, ended meeting with a participant report available. Otherwise expect a `FAILED` job (see §3) — which is still a useful test of the failure path.

### 2c. Instant trigger vs poll fallback

- [ ] With `ATTENDANCE_WORKER_ENABLED=true` and a job whose `next_retry_at` has already passed, manually call `AttendanceWorkerTriggerService.triggerNow()` from a webhook (i.e. steps above) and confirm the job is picked up **within ~1 second**, not waiting for the 5s poll.
- [ ] Then test the fallback in isolation: temporarily comment out the `triggerNow()` call (or just insert a row directly via SQL, bypassing the webhook), confirm the job still gets picked up within ~5 seconds by the poll alone.

---

## 3. Failure & retry behavior 🖥️🗄️

| #   | Scenario                                          | How to trigger                                                                                                                                                                                                          | Expected result                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Meeting still live                                | Insert a job for a session whose Zoom meeting is currently in progress (or mock `isMeetingLiveViaDashboard` to return `true`)                                                                                           | Job stays `DISCOVERED` (not `FAILED`), `retry_count` **unchanged**, `next_retry_at ≈ NOW() + 5 min`                                                                                                                                               |
| 3.2 | Zoom API failure (e.g. invalid `zoom_meeting_id`) | `INSERT INTO zuvy_session_attendance_jobs (session_id, zoom_meeting_id) VALUES (<real session id>, 'nonexistent-id-123');` then wait for pickup                                                                         | Job → `FAILED`, `retry_count = 1`, `last_error` populated, `next_retry_at ≈ NOW() + 1 min (+jitter)`                                                                                                                                              |
| 3.3 | Retry succeeds after backoff                      | Fix the underlying issue (e.g. update `zoom_meeting_id` to a valid one) before `next_retry_at` elapses                                                                                                                  | On the next pickup, job proceeds to `COMPLETED` normally                                                                                                                                                                                          |
| 3.4 | Permanent failure after exhausting retries        | Force 5 consecutive failures (e.g. keep `zoom_meeting_id` invalid and wait through all backoff windows — ~1+2+4+8+15min ≈ 30 min, or directly `UPDATE ... SET retry_count = 4, next_retry_at = NOW()` to speed this up) | Job → `PERMANENT_FAILED`, worker's `pickJob()` never selects it again (its `WHERE` clause excludes `PERMANENT_FAILED`)                                                                                                                            |
| 3.5 | Worker crash mid-job doesn't lose the job         | Manually set a job to `PROCESSING` via SQL and restart the app without letting it complete                                                                                                                              | ⚠️ Known limitation: a job stuck in `PROCESSING` (e.g. app crash) is **not** automatically requeued — `pickJob()` only selects `DISCOVERED`/`FAILED`. Confirm this is acceptable, or file a follow-up (recording worker has the same limitation). |

---

## 4. Idempotency / duplicate delivery 🖥️🗄️

Zoom (like most webhook providers) can redeliver the same event. Verify no duplicate work happens.

- [ ] **4.1** Send the same simulated `meeting.ended` payload (same `event_id` derivation, i.e. same timestamp+signature or same explicit `event_id`) twice in a row.
  - Expect: second delivery is caught by the `zuvy_zoom_webhook_events` unique constraint (`uniq_zoom_event`) → logged as `Duplicate Zoom event ignored` → `200` returned without re-processing.
- [ ] **4.2** Send two _different_ `meeting.ended` payloads for the **same** `zoom_meeting_id`/session (different `event_id`, simulating Zoom's own retry with a new envelope).
  - Expect: only one row in `zuvy_session_attendance_jobs` for that `(session_id, zoom_meeting_id)` — the `NOT EXISTS` guard in the insert prevents a second job row.
- [ ] **4.3** Manually re-run the cron's discovery logic (`ScheduleService.manualCronTest()`, still present and unchanged in shape) for a session that already has a job row.
  - Expect: no duplicate job row created (same `NOT EXISTS` guard, keyed on `session_id + zoom_meeting_id`).
- [ ] **4.4** Let a job reach `COMPLETED`, then manually reset it to `DISCOVERED` and let the worker reprocess it.
  - Expect: `zuvy_student_attendance` gets a second aggregated row (this table has no unique constraint / upsert — matches pre-existing behavior, not a new issue), but `zuvy_student_attendance_records` does **not** get duplicate per-student rows (existing-records dedup check in `computeAndPersistAttendance`).

---

## 5. Cron discovery safety net 🖥️🗄️

Simulates "the webhook for this session never arrived."

1. Pick/create a `zuvy_sessions` row that is `completed` (or whose `end_time` is in the past), `is_zoom_meet = true`, with a valid `zoom_meeting_id`, and **no** existing row in `zuvy_student_attendance` for its `meeting_id`, and **no** existing row in `zuvy_session_attendance_jobs`.
2. Call `ScheduleService.manualCronTest()` directly (e.g. via a temporary debug endpoint, a REPL, or a unit test) — do **not** wait for the real `0 */6 * * *` schedule.
3. 🗄️ Verify:
   ```sql
   SELECT * FROM zuvy_session_attendance_jobs WHERE session_id = <that session id>;
   ```
   Expect a new `DISCOVERED` row appears immediately (no 3-minute defer — that delay is only applied by the webhook path, not the cron path).
4. Confirm the worker picks it up and completes it as in §2.
5. Run `manualCronTest()` again immediately after.
   - Expect: **no second job row** for the same session (idempotent discovery), and the recording-discovery half of the cron (`Step 2`) still runs and behaves exactly as before (regression check — see §7).

---

## 6. Multi-instance safety (optional, do this if you run >1 app instance/pod) 🖥️🗄️

- [ ] Run two instances of the app pointed at the same DB (or simulate by calling `runWorkerOnce()` concurrently from two separate processes/scripts).
- [ ] Insert a single `DISCOVERED` job.
- [ ] Confirm **only one** instance's logs show `Processing attendance job` for that job id — the `FOR UPDATE SKIP LOCKED` in `pickJob()` should prevent both from grabbing it.

---

## 7. Regression checks — make sure nothing else broke 🖥️🗄️

- [ ] **Recording pipeline unaffected**: trigger a `recording.completed` webhook (real or simulated) and confirm `zuvy_session_recordings` still progresses through its full state machine to `COMPLETED` exactly as before this change (no code in that path was touched, but the shared webhook controller file was edited — verify by inspection/diff that the `recording.completed` branch and the recording half of `meeting.ended` are byte-for-byte unchanged).
- [ ] **Existing attendance consumers still work** — spot-check each of these still reads `zuvy_student_attendance`/`zuvy_student_attendance_records` correctly, since their queries were not modified:
  - Batch attendance % (`zuvy_batch_enrollments.attendance`) — `src/controller/progress/tracking.service.ts`
  - Leaderboard attendance points — `src/controller/leaderboard/leaderboard.service.ts`
  - Any student/instructor-facing attendance view — `src/controller/batches/batch.service.ts`, `src/controller/classes/classes.service.ts`, `src/controller/student/student.service.ts`
- [ ] **`activateDueZoomSessions` cron unaffected** — this `EVERY_MINUTE` cron in the same file wasn't touched; confirm scheduled Zoom sessions still auto-activate.
- [ ] **App boots with `ATTENDANCE_WORKER_ENABLED` unset/false** — confirm the worker no-ops cleanly (`runWorkerOnce()` returns immediately, no crash, no jobs processed) — this is the safe default for any environment that hasn't opted in yet.

---

## 8. Sign-off checklist

- [ ] All of §1–§5 pass in a dev/staging environment against real or realistic data.
- [ ] §7 regression checks pass — recording pipeline and existing attendance displays are unaffected.
- [ ] `ATTENDANCE_WORKER_ENABLED=true` and `ZOOM_WEBHOOK_SECRET` are set correctly in the target environment's `.env`/secrets manager.
- [ ] Zoom Marketplace app's Event Subscriptions include `meeting.ended` (required — this is the new trigger) and `recording.completed` (pre-existing requirement).
- [ ] Migration `0038_create_zuvy_session_attendance_jobs.sql` has been applied to that environment.
- [ ] At least one real end-to-end run (§2a) has been observed producing correct data in `zuvy_student_attendance` / `zuvy_student_attendance_records` / `zuvy_batch_enrollments`.
