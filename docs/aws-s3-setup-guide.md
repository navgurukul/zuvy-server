# Connecting AWS S3 to the Recording Pipeline — Beginner Setup Guide

Status: **Step-by-step, written for someone doing AWS setup for the first time**
Related: [zuvy-prod-s3-connection-runbook.md](zuvy-prod-s3-connection-runbook.md) (shorter, assumes
AWS familiarity), [youtube-recording-durability-and-restore-strategy.md](youtube-recording-durability-and-restore-strategy.md)

## What we're actually connecting, in plain language

Right now: a Zoom class recording gets downloaded, merged, and uploaded to YouTube so students can
watch it in the LMS. That's it — YouTube is the only copy.

The problem: YouTube can lose a video at any time (a copyright claim, a policy strike, an account
issue) — sometimes months or years after it was uploaded, with no warning. If that happens, the
recording is just gone, permanently, because nothing else has a copy of it.

The fix: **before** uploading to YouTube, the app now also uploads the same file to a private Amazon
S3 bucket (`zuvy-prod`) that only Zuvy controls. YouTube stays the thing students actually watch —
S3 is just an insurance copy, sitting quietly in the background, that we restore from if YouTube
ever loses a video.

This guide is the full checklist to make that connection actually work — the S3 bucket settings, the
"who's allowed to do what" permissions (IAM), the database changes, and the app's config file
(`.env`).

## Quick glossary (read once, refer back if a term is confusing)

- **S3 bucket** — a private "folder in the cloud" where files live. Ours is named `zuvy-prod`.
- **IAM** — Amazon's "who is allowed to do what" system. Before the app can save a file into the
  bucket, an IAM **user** (a named identity, ours is called `ZuvyBucketUser`) needs an IAM
  **policy** (a written list of permitted actions) attached to it.
- **Glacier** — a cheaper, slower storage class for files you almost never need to read back
  quickly. Our recordings are written once and normally never re-read (YouTube is what people
  actually watch), so Glacier is the right, much cheaper choice instead of paying for instant-access
  storage nobody uses day-to-day.
- **Migration** — a small script that adds new columns to the database. The app's code already
  expects these columns to exist; if they don't, saving a recording's S3 info will fail.
- **`.env` file** — the app's local settings file, where bucket names, on/off switches, and secret
  keys live.

---

## Part 1 — AWS S3 bucket settings

Open the AWS Console → **S3** → click into the `zuvy-prod` bucket. You'll see a row of tabs:
`Objects | Metadata | Properties | Permissions | Metrics | Management | File systems | Access Points`.

### 1a. Permissions tab

- Scroll to **"Block public access (bucket settings)"**.
- All four checkboxes should say **On**. Recordings must never be publicly reachable — nothing in
  this design ever needs a public link.
- If any say Off: click **Edit**, check all four boxes, save.
- Scroll further to **"Bucket policy"** — it should be empty (or if not empty, must not contain
  anything granting access to `"*"` / everyone). Leave it as-is if empty.
- Scroll to **"Access control list (ACL)"** — it should say **"This bucket has the bucket owner
  enforced setting applied"** with every grantee row showing `-` (no access). That's correct,
  nothing to change.

### 1b. Properties tab

