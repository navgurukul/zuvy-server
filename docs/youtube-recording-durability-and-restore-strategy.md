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
bootcamps/{bootcampId}/modules/{moduleId}/chapters/{chapterId}/recordings/{recordingId}.mp4
mentor-sessions/{organizationId}/{bookingId}/recordings/{recordingId}.mp4
```

`zuvySessions.bootcampId`/`.moduleId`/`.chapterId` are `NOT NULL` — every
class-session recording always has a home in the hierarchy. Mentor
recordings have no bootcamp/module/chapter link at all
(`zuvyMentorSlotBooking` only ties to `organizationId`), so they get their
own top-level namespace instead of being forced into a hierarchy that
doesn't apply to them. `recordingId` is the recording job's own row ID —
already unique, already used for idempotency, no new ID scheme needed.

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
