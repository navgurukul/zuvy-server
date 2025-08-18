import { pgTable, customType, pgSchema, varchar, serial, integer, timestamp, text, unique, foreignKey, uniqueIndex, bigserial, bigint, date, boolean, char, index, jsonb, doublePrecision, json, type AnyPgColumn, time, numeric } from "drizzle-orm/pg-core"
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


const batey = customType<{ data: string; notNull: false; default: false }>({
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

export const merakiStudents = main.table("meraki_students", {
  id: serial("id").primaryKey().notNull(),
  userName: varchar("user_name", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  partnerId: integer("partner_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
  return {
    merakiStudentsPartnerIdPartnersIdFk: foreignKey({
      columns: [table.partnerId],
      foreignColumns: [partners.id],
      name: "meraki_students_partner_id_partners_id_fk"
    }).onDelete("cascade"),
  }
});

export const cUsers = main.table("c_users", {
  id: serial("id").primaryKey().notNull(),
  mobile: varchar("mobile", { length: 255 }),
  userName: varchar("user_name", { length: 255 }).notNull(),
  mailId: varchar("mail_id", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  // TODO: failed to parse database type 'bytea'
  password: batey("password"),
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

export const zuvySessionRecordViews = main.table("zuvy_session_record_views", {
  id: serial("id").primaryKey().notNull(),
  userId: integer("user_id").notNull(),
  sessionId: integer("session_id").notNull(),
  viewedAt: timestamp("viewed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvySessionRecordViewsUserIdFkey: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "zuvy_session_record_views_user_id_fkey"
    }),
    zuvySessionRecordViewsSessionIdFkey: foreignKey({
      columns: [table.sessionId],
      foreignColumns: [zuvySessions.id],
      name: "zuvy_session_record_views_session_id_fkey"
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

export const zuvyOpenEndedQuestions = main.table("zuvy_open_ended_questions", {
  id: serial("id").primaryKey().notNull(),
  question: text("question").notNull(),
  difficulty: varchar("difficulty", { length: 255 }),
  tagId: integer("tag_id"),
  marks: integer("marks"),
  usage: integer("usage").default(0),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyOpenEndedQuestionsTagIdFkey: foreignKey({
      columns: [table.tagId],
      foreignColumns: [zuvyTags.id],
      name: "zuvy_open_ended_questions_tag_id_fkey"
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

export const zuvyOutsourseOpenEndedQuestions = main.table("zuvy_outsourse_open_ended_questions", {
  id: serial("id").primaryKey().notNull(),
  openEndedQuestionId: integer("open_ended_question_id"),
  marks: integer("marks"),
  assessmentOutsourseId: integer("assessment_outsourse_id").notNull(),
  bootcampId: integer("bootcamp_id").notNull(),
  moduleId: integer("module_id"),
  chapterId: integer("chapter_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyOutsourseOpenEndedQuestionsOpenEndedQuestionIdFkey: foreignKey({
      columns: [table.openEndedQuestionId],
      foreignColumns: [zuvyOpenEndedQuestions.id],
      name: "zuvy_outsourse_open_ended_questions_open_ended_question_id_fkey"
    }),
    zuvyOutsourseOpenEndedQuestionAssessmentOutsourseIdFkey: foreignKey({
      columns: [table.assessmentOutsourseId],
      foreignColumns: [zuvyOutsourseAssessments.id],
      name: "zuvy_outsourse_open_ended_question_assessment_outsourse_id_fkey"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyOutsourseOpenEndedQuestionsBootcampIdFkey: foreignKey({
      columns: [table.bootcampId],
      foreignColumns: [zuvyBootcamps.id],
      name: "zuvy_outsourse_open_ended_questions_bootcamp_id_fkey"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyOutsourseOpenEndedQuestionsModuleIdFkey: foreignKey({
      columns: [table.moduleId],
      foreignColumns: [zuvyCourseModules.id],
      name: "zuvy_outsourse_open_ended_questions_module_id_fkey"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyOutsourseOpenEndedQuestionsChapterIdFkey: foreignKey({
      columns: [table.chapterId],
      foreignColumns: [zuvyModuleChapter.id],
      name: "zuvy_outsourse_open_ended_questions_chapter_id_fkey"
    }).onUpdate("cascade").onDelete("cascade"),
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
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyAssignmentSubmissionBootcampIdZuvyBootcampsIdFk: foreignKey({
      columns: [table.bootcampId],
      foreignColumns: [zuvyBootcamps.id],
      name: "zuvy_assignment_submission_bootcamp_id_zuvy_bootcamps_id_fk"
    }),
    zuvyAssignmentSubmissionUserIdUsersIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "zuvy_assignment_submission_user_id_users_id_fk"
    }),
  }
});

export const zuvyBootcampTracking = main.table("zuvy_bootcamp_tracking", {
  id: serial("id").primaryKey().notNull(),
  userId: integer("user_id"),
  progress: integer("progress").default(0),
  bootcampId: integer("bootcamp_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyBootcampTrackingUserIdUsersIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "zuvy_bootcamp_tracking_user_id_users_id_fk"
    }),
    zuvyBootcampTrackingBootcampIdZuvyBootcampsIdFk: foreignKey({
      columns: [table.bootcampId],
      foreignColumns: [zuvyBootcamps.id],
      name: "zuvy_bootcamp_tracking_bootcamp_id_zuvy_bootcamps_id_fk"
    }),
  }
});

export const youtubeBroadcast = main.table("youtube_broadcast", {
  id: serial("id").primaryKey().notNull(),
  videoId: varchar("video_id", { length: 255 }).notNull(),
  classId: integer("class_id"),
  recurringId: integer("recurring_id"),
});

export const zuvyQuestionTypes = main.table("zuvy_question_types", {
  id: serial("id").primaryKey().notNull(),
  questionType: varchar("question_type", { length: 255 }),
  version: varchar("version", { length: 10 }),
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

export const zuvyCourseModules = main.table("zuvy_course_modules", {
  id: serial("id").primaryKey().notNull(),
  typeId: integer("type_id"),
  isLock: boolean("is_lock").default(false),
  name: varchar("name"),
  description: text("description"),
  projectId: integer("project_id"),
  order: integer("order"),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  timeAlloted: bigint("time_alloted", { mode: "number" }),
  bootcampId: integer("bootcamp_id"),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyCourseModulesProjectIdZuvyCourseProjectsIdFk: foreignKey({
      columns: [table.projectId],
      foreignColumns: [zuvyCourseProjects.id],
      name: "zuvy_course_modules_project_id_zuvy_course_projects_id_fk"
    }),
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

export const zuvyCourseProjects = main.table("zuvy_course_projects", {
  id: serial("id").primaryKey().notNull(),
  title: varchar("title"),
  instruction: jsonb("instruction"),
  isLock: boolean("is_lock").default(false),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar("version", { length: 10 }),
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

export const zuvyAssessmentReattempt = main.table("zuvy_assessment_reattempt", {
  id: serial("id").primaryKey().notNull(),
  assessmentSubmissionId: integer("assessment_submission_id").notNull(),
  userId: integer("user_id").notNull(),
  remarks: text("remarks"),
  status: varchar("status", { length: 255 }).notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
  return {
    zuvyAssessmentReattemptAssessmentSubmissionIdFkey: foreignKey({
      columns: [table.assessmentSubmissionId],
      foreignColumns: [zuvyAssessmentSubmission.id],
      name: "zuvy_assessment_reattempt_assessment_submission_id_fkey"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyAssessmentReattemptUserIdFkey: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "zuvy_assessment_reattempt_user_id_fkey"
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
  secondBatchId: integer("second_batch_id"),
  bootcampId: integer("bootcamp_id").notNull(),
  title: text("title").notNull(),
  s3Link: text("s3link"),
  recurringId: integer("recurring_id"),
  status: text("status").default('upcoming'),
  version: varchar("version", { length: 10 }),
  moduleId: integer("module_id"),
  chapterId: integer("chapter_id"),
  isZoomMeet: boolean("is_zoom_meet"),
  zoomStartUrl: text("zoom_start_url"),
  zoomPassword: text("zoom_password"),
  zoomMeetingId: text("zoom_meeting_id"),
  // merge tracking flags & invited students snapshot
  hasBeenMerged: boolean('has_been_merged').default(false),
  isParentSession: boolean('is_parent_session').default(false),
  isChildSession: boolean('is_child_session').default(false),
  invitedStudents: jsonb('invited_students').default([]).notNull(),
},
(table) => {
  return {
    zuvySessionsBatchIdZuvyBatchesIdFk: foreignKey({
      columns: [table.batchId],
      foreignColumns: [zuvyBatches.id],
      name: "zuvy_sessions_batch_id_zuvy_batches_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvySessionsSecondBatchIdZuvyBatchesIdFk: foreignKey({
      columns: [table.secondBatchId],
      foreignColumns: [zuvyBatches.id],
      name: "zuvy_sessions_second_batch_id_zuvy_batches_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvySessionsBootcampIdZuvyBootcampsIdFk: foreignKey({
      columns: [table.bootcampId],
      foreignColumns: [zuvyBootcamps.id],
      name: "zuvy_sessions_bootcamp_id_zuvy_bootcamps_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
  }
});

// session merge table
export const zuvySessionMerge = main.table('zuvy_session_merge', {
  id: serial('id').primaryKey().notNull(),
  childSessionId: integer('child_session_id').notNull(),
  parentSessionId: integer('parent_session_id').notNull(),
  redirectMeetingUrl: text('redirect_meeting_url'),
  mergedJustification: text('merged_justification'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow()
}, (table) => {
  return {
    zuvySessionMergeChildSessionIdFkey: foreignKey({
      columns: [table.childSessionId],
      foreignColumns: [zuvySessions.id],
      name: 'zuvy_session_merge_child_session_id_fkey'
    }).onUpdate('cascade').onDelete('cascade'),
    zuvySessionMergeParentSessionIdFkey: foreignKey({
      columns: [table.parentSessionId],
      foreignColumns: [zuvySessions.id],
      name: 'zuvy_session_merge_parent_session_id_fkey'
    }).onUpdate('cascade').onDelete('cascade'),
  }
});

// video recordings table
export const zuvySessionVideoRecordings = main.table('zuvy_session_video_recordings', {
  id: serial('id').primaryKey().notNull(),
  recordingUrl: text('recording_url').notNull(),
  recordingSize: integer('recording_size').notNull(),
  recordingDuration: integer('recording_duration').notNull(),
  sessionId: integer('session_id').notNull(),
  batchId: integer('batch_id'),
  bootcampId: integer('bootcamp_id'),
  userId: integer('user_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => {
  return {
    zuvySessionVideoRecordingsSessionIdFkey: foreignKey({
      columns: [table.sessionId],
      foreignColumns: [zuvySessions.id],
      name: 'zuvy_session_video_recordings_session_id_fkey'
    }),
    zuvySessionVideoRecordingsBatchIdFkey: foreignKey({
      columns: [table.batchId],
      foreignColumns: [zuvyBatches.id],
      name: 'zuvy_session_video_recordings_batch_id_fkey'
    }),
    zuvySessionVideoRecordingsBootcampIdFkey: foreignKey({
      columns: [table.bootcampId],
      foreignColumns: [zuvyBootcamps.id],
      name: 'zuvy_session_video_recordings_bootcamp_id_fkey'
    }),
    zuvySessionVideoRecordingsUserIdFkey: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'zuvy_session_video_recordings_user_id_fkey'
    }),
  }
});

// attendance records table
export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent'
};

export const zuvyStudentAttendanceRecords = main.table('zuvy_student_attendance_records', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').notNull(),
  batchId: integer('batch_id').notNull(),
  bootcampId: integer('bootcamp_id').notNull(),
  sessionId: integer('session_id').notNull(),
  attendanceDate: date('attendance_date').notNull(),
  status: varchar('status', { length: 10 }).notNull().default(AttendanceStatus.ABSENT),
  version: varchar('version', { length: 10 })
}, (table) => {
  return {
    zuvyStudentAttendanceRecordsUserIdFkey: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'zuvy_student_attendance_records_user_id_fkey'
    }),
    zuvyStudentAttendanceRecordsBatchIdFkey: foreignKey({
      columns: [table.batchId],
      foreignColumns: [zuvyBatches.id],
      name: 'zuvy_student_attendance_records_batch_id_fkey'
    }),
    zuvyStudentAttendanceRecordsBootcampIdFkey: foreignKey({
      columns: [table.bootcampId],
      foreignColumns: [zuvyBootcamps.id],
      name: 'zuvy_student_attendance_records_bootcamp_id_fkey'
    }),
    zuvyStudentAttendanceRecordsSessionIdFkey: foreignKey({
      columns: [table.sessionId],
      foreignColumns: [zuvySessions.id],
      name: 'zuvy_student_attendance_records_session_id_fkey'
    }),
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
    partnerSpecificBatchesV2SpaceIdPartnerSpaceIdFk: foreignKey({
      columns: [table.spaceId],
      foreignColumns: [partnerSpace.id],
      name: "partner_specific_batches_v2_space_id_partner_space_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    partnerSpecificBatchesV2GroupIdSpaceGroupIdFk: foreignKey({
      columns: [table.groupId],
      foreignColumns: [spaceGroup.id],
      name: "partner_specific_batches_v2_group_id_space_group_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
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
  meetLink: varchar("meet_link", { length: 255 }),
  meetLinkStatus: boolean("meet_link_status"),
  resultStatus: boolean("result_status"),
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
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyFormTrackingUserIdFkey: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "zuvy_form_tracking_user_id_fkey"
    }),
  }
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
  version: varchar("version", { length: 10 }),
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

export const clusterManagers = main.table("cluster_managers", {
  id: serial("id").primaryKey().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  pointOfContact: varchar("point_of_contact", { length: 100 }),
  email: varchar("email", { length: 255 }).notNull(),
  webLink: varchar("web_link", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 15 }),
  adminId: integer("admin_id").notNull(),
  shortCode: varchar("short_code", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
},
(table) => {
  return {
    mainClusterManagersAdminIdForeign: foreignKey({
      columns: [table.adminId],
      foreignColumns: [users.id],
      name: "main_cluster_managers_admin_id_foreign"
    }).onDelete("cascade"),
    mainClusterManagersEmailUnique: unique("main_cluster_managers_email_unique").on(table.email),
    mainClusterManagersPhoneNumberUnique: unique("main_cluster_managers_phone_number_unique").on(table.phoneNumber),
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
  version: varchar("version", { length: 10 }),
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

export const zuvyBatchEnrollments = main.table("zuvy_batch_enrollments", {
  id: serial("id").primaryKey().notNull(),
  userId: bigserial("user_id", { mode: "bigint" }).notNull(),
  bootcampId: integer("bootcamp_id"),
  batchId: integer("batch_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  attendance: integer("attendance"),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyBatchEnrollmentsUserIdUsersIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "zuvy_batch_enrollments_user_id_users_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyBatchEnrollmentsBootcampIdZuvyBootcampsIdFk: foreignKey({
      columns: [table.bootcampId],
      foreignColumns: [zuvyBootcamps.id],
      name: "zuvy_batch_enrollments_bootcamp_id_zuvy_bootcamps_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyBatchEnrollmentsBatchIdZuvyBatchesIdFk: foreignKey({
      columns: [table.batchId],
      foreignColumns: [zuvyBatches.id],
      name: "zuvy_batch_enrollments_batch_id_zuvy_batches_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
  }
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

export const zuvyBootcampType = main.table("zuvy_bootcamp_type", {
  id: serial("id").primaryKey().notNull(),
  bootcampId: integer("bootcamp_id"),
  type: text("type").notNull(),
  version: varchar("version", { length: 10 }),
  isModuleLocked: boolean("is_module_locked").default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
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

export const careerTeachers = main.table("career_teachers", {
  id: serial("id").primaryKey().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  school: varchar("school", { length: 100 }).notNull(),
  district: varchar("district", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 15 }),
  email: varchar("email", { length: 255 }).notNull(),
  profileUrl: varchar("profile_url", { length: 255 }),
  userId: integer("user_id").notNull(),
  clusterManagerId: integer("cluster_manager_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
},
(table) => {
  return {
    mainCareerTeachersUserIdForeign: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "main_career_teachers_user_id_foreign"
    }),
    mainCareerTeachersClusterManagerIdForeign: foreignKey({
      columns: [table.clusterManagerId],
      foreignColumns: [clusterManagers.id],
      name: "main_career_teachers_cluster_manager_id_foreign"
    }),
    mainCareerTeachersPhoneNumberUnique: unique("main_career_teachers_phone_number_unique").on(table.phoneNumber),
    mainCareerTeachersEmailUnique: unique("main_career_teachers_email_unique").on(table.email),
  }
});

export const zuvyBootcamps = main.table("zuvy_bootcamps", {
  id: serial("id").primaryKey().notNull(),
  name: text("name").notNull(),
  description: text('description'),
  collaborator: text('collaborator'),
  coverImage: text("cover_image"),
  bootcampTopic: text("bootcamp_topic"),
  startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
  duration: text("duration"),
  language: text("language"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar("version", { length: 10 }),
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

export const zuvyBatches = main.table("zuvy_batches", {
  id: serial("id").primaryKey().notNull(),
  name: text("name").notNull(),
  bootcampId: integer("bootcamp_id"),
  instructorId: integer("instructor_id"),
  capEnrollment: integer("cap_enrollment"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  version: varchar("version", { length: 10 }),
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

export const careerTeams = main.table("career_teams", {
  id: serial("id").primaryKey().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  teamSize: integer("team_size").notNull(),
  loginId: varchar("login_id", { length: 255 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  careerTeacherId: integer("career_teacher_id").notNull(),
  state: varchar("state", { length: 100 }),
  district: varchar("district", { length: 100 }),
  school: varchar("school", { length: 255 }),
  lastLogin: varchar("last_login", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
},
(table) => {
  return {
    mainCareerTeamsCareerTeacherIdForeign: foreignKey({
      columns: [table.careerTeacherId],
      foreignColumns: [careerTeachers.id],
      name: "main_career_teams_career_teacher_id_foreign"
    }).onDelete("cascade"),
    mainCareerTeamsNameUnique: unique("main_career_teams_name_unique").on(table.name),
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

export const zuvyTags = main.table("zuvy_tags", {
  id: serial("id").primaryKey().notNull(),
  tagName: varchar("tag_name"),
  version: varchar("version", { length: 10 }),
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
  programLangId: varchar("program_lang_id", { length: 255 }),
  version: varchar("version", { length: 10 }),
  chapterId: integer("chapter_id"),
},
(table) => {
  return {
    zuvyPracticeCodeSubmissionIdZuvyAssessmentSubmissionId: foreignKey({
      columns: [table.submissionId],
      foreignColumns: [zuvyAssessmentSubmission.id],
      name: "zuvy_practice_code_submission_id_zuvy_assessment_submission_id_"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyPracticeCodeCodingOutsourseIdZuvyOutsourseCodingQu: foreignKey({
      columns: [table.codingOutsourseId],
      foreignColumns: [zuvyOutsourseCodingQuestions.id],
      name: "zuvy_practice_code_coding_outsourse_id_zuvy_outsourse_coding_qu"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyPracticeCodeQuestionIdZuvyCodingQuestionsIdFk: foreignKey({
      columns: [table.questionId],
      foreignColumns: [zuvyCodingQuestions.id],
      name: "zuvy_practice_code_question_id_zuvy_coding_questions_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    fkChapter: foreignKey({
      columns: [table.chapterId],
      foreignColumns: [zuvyModuleChapter.id],
      name: "fk_chapter"
    }).onUpdate("cascade").onDelete("cascade"),
  }
});

export const careerStudents = main.table("career_students", {
  id: serial("id").primaryKey().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  class: integer("class").notNull(),
  careerTeacherId: integer("career_teacher_id").notNull(),
  careerTeamId: integer("career_team_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
},
(table) => {
  return {
    mainCareerStudentsCareerTeacherIdForeign: foreignKey({
      columns: [table.careerTeacherId],
      foreignColumns: [careerTeachers.id],
      name: "main_career_students_career_teacher_id_foreign"
    }).onDelete("cascade"),
    mainCareerStudentsCareerTeamIdForeign: foreignKey({
      columns: [table.careerTeamId],
      foreignColumns: [careerTeams.id],
      name: "main_career_students_career_team_id_foreign"
    }).onDelete("cascade"),
  }
});

export const scratchSample = main.table("scratch_sample", {
  id: serial("id").primaryKey().notNull(),
  projectId: varchar("project_id", { length: 255 }).notNull(),
  url: varchar("url", { length: 255 }).notNull(),
  projectName: varchar("project_name", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const samaClients = main.table("sama_clients", {
  id: serial("id").primaryKey().notNull(),
  name: varchar("name"),
  macAddress: varchar("mac_address", { length: 27 }).notNull(),
  softwareStatus: boolean("software_status").default(false),
  wallpaperStatus: boolean("wallpaper_status").default(false),
  createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastSync: timestamp("last_sync", { withTimezone: true, mode: 'string' }),
  installedSoftwares: text("installed_softwares"),
  serialNumber: varchar("serial_number", { length: 255 }),
  ngoName: varchar("ngo_name", { length: 255 }),
},
(table) => {
  return {
    uniqueMacSerial: unique("unique_mac_serial").on(table.macAddress, table.serialNumber),
  }
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
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyProjectTrackingUserIdUsersIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "zuvy_project_tracking_user_id_users_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyProjectTrackingProjectIdZuvyCourseProjectsIdFk: foreignKey({
      columns: [table.projectId],
      foreignColumns: [zuvyCourseProjects.id],
      name: "zuvy_project_tracking_project_id_zuvy_course_projects_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyProjectTrackingModuleIdZuvyCourseModulesIdFk: foreignKey({
      columns: [table.moduleId],
      foreignColumns: [zuvyCourseModules.id],
      name: "zuvy_project_tracking_module_id_zuvy_course_modules_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyProjectTrackingBootcampIdZuvyBootcampsIdFk: foreignKey({
      columns: [table.bootcampId],
      foreignColumns: [zuvyBootcamps.id],
      name: "zuvy_project_tracking_bootcamp_id_zuvy_bootcamps_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
  }
});

export const zuvyTestCases = main.table("zuvy_test_cases", {
  id: serial("id").primaryKey().notNull(),
  questionId: integer("question_id"),
  inputs: jsonb("inputs").notNull(),
  expectedOutput: jsonb("expected_output").notNull(),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyTestCasesQuestionIdFkey: foreignKey({
      columns: [table.questionId],
      foreignColumns: [zuvyCodingQuestions.id],
      name: "zuvy_test_cases_question_id_fkey"
    }).onUpdate("cascade").onDelete("cascade"),
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

export const users = main.table("users", {
  id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
  email: varchar("email", { length: 255 }),
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
  userName: varchar("user_name", { length: 255 }),
  password: varchar("password", { length: 255 }),
  passIv: varchar("pass_iv", { length: 255 }),
  authTag: varchar("auth_tag", { length: 255 }),
  clusterManagerId: integer("cluster_manager_id"),
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
    mainUsersClusterManagerIdForeign: foreignKey({
      columns: [table.clusterManagerId],
      foreignColumns: [clusterManagers.id],
      name: "main_users_cluster_manager_id_foreign"
    }).onDelete("set null"),
    mainUsersUserNameUnique: unique("main_users_user_name_unique").on(table.userName),
  }
});

export const whatsappOutreach = main.table("whatsapp_outreach", {
  id: serial("id").primaryKey().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  contactNumber: varchar("contact_number", { length: 50 }).notNull(),
  isActive: boolean("is_active").default(true),
  messageSent: boolean("message_sent").default(false),
  responded: boolean("responded").default(false),
  createdAt: timestamp("created_at", { mode: 'string' }),
});

export const samaSystemTracking = main.table("sama_system_tracking", {
  id: serial("id").primaryKey().notNull(),
  macAddress: varchar("mac_address", { length: 27 }).notNull(),
  activeTime: time("active_time"),
  date: timestamp("date", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  location: text("location"),
  createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => {
  return {
    samaSystemTrackingMacAddressFkey: foreignKey({
      columns: [table.macAddress],
      foreignColumns: [samaClients.macAddress],
      name: "sama_system_tracking_mac_address_fkey"
    }),
  }
});

export const gharUsers = main.table("ghar_users", {
  id: serial("id").primaryKey().notNull(),
  email: varchar("email", { length: 255 }).notNull(),
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
  employeeType: varchar("employee_type", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
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

export const zuvyQuestionType = main.table("zuvy_question_type", {
  id: serial("id").primaryKey().notNull(),
  questionType: varchar("question_type"),
});

export const shortLinks = main.table("short_links", {
  id: serial("id").primaryKey().notNull(),
  shortCode: varchar("short_code", { length: 10 }).notNull(),
  originalUrl: text("original_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  lastAccessed: timestamp("last_accessed", { withTimezone: true, mode: 'string' }),
},
(table) => {
  return {
    mainShortLinksShortCodeIdx: index("main_short_links_short_code_index").using("btree", table.shortCode.asc().nullsLast()),
    mainShortLinksShortCodeUnique: unique("main_short_links_short_code_unique").on(table.shortCode),
  }
});

export const zuvyQuizTracking = main.table("zuvy_quiz_tracking", {
  id: serial("id").primaryKey().notNull(),
  userId: integer("user_id"),
  moduleId: integer("module_id"),
  mcqId: integer("mcq_id"),
  attemptCount: integer("attempt_count").default(0),
  chapterId: integer("chapter_id"),
  status: varchar("status", { length: 255 }),
  assessmentSubmissionId: integer("assessment_submission_id"),
  questionId: integer("question_id"),
  chosenOption: integer("chosen_option"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  variantId: integer("variant_id"),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyQuizTrackingUserIdUsersIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "zuvy_quiz_tracking_user_id_users_id_fk"
    }),
    zuvyQuizTrackingAssessmentSubmissionIdZuvyAssessmentSub: foreignKey({
      columns: [table.assessmentSubmissionId],
      foreignColumns: [zuvyAssessmentSubmission.id],
      name: "zuvy_quiz_tracking_assessment_submission_id_zuvy_assessment_sub"
    }).onUpdate("cascade").onDelete("cascade"),
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
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyRecentBootcampModuleIdZuvyCourseModulesIdFk: foreignKey({
      columns: [table.moduleId],
      foreignColumns: [zuvyCourseModules.id],
      name: "zuvy_recent_bootcamp_module_id_zuvy_course_modules_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyRecentBootcampChapterIdZuvyModuleChapterIdFk: foreignKey({
      columns: [table.chapterId],
      foreignColumns: [zuvyModuleChapter.id],
      name: "zuvy_recent_bootcamp_chapter_id_zuvy_module_chapter_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
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

export const zuvyStudentApplicationRecord = main.table("zuvy_student_application_record", {
  id: serial("id").primaryKey().notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  year: text("year").notNull(),
  familyIncomeUnder3Lakhs: boolean("family_income_under_3lakhs").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  phoneNo: text("phone_no"),
  version: varchar("version", { length: 10 }),
});

export const zuvyTestCasesSubmission = main.table("zuvy_test_cases_submission", {
  id: serial("id").primaryKey().notNull(),
  testcastId: integer("testcast_id"),
  status: varchar("status", { length: 255 }),
  token: varchar("token", { length: 255 }),
  submissionId: integer("submission_id"),
  stdout: text("stdout"),
  memory: integer("memory"),
  stderr: text("stderr"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  time: numeric("time"),
  version: varchar("version", { length: 10 }),
  languageId: integer("language_id"),
},
(table) => {
  return {
    zuvyTestCasesSubmissionTestcastIdZuvyTestCasesIdFk: foreignKey({
      columns: [table.testcastId],
      foreignColumns: [zuvyTestCases.id],
      name: "zuvy_test_cases_submission_testcast_id_zuvy_test_cases_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
  }
});

export const zuvyAssessmentSubmission = main.table("zuvy_assessment_submission", {
  id: serial("id").primaryKey().notNull(),
  userId: integer("user_id").notNull(),
  marks: doublePrecision("marks"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  submitedAt: timestamp("submited_at", { withTimezone: true, mode: 'string' }),
  assessmentOutsourseId: integer("assessment_outsourse_id").notNull(),
  copyPaste: integer("copy_paste"),
  tabChange: integer("tab_change"),
  codingQuestionCount: integer("coding_question_count"),
  mcqQuestionCount: integer("mcq_question_count"),
  openEndedQuestionCount: integer("open_ended_question_count"),
  attemptedCodingQuestions: integer("attempted_coding_questions"),
  attemptedMcqQuestions: integer("attempted_mcq_questions"),
  attemptedOpenEndedQuestions: integer("attempted_open_ended_questions"),
  isPassed: boolean("is_passed"),
  codingScore: doublePrecision("coding_score"),
  openEndedScore: doublePrecision("open_ended_score"),
  mcqScore: doublePrecision("mcq_score"),
  requiredCodingScore: doublePrecision("required_coding_score"),
  requiredOpenEndedScore: doublePrecision("required_open_ended_score"),
  requiredMcqScore: doublePrecision("required_mcq_score"),
  typeOfSubmission: varchar("type_of_submission", { length: 255 }),
  percentage: doublePrecision("percentage"),
  fullScreenExit: integer("full_screen_exit"),
  eyeMomentCount: integer("eye_moment_count"),
  version: varchar("version", { length: 10 }),
  active: boolean("active").default(true).notNull(),
  reattemptApproved: boolean("reattempt_approved").default(false).notNull(),
  reattemptRequested: boolean("reattempt_requested").default(false).notNull(),
},
(table) => {
  return {
    zuvyAssessmentSubmissionAssessmentOutsourseIdZuvyOutsour: foreignKey({
      columns: [table.assessmentOutsourseId],
      foreignColumns: [zuvyOutsourseAssessments.id],
      name: "zuvy_assessment_submission_assessment_outsourse_id_zuvy_outsour"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyAssessmentSubmissionUserIdUsersIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "zuvy_assessment_submission_user_id_users_id_fk"
    }),
  }
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
  codingQuestionTagId: integer("coding_question_tag_id").array(),
  mcqTagId: integer("mcq_tag_id").array(),
  easyCodingQuestions: integer("easy_coding_questions"),
  mediumCodingQuestions: integer("medium_coding_questions"),
  hardCodingQuestions: integer("hard_coding_questions"),
  totalCodingQuestions: integer("total_coding_questions"),
  totalMcqQuestions: integer("total_mcq_questions"),
  easyMcqQuestions: integer("easy_mcq_questions"),
  mediumMcqQuestions: integer("medium_mcq_questions"),
  hardMcqQuestions: integer("hard_mcq_questions"),
  weightageCodingQuestions: integer("weightage_coding_questions"),
  weightageMcqQuestions: integer("weightage_mcq_questions"),
  easyCodingMark: doublePrecision("easy_coding_mark"),
  mediumCodingMark: doublePrecision("medium_coding_mark"),
  hardCodingMark: doublePrecision("hard_coding_mark"),
  easyMcqMark: doublePrecision("easy_mcq_mark"),
  mediumMcqMark: doublePrecision("medium_mcq_mark"),
  hardMcqMark: doublePrecision("hard_mcq_mark"),
  canEyeTrack: boolean("can_eye_track"),
  canTabChange: boolean("can_tab_change"),
  canScreenExit: boolean("can_screen_exit"),
  canCopyPaste: boolean("can_copy_paste"),
  publishDatetime: timestamp('publish_datetime', { withTimezone: true, mode: 'string' }),
    startDatetime: timestamp('start_datetime', { withTimezone: true, mode: 'string' }),
    endDatetime: timestamp('end_datetime', { withTimezone: true, mode: 'string' }),
    unpublishDatetime: timestamp('unpublish_datetime', { withTimezone: true, mode: 'string' }),
    currentState: integer('current_state').default(0),
  version: varchar("version", { length: 10 }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
  return {
    zuvyOutsourseAssessmentsChapterIdZuvyModuleChapterIdFk: foreignKey({
      columns: [table.chapterId],
      foreignColumns: [zuvyModuleChapter.id],
      name: "zuvy_outsourse_assessments_chapter_id_zuvy_module_chapter_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyOutsourseAssessmentsAssessmentIdZuvyModuleAssessment: foreignKey({
      columns: [table.assessmentId],
      foreignColumns: [zuvyModuleAssessment.id],
      name: "zuvy_outsourse_assessments_assessment_id_zuvy_module_assessment"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyOutsourseAssessmentsBootcampIdZuvyBootcampsIdFk: foreignKey({
      columns: [table.bootcampId],
      foreignColumns: [zuvyBootcamps.id],
      name: "zuvy_outsourse_assessments_bootcamp_id_zuvy_bootcamps_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyOutsourseAssessmentsModuleIdZuvyCourseModulesIdFk: foreignKey({
      columns: [table.moduleId],
      foreignColumns: [zuvyCourseModules.id],
      name: "zuvy_outsourse_assessments_module_id_zuvy_course_modules_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
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
  schoolId: integer("schoolId"),
  schoolTest: varchar("school_test", { length: 255 }),
  hienText: varchar("hien_text", { length: 2000 }),
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
  title: text("title"),
  content: text("content"),
  isRandomOptions: boolean("is_random_options").default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyModuleQuizTagIdZuvyTagsIdFk: foreignKey({
      columns: [table.tagId],
      foreignColumns: [zuvyTags.id],
      name: "zuvy_module_quiz_tag_id_zuvy_tags_id_fk"
    }),
  }
});

export const zuvyModuleQuizVariants = main.table("zuvy_module_quiz_variants", {
  id: serial("id").primaryKey().notNull(),
  quizId: integer("quiz_id"),
  question: text("question"),
  options: jsonb("options"),
  correctOption: integer("correct_option"),
  variantNumber: integer("variant_number").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyModuleQuizVariantsQuizIdFkey: foreignKey({
      columns: [table.quizId],
      foreignColumns: [zuvyModuleQuiz.id],
      name: "zuvy_module_quiz_variants_quiz_id_fkey"
    }),
  }
});

export const zuvyModuleTopics = main.table("zuvy_module_topics", {
  id: serial("id").primaryKey().notNull(),
  name: varchar("name"),
  version: varchar("version", { length: 10 }),
});

export const zuvyModuleTracking = main.table("zuvy_module_tracking", {
  id: serial("id").primaryKey().notNull(),
  userId: integer("user_id"),
  moduleId: integer("module_id").notNull(),
  progress: integer("progress").default(0),
  bootcampId: integer("bootcamp_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar("version", { length: 10 }),
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

export const zuvyModuleChapter = main.table("bytea", {
  id: serial("id").primaryKey().notNull(),
  title: varchar("title"),
  description: text("description"),
  topicId: integer("topic_id"),
  moduleId: integer("module_id"),
  // TODO: failed to parse database type 'bytea'
  file: batey("file"),
  links: jsonb("links"),
  articleContent: jsonb("article_content"),
  quizQuestions: jsonb("quiz_questions"),
  codingQuestions: integer("coding_questions"),
  assessmentId: integer("assessment_id"),
  completionDate: timestamp("completion_date", { withTimezone: true, mode: 'string' }),
  order: integer("order"),
  formQuestions: jsonb("form_questions"),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyModuleChapterModuleIdZuvyCourseModulesIdFk: foreignKey({
      columns: [table.moduleId],
      foreignColumns: [zuvyCourseModules.id],
      name: "zuvy_module_chapter_module_id_zuvy_course_modules_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyModuleChapterTopicIdZuvyModuleTopicsIdFk: foreignKey({
      columns: [table.topicId],
      foreignColumns: [zuvyModuleTopics.id],
      name: "zuvy_module_chapter_topic_id_zuvy_module_topics_id_fk"
    }),
  }
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
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyOpenEndedQuestionSubmissionQuestionIdZuvyOutsourse: foreignKey({
      columns: [table.questionId],
      foreignColumns: [zuvyOutsourseOpenEndedQuestions.id],
      name: "zuvy_open_ended_question_submission_question_id_zuvy_outsourse_"
    }),
    zuvyOpenEndedQuestionSubmissionAssessmentSubmissionIdZu: foreignKey({
      columns: [table.assessmentSubmissionId],
      foreignColumns: [zuvyAssessmentSubmission.id],
      name: "zuvy_open_ended_question_submission_assessment_submission_id_zu"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyOpenEndedQuestionSubmissionUserIdUsersIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "zuvy_open_ended_question_submission_user_id_users_id_fk"
    }),
  }
});

export const zuvyStudentAttendance = main.table("zuvy_student_attendance", {
  id: serial("id").primaryKey().notNull(),
  meetingId: text("meeting_id"),
  attendance: jsonb("attendance"),
  batchId: integer("batch_id"),
  bootcampId: integer("bootcamp_id"),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyStudentAttendanceBatchIdZuvyBatchesIdFk: foreignKey({
      columns: [table.batchId],
      foreignColumns: [zuvyBatches.id],
      name: "zuvy_student_attendance_batch_id_zuvy_batches_id_fk"
    }),
    zuvyStudentAttendanceBootcampIdZuvyBootcampsIdFk: foreignKey({
      columns: [table.bootcampId],
      foreignColumns: [zuvyBootcamps.id],
      name: "zuvy_student_attendance_bootcamp_id_zuvy_bootcamps_id_fk"
    }),
  }
});

export const zuvyChapterTracking = main.table("zuvy_chapter_tracking", {
  id: serial("id").primaryKey().notNull(),
  userId: bigserial("user_id", { mode: "bigint" }).notNull(),
  chapterId: integer("chapter_id").notNull(),
  moduleId: integer("module_id").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
  answerDetails: text("answer_Details"),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyChapterTrackingModuleIdZuvyCourseModulesIdFk: foreignKey({
      columns: [table.moduleId],
      foreignColumns: [zuvyCourseModules.id],
      name: "zuvy_chapter_tracking_module_id_zuvy_course_modules_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyChapterTrackingChapterIdZuvyModuleChapterIdFk: foreignKey({
      columns: [table.chapterId],
      foreignColumns: [zuvyModuleChapter.id],
      name: "zuvy_chapter_tracking_chapter_id_zuvy_module_chapter_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyChapterTrackingUserIdUsersIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "zuvy_chapter_tracking_user_id_users_id_fk"
    }),
  }
});

export const zuvyOutsourseCodingQuestions = main.table("zuvy_outsourse_coding_questions", {
  id: serial("id").primaryKey().notNull(),
  codingQuestionId: integer("coding_question_id"),
  assessmentOutsourseId: integer("assessment_outsourse_id").notNull(),
  bootcampId: integer("bootcamp_id").notNull(),
  chapterId: integer("chapter_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyOutsourseCodingQuestionsCodingQuestionIdZuvyCoding: foreignKey({
      columns: [table.codingQuestionId],
      foreignColumns: [zuvyCodingQuestions.id],
      name: "zuvy_outsourse_coding_questions_coding_question_id_zuvy_coding_"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyOutsourseCodingQuestionsAssessmentOutsourseIdZuvyOu: foreignKey({
      columns: [table.assessmentOutsourseId],
      foreignColumns: [zuvyOutsourseAssessments.id],
      name: "zuvy_outsourse_coding_questions_assessment_outsourse_id_zuvy_ou"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyOutsourseCodingQuestionsBootcampIdZuvyBootcampsIdF: foreignKey({
      columns: [table.bootcampId],
      foreignColumns: [zuvyBootcamps.id],
      name: "zuvy_outsourse_coding_questions_bootcamp_id_zuvy_bootcamps_id_f"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyOutsourseCodingQuestionsChapterIdZuvyModuleChapter: foreignKey({
      columns: [table.chapterId],
      foreignColumns: [zuvyModuleChapter.id],
      name: "zuvy_outsourse_coding_questions_chapter_id_zuvy_module_chapter_"
    }).onUpdate("cascade").onDelete("cascade"),
  }
});

export const zuvyOutsourseQuizzes = main.table("zuvy_outsourse_quizzes", {
  quizId: integer("quiz_id"),
  marks: integer("marks"),
  assessmentOutsourseId: integer("assessment_outsourse_id").notNull(),
  bootcampId: integer("bootcamp_id").notNull(),
  chapterId: integer("chapter_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  id: serial("id").primaryKey().notNull(),
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyOutsourseQuizzesQuizIdZuvyModuleQuizIdFk: foreignKey({
      columns: [table.quizId],
      foreignColumns: [zuvyModuleQuiz.id],
      name: "zuvy_outsourse_quizzes_quiz_id_zuvy_module_quiz_id_fk"
    }),
    zuvyOutsourseQuizzesBootcampIdZuvyBootcampsIdFk: foreignKey({
      columns: [table.bootcampId],
      foreignColumns: [zuvyBootcamps.id],
      name: "zuvy_outsourse_quizzes_bootcamp_id_zuvy_bootcamps_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyOutsourseQuizzesChapterIdZuvyModuleChapterIdFk: foreignKey({
      columns: [table.chapterId],
      foreignColumns: [zuvyModuleChapter.id],
      name: "zuvy_outsourse_quizzes_chapter_id_zuvy_module_chapter_id_fk"
    }).onUpdate("cascade").onDelete("cascade"),
    zuvyOutsourseQuizzesAssessmentOutsourseIdZuvyOutsourseA: foreignKey({
      columns: [table.assessmentOutsourseId],
      foreignColumns: [zuvyOutsourseAssessments.id],
      name: "zuvy_outsourse_quizzes_assessment_outsourse_id_zuvy_outsourse_a"
    }).onUpdate("cascade").onDelete("cascade"),
  }
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
  version: varchar("version", { length: 10 }),
},
(table) => {
  return {
    zuvyModuleFormChapterIdZuvyModuleChapterIdFk: foreignKey({
      columns: [table.chapterId],
      foreignColumns: [zuvyModuleChapter.id],
      name: "zuvy_module_form_chapter_id_zuvy_module_chapter_id_fk"
    }),
    zuvyModuleFormTypeIdZuvyQuestionTypeIdFk: foreignKey({
      columns: [table.typeId],
      foreignColumns: [zuvyQuestionType.id],
      name: "zuvy_module_form_type_id_zuvy_question_type_id_fk"
    }),
  }
});

export const zuvyCodingQuestions = main.table("zuvy_coding_questions", {
  id: serial("id").primaryKey().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  difficulty: varchar("difficulty", { length: 50 }),
  tagId: integer("tag_id"),
  constraints: text("constraints"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  usage: integer("usage"),
  content: text("content"),
  version: varchar("version", { length: 10 }),
  embedding: jsonb("embedding"),
},
(table) => {
  return {
    zuvyCodingQuestionsTagIdFkey: foreignKey({
      columns: [table.tagId],
      foreignColumns: [zuvyTags.id],
      name: "zuvy_coding_questions_tag_id_fkey"
    }),
  }
});


import { relations } from "drizzle-orm/relations";

export const merakiStudentsRelations = relations(merakiStudents, ({one}) => ({
  partners: one(partners, {
    fields: [merakiStudents.partnerId],
    references: [partners.id]
  }),
}));

export const partnersRelations = relations(partners, ({many}) => ({
  merakiStudentss: many(merakiStudents),
  cUserss: many(cUsers),
  studentss: many(students),
  chanakyaPartnerRelationships: many(chanakyaPartnerRelationship),
  partnerSpaces: many(partnerSpace),
  emailReports: many(emailReport),
  partnerSpecificBatchesV2s: many(partnerSpecificBatchesV2),
  partnerRelationships: many(partnerRelationship),
  partnerUsers: many(partnerUser),
  partnerSpecificBatchess: many(partnerSpecificBatches),
  pathwayPartnerGroups: many(pathwayPartnerGroup),
  registrationFormDatas: many(registrationFormData),
  registrationFormStructures: many(registrationFormStructure),
  userss: many(users),
}));

export const cUsersRelations = relations(cUsers, ({one, many}) => ({
  partners: one(partners, {
    fields: [cUsers.partnerId],
    references: [partners.id]
  }),
  feedbackss: many(feedbacks),
  interviewOwnerss: many(interviewOwners),
}));

export const zuvySessionRecordViewsRelations = relations(zuvySessionRecordViews, ({one}) => ({
  users: one(users, {
    fields: [zuvySessionRecordViews.userId],
    references: [users.id]
  }),
  zuvySessions: one(zuvySessions, {
    fields: [zuvySessionRecordViews.sessionId],
    references: [zuvySessions.id]
  }),
}));

export const usersRelations = relations(users, ({one, many}) => ({
  zuvySessionRecordViewss: many(zuvySessionRecordViews),
  zuvyAssignmentSubmissions: many(zuvyAssignmentSubmission),
  zuvyBootcampTrackings: many(zuvyBootcampTracking),
  engHistorys: many(engHistory),
  userRoless: many(userRoles),
  exercisesHistorys: many(exercisesHistory),
  zuvyAssessmentReattempts: many(zuvyAssessmentReattempt),
  courseEnrolmentss: many(courseEnrolments),
  classRegistrationss: many(classRegistrations),
  volunteers: many(volunteer),
  courseCompletions: many(courseCompletion),
  courseCompletionV2s: many(courseCompletionV2),
  courseEditorStatuss: many(courseEditorStatus),
  exerciseCompletions: many(exerciseCompletion),
  mentorTrees_mentorId: many(mentorTree, {
    relationName: "mentorTree_mentorId_users_id"
  }),
  mentorTrees_menteeId: many(mentorTree, {
    relationName: "mentorTree_menteeId_users_id"
  }),
  zuvyFormTrackings: many(zuvyFormTracking),
  pathwayCompletions: many(pathwayCompletion),
  pathwayTrackingRequestDetailss_mentorId: many(pathwayTrackingRequestDetails, {
    relationName: "pathwayTrackingRequestDetails_mentorId_users_id"
  }),
  pathwayTrackingRequestDetailss_menteeId: many(pathwayTrackingRequestDetails, {
    relationName: "pathwayTrackingRequestDetails_menteeId_users_id"
  }),
  pathwayTrackingRequests_mentorId: many(pathwayTrackingRequest, {
    relationName: "pathwayTrackingRequest_mentorId_users_id"
  }),
  pathwayTrackingRequests_menteeId: many(pathwayTrackingRequest, {
    relationName: "pathwayTrackingRequest_menteeId_users_id"
  }),
  pathwaysOngoingTopics: many(pathwaysOngoingTopic),
  sansaarUserRoless: many(sansaarUserRoles),
  studentPathwayss: many(studentPathways),
  userTokenss_userId: many(userTokens, {
    relationName: "userTokens_userId_users_id"
  }),
  userTokenss_userEmail: many(userTokens, {
    relationName: "userTokens_userEmail_users_email"
  }),
  mentorss_mentor: many(mentors, {
    relationName: "mentors_mentor_users_id"
  }),
  mentorss_mentee: many(mentors, {
    relationName: "mentors_mentee_users_id"
  }),
  mentorss_userId: many(mentors, {
    relationName: "mentors_userId_users_id"
  }),
  merakiCertificates: many(merakiCertificate),
  ongoingTopicss: many(ongoingTopics),
  courseCompletionV3s: many(courseCompletionV3),
  pathwayCompletionV2s: many(pathwayCompletionV2),
  assessmentsHistorys: many(assessmentsHistory),
  exerciseCompletionV2s: many(exerciseCompletionV2),
  clusterManagerss: many(clusterManagers, {
    relationName: "clusterManagers_adminId_users_id"
  }),
  moduleCompletionV2s: many(moduleCompletionV2),
  assessmentResults: many(assessmentResult),
  learningTrackStatuss: many(learningTrackStatus),
  c4CaTeacherss: many(c4CaTeachers),
  assessmentOutcomes: many(assessmentOutcome),
  pathwaysOngoingTopicOutcomes: many(pathwaysOngoingTopicOutcome),
  learningTrackStatusOutcomes: many(learningTrackStatusOutcome),
  zuvyBatchEnrollmentss: many(zuvyBatchEnrollments),
  c4CaRoless: many(c4CaRoles),
  careerTeacherss: many(careerTeachers),
  zuvyBatchess: many(zuvyBatches),
  zuvyCodingSubmissions: many(zuvyCodingSubmission),
  zuvyProjectTrackings: many(zuvyProjectTracking),
  partners: one(partners, {
    fields: [users.partnerId],
    references: [partners.id]
  }),
  partnerSpace: one(partnerSpace, {
    fields: [users.spaceId],
    references: [partnerSpace.id]
  }),
  spaceGroup: one(spaceGroup, {
    fields: [users.groupId],
    references: [spaceGroup.id]
  }),
  c4CaPartners: one(c4CaPartners, {
    fields: [users.c4CaPartnerId],
    references: [c4CaPartners.id]
  }),
  facilitators: one(facilitators, {
    fields: [users.c4CaFacilitatorId],
    references: [facilitators.id]
  }),
  clusterManagers: one(clusterManagers, {
    fields: [users.clusterManagerId],
    references: [clusterManagers.id],
    relationName: "users_clusterManagerId_clusterManagers_id"
  }),
  teacherCapacityBuildings: many(teacherCapacityBuilding),
  zuvyQuizTrackings: many(zuvyQuizTracking),
  zuvyRecentBootcamps: many(zuvyRecentBootcamp),
  zuvyAssessmentSubmissions: many(zuvyAssessmentSubmission),
  zuvyModuleTrackings: many(zuvyModuleTracking),
  zuvyOpenEndedQuestionSubmissions: many(zuvyOpenEndedQuestionSubmission),
  zuvyChapterTrackings: many(zuvyChapterTracking),
}));

export const zuvySessionsRelations = relations(zuvySessions, ({one, many}) => ({
  zuvySessionRecordViewss: many(zuvySessionRecordViews),
  childMerges: many(zuvySessionMerge, { relationName: 'childSession' }),
  parentMerges: many(zuvySessionMerge, { relationName: 'parentSession' }),
  videoRecordings: many(zuvySessionVideoRecordings),
  zuvyBatches: one(zuvyBatches, {
    fields: [zuvySessions.batchId],
    references: [zuvyBatches.id]
  }),
  zuvyBootcamps: one(zuvyBootcamps, {
    fields: [zuvySessions.bootcampId],
    references: [zuvyBootcamps.id]
  }),
  module: one(zuvyCourseModules, {
    fields: [zuvySessions.moduleId],
    references: [zuvyCourseModules.id]
  }),
}));

export const zuvySessionMergeRelations = relations(zuvySessionMerge, ({ one }) => ({
  childSession: one(zuvySessions, {
    fields: [zuvySessionMerge.childSessionId],
    references: [zuvySessions.id],
    relationName: 'childSession'
  }),
  parentSession: one(zuvySessions, {
    fields: [zuvySessionMerge.parentSessionId],
    references: [zuvySessions.id],
    relationName: 'parentSession'
  }),
}));

export const zuvySessionVideoRecordingsRelations = relations(zuvySessionVideoRecordings, ({ one }) => ({
  session: one(zuvySessions, {
    fields: [zuvySessionVideoRecordings.sessionId],
    references: [zuvySessions.id],
  }),
  batch: one(zuvyBatches, {
    fields: [zuvySessionVideoRecordings.batchId],
    references: [zuvyBatches.id],
  }),
  bootcamp: one(zuvyBootcamps, {
    fields: [zuvySessionVideoRecordings.bootcampId],
    references: [zuvyBootcamps.id],
  }),
  user: one(users, {
    fields: [zuvySessionVideoRecordings.userId],
    references: [users.id],
  }),
}));

export const zuvySessionAttendanceRelations = relations(zuvyStudentAttendanceRecords, ({ one }) => ({
  user: one(users, {
    fields: [zuvyStudentAttendanceRecords.userId],
    references: [users.id],
  }),
  batch: one(zuvyBatches, {
    fields: [zuvyStudentAttendanceRecords.batchId],
    references: [zuvyBatches.id],
  }),
  bootcamp: one(zuvyBootcamps, {
    fields: [zuvyStudentAttendanceRecords.bootcampId],
    references: [zuvyBootcamps.id],
  }),
}));

export const studentsSchoolRelations = relations(studentsSchool, ({one}) => ({
  school: one(school, {
    fields: [studentsSchool.schoolId],
    references: [school.id]
  }),
  students: one(students, {
    fields: [studentsSchool.studentId],
    references: [students.id]
  }),
}));

export const schoolRelations = relations(school, ({many}) => ({
  studentsSchools: many(studentsSchool),
  schoolStages: many(schoolStage),
  campusSchools: many(campusSchool),
}));

export const studentsRelations = relations(students, ({one, many}) => ({
  studentsSchools: many(studentsSchool),
  studentsStagess: many(studentsStages),
  enrolmentKeyss: many(enrolmentKeys),
  partners: one(partners, {
    fields: [students.partnerId],
    references: [partners.id]
  }),
  interviewOwners: one(interviewOwners, {
    fields: [students.currentOwnerId],
    references: [interviewOwners.id]
  }),
  schoolStage: one(schoolStage, {
    fields: [students.schoolStageId],
    references: [schoolStage.id]
  }),
  stageTransitionss: many(stageTransitions),
  studentCampuss: many(studentCampus),
  dashboardFlagss: many(dashboardFlags),
  studentDonors: many(studentDonor),
  feedbackss: many(feedbacks),
  interviewSlots: many(interviewSlot),
  slotBookeds: many(slotBooked),
  studentDocumentss: many(studentDocuments),
  studentJobDetailss: many(studentJobDetails),
}));

export const schoolStageRelations = relations(schoolStage, ({one, many}) => ({
  school: one(school, {
    fields: [schoolStage.schoolId],
    references: [school.id]
  }),
  studentss: many(students),
  subStages: many(subStage),
}));

export const zuvyOpenEndedQuestionsRelations = relations(zuvyOpenEndedQuestions, ({one, many}) => ({
  zuvyTags_tagId: one(zuvyTags, {
    fields: [zuvyOpenEndedQuestions.tagId],
    references: [zuvyTags.id],
    relationName: "zuvyOpenEndedQuestions_tagId_zuvyTags_id"
  }),
  zuvyOutsourseOpenEndedQuestionss_openEndedQuestionId: many(zuvyOutsourseOpenEndedQuestions, {
    relationName: "zuvyOutsourseOpenEndedQuestions_openEndedQuestionId_zuvyOpenEndedQuestions_id"
  }),
}));

export const zuvyTagsRelations = relations(zuvyTags, ({many}) => ({
  zuvyOpenEndedQuestionss_tagId: many(zuvyOpenEndedQuestions, {
    relationName: "zuvyOpenEndedQuestions_tagId_zuvyTags_id"
  }),
  zuvyModuleQuizs: many(zuvyModuleQuiz),
  zuvyCodingQuestionss: many(zuvyCodingQuestions),
}));

export const campusSchoolRelations = relations(campusSchool, ({one}) => ({
  campus: one(campus, {
    fields: [campusSchool.campusId],
    references: [campus.id]
  }),
  school: one(school, {
    fields: [campusSchool.schoolId],
    references: [school.id]
  }),
}));

export const campusRelations = relations(campus, ({many}) => ({
  campusSchools: many(campusSchool),
  studentCampuss: many(studentCampus),
}));

export const studentsStagesRelations = relations(studentsStages, ({one}) => ({
  students: one(students, {
    fields: [studentsStages.studentId],
    references: [students.id]
  }),
}));

export const zuvyOutsourseOpenEndedQuestionsRelations = relations(zuvyOutsourseOpenEndedQuestions, ({one, many}) => ({
  zuvyOpenEndedQuestions_openEndedQuestionId: one(zuvyOpenEndedQuestions, {
    fields: [zuvyOutsourseOpenEndedQuestions.openEndedQuestionId],
    references: [zuvyOpenEndedQuestions.id],
    relationName: "zuvyOutsourseOpenEndedQuestions_openEndedQuestionId_zuvyOpenEndedQuestions_id"
  }),
  zuvyOutsourseAssessments_assessmentOutsourseId: one(zuvyOutsourseAssessments, {
    fields: [zuvyOutsourseOpenEndedQuestions.assessmentOutsourseId],
    references: [zuvyOutsourseAssessments.id],
    relationName: "zuvyOutsourseOpenEndedQuestions_assessmentOutsourseId_zuvyOutsourseAssessments_id"
  }),
  zuvyBootcamps_bootcampId: one(zuvyBootcamps, {
    fields: [zuvyOutsourseOpenEndedQuestions.bootcampId],
    references: [zuvyBootcamps.id],
    relationName: "zuvyOutsourseOpenEndedQuestions_bootcampId_zuvyBootcamps_id"
  }),
  zuvyCourseModules_moduleId: one(zuvyCourseModules, {
    fields: [zuvyOutsourseOpenEndedQuestions.moduleId],
    references: [zuvyCourseModules.id],
    relationName: "zuvyOutsourseOpenEndedQuestions_moduleId_zuvyCourseModules_id"
  }),
  zuvyModuleChapter_chapterId: one(zuvyModuleChapter, {
    fields: [zuvyOutsourseOpenEndedQuestions.chapterId],
    references: [zuvyModuleChapter.id],
    relationName: "zuvyOutsourseOpenEndedQuestions_chapterId_zuvyModuleChapter_id"
  }),
  zuvyOpenEndedQuestionSubmissions: many(zuvyOpenEndedQuestionSubmission),
}));

export const zuvyOutsourseAssessmentsRelations = relations(zuvyOutsourseAssessments, ({one, many}) => ({
  zuvyOutsourseOpenEndedQuestionss_assessmentOutsourseId: many(zuvyOutsourseOpenEndedQuestions, {
    relationName: "zuvyOutsourseOpenEndedQuestions_assessmentOutsourseId_zuvyOutsourseAssessments_id"
  }),
  zuvyAssessmentSubmissions: many(zuvyAssessmentSubmission),
  zuvyModuleChapter: one(zuvyModuleChapter, {
    fields: [zuvyOutsourseAssessments.chapterId],
    references: [zuvyModuleChapter.id]
  }),
  zuvyModuleAssessment: one(zuvyModuleAssessment, {
    fields: [zuvyOutsourseAssessments.assessmentId],
    references: [zuvyModuleAssessment.id]
  }),
  zuvyBootcamps: one(zuvyBootcamps, {
    fields: [zuvyOutsourseAssessments.bootcampId],
    references: [zuvyBootcamps.id]
  }),
  zuvyCourseModules: one(zuvyCourseModules, {
    fields: [zuvyOutsourseAssessments.moduleId],
    references: [zuvyCourseModules.id]
  }),
  zuvyOutsourseCodingQuestionss: many(zuvyOutsourseCodingQuestions),
  zuvyOutsourseQuizzess: many(zuvyOutsourseQuizzes),
}));

export const zuvyBootcampsRelations = relations(zuvyBootcamps, ({many}) => ({
  zuvyOutsourseOpenEndedQuestionss_bootcampId: many(zuvyOutsourseOpenEndedQuestions, {
    relationName: "zuvyOutsourseOpenEndedQuestions_bootcampId_zuvyBootcamps_id"
  }),
  zuvyAssignmentSubmissions: many(zuvyAssignmentSubmission),
  zuvyBootcampTrackings: many(zuvyBootcampTracking),
  zuvySessionss: many(zuvySessions),
  zuvyBatchEnrollmentss: many(zuvyBatchEnrollments),
  zuvyBootcampTypes: many(zuvyBootcampType),
  zuvyBatchess: many(zuvyBatches),
  zuvyProjectTrackings: many(zuvyProjectTracking),
  zuvyRecentBootcamps: many(zuvyRecentBootcamp),
  zuvyOutsourseAssessmentss: many(zuvyOutsourseAssessments),
  zuvyModuleTrackings: many(zuvyModuleTracking),
  zuvyStudentAttendances: many(zuvyStudentAttendance),
  zuvyOutsourseCodingQuestionss: many(zuvyOutsourseCodingQuestions),
  zuvyOutsourseQuizzess: many(zuvyOutsourseQuizzes),
}));

export const zuvyCourseModulesRelations = relations(zuvyCourseModules, ({one, many}) => ({
  zuvyOutsourseOpenEndedQuestionss_moduleId: many(zuvyOutsourseOpenEndedQuestions, {
    relationName: "zuvyOutsourseOpenEndedQuestions_moduleId_zuvyCourseModules_id"
  }),
  zuvyCourseProjects: one(zuvyCourseProjects, {
    fields: [zuvyCourseModules.projectId],
    references: [zuvyCourseProjects.id]
  }),
  zuvyProjectTrackings: many(zuvyProjectTracking),
  zuvyRecentBootcamps: many(zuvyRecentBootcamp),
  zuvyOutsourseAssessmentss: many(zuvyOutsourseAssessments),
  zuvyModuleChapters: many(zuvyModuleChapter),
  zuvyChapterTrackings: many(zuvyChapterTracking),
}));

export const zuvyModuleChapterRelations = relations(zuvyModuleChapter, ({one, many}) => ({
  zuvyOutsourseOpenEndedQuestionss_chapterId: many(zuvyOutsourseOpenEndedQuestions, {
    relationName: "zuvyOutsourseOpenEndedQuestions_chapterId_zuvyModuleChapter_id"
  }),
  zuvyPracticeCodes: many(zuvyPracticeCode),
  zuvyRecentBootcamps: many(zuvyRecentBootcamp),
  zuvyOutsourseAssessmentss: many(zuvyOutsourseAssessments),
  zuvyCourseModules: one(zuvyCourseModules, {
    fields: [zuvyModuleChapter.moduleId],
    references: [zuvyCourseModules.id]
  }),
  zuvyModuleTopics: one(zuvyModuleTopics, {
    fields: [zuvyModuleChapter.topicId],
    references: [zuvyModuleTopics.id]
  }),
  zuvyChapterTrackings: many(zuvyChapterTracking),
  zuvyOutsourseCodingQuestionss: many(zuvyOutsourseCodingQuestions),
  zuvyOutsourseQuizzess: many(zuvyOutsourseQuizzes),
  zuvyModuleForms: many(zuvyModuleForm),
}));

export const zuvyAssignmentSubmissionRelations = relations(zuvyAssignmentSubmission, ({one}) => ({
  zuvyBootcamps: one(zuvyBootcamps, {
    fields: [zuvyAssignmentSubmission.bootcampId],
    references: [zuvyBootcamps.id]
  }),
  users: one(users, {
    fields: [zuvyAssignmentSubmission.userId],
    references: [users.id]
  }),
}));

export const zuvyBootcampTrackingRelations = relations(zuvyBootcampTracking, ({one}) => ({
  users: one(users, {
    fields: [zuvyBootcampTracking.userId],
    references: [users.id]
  }),
  zuvyBootcamps: one(zuvyBootcamps, {
    fields: [zuvyBootcampTracking.bootcampId],
    references: [zuvyBootcamps.id]
  }),
}));

export const zuvyCourseProjectsRelations = relations(zuvyCourseProjects, ({many}) => ({
  zuvyCourseModuless: many(zuvyCourseModules),
  zuvyProjectTrackings: many(zuvyProjectTracking),
}));

export const engLevelwiseRelations = relations(engLevelwise, ({one}) => ({
  engArticles: one(engArticles, {
    fields: [engLevelwise.articleId],
    references: [engArticles.id]
  }),
}));

export const engArticlesRelations = relations(engArticles, ({many}) => ({
  engLevelwises: many(engLevelwise),
  engHistorys: many(engHistory),
}));

export const engHistoryRelations = relations(engHistory, ({one}) => ({
  users: one(users, {
    fields: [engHistory.userId],
    references: [users.id]
  }),
  engArticles: one(engArticles, {
    fields: [engHistory.engArticlesId],
    references: [engArticles.id]
  }),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
  users: one(users, {
    fields: [userRoles.userId],
    references: [users.id]
  }),
}));

export const exercisesHistoryRelations = relations(exercisesHistory, ({one}) => ({
  users: one(users, {
    fields: [exercisesHistory.userId],
    references: [users.id]
  }),
  c4CaTeams: one(c4CaTeams, {
    fields: [exercisesHistory.teamId],
    references: [c4CaTeams.id]
  }),
}));

export const c4CaTeamsRelations = relations(c4CaTeams, ({one, many}) => ({
  exercisesHistorys: many(exercisesHistory),
  ongoingTopicss: many(ongoingTopics),
  courseCompletionV3s: many(courseCompletionV3),
  pathwayCompletionV2s: many(pathwayCompletionV2),
  assessmentsHistorys: many(assessmentsHistory),
  exerciseCompletionV2s: many(exerciseCompletionV2),
  c4CaStudentsProjectDetails: many(c4CaStudentsProjectDetail),
  moduleCompletionV2s: many(moduleCompletionV2),
  assessmentResults: many(assessmentResult),
  learningTrackStatuss: many(learningTrackStatus),
  assessmentOutcomes: many(assessmentOutcome),
  c4CaTeamProjectsubmitSolutions: many(c4CaTeamProjectsubmitSolution),
  c4CaTeamProjecttopics: many(c4CaTeamProjecttopic),
  c4CaTeachers: one(c4CaTeachers, {
    fields: [c4CaTeams.teacherId],
    references: [c4CaTeachers.id]
  }),
  learningTrackStatusOutcomes: many(learningTrackStatusOutcome),
}));

export const zuvyAssessmentReattemptRelations = relations(zuvyAssessmentReattempt, ({one}) => ({
  zuvyAssessmentSubmission: one(zuvyAssessmentSubmission, {
    fields: [zuvyAssessmentReattempt.assessmentSubmissionId],
    references: [zuvyAssessmentSubmission.id]
  }),
  users: one(users, {
    fields: [zuvyAssessmentReattempt.userId],
    references: [users.id]
  }),
}));

export const zuvyAssessmentSubmissionRelations = relations(zuvyAssessmentSubmission, ({one, many}) => ({
  zuvyAssessmentReattempts: many(zuvyAssessmentReattempt),
  zuvyPracticeCodes: many(zuvyPracticeCode),
  zuvyQuizTrackings: many(zuvyQuizTracking),
  zuvyOutsourseAssessments: one(zuvyOutsourseAssessments, {
    fields: [zuvyAssessmentSubmission.assessmentOutsourseId],
    references: [zuvyOutsourseAssessments.id]
  }),
  users: one(users, {
    fields: [zuvyAssessmentSubmission.userId],
    references: [users.id]
  }),
  zuvyOpenEndedQuestionSubmissions: many(zuvyOpenEndedQuestionSubmission),
}));

export const zuvyBatchesRelations = relations(zuvyBatches, ({one, many}) => ({
  zuvySessionss: many(zuvySessions),
  zuvyBatchEnrollmentss: many(zuvyBatchEnrollments),
  zuvyBootcamps: one(zuvyBootcamps, {
    fields: [zuvyBatches.bootcampId],
    references: [zuvyBootcamps.id]
  }),
  users: one(users, {
    fields: [zuvyBatches.instructorId],
    references: [users.id]
  }),
  zuvyStudentAttendances: many(zuvyStudentAttendance),
}));

export const incomingCallsRelations = relations(incomingCalls, ({one}) => ({
  contacts: one(contacts, {
    fields: [incomingCalls.contactId],
    references: [contacts.id]
  }),
}));

export const contactsRelations = relations(contacts, ({many}) => ({
  incomingCallss: many(incomingCalls),
}));

export const courseEnrolmentsRelations = relations(courseEnrolments, ({one}) => ({
  users: one(users, {
    fields: [courseEnrolments.studentId],
    references: [users.id]
  }),
  courses: one(courses, {
    fields: [courseEnrolments.courseId],
    references: [courses.id]
  }),
}));

export const coursesRelations = relations(courses, ({many}) => ({
  courseEnrolmentss: many(courseEnrolments),
  courseRelations_courseId: many(courseRelation, {
    relationName: "courseRelation_courseId_courses_id"
  }),
  courseRelations_reliesOn: many(courseRelation, {
    relationName: "courseRelation_reliesOn_courses_id"
  }),
  exercisess: many(exercises),
  courseCategoriess: many(courseCategories),
  courseCompletions: many(courseCompletion),
  pathwayCoursess: many(pathwayCourses),
  classesToCoursess: many(classesToCourses),
}));

export const courseRelationRelations = relations(courseRelation, ({one}) => ({
  courses_courseId: one(courses, {
    fields: [courseRelation.courseId],
    references: [courses.id],
    relationName: "courseRelation_courseId_courses_id"
  }),
  courses_reliesOn: one(courses, {
    fields: [courseRelation.reliesOn],
    references: [courses.id],
    relationName: "courseRelation_reliesOn_courses_id"
  }),
}));

export const questionSetsRelations = relations(questionSets, ({one, many}) => ({
  testVersions: one(testVersions, {
    fields: [questionSets.versionId],
    references: [testVersions.id]
  }),
  enrolmentKeyss: many(enrolmentKeys),
}));

export const testVersionsRelations = relations(testVersions, ({many}) => ({
  questionSetss: many(questionSets),
}));

export const enrolmentKeysRelations = relations(enrolmentKeys, ({one}) => ({
  students: one(students, {
    fields: [enrolmentKeys.studentId],
    references: [students.id]
  }),
  questionSets: one(questionSets, {
    fields: [enrolmentKeys.questionSetId],
    references: [questionSets.id]
  }),
}));

export const exercisesRelations = relations(exercises, ({one, many}) => ({
  courses: one(courses, {
    fields: [exercises.courseId],
    references: [courses.id]
  }),
  exerciseCompletions: many(exerciseCompletion),
  classesToCoursess: many(classesToCourses),
}));

export const assessmentRelations = relations(assessment, ({one, many}) => ({
  coursesV2: one(coursesV2, {
    fields: [assessment.courseId],
    references: [coursesV2.id]
  }),
  exercisesV2: one(exercisesV2, {
    fields: [assessment.exerciseId],
    references: [exercisesV2.id]
  }),
  pathwaysOngoingTopics: many(pathwaysOngoingTopic),
  assessmentResults: many(assessmentResult),
}));

export const coursesV2Relations = relations(coursesV2, ({many}) => ({
  assessments: many(assessment),
  exercisesV2s: many(exercisesV2),
  courseCompletionV2s: many(courseCompletionV2),
  courseEditorStatuss: many(courseEditorStatus),
  courseProductionVersionss: many(courseProductionVersions),
  pathwayCoursesV2s: many(pathwayCoursesV2),
  pathwaysOngoingTopics: many(pathwaysOngoingTopic),
  recordVersionsOfPostDeleteExercisedetailss: many(recordVersionsOfPostDeleteExercisedetails),
  classesToCoursess: many(classesToCourses),
}));

export const exercisesV2Relations = relations(exercisesV2, ({one, many}) => ({
  assessments: many(assessment),
  coursesV2: one(coursesV2, {
    fields: [exercisesV2.courseId],
    references: [coursesV2.id]
  }),
  pathwaysOngoingTopics: many(pathwaysOngoingTopic),
  recordVersionsOfPostDeleteExercisedetailss: many(recordVersionsOfPostDeleteExercisedetails),
  classesToCoursess: many(classesToCourses),
  learningTrackStatuss: many(learningTrackStatus),
}));

export const interviewOwnersRelations = relations(interviewOwners, ({one, many}) => ({
  studentss: many(students),
  cUsers: one(cUsers, {
    fields: [interviewOwners.userId],
    references: [cUsers.id]
  }),
  interviewSlots: many(interviewSlot),
}));

export const stageTransitionsRelations = relations(stageTransitions, ({one, many}) => ({
  students: one(students, {
    fields: [stageTransitions.studentId],
    references: [students.id]
  }),
  interviewSlots: many(interviewSlot),
}));

export const studentCampusRelations = relations(studentCampus, ({one}) => ({
  students: one(students, {
    fields: [studentCampus.studentId],
    references: [students.id]
  }),
  campus: one(campus, {
    fields: [studentCampus.campusId],
    references: [campus.id]
  }),
}));

export const chanakyaUserRolesRelations = relations(chanakyaUserRoles, ({one, many}) => ({
  chanakyaRoles: one(chanakyaRoles, {
    fields: [chanakyaUserRoles.roles],
    references: [chanakyaRoles.id]
  }),
  chanakyaPrivilege: one(chanakyaPrivilege, {
    fields: [chanakyaUserRoles.privilege],
    references: [chanakyaPrivilege.id]
  }),
  chanakyaAccesss: many(chanakyaAccess),
}));

export const chanakyaRolesRelations = relations(chanakyaRoles, ({many}) => ({
  chanakyaUserRoless: many(chanakyaUserRoles),
}));

export const chanakyaPrivilegeRelations = relations(chanakyaPrivilege, ({many}) => ({
  chanakyaUserRoless: many(chanakyaUserRoles),
}));

export const chanakyaAccessRelations = relations(chanakyaAccess, ({one}) => ({
  chanakyaUserRoles: one(chanakyaUserRoles, {
    fields: [chanakyaAccess.userRoleId],
    references: [chanakyaUserRoles.id]
  }),
}));

export const chanakyaPartnerRelationshipRelations = relations(chanakyaPartnerRelationship, ({one}) => ({
  chanakyaPartnerGroup: one(chanakyaPartnerGroup, {
    fields: [chanakyaPartnerRelationship.partnerGroupId],
    references: [chanakyaPartnerGroup.id]
  }),
  partners: one(partners, {
    fields: [chanakyaPartnerRelationship.partnerId],
    references: [partners.id]
  }),
}));

export const chanakyaPartnerGroupRelations = relations(chanakyaPartnerGroup, ({many}) => ({
  chanakyaPartnerRelationships: many(chanakyaPartnerRelationship),
}));

export const classesRelations = relations(classes, ({one, many}) => ({
  category: one(category, {
    fields: [classes.categoryId],
    references: [category.id]
  }),
  recurringClasses: one(recurringClasses, {
    fields: [classes.recurringId],
    references: [recurringClasses.id]
  }),
  volunteer: one(volunteer, {
    fields: [classes.volunteerId],
    references: [volunteer.id]
  }),
  classRegistrationss: many(classRegistrations),
  classesMails: many(classesMail),
  partnerSpecificBatchesV2s: many(partnerSpecificBatchesV2),
  mergedClassess_classId: many(mergedClasses, {
    relationName: "mergedClasses_classId_classes_id"
  }),
  mergedClassess_mergedClassId: many(mergedClasses, {
    relationName: "mergedClasses_mergedClassId_classes_id"
  }),
  partnerSpecificBatchess: many(partnerSpecificBatches),
  classesToCoursess: many(classesToCourses),
}));

export const categoryRelations = relations(category, ({many}) => ({
  classess: many(classes),
  courseCategoriess: many(courseCategories),
}));

export const recurringClassesRelations = relations(recurringClasses, ({many}) => ({
  classess: many(classes),
  partnerSpecificBatchesV2s: many(partnerSpecificBatchesV2),
  partnerSpecificBatchess: many(partnerSpecificBatches),
}));

export const volunteerRelations = relations(volunteer, ({one, many}) => ({
  classess: many(classes),
  users: one(users, {
    fields: [volunteer.userId],
    references: [users.id]
  }),
}));

export const classRegistrationsRelations = relations(classRegistrations, ({one}) => ({
  classes: one(classes, {
    fields: [classRegistrations.classId],
    references: [classes.id]
  }),
  users: one(users, {
    fields: [classRegistrations.userId],
    references: [users.id]
  }),
}));

export const classesMailRelations = relations(classesMail, ({one}) => ({
  classes: one(classes, {
    fields: [classesMail.classId],
    references: [classes.id]
  }),
}));

export const partnerSpaceRelations = relations(partnerSpace, ({one, many}) => ({
  partners: one(partners, {
    fields: [partnerSpace.partnerId],
    references: [partners.id]
  }),
  partnerSpecificBatchesV2s: many(partnerSpecificBatchesV2),
  spaceGroups: many(spaceGroup),
  partnerSpecificBatchess: many(partnerSpecificBatches),
  userss: many(users),
}));

export const courseCategoriesRelations = relations(courseCategories, ({one}) => ({
  courses: one(courses, {
    fields: [courseCategories.courseId],
    references: [courses.id]
  }),
  category: one(category, {
    fields: [courseCategories.categoryId],
    references: [category.id]
  }),
}));

export const courseCompletionRelations = relations(courseCompletion, ({one}) => ({
  users: one(users, {
    fields: [courseCompletion.userId],
    references: [users.id]
  }),
  courses: one(courses, {
    fields: [courseCompletion.courseId],
    references: [courses.id]
  }),
}));

export const courseCompletionV2Relations = relations(courseCompletionV2, ({one}) => ({
  users: one(users, {
    fields: [courseCompletionV2.userId],
    references: [users.id]
  }),
  coursesV2: one(coursesV2, {
    fields: [courseCompletionV2.courseId],
    references: [coursesV2.id]
  }),
}));

export const courseEditorStatusRelations = relations(courseEditorStatus, ({one}) => ({
  coursesV2: one(coursesV2, {
    fields: [courseEditorStatus.courseId],
    references: [coursesV2.id]
  }),
  users: one(users, {
    fields: [courseEditorStatus.contentEditorsUserId],
    references: [users.id]
  }),
}));

export const courseProductionVersionsRelations = relations(courseProductionVersions, ({one}) => ({
  coursesV2: one(coursesV2, {
    fields: [courseProductionVersions.courseId],
    references: [coursesV2.id]
  }),
}));

export const dashboardFlagsRelations = relations(dashboardFlags, ({one}) => ({
  students: one(students, {
    fields: [dashboardFlags.studentId],
    references: [students.id]
  }),
}));

export const studentDonorRelations = relations(studentDonor, ({one}) => ({
  students: one(students, {
    fields: [studentDonor.studentId],
    references: [students.id]
  }),
}));

export const emailReportRelations = relations(emailReport, ({one}) => ({
  partners: one(partners, {
    fields: [emailReport.partnerId],
    references: [partners.id]
  }),
}));

export const exerciseCompletionRelations = relations(exerciseCompletion, ({one}) => ({
  users: one(users, {
    fields: [exerciseCompletion.userId],
    references: [users.id]
  }),
  exercises: one(exercises, {
    fields: [exerciseCompletion.exerciseId],
    references: [exercises.id]
  }),
}));

export const feedbacksRelations = relations(feedbacks, ({one}) => ({
  students: one(students, {
    fields: [feedbacks.studentId],
    references: [students.id]
  }),
  cUsers: one(cUsers, {
    fields: [feedbacks.userId],
    references: [cUsers.id]
  }),
}));

export const partnerSpecificBatchesV2Relations = relations(partnerSpecificBatchesV2, ({one}) => ({
  recurringClasses: one(recurringClasses, {
    fields: [partnerSpecificBatchesV2.recurringId],
    references: [recurringClasses.id]
  }),
  classes: one(classes, {
    fields: [partnerSpecificBatchesV2.classId],
    references: [classes.id]
  }),
  partners: one(partners, {
    fields: [partnerSpecificBatchesV2.partnerId],
    references: [partners.id]
  }),
  partnerSpace: one(partnerSpace, {
    fields: [partnerSpecificBatchesV2.spaceId],
    references: [partnerSpace.id]
  }),
  spaceGroup: one(spaceGroup, {
    fields: [partnerSpecificBatchesV2.groupId],
    references: [spaceGroup.id]
  }),
}));

export const spaceGroupRelations = relations(spaceGroup, ({one, many}) => ({
  partnerSpecificBatchesV2s: many(partnerSpecificBatchesV2),
  partnerSpace: one(partnerSpace, {
    fields: [spaceGroup.spaceId],
    references: [partnerSpace.id]
  }),
  partnerSpecificBatchess: many(partnerSpecificBatches),
  userss: many(users),
}));

export const mentorTreeRelations = relations(mentorTree, ({one}) => ({
  users_mentorId: one(users, {
    fields: [mentorTree.mentorId],
    references: [users.id],
    relationName: "mentorTree_mentorId_users_id"
  }),
  users_menteeId: one(users, {
    fields: [mentorTree.menteeId],
    references: [users.id],
    relationName: "mentorTree_menteeId_users_id"
  }),
}));

export const mergedClassesRelations = relations(mergedClasses, ({one}) => ({
  classes_classId: one(classes, {
    fields: [mergedClasses.classId],
    references: [classes.id],
    relationName: "mergedClasses_classId_classes_id"
  }),
  classes_mergedClassId: one(classes, {
    fields: [mergedClasses.mergedClassId],
    references: [classes.id],
    relationName: "mergedClasses_mergedClassId_classes_id"
  }),
}));

export const partnerGroupRelationshipRelations = relations(partnerGroupRelationship, ({one}) => ({
  partnerGroup: one(partnerGroup, {
    fields: [partnerGroupRelationship.partnerGroupId],
    references: [partnerGroup.id]
  }),
}));

export const partnerGroupRelations = relations(partnerGroup, ({many}) => ({
  partnerGroupRelationships: many(partnerGroupRelationship),
  partnerGroupUsers: many(partnerGroupUser),
  partnerRelationships: many(partnerRelationship),
}));

export const partnerGroupUserRelations = relations(partnerGroupUser, ({one}) => ({
  partnerGroup: one(partnerGroup, {
    fields: [partnerGroupUser.partnerGroupId],
    references: [partnerGroup.id]
  }),
}));

export const interviewSlotRelations = relations(interviewSlot, ({one, many}) => ({
  interviewOwners: one(interviewOwners, {
    fields: [interviewSlot.ownerId],
    references: [interviewOwners.id]
  }),
  students: one(students, {
    fields: [interviewSlot.studentId],
    references: [students.id]
  }),
  stageTransitions: one(stageTransitions, {
    fields: [interviewSlot.transitionId],
    references: [stageTransitions.id]
  }),
  slotBookeds: many(slotBooked),
}));

export const zuvyFormTrackingRelations = relations(zuvyFormTracking, ({one}) => ({
  users: one(users, {
    fields: [zuvyFormTracking.userId],
    references: [users.id]
  }),
}));

export const partnerRelationshipRelations = relations(partnerRelationship, ({one}) => ({
  partners: one(partners, {
    fields: [partnerRelationship.partnerId],
    references: [partners.id]
  }),
  partnerGroup: one(partnerGroup, {
    fields: [partnerRelationship.partnerGroupId],
    references: [partnerGroup.id]
  }),
}));

export const partnerUserRelations = relations(partnerUser, ({one}) => ({
  partners: one(partners, {
    fields: [partnerUser.partnerId],
    references: [partners.id]
  }),
}));

export const pathwayCompletionRelations = relations(pathwayCompletion, ({one}) => ({
  users: one(users, {
    fields: [pathwayCompletion.userId],
    references: [users.id]
  }),
}));

export const partnerSpecificBatchesRelations = relations(partnerSpecificBatches, ({one}) => ({
  classes: one(classes, {
    fields: [partnerSpecificBatches.classId],
    references: [classes.id]
  }),
  recurringClasses: one(recurringClasses, {
    fields: [partnerSpecificBatches.recurringId],
    references: [recurringClasses.id]
  }),
  partners: one(partners, {
    fields: [partnerSpecificBatches.partnerId],
    references: [partners.id]
  }),
  spaceGroup: one(spaceGroup, {
    fields: [partnerSpecificBatches.groupId],
    references: [spaceGroup.id]
  }),
  pathwaysV2: one(pathwaysV2, {
    fields: [partnerSpecificBatches.pathwayId],
    references: [pathwaysV2.id]
  }),
  partnerSpace: one(partnerSpace, {
    fields: [partnerSpecificBatches.spaceId],
    references: [partnerSpace.id]
  }),
}));

export const pathwaysV2Relations = relations(pathwaysV2, ({many}) => ({
  partnerSpecificBatchess: many(partnerSpecificBatches),
  pathwayCoursesV2s: many(pathwayCoursesV2),
  pathwayPartnerGroups: many(pathwayPartnerGroup),
  pathwaysOngoingTopics: many(pathwaysOngoingTopic),
  classesToCoursess: many(classesToCourses),
}));

export const pathwayCoursesRelations = relations(pathwayCourses, ({one}) => ({
  courses: one(courses, {
    fields: [pathwayCourses.courseId],
    references: [courses.id]
  }),
}));

export const pathwayCoursesV2Relations = relations(pathwayCoursesV2, ({one}) => ({
  coursesV2: one(coursesV2, {
    fields: [pathwayCoursesV2.courseId],
    references: [coursesV2.id]
  }),
  pathwaysV2: one(pathwaysV2, {
    fields: [pathwayCoursesV2.pathwayId],
    references: [pathwaysV2.id]
  }),
}));

export const pathwayPartnerGroupRelations = relations(pathwayPartnerGroup, ({one}) => ({
  partners: one(partners, {
    fields: [pathwayPartnerGroup.partnerId],
    references: [partners.id]
  }),
  pathwaysV2: one(pathwaysV2, {
    fields: [pathwayPartnerGroup.pathwayId],
    references: [pathwaysV2.id]
  }),
}));

export const pathwayTrackingFormStructureRelations = relations(pathwayTrackingFormStructure, ({one}) => ({
  progressParameters: one(progressParameters, {
    fields: [pathwayTrackingFormStructure.parameterId],
    references: [progressParameters.id]
  }),
  progressQuestions: one(progressQuestions, {
    fields: [pathwayTrackingFormStructure.questionId],
    references: [progressQuestions.id]
  }),
}));

export const progressParametersRelations = relations(progressParameters, ({many}) => ({
  pathwayTrackingFormStructures: many(pathwayTrackingFormStructure),
  pathwayTrackingRequestParameterDetailss: many(pathwayTrackingRequestParameterDetails),
}));

export const progressQuestionsRelations = relations(progressQuestions, ({many}) => ({
  pathwayTrackingFormStructures: many(pathwayTrackingFormStructure),
  pathwayTrackingRequestQuestionDetailss: many(pathwayTrackingRequestQuestionDetails),
}));

export const pathwayTrackingRequestDetailsRelations = relations(pathwayTrackingRequestDetails, ({one}) => ({
  pathwayTrackingRequest: one(pathwayTrackingRequest, {
    fields: [pathwayTrackingRequestDetails.requestId],
    references: [pathwayTrackingRequest.id]
  }),
  users_mentorId: one(users, {
    fields: [pathwayTrackingRequestDetails.mentorId],
    references: [users.id],
    relationName: "pathwayTrackingRequestDetails_mentorId_users_id"
  }),
  users_menteeId: one(users, {
    fields: [pathwayTrackingRequestDetails.menteeId],
    references: [users.id],
    relationName: "pathwayTrackingRequestDetails_menteeId_users_id"
  }),
}));

export const pathwayTrackingRequestRelations = relations(pathwayTrackingRequest, ({one, many}) => ({
  pathwayTrackingRequestDetailss: many(pathwayTrackingRequestDetails),
  users_mentorId: one(users, {
    fields: [pathwayTrackingRequest.mentorId],
    references: [users.id],
    relationName: "pathwayTrackingRequest_mentorId_users_id"
  }),
  users_menteeId: one(users, {
    fields: [pathwayTrackingRequest.menteeId],
    references: [users.id],
    relationName: "pathwayTrackingRequest_menteeId_users_id"
  }),
}));

export const pathwayTrackingRequestParameterDetailsRelations = relations(pathwayTrackingRequestParameterDetails, ({one}) => ({
  progressParameters: one(progressParameters, {
    fields: [pathwayTrackingRequestParameterDetails.parameterId],
    references: [progressParameters.id]
  }),
}));

export const pathwayTrackingRequestQuestionDetailsRelations = relations(pathwayTrackingRequestQuestionDetails, ({one}) => ({
  progressQuestions: one(progressQuestions, {
    fields: [pathwayTrackingRequestQuestionDetails.questionId],
    references: [progressQuestions.id]
  }),
}));

export const pathwaysOngoingTopicRelations = relations(pathwaysOngoingTopic, ({one}) => ({
  users: one(users, {
    fields: [pathwaysOngoingTopic.userId],
    references: [users.id]
  }),
  pathwaysV2: one(pathwaysV2, {
    fields: [pathwaysOngoingTopic.pathwayId],
    references: [pathwaysV2.id]
  }),
  coursesV2: one(coursesV2, {
    fields: [pathwaysOngoingTopic.courseId],
    references: [coursesV2.id]
  }),
  exercisesV2: one(exercisesV2, {
    fields: [pathwaysOngoingTopic.exerciseId],
    references: [exercisesV2.id]
  }),
  assessment: one(assessment, {
    fields: [pathwaysOngoingTopic.assessmentId],
    references: [assessment.id]
  }),
}));

export const registrationFormDataRelations = relations(registrationFormData, ({one}) => ({
  partners: one(partners, {
    fields: [registrationFormData.partnerId],
    references: [partners.id]
  }),
}));

export const registrationFormStructureRelations = relations(registrationFormStructure, ({one}) => ({
  partners: one(partners, {
    fields: [registrationFormStructure.partnerId],
    references: [partners.id]
  }),
}));

export const sansaarUserRolesRelations = relations(sansaarUserRoles, ({one}) => ({
  users: one(users, {
    fields: [sansaarUserRoles.userId],
    references: [users.id]
  }),
}));

export const slotBookedRelations = relations(slotBooked, ({one}) => ({
  interviewSlot: one(interviewSlot, {
    fields: [slotBooked.interviewSlotId],
    references: [interviewSlot.id]
  }),
  students: one(students, {
    fields: [slotBooked.studentId],
    references: [students.id]
  }),
}));

export const studentDocumentsRelations = relations(studentDocuments, ({one}) => ({
  students: one(students, {
    fields: [studentDocuments.studentId],
    references: [students.id]
  }),
}));

export const studentJobDetailsRelations = relations(studentJobDetails, ({one}) => ({
  students: one(students, {
    fields: [studentJobDetails.studentId],
    references: [students.id]
  }),
}));

export const studentPathwaysRelations = relations(studentPathways, ({one}) => ({
  users: one(users, {
    fields: [studentPathways.userId],
    references: [users.id]
  }),
}));

export const userTokensRelations = relations(userTokens, ({one}) => ({
  users_userId: one(users, {
    fields: [userTokens.userId],
    references: [users.id],
    relationName: "userTokens_userId_users_id"
  }),
  users_userEmail: one(users, {
    fields: [userTokens.userEmail],
    references: [users.email],
    relationName: "userTokens_userEmail_users_email"
  }),
}));

export const mentorsRelations = relations(mentors, ({one}) => ({
  users_mentor: one(users, {
    fields: [mentors.mentor],
    references: [users.id],
    relationName: "mentors_mentor_users_id"
  }),
  users_mentee: one(users, {
    fields: [mentors.mentee],
    references: [users.id],
    relationName: "mentors_mentee_users_id"
  }),
  users_userId: one(users, {
    fields: [mentors.userId],
    references: [users.id],
    relationName: "mentors_userId_users_id"
  }),
}));

export const merakiCertificateRelations = relations(merakiCertificate, ({one}) => ({
  users: one(users, {
    fields: [merakiCertificate.userId],
    references: [users.id]
  }),
}));

export const questionOptionsRelations = relations(questionOptions, ({one}) => ({
  questions: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id]
  }),
}));

export const questionsRelations = relations(questions, ({many}) => ({
  questionOptionss: many(questionOptions),
}));

export const questionBucketChoicesRelations = relations(questionBucketChoices, ({one}) => ({
  questionBuckets: one(questionBuckets, {
    fields: [questionBucketChoices.bucketId],
    references: [questionBuckets.id]
  }),
}));

export const questionBucketsRelations = relations(questionBuckets, ({many}) => ({
  questionBucketChoicess: many(questionBucketChoices),
}));

export const recordVersionsOfPostDeleteExercisedetailsRelations = relations(recordVersionsOfPostDeleteExercisedetails, ({one}) => ({
  coursesV2: one(coursesV2, {
    fields: [recordVersionsOfPostDeleteExercisedetails.courseId],
    references: [coursesV2.id]
  }),
  exercisesV2: one(exercisesV2, {
    fields: [recordVersionsOfPostDeleteExercisedetails.exerciseId],
    references: [exercisesV2.id]
  }),
}));

export const ongoingTopicsRelations = relations(ongoingTopics, ({one}) => ({
  c4CaTeamProjectsubmitSolution: one(c4CaTeamProjectsubmitSolution, {
    fields: [ongoingTopics.projectSolutionId],
    references: [c4CaTeamProjectsubmitSolution.id]
  }),
  users: one(users, {
    fields: [ongoingTopics.userId],
    references: [users.id]
  }),
  c4CaTeams: one(c4CaTeams, {
    fields: [ongoingTopics.teamId],
    references: [c4CaTeams.id]
  }),
  c4CaTeamProjecttopic: one(c4CaTeamProjecttopic, {
    fields: [ongoingTopics.projectTopicId],
    references: [c4CaTeamProjecttopic.id]
  }),
}));

export const c4CaTeamProjectsubmitSolutionRelations = relations(c4CaTeamProjectsubmitSolution, ({one, many}) => ({
  ongoingTopicss: many(ongoingTopics),
  c4CaTeams: one(c4CaTeams, {
    fields: [c4CaTeamProjectsubmitSolution.teamId],
    references: [c4CaTeams.id]
  }),
}));

export const c4CaTeamProjecttopicRelations = relations(c4CaTeamProjecttopic, ({one, many}) => ({
  ongoingTopicss: many(ongoingTopics),
  c4CaTeams: one(c4CaTeams, {
    fields: [c4CaTeamProjecttopic.teamId],
    references: [c4CaTeams.id]
  }),
}));

export const classesToCoursesRelations = relations(classesToCourses, ({one}) => ({
  classes: one(classes, {
    fields: [classesToCourses.classId],
    references: [classes.id]
  }),
  courses: one(courses, {
    fields: [classesToCourses.courseV1],
    references: [courses.id]
  }),
  exercises: one(exercises, {
    fields: [classesToCourses.exerciseV1],
    references: [exercises.id]
  }),
  pathwaysV2: one(pathwaysV2, {
    fields: [classesToCourses.pathwayV2],
    references: [pathwaysV2.id]
  }),
  coursesV2: one(coursesV2, {
    fields: [classesToCourses.courseV2],
    references: [coursesV2.id]
  }),
  exercisesV2: one(exercisesV2, {
    fields: [classesToCourses.exerciseV2],
    references: [exercisesV2.id]
  }),
}));

export const courseCompletionV3Relations = relations(courseCompletionV3, ({one}) => ({
  users: one(users, {
    fields: [courseCompletionV3.userId],
    references: [users.id]
  }),
  c4CaTeams: one(c4CaTeams, {
    fields: [courseCompletionV3.teamId],
    references: [c4CaTeams.id]
  }),
}));

export const pathwayCompletionV2Relations = relations(pathwayCompletionV2, ({one}) => ({
  users: one(users, {
    fields: [pathwayCompletionV2.userId],
    references: [users.id]
  }),
  c4CaTeams: one(c4CaTeams, {
    fields: [pathwayCompletionV2.teamId],
    references: [c4CaTeams.id]
  }),
}));

export const c4CaStudentsRelations = relations(c4CaStudents, ({one}) => ({
  c4CaTeachers: one(c4CaTeachers, {
    fields: [c4CaStudents.teacherId],
    references: [c4CaTeachers.id]
  }),
}));

export const c4CaTeachersRelations = relations(c4CaTeachers, ({one, many}) => ({
  c4CaStudentss: many(c4CaStudents),
  c4CaStudentsProjectDetails: many(c4CaStudentsProjectDetail),
  users: one(users, {
    fields: [c4CaTeachers.userId],
    references: [users.id]
  }),
  c4CaPartners: one(c4CaPartners, {
    fields: [c4CaTeachers.c4CaPartnerId],
    references: [c4CaPartners.id]
  }),
  c4CaTeamss: many(c4CaTeams),
}));

export const assessmentsHistoryRelations = relations(assessmentsHistory, ({one}) => ({
  users: one(users, {
    fields: [assessmentsHistory.userId],
    references: [users.id]
  }),
  c4CaTeams: one(c4CaTeams, {
    fields: [assessmentsHistory.teamId],
    references: [c4CaTeams.id]
  }),
}));

export const exerciseCompletionV2Relations = relations(exerciseCompletionV2, ({one}) => ({
  users: one(users, {
    fields: [exerciseCompletionV2.userId],
    references: [users.id]
  }),
  c4CaTeams: one(c4CaTeams, {
    fields: [exerciseCompletionV2.teamId],
    references: [c4CaTeams.id]
  }),
}));

export const c4CaStudentsProjectDetailRelations = relations(c4CaStudentsProjectDetail, ({one}) => ({
  c4CaTeachers: one(c4CaTeachers, {
    fields: [c4CaStudentsProjectDetail.teacherId],
    references: [c4CaTeachers.id]
  }),
  c4CaTeams: one(c4CaTeams, {
    fields: [c4CaStudentsProjectDetail.teamId],
    references: [c4CaTeams.id]
  }),
}));

export const clusterManagersRelations = relations(clusterManagers, ({one, many}) => ({
  users: one(users, {
    fields: [clusterManagers.adminId],
    references: [users.id],
    relationName: "clusterManagers_adminId_users_id"
  }),
  careerTeacherss: many(careerTeachers),
  userss: many(users, {
    relationName: "users_clusterManagerId_clusterManagers_id"
  }),
}));

export const moduleCompletionV2Relations = relations(moduleCompletionV2, ({one}) => ({
  users: one(users, {
    fields: [moduleCompletionV2.userId],
    references: [users.id]
  }),
  c4CaTeams: one(c4CaTeams, {
    fields: [moduleCompletionV2.teamId],
    references: [c4CaTeams.id]
  }),
}));

export const assessmentResultRelations = relations(assessmentResult, ({one}) => ({
  users: one(users, {
    fields: [assessmentResult.userId],
    references: [users.id]
  }),
  assessment: one(assessment, {
    fields: [assessmentResult.assessmentId],
    references: [assessment.id]
  }),
  c4CaTeams: one(c4CaTeams, {
    fields: [assessmentResult.teamId],
    references: [c4CaTeams.id]
  }),
}));

export const learningTrackStatusRelations = relations(learningTrackStatus, ({one}) => ({
  users: one(users, {
    fields: [learningTrackStatus.userId],
    references: [users.id]
  }),
  exercisesV2: one(exercisesV2, {
    fields: [learningTrackStatus.exerciseId],
    references: [exercisesV2.id]
  }),
  c4CaTeams: one(c4CaTeams, {
    fields: [learningTrackStatus.teamId],
    references: [c4CaTeams.id]
  }),
}));

export const c4CaPartnersRelations = relations(c4CaPartners, ({many}) => ({
  c4CaTeacherss: many(c4CaTeachers),
  facilitatorss: many(facilitators),
  userss: many(users),
}));

export const assessmentOutcomeRelations = relations(assessmentOutcome, ({one}) => ({
  c4CaTeams: one(c4CaTeams, {
    fields: [assessmentOutcome.teamId],
    references: [c4CaTeams.id]
  }),
  users: one(users, {
    fields: [assessmentOutcome.userId],
    references: [users.id]
  }),
}));

export const facilitatorsRelations = relations(facilitators, ({one, many}) => ({
  c4CaPartners: one(c4CaPartners, {
    fields: [facilitators.c4CaPartnerId],
    references: [c4CaPartners.id]
  }),
  userss: many(users),
}));

export const pathwaysOngoingTopicOutcomeRelations = relations(pathwaysOngoingTopicOutcome, ({one}) => ({
  users: one(users, {
    fields: [pathwaysOngoingTopicOutcome.userId],
    references: [users.id]
  }),
}));

export const learningTrackStatusOutcomeRelations = relations(learningTrackStatusOutcome, ({one}) => ({
  users: one(users, {
    fields: [learningTrackStatusOutcome.userId],
    references: [users.id]
  }),
  c4CaTeams: one(c4CaTeams, {
    fields: [learningTrackStatusOutcome.teamId],
    references: [c4CaTeams.id]
  }),
}));

export const zuvyBatchEnrollmentsRelations = relations(zuvyBatchEnrollments, ({one}) => ({
  users: one(users, {
    fields: [zuvyBatchEnrollments.userId],
    references: [users.id]
  }),
  zuvyBootcamps: one(zuvyBootcamps, {
    fields: [zuvyBatchEnrollments.bootcampId],
    references: [zuvyBootcamps.id]
  }),
  zuvyBatches: one(zuvyBatches, {
    fields: [zuvyBatchEnrollments.batchId],
    references: [zuvyBatches.id]
  }),
}));

export const c4CaRolesRelations = relations(c4CaRoles, ({one}) => ({
  users: one(users, {
    fields: [c4CaRoles.userId],
    references: [users.id]
  }),
}));

export const zuvyBootcampTypeRelations = relations(zuvyBootcampType, ({one}) => ({
  zuvyBootcamps: one(zuvyBootcamps, {
    fields: [zuvyBootcampType.bootcampId],
    references: [zuvyBootcamps.id]
  }),
}));

export const careerTeachersRelations = relations(careerTeachers, ({one, many}) => ({
  users: one(users, {
    fields: [careerTeachers.userId],
    references: [users.id]
  }),
  clusterManagers: one(clusterManagers, {
    fields: [careerTeachers.clusterManagerId],
    references: [clusterManagers.id]
  }),
  careerTeamss: many(careerTeams),
  careerStudentss: many(careerStudents),
}));

export const subStageRelations = relations(subStage, ({one}) => ({
  schoolStage: one(schoolStage, {
    fields: [subStage.stageId],
    references: [schoolStage.id]
  }),
}));

export const careerTeamsRelations = relations(careerTeams, ({one, many}) => ({
  careerTeachers: one(careerTeachers, {
    fields: [careerTeams.careerTeacherId],
    references: [careerTeachers.id]
  }),
  careerStudentss: many(careerStudents),
}));

export const zuvyCodingSubmissionRelations = relations(zuvyCodingSubmission, ({one}) => ({
  users: one(users, {
    fields: [zuvyCodingSubmission.userId],
    references: [users.id]
  }),
}));

export const zuvyPracticeCodeRelations = relations(zuvyPracticeCode, ({one}) => ({
  zuvyAssessmentSubmission: one(zuvyAssessmentSubmission, {
    fields: [zuvyPracticeCode.submissionId],
    references: [zuvyAssessmentSubmission.id]
  }),
  zuvyOutsourseCodingQuestions: one(zuvyOutsourseCodingQuestions, {
    fields: [zuvyPracticeCode.codingOutsourseId],
    references: [zuvyOutsourseCodingQuestions.id]
  }),
  zuvyCodingQuestions: one(zuvyCodingQuestions, {
    fields: [zuvyPracticeCode.questionId],
    references: [zuvyCodingQuestions.id]
  }),
  zuvyModuleChapter: one(zuvyModuleChapter, {
    fields: [zuvyPracticeCode.chapterId],
    references: [zuvyModuleChapter.id]
  }),
}));

export const zuvyOutsourseCodingQuestionsRelations = relations(zuvyOutsourseCodingQuestions, ({one, many}) => ({
  zuvyPracticeCodes: many(zuvyPracticeCode),
  zuvyCodingQuestions: one(zuvyCodingQuestions, {
    fields: [zuvyOutsourseCodingQuestions.codingQuestionId],
    references: [zuvyCodingQuestions.id]
  }),
  zuvyOutsourseAssessments: one(zuvyOutsourseAssessments, {
    fields: [zuvyOutsourseCodingQuestions.assessmentOutsourseId],
    references: [zuvyOutsourseAssessments.id]
  }),
  zuvyBootcamps: one(zuvyBootcamps, {
    fields: [zuvyOutsourseCodingQuestions.bootcampId],
    references: [zuvyBootcamps.id]
  }),
  zuvyModuleChapter: one(zuvyModuleChapter, {
    fields: [zuvyOutsourseCodingQuestions.chapterId],
    references: [zuvyModuleChapter.id]
  }),
}));

export const zuvyCodingQuestionsRelations = relations(zuvyCodingQuestions, ({one, many}) => ({
  zuvyPracticeCodes: many(zuvyPracticeCode),
  zuvyTestCasess: many(zuvyTestCases),
  zuvyOutsourseCodingQuestionss: many(zuvyOutsourseCodingQuestions),
  zuvyTags: one(zuvyTags, {
    fields: [zuvyCodingQuestions.tagId],
    references: [zuvyTags.id]
  }),
}));

export const careerStudentsRelations = relations(careerStudents, ({one}) => ({
  careerTeachers: one(careerTeachers, {
    fields: [careerStudents.careerTeacherId],
    references: [careerTeachers.id]
  }),
  careerTeams: one(careerTeams, {
    fields: [careerStudents.careerTeamId],
    references: [careerTeams.id]
  }),
}));

export const zuvyProjectTrackingRelations = relations(zuvyProjectTracking, ({one}) => ({
  users: one(users, {
    fields: [zuvyProjectTracking.userId],
    references: [users.id]
  }),
  zuvyCourseProjects: one(zuvyCourseProjects, {
    fields: [zuvyProjectTracking.projectId],
    references: [zuvyCourseProjects.id]
  }),
  zuvyCourseModules: one(zuvyCourseModules, {
    fields: [zuvyProjectTracking.moduleId],
    references: [zuvyCourseModules.id]
  }),
  zuvyBootcamps: one(zuvyBootcamps, {
    fields: [zuvyProjectTracking.bootcampId],
    references: [zuvyBootcamps.id]
  }),
}));

export const zuvyTestCasesRelations = relations(zuvyTestCases, ({one, many}) => ({
  zuvyCodingQuestions: one(zuvyCodingQuestions, {
    fields: [zuvyTestCases.questionId],
    references: [zuvyCodingQuestions.id]
  }),
  zuvyTestCasesSubmissions: many(zuvyTestCasesSubmission),
}));

export const samaSystemTrackingRelations = relations(samaSystemTracking, ({one}) => ({
  samaClients: one(samaClients, {
    fields: [samaSystemTracking.macAddress],
    references: [samaClients.macAddress]
  }),
}));

export const samaClientsRelations = relations(samaClients, ({many}) => ({
  samaSystemTrackings: many(samaSystemTracking),
}));

export const teacherCapacityBuildingRelations = relations(teacherCapacityBuilding, ({one}) => ({
  users: one(users, {
    fields: [teacherCapacityBuilding.userId],
    references: [users.id]
  }),
}));

export const zuvyQuizTrackingRelations = relations(zuvyQuizTracking, ({one}) => ({
  users: one(users, {
    fields: [zuvyQuizTracking.userId],
    references: [users.id]
  }),
  zuvyAssessmentSubmission: one(zuvyAssessmentSubmission, {
    fields: [zuvyQuizTracking.assessmentSubmissionId],
    references: [zuvyAssessmentSubmission.id]
  }),
}));

export const zuvyRecentBootcampRelations = relations(zuvyRecentBootcamp, ({one}) => ({
  zuvyCourseModules: one(zuvyCourseModules, {
    fields: [zuvyRecentBootcamp.moduleId],
    references: [zuvyCourseModules.id]
  }),
  zuvyModuleChapter: one(zuvyModuleChapter, {
    fields: [zuvyRecentBootcamp.chapterId],
    references: [zuvyModuleChapter.id]
  }),
  users: one(users, {
    fields: [zuvyRecentBootcamp.userId],
    references: [users.id]
  }),
  zuvyBootcamps: one(zuvyBootcamps, {
    fields: [zuvyRecentBootcamp.bootcampId],
    references: [zuvyBootcamps.id]
  }),
}));

export const zuvyTestCasesSubmissionRelations = relations(zuvyTestCasesSubmission, ({one}) => ({
  zuvyTestCases: one(zuvyTestCases, {
    fields: [zuvyTestCasesSubmission.testcastId],
    references: [zuvyTestCases.id]
  }),
}));

export const zuvyModuleAssessmentRelations = relations(zuvyModuleAssessment, ({many}) => ({
  zuvyOutsourseAssessmentss: many(zuvyOutsourseAssessments),
}));

export const zuvyModuleQuizRelations = relations(zuvyModuleQuiz, ({one, many}) => ({
  zuvyTags: one(zuvyTags, {
    fields: [zuvyModuleQuiz.tagId],
    references: [zuvyTags.id]
  }),
  zuvyModuleQuizVariantss: many(zuvyModuleQuizVariants),
  zuvyOutsourseQuizzess: many(zuvyOutsourseQuizzes),
}));

export const zuvyModuleQuizVariantsRelations = relations(zuvyModuleQuizVariants, ({one}) => ({
  zuvyModuleQuiz: one(zuvyModuleQuiz, {
    fields: [zuvyModuleQuizVariants.quizId],
    references: [zuvyModuleQuiz.id]
  }),
}));

export const zuvyModuleTrackingRelations = relations(zuvyModuleTracking, ({one}) => ({
  users: one(users, {
    fields: [zuvyModuleTracking.userId],
    references: [users.id]
  }),
  zuvyBootcamps: one(zuvyBootcamps, {
    fields: [zuvyModuleTracking.bootcampId],
    references: [zuvyBootcamps.id]
  }),
}));

export const zuvyModuleTopicsRelations = relations(zuvyModuleTopics, ({many}) => ({
  zuvyModuleChapters: many(zuvyModuleChapter),
}));

export const zuvyOpenEndedQuestionSubmissionRelations = relations(zuvyOpenEndedQuestionSubmission, ({one}) => ({
  zuvyOutsourseOpenEndedQuestions: one(zuvyOutsourseOpenEndedQuestions, {
    fields: [zuvyOpenEndedQuestionSubmission.questionId],
    references: [zuvyOutsourseOpenEndedQuestions.id]
  }),
  zuvyAssessmentSubmission: one(zuvyAssessmentSubmission, {
    fields: [zuvyOpenEndedQuestionSubmission.assessmentSubmissionId],
    references: [zuvyAssessmentSubmission.id]
  }),
  users: one(users, {
    fields: [zuvyOpenEndedQuestionSubmission.userId],
    references: [users.id]
  }),
}));

export const zuvyStudentAttendanceRelations = relations(zuvyStudentAttendance, ({one}) => ({
  zuvyBatches: one(zuvyBatches, {
    fields: [zuvyStudentAttendance.batchId],
    references: [zuvyBatches.id]
  }),
  zuvyBootcamps: one(zuvyBootcamps, {
    fields: [zuvyStudentAttendance.bootcampId],
    references: [zuvyBootcamps.id]
  }),
}));

export const zuvyChapterTrackingRelations = relations(zuvyChapterTracking, ({one}) => ({
  zuvyCourseModules: one(zuvyCourseModules, {
    fields: [zuvyChapterTracking.moduleId],
    references: [zuvyCourseModules.id]
  }),
  zuvyModuleChapter: one(zuvyModuleChapter, {
    fields: [zuvyChapterTracking.chapterId],
    references: [zuvyModuleChapter.id]
  }),
  users: one(users, {
    fields: [zuvyChapterTracking.userId],
    references: [users.id]
  }),
}));

export const zuvyOutsourseQuizzesRelations = relations(zuvyOutsourseQuizzes, ({one}) => ({
  zuvyModuleQuiz: one(zuvyModuleQuiz, {
    fields: [zuvyOutsourseQuizzes.quizId],
    references: [zuvyModuleQuiz.id]
  }),
  zuvyBootcamps: one(zuvyBootcamps, {
    fields: [zuvyOutsourseQuizzes.bootcampId],
    references: [zuvyBootcamps.id]
  }),
  zuvyModuleChapter: one(zuvyModuleChapter, {
    fields: [zuvyOutsourseQuizzes.chapterId],
    references: [zuvyModuleChapter.id]
  }),
  zuvyOutsourseAssessments: one(zuvyOutsourseAssessments, {
    fields: [zuvyOutsourseQuizzes.assessmentOutsourseId],
    references: [zuvyOutsourseAssessments.id]
  }),
}));

export const zuvyModuleFormRelations = relations(zuvyModuleForm, ({one}) => ({
  zuvyModuleChapter: one(zuvyModuleChapter, {
    fields: [zuvyModuleForm.chapterId],
    references: [zuvyModuleChapter.id]
  }),
  zuvyQuestionType: one(zuvyQuestionType, {
    fields: [zuvyModuleForm.typeId],
    references: [zuvyQuestionType.id]
  }),
}));

export const zuvyQuestionTypeRelations = relations(zuvyQuestionType, ({many}) => ({
  zuvyModuleForms: many(zuvyModuleForm),
}));