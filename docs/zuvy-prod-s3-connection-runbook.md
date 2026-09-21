# Connecting `zuvy-prod` — Setup Runbook (AWS side + Backend side)

Status: **In progress** — tracks the actual state of this environment as of 2026-09-09
Related: [youtube-recording-durability-and-restore-strategy.md](youtube-recording-durability-and-restore-strategy.md),
[decisions.md](decisions.md)

This is the full, ordered checklist to connect the `zuvy-prod` S3 bucket to the recording pipeline
and verify it end to end. Three things were checked live against this environment before writing
this — do these in order, since later steps assume earlier ones are done:

1. **IAM — not connected.** A live test call against `zuvy-prod` using this app's actual credentials
   (`ZuvyBucketUser`) failed on every operation with `AccessDenied` — this user has no policy
   granting access to `zuvy-prod` at all yet.
2. **Database — migrations not applied.** `0041_add_s3_recording_storage.sql` and
   `0042_add_youtube_health_and_restore_tracking.sql` add the columns the code writes to
   (`s3_bucket`, `s3_key`, `s3_verified`, `restore_status`, etc.) — none of them exist yet on the
   database this `.env` points at. **If you skip this and enable the upload flag anyway, every S3
   upload attempt fails immediately** on its first `UPDATE ... SET s3_bucket = ...` call (column
   doesn't exist).
3. **Backend config — partially done.** `S3_RECORDINGS_BUCKET_NAME="zuvy-prod"` has been added to
   `.env`. `S3_DUAL_UPLOAD_ENABLED` (the actual on/off switch) is still unset/off, deliberately —
   see Part C.

---

## Part A — AWS side

### A1. Bucket configuration (console → `zuvy-prod` → Permissions / Properties)

- [ ] **Block Public Access**: all four settings ON. Nothing in this pipeline ever needs a public
      URL — recordings are downloaded server-side during a restore, then re-uploaded to YouTube; they're
      never served directly to a browser.
- [ ] **Default encryption**: enable bucket-default SSE-S3 (AES-256) at minimum, under Properties →
      Default encryption. The app's code doesn't pass a `ServerSideEncryption` param on any upload call,
      so encryption only happens if the _bucket_ defaults it.
- [ ] **Versioning** (recommended, not required by the code): Properties → Bucket Versioning → Enable.
      Cheap protection against an accidental overwrite of the one durable copy you have.
- [ ] **Lifecycle rule**: Management → Create lifecycle rule → "Delete expired object delete markers
      or incomplete multipart uploads" → `AbortIncompleteMultipartUpload` after ~7 days. The pipeline's
      resumable multipart upload can otherwise leave orphaned, billed parts behind after a crash.
- [ ] Confirm the bucket's **region is `ap-south-1`** — must match `S3_REGION` in `.env` or every
      call fails with a region-redirect error.

### A2. IAM policy (console → IAM → Users → `ZuvyBucketUser` → Add permissions → Create inline policy → JSON)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ZuvyRecordingsS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts",
        "s3:GetObject",
        "s3:RestoreObject"
      ],
      "Resource": "arn:aws:s3:::zuvy-prod/*"
    }
  ]
}
```

- [ ] Attach this policy, name it something like `ZuvyRecordingsS3Access`, save.
- [ ] **Deliberately not included:** `s3:DeleteObject`, `s3:ListBucket`. The pipeline never deletes
      an S3 object and never lists the bucket — granting either would be unused, unnecessary blast
      radius.
- [ ] If you'd rather isolate this from the existing content/resume bucket permissions entirely
      (recommended longer-term, not required to get connected today): create a **separate** IAM user
      instead of extending `ZuvyBucketUser`, and see Part C's note on wiring separate credentials.

### A3. Confirm from the AWS side

- [ ] IAM → Users → `ZuvyBucketUser` → Permissions tab → confirm the new policy is listed and its
      JSON matches above.
- [ ] S3 → `zuvy-prod` → Permissions → Block Public Access → confirm all 4 are "On".

---

## Part B — Database side (found missing — do this before enabling anything)

- [ ] Apply both migrations directly against the target database (they're additive,
      `ADD COLUMN IF NOT EXISTS` — safe to run, zero data impact):
  ```bash
  psql "$DATABASE_CONNECTION_STRING" -f drizzle/migrations/0041_add_s3_recording_storage.sql
  psql "$DATABASE_CONNECTION_STRING" -f drizzle/migrations/0042_add_youtube_health_and_restore_tracking.sql
  ```
  (or via whatever connection method/host you normally use against this DB — same file, same `-f`
  flag either way.)
- [ ] Verify the columns actually landed:
  ```sql
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_name IN ('zuvy_session_recordings', 'zuvy_mentor_session_recordings', 'zuvy_sessions')
    AND column_name IN ('s3_bucket', 's3_key', 's3_verified', 'restore_status', 'recording_s3_bucket')
  ORDER BY table_name, column_name;
  -- expect: 5 rows on zuvy_session_recordings / zuvy_mentor_session_recordings each (well, the
  -- 4 s3_* + restore_status ones queried here), 2 rows on zuvy_sessions
  ```
- [ ] **Note found while checking this**: the database this `.env` currently points at is named
      `dev`, not a database literally called `prod` — worth confirming with whoever owns deploy config
      that this is intentional (e.g., testing the real `zuvy-prod` _bucket_ against a dev-tier backend
      first, before this config is used against the actual production database/deployment). Nothing
      about the bucket connection _requires_ the DB to be named any particular thing — this is just a
      naming-consistency sanity check, not a blocker.

---

## Part C — Backend side (`.env`)

Current state of the relevant vars:

| Var                                         | Current value                            | Needed for                                                                                  |
| ------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_KEY_ACCESS` | already set (shared with content/resume) | Used as-is by `RecordingS3Service` — no separate recordings credential exists in code today |
| `S3_REGION`                                 | `ap-south-1`                             | Already correct                                                                             |
| `S3_RECORDINGS_BUCKET_NAME`                 | `zuvy-prod` — **just added**             | Already correct                                                                             |
| `S3_DUAL_UPLOAD_ENABLED`                    | unset (off)                              | **The actual go-live switch** — see rollout order below                                     |
| `ZOOM_DELETE_AFTER_S3_ENABLED`              | unset (off)                              | Leave off until S3 upload is proven reliable — this deletes Zoom's copy                     |
| `RECORDING_HEALTH_CHECK_ENABLED`            | unset (off)                              | Nightly Glacier health-check/restore job — independent of the upload path, enable later     |
| `GLACIER_RESTORE_DAYS`                      | unset (defaults to `7` in code)          | Only matters once `RECORDING_HEALTH_CHECK_ENABLED=true`                                     |