- At the very top, find **"AWS Region"**. It must say **`ap-south-1` (Asia Pacific — Mumbai)`**.
  This has to match the app's settings later, so check this first.
- Scroll to **"Default encryption"** — should say **Enabled**, type **SSE-S3 (Amazon S3 managed
  keys)**. (Most new buckets have this on automatically — just confirm, don't assume.)
- Scroll to **"Bucket Versioning"** — this is usually **Off** by default and needs to be turned on
  manually. Click **Edit** → **Enable** → Save. This protects the one backup copy we have from ever
  being silently overwritten by accident.

### 1c. Management tab

- Click **Create lifecycle rule**.
- Name it something like `abort-incomplete-multipart-uploads`.
- Choose "Apply to all objects in the bucket".
- Under "Lifecycle rule actions," check **only**: _"Delete expired object delete markers or
  incomplete multipart uploads."_
- Set the number of days to **7**.
- Save.
- What this does, in plain terms: large recordings get uploaded in chunks ("multipart upload"). If
  the app crashes partway through, leftover chunks can sit in the bucket forever, quietly costing
  money. This rule auto-cleans anything abandoned for a week.

You do **not** need to set up any other lifecycle rule (like "move to Glacier after 30 days") —
recordings are written directly into Glacier from the very first upload, so there's nothing to
transition later.

---

## Part 2 — IAM (letting the app actually talk to the bucket)

This is a separate part of the AWS Console from S3 — go to **IAM** (search it in the top search
bar).

### 2a. Attach the policy the app needs

- **IAM → Users** (left sidebar) → click **`ZuvyBucketUser`**.
- Go to the **Permissions** tab → click **Add permissions** → **Create inline policy**.
- Click the **JSON** tab (top right of the editor) and replace the contents with:

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

- Click **Next** → name it `ZuvyRecordingsS3Access` → **Create policy**.
- In plain terms, this says: _"ZuvyBucketUser is allowed to upload files, upload files in chunks,
  read files back, and ask for a Glacier file to be restored — only inside the `zuvy-prod` bucket,
  nothing else."_ It deliberately does **not** allow deleting files or listing everything in the
  bucket — the app never needs to do either, so we don't grant it.

### 2b. If you get an error trying to do 2a

You might see an error like:

> _"User ... is not authorized to perform: iam:PutUserPolicy on resource: user ZuvyBucketUser"_

This means **your own AWS login** isn't allowed to manage `ZuvyBucketUser`'s permissions yet — it's
a different, extra permission you need first. Ask whoever manages your AWS account (an admin, or
whoever set up your login) to attach this policy **to your own user**, not to `ZuvyBucketUser`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageZuvyBucketUserPolicies",
      "Effect": "Allow",
      "Action": [
        "iam:PutUserPolicy",
        "iam:GetUserPolicy",
        "iam:ListUserPolicies",
        "iam:DeleteUserPolicy",
        "iam:ListAttachedUserPolicies",
        "iam:GetUser"
      ],
      "Resource": "arn:aws:iam::<your-account-id>:user/ZuvyBucketUser"
    }
  ]
}
```

This only lets you manage permissions for that one specific user (`ZuvyBucketUser`) — it doesn't
hand you broad control over the whole AWS account, so it's a safe, small thing to ask for. Once
it's granted, go back and repeat step 2a.

### 2c. Confirm it worked

- Back on `ZuvyBucketUser`'s **Permissions** tab, you should now see `ZuvyRecordingsS3Access` listed
  under "Permissions policies" (it should say `(1)` instead of `(0)`).

---

## Part 3 — Database changes

The app's code expects some new columns to exist in the database (to remember things like "which S3
file does this recording map to" and "has it been backed up yet"). These are added by two files
already sitting in the project:

```
drizzle/migrations/0041_add_s3_recording_storage.sql
drizzle/migrations/0042_add_youtube_health_and_restore_tracking.sql
```

### 3a. Apply them

Run each file directly against the database, using `psql` (a standard PostgreSQL command-line
tool) — from the project folder:

```bash
psql "<your database connection string>" -f drizzle/migrations/0041_add_s3_recording_storage.sql
psql "<your database connection string>" -f drizzle/migrations/0042_add_youtube_health_and_restore_tracking.sql
```

Both files are safe to run — they only _add_ new columns (they use `ADD COLUMN IF NOT EXISTS`),
they never delete or change anything that already exists, and no existing data is touched.

### 3b. Confirm it worked

Run this in the same database (via `psql`, or any DB tool you normally use) to check the new columns
actually exist:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name IN ('zuvy_session_recordings', 'zuvy_mentor_session_recordings', 'zuvy_sessions')
  AND column_name IN ('s3_bucket', 's3_key', 's3_verified', 'restore_status', 'recording_s3_bucket')
