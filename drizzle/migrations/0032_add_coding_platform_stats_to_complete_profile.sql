ALTER TABLE IF EXISTS main.zuvy_learners_complete_profile
ADD COLUMN IF NOT EXISTS leetcode_profiles jsonb DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS main.zuvy_learners_complete_profile
ADD COLUMN IF NOT EXISTS codechef_profiles jsonb DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS main.zuvy_learners_complete_profile
ADD COLUMN IF NOT EXISTS codeforces_profiles jsonb DEFAULT '[]'::jsonb;

UPDATE main.zuvy_learners_complete_profile
SET leetcode_profiles = jsonb_build_array(
  jsonb_build_object(
    'username', leetcode_username,
    'rating', null,
    'stars', null,
    'country', null,
    'globalRank', null,
    'countryRank', null
  )
)
WHERE COALESCE(BTRIM(leetcode_username), '') <> ''
  AND (leetcode_profiles IS NULL OR leetcode_profiles = '[]'::jsonb);

UPDATE main.zuvy_learners_complete_profile
SET codechef_profiles = jsonb_build_array(
  jsonb_build_object(
    'username', codechef_username,
    'rating', null,
    'stars', null,
    'country', null,
    'globalRank', null,
    'countryRank', null
  )
)
WHERE COALESCE(BTRIM(codechef_username), '') <> ''
  AND (codechef_profiles IS NULL OR codechef_profiles = '[]'::jsonb);

UPDATE main.zuvy_learners_complete_profile
SET codeforces_profiles = jsonb_build_array(
  jsonb_build_object(
    'username', codeforces_username,
    'rating', null,
    'stars', null,
    'country', null,
    'globalRank', null,
    'countryRank', null
  )
)
WHERE COALESCE(BTRIM(codeforces_username), '') <> ''
  AND (codeforces_profiles IS NULL OR codeforces_profiles = '[]'::jsonb);
