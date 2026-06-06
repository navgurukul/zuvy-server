ALTER TABLE IF EXISTS main.zuvy_user_licenses
ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;

UPDATE main.zuvy_user_licenses
SET is_protected = true
WHERE lower(zoom_email) IN (
  'team@zuvy.org',
  'laasya@navgurukul.org',
  'vinit@navgurukul.org',
  'dutta.aniket1399@gmail.com',
  'poonam@navgurukul.org',
  'ujala@navgurukul.org'
);

SELECT current_database();

SELECT current_schema();

SHOW search_path;