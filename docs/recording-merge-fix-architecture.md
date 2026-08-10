# Recording Multi-Instance Merge Fix — Architecture & Design Decisions

## 1. The bug

For a single class session (or mentor booking), Zoom can produce **multiple recording "instances"** under the same `zoom_meeting_id` — e.g. the host's connection drops and they restart the same scheduled meeting, or the meeting is stopped and resumed. Each instance gets its own `zoom_meeting_uuid` and its own set of recording files, but Zoom fires a separate `recording.completed` webhook per instance, always reporting the _same_ `zoom_meeting_id`.

**Observed symptom**: only the _first_ recording of a session ever got uploaded to YouTube. Any later instance's footage was silently dropped.

**Confirmed with real data**: session `1895` / meeting `82086654898` had two full instances:

| Event                              | Time     |
| ---------------------------------- | -------- |
| `meeting.started` (instance 1)     | 10:13:12 |
| `meeting.ended` (instance 1)       | 10:22:37 |
| `recording.completed` (instance 1) | 10:24:18 |
| `meeting.started` (instance 2)     | 10:28:50 |
| `meeting.ended` (instance 2)       | 10:33:30 |
| `recording.completed` (instance 2) | 10:34:53 |

`zuvy_session_recordings` had exactly **one row** for this session (`id 1461`): `created_at` matched the _first_ `meeting.ended`, `updated_at` matched the _second_ `recording.completed`, and `status` was already `COMPLETED` by the time the second event arrived. The row's manifest had been silently overwritten by instance 2's segments, but since the worker had already driven it to `COMPLETED` (uploaded instance 1's video) before instance 2's webhook landed, and `COMPLETED` rows are permanently excluded from the worker's job-picker query, instance 2's footage was captured in a column nobody ever looked at again.

## 2. Root cause

In `zoom.webhook.controller.ts`'s old `recording.completed` handler:

1. **Identity collapse**: the `UPDATE`/`INSERT ... WHERE NOT EXISTS` matching predicate was `session_id = X AND (zoom_meeting_id = Y OR zoom_meeting_uuid = Z)`. Because `zoom_meeting_id` is identical across instances, the second instance's event matched the _same row_ the first instance created — it was never treated as "a new instance to fold in," just "an update to the existing thing."
2. **Replace, not merge**: the manifest column was overwritten wholesale (`zoom_recording_manifest = ${JSON.stringify(manifest)}`) with a manifest built fresh from _only_ the current webhook's `recording_files` — no attempt to combine with what was already there.
3. **`COMPLETED` is a dead end**: the `status` CASE logic correctly preserves `COMPLETED`/other in-flight statuses as-is (so it doesn't accidentally reprocess a job mid-flight) — but combined with #1 and #2, this meant a second instance arriving _after_ completion updated the manifest column but the row was never picked up again (`RecordingWorkerService.pickJob()` only selects `DISCOVERED`, `FAILED`, `METADATA_READY`, `DOWNLOADING`, `DOWNLOADED`, `MERGED` — never `COMPLETED`).

**A second, adjacent bug found while fixing this**: mentor-booking recordings were never actually ingested by this webhook at all. The handler looked up the owning session first and, if none was found, `return`ed early — before it ever reached the `zuvy_mentor_session_recordings` update block further down. Since a meeting ID belongs to either a class session _or_ a mentor booking, never both, that early return made the mentor-recording code path permanently unreachable for genuine mentor bookings.

**A third, adjacent bug**: the webhook's manifest was built with a raw `.filter(mp4).map(...)`, skipping `RecordingWorkerService.buildSegmentManifest()`'s existing dedup-by-time-window logic (which picks one best camera angle — speaker / shared-screen / gallery — per moment, in case Zoom recorded several simultaneous views). Since `fetchZoomMetadata()` trusts a webhook-supplied manifest as-is (`metadata_verified === true` short-circuits its own Zoom API call), any redundant simultaneous-angle segments the webhook captured flowed straight through to the merge step uncorrected.

## 3. Decisions made

- **Scope**: fix applies to both `zuvy_session_recordings` (class sessions) and `zuvy_mentor_session_recordings` (mentor bookings) — same bug shape, same code, in one change.
- **Superseded video handling**: when a session gets new segments _after_ it was already uploaded, the worker re-merges + re-uploads a new YouTube video containing the full combined footage, then **deletes the old, now-superseded video** (best-effort — logged on failure, never fails the job).
- **No historical backfill**: this is a forward-only fix. Sessions already affected (like 1895) keep their existing partial upload as-is unless someone manually flags a specific session for reprocessing later.
- **No destructive migration**: the existing `(session_id, zoom_meeting_uuid)` unique constraint on `zuvy_session_recordings` is left untouched. The fix works by always looking up "the canonical row for this owner" (by `session_id`/`mentor_booking_id`) rather than by relying on that composite key, so no data migration or constraint change was needed.

## 4. Design

### 4.1 Schema (purely additive)

Added to both `zuvySessionRecordings` and `zuvyMentorSessionRecordings` in `drizzle/schema.ts`:

| Column                                         | Purpose                                                                                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ingested_meeting_uuids` (jsonb, default `[]`) | Tracks which Zoom instance UUIDs have already been folded into this row's manifest — makes cross-instance merging idempotent against webhook redelivery  |
| `previous_drive_file_id` (text)                | Holds a superseded YouTube video ID between "new segments arrived, reopening a completed job" and "the new upload succeeded, safe to delete the old one" |

Migration: `drizzle/migrations/0039_add_recording_multi_instance_merge_support.sql` — four `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements, nothing else. Safe to run with zero data impact.

### 4.2 `RecordingWorkerService.ingestRecordingCompleted()`

New method, replacing the old inline raw-SQL block that used to live in the controller. Called once per owner type (session, mentor) whenever a `recording.completed` webhook arrives. Algorithm:

1. Build this instance's manifest via the existing `buildSegmentManifest()` (fixes the dedup issue from §2 for free).
2. `SELECT * FROM <table> WHERE <owner column> = ownerId ORDER BY created_at DESC LIMIT 1` — look up the canonical row for this owner. There should only ever be one going forward.
3. **No row exists** → plain `INSERT`: this instance's manifest, `ingested_meeting_uuids = [meetingUuid]`, `status = 'DISCOVERED'`. Identical end result to before for the (overwhelmingly common) single-instance case.
4. **Row exists, this `meetingUuid` already in `ingested_meeting_uuids`** → no-op. Handles Zoom's webhook redelivery without double-counting segments.
5. **Row exists, genuinely new instance** → compute in JS:
   - `combinedManifest = [...existingManifest, ...newManifest]`, sorted by `recording_start` ascending.
   - `ingestedUuids = [...existing, meetingUuid]`.
   - `segments_count`, `recording_start` (earliest), `recording_end` (latest) all derived from the freshly combined, sorted array.
   - Then branch on the row's current status:
     - **`COMPLETED`** (the exact scenario that broke on 2026-07-10): reset `status = 'METADATA_READY'` (metadata's already known, skip straight to re-download), clear `merged_file_path`/`is_final_merged`, move `drive_file_id`/`drive_link` → `previous_drive_file_id` (and clear the former two, so `uploadToYoutube`'s idempotency guard doesn't think it's already done).
     - **`FAILED` / `PERMANENT_FAILED`**: reset `status = 'METADATA_READY'`, `retry_count = 0`, `last_error = NULL` — new data deserves a fresh attempt.
     - **Anything else** (still mid-pipeline): just write the merged fields, leave `status` alone. `mergeRecording()` already re-reads the row fresh from DB right before merging, so an in-flight job naturally picks up the fuller manifest on its current or next pass.

### 4.3 `getMergedFileName()` — segment-count-aware

Previously: `${prefix}-merged.mp4`. Now: `${prefix}-merged-${segments_count}.mp4`.

This is what makes `mergeRecording()`'s "if a merged file already exists on disk, skip re-merging" cache check safe under this new reopen flow. Without this, a reopened job with more segments than the original merge would find the _old_, incomplete merged file still sitting on disk and silently reuse it — uploading the same partial video a second time. Keying the filename by segment count means a reopened job with a different segment count naturally gets a fresh path. (Stale merged files become harmless orphaned disk usage, cleaned up the same way completed uploads already clean up their merged file today.)

### 4.4 `uploadToYoutube()` — superseded video cleanup

After a successful new upload, if the job's `previous_drive_file_id` is set, the worker best-effort calls `youtube.videos.delete({ id: previousDriveFileId })` in its own try/catch (logs a warning on failure, never throws/fails the job), then clears `previous_drive_file_id` in the same `COMPLETED` update.

**Note**: this requires the YouTube OAuth token (`GOOGLE_YT_REFRESH_TOKEN`) to have a delete-capable scope (`youtube` or `youtube.force-ssl`, not just `youtube.upload`). Worth confirming during testing — a scope failure here is non-fatal (wrapped in try/catch) but will mean superseded videos silently accumulate instead of being cleaned up.

### 4.5 Webhook controller changes

- **`recording.completed`**: now looks up an owning session _and_ an owning mentor booking independently (fixing the mentor-recordings-never-ingested bug from §2), and calls `ingestRecordingCompleted()` for whichever one owns the meeting. No more inline raw SQL for the manifest UPDATE/INSERT — that logic now lives entirely in `RecordingWorkerService`.
- **`meeting.ended`**: the "ensure a recording job exists" bootstrap insert is simplified to match by owner ID alone (`NOT EXISTS (SELECT 1 FROM ... WHERE session_id = s.id)`) instead of the old `(zoom_meeting_id OR zoom_meeting_uuid)` predicate — consistent with the new one-row-per-owner model. A mirrored bootstrap insert was added for mentor bookings (previously there was none at all).

## 5. Files touched

| File                                                                     | Change                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drizzle/schema.ts`                                                      | Added `ingestedMeetingUuids` + `previousDriveFileId` to both recording tables                                                                                                                |
| `drizzle/migrations/0039_add_recording_multi_instance_merge_support.sql` | New — additive `ALTER TABLE ADD COLUMN IF NOT EXISTS` only                                                                                                                                   |
| `src/services/recording-worker/recording-worker.service.ts`              | New `ingestRecordingCompleted()`; `getMergedFileName()` segment-count-aware; `uploadToYoutube()` deletes superseded video                                                                    |
| `src/webhooks/zoom/zoom.webhook.controller.ts`                           | `recording.completed` calls the new service method (session + mentor, independently); `RecordingWorkerService` injected; `meeting.ended` bootstrap simplified + mirrored for mentor bookings |

No changes needed to `zoom.webhook.module.ts`, `recording-worker.module.ts`, or `app.module.ts` — `RecordingWorkerService` was already exported from `RecordingWorkerModule`, which `ZoomWebhookModule` already imports.

## 6. Deployment requirements

- Run migration `0039_add_recording_multi_instance_merge_support.sql` against each environment before deploying this code.
- No env var changes — reuses `RECORDING_WORKER_ENABLED`, `YOUTUBE_UPLOAD_ENABLED`, `GOOGLE_YT_REFRESH_TOKEN` as-is.
- Confirm the YouTube OAuth token's granted scope includes video deletion (see §4.4) if you want superseded-video cleanup to actually work — otherwise it just logs warnings and leaves old videos up.
- **Rebuild and restart the actual deployed process.** The previous debugging session on this codebase (attendance worker) traced a real production gap to `.env` being updated without the running process actually being rebuilt from the new code — the same discipline applies here.

## 7. Known limitations / explicitly out of scope

- **No backfill for historical sessions** already affected by this bug (e.g. 1895) — by design, per the confirmed decision in §3.
- **Race window**: if a new `recording.completed` event arrives for a row that's currently mid-pipeline (e.g. actively downloading), the merged fields get written but `status` is left alone. If the worker's _current_ pass already read `local_segment_paths`/manifest before the new data landed, the new segment won't be included until a _subsequent_ pass notices it's not `COMPLETED` yet — this self-heals, but isn't instantaneous. Not a concern in the fixed-and-broken scenario (arriving after `COMPLETED`), which is the one this change specifically targets.
- **Orphaned stale merged files on disk**: segment-count-aware filenames (§4.3) mean old, superseded merged files aren't explicitly deleted, just no longer referenced. Low-impact (they get cleaned up incidentally whenever a completed upload's own `fs.unlinkSync` runs on its own path), but a periodic temp-dir sweep would be a reasonable future addition if this becomes noticeable.
- **YouTube delete scope** (§4.4) hasn't been verified against the actual deployed OAuth token yet — flagged as a testing action item, not assumed to work.
