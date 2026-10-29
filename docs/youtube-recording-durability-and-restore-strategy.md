# Recording Durability & YouTube Risk Strategy

Owner: Engineering (recording pipeline)
Status: §1–§4 already shipped · §5 onward proposed
Related: `docs/recording-merge-fix-architecture.md` (multi-instance merge fix, shipped in the same pipeline)

**Read this first — two independent pipelines, not one:**

- **New recordings** (Zoom → S3 → YouTube) run exactly as they do today:
  webhook-triggered, continuous 5-second poll loop, a recording is published
  as soon as each step completes. §3–§4 below are about _where_ it's stored
  (Glacier, hierarchical keys) — they don't touch _how fast_ it gets there.
- **The nightly cron in §5–§6 is a separate, secondary recovery path.** It
  never runs on a fresh recording. It only ever looks at rows already
  `status = 'COMPLETED'` — i.e. a video that was already successfully
  published, then later broke (YouTube takedown, strike, channel issue) —
  and restores it from Glacier in the background. If nothing on YouTube has
  ever broken, this job finds nothing to do and no recording is ever
  affected by it.

## 1. Principle

**YouTube is a disposable playback/distribution layer. S3 is the only durable
copy.** Nothing about this pipeline should ever assume a YouTube video is
permanent — not at upload time, not a year later. This single sentence drives
every decision below; where a proposed control doesn't trace back to it, cut
it.

This doc merges two inputs into one architecture:

1. The original S3-durability design (S3 written and checksum-verified
   before YouTube; already implemented in `recording-worker.service.ts`).
2. A policy-violation risk review (Content ID, copyright strikes, Community
   Guidelines, privacy, child safety, region-locking, API/quota/account
   compliance) and independent verification of how YouTube actually enforces
   each category, done to answer one question: **which failures are worth
   building automation for, and which aren't?**

## 2. The one thing that changes the design: not all YouTube failures are equal

Before optimizing anything, the risk categories need to be sorted along two
axes — **how fast you can find out**, and **what actually happens to the
video** — because they lead to very different engineering responses.

| Category                                   | Detection                                                           | Effect on the video                                                                         | Effect on the channel                               | Engineering response                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Content ID claim (block set)               | Automated, near-immediate (minutes–hours post-upload)               | Blocked, possibly only in some regions                                                      | None                                                | **Ignore** — restoring/re-uploading doesn't fix an ownership dispute; the new upload gets re-claimed by the same fingerprint |
| Content ID claim (monetize/track)          | Automated, near-immediate                                           | Fully playable                                                                              | None                                                | **Ignore** — cosmetic only                                                                                                   |
| Geo-restriction                            | Automated or bundled with a Content ID rule                         | Playable everywhere except named regions                                                    | None                                                | **Ignore** — partial availability isn't data loss                                                                            |
| Copyright strike (DMCA)                    | Manual, unpredictable — days to years after upload                  | **Removed**                                                                                 | Counts toward 3-strike termination                  | **Act** — restore + re-upload                                                                                                |
| Community Guidelines strike                | Automated classifier or user report + human review — hours to weeks | **Removed**                                                                                 | Counts toward termination for repeated/severe cases | **Act** — restore + re-upload, but see §6 on whether re-upload is even appropriate                                           |
| Privacy / child-safety complaint           | Human-reported, unpredictable timing                                | Edited or removed depending on severity                                                     | Can escalate fast                                   | **Act + escalate to a human** — never fully automate this response                                                           |
| 3 strikes in 90 days → channel termination | Same as above, compounding                                          | **Everything on the channel is gone**, including videos that individually did nothing wrong | Total                                               | **Act at the channel level**, not just the video level — see §6.2                                                            |
| API/account/quota issues                   | Immediate (quota) to unpredictable (audits, verification)           | New uploads blocked; existing videos unaffected                                             | Account-wide                                        | **Alert**, not a restore trigger — nothing was lost                                                                          |

Two conclusions fall out of this table that most naive "detect and restore"
designs miss:

- **Most detectable events should not trigger a restore at all.** A restore +
  re-upload cycle costs Glacier retrieval fees, YouTube quota, and — for a
  Content ID block — accomplishes nothing, since the new upload is
  fingerprint-identical and gets reclaimed instantly. Automating restore for
  every anomaly is not "more resilient," it's wasted spend that doesn't fix
  the underlying problem.
- **The real tail risk is channel termination, not any single strike.** A
  per-video health check will never catch this on its own — a terminated
  channel makes every video on it disappear simultaneously, so the check has
  to ask "does the channel still exist" as its own first-class signal, not
  just "does this one video still exist."

## 3. What's already shipped

Implemented in `recording-worker.service.ts` / `recording-s3.service.ts`
(migration `0041`):

- S3 upload (checksum-verified via SHA-256, single-PUT or resumable
  multipart) happens **before** YouTube upload, serially.
- `zuvy_sessions.s3link`/`youtube_video_id`/`final_uploaded` keep their
  existing meaning (YouTube URL) — new S3 pointers live in dedicated
  `recording_s3_bucket`/`recording_s3_key` columns so nothing downstream
  (`tracking.service.ts`, `student.service.ts`) breaks.
- The delete-before-verify race is fixed: the local merged file survives
  until `verifyYoutubeProcessing()` confirms YouTube's **async** processing
  actually succeeded (`processingStatus === 'succeeded'`), not just that the
  synchronous `videos.insert()` call was accepted.
- Zoom's cloud copy is only deleted after S3 verification, and only if
  `ZOOM_DELETE_AFTER_S3_ENABLED` is explicitly turned on (off by default).
- `auditS3Coverage()` runs hourly, flags any `COMPLETED` recording missing a
  verified S3 copy — closes the "silent backup failure" gap.

**Bug found and fixed during `zuvy-prod` connection testing (2026-09-18):**
`uploadMultipart()` in `recording-s3.service.ts` created the multipart upload
with `ChecksumAlgorithm: 'SHA256'`, which makes S3 require a per-part
`ChecksumSHA256` on every entry passed to `CompleteMultipartUploadCommand` —
but `UploadedPart` only tracked `{PartNumber, ETag}`, so completion always
failed with `InvalidRequest: ... missing for part 1`. This meant **every
recording large enough to need multipart upload (any merged file ≥ 100MB —
the common case) would fail its S3 leg every single time**, silently retried
via `markFailed()` and never actually succeeding. Confirmed live: failed
against `zuvy-prod` before the fix, passed a real 3-part multipart upload
after it. Fixed by capturing `ChecksumSHA256` from both `UploadPartCommand`'s
response and, for a resumed upload, `ListPartsCommand`'s per-part results —
a part missing its checksum is now treated as not-yet-usable and re-sent
rather than resumed.

