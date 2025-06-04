import { pgTable,customType, pgSchema, varchar, serial, integer, timestamp, text, unique, uniqueIndex, foreignKey, bigserial, bigint, date, boolean, numeric, char, index, jsonb, doublePrecision, json } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"

export const main = pgSchema("main");
export const action = main.enum("action", ['submit', 'run'])
export const courseEnrolmentsCourseStatus = main.enum("course_enrolments_course_status", ['enroll', 'unenroll', 'completed'])
export const coursesType = main.enum("courses_type", ['html', 'js', 'python'])
export const difficulty = main.enum("difficulty", ['Easy', 'Medium', 'Hard'])
export const exercisesReviewType = main.enum("exercises_review_type", ['manual', 'peer', 'facilitator', 'automatic'])
export const exercisesSubmissionType = main.enum("exercises_submission_type", ['number', 'text', 'text_large', 'attachments', 'url'])
export const submissionsState = main.enum("submissions_state", ['completed', 'pending', 'rejected'])
export const userRolesCenter = main.enum("user_roles_center", ['dharamshala', 'banagalore', 'all'])
export const userRolesRoles = main.enum("user_roles_roles", ['admin', 'alumni', 'student', 'facilitator'])
export const usersCenter = main.enum("users_center", ['dharamshala', 'bangalore'])

const bytea = customType<{ data: string; notNull: false; default: false }>({
  dataType() {
    return 'bytea';
  },
  toDriver(val: string) {
    let newVal = val;
    if (val.startsWith('0x')) {
      newVal = val.slice(2);
    }

    return Buffer.from(newVal, 'hex');
  },
  fromDriver(val: Buffer) {
    return val.toString('hex');
  },
});


export const userSession = main.table("user_session", {
	id: varchar("id", { length: 255 }).primaryKey().notNull(),
});

export const merakiStudents = main.table("meraki_students", {
	id: serial("id").primaryKey().notNull(),
	userName: varchar("user_name", { length: 255 }).notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	password: varchar("password", { length: 255 }).notNull(),
	partnerId: integer("partner_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
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

export const chanakyaUserEmail = main.table("chanakya_user_email", {
	id: serial("id").primaryKey().notNull(),
	email: varchar("email", { length: 255 }).notNull(),
},
(table) => {
	return {
		mainChanakyaUserEmailEmailUnique: unique("main_chanakya_user_email_email_unique").on(table.email),
	}
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
	partnerId: integer("partner_id"),
},
(table) => {
	return {
		idx80228UsersEmailUnique: uniqueIndex("idx_80228_users_email_unique").using("btree", table.email.asc().nullsLast()),
		cUsersPartnerIdPartnersIdFk: foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "c_users_partner_id_partners_id_fk"
		}),
	}
});

export const viewPage = main.table("view_page", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	durations: integer("durations").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	pageUrl: varchar("page_url", { length: 255 }),
	pageTitle: varchar("page_title", { length: 255 }),
	startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
	endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
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

export const school = main.table("school", {
	id: serial("id").primaryKey().notNull(),
	name: varchar("name", { length: 255 }),
});

export const dailyMetrics = main.table("daily_metrics", {
	id: serial("id").primaryKey().notNull(),
	metricName: varchar("metric_name", { length: 255 }),
	value: integer("value"),
	date: date("date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	gender: integer("gender"),
});

export const studentsSchool = main.table("students_school", {
	id: serial("id").primaryKey().notNull(),
	schoolId: integer("school_id"),
	studentId: integer("student_id"),
},
(table) => {
	return {
		studentsSchoolSchoolIdSchoolIdFk: foreignKey({
			columns: [table.schoolId],
			foreignColumns: [school.id],
			name: "students_school_school_id_school_id_fk"
		}),
		studentsSchoolStudentIdStudentsIdFk: foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "students_school_student_id_students_id_fk"
		}),
		mainStudentsSchoolStudentIdUnique: unique("main_students_school_student_id_unique").on(table.studentId),
	}
});

export const donor = main.table("donor", {
	id: serial("id").primaryKey().notNull(),
	donor: varchar("donor", { length: 225 }),
});

export const zuvyAssessmentSubmission = main.table("zuvy_assessment_submission", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	marks: integer("marks"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	submitedAt: timestamp("submited_at", { withTimezone: true, mode: 'string' }),
	assessmentOutsourseId: integer("assessment_outsourse_id").notNull(),
	copyPaste: integer("copy_paste"),
	embeddedGoogleSearch: integer("embedded_google_search"),
	tabChange: integer("tab_change"),
	codingQuestionCount: integer("coding_question_count"),
	mcqQuestionCount: integer("mcq_question_count"),
	openEndedQuestionCount: integer("open_ended_question_count"),
	attemptedCodingQuestions: integer("attempted_coding_questions"),
	attemptedMcqQuestions: integer("attempted_mcq_questions"),
	attemptedOpenEndedQuestions: integer("attempted_open_ended_questions"),
	isPassed: boolean("is_passed"),
	codingScore: integer("coding_score"),
	openEndedScore: integer("open_ended_score"),
	mcqScore: integer("mcq_score"),
	requiredCodingScore: integer("required_coding_score"),
	requiredOpenEndedScore: integer("required_open_ended_score"),
	requiredMcqScore: integer("required_mcq_score"),
	typeOfSubmission: varchar("type_of_submission", { length: 255 }),
	percentage: numeric("percentage"),
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

export const schoolStage = main.table("school_stage", {
	id: serial("id").primaryKey().notNull(),
	schoolId: integer("school_id"),
	stageName: varchar("stageName", { length: 255 }),
	stageType: varchar("stageType", { length: 255 }),
},
(table) => {
	return {
		schoolStageSchoolIdSchoolIdFk: foreignKey({
			columns: [table.schoolId],
			foreignColumns: [school.id],
			name: "school_stage_school_id_school_id_fk"
		}),
	}
});

export const migrations = main.table("migrations", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	runOn: timestamp("run_on", { withTimezone: true, mode: 'string' }).notNull(),
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

export const campusSchool = main.table("campus_school", {
	id: serial("id").primaryKey().notNull(),
	campusId: integer("campus_id"),
	schoolId: integer("school_id"),
	capacityofschool: integer("capacityofschool"),
},
(table) => {
	return {
		campusSchoolCampusIdCampusIdFk: foreignKey({
			columns: [table.campusId],
			foreignColumns: [campus.id],
			name: "campus_school_campus_id_campus_id_fk"
		}),
		campusSchoolSchoolIdSchoolIdFk: foreignKey({
			columns: [table.schoolId],
			foreignColumns: [school.id],
			name: "campus_school_school_id_school_id_fk"
		}),
		mainCampusSchoolCampusIdSchoolIdUnique: unique("main_campus_school_campus_id_school_id_unique").on(table.campusId, table.schoolId),
	}
});

export const studentsStages = main.table("students_stages", {
	id: serial("id").primaryKey().notNull(),
	studentId: integer("student_id"),
	fromStage: varchar("from_stage", { length: 255 }),
	toStage: varchar("to_stage", { length: 255 }),
	createdAt: varchar("created_at", { length: 255 }),
	transitionDoneBy: varchar("transition_done_by", { length: 255 }),
},
(table) => {
	return {
		studentsStagesStudentIdStudentsIdFk: foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "students_stages_student_id_students_id_fk"
		}),
	}
});

export const zuvyAssignmentSubmission = main.table("zuvy_assignment_submission", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	moduleId: integer("module_id").notNull(),
	bootcampId: integer("bootcamp_id"),
	chapterId: integer("chapter_id").notNull(),
	timeLimit: timestamp("time_limit", { withTimezone: true, mode: 'string' }).notNull(),
	projectUrl: varchar("project_url", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const zuvyBootcampTracking = main.table("zuvy_bootcamp_tracking", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	progress: integer("progress").default(0),
	bootcampId: integer("bootcamp_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const youtubeBroadcast = main.table("youtube_broadcast", {
	id: serial("id").primaryKey().notNull(),
	videoId: varchar("video_id", { length: 255 }).notNull(),
	classId: integer("class_id"),
	recurringId: integer("recurring_id"),
});

export const productionVersions = main.table("production_versions", {
	id: serial("id").primaryKey().notNull(),
	courseName: varchar("course_name", { length: 255 }),
	lang: char("lang", { length: 2 }).default('en').notNull(),
	version: varchar("version", { length: 255 }),
});

export const questionAttempts = main.table("question_attempts", {
	id: serial("id").primaryKey().notNull(),
	enrolmentKeyId: integer("enrolment_key_id").notNull(),
	questionId: integer("question_id").notNull(),
	selectedOptionId: integer("selected_option_id"),
	textAnswer: varchar("text_answer", { length: 45 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
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
	articleId: integer("article_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		engLevelwiseArticleIdEngArticlesIdFk: foreignKey({
			columns: [table.articleId],
			foreignColumns: [engArticles.id],
			name: "eng_levelwise_article_id_eng_articles_id_fk"
		}),
	}
});

export const engHistory = main.table("eng_history", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	engArticlesId: integer("eng_articles_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		engHistoryUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "eng_history_user_id_users_id_fk"
		}),
		engHistoryEngArticlesIdEngArticlesIdFk: foreignKey({
			columns: [table.engArticlesId],
			foreignColumns: [engArticles.id],
			name: "eng_history_eng_articles_id_eng_articles_id_fk"
		}),
	}
});

export const zuvyCourseModules = main.table("zuvy_course_modules", {
	id: serial("id").primaryKey().notNull(),
	typeId: integer("type_id"),
	isLock: boolean("is_lock").default(false),
	bootcampId: integer("bootcamp_id"),
	name: varchar("name"),
	description: text("description"),
	projectId: integer("project_id"),
	order: integer("order"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	timeAlloted: bigint("time_alloted", { mode: "number" }),
});

export const userRoles = main.table("user_roles", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }),
	roles: userRolesRoles("roles").default('student'),
	center: userRolesCenter("center"),
},
(table) => {
	return {
		idx50519UserRoleIbfk1Idx: index("idx_50519_user_role_ibfk_1_idx").using("btree", table.userId.asc().nullsLast()),
		userRolesUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_roles_user_id_users_id_fk"
		}),
	}
});

export const exercisesHistory = main.table("exercises_history", {
	id: serial("id").primaryKey().notNull(),
	slugId: integer("slug_id").notNull(),
	courseId: integer("course_id").notNull(),
	lang: varchar("lang", { length: 255 }).notNull(),
	userId: integer("user_id"),
	teamId: integer("team_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		exercisesHistoryUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "exercises_history_user_id_users_id_fk"
		}),
		exercisesHistoryTeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "exercises_history_team_id_c4ca_teams_id_fk"
		}),
	}
});

