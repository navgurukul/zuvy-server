
CREATE TABLE "main"."zuvy_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" bigserial,
	"target_user_id" bigserial,
	"action" varchar(100) NOT NULL,
	"role_id" integer,
	"permission_id" integer,
	"scope_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_extra_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigserial NOT NULL,
	"granted_by" bigserial NOT NULL,
	"permission_id" integer NOT NULL,
	"resource_id" integer NOT NULL,
	"course_name" varchar(255),
	"action" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"resource_id" integer NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_permissions_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"permission_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uniq_role_permission" UNIQUE("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_permissions_scope" (
	"id" serial PRIMARY KEY NOT NULL,
	"permission_id" integer NOT NULL,
	"scope_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(64) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "zuvy_resources_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_scopes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	CONSTRAINT "zuvy_scopes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_user_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigserial NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	CONSTRAINT "zuvy_user_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_user_roles_assigned" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigserial NOT NULL,
	"role_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "zuvy_user_roles_assigned_user_id_role_id_pk" UNIQUE("user_id","role_id")
);

ALTER TABLE "main"."zuvy_audit_logs" ADD CONSTRAINT "zuvy_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_audit_logs" ADD CONSTRAINT "zuvy_audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_audit_logs" ADD CONSTRAINT "zuvy_audit_logs_role_id_zuvy_user_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "main"."zuvy_user_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_audit_logs" ADD CONSTRAINT "zuvy_audit_logs_permission_id_zuvy_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "main"."zuvy_permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_audit_logs" ADD CONSTRAINT "zuvy_audit_logs_scope_id_zuvy_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "main"."zuvy_scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_extra_permissions" ADD CONSTRAINT "zuvy_extra_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_extra_permissions" ADD CONSTRAINT "zuvy_extra_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_extra_permissions" ADD CONSTRAINT "zuvy_extra_permissions_permission_id_zuvy_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "main"."zuvy_permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_extra_permissions" ADD CONSTRAINT "zuvy_extra_permissions_resource_id_zuvy_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "main"."zuvy_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_permissions" ADD CONSTRAINT "zuvy_permissions_resource_id_zuvy_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "main"."zuvy_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_permissions_roles" ADD CONSTRAINT "zuvy_permissions_roles_permission_id_zuvy_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "main"."zuvy_permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_permissions_roles" ADD CONSTRAINT "zuvy_permissions_roles_role_id_zuvy_user_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "main"."zuvy_user_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_permissions_scope" ADD CONSTRAINT "zuvy_permissions_scope_permission_id_zuvy_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "main"."zuvy_permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_permissions_scope" ADD CONSTRAINT "zuvy_permissions_scope_scope_id_zuvy_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "main"."zuvy_scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_role_permissions" ADD CONSTRAINT "zuvy_role_permissions_role_id_zuvy_user_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "main"."zuvy_user_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_role_permissions" ADD CONSTRAINT "zuvy_role_permissions_permission_id_zuvy_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "main"."zuvy_permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_user_permissions" ADD CONSTRAINT "zuvy_user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_user_permissions" ADD CONSTRAINT "zuvy_user_permissions_permission_id_zuvy_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "main"."zuvy_permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_user_roles_assigned" ADD CONSTRAINT "zuvy_user_roles_assigned_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_user_roles_assigned" ADD CONSTRAINT "zuvy_user_roles_assigned_role_id_zuvy_user_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "main"."zuvy_user_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint