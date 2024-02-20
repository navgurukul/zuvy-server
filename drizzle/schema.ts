import { relations } from "drizzle-orm"
import { pgTable, jsonb, pgSchema, pgEnum, serial, varchar, timestamp, foreignKey, integer, text, unique, date, bigserial, boolean, bigint, index, char, json, uniqueIndex, doublePrecision, customType } from "drizzle-orm/pg-core"
// import { users } from './users'; // Import the 'users' module

export const courseEnrolmentsCourseStatus = pgEnum("course_enrolments_course_status", ['enroll', 'unenroll', 'completed'])
export const coursesType = pgEnum("courses_type", ['html', 'js', 'python'])
export const exercisesReviewType = pgEnum("exercises_review_type", ['manual', 'peer', 'facilitator', 'automatic'])
export const exercisesSubmissionType = pgEnum("exercises_submission_type", ['number', 'text', 'text_large', 'attachments', 'url'])
export const submissionsState = pgEnum("submissions_state", ['completed', 'pending', 'rejected'])
export const userRolesCenter = pgEnum("user_roles_center", ['dharamshala', 'banagalore', 'all'])
export const userRolesRoles = pgEnum("user_roles_roles", ['admin', 'alumni', 'student', 'facilitator'])
export const usersCenter = pgEnum("users_center", ['dharamshala', 'bangalore'])

export const main = pgSchema("main");



// relations(users, ({one, many}) => ({
//         users: one(users, {
//                 fields: [users.id],
//                 references: [batchEnrollments.userId] 
//         }),
//         batchEnrollments: many(batches)
// }))