export const users = main.table("users", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	email: varchar("email", { length: 50 }).unique(),  // Add .unique() here
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
	partnerId: integer("partner_id"),
	lang1: char("lang_1", { length: 2 }),
	lang2: char("lang_2", { length: 2 }),
	mode: varchar("mode", { length: 255 }),
	contact: varchar("contact", { length: 255 }),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	spaceId: integer("space_id"),
	groupId: integer("group_id"),
	c4CaPartnerId: integer("c4ca_partner_id"),
	c4CaFacilitatorId: integer("c4ca_facilitator_id"),
},
(table) => {
	return {
		idx50526GoogleUserId: uniqueIndex("idx_50526_google_user_id").using("btree", table.googleUserId.asc().nullsLast()),
		usersPartnerIdPartnersIdFk: foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "users_partner_id_partners_id_fk"
		}),
		usersSpaceIdPartnerSpaceIdFk: foreignKey({
			columns: [table.spaceId],
			foreignColumns: [partnerSpace.id],
			name: "users_space_id_partner_space_id_fk"
		}).onUpdate("cascade").onDelete("cascade"),
		usersGroupIdSpaceGroupIdFk: foreignKey({
			columns: [table.groupId],
			foreignColumns: [spaceGroup.id],
			name: "users_group_id_space_group_id_fk"
		}).onDelete("set null"),
		usersC4CaPartnerIdC4CaPartnersIdFk: foreignKey({
			columns: [table.c4CaPartnerId],
			foreignColumns: [c4CaPartners.id],
			name: "users_c4ca_partner_id_c4ca_partners_id_fk"
		}).onDelete("set null"),
		usersC4CaFacilitatorIdFacilitatorsIdFk: foreignKey({
			columns: [table.c4CaFacilitatorId],
			foreignColumns: [facilitators.id],
			name: "users_c4ca_facilitator_id_facilitators_id_fk"
		}).onDelete("set null"),
	}
});

export const zuvyCourseProjects = main.table("zuvy_course_projects", {
	id: serial("id").primaryKey().notNull(),
	title: varchar("title"),
	instruction: jsonb("instruction"),
	isLock: boolean("is_lock").default(false),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
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
		idx80237StudentIdx: index("idx_80237_student_idx").using("btree", table.studentId.asc().nullsLast()),
	}
});

export const incomingCalls = main.table("incoming_calls", {
	id: serial("id").primaryKey().notNull(),
	contactId: integer("contact_id"),
	callType: varchar("call_type", { length: 15 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		idx80265ContactIdx: index("idx_80265_contact_idx").using("btree", table.contactId.asc().nullsLast()),
		incomingCallsContactIdContactsIdFk: foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "incoming_calls_contact_id_contacts_id_fk"
		}),
	}
});

export const courseEnrolments = main.table("course_enrolments", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	studentId: bigint("student_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	courseId: bigint("course_id", { mode: "number" }),
	enrolledAt: timestamp("enrolled_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		idx50433CourseEnrolmentsIbfk1Idx: index("idx_50433_course_enrolments_ibfk_1_idx").using("btree", table.courseId.asc().nullsLast()),
		idx50433CourseEnrolmentsIbfk2Idx: index("idx_50433_course_enrolments_ibfk_2_idx").using("btree", table.studentId.asc().nullsLast()),
		courseEnrolmentsStudentIdUsersIdFk: foreignKey({
			columns: [table.studentId],
			foreignColumns: [users.id],
			name: "course_enrolments_student_id_users_id_fk"
		}),
		courseEnrolmentsCourseIdCoursesIdFk: foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "course_enrolments_course_id_courses_id_fk"
		}),
		mainCourseEnrolmentsStudentIdCourseIdUnique: unique("main_course_enrolments_student_id_course_id_unique").on(table.studentId, table.courseId),
	}
});

export const courseRelation = main.table("course_relation", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	courseId: bigint("course_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	reliesOn: bigint("relies_on", { mode: "number" }),
},
(table) => {
	return {
		idx50441CourseRelationIbfk1: index("idx_50441_course_relation_ibfk_1").using("btree", table.courseId.asc().nullsLast()),
		idx50441CourseRelationIbfk2: index("idx_50441_course_relation_ibfk_2").using("btree", table.reliesOn.asc().nullsLast()),
		courseRelationCourseIdCoursesIdFk: foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "course_relation_course_id_courses_id_fk"
		}),
		courseRelationReliesOnCoursesIdFk: foreignKey({
			columns: [table.reliesOn],
			foreignColumns: [courses.id],
			name: "course_relation_relies_on_courses_id_fk"
		}),
	}
});

export const questionSets = main.table("question_sets", {
	id: serial("id").primaryKey().notNull(),
	questionIds: varchar("question_ids", { length: 8000 }).notNull(),
	versionId: integer("version_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		idx80331QuestionSetsVersionidForeign: index("idx_80331_question_sets_versionid_foreign").using("btree", table.versionId.asc().nullsLast()),
		questionSetsVersionIdTestVersionsIdFk: foreignKey({
			columns: [table.versionId],
			foreignColumns: [testVersions.id],
			name: "question_sets_version_id_test_versions_id_fk"
		}),
	}
});

export const enrolmentKeys = main.table("enrolment_keys", {
	id: serial("id").primaryKey().notNull(),
	key: varchar("key", { length: 6 }),
	studentId: integer("student_id"),
	startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
	endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
	totalMarks: varchar("total_marks", { length: 45 }),
	typeOfTest: varchar("type_of_test", { length: 255 }),
	questionSetId: integer("question_set_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
	return {
		idx80250EnrolmentKeysQuestionsetidForeign: index("idx_80250_enrolment_keys_questionsetid_foreign").using("btree", table.questionSetId.asc().nullsLast()),
		idx80250KeyUnique: uniqueIndex("idx_80250_key__unique").using("btree", table.key.asc().nullsLast()),
		idx80250StudentIdx: index("idx_80250_student_idx").using("btree", table.studentId.asc().nullsLast()),
		enrolmentKeysStudentIdStudentsIdFk: foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "enrolment_keys_student_id_students_id_fk"
		}),
		enrolmentKeysQuestionSetIdQuestionSetsIdFk: foreignKey({
			columns: [table.questionSetId],
			foreignColumns: [questionSets.id],
			name: "enrolment_keys_question_set_id_question_sets_id_fk"
		}),
	}
});

export const exercises = main.table("exercises", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	parentExerciseId: bigint("parent_exercise_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	courseId: bigint("course_id", { mode: "number" }).notNull(),
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
		idx50457CourseId: index("idx_50457_course_id").using("btree", table.courseId.asc().nullsLast()),
		idx50457SlugUnique: uniqueIndex("idx_50457_slug__unique").using("btree", table.slug.asc().nullsLast()),
		exercisesCourseIdCoursesIdFk: foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "exercises_course_id_courses_id_fk"
		}),
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
	courseId: integer("course_id"),
	exerciseId: integer("exercise_id"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		assessmentCourseIdCoursesV2IdFk: foreignKey({
			columns: [table.courseId],
			foreignColumns: [coursesV2.id],
			name: "assessment_course_id_courses_v2_id_fk"
		}),
		assessmentExerciseIdExercisesV2IdFk: foreignKey({
			columns: [table.exerciseId],
			foreignColumns: [exercisesV2.id],
			name: "assessment_exercise_id_exercises_v2_id_fk"
		}),
		mainAssessmentNameUnique: unique("main_assessment_name_unique").on(table.name),
	}
});

export const exercisesV2 = main.table("exercises_v2", {
	id: serial("id").primaryKey().notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	description: varchar("description", { length: 255 }),
	courseId: integer("course_id"),
	content: text("content"),
	type: varchar("type", { length: 255 }),
	sequenceNum: doublePrecision("sequence_num"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		exercisesV2CourseIdCoursesV2IdFk: foreignKey({
			columns: [table.courseId],
			foreignColumns: [coursesV2.id],
			name: "exercises_v2_course_id_courses_v2_id_fk"
		}),
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
},
(table) => {
	return {
		idx80358StudentsPartneridForeign: index("idx_80358_students_partnerid_foreign").using("btree", table.partnerId.asc().nullsLast()),
		studentsPartnerIdPartnersIdFk: foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "students_partner_id_partners_id_fk"
		}),
		studentsCurrentOwnerIdInterviewOwnersIdFk: foreignKey({
			columns: [table.currentOwnerId],
			foreignColumns: [interviewOwners.id],
			name: "students_current_owner_id_interview_owners_id_fk"
		}),
		studentsSchoolStageIdSchoolStageIdFk: foreignKey({
			columns: [table.schoolStageId],
			foreignColumns: [schoolStage.id],
			name: "students_school_stage_id_school_stage_id_fk"
		}),
	}
});

export const stageTransitions = main.table("stage_transitions", {
	id: serial("id").primaryKey().notNull(),
	studentId: integer("student_id"),
	fromStage: varchar("from_stage", { length: 255 }),
	toStage: varchar("to_stage", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	transitionDoneBy: varchar("transition_done_by", { length: 255 }),
	school: varchar("school", { length: 255 }),
},
(table) => {
	return {
		idx80349StageTransitionsStudentidForeign: index("idx_80349_stage_transitions_studentid_foreign").using("btree", table.studentId.asc().nullsLast()),
		stageTransitionsStudentIdStudentsIdFk: foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "stage_transitions_student_id_students_id_fk"
		}),
	}
});

export const studentCampus = main.table("student_campus", {
	id: serial("id").primaryKey().notNull(),
	studentId: integer("student_id"),
	campusId: integer("campus_id"),
},
(table) => {
	return {
		studentCampusStudentIdStudentsIdFk: foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "student_campus_student_id_students_id_fk"
		}),
		studentCampusCampusIdCampusIdFk: foreignKey({
			columns: [table.campusId],
			foreignColumns: [campus.id],
			name: "student_campus_campus_id_campus_id_fk"
		}),
	}
});

export const chanakyaUserRoles = main.table("chanakya_user_roles", {
	id: serial("id").primaryKey().notNull(),
	chanakyaUserEmailId: integer("chanakya_user_email_id").notNull(),
	roles: integer("roles"),
	privilege: integer("privilege"),
},
(table) => {
	return {
		chanakyaUserRolesRolesChanakyaRolesIdFk: foreignKey({
			columns: [table.roles],
			foreignColumns: [chanakyaRoles.id],
			name: "chanakya_user_roles_roles_chanakya_roles_id_fk"
		}),
		chanakyaUserRolesPrivilegeChanakyaPrivilegeIdFk: foreignKey({
			columns: [table.privilege],
			foreignColumns: [chanakyaPrivilege.id],
			name: "chanakya_user_roles_privilege_chanakya_privilege_id_fk"
		}),
	}
});

export const chanakyaAccess = main.table("chanakya_access", {
	id: serial("id").primaryKey().notNull(),
	userRoleId: integer("user_role_id"),
	access: integer("access").notNull(),
},
(table) => {
	return {
		chanakyaAccessUserRoleIdChanakyaUserRolesIdFk: foreignKey({
			columns: [table.userRoleId],
			foreignColumns: [chanakyaUserRoles.id],
			name: "chanakya_access_user_role_id_chanakya_user_roles_id_fk"
		}),
		mainChanakyaAccessUserRoleIdAccessUnique: unique("main_chanakya_access_user_role_id_access_unique").on(table.userRoleId, table.access),
	}
});