**Second bug found and fixed the same way (2026-09-21):** once `S3_DUAL_UPLOAD_ENABLED`
was actually live against a real recording (session 2217 / job 2096), every job hit:

```
error: new row for relation "zuvy_session_recordings" violates check constraint "chk_recording_status"
```

`chk_recording_status` (`main.zuvy_session_recordings`) was defined before this feature
existed and only allowed the original state list; the S3 pipeline introduces three new
`status` values (`S3_UPLOADED`, `PROCESSING_YOUTUBE_UPLOAD`, `YOUTUBE_PROCESSING`) that
migration `0041` never added to it — migration `0041`/`0042` only ever ran
`ALTER TABLE ... ADD COLUMN`, never touched this constraint. **Every job would have hit
this the moment it reached the S3 leg**, regardless of anything else being configured
correctly. Fixed via migration `0043_fix_recording_status_check_constraint.sql`
(drop + recreate the constraint with the three values added — additive only, no data
touched). Confirmed via `SHOW search_path` that only the `main` schema copy of this table
is live for this app; `stage_template.zuvy_session_recordings` carries the same stale
constraint but is on a schema this app never queries, so it was left alone.
`zuvy_mentor_session_recordings` has no equivalent CHECK constraint at all, so mentor
recordings were never affected by this specific bug.

**Third and fourth bugs, same day:** migration `0043` above missed a fourth new status
value — `PROCESSING_S3_UPLOAD`, the transient state `pickJob()` sets while moving a
`MERGED` row forward — so the identical constraint violation recurred on the very next
test (session 2218 / job 2097), immediately after "Merge completed and verified."
Fixed via migration `0044_add_missing_processing_s3_upload_status.sql`. Separately,
`auditS3Coverage()` unconditionally selected both `session_id` and `mentor_booking_id`
from whichever table it was auditing, but those columns are mutually exclusive between
`zuvy_session_recordings` and `zuvy_mentor_session_recordings` — it failed every run
with `column "mentor_booking_id" does not exist`. Fixed by selecting only the owner
column that actually exists on each table.

**Fifth bug, same investigation — the one that actually explains the inconsistent
per-job behavior:** `RecordingWorkerService` and `RecordingWorkerTriggerService` were
listed directly in `AppModule`'s own `providers` array _in addition to_ being provided
and exported by `RecordingWorkerModule`, which `AppModule` also imports. NestJS doesn't
deduplicate a class across module boundaries just because one module already exports
it — redeclaring it in a second module's `providers` creates a second, independent
singleton instance. Since `RecordingWorkerService` has an `onModuleInit()` with real
side effects (subscribing to the trigger observable, and — as of this investigation —
logging startup config), this meant **two separate instances of the worker's polling
loop were running concurrently inside the same single process**, both hitting
`pickJob()`'s `FOR UPDATE SKIP LOCKED` query independently. This is a strong candidate
for why individual jobs behaved inconsistently even after every other fix landed and a
single clean process was confirmed running (confirmed via a literal duplicate
`Recording worker config: ...` log line at the identical timestamp). Fixed by removing
the redundant `providers` entries from `app.module.ts` — `RecordingWorkerModule`'s
export is now the only source of these two services.

**Sixth bug, and the most consequential for data quality — S3 verification wasn't
cleared on a re-merge (2026-09-21, session 2223 / job 2109):** `ingestRecordingCompleted()`
predates the S3 feature. Its three "reopen this job for new segments" branches (row
already `COMPLETED`, row `FAILED`/`PERMANENT_FAILED`, row still mid-pipeline) already
correctly clear the YouTube fields (`drive_file_id`/`drive_link` → `previous_drive_file_id`)
when a second Zoom recording instance arrives (e.g., the host's connection dropped and
the meeting was restarted) — but none of them cleared `s3_verified`/`s3_key`/etc.
Confirmed live: job 2109 uploaded segment 1 alone to S3 successfully
(`s3_verified = TRUE`), then segment 2 arrived and reopened the job for a combined
2-segment merge — but `s3_verified` stayed `TRUE` from the single-segment upload.
Once the (unrelated, see fifth-bug-adjacent ffmpeg issue below) merge eventually
succeeds, `uploadToS3()`'s idempotency guard (`if (job.s3_verified === true) return;`)
would see that stale flag and skip re-uploading — YouTube would get the correct,
complete video, but **the Glacier copy would permanently and silently contain only
the first, incomplete segment**, for exactly the sessions most likely to need a good
backup (the ones with a connectivity hiccup mid-class). Fixed by clearing all seven
S3-related columns in all three reopen branches. Job 2109's already-corrupted row was
manually corrected (S3 fields cleared, status reset from `PERMANENT_FAILED` back to
`METADATA_READY` for a fresh attempt) rather than left to silently misrepresent its
backup status.

**Root cause of the race behind the above, fixed at the source (2026-09-21):**
`uploadToS3()` previously started as soon as a row reached `MERGED`, with no check for
whether the underlying Zoom meeting might still be running or still processing on
Zoom's side — meaning a host reconnect mid-class could produce a "complete" first
segment, get it merged and uploaded to S3 (`s3_verified = TRUE`) before the second
segment even existed. `uploadToS3()` now calls the same `checkPreUploadEligibility()`
gate `uploadToYoutube()` already used (session end time + 5-minute buffer, meeting not
currently live, Zoom not still processing the cloud recording) before starting any
upload, deferring (`status = 'MERGED'`, retry via `next_retry_at` in 3 minutes, no
error/retry-count cost) if any of those aren't satisfied. This doesn't just delay the
S3 leg — it removes the reason a same-owner row would ever be mid-upload when a new
segment arrives in the first place. The field-clearing fix above remains as a safety
net for whatever narrow timing window still exists between "eligibility passed" and
"upload completed," not the primary defense anymore.

