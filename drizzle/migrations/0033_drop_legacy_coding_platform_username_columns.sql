ALTER TABLE IF EXISTS main.zuvy_learners_complete_profile
DROP COLUMN IF EXISTS leetcode_username;

ALTER TABLE IF EXISTS main.zuvy_learners_complete_profile
DROP COLUMN IF EXISTS codechef_username;

ALTER TABLE IF EXISTS main.zuvy_learners_complete_profile
DROP COLUMN IF EXISTS codeforces_username;