### Recommended rollout order (don't flip all four at once)

1. **Now**: fix Part A (IAM) and Part B (migrations). Nothing enabled yet — zero behavior change.
2. **Verify connectivity** (see Part D) — confirms Part A actually worked, still zero production
   behavior change.
3. **Enable `S3_DUAL_UPLOAD_ENABLED=true` alone.** This is the real switch: every new recording
   from this point on gets uploaded to S3 (checksum-verified) before YouTube. Watch the _next_ real
   (or test) recording go through end-to-end (Part D) before touching anything else.
4. **Only after step 3 is confirmed working on at least one real job**, decide separately on:
   - `ZOOM_DELETE_AFTER_S3_ENABLED` — destructive against Zoom's copy; a one-way door per recording.
   - `RECORDING_HEALTH_CHECK_ENABLED` — the nightly Glacier restore job; safe to enable independently
     any time since it only ever acts on rows already `COMPLETED` with a verified S3 copy, but
     there's nothing for it to do until step 3 has produced some.

- [ ] **Rebuild and restart the actual running process** after any `.env` change — this codebase has
      a documented history of `.env` edits silently not taking effect because the deployed process
      wasn't rebuilt (see `recording-merge-fix-architecture.md` §6) — don't rely on a hot-reload dev
      server picking up new env vars for anything you're about to treat as verified.

---

## Part D — Verification sequence

### D1. Re-run the connectivity test (after Part A + B)

Re-run the same standalone diagnostic used earlier (`PutObject`/`HeadObject`/`GetObject` round trip
in `STANDARD`, plus a `GLACIER`-class `PutObject`/`HeadObject`, using the app's actual `.env`
credentials against `zuvy-prod`) — ask for it again once Part A is done; expect every step to report
`OK` this time instead of `AccessDenied`.

### D2. First real upload, end to end

Once `S3_DUAL_UPLOAD_ENABLED=true` and the process has been rebuilt/restarted:

1. Let one real class recording (or a manually-triggered test job, if you have a way to force one)
   run through the worker.
2. Confirm in the database:
   ```sql
   SELECT id, status, s3_bucket, s3_key, s3_checksum_sha256, s3_uploaded_at, s3_verified, drive_link
   FROM zuvy_session_recordings
   ORDER BY id DESC LIMIT 5;
   ```
   Expect: `s3_verified = TRUE`, `s3_bucket = 'zuvy-prod'`, `s3_key` starting with
   `bootcamps/...` (or `mentor-sessions/...` for a mentor
   booking), and `status` eventually reaching `COMPLETED` once the YouTube leg also finishes.
3. Confirm in the **S3 console**: the object actually appears under
   `bootcamps/{bootcampId}/modules/{moduleId}/chapters/{chapterId}/recordings/{id}.mp4`
   with **Storage class = Glacier Flexible Retrieval**.
4. Confirm YouTube still received the video as before (`drive_link` populated, plays back in the
   LMS) — this pipeline shouldn't change YouTube-side behavior at all, only add the S3 leg ahead of
   it.

### D3. Sign-off checklist

- [ ] Part A (bucket config + IAM policy) done and confirmed via a passing connectivity test.
- [ ] Part B (migrations) applied and columns confirmed present.
- [ ] `S3_DUAL_UPLOAD_ENABLED=true`, process rebuilt and restarted.
- [ ] At least one real recording confirmed `s3_verified = TRUE` with the object visible in the
      `zuvy-prod` console under the expected key.
- [ ] YouTube playback unaffected for that same recording.
- [ ] `ZOOM_DELETE_AFTER_S3_ENABLED` and `RECORDING_HEALTH_CHECK_ENABLED` decided on separately,
      not bundled into this same rollout step.
