# Gmail-Based YouTube Violation Monitoring — Setup Runbook

Status: **GCP infrastructure connected and live (2026-10-19), one real bug found and fixed
during first live test**
Related: [youtube-recording-durability-and-restore-strategy.md §11](youtube-recording-durability-and-restore-strategy.md),
the shareholder billing doc (link shared separately)

**Bug found and fixed during first live verification (2026-10-19):** a single failed
`messages.get()` call inside the history-processing loop threw uncaught, aborting the entire
batch and — critically — preventing `history_id` from ever advancing, so every subsequent poll
retried the exact same failing entry forever, permanently blocking all future mail. Triggered by
something completely ordinary, not an edge case: Gmail's own draft-autosave behavior generates a
`messageAdded` history event per autosave, and superseded drafts 404 on `messages.get()` within
moments. Confirmed live: of 5 history entries from one real test email being composed, 4 were
stale draft revisions (404) and 1 was the actual sent message (fetched fine). Fixed by wrapping
the per-message fetch in its own try/catch — one message failing now logs a warning and skips,
the batch and the watermark both continue regardless.

This is the step-by-step checklist to actually turn on the feature built in
`src/services/gmail-monitor/`. Nothing here runs until every step below is done —
`GMAIL_MONITOR_ENABLED` stays `"false"` and every call is a safe no-op until then.

## What exists already (no action needed)

- `GmailMonitorService` — watch lifecycle (daily renewal + startup check), push-notification
  handler, and an independent 30-minute fallback poll (Google's own docs concede push can be
  delayed or dropped).
- `GmailMonitorController` — `POST /webhooks/gmail/notifications`, verifies the Pub/Sub push's
  OIDC token (signature + audience + the specific service account) before processing anything.
- Two new tables (migration `0046`): `zuvy_gmail_watch_state` (tracks the current watch) and
  `zuvy_youtube_violation_emails` (logs every candidate email — audit-only for now, not
  alerting, since the email format is a reverse-engineered heuristic, not an official spec).

## Part A — Google Cloud Console

### A1. Billing account (the step the shareholder doc is about)

- Google Cloud Console → Billing → link a billing account to the project already used for
  the YouTube integration. Required before Pub/Sub can be used at all, even at $0 cost.
- Once linked: Billing → Budgets & alerts → create a budget alert (e.g. $5/month) so anyone
  is notified immediately if usage ever approaches a real charge.

### A2. Create the Pub/Sub topic

- Pub/Sub → Topics → Create topic. Name it something like `gmail-content-id-notifications`.
- Note the full resource name shown: `projects/<project-id>/topics/<topic-name>` — this is
  the `GMAIL_PUBSUB_TOPIC` value.

### A3. Grant Gmail's push service account publish rights

- On that topic → Permissions → Add principal.
- Principal: `gmail-api-push@system.gserviceaccount.com`
- Role: **Pub/Sub Publisher**
- Without this exact grant, `users.watch()` will succeed but nothing is ever delivered —
  this is the single most common setup mistake for this integration.

### A4. Create a service account for push authentication

- IAM & Admin → Service Accounts → Create service account (e.g. `gmail-push-authenticator`).
  No special roles needed beyond being usable as a push-auth identity.
- Note its email address — this is `GMAIL_PUBSUB_SERVICE_ACCOUNT_EMAIL`.

### A5. Create the push subscription

- On the topic → Create subscription.
- Delivery type: **Push**.
- Endpoint URL: `https://<your-deployed-host>/webhooks/gmail/notifications`
- Enable authentication → select the service account from A4.
- Audience: leave as the default (the endpoint URL) unless you have a reason to set a
  different one — whatever value ends up configured here is `GMAIL_PUBSUB_AUDIENCE`, and it
  must match exactly what the controller verifies against.

### A6. Enable the Gmail API (if not already)

- APIs & Services → Library → Gmail API → Enable, on the same project.

## Part B — OAuth token for the watched mailbox

This needs a **new** refresh token — the existing `GOOGLE_YT_REFRESH_TOKEN` was issued for
the `youtube` scope only and won't work here.

1. `https://developers.google.com/oauthplayground/` → gear icon → check **"Use your own
   OAuth credentials"** → enter the same `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` already
   in `.env`. (Same mistake as last time to avoid: skipping this box silently uses Google's
   own generic test client instead, producing a token that fails with `unauthorized_client`.)
2. In the scope list, find **Gmail API v1** and select:
   ```
   https://www.googleapis.com/auth/gmail.metadata
   ```
   Not `gmail.readonly` — this feature only ever reads headers, never message bodies.
3. Authorize, signing in as the **same Google account that owns the YouTube channel** (the
   one whose inbox actually receives the violation notifications).
4. Exchange authorization code for tokens → copy the refresh token.
5. This becomes `GMAIL_MONITOR_REFRESH_TOKEN`. `GMAIL_MONITOR_EMAIL_ADDRESS` is that same
   account's email address.

## Part C — Fill in `.env` and restart