**Still open:** the third `ingestRecordingCompleted()` reopen branch (row still
mid-pipeline) still doesn't reset `status`, so if a new segment somehow does arrive
after `PROCESSING_S3_UPLOAD` has already started (the narrow window above), it's folded
into the manifest but doesn't force a fresh merge. Now a much rarer edge case than
before this fix, but not impossible — worth a deliberate decision later, not a silent
guess.

**Separately observed during this same investigation, not a code bug:** `spawnSync
ffmpeg ENOENT` on job 2109's concat attempt — the machine that picked up that job
(evidenced by its `merged_file_path` pointing at a different Windows user profile than
the one used for every other fix in this document) doesn't have `ffmpeg` on its `PATH`.
Worth deciding, now that multiple local machines can apparently pick up the same shared
job queue, whether that's intentional for this testing phase or whether only one
designated environment should run the worker until it's stable.

## 10. Edge-case audit: what happens when YouTube fails, at upload time or days later

Requested directly: verify (a) a job whose YouTube upload fails outright still leaves a
usable S3 copy for manual recovery, and (b) a video YouTube removes days/weeks after
`COMPLETED` gets detected and restored automatically. Both were audited against **real
failures already sitting in the database from this week's testing** — not synthetic
scenarios — which surfaced two more real bugs.

### 10.1 The architectural gap this closed

`checkYoutubeChannelHealth()` / `runYoutubeHealthCheckRotation()` (§5–§6) only ever
looked at rows already `status = 'COMPLETED'`. A row whose **first** YouTube upload
attempt exhausted all 5 retries (`PERMANENT_FAILED`) never had a `drive_file_id` to
compare against, so it was invisible to that detection — even though the S3 leg (which
always runs first) had very likely already succeeded. This was a real, not
hypothetical, gap: **`checkPermanentlyFailedUploads()`** is a new third detection phase
in the nightly job, added specifically for this case. It needs no YouTube API call at
all — `status = 'PERMANENT_FAILED' AND drive_file_id IS NULL AND s3_verified IS TRUE`
is already conclusive — and feeds into the _same_ `initiateRestoreForRow()` /
`pollAndCompleteRestores()` pair the other two detection phases use, rather than a
parallel implementation. `pollAndCompleteRestores()` now also sets `status = 'COMPLETED'`
on success (a no-op for the already-`COMPLETED` case it originally handled, necessary
for this new one).

### 10.2 Real failures found and fixed while auditing this

Querying for every row with a verified S3 copy surfaced six non-cleanly-completed rows.
Four told a clear, previously-unknown story:

- **Jobs 2110, 2111, 2117 — `last_error: "Insufficient Permission"`.** All three had
  already gotten a genuine, working YouTube video (`drive_file_id`/`drive_link` set).
  Root cause: `updateYoutubeTitleIfNeeded()` — called on every retry of an
  already-uploaded job to keep the YouTube title in sync — calls `videos.update`, which
  needs the broader `youtube`/`youtube.force-ssl` OAuth scope, not just
  `youtube.upload`. Uncaught, this **permanently failed jobs that had already fully
  succeeded**, purely over a cosmetic title sync. This is the same OAuth-scope class of
  issue the multi-instance-merge doc already flagged for the superseded-video-delete
  call — confirms that concern was real, just manifesting on a second call site. Fixed
  by wrapping the call in the same best-effort try/catch the delete call already uses.
  2110/2111 (still `FAILED`, not yet exhausted) will self-heal on their next scheduled
  retry once this ships; 2117 (already `PERMANENT_FAILED`) was manually reset to
  `YOUTUBE_PROCESSING` so `verifyYoutubeProcessing()` properly confirms its
  already-working video rather than assuming it's fine.
- **Job 2115 — `last_error: "Downloaded file too small (22792 bytes)"`, and a second,
  more serious finding: its `s3_verified = TRUE` was stale.** `segments_count = 3` but
  `is_final_merged = false` — this row had been reopened (a third recording instance
  arrived) but never successfully remerged the full set; its S3 flag still reflected an
  earlier, incomplete upload from before the reopen(s). Root cause of the download
  failure itself: `metadata_verified = TRUE` short-circuits `fetchZoomMetadata()` from
  ever refreshing Zoom's download URLs (see recording-merge-fix-architecture.md §2), and
  by the time this failure was investigated (>24h later) those URLs had almost
  certainly expired — explaining a corrupted/error-page-sized download on every retry.
  This is a second real instance of the same "stale `s3_verified` post-reopen" family
  as job 2109 (§ above) — the timing suggests it happened before that fix was deployed
  and the process restarted, not a gap in the fix itself, but there was no way to be
  sure of that without checking, so it's called out rather than assumed. Manually reset:
  `status = 'DISCOVERED'`, `metadata_verified = FALSE` (forces a genuine Zoom re-fetch),
  S3 fields cleared.

### 10.3 What this means for the two scenarios asked about

- **YouTube upload fails at upload time**: confirmed structurally guaranteed, not just
  hoped for — S3 always runs before YouTube (§1), so by the time `uploadToYoutube()` can
  fail at all, `s3_verified` is already `TRUE`. What was missing was the automated path
  from "permanently gave up on YouTube" back to a working video — that's
  §10.1's new phase. A job that permanently fails now self-heals the next night the
  health check runs (once `RECORDING_HEALTH_CHECK_ENABLED=true`), the same as a video
  YouTube deletes after the fact — no separate manual runbook needed for the common
  case, though `initiateRestoreForRow()`/`pollAndCompleteRestores()` remain safe to
  invoke directly for an urgent one-off.
