import {
  pgTable,
  jsonb,
  serial,
  varchar,
  timestamp,
  integer,
  text,
  boolean,
  pgSchema
  // main,
} from 'drizzle-orm/pg-core';
export const main = pgSchema('main');

export const zuvyFormTracking = main.table("zuvy_form_tracking", {
  id: serial("id").primaryKey().notNull(),
  // userId: integer("user_id").references(() => users.id),
  moduleId: integer("module_id"),
  questionId: integer("question_id"),
  chapterId: integer("chapter_id"),
  chosenOptions: integer("chosen_options").array(),
  answer: text("answer"),
  status: varchar("status", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});