export const chanakyaPartnerGroup = main.table("chanakya_partner_group", {
	id: serial("id").primaryKey().notNull(),
	name: varchar("name", { length: 255 }),
});

export const chanakyaPartnerRelationship = main.table("chanakya_partner_relationship", {
	id: serial("id").primaryKey().notNull(),
	partnerId: integer("partner_id").notNull(),
	partnerGroupId: integer("partner_group_id").notNull(),
},
(table) => {
	return {
		chanakyaPartnerRelationshipPartnerGroupIdChanakyaPartner: foreignKey({
			columns: [table.partnerGroupId],
			foreignColumns: [chanakyaPartnerGroup.id],
			name: "chanakya_partner_relationship_partner_group_id_chanakya_partner"
		}),
		chanakyaPartnerRelationshipPartnerIdPartnersIdFk: foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "chanakya_partner_relationship_partner_id_partners_id_fk"
		}),
	}
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
	categoryId: integer("category_id").notNull(),
	videoId: varchar("video_id", { length: 45 }),
	lang: char("lang", { length: 2 }).default('hi').notNull(),
	type: varchar("type", { length: 255 }).notNull(),
	meetLink: varchar("meet_link", { length: 255 }),
	calendarEventId: varchar("calendar_event_id", { length: 255 }),
	facilitatorName: varchar("facilitator_name", { length: 80 }),
	facilitatorEmail: varchar("facilitator_email", { length: 120 }),
	materialLink: varchar("material_link", { length: 255 }),
	maxEnrolment: integer("max_enrolment"),
	recurringId: integer("recurring_id"),
	subTitle: varchar("sub_title", { length: 255 }),
	courseVersion: varchar("course_version", { length: 255 }),
	volunteerId: integer("volunteer_id"),
},
(table) => {
	return {
		classesCategoryIdCategoryIdFk: foreignKey({
			columns: [table.categoryId],
			foreignColumns: [category.id],
			name: "classes_category_id_category_id_fk"
		}),
		classesRecurringIdRecurringClassesIdFk: foreignKey({
			columns: [table.recurringId],
			foreignColumns: [recurringClasses.id],
			name: "classes_recurring_id_recurring_classes_id_fk"
		}),
		classesVolunteerIdVolunteerIdFk: foreignKey({
			columns: [table.volunteerId],
			foreignColumns: [volunteer.id],
			name: "classes_volunteer_id_volunteer_id_fk"
		}),
	}
});

export const classRegistrations = main.table("class_registrations", {
	id: serial("id").primaryKey().notNull(),
	classId: integer("class_id").notNull(),
	userId: integer("user_id").notNull(),
	registeredAt: timestamp("registered_at", { withTimezone: true, mode: 'string' }).notNull(),
	feedback: varchar("feedback", { length: 1000 }),
	feedbackAt: timestamp("feedback_at", { withTimezone: true, mode: 'string' }),
	googleRegistrationStatus: boolean("google_registration_status"),
},
(table) => {
	return {
		classRegistrationsClassIdClassesIdFk: foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "class_registrations_class_id_classes_id_fk"
		}),
		classRegistrationsUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "class_registrations_user_id_users_id_fk"
		}),
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
	classId: integer("class_id"),
	facilitatorEmail: varchar("facilitator_email", { length: 80 }).notNull(),
	status: varchar("status", { length: 50 }),
	type: varchar("type", { length: 255 }).notNull(),
},
(table) => {
	return {
		classesMailClassIdClassesIdFk: foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "classes_mail_class_id_classes_id_fk"
		}),
	}
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

export const partnerSpace = main.table("partner_space", {
	id: serial("id").primaryKey().notNull(),
	partnerId: integer("partner_id"),
	spaceName: varchar("space_name", { length: 255 }),
	pointOfContactName: varchar("point_of_contact_name", { length: 255 }),
	email: varchar("email", { length: 255 }),
},
(table) => {
	return {
		partnerSpacePartnerIdPartnersIdFk: foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "partner_space_partner_id_partners_id_fk"
		}).onUpdate("cascade").onDelete("cascade"),
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
	userId: integer("user_id"),
	hoursPerWeek: integer("hours_per_week"),
	availableOnDays: varchar("available_on_days", { length: 255 }),
	availableOnTime: varchar("available_on_time", { length: 255 }),
	status: varchar("status", { length: 255 }),
	manualStatus: varchar("manual_status", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	pathwayId: integer("pathway_id"),
},
(table) => {
	return {
		volunteerUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "volunteer_user_id_users_id_fk"
		}),
	}
});

export const courseCategories = main.table("course_categories", {
	id: serial("id").primaryKey().notNull(),
	courseId: integer("course_id").notNull(),
	categoryId: integer("category_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
	return {
		courseCategoriesCourseIdCoursesIdFk: foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "course_categories_course_id_courses_id_fk"
		}),
		courseCategoriesCategoryIdCategoryIdFk: foreignKey({
			columns: [table.categoryId],
			foreignColumns: [category.id],
			name: "course_categories_category_id_category_id_fk"
		}),
	}
});

export const courseCompletion = main.table("course_completion", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	courseId: integer("course_id").notNull(),
},
(table) => {
	return {
		courseCompletionUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "course_completion_user_id_users_id_fk"
		}),
		courseCompletionCourseIdCoursesIdFk: foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "course_completion_course_id_courses_id_fk"
		}),
		mainCourseCompletionUserIdCourseIdUnique: unique("main_course_completion_user_id_course_id_unique").on(table.userId, table.courseId),
	}
});

export const courseCompletionV2 = main.table("course_completion_v2", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	courseId: integer("course_id").notNull(),
	completeAt: timestamp("complete_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		courseCompletionV2UserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "course_completion_v2_user_id_users_id_fk"
		}),
		courseCompletionV2CourseIdCoursesV2IdFk: foreignKey({
			columns: [table.courseId],
			foreignColumns: [coursesV2.id],
			name: "course_completion_v2_course_id_courses_v2_id_fk"
		}),
		mainCourseCompletionV2CourseIdUnique: unique("main_course_completion_v2_course_id_unique").on(table.courseId),
	}
});

export const courseEditorStatus = main.table("course_editor_status", {
	id: serial("id").primaryKey().notNull(),
	courseId: integer("course_id"),
	courseStates: varchar("course_states", { length: 255 }),
	stateChangedate: timestamp("stateChangedate", { withTimezone: true, mode: 'string' }),
	contentEditorsUserId: integer("content_editors_user_id"),
},
(table) => {
	return {
		courseEditorStatusCourseIdCoursesV2IdFk: foreignKey({
			columns: [table.courseId],
			foreignColumns: [coursesV2.id],
			name: "course_editor_status_course_id_courses_v2_id_fk"
		}),
		courseEditorStatusContentEditorsUserIdUsersIdFk: foreignKey({
			columns: [table.contentEditorsUserId],
			foreignColumns: [users.id],
			name: "course_editor_status_content_editors_user_id_users_id_fk"
		}),
	}
});

export const courseProductionVersions = main.table("course_production_versions", {
	id: serial("id").primaryKey().notNull(),
	courseId: integer("course_id"),
	lang: char("lang", { length: 2 }).default('en').notNull(),
	version: varchar("version", { length: 255 }),
},
(table) => {
	return {
		courseProductionVersionsCourseIdCoursesV2IdFk: foreignKey({
			columns: [table.courseId],
			foreignColumns: [coursesV2.id],
			name: "course_production_versions_course_id_courses_v2_id_fk"
		}),
	}
});

export const dashboardFlags = main.table("dashboard_flags", {
	id: serial("id").primaryKey().notNull(),
	studentId: integer("student_id").notNull(),
	flag: varchar("flag", { length: 255 }),
	createdAt: timestamp("createdAt", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		dashboardFlagsStudentIdStudentsIdFk: foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "dashboard_flags_student_id_students_id_fk"
		}),
	}
});

export const studentDonor = main.table("student_donor", {
	id: serial("id").primaryKey().notNull(),
	studentId: integer("student_id"),
	donorId: text("donor_id").array(),
},
(table) => {
	return {
		studentDonorStudentIdStudentsIdFk: foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "student_donor_student_id_students_id_fk"
		}),
	}
});

export const emailReport = main.table("email_report", {
	id: serial("id").primaryKey().notNull(),
	partnerId: integer("partner_id").notNull(),
	report: varchar("report", { length: 255 }),
	status: boolean("status"),
	emails: text("emails").array(),
	repeat: varchar("repeat", { length: 255 }),
},
(table) => {
	return {
		emailReportPartnerIdPartnersIdFk: foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "email_report_partner_id_partners_id_fk"
		}),
		mainEmailReportPartnerIdUnique: unique("main_email_report_partner_id_unique").on(table.partnerId),
	}
});

export const exerciseCompletion = main.table("exercise_completion", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	exerciseId: integer("exercise_id").notNull(),
},
(table) => {
	return {
		exerciseCompletionUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "exercise_completion_user_id_users_id_fk"
		}),
		exerciseCompletionExerciseIdExercisesIdFk: foreignKey({
			columns: [table.exerciseId],
			foreignColumns: [exercises.id],
			name: "exercise_completion_exercise_id_exercises_id_fk"
		}),
		mainExerciseCompletionUserIdExerciseIdUnique: unique("main_exercise_completion_user_id_exercise_id_unique").on(table.userId, table.exerciseId),
	}
});

export const feedbacks = main.table("feedbacks", {
	id: serial("id").primaryKey().notNull(),
	studentId: integer("student_id"),
	userId: integer("user_id"),
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
		idx80256FeedbacksStudentidForeign: index("idx_80256_feedbacks_studentid_foreign").using("btree", table.studentId.asc().nullsLast()),
		idx80256FeedbacksUseridForeign: index("idx_80256_feedbacks_userid_foreign").using("btree", table.userId.asc().nullsLast()),
		feedbacksStudentIdStudentsIdFk: foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "feedbacks_student_id_students_id_fk"
		}),
		feedbacksUserIdCUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [cUsers.id],
			name: "feedbacks_user_id_c_users_id_fk"
		}),
	}
});

export const interviewOwners = main.table("interview_owners", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	available: boolean("available"),
	maxLimit: integer("max_limit").default(10),
	type: text("type").array(),
	pendingInterviewCount: integer("pending_interview_count"),
	gender: integer("gender"),
},
(table) => {
	return {
		interviewOwnersUserIdCUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [cUsers.id],
			name: "interview_owners_user_id_c_users_id_fk"
		}),
		mainInterviewOwnersUserIdUnique: unique("main_interview_owners_user_id_unique").on(table.userId),
	}
});