- **YouTube removes/flags a video days later**: the existing §5–§6 mechanism already
  covered this structurally. **Now actually tested end to end against real infrastructure
  (2026-09-23)**, with explicit go-ahead: job 2098's real video was deleted via YouTube
  Studio, and the full recovery chain was run manually (mirroring
  `runYoutubeHealthCheckRotation()` → `initiateRestoreForRow()` → `pollAndCompleteRestores()`
  exactly) —

  1. `videos.list` on the deleted video's ID correctly returned zero items — the
     unambiguous "lost" signal §5.1 relies on.
  2. `RestoreObjectCommand` against the real `zuvy-prod` Glacier object succeeded
     (Expedited tier, ~2 minutes to complete — confirms the mechanics `computeRestoreTier()`
     depends on work as designed, independent of which tier is chosen).
  3. The restored file's SHA-256 checksum matched the originally-stored
     `s3_checksum_sha256` exactly — proof the Glacier copy was never silently corrupted.
  4. Re-upload to YouTube succeeded, producing a new working video.
  5. The DB update (`drive_file_id`, `drive_link`, `restore_status = 'AVAILABLE'`,
     `status = 'COMPLETED'`, plus `zuvy_sessions.youtube_video_id`/`s3link`/`final_uploaded`)
     landed correctly.

  **This test also surfaced the real reason the earlier "Insufficient Permission" bugs
  existed at all**: the YouTube OAuth refresh token had actually expired account-wide
  (affecting local, dev, and prod identically — confirmed via the shared dev database:
  no successful upload anywhere after 2026-09-21, two days before this was caught),
  consistent with the OAuth consent screen being in "Testing" publishing status
  (7-day token expiry). A fresh token was issued with the broader `youtube` scope
  (not `youtube.upload`), which fixes the delete/title-sync bugs from earlier
  permanently, not just the try/catch workarounds — confirmed live via a `videos.delete`
  call correctly returning `videoNotFound` (proving the permission check now passes)
  rather than `insufficientPermissions`. **Action item, not yet done**: the same token
  needs updating on the actual hosted dev and prod deployments — this fix only landed
  locally so far. If the consent screen stays in Testing mode, this will recur every
  7 days; worth a deliberate decision (publish the app vs. accept a recurring
  regeneration cadence) rather than rediscovering this the same way next time.

### 10.4 A third scenario, distinct from both above: YouTube rejects the content itself

Neither §10.1 (upload never succeeds) nor the video-later-deleted case is what happens
when YouTube's own async review actively **rejects** a video (`uploadStatus: 'rejected'`,
with a `rejectionReason` — copyright/policy/legal/etc.) — the upload call itself
succeeded, `drive_file_id` exists, but the _content_ was refused. This is meaningfully
different, and the original handling got it wrong in two ways at once, not just
"untested":

- **It fell through every safety net.** A rejected video never reaches `COMPLETED`
  (so `runYoutubeHealthCheckRotation()`, which only looks at `COMPLETED` rows, never
  sees it) and keeps its `drive_file_id` forever (so §10.1's `checkPermanentlyFailedUploads()`,
  which requires `drive_file_id IS NULL`, never sees it either). Nothing surfaced it —
  it would sit `PERMANENT_FAILED` indefinitely with no one aware.
- **The 5 retries it did burn through were pointless.** `verifyYoutubeProcessing()`
  previously threw a generic error for `rejected`, which fed into the same
  `markFailed()` retry cycle every other failure uses — re-fetching metadata,
  re-downloading, re-merging, all irrelevant to a content-based rejection, only to
  reach the identical rejection again (or a misleading `last_error` from whatever
  the last wasted retry attempt happened to hit).

**Fixed by treating this as its own terminal category** (migration
`0045_add_youtube_rejection_tracking.sql`, new `youtube_rejection_reason` column):
`verifyYoutubeProcessing()` no longer throws for `uploadStatus: 'rejected'` — it goes
straight to `PERMANENT_FAILED` with the reason captured, **never touching
`retry_count`**, and — since the S3 copy already exists — immediately kicks off a
Standard-tier Glacier restore so the durable copy is actually retrievable the moment a
human looks, rather than someone having to remember to request one after the fact.
Deliberately **does not** auto-re-upload to YouTube: identical content that was already
rejected would just be rejected again, matching §2's own "Act + escalate to a human,
never fully automate" guidance for exactly this category. Surfaced via the existing
hourly `auditS3Coverage()` job (already running independently of
`RECORDING_HEALTH_CHECK_ENABLED`), which now also reports any row carrying a
`youtube_rejection_reason`.

