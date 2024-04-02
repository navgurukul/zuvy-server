import { relations } from "drizzle-orm"
import { pgSchema, pgEnum, serial, varchar, timestamp, integer, text, bigserial } from "drizzle-orm/pg-core"
import { users } from '../../drizzle/schema.js'; // Import the 'users' module

export const main = pgSchema("main");


export const classesGoogleMeetLink= main.table("zuvy_classes_google_meet_link",{
	id: serial("id").primaryKey().notNull(),
        meetingid:text("meetingid").notNull(),
	hangoutLink:text("hangout_link").notNull(),
	creator:text("creator").notNull(),
	startTime:text("start_time").notNull(),
	endTime:text("end_time").notNull(),
	batchId:text("batch_id").notNull(),
	bootcampId:text("bootcamp_id").notNull(),
	title:text("title").notNull(),
        attendees:text("attendees").array(),
        s3link:text("s3link"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
})

export const bootcamps = main.table("zuvy_bootcamps", {
	id: serial("id").primaryKey().notNull(),
	name: text("name").notNull(),
	coverImage: text("cover_image"),
	bootcampTopic: text("bootcamp_topic"),
	startTime : timestamp("start_time", { withTimezone: true, mode: 'string' }),
	duration: text("duration"),
	language: text("language"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const bootcampType = main.table('zuvy_bootcamp_type', {
        id: serial('id').primaryKey().notNull(),
        bootcampId: integer('bootcamp_id').references(() => bootcamps.id, {
        onDelete: 'cascade',
        }), // Foreign key referencing bootcamp table
        type: text('type').notNull(), // Type of bootcamp (Public, Private, etc.)
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const batchesRelations = relations(bootcamps, ({one, many}) => ({
	bootcamp: one(batches, {
		fields: [bootcamps.id], 
		references: [batches.bootcampId] 
	}),
	batches: many(batches)
}))

export const bootcampEnrollmentsRelations = relations(bootcamps, ({one, many}) => ({
	bootcamp: one(batches, {
		fields: [bootcamps.id], 
		references: [batches.bootcampId] 
	}),
	bootcampEnrollments: many(batches)
}))


export const batches = main.table("zuvy_batches", {
        id: serial("id").primaryKey().notNull(),
        name: text("name").notNull(),
        bootcampId: integer("bootcamp_id").references(() => bootcamps.id, { onDelete: "cascade" } ),
        instructorId: integer("instructor_id").references(() => users.id),
        capEnrollment: integer("cap_enrollment"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const bootcampsEnrollmentsRelations = relations(bootcamps, ({one, many}) => ({
	batches: one(batches, {
		fields: [bootcamps.id], 
		references: [batches.bootcampId] 
	}),
	bootcamps: many(bootcamps)
}))

// export const batchEnrollmentsRelations = relations(batches, ({one, many}) => ({
//         // enrolles: many(batchEnrollments, {
//         //         relationName: bootcampsEnrollmentsRelations, 
//         //         references: [batchEnrollments.batchId] 
//         // }),
//         batchEnrollments: many(batches)
// }))

export const batchEnrollments = main.table("zuvy_batch_enrollments", {
        id: serial("id").primaryKey().notNull(),
        userId: bigserial("user_id", { mode: "bigint" }).notNull().references(() => users.id),
        bootcampId: integer("bootcamp_id").references(() => bootcamps.id, { onDelete: "cascade" } ),
        batchId: integer("batch_id").references(() =>  batches.id, { onDelete: "cascade" } ),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

// export const bootcampUsersRelations = relations(users, ({one, many}) => ({
//         batches: one(batches, {
//                 fields: [users.id], 
//                 references: [batchEnrollments.userId] 
//         }),
//         bootcamps: many(bootcamps)
// }))

export const articleTracking = main.table("zuvy_article_tracking", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        moduleId: integer("module_id").notNull(),
        articleId: integer("article_id").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const quizTracking = main.table("zuvy_quiz_tracking", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        moduleId: integer("module_id").notNull(),
        mcqId: integer("mcq_id").notNull(),
        quizId: integer("quiz_id"),
        attemptCount: integer("attempt_count").default(0).notNull(),
        status: varchar("status", { length: 255 }),
        chossenOption: integer("chossen_option").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});


export const assignmentSubmission = main.table("zuvy_assignment_submission", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        moduleId: integer("module_id").notNull(),
        bootcampId: integer("bootcamp_id").references(() => bootcamps.id),
        assignmentId: integer("assignment_id").notNull(),
        timeLimit: timestamp("time_limit",{ withTimezone: true, mode: 'string' }).notNull(),
        projectUrl: varchar("project_url", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const moduleTracking = main.table("zuvy_module_tracking", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        moduleId: integer("module_id").notNull(),
        progress: integer("progress").default(0),
        bootcampId: integer("bootcamp_id").references(() => bootcamps.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const bootcampTracking = main.table("zuvy_bootcamp_tracking", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        progress: integer("progress").default(0),
        bootcampId: integer("bootcamp_id").references(() => bootcamps.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const DriveLinks = main.table("zuvy_drive_links",{
        id:serial("id").primaryKey().notNull(),
        name : varchar("name").notNull(),
        fileid : varchar("fileid").notNull(),
        s3Link:varchar('s3Link'),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
})