export const interviewSlot = main.table("interview_slot", {
	id: serial("id").primaryKey().notNull(),
	ownerId: integer("owner_id"),
	studentId: integer("student_id").notNull(),
	studentName: varchar("student_name", { length: 255 }),
	transitionId: integer("transition_id"),
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
},
(table) => {
	return {
		interviewSlotOwnerIdInterviewOwnersIdFk: foreignKey({
			columns: [table.ownerId],
			foreignColumns: [interviewOwners.id],
			name: "interview_slot_owner_id_interview_owners_id_fk"
		}),
		interviewSlotStudentIdStudentsIdFk: foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "interview_slot_student_id_students_id_fk"
		}),
		interviewSlotTransitionIdStageTransitionsIdFk: foreignKey({
			columns: [table.transitionId],
			foreignColumns: [stageTransitions.id],
			name: "interview_slot_transition_id_stage_transitions_id_fk"
		}),
	}
});

export const partnerSpecificBatchesV2 = main.table("partner_specific_batches_v2", {
	id: serial("id").primaryKey().notNull(),
	classId: integer("class_id"),
	recurringId: integer("recurring_id"),
	spaceId: integer("space_id"),
	groupId: integer("group_id"),
	partnerId: integer("partner_id"),
	pathwayId: integer("pathway_id"),
},
(table) => {
	return {
		partnerSpecificBatchesV2RecurringIdRecurringClassesIdF: foreignKey({
			columns: [table.recurringId],
			foreignColumns: [recurringClasses.id],
			name: "partner_specific_batches_v2_recurring_id_recurring_classes_id_f"
		}),
		partnerSpecificBatchesV2ClassIdClassesIdFk: foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "partner_specific_batches_v2_class_id_classes_id_fk"
		}),
		partnerSpecificBatchesV2PartnerIdPartnersIdFk: foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "partner_specific_batches_v2_partner_id_partners_id_fk"
		}),
	}
});

export const mentorTree = main.table("mentor_tree", {
	id: serial("id").primaryKey().notNull(),
	mentorId: integer("mentor_id").notNull(),
	menteeId: integer("mentee_id").notNull(),
	pathwayId: integer("pathway_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		mentorTreeMentorIdUsersIdFk: foreignKey({
			columns: [table.mentorId],
			foreignColumns: [users.id],
			name: "mentor_tree_mentor_id_users_id_fk"
		}),
		mentorTreeMenteeIdUsersIdFk: foreignKey({
			columns: [table.menteeId],
			foreignColumns: [users.id],
			name: "mentor_tree_mentee_id_users_id_fk"
		}),
		mainMentorTreeMentorIdMenteeIdUnique: unique("main_mentor_tree_mentor_id_mentee_id_unique").on(table.mentorId, table.menteeId),
	}
});

export const mergedClasses = main.table("merged_classes", {
	id: serial("id").primaryKey().notNull(),
	classId: integer("class_id"),
	mergedClassId: integer("merged_class_id"),
},
(table) => {
	return {
		mergedClassesClassIdClassesIdFk: foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "merged_classes_class_id_classes_id_fk"
		}),
		mergedClassesMergedClassIdClassesIdFk: foreignKey({
			columns: [table.mergedClassId],
			foreignColumns: [classes.id],
			name: "merged_classes_merged_class_id_classes_id_fk"
		}),
	}
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
	partnerGroupId: integer("partner_group_id").notNull(),
	memberOf: integer("member_of").notNull(),
},
(table) => {
	return {
		partnerGroupRelationshipPartnerGroupIdPartnerGroupIdFk: foreignKey({
			columns: [table.partnerGroupId],
			foreignColumns: [partnerGroup.id],
			name: "partner_group_relationship_partner_group_id_partner_group_id_fk"
		}),
	}
});

export const partnerGroupUser = main.table("partner_group_user", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	partnerGroupId: integer("partner_group_id").notNull(),
	email: varchar("email", { length: 255 }),
},
(table) => {
	return {
		partnerGroupUserPartnerGroupIdPartnerGroupIdFk: foreignKey({
			columns: [table.partnerGroupId],
			foreignColumns: [partnerGroup.id],
			name: "partner_group_user_partner_group_id_partner_group_id_fk"
		}),
	}
});

export const zuvyFormTracking = main.table("zuvy_form_tracking", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	moduleId: integer("module_id"),
	chapterId: integer("chapter_id"),
	questionId: integer("question_id"),
	chosenOptions: integer("chosen_options").array(),
	answer: text("answer"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	status: varchar("status", { length: 255 }),
});

export const partnerRelationship = main.table("partner_relationship", {
	id: serial("id").primaryKey().notNull(),
	partnerId: integer("partner_id").notNull(),
	partnerGroupId: integer("partner_group_id").notNull(),
},
(table) => {
	return {
		partnerRelationshipPartnerIdPartnersIdFk: foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "partner_relationship_partner_id_partners_id_fk"
		}),
		partnerRelationshipPartnerGroupIdPartnerGroupIdFk: foreignKey({
			columns: [table.partnerGroupId],
			foreignColumns: [partnerGroup.id],
			name: "partner_relationship_partner_group_id_partner_group_id_fk"
		}),
	}
});

export const spaceGroup = main.table("space_group", {
	id: serial("id").primaryKey().notNull(),
	groupName: varchar("group_name", { length: 255 }),
	spaceId: integer("space_id"),
	webLink: varchar("web_link", { length: 255 }),
	androidLink: varchar("android_link", { length: 255 }),
	crcaLink: varchar("crca_link", { length: 255 }),
},
(table) => {
	return {
		spaceGroupSpaceIdPartnerSpaceIdFk: foreignKey({
			columns: [table.spaceId],
			foreignColumns: [partnerSpace.id],
			name: "space_group_space_id_partner_space_id_fk"
		}).onUpdate("cascade").onDelete("cascade"),
	}
});

export const partnerUser = main.table("partner_user", {
	id: serial("id").primaryKey().notNull(),
	partnerId: integer("partner_id"),
	email: varchar("email", { length: 225 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
	return {
		partnerUserPartnerIdPartnersIdFk: foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "partner_user_partner_id_partners_id_fk"
		}),
		mainPartnerUserEmailUnique: unique("main_partner_user_email_unique").on(table.email),
	}
});

export const pathwayCompletion = main.table("pathway_completion", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	pathwayId: integer("pathway_id").notNull(),
},
(table) => {
	return {
		pathwayCompletionUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "pathway_completion_user_id_users_id_fk"
		}),
		mainPathwayCompletionUserIdPathwayIdUnique: unique("main_pathway_completion_user_id_pathway_id_unique").on(table.userId, table.pathwayId),
	}
});

export const partnerSpecificBatches = main.table("partner_specific_batches", {
	id: serial("id").primaryKey().notNull(),
	classId: integer("class_id"),
	recurringId: integer("recurring_id"),
	partnerId: integer("partner_id"),
	spaceId: integer("space_id"),
	groupId: integer("group_id"),
	pathwayId: integer("pathway_id"),
},
(table) => {
	return {
		partnerSpecificBatchesClassIdClassesIdFk: foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "partner_specific_batches_class_id_classes_id_fk"
		}),
		partnerSpecificBatchesRecurringIdRecurringClassesIdFk: foreignKey({
			columns: [table.recurringId],
			foreignColumns: [recurringClasses.id],
			name: "partner_specific_batches_recurring_id_recurring_classes_id_fk"
		}),
		partnerSpecificBatchesPartnerIdPartnersIdFk: foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "partner_specific_batches_partner_id_partners_id_fk"
		}),
		partnerSpecificBatchesGroupIdSpaceGroupIdFk: foreignKey({
			columns: [table.groupId],
			foreignColumns: [spaceGroup.id],
			name: "partner_specific_batches_group_id_space_group_id_fk"
		}).onDelete("set null"),
		partnerSpecificBatchesPathwayIdPathwaysV2IdFk: foreignKey({
			columns: [table.pathwayId],
			foreignColumns: [pathwaysV2.id],
			name: "partner_specific_batches_pathway_id_pathways_v2_id_fk"
		}),
		partnerSpecificBatchesSpaceIdPartnerSpaceIdFk: foreignKey({
			columns: [table.spaceId],
			foreignColumns: [partnerSpace.id],
			name: "partner_specific_batches_space_id_partner_space_id_fk"
		}).onDelete("set null"),
	}
});

export const pathwayCourses = main.table("pathway_courses", {
	id: serial("id").primaryKey().notNull(),
	courseId: integer("course_id").notNull(),
	pathwayId: integer("pathway_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
	return {
		pathwayCoursesCourseIdCoursesIdFk: foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "pathway_courses_course_id_courses_id_fk"
		}),
	}
});

export const pathwayCoursesV2 = main.table("pathway_courses_v2", {
	id: serial("id").primaryKey().notNull(),
	courseId: integer("course_id").notNull(),
	pathwayId: integer("pathway_id").notNull(),
},
(table) => {
	return {
		pathwayCoursesV2CourseIdCoursesV2IdFk: foreignKey({
			columns: [table.courseId],
			foreignColumns: [coursesV2.id],
			name: "pathway_courses_v2_course_id_courses_v2_id_fk"
		}),
		pathwayCoursesV2PathwayIdPathwaysV2IdFk: foreignKey({
			columns: [table.pathwayId],
			foreignColumns: [pathwaysV2.id],
			name: "pathway_courses_v2_pathway_id_pathways_v2_id_fk"
		}),
	}
});

