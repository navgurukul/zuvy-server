-- AFE Career Tours report: one row per attempt to email the report
-- (AfeReportJob). A report covers tours finished from window_start
-- (inclusive) to window_end (exclusive); the next report starts where the
-- last sent one ended, so no finished tour is sent twice or skipped. The first
-- report starts at AFE_REPORT_START (or 1970-01-01, i.e. everything so far).
-- Reports end on a Monday 9 AM India time (weekly).
--   status: sending (a server is building/sending it)
--           sent
--           failed (error says why; the same period is retried later)
-- Only adds a table; nothing existing changes. Apply before turning the
-- report on with AFE_REPORT_ENABLED=true (the job does nothing while it is
-- off). Safe to run more than once.

CREATE TABLE IF NOT EXISTS "zuvy_afe_report_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "window_end" timestamp with time zone NOT NULL,
  "status" varchar(20) NOT NULL,
  "row_count" integer,
  "recipients" text,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone,
  CONSTRAINT "zuvy_afe_report_runs_status_check"
    CHECK ("status" IN ('sending', 'sent', 'failed')),
  CONSTRAINT "zuvy_afe_report_runs_window_check"
    CHECK ("window_end" > "window_start")
);

-- At most one report in progress or sent per period start: when the app's
-- servers all run the hourly check at the same moment, only one can claim it.
CREATE UNIQUE INDEX IF NOT EXISTS "zuvy_afe_report_runs_one_per_window"
  ON "zuvy_afe_report_runs" ("window_start")
  WHERE "status" IN ('sending', 'sent');

-- The job reads the latest runs on every check.
CREATE INDEX IF NOT EXISTS "zuvy_afe_report_runs_created_at_idx"
  ON "zuvy_afe_report_runs" ("created_at");
