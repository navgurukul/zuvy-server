ALTER TABLE "zuvy_user_roles"
DROP CONSTRAINT IF EXISTS "zuvy_user_roles_name_unique";

ALTER TABLE "zuvy_user_roles" 
DROP CONSTRAINT IF EXISTS "uniq_name";

ALTER TABLE "zuvy_user_roles" 
DROP CONSTRAINT IF EXISTS "zuvy_user_roles_name_key";


ALTER TABLE "zuvy_user_roles" 
DROP CONSTRAINT IF EXISTS "ZUVY_USER_ROLES_NAME_UNIQUE";