export const pathwayMilestones = main.table("pathway_milestones", {
	id: serial("id").primaryKey().notNull(),
	name: varchar("name", { length: 45 }).notNull(),
	description: varchar("description", { length: 5000 }).notNull(),
	pathwayId: integer("pathway_id").notNull(),
	position: integer("position").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const pathwayPartnerGroup = main.table("pathway_partner_group", {
	id: serial("id").primaryKey().notNull(),
	partnerId: integer("partner_id"),
	pathwayId: integer("pathway_id"),
},
(table) => {
	return {
		pathwayPartnerGroupPartnerIdPartnersIdFk: foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "pathway_partner_group_partner_id_partners_id_fk"
		}),
		pathwayPartnerGroupPathwayIdPathwaysV2IdFk: foreignKey({
			columns: [table.pathwayId],
			foreignColumns: [pathwaysV2.id],
			name: "pathway_partner_group_pathway_id_pathways_v2_id_fk"
		}),
	}
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

export const pathwayTrackingFormStructure = main.table("pathway_tracking_form_structure", {
	id: serial("id").primaryKey().notNull(),
	pathwayId: integer("pathway_id").notNull(),
	parameterId: integer("parameter_id"),
	questionId: integer("question_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
	return {
		pathwayTrackingFormStructureParameterIdProgressParameter: foreignKey({
			columns: [table.parameterId],
			foreignColumns: [progressParameters.id],
			name: "pathway_tracking_form_structure_parameter_id_progress_parameter"
		}),
		pathwayTrackingFormStructureQuestionIdProgressQuestions: foreignKey({
			columns: [table.questionId],
			foreignColumns: [progressQuestions.id],
			name: "pathway_tracking_form_structure_question_id_progress_questions_"
		}),
	}
});

export const progressQuestions = main.table("progress_questions", {
	id: serial("id").primaryKey().notNull(),
	type: varchar("type", { length: 10 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	name: varchar("name", { length: 20 }).notNull(),
	description: varchar("description", { length: 5000 }).notNull(),
});

export const pathwayTrackingRequestDetails = main.table("pathway_tracking_request_details", {
	id: serial("id").primaryKey().notNull(),
	pathwayId: integer("pathway_id").notNull(),
	mentorId: integer("mentor_id").notNull(),
	menteeId: integer("mentee_id").notNull(),
	requestId: integer("request_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
	return {
		pathwayTrackingRequestDetailsRequestIdPathwayTrackingRe: foreignKey({
			columns: [table.requestId],
			foreignColumns: [pathwayTrackingRequest.id],
			name: "pathway_tracking_request_details_request_id_pathway_tracking_re"
		}),
		pathwayTrackingRequestDetailsMentorIdUsersIdFk: foreignKey({
			columns: [table.mentorId],
			foreignColumns: [users.id],
			name: "pathway_tracking_request_details_mentor_id_users_id_fk"
		}),
		pathwayTrackingRequestDetailsMenteeIdUsersIdFk: foreignKey({
			columns: [table.menteeId],
			foreignColumns: [users.id],
			name: "pathway_tracking_request_details_mentee_id_users_id_fk"
		}),
	}
});

export const pathwayTrackingRequest = main.table("pathway_tracking_request", {
	id: serial("id").primaryKey().notNull(),
	pathwayId: integer("pathway_id").notNull(),
	mentorId: integer("mentor_id").notNull(),
	menteeId: integer("mentee_id").notNull(),
	status: varchar("status", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
	return {
		pathwayTrackingRequestMentorIdUsersIdFk: foreignKey({
			columns: [table.mentorId],
			foreignColumns: [users.id],
			name: "pathway_tracking_request_mentor_id_users_id_fk"
		}),
		pathwayTrackingRequestMenteeIdUsersIdFk: foreignKey({
			columns: [table.menteeId],
			foreignColumns: [users.id],
			name: "pathway_tracking_request_mentee_id_users_id_fk"
		}),
	}
});

export const pathwayTrackingRequestParameterDetails = main.table("pathway_tracking_request_parameter_details", {
	id: serial("id").primaryKey().notNull(),
	parameterId: integer("parameter_id").notNull(),
	data: integer("data").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
	return {
		pathwayTrackingRequestParameterDetailsParameterIdProgres: foreignKey({
			columns: [table.parameterId],
			foreignColumns: [progressParameters.id],
			name: "pathway_tracking_request_parameter_details_parameter_id_progres"
		}),
	}
});

export const pathwayTrackingRequestQuestionDetails = main.table("pathway_tracking_request_question_details", {
	id: serial("id").primaryKey().notNull(),
	questionId: integer("question_id").notNull(),
	data: varchar("data", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
	return {
		pathwayTrackingRequestQuestionDetailsQuestionIdProgress: foreignKey({
			columns: [table.questionId],
			foreignColumns: [progressQuestions.id],
			name: "pathway_tracking_request_question_details_question_id_progress_"
		}),
	}
});

export const pathwaysOngoingTopic = main.table("pathways_ongoing_topic", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	pathwayId: integer("pathway_id").notNull(),
	courseId: integer("course_id").notNull(),
	exerciseId: integer("exercise_id"),
	assessmentId: integer("assessment_id"),
},
(table) => {
	return {
		pathwaysOngoingTopicUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "pathways_ongoing_topic_user_id_users_id_fk"
		}),
		pathwaysOngoingTopicPathwayIdPathwaysV2IdFk: foreignKey({
			columns: [table.pathwayId],
			foreignColumns: [pathwaysV2.id],
			name: "pathways_ongoing_topic_pathway_id_pathways_v2_id_fk"
		}),
		pathwaysOngoingTopicCourseIdCoursesV2IdFk: foreignKey({
			columns: [table.courseId],
			foreignColumns: [coursesV2.id],
			name: "pathways_ongoing_topic_course_id_courses_v2_id_fk"
		}),
		pathwaysOngoingTopicExerciseIdExercisesV2IdFk: foreignKey({
			columns: [table.exerciseId],
			foreignColumns: [exercisesV2.id],
			name: "pathways_ongoing_topic_exercise_id_exercises_v2_id_fk"
		}),
		pathwaysOngoingTopicAssessmentIdAssessmentIdFk: foreignKey({
			columns: [table.assessmentId],
			foreignColumns: [assessment.id],
			name: "pathways_ongoing_topic_assessment_id_assessment_id_fk"
		}),
	}
});

export const campus = main.table("campus", {
	id: serial("id").primaryKey().notNull(),
	campus: varchar("campus", { length: 225 }),
	address: varchar("address", { length: 255 }),
});

export const registrationFormData = main.table("registration_form_data", {
	id: serial("id").primaryKey().notNull(),
	partnerId: integer("partner_id").notNull(),
	formData: json("form_data"),
},
(table) => {
	return {
		registrationFormDataPartnerIdPartnersIdFk: foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "registration_form_data_partner_id_partners_id_fk"
		}),
		mainRegistrationFormDataPartnerIdUnique: unique("main_registration_form_data_partner_id_unique").on(table.partnerId),
	}
});

export const registrationFormStructure = main.table("registration_form_structure", {
	id: serial("id").primaryKey().notNull(),
	partnerId: integer("partner_id").notNull(),
	formStructure: json("form_structure"),
},
(table) => {
	return {
		registrationFormStructurePartnerIdPartnersIdFk: foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "registration_form_structure_partner_id_partners_id_fk"
		}),
		mainRegistrationFormStructurePartnerIdUnique: unique("main_registration_form_structure_partner_id_unique").on(table.partnerId),
	}
});

export const sansaarUserRoles = main.table("sansaar_user_roles", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	role: varchar("role", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		sansaarUserRolesUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sansaar_user_roles_user_id_users_id_fk"
		}),
		mainSansaarUserRolesUserIdRoleUnique: unique("main_sansaar_user_roles_user_id_role_unique").on(table.userId, table.role),
	}
});

export const slotBooked = main.table("slot_booked", {
	id: serial("id").primaryKey().notNull(),
	interviewSlotId: integer("interview_slot_id"),
	studentId: integer("student_id"),
	createdAt: date("created_at"),
},
(table) => {
	return {
		slotBookedInterviewSlotIdInterviewSlotIdFk: foreignKey({
			columns: [table.interviewSlotId],
			foreignColumns: [interviewSlot.id],
			name: "slot_booked_interview_slot_id_interview_slot_id_fk"
		}),
		slotBookedStudentIdStudentsIdFk: foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "slot_booked_student_id_students_id_fk"
		}),
	}
});

export const studentDocuments = main.table("student_documents", {
	id: serial("id").primaryKey().notNull(),
	studentId: integer("student_id").notNull(),
	resumeLink: varchar("Resume_link", { length: 255 }),
	idProofLink: varchar("Id_proof_link", { length: 255 }),
	signedConsentLink: varchar("signed_consent_link", { length: 255 }),
	marksheetLink: varchar("marksheet_link", { length: 255 }),
},
(table) => {
	return {
		studentDocumentsStudentIdStudentsIdFk: foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "student_documents_student_id_students_id_fk"
		}),
	}
});

export const studentJobDetails = main.table("student_job_details", {
	id: serial("id").primaryKey().notNull(),
	studentId: integer("student_id").notNull(),
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
},
(table) => {
	return {
		studentJobDetailsStudentIdStudentsIdFk: foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "student_job_details_student_id_students_id_fk"
		}),
	}
});

export const studentPathways = main.table("student_pathways", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	pathwayId: integer("pathway_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		studentPathwaysUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "student_pathways_user_id_users_id_fk"
		}),
		mainStudentPathwaysUserIdPathwayIdUnique: unique("main_student_pathways_user_id_pathway_id_unique").on(table.userId, table.pathwayId),
	}
});

export const teacherCapacityBuilding = main.table("teacher_capacity_building", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	zone: varchar("zone", { length: 255 }),
	schoolName: varchar("school_name", { length: 255 }),
	teacherName: varchar("teacher_name", { length: 255 }),
	schoolId: integer("school_id"),
	teacherId: integer("teacher_id"),
	classOfTeacher: varchar("class_of_teacher", { length: 255 }),
	email: varchar("email", { length: 255 }),
	phoneNumber: varchar("phone_number", { length: 255 }),
},
(table) => {
	return {
		teacherCapacityBuildingUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "teacher_capacity_building_user_id_users_id_fk"
		}).onDelete("cascade"),
	}
});

export const userTokens = main.table("user_tokens", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	userEmail: varchar("user_email", { length: 255 }).notNull(),
	accessToken: varchar("access_token", { length: 255 }).notNull(),
	refreshToken: varchar("refresh_token", { length: 255 }).notNull(),
},
(table) => {
	return {
		userTokensUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_tokens_user_id_users_id_fk"
		}),
		userTokensUserEmailUsersEmailFk: foreignKey({
			columns: [table.userEmail],
			foreignColumns: [users.email],
			name: "user_tokens_user_email_users_email_fk"
		}),
		mainUserTokensUserIdUnique: unique("main_user_tokens_user_id_unique").on(table.userId),
		mainUserTokensUserEmailUnique: unique("main_user_tokens_user_email_unique").on(table.userEmail),
	}
});

export const mentors = main.table("mentors", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	mentor: bigint("mentor", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	mentee: bigint("mentee", { mode: "number" }),
	scope: varchar("scope", { length: 255 }),
	userId: integer("user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idx50487MentorIbfk1Idx: index("idx_50487_mentor_ibfk_1_idx").using("btree", table.mentor.asc().nullsLast()),
		idx50487MentorIbfk2Idx: index("idx_50487_mentor_ibfk_2_idx").using("btree", table.mentee.asc().nullsLast()),
		mentorsMentorUsersIdFk: foreignKey({
			columns: [table.mentor],
			foreignColumns: [users.id],
			name: "mentors_mentor_users_id_fk"
		}),
		mentorsMenteeUsersIdFk: foreignKey({
			columns: [table.mentee],
			foreignColumns: [users.id],
			name: "mentors_mentee_users_id_fk"
		}),
		mentorsUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "mentors_user_id_users_id_fk"
		}),
	}
});

export const merakiCertificate = main.table("meraki_certificate", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	url: varchar("url", { length: 255 }),
	registerAt: varchar("register_at", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	pathwayId: integer("pathway_id"),
	pathwayCode: varchar("pathway_code", { length: 255 }),
},
(table) => {
	return {
		merakiCertificateUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "meraki_certificate_user_id_users_id_fk"
		}),
	}
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

