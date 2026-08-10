# Recording Multi-Instance Merge Fix — Testing Plan

Companion to `docs/recording-merge-fix-architecture.md`. Use this to verify the fix end-to-end before/after deploying.

Legend: 🖥️ = run locally, 🌐 = requires a real Zoom meeting, 🗄️ = SQL against your dev DB.

---

## 0. Prerequisites

- [ ] **Run the migration**: apply `drizzle/migrations/0039_add_recording_multi_instance_merge_support.sql`.
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name IN ('zuvy_session_recordings', 'zuvy_mentor_session_recordings')
    AND column_name IN ('ingested_meeting_uuids', 'previous_drive_file_id');
  -- expect 4 rows (2 columns x 2 tables)
  ```
- [ ] **Rebuild and restart** the actual deployed process — don't just touch `.env`. (See the attendance-worker debugging notes: a stale build silently running despite `.env` changes was a real production issue on this codebase.)
- [ ] `npx tsc --noEmit` — confirm no new errors introduced by this change (compare count before/after via `git stash`).
- [ ] Confirm `RECORDING_WORKER_ENABLED=true` and `YOUTUBE_UPLOAD_ENABLED=true` are set wherever you're testing.

---

## 1. Regression check — the common case (single instance) still works

This is the overwhelming majority case and must be unaffected.

1. Trigger (or simulate) one `recording.completed` event for a session with a single Zoom instance, as usual.
2. Confirm exactly one `zuvy_session_recordings` row is created, `ingested_meeting_uuids` contains exactly one UUID, and the job proceeds `DISCOVERED → ... → COMPLETED` with the video uploaded, same as before this change.
   ```sql
   SELECT id, status, segments_count, ingested_meeting_uuids, drive_link
   FROM zuvy_session_recordings
   WHERE session_id = <session id>;
   ```

---

## 2. Multi-instance merge — arriving before completion

Simulates: host restarts the meeting quickly, both instances' `recording.completed` events arrive before the worker has finished processing the first one.

1. Send two `recording.completed` events for the same session in quick succession, with **different `uuid`s** and **different `recording_files`** (different segment IDs/URLs/timestamps — the second instance's `recording_start` should be later than the first's `recording_end`).
2. 🗄️ Confirm:
   ```sql
   SELECT id, status, segments_count, ingested_meeting_uuids,
          jsonb_array_length(zoom_recording_manifest) AS manifest_len
   FROM zuvy_session_recordings
   WHERE session_id = <session id>;
   ```
   Expect: **one row**, `ingested_meeting_uuids` has both UUIDs, `manifest_len` equals the sum of both instances' segment counts.
3. Let the worker run to completion. Confirm exactly **one** merged file gets produced and exactly **one** YouTube upload happens, with the final video containing footage from both instances (spot-check duration/content, or at minimum confirm `ffprobe` duration ≈ sum of both instances' durations).

---

## 3. Multi-instance merge — arriving AFTER completion (the exact bug that shipped this fix)

This is the critical test — it's precisely what broke on session 1895 / meeting 82086654898.

1. Send `recording.completed` for instance 1. Let the worker fully process it to `COMPLETED` (confirm `drive_link` is populated, video exists on YouTube).
2. 🗄️ Note the video ID:
   ```sql
   SELECT id, status, drive_file_id, drive_link, segments_count
   FROM zuvy_session_recordings WHERE session_id = <session id>;
   ```
3. Send `recording.completed` for instance 2 (different `uuid`, different segments, later `recording_start`).
4. 🗄️ Immediately after, confirm the row **reopened**:
   ```sql
   SELECT status, segments_count, drive_file_id, previous_drive_file_id, merged_file_path, is_final_merged
   FROM zuvy_session_recordings WHERE session_id = <session id>;
   ```
   Expect: `status = 'METADATA_READY'`, `segments_count` increased to include both instances, `merged_file_path IS NULL`, `is_final_merged = false`, `drive_file_id IS NULL`, `previous_drive_file_id` = the video ID noted in step 2.
5. Let the worker run again. Confirm:
   - A **new** merged file gets produced (check server logs for the merge step — filename should include the new, higher `segments_count`).
   - A **new** YouTube video gets uploaded containing both instances' combined footage.
   - `zuvy_session_recordings.drive_file_id`/`drive_link` now point at the new video; `previous_drive_file_id` is back to `NULL`.
   - `zuvy_sessions.youtube_video_id`/`s3link` updated to the new video.
6. **Verify the old video was actually deleted** — check the YouTube channel directly, or attempt to fetch the old video ID via the API and confirm it's gone (`404`/not found).
   - If it's _not_ deleted but everything else worked: check server logs around the `uploadToYoutube` step for a "Failed to delete superseded YouTube video" warning — this points at the OAuth token missing delete scope (see architecture doc §4.4/§7). Non-blocking, but worth fixing the token's scope separately if so.

---

## 4. Idempotency

1. Redeliver the **exact same** `recording.completed` event (same `uuid`) a second time, after step 3's row already ingested it.
2. 🗄️ Confirm `segments_count` and `ingested_meeting_uuids` length are **unchanged** — the duplicate delivery should be a no-op, not double-counted.

---

## 5. Mentor booking path

Repeat §2 and §3 against a mentor booking (`zuvy_mentor_session_recordings`, keyed by `mentor_booking_id` instead of `session_id`) to confirm the mirrored fix behaves identically. This also implicitly tests the fix for the separate "mentor recordings were never ingested at all" bug found while building this — confirm a mentor booking's recording now gets ingested and processed at all (previously it never reached the ingestion code due to the early-return bug described in the architecture doc §2).

```sql
SELECT id, status, segments_count, ingested_meeting_uuids, drive_link
FROM zuvy_mentor_session_recordings
WHERE mentor_booking_id = <booking id>;
```

---

## 6. Regression checks — make sure nothing else broke

- [ ] **Attendance pipeline unaffected** — this change didn't touch `zoom.webhook.controller.ts`'s `meeting.ended` attendance-job insert or `AttendanceWorkerService`; confirm attendance still works end-to-end as verified previously.
- [ ] **`meeting.ended`'s recording bootstrap still works** for a fresh session with no prior recording row — confirm a `DISCOVERED` row still gets created before `recording.completed` arrives.
- [ ] **Webhook event log still records correctly**: `zuvy_zoom_webhook_events.processing_status` still ends up `PROCESSED` for `recording.completed` events (check it isn't stuck at `RECEIVED` or flipped to `FAILED`).

---

## 7. Sign-off checklist

- [ ] Migration `0039` applied to the target environment.
- [ ] §1 (regression, single instance) passes.
- [ ] §3 (the actual bug scenario — new instance after completion) passes, including confirming the superseded video is actually deleted from YouTube.
- [ ] §4 (idempotency) passes.
- [ ] §5 (mentor path) passes.
- [ ] §6 regression checks pass.
- [ ] If superseded-video deletion isn't working, YouTube OAuth scope has been checked/escalated as a follow-up (non-blocking for shipping, but worth tracking).
