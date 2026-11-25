-- Mentor tab (MT2): a new mentor slot must start at least this many days
-- after it is created (decision, 17 Nov 2026: T+4 days, so Ops has time to
-- share the slots). 0 turns the rule off. Read through
-- MentorshipConfigService; seeding never overwrites a value Ops has changed.
-- Needs 0050_mentorship_config.sql. Safe to run more than once.

INSERT INTO "zuvy_mentorship_config" ("key", "value", "description") VALUES
  ('slot_min_lead_days', '4',
   'A new mentor slot must start at least this many days from now. 0 turns the rule off.')
ON CONFLICT ("key") DO NOTHING;
