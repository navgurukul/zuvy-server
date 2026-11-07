-- ============================================
-- Gmail-based monitoring for YouTube violation notifications (Content ID
-- claims, copyright strikes, Community Guidelines strikes, privacy
-- complaints) that the YouTube Data API cannot surface for a normal
-- channel — confirmed live, 2026-09-24, see
-- youtube-recording-durability-and-restore-strategy.md §11. Purely
-- additive; unrelated to the recording pipeline tables, no existing
-- columns touched.
-- ============================================

-- Single row per watched mailbox, tracking the current Gmail watch so a
-- restart doesn't lose track of where history processing left off, and so
-- the daily renewal cron knows whether a watch is still active.
CREATE TABLE IF NOT EXISTS zuvy_gmail_watch_state (
  id SERIAL PRIMARY KEY,
  email_address TEXT NOT NULL UNIQUE,
  history_id TEXT,
  watch_expiration TIMESTAMPTZ,
  last_renewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Every candidate email logged here, not just ones a (currently simple,
-- undocumented-format-dependent) classifier is confident about — see the
-- durability doc's §11 note on why audit-only logging comes before
-- alerting: the classifier is a reverse-engineered heuristic against an
-- unspecified email format and needs to be validated against real traffic
-- before it's trusted to decide anything on its own.
CREATE TABLE IF NOT EXISTS zuvy_youtube_violation_emails (
  id SERIAL PRIMARY KEY,
  gmail_message_id TEXT NOT NULL UNIQUE,
  from_address TEXT,
  subject TEXT,
  received_at TIMESTAMPTZ,
  classification VARCHAR(50),
  raw_headers JSONB,
  reviewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_youtube_violation_emails_unreviewed
  ON zuvy_youtube_violation_emails (created_at)
  WHERE reviewed = FALSE;