export const questionOptions = main.table("question_options", {
	id: serial("id").primaryKey().notNull(),
	text: varchar("text", { length: 2000 }).notNull(),
	questionId: integer("question_id").notNull(),
	correct: boolean("correct").notNull(),
	createdAt: varchar("created_at", { length: 45 }).notNull(),
},
(table) => {
	return {
		idx80322QuestionIdx: index("idx_80322_question_idx").using("btree", table.questionId.asc().nullsLast()),
		questionOptionsQuestionIdQuestionsIdFk: foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "question_options_question_id_questions_id_fk"
		}),
	}
});

export const questionBuckets = main.table("question_buckets", {
	id: serial("id").primaryKey().notNull(),
	name: varchar("name", { length: 100 }).notNull(),
	numQuestions: integer("num_questions").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const questionBucketChoices = main.table("question_bucket_choices", {
	id: serial("id").primaryKey().notNull(),
	bucketId: integer("bucket_id"),
	questionIds: text("question_ids").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
	return {
		idx80307QuestionBucketChoicesBucketidForeign: index("idx_80307_question_bucket_choices_bucketid_foreign").using("btree", table.bucketId.asc().nullsLast()),
		questionBucketChoicesBucketIdQuestionBucketsIdFk: foreignKey({
			columns: [table.bucketId],
			foreignColumns: [questionBuckets.id],
			name: "question_bucket_choices_bucket_id_question_buckets_id_fk"
		}),
	}
});

export const testVersions = main.table("test_versions", {
	id: serial("id").primaryKey().notNull(),
	name: varchar("name", { length: 45 }).notNull(),
	data: text("data").notNull(),
	current: boolean("current").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const recordVersionsOfPostDeleteExercisedetails = main.table("record_versions_of_post_delete_exercisedetails", {
	id: serial("id").primaryKey().notNull(),
	courseId: integer("course_id"),
	exerciseId: integer("exercise_id"),
	version: varchar("version", { length: 255 }),
	addedOrRemoved: boolean("addedOrRemoved"),
},
(table) => {
	return {
		recordVersionsOfPostDeleteExercisedetailsCourseIdCourse: foreignKey({
			columns: [table.courseId],
			foreignColumns: [coursesV2.id],
			name: "record_versions_of_post_delete_exercisedetails_course_id_course"
		}),
		recordVersionsOfPostDeleteExercisedetailsExerciseIdExer: foreignKey({
			columns: [table.exerciseId],
			foreignColumns: [exercisesV2.id],
			name: "record_versions_of_post_delete_exercisedetails_exercise_id_exer"
		}),
	}
});

export const ongoingTopics = main.table("ongoing_topics", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	teamId: integer("team_id"),
	pathwayId: integer("pathway_id").notNull(),
	courseId: integer("course_id").notNull(),
	slugId: integer("slug_id").notNull(),
	type: text("type").notNull(),
	moduleId: integer("module_id"),
	projectTopicId: integer("project_topic_id"),
	projectSolutionId: integer("project_solution_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		ongoingTopicsProjectSolutionIdC4CaTeamProjectsubmitSolu: foreignKey({
			columns: [table.projectSolutionId],
			foreignColumns: [c4CaTeamProjectsubmitSolution.id],
			name: "ongoing_topics_project_solution_id_c4ca_team_projectsubmit_solu"
		}).onUpdate("cascade").onDelete("cascade"),
		ongoingTopicsUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "ongoing_topics_user_id_users_id_fk"
		}),
		ongoingTopicsTeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "ongoing_topics_team_id_c4ca_teams_id_fk"
		}).onUpdate("cascade").onDelete("cascade"),
		ongoingTopicsProjectTopicIdC4CaTeamProjecttopicIdFk: foreignKey({
			columns: [table.projectTopicId],
			foreignColumns: [c4CaTeamProjecttopic.id],
			name: "ongoing_topics_project_topic_id_c4ca_team_projecttopic_id_fk"
		}).onUpdate("cascade").onDelete("cascade"),
	}
});

export const classesToCourses = main.table("classes_to_courses", {
	id: serial("id").primaryKey().notNull(),
	classId: integer("class_id"),
	pathwayV1: integer("pathway_v1"),
	courseV1: integer("course_v1"),
	exerciseV1: integer("exercise_v1"),
	pathwayV2: integer("pathway_v2"),
	courseV2: integer("course_v2"),
	exerciseV2: integer("exercise_v2"),
	pathwayV3: integer("pathway_v3"),
	courseV3: integer("course_v3"),
	exerciseV3: integer("exercise_v3"),
	slugId: integer("slug_id"),
},
(table) => {
	return {
		classesToCoursesClassIdClassesIdFk: foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "classes_to_courses_class_id_classes_id_fk"
		}),
		classesToCoursesCourseV1CoursesIdFk: foreignKey({
			columns: [table.courseV1],
			foreignColumns: [courses.id],
			name: "classes_to_courses_course_v1_courses_id_fk"
		}),
		classesToCoursesExerciseV1ExercisesIdFk: foreignKey({
			columns: [table.exerciseV1],
			foreignColumns: [exercises.id],
			name: "classes_to_courses_exercise_v1_exercises_id_fk"
		}),
		classesToCoursesPathwayV2PathwaysV2IdFk: foreignKey({
			columns: [table.pathwayV2],
			foreignColumns: [pathwaysV2.id],
			name: "classes_to_courses_pathway_v2_pathways_v2_id_fk"
		}),
		classesToCoursesCourseV2CoursesV2IdFk: foreignKey({
			columns: [table.courseV2],
			foreignColumns: [coursesV2.id],
			name: "classes_to_courses_course_v2_courses_v2_id_fk"
		}),
		classesToCoursesExerciseV2ExercisesV2IdFk: foreignKey({
			columns: [table.exerciseV2],
			foreignColumns: [exercisesV2.id],
			name: "classes_to_courses_exercise_v2_exercises_v2_id_fk"
		}),
	}
});

export const zuvyLanguages = main.table("zuvy_languages", {
	id: serial("id").primaryKey().notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	languageId: varchar("language_id", { length: 50 }).notNull(),
	defaultCodingTemplate: text("default_coding_template"),
});

export const courseCompletionV3 = main.table("course_completion_v3", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	courseId: integer("course_id").notNull(),
	completeAt: timestamp("complete_at", { withTimezone: true, mode: 'string' }),
	teamId: integer("team_id"),
	percentage: integer("percentage"),
},
(table) => {
	return {
		courseCompletionV3UserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "course_completion_v3_user_id_users_id_fk"
		}),
		courseCompletionV3TeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "course_completion_v3_team_id_c4ca_teams_id_fk"
		}).onDelete("set null"),
	}
});

export const pathwayCompletionV2 = main.table("pathway_completion_v2", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	completeAt: timestamp("complete_at", { withTimezone: true, mode: 'string' }),
	teamId: integer("team_id"),
	percentage: integer("percentage"),
	pathwayId: integer("pathway_id"),
},
(table) => {
	return {
		pathwayCompletionV2UserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "pathway_completion_v2_user_id_users_id_fk"
		}),
		pathwayCompletionV2TeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "pathway_completion_v2_team_id_c4ca_teams_id_fk"
		}).onDelete("set null"),
	}
});

export const c4CaStudents = main.table("c4ca_students", {
	id: serial("id").primaryKey().notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	class: integer("class").notNull(),
	teacherId: integer("teacher_id").notNull(),
	teamId: integer("team_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		c4CaStudentsTeacherIdC4CaTeachersIdFk: foreignKey({
			columns: [table.teacherId],
			foreignColumns: [c4CaTeachers.id],
			name: "c4ca_students_teacher_id_c4ca_teachers_id_fk"
		}),
	}
});

export const assessmentsHistory = main.table("assessments_history", {
	id: serial("id").primaryKey().notNull(),
	slugId: integer("slug_id").notNull(),
	selectedOption: varchar("selected_option", { length: 255 }).notNull(),
	status: varchar("status", { length: 255 }).notNull(),
	attemptCount: integer("attempt_count").notNull(),
	courseId: integer("course_id").notNull(),
	userId: integer("user_id"),
	teamId: integer("team_id"),
	lang: varchar("lang", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		assessmentsHistoryUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "assessments_history_user_id_users_id_fk"
		}),
		assessmentsHistoryTeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "assessments_history_team_id_c4ca_teams_id_fk"
		}),
	}
});

export const exerciseCompletionV2 = main.table("exercise_completion_v2", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	completeAt: timestamp("complete_at", { withTimezone: true, mode: 'string' }),
	exerciseId: integer("exercise_id"),
	teamId: integer("team_id"),
	slugId: integer("slug_id"),
	courseId: integer("course_id"),
	lang: varchar("lang", { length: 255 }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		exerciseCompletionV2UserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "exercise_completion_v2_user_id_users_id_fk"
		}),
		exerciseCompletionV2TeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "exercise_completion_v2_team_id_c4ca_teams_id_fk"
		}).onDelete("set null"),
	}
});

export const c4CaStudentsProjectDetail = main.table("c4ca_students_projectDetail", {
	id: serial("id").primaryKey().notNull(),
	projectTitle: varchar("project_title", { length: 255 }),
	projectSummary: varchar("project_summary", { length: 255 }),
	projectUploadFileUrl: varchar("project_uploadFile_url", { length: 255 }).notNull(),
	startedDate: date("Started_date"),
	teacherId: integer("teacher_id").notNull(),
	teamId: integer("team_id").notNull(),
},
(table) => {
	return {
		c4CaStudentsProjectDetailTeacherIdC4CaTeachersIdFk: foreignKey({
			columns: [table.teacherId],
			foreignColumns: [c4CaTeachers.id],
			name: "c4ca_students_projectDetail_teacher_id_c4ca_teachers_id_fk"
		}),
		c4CaStudentsProjectDetailTeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "c4ca_students_projectDetail_team_id_c4ca_teams_id_fk"
		}),
	}
});

export const moduleCompletionV2 = main.table("module_completion_v2", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	moduleId: integer("module_id").notNull(),
	completeAt: timestamp("complete_at", { withTimezone: true, mode: 'string' }),
	teamId: integer("team_id"),
	percentage: integer("percentage"),
},
(table) => {
	return {
		moduleCompletionV2UserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "module_completion_v2_user_id_users_id_fk"
		}),
		moduleCompletionV2TeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "module_completion_v2_team_id_c4ca_teams_id_fk"
		}).onDelete("set null"),
	}
});

export const zuvyModuleAssessment = main.table("zuvy_module_assessment", {
	id: serial("id").primaryKey().notNull(),
	title: varchar("title"),
	description: text("description"),
	passPercentage: integer("pass_percentage"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	timeLimit: bigint("time_limit", { mode: "number" }),
	copyPaste: boolean("copy_paste"),
	embeddedGoogleSearch: boolean("embedded_google_search"),
	tabChange: boolean("tab_change"),
	screenRecord: boolean("screen_record"),
	webCamera: boolean("web_camera"),
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

export const assessmentResult = main.table("assessment_result", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	assessmentId: integer("assessment_id").notNull(),
	status: varchar("status", { length: 255 }).notNull(),
	selectedOption: integer("selected_option").notNull(),
	attemptCount: integer("attempt_count").default(1).notNull(),
	teamId: integer("team_id"),
},
(table) => {
	return {
		assessmentResultUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "assessment_result_user_id_users_id_fk"
		}),
		assessmentResultAssessmentIdAssessmentIdFk: foreignKey({
			columns: [table.assessmentId],
			foreignColumns: [assessment.id],
			name: "assessment_result_assessment_id_assessment_id_fk"
		}),
		assessmentResultTeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "assessment_result_team_id_c4ca_teams_id_fk"
		}).onDelete("set null"),
	}
});

