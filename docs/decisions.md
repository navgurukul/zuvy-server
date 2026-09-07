# Session Recording Storage — Architecture Decisions

Status: **Decided (pending implementation)**
Owner: Zuvy engineering team
Last updated: 2026-08-18
Input: `Session Recording Storage Architecture` proposal (2026-07-16, dual S3 + YouTube storage) — this
document resolves every open question that proposal raised, against the **actual current code**
(not assumptions), and is the authoritative record engineering should implement against. See the
companion [session-recording-s3-implementation-plan.md](session-recording-s3-implementation-plan.md)
for the phased build-out.

No code has been changed as part of producing this document.

---

## 1. Corrections to the source proposal

Before deciding anything, the proposal's factual claims were checked against the code. Most held
up; a few didn't, and they matter for the design below.

| Claim in proposal                                                               | Verdict                                             | Actual                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| State machine transitions in `pickJob()`                                        | Confirmed states, wrong lines                       | `pickJob()` is `recording-worker.service.ts:457-526`. Lines 241-309 are inside `ingestRecordingCompleted()` (added by the [multi-instance merge fix](recording-merge-fix-architecture.md))                                                                                         |
| `fetchZoomMetadata()` ~line 375                                                 | Wrong line                                          | `:595-843`                                                                                                                                                                                                                                                                         |
| `downloadRecording()`/`downloadRecordingToFile()` ~602-797                      | Wrong line, mechanism confirmed                     | `:852-931` / `:936-1069`. `.part` + `fs.renameSync` at `:982, :1050`; `.download.lock` at `:872-882`                                                                                                                                                                               |
| `validateVideoFile()` checks size/extension/codec/duration                      | Conflates 3 functions                               | `validateVideoFile()` (`:1074-1144`) only checks codec + duration (>5s) via ffprobe. Size/extension checks actually live in `downloadRecordingToFile` (`:1026-1047`) and `uploadToYoutube` (`:1623-1631`)                                                                          |
| `uploadToYoutube()` deletes local file after insert, no processing-status check | **Confirmed**                                       | `fs.unlinkSync` at `:1743-1749`, immediately after `videos.insert()` (`:1659`) resolves. This is real and is the highest-severity bug in the current pipeline                                                                                                                      |
| No active Zoom-side delete call                                                 | **Confirmed**, with a caveat                        | `deleteFromZoomCloud()` exists (`zoom.service.ts:1587`) but its only caller is commented-out dead code in `schedule.service.ts:354`                                                                                                                                                |
| `zuvy_sessions.s3link` holds YouTube data, not S3 data                          | **Confirmed**                                       | Written with the YouTube watch URL at `recording-worker.service.ts:1738`. Column is `drizzle/schema.ts:2264`; `youtube_video_id` is a separate column at `:2280` — the naming is pure historical leftover, not a bug in behavior                                                   |
| No "watched X%" tracking feature exists                                         | **Confirmed**                                       | Repo-wide search for watch-percentage/video-progress patterns returns nothing. `getChapterDetailsWithStatus` (`tracking.service.ts:1316-1596`) gates live-session chapter completion purely on `session.status === 'completed'` (`:1565`) AND `attendance === 'present'` (`:1567`) |
| ~$300/month per 100GB S3 figure                                                 | Not re-derivable from code (external pricing claim) | Left as "needs re-verification" per §4 below — not something the codebase can confirm either way                                                                                                                                                                                   |

One more finding the proposal didn't know to look for, and the single biggest change to the
recommended approach:

> **S3 is already integrated in this codebase.** `@aws-sdk/client-s3` and
> `@aws-sdk/s3-request-presigner` are existing dependencies (`package.json:38-39`), and S3 uploads
> already happen in production code — `content.service.ts:85-172` (curriculum PDFs, MCQ images) and
> `learner.resume.service.ts:10-1499` (resumes, including a `GetObjectCommand` read-back path).
> **This is not a new integration; it's extending one that already exists.**

That finding also surfaces a real constraint the proposal couldn't have known to flag: the existing
usage is single-object `PutObjectCommand` against **one shared bucket**, served back as **plain,
unsigned `https://{bucket}.s3.{region}.amazonaws.com/{key}` URLs** (`content.service.ts:156,172`;
`learner.resume.service.ts:1391`). No code path anywhere in `src/` calls `getSignedUrl` — the
presigner package is installed but has never actually been used. See §5.

---

## 2. Decisions

Each decision below directly answers one of the proposal's open questions (§7) or resolves an
ambiguity it flagged but didn't settle.

### 2.1 Build vs. extend

**Decision:** Extend the existing S3 integration; do not stand up new infrastructure or evaluate a
different provider.

**Why:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` are already dependencies, the SDK
client-construction pattern (`ConfigService` → `S3Client`) already exists in two services, and the
org already has _some_ AWS account/billing relationship for S3. Backblaze B2 / Cloudflare R2 (the
proposal's alternatives) would mean a second cloud vendor relationship, second credential set, and
second SDK, to save on a cost delta that hasn't even been confirmed (§2.6) — not worth it unless S3
pricing is later confirmed to be prohibitive.

### 2.2 One bucket or a new one

**Decision:** New, dedicated bucket for recordings (e.g. `zuvy-session-recordings-{env}`), not a new
prefix in the existing content bucket.

**Why:** Three independent reasons all point the same way:

1. **Cost isolation** (proposal §4) — a dedicated bucket makes Cost Explorer reporting clean without
   tag-based attribution on shared usage.
2. **Security posture mismatch.** The existing bucket serves plain public object URLs with no signed
   access anywhere in the code (§1). Recordings contain students' faces/voices and need private,
   signed access (§2.5) — that's a bucket-level access-policy difference, not just a prefix
   convention, and mixing the two postures in one bucket risks a policy misconfiguration leaking
   recordings.
3. **Blast radius.** A leaked credential scoped to a recordings-only bucket/prefix (§2.5) exposes far
   less than one scoped to the bucket that also holds curriculum content and resumes.

### 2.3 Schema changes

**Decision:** Add new columns; never repurpose `zuvy_sessions.s3link`.

- `zuvy_sessions`: add `s3_bucket` (text), `s3_key` (text) — do not touch `s3link` or
  `youtube_video_id`. `s3link` staying YouTube-shaped is confusing but not actively harmful (it's
  read as an opaque URL string in `tracking.service.ts:1382,1395-1410,1550`); renaming it is a
  separate, lower-priority cleanup (tracked in §7) that touches read paths and isn't a blocker for
  shipping S3.
- `zuvy_session_recordings` / `zuvy_mentor_session_recordings` (both, mirrored, same as every prior
  change to this pipeline): add `s3_key` (text), `s3_checksum` (text), `s3_uploaded_at` (timestamptz).

**Why not fold S3 progress into the `status` enum** (e.g. `S3_UPLOADED`, `S3_YOUTUBE_UPLOADED` as
new enum values, as the proposal's §3.1.4 suggested): the existing code already has a precedent for
per-destination progress living in its own nullable column rather than the status enum —
`previousDriveFileId` and `isFinalMerged` (`schema.ts:4599, 4611`) both track sub-state this way.
Doing the same for S3 (`s3_uploaded_at IS NOT NULL` = "S3 leg done") keeps the primary `status` enum
meaning "where the pipeline is in the download/merge/upload sequence" rather than exploding it into
a cross-product of `{pipeline stage} × {S3 done/not} × {YouTube done/not}`. This is also strictly
less migration risk: it follows the same additive, `ADD COLUMN IF NOT EXISTS` pattern the 0039
migration already established, instead of touching a `varchar` status column every existing row and
every `WHERE status = ...` query already depends on.

### 2.4 Serial vs. parallel upload

**Decision:** Serial — S3 first, then YouTube. This directly answers the proposal's §3.1.2 /
§7 open question.

**Why:**

- Recordings are not live content; they become available _after_ the class already ended. A few
  extra minutes of S3-then-YouTube serial upload time before a recording is playable is not a
  product-visible regression worth trading away implementation simplicity for.
- The worker is a single-job-at-a-time poller (`pickJob()` picks one row per pass,
  `:457-526`) — introducing two independently-racing async upload legs (parallel) means the retry
  state machine now has to reason about four combinations (`neither done`, `S3 only`, `YouTube only`,
  `both`) instead of two sequential checkpoints. Given §2.3's per-leg columns, serial makes the retry
  logic a simple "if `s3_uploaded_at` is null, do S3; else if YouTube leg incomplete, do YouTube" —
  no interleaving to reason about.
- S3-first matches the "S3 is the durable source of truth, YouTube is a derived playback copy"
  framing from the proposal's own intro. Uploading to YouTube before S3 is verified would mean a
  YouTube-only window exists even in the new design, which defeats half the point of adding S3.

Revisit only if real usage data shows time-to-playback-availability is a genuine complaint —
nothing about the parallel design is precluded later; the per-leg columns in §2.3 support both.

### 2.5 Security model

**Decision:**

- Bucket policy: **private**, no public access, blocking all public-read at the bucket level (not
  per-object ACL — the current `content.service.ts`/`learner.resume.service.ts` code path never
  passes an `ACL` param on `PutObjectCommand`, meaning today's public access is a bucket-policy
  setting; the recordings bucket must not inherit that policy).
- Access: short-expiry presigned `GetObjectCommand` URLs via `@aws-sdk/s3-request-presigner`. This
  will be the **first real usage** of that package — it's an existing dependency that has sat unused
  in this codebase.
- IAM: a credential set scoped to this bucket/prefix only (`PutObject`/`GetObject` on
  `recordings/*`), distinct from whatever credentials `ContentService`/`ResumeService` use today —
  do not reuse those, to keep blast radius contained per-purpose (this is also just consistent with
  the proposal's own §5 ask).
- "Internal Playback" and "Downloads" get **different** signed-URL policies (short-lived/chunked vs.
  longer-lived/one-shot) — see §2.7 on why Downloads is deferred entirely for v1.

### 2.6 Storage tier & cost

**Decision:** S3 Standard to start. Do not pre-commit to Intelligent-Tiering or a lifecycle rule in
v1.

**Why:** The proposal's own §4 reasoning is correct — since Internal Playback/AI/Downloads are
listed as near-term consumers (not just DR insurance), this is active-serving storage, and Glacier/
Deep Archive is the wrong tier regardless of cost. Between Standard and Intelligent-Tiering: without
real access-pattern data yet (this is the first month of the feature), Intelligent-Tiering's
monitoring fee has nothing to optimize against. Ship with Standard, revisit tiering/lifecycle rules
after 3–6 months of real volume and access data. Key the S3 object path so this is non-breaking
later: `recordings/{sessionId}/{contentHash}.mp4` needs no data migration to add a lifecycle rule on
top afterward.

The ~$300/month-per-100GB figure in the proposal remains **unconfirmed** — it doesn't match any
standard S3 tier and nothing in this codebase can verify or refute an external pricing claim. Do not
use it in a cost model until whoever quoted it identifies the actual service/tier/region it came
from. Also check AWS nonprofit credit eligibility (Activate/Imagine Grant) before finalizing a
budget ask — proposal §6, still open, not an engineering blocker.

### 2.7 Scope: what's in v1

**Decision:** v1 = durable S3 copy + integrity verification + gated Zoom deletion + YouTube kept as
the playback layer. **Not** in v1: "Downloads" as a distinct feature, "watched X%" progress
tracking, historical backfill.

**Why, per item:**

- **Downloads deferred** — distinct security posture (longer-lived, one-shot signed URLs handing out
  the raw file) from streaming playback; proposal's own §5 flags this as a separate posture. No
  product ask for it yet; ship playback + DR value first.
- **Watch-percentage tracking not built** — confirmed in §1 that no such feature exists today, and
  live-session chapter completion is attendance-gated, not recording-playback-gated
  (`tracking.service.ts:1565,1567`). This is a genuinely separate product decision (does "watched the
  recording afterward" need to count toward chapter completion at all?) that doesn't block choosing
  a storage backend either way. Worth noting for whoever owns that product question: if/when
  "Internal Playback" ships, that's the natural place to add real watch-percentage tracking, because
  it requires an actual `<video>` element with progress events — something an opaque YouTube
  `<iframe>` doesn't expose today, and S3-backed playback would.
- **Historical backfill is not attempted.** Confirmed no automatable, compliant path exists (YouTube
  Data API is metadata/upload-only; scraping violates ToS) — matches the proposal's own §5
  conclusion. This applies going forward only.

---

## 3. Fixing the current pipeline (independent of S3)

Two bugs exist today regardless of whether S3 ships, and should be fixed either as a preceding
change or bundled into the same PR that adds the S3 leg:

1. **Delete-before-verify race** (§1, confirmed) — `fs.unlinkSync` at
   `recording-worker.service.ts:1743-1749` fires on the _synchronous_ `videos.insert()` response, not
   on confirmed YouTube processing. Fix: poll `youtube.videos.list({part: ['status',
'processingDetails'], id: [videoId]})` until `processingDetails.processingStatus === 'succeeded'`
   and `status.uploadStatus === 'processed'` before treating the YouTube leg as done and before local
   cleanup. Once S3 exists as the durable copy (§2.4, S3-first), this stops being a data-loss risk and
   becomes a "did the video actually finish processing" correctness check instead — lower urgency
   post-S3, but still worth fixing.
2. **Migration file numbering collision** — the Explore verification found two files each numbered
   `0036_*` and two numbered `0039_*` in `drizzle/migrations/`. Not related to this decision, but
   worth a separate housekeeping fix before adding new numbered migrations for §2.3's columns, to
   avoid ambiguous apply-order.

---

## 4. Open questions still not resolved by this document

These need a human decision (product/ops/finance), not an engineering one:

- Does the org already have, or qualify for, AWS nonprofit credits? (§2.6)
- What retention policy applies to the historical recording library — keep forever, or
  archive-and-forget after a defined window? (Doesn't block v1 — §2.6's key structure supports adding
  this later without migration.)
- Should "Downloads" ever be built, and if so when? (§2.7 — deferred, not rejected.)
- Should recording-watch-percentage count toward chapter completion? (§2.7 — separate product
  decision, unblocked either way by the storage choice.)

---

## 5. Related documents

- [recording-merge-fix-architecture.md](recording-merge-fix-architecture.md) — the multi-instance
  merge fix this pipeline most recently went through; `ingested_meeting_uuids` /
  `previous_drive_file_id` are the precedent this document's schema decisions (§2.3) follow.
- [session-recording-s3-implementation-plan.md](session-recording-s3-implementation-plan.md) — the
  phased build-out plan for the decisions above.
- [youtube-policy-violations-and-mitigation.md](youtube-policy-violations-and-mitigation.md) — the
  research backing §1's "permanent data loss on takedown" finding, and the source of the audit-status
  and phone-verification action items under §2.5/§7 above.
