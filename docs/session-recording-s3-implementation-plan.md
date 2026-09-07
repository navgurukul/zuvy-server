# Session Recording S3 Storage — Implementation Plan

Companion to [decisions.md](decisions.md). This is a phased build-out plan, not a commitment to a
specific PR split — combine or split phases as convenient, but do them in this dependency order.
No code has been written yet; this is planning only.

---

## Phase 0 — Prerequisites (no product code)

- [ ] Provision a new, dedicated, **private** S3 bucket (`zuvy-session-recordings-{env}`), per
      [decisions.md §2.2](decisions.md#22-one-bucket-or-a-new-one). Block all public access at the
      bucket-policy level.
- [ ] Create an IAM credential set scoped to `PutObject`/`GetObject` on that bucket's `recordings/*`
      prefix only ([decisions.md §2.5](decisions.md#25-security-model)) — do not reuse the credentials
      `ContentService`/`ResumeService` use.
- [ ] Add new env vars for these (parallel to the existing `S3_BUCKET_NAME` /
      `S3_ACCESS_KEY_ID` / `S3_REGION` / `S3_SECRET_KEY_ACCESS` pattern used in
      `content.service.ts:93,114-121`) — e.g. `RECORDINGS_S3_BUCKET_NAME`,
      `RECORDINGS_S3_ACCESS_KEY_ID`, `RECORDINGS_S3_SECRET_KEY_ACCESS`, `RECORDINGS_S3_REGION`. Keep
      separate from the content bucket's vars — don't overload one name for two credential sets.
- [ ] Fix migration file numbering collision in `drizzle/migrations/` (duplicate `0036_*` and
      `0039_*` prefixes — see [decisions.md §3](decisions.md#3-fixing-the-current-pipeline-independent-of-s3))
      before adding a new numbered migration on top.

## Phase 1 — Schema

- [ ] New migration, additive only (matches the `0039` precedent — `ADD COLUMN IF NOT EXISTS`,
      zero data impact):
  - `zuvy_sessions`: `s3_bucket` (text), `s3_key` (text)
  - `zuvy_session_recordings`: `s3_key` (text), `s3_checksum` (text), `s3_uploaded_at` (timestamptz)
  - `zuvy_mentor_session_recordings`: same three columns, mirrored
- [ ] Update `drizzle/schema.ts` table definitions for all three tables to match.
- [ ] **Do not touch** `zuvy_sessions.s3link` or `youtube_video_id` in this migration — that's a
      separate, later cleanup (see Phase 5).

## Phase 2 — S3 upload leg in the worker

Target: `src/services/recording-worker/recording-worker.service.ts`, alongside the existing
`uploadToYoutube()` (`:1482-1777`).

- [ ] New method `uploadToS3()`, called **before** `uploadToYoutube()` in the job pipeline (serial,
      per [decisions.md §2.4](decisions.md#24-serial-vs-parallel-upload)):
  - Idempotency guard mirroring `uploadToYoutube()`'s existing `job.drive_link` check
    (`:1490`): skip if `job.s3_uploaded_at` is already set.
  - Key objects by session/job id + content hash, not timestamp — e.g.
    `recordings/{sessionId}/{contentHash}.mp4` — so retries can't create duplicate/orphaned objects
    (per [decisions.md §2.6](decisions.md#26-storage-tier--cost) key structure and the proposal's
    own idempotency concern).
  - Use `@aws-sdk/lib-storage`'s `Upload` helper (not raw `PutObjectCommand` as
    `content.service.ts`/`learner.resume.service.ts` do today) — those existing call sites only
    handle small files (PDFs, images, resumes) with single-part upload; recordings are large video
    files and need multipart upload with resume-on-interruption, which `Upload` provides and the
    existing code doesn't.
  - Request `ChecksumAlgorithm: 'SHA256'` on the upload and compare the returned checksum against a
    locally computed SHA256 of the merged file before marking the leg complete — **not** ETag
    comparison. ETag is an MD5 of the whole file only for single-part uploads; for multipart uploads
    (which large recordings will use) ETag is a hash-of-part-hashes and does not equal a simple
    whole-file hash, so it can't be used as an integrity check here.
  - On success: write `s3_bucket`, `s3_key`, `s3_checksum`, `s3_uploaded_at` on the job row, and
    `s3_bucket`/`s3_key` on `zuvy_sessions` (new columns — never `s3link`).
  - On failure: goes through the existing `markFailed()` retry path (`:1782-1838`,
    `MAX_RETRIES = 5`), same as any other pipeline step.
- [ ] Both the S3 leg and the existing YouTube leg must read from the **already-merged local file**
      (`mergedFilePath`) — do not re-fetch from Zoom for either destination, since Zoom's download URLs
      are time-limited and may have already expired by the time a retry runs.

## Phase 3 — Gate Zoom deletion on S3, not YouTube

- [ ] Wherever Zoom-side cleanup is (re-)implemented (currently dormant —
      `deleteFromZoomCloud()` in `zoom.service.ts:1587` is unreferenced except from commented-out code in
      `schedule.service.ts:354`), gate it on `s3_uploaded_at IS NOT NULL` + checksum match, not on the
      YouTube leg completing. This decouples "durable copy exists" from "playback copy exists," per
      [decisions.md §2.4](decisions.md#24-serial-vs-parallel-upload).
- [ ] This is new/resumed functionality, not currently active — confirm with whoever owns Zoom
      storage quota whether re-enabling active deletion is in scope for this change or a separate
      follow-up. The proposal's flowchart includes it; the current pipeline does not do it today.

## Phase 4 — Fix the delete-before-verify race

- [ ] In `uploadToYoutube()`, move the `fs.unlinkSync` cleanup (`:1743-1749`) to after confirming
      YouTube's asynchronous processing, not immediately after the synchronous `videos.insert()`
      response (`:1659`): poll `youtube.videos.list({part: ['status', 'processingDetails'], id:
[videoId]})` until `processingDetails.processingStatus === 'succeeded'` and `status.uploadStatus
=== 'processed'`, short-circuiting on `rejected`/`failed`.
- [ ] Lower urgency once Phase 2 ships (S3 is already the durable copy by this point), but still a
      correctness fix worth making — currently a takedown/processing-failure after the synchronous
      response leaves no recoverable copy for that upload attempt.

## Phase 5 — Read paths, exposed URLs, and signed access

- [ ] Add a presigned-URL helper (first real usage of `@aws-sdk/s3-request-presigner`, already a
      dependency but unused anywhere in `src/`) for serving recordings via short-expiry `GetObjectCommand`
      URLs, per [decisions.md §2.5](decisions.md#25-security-model). Scope: Internal Playback only —
      Downloads is explicitly out of scope for v1 ([decisions.md §2.7](decisions.md#27-scope-what-in-v1)).
- [ ] Where recordings are surfaced today — `tracking.service.ts:1382,1395-1410,1550` and
      `classes.service.ts:4869,5016` — decide whether to keep serving the YouTube URL as the default
      playback source (recommended for v1: no behavior change here) or add the S3-backed source as an
      additional/fallback field. Either way, **do not** repurpose `s3link` for this — it's already
      YouTube data (`recording-worker.service.ts:1738`) and read elsewhere as such.
- [ ] Separately, and lower priority: consider renaming `s3link` → something YouTube-shaped
      (`youtube_watch_url`?) once its current readers are inventoried, to stop the name actively lying
      about its contents. Not a blocker for anything above; tracked here so it isn't lost.

## Phase 6 — Monitoring

- [ ] Add a periodic audit job (independent of upload-time logging) that, for every `COMPLETED`
      recording row, does a `HeadObject` against S3 and compares the stored checksum. Alert on mismatch
      or missing object — this is the only way to catch a silent upload failure before someone actually
      needs the "backup" and finds out it isn't there.
- [ ] Extend the same audit job to also poll `videos.list(part=status)` for every `COMPLETED` row's
      `drive_file_id` (the YouTube leg) — flag any video that disappeared or whose `uploadStatus`/
      `privacyStatus` unexpectedly changed. This can't say _why_ (see
      [youtube-policy-violations-and-mitigation.md §6.2](youtube-policy-violations-and-mitigation.md#62-how-you-find-out-why--whats-automatable-vs-what-requires-a-human)),
      but it's a real, automatable tripwire independent of the S3 check.
- [ ] Consider a Gmail API `watch()`-based alerting channel (per
      [youtube-policy-violations-and-mitigation.md §10](youtube-policy-violations-and-mitigation.md#10-automated-notification-architecture--is-there-a-webhook-for-violations))
      for near-real-time notice of Content ID claims/copyright strikes/Community Guidelines
      strikes/privacy complaints against the uploading channel — this is a separate, lower-priority
      follow-up (not v1-blocking), since it requires empirically cataloguing YouTube's actual
      notification-email formats and maintaining a 7-day watch-renewal cron.

## Explicitly not in this plan

Per [decisions.md §2.7](decisions.md#27-scope-what-in-v1): "Downloads" as a distinct feature,
recording watch-percentage tracking, and historical backfill of pre-S3 recordings. None of these are
blocked by anything above — they're deliberately deferred, not designed around.

---

## Sign-off checklist (fill in before implementing)

- [ ] Bucket + IAM provisioned (Phase 0)
- [ ] Migration reviewed and numbering collision resolved (Phase 0/1)
- [ ] Serial S3-then-YouTube order confirmed acceptable by whoever owns time-to-playback-availability
      expectations (decisions.md §2.4)
- [ ] Zoom-deletion re-activation scope confirmed with whoever owns Zoom storage quota (Phase 3)
- [ ] AWS nonprofit credit eligibility checked before finalizing any cost pitch (decisions.md §2.6,
      §4)
- [ ] YouTube API project's audit status and phone-verification status confirmed (see
      [youtube-policy-violations-and-mitigation.md §5](youtube-policy-violations-and-mitigation.md#5-api-specific-and-account-level-risk--the-category-most-likely-to-be-silently-already-active))