export const learningTrackStatus = main.table("learning_track_status", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	pathwayId: integer("pathway_id"),
	courseId: integer("course_id"),
	exerciseId: integer("exercise_id").notNull(),
	teamId: integer("team_id"),
},
(table) => {
	return {
		learningTrackStatusUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "learning_track_status_user_id_users_id_fk"
		}),
		learningTrackStatusExerciseIdExercisesV2IdFk: foreignKey({
			columns: [table.exerciseId],
			foreignColumns: [exercisesV2.id],
			name: "learning_track_status_exercise_id_exercises_v2_id_fk"
		}),
		learningTrackStatusTeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "learning_track_status_team_id_c4ca_teams_id_fk"
		}).onDelete("set null"),
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
	userId: integer("user_id").notNull(),
	profileUrl: varchar("profile_url", { length: 255 }),
	facilitatorId: integer("facilitator_id"),
	profileLink: varchar("profile_link", { length: 255 }),
	c4CaPartnerId: integer("c4ca_partner_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		c4CaTeachersUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "c4ca_teachers_user_id_users_id_fk"
		}),
		c4CaTeachersC4CaPartnerIdC4CaPartnersIdFk: foreignKey({
			columns: [table.c4CaPartnerId],
			foreignColumns: [c4CaPartners.id],
			name: "c4ca_teachers_c4ca_partner_id_c4ca_partners_id_fk"
		}).onDelete("set null"),
	}
});

export const assessmentOutcome = main.table("assessment_outcome", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	assessmentId: integer("assessment_id").notNull(),
	status: varchar("status", { length: 255 }).notNull(),
	selectedOption: integer("selected_option"),
	attemptCount: integer("attempt_count").notNull(),
	multipleChoice: varchar("multiple_choice", { length: 255 }),
	teamId: integer("team_id"),
	selectedMultipleOption: varchar("selected_multiple_option", { length: 255 }),
},
(table) => {
	return {
		assessmentOutcomeTeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "assessment_outcome_team_id_c4ca_teams_id_fk"
		}).onDelete("set null"),
		assessmentOutcomeUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "assessment_outcome_user_id_users_id_fk"
		}),
	}
});

export const facilitators = main.table("facilitators", {
	id: serial("id").primaryKey().notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	pointOfContact: varchar("point_of_contact", { length: 255 }),
	email: varchar("email", { length: 255 }).notNull(),
	webLink: varchar("web_link", { length: 255 }),
	phoneNumber: varchar("phone_number", { length: 255 }).notNull(),
	c4CaPartnerId: integer("c4ca_partner_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		facilitatorsC4CaPartnerIdC4CaPartnersIdFk: foreignKey({
			columns: [table.c4CaPartnerId],
			foreignColumns: [c4CaPartners.id],
			name: "facilitators_c4ca_partner_id_c4ca_partners_id_fk"
		}),
	}
});

export const c4CaTeamProjectsubmitSolution = main.table("c4ca_team_projectsubmit_solution", {
	id: serial("id").primaryKey().notNull(),
	projectLink: varchar("project_link", { length: 255 }),
	projectFileUrl: varchar("project_file_url", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	teamId: integer("team_id").notNull(),
	teamName: varchar("team_name", { length: 255 }).notNull(),
	isSubmitted: boolean("is_submitted"),
	unlockedAt: timestamp("unlocked_at", { withTimezone: true, mode: 'string' }),
	moduleId: integer("module_id").notNull(),
	projectFileName: varchar("project_file_name", { length: 255 }),
},
(table) => {
	return {
		c4CaTeamProjectsubmitSolutionTeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "c4ca_team_projectsubmit_solution_team_id_c4ca_teams_id_fk"
		}).onUpdate("cascade").onDelete("cascade"),
	}
});

export const c4CaTeamProjecttopic = main.table("c4ca_team_projecttopic", {
	id: serial("id").primaryKey().notNull(),
	projectTitle: varchar("project_title", { length: 255 }),
	projectSummary: varchar("project_summary", { length: 255 }),
	projectTopicUrl: varchar("project_topic_url", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	teamId: integer("team_id").notNull(),
	teamName: varchar("team_name", { length: 255 }).notNull(),
	isSubmitted: boolean("is_submitted"),
	unlockedAt: timestamp("unlocked_at", { withTimezone: true, mode: 'string' }),
	moduleId: integer("module_id").notNull(),
	projectTopicFileName: varchar("projectTopic_file_name", { length: 255 }),
},
(table) => {
	return {
		c4CaTeamProjecttopicTeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "c4ca_team_projecttopic_team_id_c4ca_teams_id_fk"
		}).onUpdate("cascade").onDelete("cascade"),
	}
});

export const c4CaTeams = main.table("c4ca_teams", {
	id: serial("id").primaryKey().notNull(),
	teamName: varchar("team_name", { length: 255 }).notNull(),
	teamSize: integer("team_size").notNull(),
	teacherId: integer("teacher_id").notNull(),
	loginId: varchar("login_id", { length: 255 }).notNull(),
	password: varchar("password", { length: 255 }).notNull(),
	lastLogin: timestamp("last_login", { withTimezone: true, mode: 'string' }),
	state: varchar("state", { length: 255 }),
	district: varchar("district", { length: 255 }),
	school: varchar("school", { length: 255 }),
},
(table) => {
	return {
		c4CaTeamsTeacherIdC4CaTeachersIdFk: foreignKey({
			columns: [table.teacherId],
			foreignColumns: [c4CaTeachers.id],
			name: "c4ca_teams_teacher_id_c4ca_teachers_id_fk"
		}),
		mainC4CaTeamsTeamNameUnique: unique("main_c4ca_teams_team_name_unique").on(table.teamName),
	}
});

export const pathwaysOngoingTopicOutcome = main.table("pathways_ongoing_topic_outcome", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
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
},
(table) => {
	return {
		pathwaysOngoingTopicOutcomeUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "pathways_ongoing_topic_outcome_user_id_users_id_fk"
		}),
	}
});

export const learningTrackStatusOutcome = main.table("learning_track_status_outcome", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	pathwayId: integer("pathway_id"),
	courseId: integer("course_id"),
	exerciseId: integer("exercise_id"),
	teamId: integer("team_id"),
	moduleId: integer("module_id"),
},
(table) => {
	return {
		learningTrackStatusOutcomeUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "learning_track_status_outcome_user_id_users_id_fk"
		}),
		learningTrackStatusOutcomeTeamIdC4CaTeamsIdFk: foreignKey({
			columns: [table.teamId],
			foreignColumns: [c4CaTeams.id],
			name: "learning_track_status_outcome_team_id_c4ca_teams_id_fk"
		}).onDelete("set null"),
	}
});

export const zuvyModuleChapter = main.table("zuvy_module_chapter", {
	id: serial("id").primaryKey().notNull(),
	title: varchar("title"),
	description: text("description"),
	topicId: integer("topic_id"),
	moduleId: integer("module_id"),
	// TODO: failed to parse database type 'bytea'
	file: bytea("file"),
	links: jsonb("links"),
	articleContent: jsonb("article_content"),
	quizQuestions: jsonb("quiz_questions"),
	codingQuestions: integer("coding_questions"),
	assessmentId: integer("assessment_id"),
	completionDate: timestamp("completion_date", { withTimezone: true, mode: 'string' }),
	order: integer("order"),
	formQuestions: jsonb("form_questions"),
});

export const zuvyModuleForm = main.table("zuvy_module_form", {
	id: serial("id").primaryKey().notNull(),
	chapterId: integer("chapter_id").notNull(),
	question: text("question"),
	options: jsonb("options"),
	typeId: integer("type_id"),
	isRequired: boolean("is_required").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	usage: integer("usage").default(0),
});

export const zuvyBatchEnrollments = main.table("zuvy_batch_enrollments", {
	id: serial("id").primaryKey().notNull(),
	userId: bigserial("user_id", { mode: "bigint" }).notNull(),
	bootcampId: integer("bootcamp_id"),
	batchId: integer("batch_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	attendance: integer("attendance"),
});

export const c4CaRoles = main.table("c4ca_roles", {
	id: serial("id").primaryKey().notNull(),
	role: varchar("role", { length: 255 }).notNull(),
	userId: integer("user_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		c4CaRolesUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "c4ca_roles_user_id_users_id_fk"
		}),
	}
});

export const zuvyModuleQuiz = main.table("zuvy_module_quiz", {
	id: serial("id").primaryKey().notNull(),
	question: text("question"),
	options: jsonb("options"),
	correctOption: integer("correct_option"),
	marks: integer("marks"),
	difficulty: difficulty("difficulty"),
	tagId: integer("tag_id"),
	usage: integer("usage").default(0),
});

export const zuvyModuleTopics = main.table("zuvy_module_topics", {
	id: serial("id").primaryKey().notNull(),
	name: varchar("name"),
});