```
GMAIL_MONITOR_ENABLED="true"
GMAIL_MONITOR_EMAIL_ADDRESS="<the channel's Google account email>"
GMAIL_MONITOR_REFRESH_TOKEN="<from Part B>"
GMAIL_PUBSUB_TOPIC="projects/<project-id>/topics/<topic-name>"
GMAIL_PUBSUB_AUDIENCE="<the subscription's configured audience, from A5>"
GMAIL_PUBSUB_SERVICE_ACCOUNT_EMAIL="<the service account's email, from A4>"
```

Fully stop and restart the process — same rule as every other `.env` change on this project.

## Part D — Verify

1. **Startup log**: confirm `Gmail monitor config: GMAIL_MONITOR_ENABLED=true ...` prints with
   real values, not `(unset)`.
2. **Watch established**: the service also tries once at startup (not just the daily 3 AM IST
   cron), so within moments of restart you should see `Gmail watch renewed for <email>,
expires ...` in the logs. If not, check for a logged error first.
3. **Confirm in the database**:
   ```sql
   SELECT * FROM zuvy_gmail_watch_state;
   ```
   Expect one row, `history_id` and `watch_expiration` populated (expiration ~7 days out).
4. **End-to-end test**: send a test email to the watched inbox from any address containing
   "youtube" with a subject containing a word like "copyright" (e.g.
   `test-youtube-notify@example.com`, subject "Test copyright claim"). Within the push
   latency (seconds) or at worst the next 30-minute fallback poll, confirm:
   ```sql
   SELECT * FROM zuvy_youtube_violation_emails ORDER BY id DESC LIMIT 5;
   ```
   should show the test email logged, with `classification` populated.
5. **Confirm the renewal cadence is working** by checking back the next day that
   `last_renewed_at` has advanced — don't wait a full 7 days to find out the cron is broken.

## Part E — Testing the classifier with a real email

Classification only ever looks at the **From** and **Subject** headers — never the body,
since the OAuth scope is `gmail.metadata` (headers only, by design). Two conditions must
both be true for a message to be classified:

1. **From** matches `CANDIDATE_SENDER_PATTERNS` — `/youtube/i` (tested against the whole
   raw header, so a display name match counts, not just the email address) or the raw
   address ends in `@google.com`.
2. **Subject** matches one of `CANDIDATE_SUBJECT_PATTERNS`, checked **in this order** —
   first match wins: `copyright`, `claim`, `strike`, `community guideline`, `content id`,
   `removed`, `takedown`.

You can't actually send as `@youtube.com`, so the practical way to trigger the sender
match is a **display name** containing "YouTube" — the regex tests the whole header
string, not just the domain.

### Steps to send a realistic test email

1. In Gmail (any account you control, including the watched inbox itself) → ⚙️
   **Settings → See all settings → Accounts and Import → "Send mail as"** → next to the
   sending address → **edit info** → temporarily change the name to
   `YouTube Content ID Team` → Save.
2. Send a new email:
   - **To:** the watched inbox (`GMAIL_MONITOR_EMAIL_ADDRESS`)
   - **Subject:** `Copyright claim notice for your video`
   - **Body:** anything — it's never read.
3. Send it.
4. **Revert the display name back** right after, so it doesn't leak into other mail.

### Test case: expected result

- `from_address` will contain `"YouTube Content ID Team <your-address>"` → matches
  `/youtube/i` ✅
- Subject contains "copyright" first in pattern order → classification resolves to
  exactly `"copyright"` (not `claim`, even though that word is also in the subject —
  `copyright` is checked first and wins on first match).
- A `WARN` log line: `[GMAIL_MONITOR] Candidate YouTube violation email detected: ...
classification=copyright — needs human review`.
- A new row in `zuvy_youtube_violation_emails` with `classification: "copyright"`.

Verify via push latency (seconds) or at worst the next 30-minute fallback poll:

```sql
SELECT * FROM zuvy_youtube_violation_emails ORDER BY id DESC LIMIT 5;
```

Note: deduplication is by Gmail message ID (`gmail_message_id`), not subject — sending
the same subject text again from a different message always creates a new row, it never
conflicts with an earlier test.

**Common mistake to avoid**: sending the test email without changing the display name
first (e.g. from the watched inbox's own default name) won't match the sender pattern at
all — the row will still be logged (every candidate is logged regardless of outcome) but
`classification` will come back `NULL`, since the sender condition failed before the
subject was even checked. This is expected, not a bug — confirmed live on 2026-10-19 when
a self-sent test from `Zuvy Team <team@zuvy.org>` correctly logged with
`classification: null`.

## What this does not do (by design, for now)

- It does not alert anyone automatically — every candidate is logged to
  `zuvy_youtube_violation_emails` for a human to review (`reviewed = FALSE` by default).
  Alerting on top of this table is a reasonable next step once the classifier has been
  checked against real traffic for a while, not before.
- It does not try to take any action on a detected claim — per
  [decisions.md's §2 risk table](youtube-recording-durability-and-restore-strategy.md#2-the-one-thing-that-changes-the-design-not-all-youtube-failures-are-equal),
  that's correctly a human decision, not something to automate.
