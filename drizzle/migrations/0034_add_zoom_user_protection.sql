-- ============================================================
-- Seed: Populate zuvy_user_licenses from Zoom live data
-- and mark protected users
-- ============================================================

-- Step 1: Ensure is_protected column exists
ALTER TABLE IF EXISTS main.zuvy_user_licenses
  ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Insert all known Zoom licensed users directly
-- (mirrors what syncLicensedUsersFromZoom does, but as a one-time SQL seed)
-- These are the active licensed users visible in your screenshot (license_type = 2)
INSERT INTO main.zuvy_user_licenses (
  zoom_email,
  zoom_user_id,
  user_name,
  license_type,
  status,
  is_protected,
  created_at,
  updated_at
)
VALUES
  ('k.archana@navgurukul.org',    '0_TL1iiJSiCzYmftWWtlxA', 'Archana Archana',      2, 'active', false, NOW(), NOW()),
  ('rohit.k@navgurukul.org',      '2Exqh63qQ_ijml4Ys8qhYQ', 'Rohit Kumar Singh',    2, 'active', false, NOW(), NOW()),
  ('dutta.aniket1399@gmail.com',  'Dqy165B_TgSKQEBMvk89Tc', 'Aniket Dutta',         2, 'active', true,  NOW(), NOW()),
  ('poonam@navgurukul.org',       'jtP2r9AmTiy2o55Gw08FQg', 'Poonam Bagh',          2, 'active', true,  NOW(), NOW()),
  ('team@zuvy.org',               'oH7278dzQSW5NoHHJyRtS',  'team zuvy',            2, 'active', true,  NOW(), NOW()),
  ('laasya@navgurukul.org',       'Wux3ldAHT0uhsFp41OIASA', 'Laasya Puskar',        2, 'active', true,  NOW(), NOW()),
  -- Basic users (license_type = 1) from screenshot
  ('vinit@navgurukul.org',        'BNM_ystjS0akWloc25uAFw', 'Vinit Gore',           1, 'active', false, NOW(), NOW()),
  ('mentorszuvy@gmail.com',       'IxdDgb5URumGUD_qjecl6w', 'Mentors Dashboard',    1, 'active', false, NOW(), NOW()),
  ('sakshamchauhan23@gmail.com',  'M2Z-S0e2RyiLpU2fEA8K3Q', 'Saksham Chauhan',     1, 'active', false, NOW(), NOW()),
  ('ujala@navgurukul.org',        'v1WOLH9fS42NDOjKjhpH7',  'Ujala Saini',          1, 'active', false, NOW(), NOW())
ON CONFLICT (zoom_email) DO UPDATE SET
  zoom_user_id  = EXCLUDED.zoom_user_id,
  user_name     = EXCLUDED.user_name,
  license_type  = EXCLUDED.license_type,
  status        = EXCLUDED.status,
  updated_at    = NOW();
  -- NOTE: is_protected is intentionally NOT updated here to avoid
  -- overwriting manual protection flags on re-run

-- Step 3: Set protected flags for the designated accounts
-- Protected = these accounts always keep their Business license
-- and are never used as donors for seat transfers
UPDATE main.zuvy_user_licenses
SET
  is_protected = true,
  updated_at   = NOW()
WHERE lower(zoom_email) IN (
  'team@zuvy.org',
  'laasya@navgurukul.org',
  'dutta.aniket1399@gmail.com',
  'poonam@navgurukul.org'
);

-- Step 4: Verify the result
SELECT
  id,
  zoom_email,
  user_name,
  license_type,
  status,
  is_protected,
  updated_at
FROM main.zuvy_user_licenses
ORDER BY is_protected DESC, license_type DESC, zoom_email;