export const zuvyBootcamps = main.table("zuvy_bootcamps", {
	id: serial("id").primaryKey().notNull(),
	name: text("name").notNull(),
	coverImage: text("cover_image"),
	bootcampTopic: text("bootcamp_topic"),
	startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
	duration: text("duration"),
	language: text("language"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const zuvyBatches = main.table("zuvy_batches", {
	id: serial("id").primaryKey().notNull(),
	name: text("name").notNull(),
	bootcampId: integer("bootcamp_id"),
	instructorId: integer("instructor_id"),
	capEnrollment: integer("cap_enrollment"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		zuvyBatchesBootcampIdZuvyBootcampsIdFk: foreignKey({
			columns: [table.bootcampId],
			foreignColumns: [zuvyBootcamps.id],
			name: "zuvy_batches_bootcamp_id_zuvy_bootcamps_id_fk"
		}).onDelete("cascade"),
		zuvyBatchesInstructorIdUsersIdFk: foreignKey({
			columns: [table.instructorId],
			foreignColumns: [users.id],
			name: "zuvy_batches_instructor_id_users_id_fk"
		}),
	}
});

export const zuvyBootcampType = main.table("zuvy_bootcamp_type", {
	id: serial("id").primaryKey().notNull(),
	bootcampId: integer("bootcamp_id"),
	type: text("type").notNull(),
},
(table) => {
	return {
		zuvyBootcampTypeBootcampIdZuvyBootcampsIdFk: foreignKey({
			columns: [table.bootcampId],
			foreignColumns: [zuvyBootcamps.id],
			name: "zuvy_bootcamp_type_bootcamp_id_zuvy_bootcamps_id_fk"
		}).onDelete("cascade"),
	}
});

export const zuvyModuleTracking = main.table("zuvy_module_tracking", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	moduleId: integer("module_id").notNull(),
	progress: integer("progress").default(0),
	bootcampId: integer("bootcamp_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		zuvyModuleTrackingUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "zuvy_module_tracking_user_id_users_id_fk"
		}),
		zuvyModuleTrackingBootcampIdZuvyBootcampsIdFk: foreignKey({
			columns: [table.bootcampId],
			foreignColumns: [zuvyBootcamps.id],
			name: "zuvy_module_tracking_bootcamp_id_zuvy_bootcamps_id_fk"
		}),
	}
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

export const zuvyOpenEndedQuestionSubmission = main.table("zuvy_open_ended_question_submission", {
	id: serial("id").primaryKey().notNull(),
	answer: text("answer"),
	marks: integer("marks"),
	submitAt: timestamp("submit_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	feedback: text("feedback"),
	assessmentSubmissionId: integer("assessment_submission_id"),
	userId: integer("user_id").notNull(),
	questionId: integer("question_id").notNull(),
});

export const zuvyOutsourseAssessments = main.table("zuvy_outsourse_assessments", {
	id: serial("id").primaryKey().notNull(),
	assessmentId: integer("assessment_id").notNull(),
	bootcampId: integer("bootcamp_id"),
	moduleId: integer("module_id"),
	chapterId: integer("chapter_id"),
	tabChange: boolean("tab_change"),
	webCamera: boolean("web_camera"),
	passPercentage: integer("pass_percentage"),
	screenRecord: boolean("screen_record"),
	embeddedGoogleSearch: boolean("embedded_google_search"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	timeLimit: bigint("time_limit", { mode: "number" }),
	marks: integer("marks"),
	copyPaste: boolean("copy_paste"),
	order: integer("order"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	deadline: text("deadline"),
});

export const zuvyOutsourseCodingQuestions = main.table("zuvy_outsourse_coding_questions", {
	id: serial("id").primaryKey().notNull(),
	codingQuestionId: integer("coding_question_id"),
	assessmentOutsourseId: integer("assessment_outsourse_id").notNull(),
	bootcampId: integer("bootcamp_id").notNull(),
	chapterId: integer("chapter_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const zuvyOutsourseOpenEndedQuestions = main.table("zuvy_outsourse_openEnded_questions", {
	id: serial("id").primaryKey().notNull(),
	openEndedQuestionId: integer("open_ended_question_id"),
	marks: integer("marks"),
	assessmentOutsourseId: integer("assessment_outsourse_id").notNull(),
	bootcampId: integer("bootcamp_id").notNull(),
	moduleId: integer("module_id"),
	chapterId: integer("chapter_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const zuvyOutsourseQuizzes = main.table("zuvy_outsourse_quizzes", {
	quizId: integer("quiz_id"),
	marks: integer("marks"),
	assessmentOutsourseId: integer("assessment_outsourse_id").notNull(),
	bootcampId: integer("bootcamp_id").notNull(),
	chapterId: integer("chapter_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	id: serial("id").primaryKey().notNull(),
});

export const zuvyCodingQuestions = main.table("zuvy_coding_questions", {
	id: serial("id").primaryKey().notNull(),
	title: varchar("title", { length: 255 }).notNull(),
	description: text("description").notNull(),
	difficulty: varchar("difficulty", { length: 50 }),
	tagId: integer("tag_id"),
	constraints: text("constraints"),
	authorId: integer("author_id").notNull(),
	inputBase64: text("input_base64"),
	examples: jsonb("examples"),
	testCases: jsonb("test_cases"),
	expectedOutput: jsonb("expected_output"),
	solution: text("solution"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
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
		idx80292PartnerName: uniqueIndex("idx_80292_partner_name").using("btree", table.name.asc().nullsLast()),
		idx80292PartnersSlugUnique: uniqueIndex("idx_80292_partners_slug_unique").using("btree", table.slug.asc().nullsLast()),
	}
});

export const zuvyTags = main.table("zuvy_tags", {
	id: serial("id").primaryKey().notNull(),
	tagName: varchar("tag_name"),
});

export const subStage = main.table("sub_stage", {
	id: serial("id").primaryKey().notNull(),
	schoolId: integer("school_id"),
	stageId: integer("stage_id"),
	stageName: varchar("stage_name", { length: 255 }),
	subStages: varchar("sub_stages", { length: 255 }),
},
(table) => {
	return {
		subStageStageIdSchoolStageIdFk: foreignKey({
			columns: [table.stageId],
			foreignColumns: [schoolStage.id],
			name: "sub_stage_stage_id_school_stage_id_fk"
		}),
	}
});

export const zuvyCodingSubmission = main.table("zuvy_coding_submission", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	questionSolved: jsonb("question_solved").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		zuvyCodingSubmissionUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "zuvy_coding_submission_user_id_users_id_fk"
		}),
	}
});

export const zuvyStudentAttendance = main.table("zuvy_student_attendance", {
	id: serial("id").primaryKey().notNull(),
	meetingId: text("meeting_id"),
	attendance: jsonb("attendance"),
	batchId: integer("batch_id"),
	bootcampId: integer("bootcamp_id"),
},
(table) => {
	return {
		zuvyStudentAttendanceBootcampIdZuvyBootcampsIdFk: foreignKey({
			columns: [table.bootcampId],
			foreignColumns: [zuvyBootcamps.id],
			name: "zuvy_student_attendance_bootcamp_id_zuvy_bootcamps_id_fk"
		}),
	}
});

export const zuvySessions = main.table("zuvy_sessions", {
	id: serial("id").primaryKey().notNull(),
	meetingId: text("meeting_id").notNull(),
	hangoutLink: text("hangout_link").notNull(),
	creator: text("creator").notNull(),
	startTime: text("start_time").notNull(),
	endTime: text("end_time").notNull(),
	batchId: integer("batch_id").notNull(),
	bootcampId: integer("bootcamp_id").notNull(),
	title: text("title").notNull(),
	s3Link: text("s3link"),
	recurringId: integer("recurring_id"),
	status: text("status").default('upcoming'),
},
(table) => {
	return {
		zuvySessionsBootcampIdZuvyBootcampsIdFk: foreignKey({
			columns: [table.bootcampId],
			foreignColumns: [zuvyBootcamps.id],
			name: "zuvy_sessions_bootcamp_id_zuvy_bootcamps_id_fk"
		}).onUpdate("cascade").onDelete("cascade"),
	}
});

export const zuvyChapterTracking = main.table("zuvy_chapter_tracking", {
	id: serial("id").primaryKey().notNull(),
	userId: bigserial("user_id", { mode: "bigint" }).notNull(),
	chapterId: integer("chapter_id").notNull(),
	moduleId: integer("module_id").notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	answerDetails: text("answer_Details"),
},
(table) => {
	return {
		zuvyChapterTrackingUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "zuvy_chapter_tracking_user_id_users_id_fk"
		}),
	}
});

export const zuvyPracticeCode = main.table("zuvy_practice_code", {
	id: serial("id").primaryKey().notNull(),
	userId: bigserial("user_id", { mode: "bigint" }).notNull(),
	status: varchar("status", { length: 255 }).notNull(),
	action: action("action").notNull(),
	questionId: integer("question_id"),
	codingOutsourseId: integer("coding_outsourse_id"),
	submissionId: integer("submission_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	sourceCode: text("source_code"),
});

export const zuvyProjectTracking = main.table("zuvy_project_tracking", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	projectId: integer("project_id"),
	moduleId: integer("module_id"),
	bootcampId: integer("bootcamp_id"),
	projectLink: varchar("project_link"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isChecked: boolean("is_checked").default(false),
	grades: integer("grades"),
});

export const zuvyQuizTracking = main.table("zuvy_quiz_tracking", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id"),
	moduleId: integer("module_id"),
	mcqId: integer("mcq_id"),
	attemptCount: integer("attempt_count").default(0),
	chapterId: integer("chapter_id"),
	status: varchar("status", { length: 255 }),
	chossenOption: integer("chossen_option"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	assessmentSubmissionId: integer("assessment_submission_id"),
	chosenOption: integer("chosen_option"),
	questionId: integer("question_id"),
});

export const zuvyTestCases = main.table("zuvy_test_cases", {
	id: serial("id").primaryKey().notNull(),
	questionId: integer("question_id"),
	inputs: jsonb("inputs").notNull(),
	expectedOutput: jsonb("expected_output").notNull(),
});

export const zuvyTestCasesSubmission = main.table("zuvy_test_cases_submission", {
	id: serial("id").primaryKey().notNull(),
	testcastId: integer("testcast_id"),
	status: varchar("status", { length: 255 }),
	token: varchar("token", { length: 255 }),
	action: varchar("action", { length: 255 }),
	submissionId: integer("submission_id"),
	languageId: integer("language_id"),
	stdout: text("stdout"),
	memory: integer("memory"),
	stderr: text("stderr"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	time: numeric("time"),
});

export const scratchSample = main.table("scratch_sample", {
	id: serial("id").primaryKey().notNull(),
	projectId: varchar("project_id", { length: 255 }).notNull(),
	url: varchar("url", { length: 255 }).notNull(),
	projectName: varchar("project_name", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const zuvyOpenEndedQuestions = main.table("zuvy_openEnded_questions", {
	id: serial("id").primaryKey().notNull(),
	question: text("question").notNull(),
	difficulty: difficulty("difficulty"),
	tagId: integer("tag_id"),
	usage: integer("usage").default(0),
},
(table) => {
	return {
		zuvyOpenEndedQuestionsTagIdZuvyTagsIdFk: foreignKey({
			columns: [table.tagId],
			foreignColumns: [zuvyTags.id],
			name: "zuvy_openEnded_questions_tag_id_zuvy_tags_id_fk"
		}),
	}
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

export const zuvyRecentBootcamp = main.table("zuvy_recent_bootcamp", {
	id: serial("id").primaryKey().notNull(),
	userId: bigserial("user_id", { mode: "bigint" }).notNull(),
	bootcampId: integer("bootcamp_id").notNull(),
	moduleId: integer("module_id").notNull(),
	chapterId: integer("chapter_id"),
	progress: integer("progress"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		zuvyRecentBootcampUserIdUsersIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "zuvy_recent_bootcamp_user_id_users_id_fk"
		}),
		zuvyRecentBootcampBootcampIdZuvyBootcampsIdFk: foreignKey({
			columns: [table.bootcampId],
			foreignColumns: [zuvyBootcamps.id],
			name: "zuvy_recent_bootcamp_bootcamp_id_zuvy_bootcamps_id_fk"
		}).onUpdate("cascade").onDelete("cascade"),
	}
});

export const gharUsers = main.table("ghar_users", {
	id: serial("id").primaryKey().notNull(),
	email: varchar("email", { length: 255 }).notNull(),
});

export const zuvyQuestionType = main.table("zuvy_question_type", {
	id: serial("id").primaryKey().notNull(),
	questionType: varchar("question_type"),
});