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
// import { zuvyModuleChapter } from './zuvyModuleChapter';

export const zuvyModuleForm = main.table('zuvy_module_form', {
  id: serial('id').primaryKey().notNull(),
  // chapterId: integer('chapter_id').references(() => zuvyModuleChapter.id).notNull(),
  question: text('question'),
  options: jsonb('options'),
  // typeId: integer('type_id').references(() => zuvyQuestionTypes.id),
  isRequired: boolean('is_required').notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  usage: integer('usage').default(0),
});
