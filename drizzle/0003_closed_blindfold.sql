ALTER TABLE "main"."zuvy_module_artcile" DROP CONSTRAINT "zuvy_module_artcile_module_id_zuvy_course_modules_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."zuvy_module_assignment" DROP CONSTRAINT "zuvy_module_assignment_module_id_zuvy_course_modules_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."zuvy_module_assignment" ADD CONSTRAINT "zuvy_module_assignment_chapter_id_zuvy_module_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE cascade ON UPDATE cascade
;
--> statement-breakpoint
ALTER TABLE "main"."zuvy_module_video" ALTER COLUMN "links" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "main"."zuvy_module_artcile" DROP COLUMN IF EXISTS "module_id";--> statement-breakpoint
ALTER TABLE "main"."zuvy_module_assignment" DROP COLUMN IF EXISTS "module_id";--> statement-breakpoint
ALTER TABLE "main"."zuvy_module_video" DROP COLUMN IF EXISTS "module_id";