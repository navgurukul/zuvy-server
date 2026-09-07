# YouTube Policy Violations & Takedown Risk — Research & Mitigation

Status: **Research complete, informs decisions.md**
Owner: Zuvy engineering team
Last updated: 2026-09-07
Related: [decisions.md](decisions.md) (the S3-as-durable-backup decision this document validates),
[session-recording-s3-implementation-plan.md](session-recording-s3-implementation-plan.md)

This document answers three questions raised while designing the recording storage architecture:
**(1) what actually causes YouTube to refuse an upload or take a video down later**, given that
Zuvy's recordings are uploaded Unlisted, unmonetized, and never intentionally made public; **(2)
when does that happen relative to upload time, and how do you find out the exact cause** —
especially what's diagnosable programmatically vs. what requires a human checking email/Studio
(§6); and **(3) is there any API or webhook that notifies Zuvy the moment a violation occurs**,
rather than someone finding out by checking manually (§10). Together this is the research backing
for [decisions.md §1](decisions.md#1-corrections-to-the-source-proposal)'s finding that "permanent
data loss on takedown" is a real, not theoretical, risk.

Research method: seven research passes (five run in parallel covering each risk category, plus two
sequential follow-ups on timing/diagnosability and notification mechanisms), backed by web searches
against primarily official Google/YouTube sources (support.google.com, developers.google.com,
transparencyreport.google.com) plus reputable secondary sources where official docs don't cover
implementation detail. Every claim below is sourced; dates are noted where they affect currency.
One claim (API audit gating, §5) was additionally cross-checked against Zuvy's actual upload code,
not just external sources.

---

## The one thing to unlearn: "Unlisted" is not a safety setting

Every research thread converged on the same finding, confirmed against official YouTube
documentation each time: **Unlisted controls discoverability only — whether a video is indexed,
searchable, or recommended. It does not exempt a video from any enforcement system.**

- Content ID scans every upload "as soon as a user attempts to publish a video," regardless of
  visibility.
- YouTube's Community Guidelines state explicitly they "apply to all types of content on our
  platform, including, for example, unlisted and private content."
- A privacy complaint's only test is whether a person is "uniquely identifiable" — visibility
  setting isn't a factor.
- Anyone holding an unlisted link can report it for human review, and it can be re-shared beyond
  its intended audience (an LMS student forwarding a link, a leaked session, a scraped page).

Treat every unlisted upload as if it were public for policy-risk purposes. The only thing Unlisted
actually buys Zuvy is not showing up in search/recommendations and not being crawlable — nothing
about takedown, strike, or termination exposure changes.

---

## 1. Copyright — Content ID and manual strikes

This is the highest-_probability_ risk category for recorded live classes, because Content ID
fingerprints both audio and video automatically on every upload.

**Content ID (automated):**

- Runs on every video regardless of privacy setting; matches against a database of files rights
  holders have registered.
- A match applies a geography-specific policy: **block** (worldwide or specific countries), **mute
  audio**, **monetize** (claimant runs ads even on a channel that doesn't monetize), or **track**
  only. The same video can be blocked in one country and fine in another.
- What commonly triggers it in a recorded class: background music during a break, a video/audio
  clip played during screen-share, a student's ambient audio (music playing in their room, picked
  up by their mic), copyrighted images/clips embedded in slides. Even a few seconds is often
  enough — there's no official minimum-duration exemption.
- Disputing a claim gives the claimant up to 30 days to respond; escalating to an appeal gives them
  7 days.
  ([support.google.com/youtube/answer/2797370](https://support.google.com/youtube/answer/2797370),
  [answer/6013276](https://support.google.com/youtube/answer/6013276),
  [answer/2797454](https://support.google.com/youtube/answer/2797454))

**Manual copyright strikes (the catastrophic one):**

- A rights holder's legal takedown notice, if upheld, issues a **copyright strike** — distinct from
  a Content ID claim and far more serious.
- **Three strikes within 90 days terminates the entire channel.** YouTube's own policy is explicit
  that termination is not selective: it makes **all content on the channel inaccessible**,
  including videos completely unrelated to the strikes, and bars the user from creating a
  replacement channel.
- A DMCA-style counter-notification gives the claimant 10 business days to show they've filed suit;
  if they don't, the video is reinstated and the strike removed. **This is a real legal document
  filed under penalty of perjury** — filing one when the underlying claim is actually valid creates
  real litigation exposure. Don't treat it as a routine support-ticket response.
- Strikes expire after 90 days if Copyright School is completed and fewer than 3 strikes are active.
  ([answer/2814000](https://support.google.com/youtube/answer/2814000),
  [answer/2802168](https://support.google.com/youtube/answer/2802168),
  [answer/2807684](https://support.google.com/youtube/answer/2807684))

**"It's educational, so fair use protects us" — confirmed false as an automatic defense.**
YouTube's own fair-use page states plainly that "automated systems like Content ID can't decide
fair use because it's a subjective, case-by-case decision that only courts can make," and that
labeling content "educational" or "non-profit" is _a factor_, not an automatic exemption. A strong
fair-use argument only helps once you're already disputing a claim or strike — it does not prevent
one from being issued.
([answer/9783148](https://support.google.com/youtube/answer/9783148))

**Territorial licensing blocks** are a separate, quieter failure mode: a rights holder can license
music/content for only some countries, so a video plays fine in most of the world and is silently
blocked in specific ones — this is the mechanism behind the proposal's "regional restrictions"
problem, distinct from any policy violation at all.

---

## 2. Community Guidelines (non-copyright)

A fully separate strike system from copyright, confirmed by YouTube's own FAQ: _"We have 2 systems
because we see Community Guidelines strikes and Copyright strikes as separate issues."_ Either one
can independently terminate a channel.

**Escalation ladder:** warning (expires in 90 days with policy training) → Strike 1 (1-week posting
freeze) → Strike 2 within the same 90-day window (2-week freeze) → Strike 3 within 90 days →
**channel termination**. Severe single violations (e.g., CSAM-adjacent content) skip straight to
termination with no warning tier and no appeal.
([answer/2802032](https://support.google.com/youtube/answer/2802032),
[answer/9235777](https://support.google.com/youtube/answer/9235777))

**What's realistically at risk in a recorded live class** (ranked by actual likelihood for
professional/adult bootcamp content, not by how scary the policy sounds):

| Policy                              | Realistic trigger in a recorded class                                                                                                                                  | Likelihood                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Spam / reused & repetitious content | Bulk-uploading many structurally similar recordings in a short window; YouTube's spam classifier looks at upload cadence (3+/day for 30 days) and thumbnail similarity | Low but non-zero — worth pacing uploads      |
| Harassment / hate speech            | A heated exchange or inappropriate remark caught on a hot mic                                                                                                          | Low, incident-driven                         |
| Nudity / sexual content             | Screen-share accidentally exposing something, or camera framing                                                                                                        | Low, incident-driven                         |
| Child safety (see below)            | A minor student is on camera                                                                                                                                           | Not itself a violation, but see next section |

**Child safety is a distinct exposure worth calling out on its own.** "Made for Kids" (MFK)
designation is about whether content is _directed at_ children as its primary audience — a
professional bootcamp for working-age adults almost certainly does not require it, regardless of
one minor being enrolled. **But** YouTube's Child Safety Policy imposes automatic restrictions
(comments and live chat disabled, no recommendations, no signed-out views) on _any_ video
"featuring minors," independent of MFK status. And mislabeling matters legally, not just
platform-wise: **Disney paid a $10M FTC settlement in September 2025** specifically for
mislabeling child-directed YouTube content — this is FTC/COPPA legal exposure, separate from and in
addition to whatever YouTube itself does.
([answer/9528076](https://support.google.com/youtube/answer/9528076),
[answer/2801999](https://support.google.com/youtube/answer/2801999),
[FTC press release, Sept 2025](https://www.ftc.gov/news-events/news/press-releases/2025/09/disney-pay-10-million-settle-ftc-allegations-company-enabled-unlawful-collection-childrens-personal))

**Detection on unlisted content specifically happens two ways**, both independent of discoverability:
automated classifiers scan on upload (audio/video/hash analysis, the same pipeline public videos go
through), and anyone holding the link can use YouTube's report tool to trigger human review. For an
LMS, the realistic trigger path is link exposure (a student sharing/forwarding it, a leaked
credential) rather than the classifier flagging ordinary lecture footage.

**Appeals:** strikes/warnings can be appealed within 6 months of issuance; content removals within
1 year; each strike only once.
([answer/185111](https://support.google.com/youtube/answer/185111))

---

## 3. Privacy complaints — the risk category specific to recording _people_, not content

This is the category most directly created by Zuvy's specific use case (recording students, not
just uploading generic content) and the one the original architecture proposal didn't fully surface.

- Any person who is "uniquely identifiable" (face, voice, name) in a video can file a **Privacy
  Complaint**, even if they didn't upload it — and this applies **identically regardless of
  visibility setting**. The uploader doesn't need to be notified first, though YouTube suggests
  trying direct contact.
- If validated, the uploader gets a **48-hour window** to use YouTube Studio's Trim/Blur tools to
  remove the offending portion before any takedown proceeds — meaning a well-run pipeline that
  monitors for complaints can often resolve this without losing the video entirely.
  ([answer/2801895](https://support.google.com/youtube/answer/2801895))
- **Minors get an explicit, distinct consent expectation.** YouTube's guidance on content featuring
  children calls for parental/guardian consent before featuring a minor and recommends blurring
  minors who appear incidentally "especially if they are easy to recognize" — a guardian can file
  a complaint on a child's behalf under the same identifiability standard.
  ([answer/9229229](https://support.google.com/youtube/answer/9229229))
- **GDPR-style requests can target the hosted video itself**, not just search delisting — an
  EU-based student could in principle invoke this. In practice the remedy tends to be an
  **EEA-only geo-block** rather than global deletion, unless a separate privacy-complaint or
  Community Guidelines basis applies.
- **Scale check:** Google's own Transparency Report data (via Statista aggregation) shows roughly
  4,555 total privacy/security removal requests across all of Google from 2020–H1 2024, versus
  copyright claims running in the tens of millions annually — privacy complaints are a real but
  comparatively low-frequency risk _per video_. It becomes a meaningful risk only at Zuvy's actual
  scale (many recordings × many non-consenting appearances compounding over time), not a one-off
  concern.

**The practical takeaway:** "we made it unlisted" is not a defensible privacy position on its own.
Explicit recording consent as part of enrollment (already presumably in place for the LMS/Zoom
recording itself) does not automatically extend to "and therefore uploading identifiable footage to
a third-party platform (YouTube) is fine" — those are different consents in a strict reading of
YouTube's own guidance, even if low-risk in practice for a professional bootcamp audience.

---

## 4. Government/legal region-specific removals

Distinct from both Content ID and Community Guidelines: when content violates a specific _country's
law_ (not YouTube's own policy), Google's Transparency Report process removes or restricts it "only
in the country/region where it is deemed to be illegal" — the video stays up everywhere else. This
is a government-to-platform legal mechanism, unrelated to territorial _copyright_ licensing (§1) even
though the visible symptom (regional unavailability) looks identical from the LMS's side.
([Government removals FAQ](https://support.google.com/transparencyreport/answer/7347744)) This is
low-relevance for Zuvy's day-to-day risk (recordings aren't the kind of content governments
typically target) but explains why "the video plays everywhere except country X" can have two
completely different root causes that require different responses.

---

## 5. API-specific and account-level risk — the category most likely to be silently already active

This category is different from the others: it's not about content triggering a policy, it's about
**how the video gets uploaded in the first place**, and it directly concerns Zuvy's actual pipeline
(`recording-worker.service.ts`), not hypothetical future content.

**Forced-private on unaudited API projects.** Since **July 28, 2020**, any YouTube Data API project
that hasn't completed Google's "Audit and Quota Extension" compliance review has its uploads
**automatically forced to Private**, regardless of what `privacyStatus` the request specifies. This
is not a quota-volume issue — a low-traffic project well under the daily quota still gets forced
private; only a passed audit unlocks non-private visibility.
([Revision History](https://developers.google.com/youtube/v3/revision_history),
[Quota and Compliance Audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits))

**Verified against Zuvy's actual code:** `recording-worker.service.ts:1667` explicitly requests
`status: { privacyStatus: 'unlisted' }` on every upload. Since the existing pipeline is described
(in the original storage-architecture proposal) as already successfully producing playable unlisted
videos for LMS use in production, Zuvy's API project has most likely already cleared this audit, or
predates the July 2020 cutoff — **but this should be explicitly confirmed** (Google Cloud Console →
YouTube Data API project → audit status), not assumed, because:

- If the project's audit status were ever to lapse, be reset (e.g., a new project ID after a
  credential rotation), or simply never actually passed and instead is quietly grandfathered on old
  behavior, uploads would silently start coming back Private instead of Unlisted with no obvious
  error — the API call succeeds either way.
- **Private videos have a hard cap of 50 invited Google accounts.** This is very likely the real
  mechanism behind the proposal's "YouTube ever caps unlisted videos" worry (§1's open question) —
  the cap is real, but it applies to **Private**, not Unlisted, videos. If a forced-private failure
  mode were ever silently triggered, any cohort larger than 50 students would immediately lose
  playback access with no obvious cause.

**Phone verification and the 15-minute cap.** Unverified YouTube accounts are capped at 15-minute
video length; phone-verified accounts can upload up to 12 hours / 256GB. This is an account-level
setting, not something the API can override — Zoom class recordings routinely exceed 15 minutes, so
**this should already be confirmed as verified** for whatever account/channel owns the uploads; if
it somehow weren't, every class recording over 15 minutes would already be failing to upload, which
would presumably have already been noticed.
([answer/71673](https://support.google.com/youtube/answer/71673))

**Quota mechanics.** Default allocation is 10,000 units/day with dedicated 100-call/day buckets for
`videos.insert` and `search.list`; a Google policy change around December 2025 reduced the
per-upload cost, so older documentation citing "1,600 units per upload" is now stale — current cost
is effectively low within its own bucket. Once a bucket is exhausted, further calls fail with
`quotaExceeded` (403) until the daily reset at midnight Pacific — there's no graceful degradation,
just hard failure until reset or a quota-increase audit.
([Determine Quota Cost](https://developers.google.com/youtube/v3/determine_quota_cost))

**Compliance audit consequences.** A project found non-compliant during a periodic audit risks
quota reduction, API key revocation, or account-level termination of API access. Real-world
developer reports describe multi-week silence during review/remediation — this is an operational
risk (an upload pipeline going dark for weeks pending review), separate from content-policy risk.
([Developer Policies](https://developers.google.com/youtube/terms/developer-policies))

**Known reliability quirk, independent of policy:** multiple `googleapis` client-library issues
document API uploads reporting success at the `videos.insert` call while the video itself gets stuck
in YouTube's processing pipeline, sometimes resolving only on retry. This is exactly what
[decisions.md's Phase 4](session-recording-s3-implementation-plan.md#phase-4--fix-the-delete-before-verify-race)
recommendation (poll processing status before treating the upload as complete) already exists to
catch — this research corroborates that fix independently.

---

## 6. Timing — when does this actually happen, and how do you find out why

Two separate questions, and the answers are asymmetric: **when** something can happen has almost no
upper bound, but **whether you're told why** depends entirely on which mechanism triggered it.

### 6.1 When

| Mechanism                                              | Timing                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Processing rejection (`failed`/`rejected` upload)      | Near-immediate — seconds to low minutes for SD, up to a few hours for 1080p/4K under normal load. YouTube itself acknowledged multi-hour/24+ hour processing stalls under platform-wide load as recently as January 2026, so "usually fast" is a norm, not a guarantee.                                                                                                                                                                                                |
| Content ID automated claim                             | Scanning starts essentially immediately (in parallel with transcoding, often before processing even finishes) — but a claim actually **appearing** can take anywhere from minutes to roughly two weeks in practice, and publication is not gated on the scan completing.                                                                                                                                                                                               |
| Content ID claim on an **old, previously-clean** video | **No upper bound — this is real, documented, ordinary behavior, not an edge case.** When a rights holder registers a _new_ reference file into Content ID, YouTube runs a "legacy scan" against its existing catalog (prioritizing recent/popular videos) and generates fresh claims against old uploads that were clean when posted. A recording that has been sitting fine for a year can get claimed the day someone else registers matching reference audio/video. |
| Manual copyright takedown / strike                     | No documented filing deadline anywhere in Google's copyright process or the DMCA itself — entirely at the rights holder's discretion, whenever they discover the content. Can happen years after upload.                                                                                                                                                                                                                                                               |
| Community Guidelines strike/removal                    | Reactive, not swept on a schedule — triggered by a report or by automated detection at/near upload. No documented periodic re-review of already-published old content independent of a new report. In practice this still means indefinite exposure: nothing protects a video just because it's been up a long time without incident.                                                                                                                                  |
| Privacy complaint                                      | Inherently discovery-driven — can occur the day of upload or years later, whenever the identifiable person becomes aware of the video.                                                                                                                                                                                                                                                                                                                                 |

**The practical implication:** there is no "safe after N days" threshold for anything except pure
upload-processing failures. A recording that uploaded cleanly and has played fine for months is not
meaningfully safer than one uploaded yesterday, with respect to Content ID re-matching, copyright
strikes, Community Guidelines reports, or privacy complaints — all four can land at any point in the
video's lifetime. This reinforces why a durable, independent copy ([decisions.md](decisions.md))
can't be treated as a one-time migration concern; the exposure is ongoing for as long as the video
lives on YouTube at all.

### 6.2 How you find out why — what's automatable vs. what requires a human

This is the more actionable half, because it splits cleanly into "the API tells you" and "only email/
Studio tells you," and the split doesn't go where you'd hope.

**Fully automatable via the YouTube Data API** — `videos.list` with `part=status` returns, verbatim
per the current official API reference:

- `uploadStatus`: `deleted`, `failed`, `processed`, `rejected`, `uploaded`
- `failureReason` (set only when `uploadStatus = failed`): `codec`, `conversion`, `emptyFile`,
  `invalidFile`, `tooSmall`, `uploadAborted`
- `rejectionReason` (set only when `uploadStatus = rejected`): `claim`, `copyright`, `duplicate`,
  `inappropriate`, `legal`, `length`, `termsOfUse`, `trademark`, `uploaderAccountClosed`,
  `uploaderAccountSuspended`

That `rejectionReason` enum is genuinely useful — `copyright`, `claim`, `legal`, and `trademark` are
machine-readable signals a monitoring job can act on without a human reading anything. `part=processingDetails`
similarly exposes `processingStatus` (`failed`/`processing`/`succeeded`/`terminated`) and
`processingFailureReason` (`other`/`streamingFailed`/`transcodeFailed`/`uploadFailed`) — but this
only covers transcode/delivery failures, never policy reasons.
([developers.google.com/youtube/v3/docs/videos](https://developers.google.com/youtube/v3/docs/videos))

**Not visible via the public API at all, for a normal (non-Partner) channel:** Content ID claim
detail, copyright strike detail, and Community Guidelines strike detail. `videos.list` simply
doesn't expose them — that data exists only in **YouTube Studio** (Copyright tab, Content ID tab,
Channel status/strikes page) and in **email notifications** sent to the channel-owning Google
account. A separate Content ID API exists, but it's restricted to YouTube Partner Program
content owners managing assets they own — not applicable to Zuvy as an uploader _receiving_ claims.
There is also no `status` field or enum value indicating "this went private because of an API
compliance/audit issue" (§5) — that state is invisible in the API and only inferable indirectly (a
video you uploaded as `unlisted` now reads back as `privacyStatus: private`).

**Lumen Database is not a workaround.** Lumen (lumendatabase.org, formerly Chilling Effects)
does host takedown notices Google forwards for defamation, trademark, counterfeit, and some other
legal categories — but Google has confirmed it does **not** forward copyright (DMCA or Content ID)
notices there. So for the single most likely violation category (copyright), there's no public
record to cross-check beyond what Studio/email already tell you.

**What a pipeline can still automate without a human:** periodic polling of `videos.list` for known
video IDs, watching for the video disappearing from the response entirely, or `uploadStatus`/
`privacyStatus` changing unexpectedly. This won't explain _why_, but it's a real, working tripwire —
"this video just became unavailable" is a detectable event even when the cause requires a human to
go read email or Studio afterward. YouTube's push-notification mechanism (PubSubHubbub/WebSub) is
documented for upload/metadata changes but not for removals, so polling — not webhooks — is the
correct mechanism here. This is the same shape of check as
[decisions.md's Phase 6 monitoring recommendation](session-recording-s3-implementation-plan.md#phase-6--monitoring)
for the S3 leg; the natural extension is to run an equivalent periodic audit against the YouTube
leg (`videos.list` on every `COMPLETED` row's `drive_file_id`), flagging any that vanished or
changed status even though the API can't say why.

---

## 7. What "channel termination" actually means for Zuvy — blast radius

The single most important fact across all research threads, because it's the scenario that makes
"just re-upload the affected video" not an option:

| Trigger                                       | What gets terminated                                                                                                                                                                         | Recoverable how                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 3 copyright strikes in 90 days                | **Entire channel** — every video, including unrelated unlisted ones, becomes inaccessible; user barred from creating a replacement channel                                                   | Counter-notification per strike (legal act, only if genuinely non-infringing); otherwise not recoverable |
| 3 Community Guidelines strikes in 90 days     | Entire channel, same as above — this is a fully independent 3-strike counter from copyright                                                                                                  | Appeal within 6 months per strike                                                                        |
| Single severe violation (CSAM-adjacent, etc.) | Entire channel, immediate, no warning tier, **no appeal route**                                                                                                                              | Not recoverable                                                                                          |
| Single Content ID claim                       | Just that video (blocked/muted/monetized in affected regions)                                                                                                                                | Dispute → claimant has 30 days; appeal → 7 days                                                          |
| Single privacy complaint                      | Just that video, and only after a 48-hour cure window                                                                                                                                        | Blur/trim within 48 hours, or contest                                                                    |
| Multi-channel structuring to isolate risk     | **Does not reliably work** — YouTube's policy explicitly extends termination "to all of your existing channels, any new channels you create or acquire" when common ownership is established | N/A — don't rely on this as a firewall                                                                   |

This table is the direct evidentiary backing for [decisions.md](decisions.md)'s premise: YouTube
cannot be the sole copy of any recording, because the failure mode isn't "that one video breaks," it's
"the entire library disappears at once," and it's triggered by strikes that may have nothing to do
with the specific video a student needs to watch.

---

## 8. Prevention checklist

**Content-level:**

- [ ] Instructor policy: no playing licensed music/video clips during a live session that gets
      recorded (breaks, icebreakers, etc.) — use YouTube's own Audio Library if any intentional music
      is wanted, since YouTube explicitly warns generic "royalty-free" music elsewhere is often still
      Content-ID-registered.
- [ ] Avoid embedding third-party copyrighted material (movie clips, stock video, textbook scans)
      in slides that get screen-shared and recorded.
- [ ] Don't rely on "it's educational" as a shield — it isn't one (§1).

**Account/infrastructure-level:**

- [ ] **Confirm the YouTube API project's audit status** (Google Cloud Console) — do not assume
      "unlisted" requests are actually landing as unlisted. This is the highest-priority, lowest-effort
      verification item in this entire document (§5).
- [ ] Confirm the uploading account is phone-verified (15-minute cap otherwise, §5).
- [ ] Use a **dedicated channel** for class recordings, isolated from any other public/monetized
      YouTube presence the org has — this limits blast radius per-incident even though it doesn't
      prevent linked-account termination (§7).
- [ ] Rate-limit/pace bulk uploads and vary metadata rather than dumping large batches at once, to
      avoid spam/reused-content classifier flags (§2).
- [ ] Tight access control on who can obtain unlisted links — human-flagged review is the dominant
      realistic trigger path for content automated classifiers pass over (§2).

**Process-level:**

- [ ] Name an owner who monitors YouTube Studio's Content ID / Copyright / Community Guidelines
      dashboards regularly — silent accumulation of unnoticed claims/strikes is how a channel reaches 3
      without anyone reacting in time.
- [ ] Set up the Gmail-watch alerting bridge described in §10, so that owner finds out within
      seconds of a notification email rather than during a periodic manual check.
- [ ] **This is exactly why [decisions.md](decisions.md) makes S3 the durable copy, written and
      verified before YouTube.** Every mitigation above reduces probability; none reduces it to zero.
      The only mitigation that survives a full channel termination is having the file somewhere YouTube
      doesn't control.

## 9. Response playbook — when a claim, strike, or complaint actually happens

1. **Don't ignore it, and don't reflexively counter-notify.** A counter-notification is a legal
   document filed under penalty of perjury — use it only when genuinely confident the content isn't
   infringing.
2. **Content ID claim:** try disputing first (claimant gets 30 days to respond); escalate to appeal
   only if the dispute is rejected (claimant then gets 7 days).
3. **Copyright strike:** first try requesting retraction directly from the claimant; if that fails
   and the use is genuinely non-infringing, file a counter-notification (10 business days for the
   claimant to respond or the strike is removed and video reinstated); otherwise, complete Copyright
   School and let it expire in 90 days if no further strikes accumulate.
4. **Privacy complaint:** act inside the 48-hour cure window — blur/trim the identified individual
   rather than losing the whole video.
5. **Any strike or removal:** appeal within the official windows (6 months for strikes, 1 year for
   removals) — appeals are a real, documented path, not a formality, though most termination
   decisions researched were reported as upheld on appeal, so prevention matters more than counting
   on reversal.
6. **If a channel is at 2 strikes on either system, treat it as an active incident**, not routine
   moderation noise — the third strike in the same 90-day window is a full, largely unrecoverable
   channel loss.

---

## 10. Automated notification architecture — is there a webhook for violations?

This directly answers the operational question this document exists to support: **can Zuvy get
notified the moment one of these violations happens, without a human checking YouTube Studio or
email?**

Short answer: **no native webhook exists for this from YouTube**, and that gap is still open as of
the latest check — no 2025/2026 announcement has closed it. But there is one concrete, buildable
near-real-time path, which combines with the polling tripwire already described in §6.2.

**What doesn't exist, confirmed:**

- No `videos.insert`/`videos.list` webhook or push mechanism for claims, strikes, or complaints.
  YouTube's only push mechanism (PubSubHubbub/WebSub) fires for new uploads/metadata changes on a
  channel, never for removals or enforcement actions.
- The Content ID API ([developers.google.com/youtube/partner](https://developers.google.com/youtube/partner))
  does expose claim data — but only to YouTube Partner Program content owners managing their own
  registered assets against other people's uploads. That's the wrong direction for Zuvy (Zuvy is the
  uploader _receiving_ claims, not a rights holder policing them) and it's inaccessible without
  Partner/Content-Manager status.
- The YouTube Reporting API has a system-managed **"Claims" report**
  ([developers.google.com/youtube/reporting/v1/reports/system_managed/claims](https://developers.google.com/youtube/reporting/v1/reports/system_managed/claims))
  — but it's gated behind the exact same Content-Owner/CMS restriction as the Content ID API, so
  it's a dead end for an ordinary uploading channel too.
- The YouTube Analytics API is confirmed views/watch-time/revenue only — no violation signal at all.
- Google Workspace's Admin SDK Alert Center / Reports API is scoped only to Workspace security/admin
  events (login anomalies, DLP, device management); the only YouTube-adjacent control there is a
  viewing-restriction _policy_ for org units, unrelated to detecting strikes against a channel.
- No third-party monitoring SaaS was found with privileged API access to an ordinary channel's own
  strikes/claims — the tools that exist either serve rights holders (the opposite problem) or are
  pre-upload advisory scanners, not reactive alerting on your own channel's enforcement history.
- YouTube Studio's internal notification/bell feed has no official API; any reverse-engineered
  access would mean scraping undocumented internal endpoints — a ToS risk, not something to build
  production monitoring on.

**What does work: Gmail API push notifications, as a legitimate bridge.**
Since every one of these violation types generates an email to the channel-owning Google account,
the practical, buildable solution is to monitor that inbox programmatically rather than trying to
get YouTube itself to push the event:

- `users.watch()` on the Gmail API registers a Cloud Pub/Sub topic; new mail triggers a push within
  roughly 1–10 seconds.
  ([Configure push notifications in Gmail API](https://developers.google.com/workspace/gmail/api/guides/push))
- The push payload is minimal (`emailAddress` + `historyId`) — you then call `history.list` to
  fetch the actual new message(s). This is a real, documented, intended mechanism, not a workaround.
- Minimum viable scope is `gmail.metadata` (headers only — sender, subject, no body); if reliably
  distinguishing violation _type_ requires reading the message body, `gmail.readonly` is needed
  instead. ([users.watch reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch),
  [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes))
- **Operational gotcha, confirmed and non-optional:** the watch expires and must be renewed at
  least every **7 days** via a scheduled job — a silently-failed renewal means the alert pipeline
  goes dark with no error surfaced anywhere else. The renewal job needs its own failure alerting;
  don't let the alerting system's own upkeep fail silently.
- **A risk that turned out not to be real:** Gmail's Promotions/Updates tab categorization is a
  UI-only concept — it doesn't affect what `history.list`/`watch()` sees, so tab placement is not a
  reliability concern for API-based detection.
- **The real gap:** there's no official, published catalog of exactly which sender addresses/
  subject-line formats YouTube uses per violation type (claim vs. strike vs. Community Guidelines vs.
  privacy complaint) — `no-reply@youtube.com` is the confirmed general sender, but building reliable
  classification rules means collecting real notification emails empirically and maintaining that
  classifier over time, since YouTube could change email formats without notice and there's no
  schema contract to rely on.

**Recommended architecture, combining what's actually available:**

1. **Primary, near-real-time signal:** Gmail API `watch()` + Cloud Pub/Sub push + `history.list`,
   filtering for YouTube's notification sender(s), parsed against an empirically-built (not
   officially documented) set of subject/body patterns to classify violation type. Requires a
   7-day watch-renewal cron with its own failure alerting.
2. **Secondary, redundant signal:** scheduled `videos.list(part=status)` polling against every
   `COMPLETED` recording's `drive_file_id` (§6.2, and
   [the implementation plan's Phase 6](session-recording-s3-implementation-plan.md#phase-6--monitoring)) —
   catches a video disappearing or its `uploadStatus`/`privacyStatus` changing even if the Gmail
   watcher is down or an email gets missed, though it can't explain _why_.
3. Neither signal substitutes for the other: Gmail is the only path to violation _type_ (what
   specifically happened), while `videos.list` polling is the only path that's independent of email
   infrastructure entirely. Running both is the realistic architecture, not a choice between them.

---

## 11. How this changes the storage architecture decision

Nothing here overturns [decisions.md](decisions.md) — it strengthens the case for it. Specifically:

- The research **confirms** the proposal's original Problem #1 ("permanent data loss on takedown")
  is not a hypothetical: a single strike-driven termination event takes the _entire_ historical
  recording library with it, not just one video, and multi-channel structuring is not a reliable
  defense against that.
- It **adds a new, previously-unflagged risk** the original proposal didn't cover: privacy
  complaints from identifiable students/minors, which is a risk category specific to recording
  _people_ rather than generic uploaded content, and one where "unlisted" provides no protection
  either (§3).
- It **surfaces a concrete, checkable action item** ahead of any S3 work: verify the YouTube API
  project's audit status and phone-verification status (§5) — if either has silently lapsed, the
  symptom (forced-private, 50-viewer cap, or a 15-minute truncation) would look like a mysterious
  playback bug, not an obvious policy error, and is worth ruling out now rather than during an
  incident.
- It reinforces why [decisions.md §2.4](decisions.md#24-serial-vs-parallel-upload)'s **S3-first,
  YouTube-second** ordering and **Zoom-deletion-gated-on-S3-only** decision are correct: by the time
  a copyright/community-guidelines/privacy event could take a YouTube video down, S3 already has the
  durable, independently-accessible copy, regardless of what happens to the YouTube leg or the
  channel it lives on.
- It confirms there's **no shortcut around building real monitoring** — since YouTube offers no
  violation webhook (§10), the audit job [already planned for the S3 leg](session-recording-s3-implementation-plan.md#phase-6--monitoring)
  is not optional scope-creep; it's the only mechanism (short of a human checking email) that
  catches a YouTube-side problem before a student reports a broken video.

---

## Sources

Grouped by topic; official Google/YouTube documentation listed first in each group.

**Copyright / Content ID:** [How Content ID works](https://support.google.com/youtube/answer/2797370) ·
[Content ID claims](https://support.google.com/youtube/answer/6013276) ·
[Copyright strikes](https://support.google.com/youtube/answer/2814000) ·
[Channel terminations](https://support.google.com/youtube/answer/2802168) ·
[Dispute a Content ID claim](https://support.google.com/youtube/answer/2797454) ·
[Counter notification](https://support.google.com/youtube/answer/2807684) ·
[Fair use on YouTube](https://support.google.com/youtube/answer/9783148) ·
[Copyright myths](https://support.google.com/youtube/answer/2797449)

**Community Guidelines:** [Community Guidelines](https://support.google.com/youtube/answer/9288567) ·
[Strike basics](https://support.google.com/youtube/answer/2802032) ·
[Strikes FAQ (2-systems)](https://support.google.com/youtube/answer/9235777) ·
[Spam policy](https://support.google.com/youtube/answer/2801973) ·
[Made for Kids determination](https://support.google.com/youtube/answer/9528076) ·
[Child safety policy](https://support.google.com/youtube/answer/2801999) ·
[Appeals](https://support.google.com/youtube/answer/185111) ·
[FTC/Disney settlement, Sept 2025](https://www.ftc.gov/news-events/news/press-releases/2025/09/disney-pay-10-million-settle-ftc-allegations-company-enabled-unlawful-collection-childrens-personal)

**Privacy:** [Protecting your identity](https://support.google.com/youtube/answer/2801895) ·
[Content with children](https://support.google.com/youtube/answer/9229229) ·
[Government removals FAQ](https://support.google.com/transparencyreport/answer/7347744) ·
[Privacy removal request volume, Statista](https://www.statista.com/statistics/1603068/content-removal-requests-for-privacy-and-security)

**API / account:** [API revision history](https://developers.google.com/youtube/v3/revision_history) ·
[Quota and Compliance Audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits) ·
[Determine quota cost](https://developers.google.com/youtube/v3/determine_quota_cost) ·
[Uploads over 15 minutes](https://support.google.com/youtube/answer/71673) ·
[API Services ToS](https://developers.google.com/youtube/terms/api-services-terms-of-service) ·
[Developer policies](https://developers.google.com/youtube/terms/developer-policies) ·
[API errors reference](https://developers.google.com/youtube/v3/docs/errors) ·
[Videos resource reference (status/processingDetails enums)](https://developers.google.com/youtube/v3/docs/videos) ·
[YouTube Partner / Content ID API](https://developers.google.com/youtube/partner) ·
[Push notifications (PubSubHubbub/WebSub) guide](https://developers.google.com/youtube/v3/guides/push_notifications)

**Timing & diagnosability:** [Copyright takedown process](https://support.google.com/youtube/answer/13823830) ·
[EFF guide to YouTube removals](https://www.eff.org/issues/intellectual-property/guide-to-youtube-removals) ·
[YouTube processing-delay incident, Jan 2026](https://9to5google.com/2026/01/09/youtube-processing-delay-issue-fix-coming) ·
[Lumen Database — YouTube takedown categories forwarded](https://lumendatabase-org.medium.com/high-level-observations-from-the-youtube-takedown-requests-in-the-lumen-database)

**Notification architecture:** [Gmail API push notifications guide](https://developers.google.com/workspace/gmail/api/guides/push) ·
[Gmail API users.watch reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch) ·
[Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) ·
[YouTube Reporting API — system-managed Claims report](https://developers.google.com/youtube/reporting/v1/reports/system_managed/claims) ·
[Admin SDK Alert Center API reference](https://developers.google.com/workspace/admin/alertcenter/reference/rest) ·
[Admin SDK Reports API overview](https://developers.google.com/workspace/admin/reports/v1/overview)