**Tested (2026-09-24)**, deliberately not against a real rejection — manufacturing one
for real means deliberately tripping Content ID or a policy violation on the real
channel, which isn't something to do just to test a code path. Instead: a synthetic row
was inserted in exactly the state a real rejection leaves behind (real, already-verified
S3 key reused read-only; fake Zoom/video IDs), the exact DB write the fix performs was
applied, and the **real** `RestoreObjectCommand` was issued against the real `zuvy-prod`
object — not mocked. Both detection queries were then run for real against the live
table: `auditS3Coverage()`'s new block correctly found the row; `checkPermanentlyFailedUploads()`
correctly excluded it (both because it retains a `drive_file_id` and because
`restore_status` is no longer `NULL`, the same condition set §10.1's phase also checks).
Confirms the fix's two claims hold: a rejection gets surfaced, and it does not get
auto-restored-and-reuploaded. Test row deleted afterward; the real S3 object was
untouched (a restore doesn't modify the archived object, and the temporary restored
copy expires on its own after the requested day count).

**Related bug found while fixing this, left as a known limitation, not fixed**: the
adjacent case — `processingStatus: 'failed'` (a technical transcode/codec failure,
plausibly transient, unlike a content rejection) — still goes through the generic
retry path, which turns out not to actually retry anything useful. Once a job reaches
`YOUTUBE_PROCESSING`, `uploadToYoutube()`'s idempotency check (`if (job.drive_link)`)
short-circuits past `verifyYoutubeProcessing()` on every subsequent pickJob cycle — so
a retry here restarts the whole metadata/download/merge pipeline for nothing and never
actually re-checks whether processing eventually succeeded. Real fix would keep status
at `YOUTUBE_PROCESSING` across a retry instead of routing through the generic
pipeline-restart path `markFailed()` forces today; deliberately out of scope for this
change since it's a broader retry-semantics decision, not a one-line fix.

This already satisfies the core principle end to end for the upload path.
Everything below is about (a) making the S3 copy cheaper to hold at scale,
and (b) closing the loop when YouTube later loses a video that was fine at
upload time.

## 4. Proposed: storage tier and key structure

### 4.1 Storage class

Move new uploads to **S3 Glacier Flexible Retrieval** instead of Standard.
Recordings are written once and essentially never read back unless YouTube
loses one — that's the textbook case for a cold tier. Flexible Retrieval
(not Instant, not Deep Archive) is the right default: cheap, and a 3–12 hour
restore window is acceptable because nothing in this pipeline needs
real-time recovery — see §6.3 for the one case where that default should
flex.

`StorageClass: 'GLACIER'` on both `PutObjectCommand` and
`CreateMultipartUploadCommand` in `RecordingS3Service`. No change needed to
`HeadObjectCommand` usage (existing audit job) — HEAD works on Glacier
objects without a restore; only `GetObject` (body retrieval) requires one.

### 4.2 Key structure

Recordings are organized to mirror the LMS hierarchy, by ID (not name —
names change):

```
bootcamps/{bootcampId}/modules/{moduleId}/chapters/{chapterId}/recordings/{sanitizedTitle} [{recordingId}].mp4
mentor-sessions/{organizationId}/{bookingId}/recordings/{sanitizedTitle} [{recordingId}].mp4
```

**Filename updated (2026-09-23)** to reuse `getYoutubeUploadTitle()` — the exact same
title the YouTube upload itself uses — so the S3/Glacier console reads as
`S38 - Recursion With Array - 20-09-2026 - Group 2 [2098].mp4` instead of a bare
`2098.mp4`. The `[{recordingId}]` suffix stays mandatory, not cosmetic: a session
title is free text (creators routinely include `/` via dates, plus quotes/colons/etc.)
and isn't guaranteed unique, so `sanitizeForS3FileName()` replaces filesystem-unsafe
characters and the numeric ID remains the actual collision-proof guarantee this key
structure depends on. This only affects new uploads going forward — existing objects
already in the bucket keep their original `{recordingId}.mp4` naming; nothing
retroactively renames them, and nothing needs to, since `s3_key` is always read from
the database row, never reconstructed from the naming convention.

(An earlier revision of this key structure nested these under top-level
`Course Recordings/` / `Mentors-Recordings/` prefixes to match folders
manually created in the `zuvy-prod` console. That's been reverted — the
code now writes the plain, unprefixed paths above. S3 has no real folders
regardless — a "folder" in the console is just a key prefix — so this is a
naming choice, not a structural one; if the two console folders from that
earlier attempt are still sitting in the bucket, they're empty and unused
and can be deleted.)

`zuvySessions.bootcampId`/`.moduleId`/`.chapterId` are `NOT NULL` — every
class-session recording always has a home in the hierarchy. Mentor
recordings have no bootcamp/module/chapter link at all
(`zuvyMentorSlotBooking` only ties to `organizationId`), so they get their
own namespace instead of being forced into a hierarchy that doesn't apply
to them. `recordingId` is the recording job's own row ID — already unique,
already used for idempotency, no new ID scheme needed.

This isn't just tidiness: a chapter ID is exactly what a restore request
starts from (`LMS → Chapter ID → Recording ID → Glacier → Restore →
YouTube`), so the key structure _is_ the restore lookup — no separate
index required.

## 5. Proposed: detection + restore, consolidated into one nightly job

Revised from an earlier draft that ran detection hourly and restore-polling
every 30 minutes. Neither cadence is justified once you take §2's own
conclusion seriously: nothing in the "act" category is minutes-sensitive —
even a genuinely lost video's urgency is governed by §6.3's cohort-activity
tiering, not by how many minutes ago it was detected. A sub-hour poll
interval was solving a latency problem this system doesn't have, at the cost
of real complexity (two separate interval loops, two failure paths to
reason about) and, before the quota picture below, an assumed API cost that
turned out not to be the actual constraint either.

**Single nightly job**, run once during a low-traffic window (e.g. 2 AM
IST — Zuvy's operative timezone, given `ap-south-1`/NavGurukul), doing all
of the following in sequence:

1. Rotating YouTube health-check sample (§5.1) — detect newly-lost videos.
2. Channel-level reachability check (§6.2).
3. Initiate Glacier restores for anything newly flagged lost (only if
   `s3_verified = TRUE`).
4. Check restore status for any row still `IN_PROGRESS` from a prior night.
5. Download + re-upload to YouTube anything that's now `AVAILABLE`.

One job, one failure surface, one place to look at logs. A restore that
takes 3–12 hours to become available and then waits for the _next_ night's
run to be picked up adds at most ~24h versus polling every 30 min — noise
against §6.3's tiering, which already treats "not urgent" as the default and
escalates deliberately, not by shaving hours off a background check.

**Scheduling mechanism**: use `@Cron('0 2 * * *', { timeZone: 'Asia/Kolkata' })`
from `@nestjs/schedule`, not the env-flag-gated `setInterval` pattern the
worker's continuous 5-second poll loop uses. Those are different shapes of
job — a tight continuous loop vs. a once-a-day batch — and `@Cron` is
already the established convention elsewhere in this codebase for the
latter (`mentor-slot.job.ts`, `notification.job.ts`,
`attendance-reconciliation.job.ts`). Matching the worker's `setInterval`
pattern here would only be consistent with the wrong precedent.

**Quota-aware, but generously so**: as of the current YouTube Data API v3
quota structure, `videos.list` costs ~1 unit against the shared 10,000/day
pool, and `videos.insert` draws from its own separate, much smaller daily
call cap rather than the shared pool — meaning a health check reading a few
thousand videos a night doesn't meaningfully compete with upload capacity
the way it would have under the older cost model (worth confirming against
Zuvy's actual granted quota in the Cloud Console before locking a number in,
since published unit costs change and per-project grants vary). Start the
rotating batch at a conservative size (e.g. `LIMIT 1000`) and tune up from
observed quota headroom rather than guessing a ceiling:

```sql
SELECT id, drive_file_id, s3_key, s3_verified
FROM {table}
WHERE status = 'COMPLETED' AND restore_status IS NULL
ORDER BY youtube_last_checked_at ASC NULLS FIRST
LIMIT 1000
```

New columns: `youtube_last_checked_at` (drives the rotation),
`restore_status`, `restore_requested_at`, `restore_expires_at`,
`youtube_lost_detected_at`.

### 5.1 What actually counts as "lost" (the filter that makes this efficient)

Per §2, only three signals justify action — everything else is
noise the health check should log and move past, never act on:

- `videos.list` returns no item for a known `drive_file_id` (deleted /
  channel terminated).
- `status.uploadStatus === 'rejected'`.
- The owning channel itself is unreachable (see §6.2) — checked
  independently of any single video.

A Content ID claim, a mute, a regional block, or a monetization claim is
**not** a restore trigger. Recording it (for the human-monitoring side of
incident response — see §8) is still useful, but automating a restore for it
would spend Glacier + quota to "fix" something that isn't actually broken.

## 6. Proposed: restore + re-upload

### 6.1 Base flow

For a row flagged lost in §5.1, and only if `s3_verified = TRUE` (nothing to
restore otherwise — log loudly, this needs a human, not automation):

1. `initiateRestore(key, tier, days)` → `restore_status = 'IN_PROGRESS'`.
2. Same nightly job, on a later night, checks `HeadObjectCommand`'s
   `Restore` header for any row still `IN_PROGRESS` (step 4 of §5's job
   sequence) — no separate interval or job.
3. Once available: download, `validateVideoFile()` (existing ffprobe check,
   reused as-is), re-upload to YouTube as a **new** video (the old
   `drive_file_id` is dead — this can't be a resumed upload), update
   `drive_file_id`/`drive_link` and (for session rows)
   `zuvy_sessions.youtube_video_id`/`s3link` to the new video — same columns
   the original upload writes, so nothing downstream needs to know this was
   a restore.
4. `restore_status = 'AVAILABLE'`; delete the re-downloaded local copy only
   after the new upload succeeds (same "clean up after success, never
   before" discipline as the main pipeline).

### 6.2 Channel-level check (the actual tail-risk mitigation)

Step 2 of the nightly job (§5) is a cheap, single-call check: does the
upload channel itself still exist and accept uploads? If not, every `COMPLETED`
row with a `drive_file_id` on that channel is flagged in one shot, rather
than being discovered one rotating-sample check at a time over the following
days. This is the direct fix for §2's finding that channel termination is
the real tail risk, not individual strikes — the per-video rotation alone
would eventually catch it, but far too slowly to be useful as an incident
signal.

**Complementary, non-engineering mitigation worth escalating alongside
this**: spreading uploads across multiple YouTube channels directly caps the
blast radius of a single termination and costs nothing to implement — it's
an upload-routing decision, not new infrastructure. Worth raising with
whoever owns the YouTube account strategy independent of anything else in
this doc.

### 6.3 Retrieval tier by cohort relevance (the actual "optimization")

A flat Glacier tier for every restore ignores something the key structure
in §4.2 makes essentially free to check: **is this recording's bootcamp
still active?** A chapter recording for a batch currently in progress
failing on YouTube is a live support issue — a student can't watch this
week's class. The same failure on a bootcamp that finished a year ago is not
urgent by any reasonable measure.

Recommendation: at restore time, look up the bootcamp's status/end date
(already joined once, in §4.2's key-building step, to get `bootcampId` in
the first place) and pick the retrieval tier accordingly:

| Bootcamp status                    | Retrieval tier                                           | Typical wait  |
| ---------------------------------- | -------------------------------------------------------- | ------------- |
| Active cohort currently enrolled   | Standard (or Expedited if available for the object size) | Minutes–hours |
| Completed within the last ~90 days | Standard                                                 | ~3–5 hours    |
| Older / archived                   | Bulk                                                     | ~5–12 hours   |

This turns a fixed cost decision (§4.1's flat Bulk-tier default) into one
that spends more only when there's an actual active student waiting on it —
the restore-urgency should follow demand, not be uniform by default.

## 7. Schema additions

```sql
ALTER TABLE zuvy_session_recordings
  ADD COLUMN IF NOT EXISTS restore_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS restore_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restore_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS youtube_lost_detected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS youtube_last_checked_at TIMESTAMPTZ;
-- identical block on zuvy_mentor_session_recordings
```

`restore_status`: `NULL` (never needed) → `'IN_PROGRESS'` → `'AVAILABLE'` |
`'FAILED'`. A `FAILED` row is not auto-retried — flipping it back to `NULL`
manually re-arms detection, since this is a rare recovery path, not a
steady-state one worth building its own backoff/retry machinery for.

## 8. Where engineering's job ends

Not everything in a policy-violation review is a code problem. Splitting
this explicitly avoids the common failure mode where an incident-response
doc gets treated as a backlog and half of it silently never happens because
nobody owns the non-engineering half:

| Owned by engineering (this doc)                                          | Owned by ops/legal/content, not automatable                                                                                                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| S3-first durable storage, checksum verification                          | Reviewing a copyright strike's validity before disputing/counter-notifying (a counter-notification is a formal legal declaration)               |
| YouTube upload + async processing verification                           | Monitoring YouTube Studio / account email for claim and strike notices the Data API doesn't fully surface                                       |
| Rotating health check + channel-level check                              | Instructor guidelines: avoiding copyrighted music/clips, minimizing unnecessary participant video, minor-consent handling                       |
| Restore-and-reupload automation, gated to genuinely destructive outcomes | Deciding whether recording/LMS consent language covers third-party (YouTube) hosting — a legal/consent-process question, not an engineering one |
| Alerting on quota/account/API issues                                     | Root-cause review after an incident (§8 of the source review) — a process, run by a human, informed by the alerts above                         |

Engineering's contribution to the non-automatable half is making sure the
alerts exist and reach the right owner — not doing the legal/content review
itself.

## 9. Summary of what changes vs. what's already true

- **Already true**: S3 is the durable copy, written and verified before
  YouTube, with checksum verification and a coverage audit. This doesn't
  change.
- **Changes**: storage tier (Standard → Glacier Flexible Retrieval), key
  structure (flat by job ID → hierarchical by bootcamp/module/chapter),
  and a new automated loop that only spends restore effort on the subset of
  YouTube failures that are actually destructive and actually fixable by
  re-uploading — ignoring the majority of policy events (claims, mutes,
  geo-blocks) that a restore wouldn't help with anyway.
- **Explicitly deferred to a human decision, not a default**: whether to
  keep a permanent Standard-tier copy after a restore (this doc restores
  just long enough to re-feed YouTube, then lets the object return to being
  Glacier-only — cheaper, and consistent with YouTube staying the playback
  layer), and whether/when to spread uploads across multiple channels.

## 11. A fourth category, found by manually checking Studio: Content ID claims/blocks are invisible to every automated check above

Discovered 2026-09-24 by manually browsing YouTube Studio's Content tab (filtered to
"Claims") — 5 real videos on the channel already carry Content ID claims, two fully
`Blocked`, others `Partially blocked` (regional). This is a genuinely different failure
category from everything in §2's table and everything built in §10: the video uploaded
fine, is not `rejected`, is not deleted — it's just unwatchable, wholly or in some
regions, because a claim was placed on it after the fact.

**Confirmed live, not assumed:** called `videos.list` for one of these five ("YT 1.0",
`kwZIc2v5m6k`) directly against the real Data API. The response:

```
status.uploadStatus: "processed"          <- looks completely normal
status.privacyStatus: "unlisted"          <- looks completely normal
contentDetails.regionRestriction.blocked: ["RU"]   <- the only visible hint anything is wrong
```

Nothing here would trip `runYoutubeHealthCheckRotation()` (checks only for a missing
video or `uploadStatus: 'rejected'`) or any other check in this pipeline. This isn't a
gap in what was built — **the public YouTube Data API does not expose Content ID claim
status to a normal (non-Partner) channel at all**, confirming what was found in earlier
research (a separate policy-violation review, not part of this codebase's docs) with a
real example instead of a general claim. `regionRestriction` happening to be visible
here is incidental — it doesn't say _why_ the region is blocked (Content ID vs. a
government order look identical this way), and a fully `Blocked` video (not merely
regional) likely wouldn't expose even this much.

**Per §2's own reasoning, this category was never meant to be auto-restored anyway** —
re-uploading the identical, fingerprint-matching file just gets re-claimed instantly.
The value of detecting it isn't automating a fix; it's making sure a human finds out at
all, rather than discovering it by chance browsing Studio (as happened here) with no
idea how long it had already been blocked.

### 11.1 The only viable automatable path: watch the channel's Gmail inbox

YouTube does send Content ID claim notifications by email to the channel-owning
Google account — the Gmail API's push-notification mechanism (`users.watch()` +
Cloud Pub/Sub) is the one real way to catch this without a human manually checking
Studio. Researched (not yet built) 2026-09-24:

**Mechanics**, confirmed against current docs:

- `users.watch()` requires a Cloud Pub/Sub topic the same GCP project owns, with
  `Pub/Sub Publisher` granted to Google's `gmail-api-push@system.gserviceaccount.com`
  — without that grant, `watch()` succeeds but nothing is ever delivered.
- The watch expires in **7 days, always** (Google explicitly recommends renewing
  daily, not waiting for the deadline) — needs its own cron, and failure is silent.
- The push payload is minimal (`{emailAddress, historyId}`) — a follow-up
  `history.list()` → `messages.get(format=metadata)` is required to actually read
  sender/subject and classify the email.
- **`gmail.metadata` is the correct scope** — enough to read headers, not body, and
  deliberately narrower than `gmail.readonly`. Can reuse the existing GCP project
  (already used for the YouTube API) without quota conflicts; a separate project is
  optional isolation, not required.
- Since this only ever watches one Google account the org itself owns (not
  third-party end users), the OAuth consent screen can stay in **Testing** mode —
  skipping Google's formal restricted-scope verification/security review that a
  published app normally triggers for `gmail.metadata`.
- Setup, concretely: one Pub/Sub topic, one subscription (push to Zuvy's existing
  backend endpoint, or pull — push needs a public HTTPS endpoint, which already
  exists), one daily renewal cron, application logic to classify by header, and a
  **fallback poll** independent of push — Google's own docs concede notifications
  "might be delayed or dropped," capped around 1/second per mailbox with excess
  coalesced, so push alone isn't a complete solution on its own.
- **The one real, unavoidable risk**: no Google documentation specifies the actual
  sender/subject/body format of a Content ID claim notification email — it must be
  reverse-engineered from real examples and treated as unstable; Google could reword
  it without notice and silently break the classifier. Mitigate by logging every
  candidate match's raw headers (not just alerting on ones that parse), so format
  drift is caught quickly rather than silently.

**Cost, researched against current pricing (2026-09-24) — bottom line: effectively
$0/month at this org's volume.**

- Gmail API itself has no per-call charge today; quota headroom (tens of millions of
  units/day) is enormously larger than a single mailbox's traffic could ever use.
  One real caveat: Google's own quota page states overage billing is "planned" to be
  introduced later in 2026 with 90 days' notice — not priced yet, worth re-checking
  before relying on this long-term, not a reason to avoid building it now.
- Cloud Pub/Sub's Always Free tier is 10 GiB of message throughput/month; at a few
  hundred emails/month (each a sub-1KB notification), this workload would need to be
  roughly 3–4 orders of magnitude larger to leave the free tier.
- A Google Cloud billing account with a payment method **must** be attached to use
  Pub/Sub at all, even at $0 actual charge — a real, mandatory setup step, not a cost.
- Routing the push straight to Zuvy's already-running backend (rather than a new
  Cloud Function/Run service) avoids introducing any separate serverless cost
  category entirely.

**Status (2026-10-05): code built** — `src/services/gmail-monitor/` (migration `0046`,
`GmailMonitorService`, `GmailMonitorController`), compiling clean, wired into `AppModule`'s
`imports` only (not `providers` — learned from §9's duplicate-instance bug). Runs in
audit-only mode as planned: every candidate email is logged to
`zuvy_youtube_violation_emails` for human review, nothing is auto-actioned. **Not yet
connected to real infrastructure** — `GMAIL_MONITOR_ENABLED="false"` everywhere until the
Google Cloud side (Pub/Sub topic, billing account, push subscription, a fresh OAuth token
scoped to `gmail.metadata`) is set up per
[gmail-content-id-monitoring-setup.md](gmail-content-id-monitoring-setup.md). Until that's
done this is inert code with zero effect on the running system.

## 12. Gmail detection wired into the restore pipeline as a fast trigger, not a video identifier

**Status (2026-10-23): implemented, partially verified.** Once the GCP side was connected
(§11) and tested live with real and synthetic emails (`team@zuvy.org`, then a dedicated
`poonam.youtube@navgurukul.org` test sender), the classifier and the 30-minute fallback poll
were both confirmed solid against real inbox traffic: correct positives (`copyright`,
`unclassified_youtube_sender`) and — just as important — zero false positives against real
noise (`mailer-daemon@googlemail.com` delivery-delay notices, marketing email, support
re-attempt requests, an unrelated Google Developers OAuth-verification email).

**One gap found during verification, not yet closed:** every logged email's `created_at` so
far lands exactly on a 30-minute poll boundary, often hours after the email's real
`received_at` — the signature of the fallback poll catching up a backlog, not of push
ever actually firing. This is expected, not a bug: the push subscription's audience is
`https://dev.api.zuvy.org/webhooks/gmail/notifications`, a public URL, while all testing so
far has run `GMAIL_MONITOR_ENABLED=true` only on a local machine Google can't reach. Push
delivery can't be confirmed working until this is deployed and enabled on an environment
that URL actually resolves to (confirm via that environment's logs, or the subscription's
delivery metrics in GCP Console → Pub/Sub → Subscriptions). Until then, every detection
in this pipeline — in production or local testing — comes from the fallback poll, which is
still a large win over the prior 24h cron cadence, just not the near-instant one push offers.

**Why the email is never used to identify a specific video.** `GmailMonitorService` only
ever reads the `From`/`Subject`/`Date` headers (`gmail.metadata` OAuth scope, deliberately —
see §11's cost/scope section) and never the message body, where a real notification's video
title or URL would actually live. Extracting a video reference from the body would need a
broader scope, fragile HTML-email scraping that breaks on any template change from Google,
and would still only produce a fuzzy text match back to our own catalog — a worse, more
fragile signal than what we already have for free.

**What was built instead:** the classified email is used purely as a **wake-up signal** for
the exact same deterministic, YouTube-API-truth-based check the nightly cron already runs
(`runYoutubeHealthCheckRotation()` in `recording-worker.service.ts`) — never as the thing
that decides whether a video gets restored. `GmailMonitorService.logCandidateMessage()` now
calls `YoutubeHealthCheckTriggerService.triggerNow(reason)`
(`src/services/recording-worker/youtube-health-check-trigger.service.ts`) whenever a message
gets a non-null classification; `RecordingWorkerService` subscribes to that trigger in
`onModuleInit()` (mirroring the existing `RecordingWorkerTriggerService` webhook-trigger
pattern already in this file) and runs the rotation check immediately instead of waiting up
to 24h. The trigger is debounced 5 minutes (vs. the webhook trigger's 3s) since each run
walks up to 1000 rows per table against the YouTube API — a burst of related notification
emails must collapse into one check, not one per email.

This design means a misclassified or spurious email can never cause a wrongful action: the
worst case is one extra, cheap, harmless health-check pass that finds nothing wrong. The
restore decision itself is unchanged — still gated solely on YouTube's own API response
(`uploadStatus === 'rejected'` or the video being missing entirely) for each known
`drive_file_id`, exactly as before.

**The 2 AM nightly cron (`runNightlyRecordingHealthCheck`) is unchanged and keeps running**
as the backup net for: the Gmail watch lapsing, both push and poll missing an email (Gmail's
history API has known gaps — see the draft-autosave bug in
[gmail-content-id-monitoring-setup.md](gmail-content-id-monitoring-setup.md)), a silent
removal that generates no notification email at all, or a classifier false negative.

**Closed (2026-10-27): full live verification, real recording, real deletion, real restore.**
A fresh class was created and recorded live, flowed automatically through the entire
pipeline with zero manual intervention (`DISCOVERED → PROCESSING_METADATA → DOWNLOADED →
MERGED → PROCESSING_S3_UPLOAD → PROCESSING_YOUTUBE_UPLOAD → YOUTUBE_PROCESSING →
COMPLETED`), confirming the S3-title-based key naming too (`.../recordings/<title>
[<job id>].mp4`). The resulting video was then deleted from YouTube for real. Since a
self-deletion by the channel owner generates no YouTube notification email (that only
happens for Content ID claims/strikes from YouTube or a rights holder — never for the
owner's own action), the Gmail path had nothing to detect here by design; a synthetic
trigger email was used purely as the same "check now" wake-up signal proven in every
earlier test — not as a claim about this video. That triggered the real, deterministic
health check, which made a real YouTube API call, found the video genuinely gone, found
its real verified S3 copy, and initiated a **real AWS Glacier Standard-tier restore** —
the first time in this whole testing pass that the actual restore-initiation code path
(as opposed to the "no S3 backup, needs manual attention" branch) executed for real.

One gap found during this: the restore-_completion_ step (`pollAndCompleteRestores` —
checks if an `IN_PROGRESS` Glacier restore has finished, and if so downloads, validates,
and re-uploads to YouTube) was only ever wired to the 2 AM nightly cron, not to the
immediate Gmail trigger — so detection+restore-initiation had become near-instant, but
the final re-upload would still have waited for the next nightly run regardless of how
fast the restore itself completed. Fixed: `pollAndCompleteRestores()` is now also called
from the same `youtubeHealthCheckTrigger.onTrigger()` subscription in
`RecordingWorkerService`, right after the rotation check, same debounced trigger, same
rationale. It's cheap to call even when nothing's ready (`getRestoreStatus()` is a
lightweight check, not a download, and it no-ops silently when the restore isn't done
yet) — verified live: re-triggered immediately after the fix, ran against the
`IN_PROGRESS` row with no errors, correctly found the Standard-tier restore not yet
available (requested minutes earlier; Standard tier takes 3–5h), and left it untouched
for the next trigger or the nightly cron to pick up once it actually completes.

**Still open:**

1. Confirm push actually fires once deployed somewhere the subscription's audience URL can
   reach — every detection in this doc's testing, including the live recording/restore
   test above, went through the 30-minute fallback poll, never a confirmed push delivery.
2. Decide on, and execute, which single environment gets `GMAIL_MONITOR_ENABLED=true`
   permanently (only one at a time — a shared watch/history-id row, racing renewals from two
   processes is wasteful even though idempotent inserts keep it non-destructive).
3. Confirm the re-upload actually completes once this restore finishes (3–5h out from
   2026-10-27 09:30 UTC) — either via the next Gmail-triggered check or the 2 AM cron.