export const engArticles = main.table("eng_articles", {
        id: serial("id").primaryKey().notNull(),
        title: varchar("title", { length: 255 }).notNull(),
        sourceUrl: varchar("source_url", { length: 255 }).notNull(),
        imageUrl: varchar("image_url", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const engLevelwise = main.table("eng_levelwise", {
        id: serial("id").primaryKey().notNull(),
        level: integer("level").notNull(),
        content: text("content").notNull(),
        articleId: integer("article_id").notNull().references(() => engArticles.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const engHistory = main.table("eng_history", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").notNull().references(() => users.id),
        engArticlesId: integer("eng_articles_id").notNull().references(() => engArticles.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const chanakyaUserEmail = main.table("chanakya_user_email", {
        id: serial("id").primaryKey().notNull(),
        email: varchar("email", { length: 255 }).notNull(),
},
(table) => {
        return {
                mainChanakyaUserEmailEmailUnique: unique("main_chanakya_user_email_email_unique").on(table.email),
        }
});



export const pathwaysOngoingTopicOutcome = main.table("pathways_ongoing_topic_outcome", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        pathwayId: integer("pathway_id"),
        courseId: integer("course_id"),
        exerciseId: integer("exercise_id"),
        assessmentId: integer("assessment_id"),
        teamId: integer("team_id"),
        moduleId: integer("module_id"),
        projectTopicId: integer("project_topic_id"),
        projectSolutionId: integer("project_solution_id"),
        slugId: integer("slug_id"),
        type: varchar("type", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const dailyMetrics = main.table("daily_metrics", {
        id: serial("id").primaryKey().notNull(),
        metricName: varchar("metric_name", { length: 255 }),
        value: integer("value"),
        date: date("date"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
        gender: integer("gender"),
});

export const donor = main.table("donor", {
        id: serial("id").primaryKey().notNull(),
        donor: varchar("donor", { length: 225 }),
});

export const studentDonor = main.table("student_donor", {
        id: serial("id").primaryKey().notNull(),
        studentId: integer("student_id").references(() => students.id),
        donorId: text("donor_id").array(),
});

export const feedbacks = main.table("feedbacks", {
        id: serial("id").primaryKey().notNull(),
        studentId: integer("student_id").references(() => students.id),
        userId: integer("user_id").references(() => cUsers.id),
        studentStage: varchar("student_stage", { length: 255 }).notNull(),
        feedback: text("feedback"),
        state: varchar("state", { length: 255 }),
        whoAssign: varchar("who_assign", { length: 255 }),
        toAssign: varchar("to_assign", { length: 255 }),
        audioRecording: varchar("audio_recording", { length: 255 }),
        deadlineAt: timestamp("deadline_at", { withTimezone: true, mode: 'string' }),
        finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
        lastUpdated: timestamp("last_updated", { withTimezone: true, mode: 'string' }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
        notificationSentAt: text("notification_sent_at"),
        notificationStatus: text("notification_status"),
},
(table) => {
        return {
                idx80256FeedbacksStudentidForeign: index("idx_80256_feedbacks_studentid_foreign").on(table.studentId),
                idx80256FeedbacksUseridForeign: index("idx_80256_feedbacks_userid_foreign").on(table.userId),
        }
});



export const ongoingTopics = main.table("ongoing_topics", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        teamId: integer("team_id").references(() => c4CaTeams.id, { onDelete: "cascade", onUpdate: "cascade" } ),
        pathwayId: integer("pathway_id").notNull(),
        courseId: integer("course_id").notNull(),
        slugId: integer("slug_id").notNull(),
        type: text("type").notNull(),
        moduleId: integer("module_id"),
        projectTopicId: integer("project_topic_id").references(() => c4CaTeamProjecttopic.id, { onDelete: "cascade", onUpdate: "cascade" } ),
        projectSolutionId: integer("project_solution_id").references(() => c4CaTeamProjectsubmitSolution.id, { onDelete: "cascade", onUpdate: "cascade" } ),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});

export const gtaGame = main.table("gta_game", {
        id: serial("id").primaryKey().notNull(),
        firstName: varchar("first_name", { length: 255 }).notNull(),
        lastName: text("last_name").notNull(),
        gender: varchar("gender", { length: 255 }).notNull(),
        country: varchar("country", { length: 255 }),
        password: varchar("password", { length: 255 }).notNull(),
        userId: varchar("user_id", { length: 255 }).notNull(),
});

export const hackathonForTemp = main.table("hackathon_for_temp", {
        id: serial("id").primaryKey().notNull(),
        firstName: varchar("first_name", { length: 255 }).notNull(),
        lastName: text("last_name").notNull(),
        gender: varchar("gender", { length: 255 }).notNull(),
        country: varchar("country", { length: 255 }),
        password: varchar("password", { length: 255 }).notNull(),
        userId: varchar("user_id", { length: 255 }).notNull(),
});

export const kDetails = main.table("k_details", {
        id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        parentsName: varchar("parents_name", { length: 255 }).notNull(),
        address: varchar("address", { length: 255 }).notNull(),
        city: varchar("city", { length: 255 }).notNull(),
        state: varchar("state", { length: 255 }).notNull(),
        pinCode: varchar("pin_code", { length: 255 }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
        email: varchar("email", { length: 255 }).notNull(),
        profilePic: varchar("profile_pic", { length: 255 }).notNull(),
        indemnityForm: varchar("indemnity_form", { length: 255 }).notNull(),
        deleted: boolean("deleted"),
});

export const knexMigrations = main.table("knex_migrations", {
        id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
        name: varchar("name", { length: 255 }),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        batch: bigint("batch", { mode: "number" }),
        migrationTime: timestamp("migration_time", { withTimezone: true, mode: 'string' }),
});

export const knexMigrationsLock = main.table("knex_migrations_lock", {
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        isLocked: bigint("is_locked", { mode: "number" }),
});

export const meetAttendance = main.table("meet_attendance", {
        id: serial("id").primaryKey().notNull(),
        attendiesData: varchar("attendies_data", { length: 255 }),
        meetingDate: timestamp("meeting_date", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const meetAttendanceTracker = main.table("meet_attendance_tracker", {
        id: serial("id").primaryKey().notNull(),
        meetingTitle: varchar("meeting_title", { length: 255 }),
        attendeeNames: varchar("attendee_names", { length: 255 }),
        attendedDurationInSec: varchar("attendedDurationInSec", { length: 255 }),
        meetCode: varchar("meet_code", { length: 255 }),
        meetingTime: timestamp("meeting_time", { withTimezone: true, mode: 'string' }).notNull(),
});

export const moduleCompletionV2 = main.table("module_completion_v2", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        moduleId: integer("module_id").notNull(),
        completeAt: timestamp("complete_at", { withTimezone: true, mode: 'string' }),
        teamId: integer("team_id").references(() => c4CaTeams.id, { onDelete: "set null" } ),
        percentage: integer("percentage"),
});

export const migrations = main.table("migrations", {
        id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        runOn: timestamp("run_on", { withTimezone: true, mode: 'string' }).notNull(),
});

export const newStudentsTemp = main.table("new_students_temp", {
        id: serial("id").primaryKey().notNull(),
        studentId: integer("student_id"),
        name: varchar("name", { length: 300 }),
        gender: integer("gender"),
        dob: timestamp("dob", { withTimezone: true, mode: 'string' }),
        email: varchar("email", { length: 150 }),
        state: varchar("state", { length: 2 }),
        city: varchar("city", { length: 45 }),
        gpsLat: varchar("gps_lat", { length: 45 }),
        gpsLong: varchar("gps_long", { length: 45 }),
        pinCode: varchar("pin_code", { length: 10 }),
        qualification: integer("qualification"),
        currentStatus: integer("current_status"),
        schoolMedium: integer("school_medium"),
        religon: integer("religon"),
        caste: integer("caste"),
        percentageIn10Th: varchar("percentage_in10th", { length: 255 }),
        mathMarksIn10Th: integer("math_marks_in10th"),
        percentageIn12Th: varchar("percentage_in12th", { length: 255 }),
        mathMarksIn12Th: integer("math_marks_in12th"),
        stage: varchar("stage", { length: 45 }).notNull(),
        tag: varchar("tag", { length: 255 }),
        partnerId: integer("partner_id"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
        lastUpdated: timestamp("last_updated", { withTimezone: true, mode: 'string' }),
        district: varchar("district", { length: 255 }),
        currentOwnerId: integer("current_owner_id"),
        partnerRefer: varchar("partner_refer", { length: 255 }),
        evaluation: varchar("evaluation", { length: 255 }),
        redflag: varchar("redflag", { length: 255 }),
        imageUrl: text("image_url"),
        otherActivities: varchar("other_activities", { length: 255 }),
        campusStatus: varchar("campus_status", { length: 255 }),
        schoolStageId: integer("school_stage_id"),
});

export const newsApp = main.table("news_app", {
        id: serial("id").primaryKey().notNull(),
        firstName: varchar("first_name", { length: 255 }).notNull(),
        lastName: text("last_name").notNull(),
        gender: varchar("gender", { length: 255 }).notNull(),
        country: varchar("country", { length: 255 }),
        password: varchar("password", { length: 255 }).notNull(),
        userId: varchar("user_id", { length: 255 }).notNull(),
});

export const partnerAssessments = main.table("partner_assessments", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 45 }).notNull(),
        answerKeyUrl: varchar("answer_key_url", { length: 300 }),
        assessmentUrl: varchar("assessment_url", { length: 300 }),
        questionSetId: varchar("question_set_id", { length: 45 }).notNull(),
        partnerId: integer("partner_id").notNull(),
        createdAt: varchar("created_at", { length: 45 }).notNull(),
});

export const partnerGroupUser = main.table("partner_group_user", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id"),
        partnerGroupId: integer("partner_group_id").notNull().references(() => partnerGroup.id),
        email: varchar("email", { length: 255 }),
});

export const merakihackthon = main.table("merakihackthon", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").notNull().references(() => users.id),
        email: varchar("email", { length: 255 }).notNull(),
        durations: integer("durations").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
        return {
                mainMerakihackthonUserIdUnique: unique("main_merakihackthon_user_id_unique").on(table.userId),
        }
});

export const mergedClasses = main.table("merged_classes", {
        id: serial("id").primaryKey().notNull(),
        classId: integer("class_id").references(() => classes.id),
        mergedClassId: integer("merged_class_id").references(() => classes.id),
});

export const partnerGroup = main.table("partner_group", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        baseGroup: boolean("base_group").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
        scope: varchar("scope", { length: 255 }),
},
(table) => {
        return {
                mainPartnerGroupNameUnique: unique("main_partner_group_name_unique").on(table.name),
        }
});

export const partnerGroupRelationship = main.table("partner_group_relationship", {
        id: serial("id").primaryKey().notNull(),
        partnerGroupId: integer("partner_group_id").notNull().references(() => partnerGroup.id),
        memberOf: integer("member_of").notNull(),
});

export const partnerRelationship = main.table("partner_relationship", {
        id: serial("id").primaryKey().notNull(),
        partnerId: integer("partner_id").notNull().references(() => partners.id),
        partnerGroupId: integer("partner_group_id").notNull().references(() => partnerGroup.id),
});

export const mentors = main.table("mentors", {
        id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        mentor: bigint("mentor", { mode: "number" }).references(() => users.id),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        mentee: bigint("mentee", { mode: "number" }).references(() => users.id),
        scope: varchar("scope", { length: 255 }),
        userId: integer("user_id").references(() => users.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
        return {
                idx50487MentorIbfk1Idx: index("idx_50487_mentor_ibfk_1_idx").on(table.mentor),
                idx50487MentorIbfk2Idx: index("idx_50487_mentor_ibfk_2_idx").on(table.mentee),
        }
});

export const merakiCertificate = main.table("meraki_certificate", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        url: varchar("url", { length: 255 }),
        registerAt: varchar("register_at", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
        pathwayCode: varchar("pathway_code", { length: 255 }),
});

export const partnerSpecificBatches = main.table("partner_specific_batches", {
        id: serial("id").primaryKey().notNull(),
        classId: integer("class_id").references(() => classes.id),
        recurringId: integer("recurring_id").references(() => recurringClasses.id),
        partnerId: integer("partner_id").references(() => partners.id),
        groupId: integer("group_id").references(() => spaceGroup.id, { onDelete: "set null" } ),
        spaceId: integer("space_id").references(() => partnerSpace.id, { onDelete: "set null" } ),
        pathwayId: integer("pathway_id").references(() => pathwaysV2.id),
});

export const partnerSpace = main.table("partner_space", {
        id: serial("id").primaryKey().notNull(),
        partnerId: integer("partner_id").references(() => partners.id, { onDelete: "cascade", onUpdate: "cascade" } ),
        spaceName: varchar("space_name", { length: 255 }),
        pointOfContactName: varchar("point_of_contact_name", { length: 255 }),
        email: varchar("email", { length: 255 }),
});

export const pathwayPartnerGroup = main.table("pathway_partner_group", {
        id: serial("id").primaryKey().notNull(),
        partnerId: integer("partner_id").references(() => partners.id),
        pathwayId: integer("pathway_id").references(() => pathwaysV2.id),
});

export const partnerUser = main.table("partner_user", {
        id: serial("id").primaryKey().notNull(),
        partnerId: integer("partner_id").references(() => partners.id),
        email: varchar("email", { length: 225 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
        return {
                mainPartnerUserEmailUnique: unique("main_partner_user_email_unique").on(table.email),
        }
});

export const pathwayCompletion = main.table("pathway_completion", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").notNull().references(() => users.id),
        pathwayId: integer("pathway_id").notNull().references(() => pathways.id),
},
(table) => {
        return {
                mainPathwayCompletionUserIdPathwayIdUnique: unique("main_pathway_completion_user_id_pathway_id_unique").on(table.userId, table.pathwayId),
        }
});

export const pathwayCourses = main.table("pathway_courses", {
        id: serial("id").primaryKey().notNull(),
        courseId: integer("course_id").notNull().references(() => courses.id),
        pathwayId: integer("pathway_id").notNull().references(() => pathways.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const pathwayCoursesV2 = main.table("pathway_courses_v2", {
        id: serial("id").primaryKey().notNull(),
        courseId: integer("course_id").notNull().references(() => coursesV2.id),
        pathwayId: integer("pathway_id").notNull().references(() => pathwaysV2.id),
});

export const pathwayMilestones = main.table("pathway_milestones", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 45 }).notNull(),
        description: varchar("description", { length: 5000 }).notNull(),
        pathwayId: integer("pathway_id").notNull().references(() => pathways.id),
        position: integer("position").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const pathwayTrackingFormStructure = main.table("pathway_tracking_form_structure", {
        id: serial("id").primaryKey().notNull(),
        pathwayId: integer("pathway_id").notNull().references(() => pathways.id),
        parameterId: integer("parameter_id").references(() => progressParameters.id),
        questionId: integer("question_id").references(() => progressQuestions.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const pathwayTrackingRequestDetails = main.table("pathway_tracking_request_details", {
        id: serial("id").primaryKey().notNull(),
        pathwayId: integer("pathway_id").notNull().references(() => pathways.id),
        mentorId: integer("mentor_id").notNull().references(() => users.id),
        menteeId: integer("mentee_id").notNull().references(() => users.id),
        requestId: integer("request_id").notNull().references(() => pathwayTrackingRequest.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const pathwayTrackingRequest = main.table("pathway_tracking_request", {
        id: serial("id").primaryKey().notNull(),
        pathwayId: integer("pathway_id").notNull().references(() => pathways.id),
        mentorId: integer("mentor_id").notNull().references(() => users.id),
        menteeId: integer("mentee_id").notNull().references(() => users.id),
        status: varchar("status", { length: 255 }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const pathwayTrackingRequestParameterDetails = main.table("pathway_tracking_request_parameter_details", {
        id: serial("id").primaryKey().notNull(),
        parameterId: integer("parameter_id").notNull().references(() => progressParameters.id),
        data: integer("data").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const pathwayTrackingRequestQuestionDetails = main.table("pathway_tracking_request_question_details", {
        id: serial("id").primaryKey().notNull(),
        questionId: integer("question_id").notNull().references(() => progressQuestions.id),
        data: varchar("data", { length: 255 }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const pathwaysOngoingTopic = main.table("pathways_ongoing_topic", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").notNull().references(() => users.id),
        pathwayId: integer("pathway_id").notNull().references(() => pathwaysV2.id),
        courseId: integer("course_id").notNull().references(() => coursesV2.id),
        exerciseId: integer("exercise_id").references(() => exercisesV2.id),
        assessmentId: integer("assessment_id").references(() => assessment.id),
});

export const pathwayCompletionV2 = main.table("pathway_completion_v2", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        completeAt: timestamp("complete_at", { withTimezone: true, mode: 'string' }),
        teamId: integer("team_id").references(() => c4CaTeams.id, { onDelete: "set null" } ),
        percentage: integer("percentage"),
        pathwayId: integer("pathway_id"),
});

export const progressParameters = main.table("progress_parameters", {
        id: serial("id").primaryKey().notNull(),
        type: varchar("type", { length: 10 }).notNull(),
        minRange: integer("min_range"),
        maxRange: integer("max_range"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
        name: varchar("name", { length: 20 }).notNull(),
        description: varchar("description", { length: 5000 }).notNull(),
});

export const productionVersions = main.table("production_versions", {
        id: serial("id").primaryKey().notNull(),
        courseName: varchar("course_name", { length: 255 }),
        lang: char("lang", { length: 2 }).default('en').notNull(),
        version: varchar("version", { length: 255 }),
});

export const progressQuestions = main.table("progress_questions", {
        id: serial("id").primaryKey().notNull(),
        type: varchar("type", { length: 10 }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
        name: varchar("name", { length: 20 }).notNull(),
        description: varchar("description", { length: 5000 }).notNull(),
});

export const questions = main.table("questions", {
        id: serial("id").primaryKey().notNull(),
        commonText: varchar("common_text", { length: 2000 }),
        enText: varchar("en_text", { length: 2000 }),
        hiText: varchar("hi_text", { length: 2000 }).notNull(),
        difficulty: integer("difficulty").notNull(),
        topic: varchar("topic", { length: 45 }).notNull(),
        type: integer("type").notNull(),
        createdAt: varchar("created_at", { length: 45 }).notNull(),
        maText: varchar("ma_text", { length: 2000 }),
});

export const questionAttempts = main.table("question_attempts", {
        id: serial("id").primaryKey().notNull(),
        enrolmentKeyId: integer("enrolment_key_id").notNull(),
        questionId: integer("question_id").notNull(),
        selectedOptionId: integer("selected_option_id"),
        textAnswer: varchar("text_answer", { length: 45 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const recordVersionsOfPostDeleteExercisedetails = main.table("record_versions_of_post_delete_exercisedetails", {
        id: serial("id").primaryKey().notNull(),
        courseId: integer("course_id").references(() => coursesV2.id),
        exerciseId: integer("exercise_id").references(() => exercisesV2.id),
        version: varchar("version", { length: 255 }),
        addedOrRemoved: boolean("addedOrRemoved"),
});

export const questionBuckets = main.table("question_buckets", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 100 }).notNull(),
        numQuestions: integer("num_questions").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const questionOptions = main.table("question_options", {
        id: serial("id").primaryKey().notNull(),
        text: varchar("text", { length: 2000 }).notNull(),
        questionId: integer("question_id").notNull().references(() => questions.id),
        correct: boolean("correct").notNull(),
        createdAt: varchar("created_at", { length: 45 }).notNull(),
},
(table) => {
        return {
                idx80322QuestionIdx: index("idx_80322_question_idx").on(table.questionId),
        }
});

export const questionBucketChoices = main.table("question_bucket_choices", {
        id: serial("id").primaryKey().notNull(),
        bucketId: integer("bucket_id").references(() => questionBuckets.id),
        questionIds: text("question_ids").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
        return {
                idx80307QuestionBucketChoicesBucketidForeign: index("idx_80307_question_bucket_choices_bucketid_foreign").on(table.bucketId),
        }
});

export const questionSets = main.table("question_sets", {
        id: serial("id").primaryKey().notNull(),
        questionIds: varchar("question_ids", { length: 8000 }).notNull(),
        versionId: integer("version_id").notNull().references(() => testVersions.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
        return {
                idx80331QuestionSetsVersionidForeign: index("idx_80331_question_sets_versionid_foreign").on(table.versionId),
        }
});

export const sansaarUserRoles = main.table("sansaar_user_roles", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").notNull().references(() => users.id),
        role: varchar("role", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
        return {
                mainSansaarUserRolesUserIdRoleUnique: unique("main_sansaar_user_roles_user_id_role_unique").on(table.userId, table.role),
        }
});

export const slotBooked = main.table("slot_booked", {
        id: serial("id").primaryKey().notNull(),
        interviewSlotId: integer("interview_slot_id").references(() => interviewSlot.id),
        studentId: integer("student_id").references(() => students.id),
        createdAt: date("created_at"),
});

export const scratch = main.table("scratch", {
        id: serial("id").primaryKey().notNull(),
        projectId: varchar("project_id", { length: 255 }),
        url: varchar("url", { length: 255 }).notNull(),
        userIdScratch: integer("userId_scratch"),
        projectName: varchar("project_name", { length: 255 }),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
        teamId: integer("team_id"),
},
(table) => {
        return {
                mainScratchProjectIdUnique: unique("main_scratch_project_id_unique").on(table.projectId),
        }
});

export const registrationFormData = main.table("registration_form_data", {
        id: serial("id").primaryKey().notNull(),
        partnerId: integer("partner_id").notNull().references(() => partners.id),
        formData: json("form_data"),
},
(table) => {
        return {
                mainRegistrationFormDataPartnerIdUnique: unique("main_registration_form_data_partner_id_unique").on(table.partnerId),
        }
});

export const spaceGroup = main.table("space_group", {
        id: serial("id").primaryKey().notNull(),
        groupName: varchar("group_name", { length: 255 }),
        spaceId: integer("space_id").references(() => partnerSpace.id, { onDelete: "cascade", onUpdate: "cascade" } ),
        webLink: varchar("web_link", { length: 255 }),
        androidLink: varchar("android_link", { length: 255 }),
        crcaLink: varchar("crca_link", { length: 255 }),
});

export const studentJobDetails = main.table("student_job_details", {
        id: serial("id").primaryKey().notNull(),
        studentId: integer("student_id").notNull().references(() => students.id),
        jobDesignation: varchar("job_designation", { length: 255 }),
        jobLocation: varchar("job_location", { length: 255 }),
        salary: varchar("salary", { length: 255 }),
        jobType: varchar("job_type", { length: 255 }),
        employer: varchar("employer", { length: 255 }),
        resume: varchar("resume", { length: 255 }),
        offerLetterDate: timestamp("offer_letter_date", { withTimezone: true, mode: 'string' }),
        videoLink: varchar("video_link", { length: 255 }),
        photoLink: varchar("photo_link", { length: 255 }),
        writeUp: varchar("write_up", { length: 255 }),
});

export const studentPathways = main.table("student_pathways", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").notNull().references(() => users.id),
        pathwayId: integer("pathway_id").notNull().references(() => pathways.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
        return {
                mainStudentPathwaysUserIdPathwayIdUnique: unique("main_student_pathways_user_id_pathway_id_unique").on(table.userId, table.pathwayId),
        }
});

export const registrationFormStructure = main.table("registration_form_structure", {
        id: serial("id").primaryKey().notNull(),
        partnerId: integer("partner_id").notNull().references(() => partners.id),
        formStructure: json("form_structure"),
},
(table) => {
        return {
                mainRegistrationFormStructurePartnerIdUnique: unique("main_registration_form_structure_partner_id_unique").on(table.partnerId),
        }
});

export const schoolStage = main.table("school_stage", {
        id: serial("id").primaryKey().notNull(),
        schoolId: integer("school_id").references(() => school.id),
        stageName: varchar("stageName", { length: 255 }),
        stageType: varchar("stageType", { length: 255 }),
});

export const studentDocuments = main.table("student_documents", {
        id: serial("id").primaryKey().notNull(),
        studentId: integer("student_id").notNull().references(() => students.id),
        resumeLink: varchar("Resume_link", { length: 255 }),
        idProofLink: varchar("Id_proof_link", { length: 255 }),
        signedConsentLink: varchar("signed_consent_link", { length: 255 }),
        marksheetLink: varchar("marksheet_link", { length: 255 }),
});

export const teacherCapacityBuilding = main.table("teacher_capacity_building", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id, { onDelete: "cascade" } ),
        zone: varchar("zone", { length: 255 }),
        schoolName: varchar("school_name", { length: 255 }),
        teacherName: varchar("teacher_name", { length: 255 }),
        schoolId: integer("school_id"),
        teacherId: integer("teacher_id"),
        classOfTeacher: varchar("class_of_teacher", { length: 255 }),
        email: varchar("email", { length: 255 }),
        phoneNumber: varchar("phone_number", { length: 255 }),
});

export const talkMitra = main.table("talk_mitra", {
        id: serial("id").primaryKey().notNull(),
        firstName: varchar("first_name", { length: 255 }).notNull(),
        lastName: text("last_name").notNull(),
        gender: varchar("gender", { length: 255 }).notNull(),
        country: varchar("country", { length: 255 }),
        password: varchar("password", { length: 255 }).notNull(),
        userId: varchar("user_id", { length: 255 }).notNull(),
});

export const userTokens = main.table("user_tokens", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").notNull().references(() => users.id),
        userEmail: varchar("user_email", { length: 255 }).notNull().references(() => users.email),
        accessToken: varchar("access_token", { length: 255 }).notNull(),
        refreshToken: varchar("refresh_token", { length: 255 }).notNull(),
},
(table) => {
        return {
                mainUserTokensUserIdUnique: unique("main_user_tokens_user_id_unique").on(table.userId),
                mainUserTokensUserEmailUnique: unique("main_user_tokens_user_email_unique").on(table.userEmail),
        }
});

export const userRoles = main.table("user_roles", {
        id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        userId: bigint("user_id", { mode: "number" }).references(() => users.id),
        roles: userRolesRoles("roles").default('student'),
        center: userRolesCenter("center"),
},
(table) => {
        return {
                idx50519UserRoleIbfk1Idx: index("idx_50519_user_role_ibfk_1_idx").on(table.userId),
        }
});

export const studentsSchool = main.table("students_school", {
        id: serial("id").primaryKey().notNull(),
        schoolId: integer("school_id").references(() => school.id),
        studentId: integer("student_id").references(() => students.id),
},
(table) => {
        return {
                mainStudentsSchoolStudentIdUnique: unique("main_students_school_student_id_unique").on(table.studentId),
        }
});

export const userSession = main.table("user_session", {
        id: varchar("id", { length: 255 }).primaryKey().notNull(),
});

export const testVersions = main.table("test_versions", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 45 }).notNull(),
        data: text("data").notNull(),
        current: boolean("current").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const studentsStages = main.table("students_stages", {
        id: serial("id").primaryKey().notNull(),
        studentId: integer("student_id").references(() => students.id),
        fromStage: varchar("from_stage", { length: 255 }),
        toStage: varchar("to_stage", { length: 255 }),
        createdAt: varchar("created_at", { length: 255 }),
        transitionDoneBy: varchar("transition_done_by", { length: 255 }),
});

export const usersPopularSearch = main.table("users_popular_search", {
        id: serial("id").primaryKey().notNull(),
        courseName: varchar("course_name", { length: 255 }),
        count: integer("count").default(0).notNull(),
},
(table) => {
        return {
                mainUsersPopularSearchCourseNameUnique: unique("main_users_popular_search_course_name_unique").on(table.courseName),
        }
});

export const usersSearch = main.table("users_search", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id"),
        name: varchar("name", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
});

export const vbSentences = main.table("vb_sentences", {
        id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
        sentence: varchar("sentence", { length: 255 }).notNull(),
        hTranslation: varchar("h_translation", { length: 255 }).default('').notNull(),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        dLevel: bigint("d_level", { mode: "number" }).notNull(),
});

export const vbWords = main.table("vb_words", {
        id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
        word: varchar("word", { length: 250 }).notNull(),
        eMeaning: varchar("e_meaning", { length: 250 }).default('').notNull(),
        hMeaning: varchar("h_meaning", { length: 250 }).default('').notNull(),
        wordType: varchar("word_type", { length: 5 }).default(''),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        dLevel: bigint("d_level", { mode: "number" }).notNull(),
});

export const assessmentsHistory = main.table("assessments_history", {
        id: serial("id").primaryKey().notNull(),
        slugId: integer("slug_id").notNull(),
        selectedOption: varchar("selected_option", { length: 255 }).notNull(),
        status: varchar("status", { length: 255 }).notNull(),
        attemptCount: integer("attempt_count").notNull(),
        courseId: integer("course_id").notNull(),
        userId: integer("user_id").references(() => users.id),
        teamId: integer("team_id").references(() => c4CaTeams.id),
        lang: varchar("lang", { length: 255 }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});

export const partners = main.table("partners", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 45 }),
        notes: varchar("notes", { length: 2000 }).notNull(),
        slug: varchar("slug", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
        referredBy: varchar("referred_by", { length: 255 }),
        email: varchar("email", { length: 255 }),
        districts: text("districts").array(),
        merakiLink: varchar("meraki_link", { length: 255 }),
        webLink: varchar("web_link", { length: 255 }),
        state: varchar("state", { length: 255 }),
        description: text("description"),
        logo: text("logo"),
        websiteLink: text("website_link"),
        platform: varchar("platform", { length: 255 }),
        pointOfContactName: varchar("point_of_contact_name", { length: 255 }),
        status: text("status"),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
        phoneNumber: varchar("phone_number", { length: 255 }),
},
(table) => {
        return {
                idx80292PartnerName: uniqueIndex("idx_80292_partner_name").on(table.name),
                idx80292PartnersSlugUnique: uniqueIndex("idx_80292_partners_slug_unique").on(table.slug),
        }
});

const bytea = customType<{ data: string; notNull: false; default: false }>({
        dataType() {
          return "bytea";
        },
        toDriver(val: string) {
          let newVal = val;
          if (val.startsWith("0x")) {
                newVal = val.slice(2);
          }

          return Buffer.from(newVal, "hex");
        },
        fromDriver(val: Buffer) {
          return val.toString("hex");
        },
});

export const cUsers = main.table("c_users", {
        id: serial("id").primaryKey().notNull(),
        mobile: varchar("mobile", { length: 255 }),
        userName: varchar("user_name", { length: 255 }).notNull(),
        mailId: varchar("mail_id", { length: 255 }).notNull(),
        email: varchar("email", { length: 255 }).notNull(),
        // TODO: failed to parse database type 'bytea'
        password: bytea("password"),
        profilePic: varchar("profile_pic", { length: 255 }),
        googleUserId: varchar("google_user_id", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
        partnerId: integer("partner_id").references(() => partners.id),
},
(table) => {
        return {
                idx80228UsersEmailUnique: uniqueIndex("idx_80228_users_email_unique").on(table.email),
        }
});

export const contacts = main.table("contacts", {
        id: serial("id").primaryKey().notNull(),
        studentId: integer("student_id"),
        mobile: varchar("mobile", { length: 10 }),
        isWhatsapp: boolean("is_whatsapp").default(false),
        contactType: varchar("contact_type", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
        altMobile: varchar("alt_mobile", { length: 255 }),
},
(table) => {
        return {
                idx80237StudentIdx: index("idx_80237_student_idx").on(table.studentId),
        }
});

export const incomingCalls = main.table("incoming_calls", {
        id: serial("id").primaryKey().notNull(),
        contactId: integer("contact_id").references(() => contacts.id),
        callType: varchar("call_type", { length: 15 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
        return {
                idx80265ContactIdx: index("idx_80265_contact_idx").on(table.contactId),
        }
});

export const courses = main.table("courses", {
        id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
        name: varchar("name", { length: 100 }),
        logo: varchar("logo", { length: 100 }),
        notes: varchar("notes", { length: 10000 }),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        daysToComplete: bigint("days_to_complete", { mode: "number" }),
        shortDescription: varchar("short_description", { length: 300 }),
        type: text("type").default('html').notNull(),
        courseType: varchar("course_type", { length: 255 }),
});

export const courseEnrolments = main.table("course_enrolments", {
        id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        studentId: bigint("student_id", { mode: "number" }).references(() => users.id),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        courseId: bigint("course_id", { mode: "number" }).references(() => courses.id),
        enrolledAt: timestamp("enrolled_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
        return {
                idx50433CourseEnrolmentsIbfk2Idx: index("idx_50433_course_enrolments_ibfk_2_idx").on(table.studentId),
                idx50433CourseEnrolmentsIbfk1Idx: index("idx_50433_course_enrolments_ibfk_1_idx").on(table.courseId),
                mainCourseEnrolmentsStudentIdCourseIdUnique: unique("main_course_enrolments_student_id_course_id_unique").on(table.studentId, table.courseId),
        }
});

export const users = main.table("users", {
        id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
        email: varchar("email", { length: 50 }).default('').notNull(),
        name: varchar("name", { length: 250 }).default('').notNull(),
        profilePicture: varchar("profile_picture", { length: 250 }),
        googleUserId: varchar("google_user_id", { length: 250 }),
        center: usersCenter("center"),
        githubLink: varchar("github_link", { length: 145 }),
        linkedinLink: varchar("linkedin_link", { length: 145 }),
        mediumLink: varchar("medium_link", { length: 145 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
        chatId: varchar("chat_id", { length: 255 }),
        chatPassword: varchar("chat_password", { length: 32 }),
        partnerId: integer("partner_id").references(() => partners.id),
        lang1: char("lang_1", { length: 2 }),
        lang2: char("lang_2", { length: 2 }),
        mode: varchar("mode", { length: 255 }),
        contact: varchar("contact", { length: 255 }),
        lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
        groupId: integer("group_id").references(() => spaceGroup.id, { onDelete: "set null" } ),
        spaceId: integer("space_id").references(() => partnerSpace.id, { onDelete: "cascade", onUpdate: "cascade" } ),
        c4CaPartnerId: integer("c4ca_partner_id").references(() => c4CaPartners.id, { onDelete: "set null" } ),
        c4CaFacilitatorId: integer("c4ca_facilitator_id").references(() => facilitators.id, { onDelete: "set null" } ),
},
(table) => {
        return {
                idx50526GoogleUserId: uniqueIndex("idx_50526_google_user_id").on(table.googleUserId),
        }
});

export const courseRelation = main.table("course_relation", {
        id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        courseId: bigint("course_id", { mode: "number" }).references(() => courses.id),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        reliesOn: bigint("relies_on", { mode: "number" }).references(() => courses.id),
},
(table) => {
        return {
                idx50441CourseRelationIbfk1: index("idx_50441_course_relation_ibfk_1").on(table.courseId),
                idx50441CourseRelationIbfk2: index("idx_50441_course_relation_ibfk_2").on(table.reliesOn),
        }
});

export const enrolmentKeys = main.table("enrolment_keys", {
        id: serial("id").primaryKey().notNull(),
        key: varchar("key", { length: 6 }),
        studentId: integer("student_id").references(() => students.id),
        startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
        endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
        totalMarks: varchar("total_marks", { length: 45 }),
        typeOfTest: varchar("type_of_test", { length: 255 }),
        questionSetId: integer("question_set_id").references(() => questionSets.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
        return {
                idx80250KeyUnique: uniqueIndex("idx_80250_key__unique").on(table.key),
                idx80250StudentIdx: index("idx_80250_student_idx").on(table.studentId),
                idx80250EnrolmentKeysQuestionsetidForeign: index("idx_80250_enrolment_keys_questionsetid_foreign").on(table.questionSetId),
        }
});

export const exercises = main.table("exercises", {
        id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        parentExerciseId: bigint("parent_exercise_id", { mode: "number" }),
        // You can use { mode: "bigint" } if numbers are exceeding js number limitations
        courseId: bigint("course_id", { mode: "number" }).notNull().references(() => courses.id),
        name: varchar("name", { length: 300 }).default('').notNull(),
        slug: varchar("slug", { length: 100 }).default('').notNull(),
        sequenceNum: doublePrecision("sequence_num"),
        reviewType: exercisesReviewType("review_type").default('manual'),
        content: text("content"),
        submissionType: exercisesSubmissionType("submission_type"),
        githubLink: varchar("github_link", { length: 300 }),
        solution: text("solution"),
},
(table) => {
        return {
                idx50457CourseId: index("idx_50457_course_id").on(table.courseId),
                idx50457SlugUnique: uniqueIndex("idx_50457_slug__unique").on(table.slug),
        }
});

export const students = main.table("students", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 300 }),
        gender: integer("gender"),
        dob: timestamp("dob", { withTimezone: true, mode: 'string' }),
        email: varchar("email", { length: 150 }),
        state: varchar("state", { length: 2 }),
        city: varchar("city", { length: 45 }),
        gpsLat: varchar("gps_lat", { length: 45 }),
        gpsLong: varchar("gps_long", { length: 45 }),
        pinCode: varchar("pin_code", { length: 10 }),
        qualification: integer("qualification"),
        currentStatus: integer("current_status"),
        schoolMedium: integer("school_medium"),
        religon: integer("religon"),
        caste: integer("caste"),
        percentageIn10Th: varchar("percentage_in10th", { length: 255 }),
        mathMarksIn10Th: integer("math_marks_in10th"),
        percentageIn12Th: varchar("percentage_in12th", { length: 255 }),
        mathMarksIn12Th: integer("math_marks_in12th"),
        stage: varchar("stage", { length: 45 }).notNull(),
        tag: varchar("tag", { length: 255 }),
        partnerId: integer("partner_id").references(() => partners.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
        lastUpdated: timestamp("last_updated", { withTimezone: true, mode: 'string' }),
        district: varchar("district", { length: 255 }),
        currentOwnerId: integer("current_owner_id").references(() => interviewOwners.id),
        partnerRefer: varchar("partner_refer", { length: 255 }),
        evaluation: varchar("evaluation", { length: 255 }),
        redflag: varchar("redflag", { length: 255 }),
        imageUrl: text("image_url"),
        otherActivities: varchar("other_activities", { length: 255 }),
        campusStatus: varchar("campus_status", { length: 255 }),
        schoolStageId: integer("school_stage_id").references(() => schoolStage.id),
},
(table) => {
        return {
                idx80358StudentsPartneridForeign: index("idx_80358_students_partnerid_foreign").on(table.partnerId),
        }
});

export const coursesV2 = main.table("courses_v2", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        logo: varchar("logo", { length: 255 }),
        shortDescription: varchar("short_description", { length: 255 }),
        langAvailable: text("lang_available").array(),
});

export const assessment = main.table("assessment", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        content: text("content"),
        courseId: integer("course_id").references(() => coursesV2.id),
        exerciseId: integer("exercise_id").references(() => exercisesV2.id),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
        return {
                mainAssessmentNameUnique: unique("main_assessment_name_unique").on(table.name),
        }
});

export const exercisesV2 = main.table("exercises_v2", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        description: varchar("description", { length: 255 }),
        courseId: integer("course_id").references(() => coursesV2.id),
        content: text("content"),
        type: varchar("type", { length: 255 }),
        sequenceNum: doublePrecision("sequence_num"),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});

export const classesToCourses = main.table("classes_to_courses", {
        id: serial("id").primaryKey().notNull(),
        classId: integer("class_id").references(() => classes.id),
        pathwayV1: integer("pathway_v1").references(() => pathways.id),
        courseV1: integer("course_v1").references(() => courses.id),
        exerciseV1: integer("exercise_v1").references(() => exercises.id),
        pathwayV2: integer("pathway_v2").references(() => pathwaysV2.id),
        courseV2: integer("course_v2").references(() => coursesV2.id),
        exerciseV2: integer("exercise_v2").references(() => exercisesV2.id),
        pathwayV3: integer("pathway_v3"),
        courseV3: integer("course_v3"),
        exerciseV3: integer("exercise_v3"),
        slugId: integer("slug_id"),
});

export const c4CaRoles = main.table("c4ca_roles", {
        id: serial("id").primaryKey().notNull(),
        role: varchar("role", { length: 255 }).notNull(),
        userId: integer("user_id").notNull().references(() => users.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
});

export const c4CaPartners = main.table("c4ca_partners", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        pointOfContact: varchar("point_of_contact", { length: 255 }),
        email: varchar("email", { length: 255 }).notNull(),
        phoneNumber: varchar("phone_number", { length: 255 }),
        status: varchar("status", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
});

export const campus = main.table("campus", {
        id: serial("id").primaryKey().notNull(),
        campus: varchar("campus", { length: 225 }),
        address: varchar("address", { length: 255 }),
});

export const campusSchool = main.table("campus_school", {
        id: serial("id").primaryKey().notNull(),
        campusId: integer("campus_id").references(() => campus.id),
        schoolId: integer("school_id").references(() => school.id),
        capacityofschool: integer("capacityofschool"),
},
(table) => {
        return {
                mainCampusSchoolCampusIdSchoolIdUnique: unique("main_campus_school_campus_id_school_id_unique").on(table.campusId, table.schoolId),
        }
});

export const school = main.table("school", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 255 }),
});

export const studentCampus = main.table("student_campus", {
        id: serial("id").primaryKey().notNull(),
        studentId: integer("student_id").references(() => students.id),
        campusId: integer("campus_id").references(() => campus.id),
});

export const chanakyaUserRoles = main.table("chanakya_user_roles", {
        id: serial("id").primaryKey().notNull(),
        chanakyaUserEmailId: integer("chanakya_user_email_id").notNull(),
        roles: integer("roles").references(() => chanakyaRoles.id),
        privilege: integer("privilege").references(() => chanakyaPrivilege.id),
});

export const chanakyaAccess = main.table("chanakya_access", {
        id: serial("id").primaryKey().notNull(),
        userRoleId: integer("user_role_id").references(() => chanakyaUserRoles.id),
        access: integer("access").notNull(),
},
(table) => {
        return {
                mainChanakyaAccessUserRoleIdAccessUnique: unique("main_chanakya_access_user_role_id_access_unique").on(table.userRoleId, table.access),
        }
});

export const chanakyaPartnerGroup = main.table("chanakya_partner_group", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 255 }),
});

export const chanakyaPartnerRelationship = main.table("chanakya_partner_relationship", {
        id: serial("id").primaryKey().notNull(),
        partnerId: integer("partner_id").notNull().references(() => partners.id),
        partnerGroupId: integer("partner_group_id").notNull().references(() => chanakyaPartnerGroup.id),
});

export const chanakyaPrivilege = main.table("chanakya_privilege", {
        id: serial("id").primaryKey().notNull(),
        privilege: varchar("privilege", { length: 225 }).notNull(),
        description: varchar("description", { length: 225 }).notNull(),
},
(table) => {
        return {
                mainChanakyaPrivilegePrivilegeUnique: unique("main_chanakya_privilege_privilege_unique").on(table.privilege),
                mainChanakyaPrivilegeDescriptionUnique: unique("main_chanakya_privilege_description_unique").on(table.description),
        }
});

export const chanakyaRoles = main.table("chanakya_roles", {
        id: serial("id").primaryKey().notNull(),
        roles: varchar("roles", { length: 225 }).notNull(),
        description: varchar("description", { length: 225 }).notNull(),
},
(table) => {
        return {
                mainChanakyaRolesRolesUnique: unique("main_chanakya_roles_roles_unique").on(table.roles),
                mainChanakyaRolesDescriptionUnique: unique("main_chanakya_roles_description_unique").on(table.description),
        }
});

export const classes = main.table("classes", {
        id: serial("id").primaryKey().notNull(),
        title: varchar("title", { length: 255 }),
        description: varchar("description", { length: 555 }),
        facilitatorId: integer("facilitator_id"),
        startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }).notNull(),
        endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }).notNull(),
        categoryId: integer("category_id").notNull().references(() => category.id),
        videoId: varchar("video_id", { length: 45 }),
        lang: char("lang", { length: 2 }).default('hi').notNull(),
        type: varchar("type", { length: 255 }).notNull(),
        meetLink: varchar("meet_link", { length: 255 }),
        calendarEventId: varchar("calendar_event_id", { length: 255 }),
        facilitatorName: varchar("facilitator_name", { length: 80 }),
        facilitatorEmail: varchar("facilitator_email", { length: 120 }),
        materialLink: varchar("material_link", { length: 255 }),
        maxEnrolment: integer("max_enrolment"),
        recurringId: integer("recurring_id").references(() => recurringClasses.id),
        subTitle: varchar("sub_title", { length: 255 }),
        courseVersion: varchar("course_version", { length: 255 }),
        volunteerId: integer("volunteer_id").references(() => volunteer.id),
});

export const classRegistrations = main.table("class_registrations", {
        id: serial("id").primaryKey().notNull(),
        classId: integer("class_id").notNull().references(() => classes.id),
        userId: integer("user_id").notNull().references(() => users.id),
        registeredAt: timestamp("registered_at", { withTimezone: true, mode: 'string' }).notNull(),
        feedback: varchar("feedback", { length: 1000 }),
        feedbackAt: timestamp("feedback_at", { withTimezone: true, mode: 'string' }),
        googleRegistrationStatus: boolean("google_registration_status"),
},
(table) => {
        return {
                mainClassRegistrationsUserIdClassIdUnique: unique("main_class_registrations_user_id_class_id_unique").on(table.classId, table.userId),
        }
});

export const category = main.table("category", {
        id: serial("id").primaryKey().notNull(),
        categoryName: varchar("category_name", { length: 100 }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const classesMail = main.table("classes_mail", {
        id: serial("id").primaryKey().notNull(),
        classId: integer("class_id").references(() => classes.id),
        facilitatorEmail: varchar("facilitator_email", { length: 80 }).notNull(),
        status: varchar("status", { length: 50 }),
        type: varchar("type", { length: 255 }).notNull(),
});

export const recurringClasses = main.table("recurring_classes", {
        id: serial("id").primaryKey().notNull(),
        frequency: varchar("frequency", { length: 255 }).notNull(),
        occurrence: integer("occurrence"),
        until: date("until"),
        onDays: varchar("on_days", { length: 255 }),
        calendarEventId: varchar("calendar_event_id", { length: 255 }),
        cohortRoomId: varchar("cohort_room_id", { length: 255 }),
});

export const pathways = main.table("pathways", {
        id: serial("id").primaryKey().notNull(),
        code: varchar("code", { length: 6 }).notNull(),
        name: varchar("name", { length: 45 }).notNull(),
        description: varchar("description", { length: 5000 }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
        trackingEnabled: boolean("tracking_enabled").default(false).notNull(),
        trackingFrequency: varchar("tracking_frequency", { length: 255 }),
        trackingDayOfWeek: integer("tracking_day_of_week"),
        trackingDaysLockBeforeCycle: integer("tracking_days_lock_before_cycle"),
        logo: varchar("logo", { length: 255 }),
},
(table) => {
        return {
                mainPathwaysCodeUnique: unique("main_pathways_code_unique").on(table.code),
        }
});

export const pathwaysV2 = main.table("pathways_v2", {
        id: serial("id").primaryKey().notNull(),
        code: varchar("code", { length: 6 }).notNull(),
        name: varchar("name", { length: 100 }).notNull(),
        logo: varchar("logo", { length: 255 }),
        description: varchar("description", { length: 5000 }).notNull(),
},
(table) => {
        return {
                mainPathwaysV2CodeUnique: unique("main_pathways_v2_code_unique").on(table.code),
        }
});

export const volunteer = main.table("volunteer", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        hoursPerWeek: integer("hours_per_week"),
        availableOnDays: varchar("available_on_days", { length: 255 }),
        availableOnTime: varchar("available_on_time", { length: 255 }),
        status: varchar("status", { length: 255 }),
        manualStatus: varchar("manual_status", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
        pathwayId: integer("pathway_id"),
});

export const courseCategories = main.table("course_categories", {
        id: serial("id").primaryKey().notNull(),
        courseId: integer("course_id").notNull().references(() => courses.id),
        categoryId: integer("category_id").notNull().references(() => category.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const courseCompletion = main.table("course_completion", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").notNull().references(() => users.id),
        courseId: integer("course_id").notNull().references(() => courses.id),
},
(table) => {
        return {
                mainCourseCompletionUserIdCourseIdUnique: unique("main_course_completion_user_id_course_id_unique").on(table.userId, table.courseId),
        }
});

export const courseCompletionV2 = main.table("course_completion_v2", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").notNull().references(() => users.id),
        courseId: integer("course_id").notNull().references(() => coursesV2.id),
        completeAt: timestamp("complete_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
        return {
                mainCourseCompletionV2CourseIdUnique: unique("main_course_completion_v2_course_id_unique").on(table.courseId),
        }
});

export const courseEditorStatus = main.table("course_editor_status", {
        id: serial("id").primaryKey().notNull(),
        courseId: integer("course_id").references(() => coursesV2.id),
        courseStates: varchar("course_states", { length: 255 }),
        stateChangedate: timestamp("stateChangedate", { withTimezone: true, mode: 'string' }),
        contentEditorsUserId: integer("content_editors_user_id").references(() => users.id),
});

export const courseProductionVersions = main.table("course_production_versions", {
        id: serial("id").primaryKey().notNull(),
        courseId: integer("course_id").references(() => coursesV2.id),
        lang: char("lang", { length: 2 }).default('en').notNull(),
        version: varchar("version", { length: 255 }),
});

export const dashboardFlags = main.table("dashboard_flags", {
        id: serial("id").primaryKey().notNull(),
        studentId: integer("student_id").notNull().references(() => students.id),
        flag: varchar("flag", { length: 255 }),
        createdAt: timestamp("createdAt", { withTimezone: true, mode: 'string' }),
});

export const emailReport = main.table("email_report", {
        id: serial("id").primaryKey().notNull(),
        partnerId: integer("partner_id").notNull().references(() => partners.id),
        report: varchar("report", { length: 255 }),
        status: boolean("status"),
        emails: text("emails").array(),
        repeat: varchar("repeat", { length: 255 }),
},
(table) => {
        return {
                mainEmailReportPartnerIdUnique: unique("main_email_report_partner_id_unique").on(table.partnerId),
        }
});

export const session = main.table("session", {
        id: serial("id").primaryKey().notNull(),
        sessionName: varchar("session_name", { length: 255 }),
        startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
        endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
        durations: integer("durations"),
        userId: integer("user_id").notNull().references(() => userHack.id),
});

export const events = main.table("events", {
        id: serial("id").primaryKey().notNull(),
        eventName: varchar("event_name", { length: 255 }),
        startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
        endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
        durations: integer("durations"),
        viewPageId: integer("view_page_id").notNull().references(() => viewPage.id),
        sessionId: integer("session_id").notNull().references(() => session.id),
        userId: integer("user_id").notNull().references(() => userHack.id),
});

export const userHack = main.table("user_hack", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        email: varchar("email", { length: 255 }).notNull(),
});

export const viewPage = main.table("view_page", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").notNull().references(() => userHack.id),
        durations: integer("durations").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        pageUrl: varchar("page_url", { length: 255 }),
        pageTitle: varchar("page_title", { length: 255 }),
        startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
        endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
});

export const exerciseCompletion = main.table("exercise_completion", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").notNull().references(() => users.id),
        exerciseId: integer("exercise_id").notNull().references(() => exercises.id),
},
(table) => {
        return {
                mainExerciseCompletionUserIdExerciseIdUnique: unique("main_exercise_completion_user_id_exercise_id_unique").on(table.userId, table.exerciseId),
        }
});

export const c4CaTeamProjectsubmitSolution = main.table("c4ca_team_projectsubmit_solution", {
        id: serial("id").primaryKey().notNull(),
        projectLink: varchar("project_link", { length: 255 }),
        projectFileUrl: varchar("project_file_url", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
        teamId: integer("team_id").notNull().references(() => c4CaTeams.id, { onDelete: "cascade", onUpdate: "cascade" } ),
        teamName: varchar("team_name", { length: 255 }).notNull(),
        isSubmitted: boolean("is_submitted"),
        unlockedAt: timestamp("unlocked_at", { withTimezone: true, mode: 'string' }),
        moduleId: integer("module_id").notNull(),
        projectFileName: varchar("project_file_name", { length: 255 }),
});

export const facilitators = main.table("facilitators", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        pointOfContact: varchar("point_of_contact", { length: 255 }),
        email: varchar("email", { length: 255 }).notNull(),
        webLink: varchar("web_link", { length: 255 }),
        phoneNumber: varchar("phone_number", { length: 255 }).notNull(),
        c4CaPartnerId: integer("c4ca_partner_id").references(() => c4CaPartners.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
});

export const interviewOwners = main.table("interview_owners", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").notNull().references(() => cUsers.id),
        available: boolean("available"),
        maxLimit: integer("max_limit").default(10),
        type: text("type").array(),
        pendingInterviewCount: integer("pending_interview_count"),
        gender: integer("gender"),
},
(table) => {
        return {
                mainInterviewOwnersUserIdUnique: unique("main_interview_owners_user_id_unique").on(table.userId),
        }
});

export const interviewSlot = main.table("interview_slot", {
        id: serial("id").primaryKey().notNull(),
        ownerId: integer("owner_id").references(() => interviewOwners.id),
        studentId: integer("student_id").notNull().references(() => students.id),
        studentName: varchar("student_name", { length: 255 }),
        transitionId: integer("transition_id").references(() => stageTransitions.id),
        topicName: varchar("topic_name", { length: 255 }).notNull(),
        startTime: varchar("start_time", { length: 255 }).notNull(),
        endTime: varchar("end_time", { length: 255 }),
        endTimeExpected: varchar("end_time_expected", { length: 255 }).notNull(),
        onDate: timestamp("on_date", { withTimezone: true, mode: 'string' }).notNull(),
        duration: varchar("duration", { length: 255 }),
        status: varchar("status", { length: 255 }).notNull(),
        isCancelled: boolean("is_cancelled").default(false),
        cancelltionReason: varchar("cancelltion_reason", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});

export const stageTransitions = main.table("stage_transitions", {
        id: serial("id").primaryKey().notNull(),
        studentId: integer("student_id").references(() => students.id),
        fromStage: varchar("from_stage", { length: 255 }),
        toStage: varchar("to_stage", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
        transitionDoneBy: varchar("transition_done_by", { length: 255 }),
        school: varchar("school", { length: 255 }),
},
(table) => {
        return {
                idx80349StageTransitionsStudentidForeign: index("idx_80349_stage_transitions_studentid_foreign").on(table.studentId),
        }
});

export const c4CaTeamProjecttopic = main.table("c4ca_team_projecttopic", {
        id: serial("id").primaryKey().notNull(),
        projectTitle: varchar("project_title", { length: 255 }),
        projectSummary: varchar("project_summary", { length: 255 }),
        projectTopicUrl: varchar("project_topic_url", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
        teamId: integer("team_id").notNull().references(() => c4CaTeams.id, { onDelete: "cascade", onUpdate: "cascade" } ),
        teamName: varchar("team_name", { length: 255 }).notNull(),
        isSubmitted: boolean("is_submitted"),
        unlockedAt: timestamp("unlocked_at", { withTimezone: true, mode: 'string' }),
        moduleId: integer("module_id").notNull(),
        projectTopicFileName: varchar("projectTopic_file_name", { length: 255 }),
});

export const mentorTree = main.table("mentor_tree", {
        id: serial("id").primaryKey().notNull(),
        mentorId: integer("mentor_id").notNull().references(() => users.id),
        menteeId: integer("mentee_id").notNull().references(() => users.id),
        pathwayId: integer("pathway_id").notNull().references(() => pathways.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
        return {
                mainMentorTreeMentorIdMenteeIdUnique: unique("main_mentor_tree_mentor_id_mentee_id_unique").on(table.mentorId, table.menteeId),
        }
});

export const c4CaTeachers = main.table("c4ca_teachers", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        school: varchar("school", { length: 255 }),
        district: varchar("district", { length: 255 }),
        state: varchar("state", { length: 255 }),
        phoneNumber: varchar("phone_number", { length: 255 }),
        email: varchar("email", { length: 255 }).notNull(),
        userId: integer("user_id").notNull().references(() => users.id),
        profileUrl: varchar("profile_url", { length: 255 }),
        facilitatorId: integer("facilitator_id"),
        profileLink: varchar("profile_link", { length: 255 }),
        c4CaPartnerId: integer("c4ca_partner_id").references(() => c4CaPartners.id, { onDelete: "set null" } ),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
});

export const c4CaStudents = main.table("c4ca_students", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        class: integer("class").notNull(),
        teacherId: integer("teacher_id").notNull().references(() => c4CaTeachers.id),
        teamId: integer("team_id").notNull().references(() => c4CaTeams.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
});

export const c4CaStudentsProjectDetail = main.table("c4ca_students_projectDetail", {
        id: serial("id").primaryKey().notNull(),
        projectTitle: varchar("project_title", { length: 255 }),
        projectSummary: varchar("project_summary", { length: 255 }),
        projectUploadFileUrl: varchar("project_uploadFile_url", { length: 255 }).notNull(),
        startedDate: date("Started_date"),
        teacherId: integer("teacher_id").notNull().references(() => c4CaTeachers.id),
        teamId: integer("team_id").notNull().references(() => c4CaTeams.id),
});

export const c4CaTeams = main.table("c4ca_teams", {
        id: serial("id").primaryKey().notNull(),
        teamName: varchar("team_name", { length: 255 }).notNull(),
        teamSize: integer("team_size").notNull(),
        teacherId: integer("teacher_id").notNull().references(() => c4CaTeachers.id),
        loginId: varchar("login_id", { length: 255 }).notNull(),
        password: varchar("password", { length: 255 }).notNull(),
        lastLogin: timestamp("last_login", { withTimezone: true, mode: 'string' }),
        state: varchar("state", { length: 255 }),
        district: varchar("district", { length: 255 }),
        school: varchar("school", { length: 255 }),
},
(table) => {
        return {
                mainC4CaTeamsTeamNameUnique: unique("main_c4ca_teams_team_name_unique").on(table.teamName),
        }
});

export const assessmentOutcome = main.table("assessment_outcome", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        assessmentId: integer("assessment_id").notNull(),
        status: varchar("status", { length: 255 }).notNull(),
        selectedOption: integer("selected_option"),
        attemptCount: integer("attempt_count").notNull(),
        teamId: integer("team_id").references(() => c4CaTeams.id, { onDelete: "set null" } ),
        selectedMultipleOption: varchar("selected_multiple_option", { length: 255 }),
});

export const assessmentResult = main.table("assessment_result", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        assessmentId: integer("assessment_id").notNull().references(() => assessment.id),
        status: varchar("status", { length: 255 }).notNull(),
        selectedOption: integer("selected_option").notNull(),
        attemptCount: integer("attempt_count").default(1).notNull(),
        teamId: integer("team_id").references(() => c4CaTeams.id, { onDelete: "set null" } ),
});

export const courseCompletionV3 = main.table("course_completion_v3", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        courseId: integer("course_id").notNull(),
        completeAt: timestamp("complete_at", { withTimezone: true, mode: 'string' }),
        teamId: integer("team_id").references(() => c4CaTeams.id, { onDelete: "set null" } ),
        percentage: integer("percentage"),
});

export const learningTrackStatus = main.table("learning_track_status", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        pathwayId: integer("pathway_id"),
        courseId: integer("course_id"),
        exerciseId: integer("exercise_id").notNull().references(() => exercisesV2.id),
        teamId: integer("team_id").references(() => c4CaTeams.id, { onDelete: "set null" } ),
});

export const learningTrackStatusOutcome = main.table("learning_track_status_outcome", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        pathwayId: integer("pathway_id"),
        courseId: integer("course_id"),
        exerciseId: integer("exercise_id"),
        teamId: integer("team_id").references(() => c4CaTeams.id, { onDelete: "set null" } ),
        moduleId: integer("module_id"),
});

export const youtubeBroadcast = main.table("youtube_broadcast", {
        id: serial("id").primaryKey().notNull(),
        videoId: varchar("video_id", { length: 255 }).notNull(),
        classId: integer("class_id"),
        recurringId: integer("recurring_id"),
});

export const exercisesHistory = main.table("exercises_history", {
        id: serial("id").primaryKey().notNull(),
        slugId: integer("slug_id").notNull(),
        courseId: integer("course_id").notNull(),
        lang: varchar("lang", { length: 255 }).notNull(),
        userId: integer("user_id").references(() => users.id),
        teamId: integer("team_id").references(() => c4CaTeams.id),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});

export const exerciseCompletionV2 = main.table("exercise_completion_v2", {
        id: serial("id").primaryKey().notNull(),
        userId: integer("user_id").references(() => users.id),
        completeAt: timestamp("complete_at", { withTimezone: true, mode: 'string' }),
        exerciseId: integer("exercise_id"),
        teamId: integer("team_id").references(() => c4CaTeams.id, { onDelete: "set null" } ),
        slugId: integer("slug_id"),
        courseId: integer("course_id"),
        lang: varchar("lang", { length: 255 }),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const scratchSample = main.table("scratch_sample", {
        id: serial("id").primaryKey().notNull(),
        projectId: varchar("project_id", { length: 255 }).notNull(),
        url: varchar("url", { length: 255 }).notNull(),
        projectName: varchar("project_name", { length: 255 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const developersResume = main.table("developers_resume", {
        id: serial("id").primaryKey().notNull(),
        name: varchar("name", { length: 255 }),
        email: varchar("email", { length: 255 }),
        password: varchar("password", { length: 255 }),
        role: varchar("role", { length: 255 }),
        education: varchar("education", { length: 255 }),
        intrests: varchar("intrests", { length: 255 }),
        skills: varchar("skills", { length: 255 }),
        experience: varchar("experience", { length: 255 }),
        programmingLanguages: varchar("programming_languages", { length: 255 }),
        resonalLanguage: varchar("resonal_language", { length: 255 }),
        knownFramworks: varchar("known_framworks", { length: 255 }),
        learningPlan: varchar("learning_plan", { length: 255 }),
},
(table) => {
        return {
                mainDevelopersResumeEmailUnique: unique("main_developers_resume_email_unique").on(table.email),
        }
});

export const classesGoogleMeetLink= main.table("zuvy_classes_google_meet_link",{
	id: serial("id").primaryKey().notNull(),
	hangoutLink:text("hangout_link").notNull(),
	creator:text("creator").notNull(),
	startTime:text("start_time").notNull(),
	endTime:text("end_time").notNull(),
	batchId:text("batch_id").notNull(),
	bootcampId:text("bootcamp_id").notNull(),
	title:text("title").notNull(),
        attendees:text("attendees").array()
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
        assignmentId: integer("assignment_id").notNull(),
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