ORDER BY table_name, column_name;
```

If this returns rows for all three tables, the migration worked. If a table is missing from the
results, that migration file didn't get applied — re-run step 3a for it.

---

## Part 4 — Backend `.env` changes

Open the project's `.env` file. These are the settings that control the S3 backup feature:

| Setting                          | What to set it to                             | What it actually does                                                                                                                                                                                    |
| -------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `S3_RECORDINGS_BUCKET_NAME`      | `"zuvy-prod"`                                 | Tells the app which bucket to upload recordings into                                                                                                                                                     |
| `S3_REGION`                      | `"ap-south-1"`                                | Must match the bucket's actual region (Part 1b)                                                                                                                                                          |
| `S3_DUAL_UPLOAD_ENABLED`         | `"true"` (only once you're ready — see below) | **The main on/off switch.** While this is off/missing, nothing changes — recordings go to YouTube exactly as before, and the S3 step is skipped entirely.                                                |
| `ZOOM_DELETE_AFTER_S3_ENABLED`   | leave `"false"` / unset for now               | If turned on, the app deletes Zoom's own copy of the recording once it's safely confirmed on S3. Leave this off until you've watched the S3 upload work correctly a few times — it's a one-way action.   |
| `RECORDING_HEALTH_CHECK_ENABLED` | leave `"false"` / unset for now               | Turns on a once-a-night check that looks for recordings YouTube has lost, and restores them from the S3 backup automatically. Turn this on later, once there's actually something in S3 to restore from. |
| `GLACIER_RESTORE_DAYS`           | can leave unset (defaults to `7`)             | Only matters once the setting above is on — how many days a restored file stays temporarily available.                                                                                                   |

**Don't turn everything on at once.** Recommended order:

1. Finish Parts 1–3 first (bucket, IAM, database) — nothing behaves differently yet at this point.
2. Set `S3_RECORDINGS_BUCKET_NAME` and confirm `S3_REGION` (safe — still inert without step 3).
3. Only once you've confirmed the connection works (Part 5 below), set
   `S3_DUAL_UPLOAD_ENABLED="true"`. This is the moment real behavior changes — every new recording
   from now on gets backed up to S3 before going to YouTube.
4. **Restart the app after any `.env` change.** Just editing the file isn't enough — the running
   process needs to be stopped and started again (or rebuilt, depending on how it's deployed) to
   actually pick up the new settings.
5. Only after watching at least one real recording succeed, come back and decide separately about
   `ZOOM_DELETE_AFTER_S3_ENABLED` and `RECORDING_HEALTH_CHECK_ENABLED`.

---

## Part 5 — How to know it's actually working

### 5a. Basic connection test (before turning anything on for real)

Ask for a quick throwaway test script to be run — it tries uploading a tiny test file to
`zuvy-prod` using the exact same settings the real app uses, then reads it back and checks the
content matches, without touching any real recording. If every step says `OK`, the bucket and
permissions are correctly connected. If anything says `AccessDenied`, go back to Part 2.

### 5b. First real recording, end to end

Once `S3_DUAL_UPLOAD_ENABLED="true"` and the app has been restarted:

1. Let one real class recording finish and go through the normal process.
2. Check the database:
   ```sql
   SELECT id, status, s3_bucket, s3_key, s3_verified, drive_link
   FROM zuvy_session_recordings
   ORDER BY id DESC LIMIT 5;
   ```
   You want to see `s3_verified = TRUE` and `s3_bucket = 'zuvy-prod'` for the new recording.
3. Check the **S3 console** → `zuvy-prod` → you should see the actual file appear under
   `Course Recordings/bootcamps/.../recordings/....mp4` (or `Mentors-Recordings/...` for a mentor
   session), with **Storage class** showing as **Glacier Flexible Retrieval**.
4. Double-check the recording still plays normally in the LMS through YouTube — this feature should
   only _add_ the S3 backup step, never change how playback works.

### 5c. Final checklist

- [ ] Bucket: Block Public Access all On, ACL bucket-owner-enforced, region `ap-south-1`
- [ ] Bucket: default encryption on, versioning on, lifecycle rule for abandoned uploads created
- [ ] IAM: `ZuvyRecordingsS3Access` policy attached to `ZuvyBucketUser` and showing under its
      Permissions tab
- [ ] Database: both migrations applied, columns confirmed present
- [ ] `.env`: bucket name and region set, connection test passes
- [ ] `.env`: `S3_DUAL_UPLOAD_ENABLED="true"`, app restarted
- [ ] At least one real recording confirmed with `s3_verified = TRUE` and visible in the bucket
- [ ] YouTube playback still works normally for that same recording
- [ ] `ZOOM_DELETE_AFTER_S3_ENABLED` and `RECORDING_HEALTH_CHECK_ENABLED` — decided on separately,
      later, not as part of this same rollout
