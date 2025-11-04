import { Many, relations, sql } from 'drizzle-orm';
import {
  pgTable,
  jsonb,
  pgSchema,
  pgEnum,
  serial,
  varchar,
  timestamp,
  foreignKey,
  integer,
  text,
  unique,
  date,
  bigserial,
  boolean,
  bigint,
  index,
  char,
  json,
  uniqueIndex,
  doublePrecision,
  customType,
  numeric,
  primaryKey,
} from 'drizzle-orm/pg-core';
// import { users } from './users'; // Import the 'users' module

export const courseEnrolmentsCourseStatus = pgEnum(
  'course_enrolments_course_status',
  ['enroll', 'unenroll', 'completed'],
);
export const coursesType = pgEnum('courses_type', ['html', 'js', 'python']);
export const difficulty = pgEnum('difficulty', ['Easy', 'Medium', 'Hard']);
export const currentState = pgEnum('current_state', ['DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED']);
export const exercisesReviewType = pgEnum('exercises_review_type', [
  'manual',
  'peer',
  'facilitator',
  'automatic',
]);
export const exercisesSubmissionType = pgEnum('exercises_submission_type', [
  'number',
  'text',
  'text_large',
  'attachments',
  'url',
]);
export const submissionsState = pgEnum('submissions_state', [
  'completed',
  'pending',
  'rejected',
]);
export const userRolesCenter = pgEnum('user_roles_center', [
  'dharamshala',
  'banagalore',
  'all',
]);
export const userRolesRoles = pgEnum('user_roles_roles', [
  'admin',
  'alumni',
  'student',
  'facilitator',
]);
export const usersCenter = pgEnum('users_center', ['dharamshala', 'bangalore']);
export const action = pgEnum('action', ['submit', 'run']);
export const questionType = pgEnum('questionType', [
  'Multiple Choice',
  'Checkboxes',
  'Long Text Answer',
  'Date',
  'Time',
]);
import { helperVariable } from '../src/constants/helper';
import { table } from 'console';
let schName;
if (process.env.ENV_NOTE == helperVariable.schemaName) {
  schName = helperVariable.schemaName;
} else {
  schName = 'main';
}

export const main = pgSchema(schName);

export const engArticles = main.table('eng_articles', {
  id: serial('id').primaryKey().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  sourceUrl: varchar('source_url', { length: 255 }).notNull(),
  imageUrl: varchar('image_url', { length: 255 }),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
});

export const engLevelwise = main.table('eng_levelwise', {
  id: serial('id').primaryKey().notNull(),
  level: integer('level').notNull(),
  content: text('content').notNull(),
  articleId: integer('article_id')
    .notNull()
    .references(() => engArticles.id),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
});

export const engHistory = main.table('eng_history', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  engArticlesId: integer('eng_articles_id')
    .notNull()
    .references(() => engArticles.id),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
});

export const chanakyaUserEmail = main.table(
  'chanakya_user_email',
  {
    id: serial('id').primaryKey().notNull(),
    email: varchar('email', { length: 255 }).notNull(),
  },
  (table) => {
    return {
      mainChanakyaUserEmailEmailUnique: unique(
        'main_chanakya_user_email_email_unique',
      ).on(table.email),
    };
  },
);

export const pathwaysOngoingTopicOutcome = main.table(
  'pathways_ongoing_topic_outcome',
  {
    id: serial('id').primaryKey().notNull(),
    userId: integer('user_id').references(() => users.id),
    pathwayId: integer('pathway_id'),
    courseId: integer('course_id'),
    exerciseId: integer('exercise_id'),
    assessmentId: integer('assessment_id'),
    teamId: integer('team_id'),
    moduleId: integer('module_id'),
    projectTopicId: integer('project_topic_id'),
    projectSolutionId: integer('project_solution_id'),
    slugId: integer('slug_id'),
    type: varchar('type', { length: 255 }),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
);

export const dailyMetrics = main.table('daily_metrics', {
  id: serial('id').primaryKey().notNull(),
  metricName: varchar('metric_name', { length: 255 }),
  value: integer('value'),
  date: date('date'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  gender: integer('gender'),
});

export const donor = main.table('donor', {
  id: serial('id').primaryKey().notNull(),
  donor: varchar('donor', { length: 225 }),
});

export const studentDonor = main.table('student_donor', {
  id: serial('id').primaryKey().notNull(),
  studentId: integer('student_id').references(() => students.id),
  donorId: text('donor_id').array(),
});

export const feedbacks = main.table(
  'feedbacks',
  {
    id: serial('id').primaryKey().notNull(),
    studentId: integer('student_id').references(() => students.id),
    userId: integer('user_id').references(() => cUsers.id),
    studentStage: varchar('student_stage', { length: 255 }).notNull(),
    feedback: text('feedback'),
    state: varchar('state', { length: 255 }),
    whoAssign: varchar('who_assign', { length: 255 }),
    toAssign: varchar('to_assign', { length: 255 }),
    audioRecording: varchar('audio_recording', { length: 255 }),
    deadlineAt: timestamp('deadline_at', {
      withTimezone: true,
      mode: 'string',
    }),
    finishedAt: timestamp('finished_at', {
      withTimezone: true,
      mode: 'string',
    }),
    lastUpdated: timestamp('last_updated', {
      withTimezone: true,
      mode: 'string',
    }),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    notificationSentAt: text('notification_sent_at'),
    notificationStatus: text('notification_status'),
  },
  (table) => {
    return {
      idx80256FeedbacksStudentidForeign: index(
        'idx_80256_feedbacks_studentid_foreign',
      ).on(table.studentId),
      idx80256FeedbacksUseridForeign: index(
        'idx_80256_feedbacks_userid_foreign',
      ).on(table.userId),
    };
  },
);

export const ongoingTopics = main.table('ongoing_topics', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id),
  teamId: integer('team_id').references(() => c4CaTeams.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  pathwayId: integer('pathway_id').notNull(),
  courseId: integer('course_id').notNull(),
  slugId: integer('slug_id').notNull(),
  type: text('type').notNull(),
  moduleId: integer('module_id'),
  projectTopicId: integer('project_topic_id').references(
    () => c4CaTeamProjecttopic.id,
    { onDelete: 'cascade', onUpdate: 'cascade' },
  ),
  projectSolutionId: integer('project_solution_id').references(
    () => c4CaTeamProjectsubmitSolution.id,
    { onDelete: 'cascade', onUpdate: 'cascade' },
  ),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});

export const kDetails = main.table('k_details', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  parentsName: varchar('parents_name', { length: 255 }).notNull(),
  address: varchar('address', { length: 255 }).notNull(),
  city: varchar('city', { length: 255 }).notNull(),
  state: varchar('state', { length: 255 }).notNull(),
  pinCode: varchar('pin_code', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  profilePic: varchar('profile_pic', { length: 255 }).notNull(),
  indemnityForm: varchar('indemnity_form', { length: 255 }).notNull(),
  deleted: boolean('deleted'),
});

export const knexMigrations = main.table('knex_migrations', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
  name: varchar('name', { length: 255 }),
  batch: bigint('batch', { mode: 'number' }),
  migrationTime: timestamp('migration_time', {
    withTimezone: true,
    mode: 'string',
  }),
});

export const knexMigrationsLock = main.table('knex_migrations_lock', {
  isLocked: bigint('is_locked', { mode: 'number' }),
});

export const moduleCompletionV2 = main.table('module_completion_v2', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id),
  moduleId: integer('module_id').notNull(),
  completeAt: timestamp('complete_at', { withTimezone: true, mode: 'string' }),
  teamId: integer('team_id').references(() => c4CaTeams.id, {
    onDelete: 'set null',
  }),
  percentage: integer('percentage'),
});

export const migrations = main.table('migrations', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  runOn: timestamp('run_on', { withTimezone: true, mode: 'string' }).notNull(),
});

export const partnerAssessments = main.table('partner_assessments', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 45 }).notNull(),
  answerKeyUrl: varchar('answer_key_url', { length: 300 }),
  assessmentUrl: varchar('assessment_url', { length: 300 }),
  questionSetId: varchar('question_set_id', { length: 45 }).notNull(),
  partnerId: integer('partner_id').notNull(),
  createdAt: varchar('created_at', { length: 45 }).notNull(),
});

export const partnerGroupUser = main.table('partner_group_user', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id'),
  partnerGroupId: integer('partner_group_id')
    .notNull()
    .references(() => partnerGroup.id),
  email: varchar('email', { length: 255 }),
});

export const mergedClasses = main.table('merged_classes', {
  id: serial('id').primaryKey().notNull(),
  classId: integer('class_id').references(() => classes.id),
  mergedClassId: integer('merged_class_id').references(() => classes.id),
});

export const partnerGroup = main.table(
  'partner_group',
  {
    id: serial('id').primaryKey().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    baseGroup: boolean('base_group').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    scope: varchar('scope', { length: 255 }),
  },
  (table) => {
    return {
      mainPartnerGroupNameUnique: unique('main_partner_group_name_unique').on(
        table.name,
      ),
    };
  },
);

export const ghar_users = main.table('ghar_users', {
  id: serial('id').primaryKey().notNull(),
  email: varchar('email', { length: 255 }).notNull(),
});

export const partnerGroupRelationship = main.table(
  'partner_group_relationship',
  {
    id: serial('id').primaryKey().notNull(),
    partnerGroupId: integer('partner_group_id')
      .notNull()
      .references(() => partnerGroup.id),
    memberOf: integer('member_of').notNull(),
  },
);

export const partnerRelationship = main.table('partner_relationship', {
  id: serial('id').primaryKey().notNull(),
  partnerId: integer('partner_id')
    .notNull()
    .references(() => partners.id),
  partnerGroupId: integer('partner_group_id')
    .notNull()
    .references(() => partnerGroup.id),
});

export const mentors = main.table(
  'mentors',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    mentor: bigint('mentor', { mode: 'number' }).references(() => users.id),
    mentee: bigint('mentee', { mode: 'number' }).references(() => users.id),
    scope: varchar('scope', { length: 255 }),
    userId: integer('user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idx50487MentorIbfk1Idx: index('idx_50487_mentor_ibfk_1_idx').on(
        table.mentor,
      ),
      idx50487MentorIbfk2Idx: index('idx_50487_mentor_ibfk_2_idx').on(
        table.mentee,
      ),
    };
  },
);

export const merakiCertificate = main.table('meraki_certificate', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id),
  url: varchar('url', { length: 255 }),
  registerAt: varchar('register_at', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  pathwayCode: varchar('pathway_code', { length: 255 }),
  pathwayId: integer('pathway_id').references(() => pathwaysV2.id),
});

export const partnerSpecificBatches = main.table('partner_specific_batches', {
  id: serial('id').primaryKey().notNull(),
  classId: integer('class_id').references(() => classes.id),
  recurringId: integer('recurring_id').references(() => recurringClasses.id),
  partnerId: integer('partner_id').references(() => partners.id),
  groupId: integer('group_id').references(() => spaceGroup.id, {
    onDelete: 'set null',
  }),
  spaceId: integer('space_id').references(() => partnerSpace.id, {
    onDelete: 'set null',
  }),
  pathwayId: integer('pathway_id').references(() => pathwaysV2.id),
});

export const partnerSpace = main.table('partner_space', {
  id: serial('id').primaryKey().notNull(),
  partnerId: integer('partner_id').references(() => partners.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  spaceName: varchar('space_name', { length: 255 }),
  pointOfContactName: varchar('point_of_contact_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
});

export const pathwayPartnerGroup = main.table('pathway_partner_group', {
  id: serial('id').primaryKey().notNull(),
  partnerId: integer('partner_id').references(() => partners.id),
  pathwayId: integer('pathway_id').references(() => pathwaysV2.id),
});

export const partnerUser = main.table(
  'partner_user',
  {
    id: serial('id').primaryKey().notNull(),
    partnerId: integer('partner_id').references(() => partners.id),
    email: varchar('email', { length: 225 }),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
  },
  (table) => {
    return {
      mainPartnerUserEmailUnique: unique('main_partner_user_email_unique').on(
        table.email,
      ),
    };
  },
);

export const pathwayCompletion = main.table(
  'pathway_completion',
  {
    id: serial('id').primaryKey().notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    pathwayId: integer('pathway_id')
      .notNull()
      .references(() => pathways.id),
  },
  (table) => {
    return {
      mainPathwayCompletionUserIdPathwayIdUnique: unique(
        'main_pathway_completion_user_id_pathway_id_unique',
      ).on(table.userId, table.pathwayId),
    };
  },
);

export const pathwayCourses = main.table('pathway_courses', {
  id: serial('id').primaryKey().notNull(),
  courseId: integer('course_id')
    .notNull()
    .references(() => courses.id),
  pathwayId: integer('pathway_id')
    .notNull()
    .references(() => pathways.id),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
});

export const pathwayCoursesV2 = main.table('pathway_courses_v2', {
  id: serial('id').primaryKey().notNull(),
  courseId: integer('course_id')
    .notNull()
    .references(() => coursesV2.id),
  pathwayId: integer('pathway_id')
    .notNull()
    .references(() => pathwaysV2.id),
});

export const pathwayMilestones = main.table('pathway_milestones', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 45 }).notNull(),
  description: varchar('description', { length: 5000 }).notNull(),
  pathwayId: integer('pathway_id')
    .notNull()
    .references(() => pathways.id),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
});

export const pathwayTrackingFormStructure = main.table(
  'pathway_tracking_form_structure',
  {
    id: serial('id').primaryKey().notNull(),
    pathwayId: integer('pathway_id')
      .notNull()
      .references(() => pathways.id),
    parameterId: integer('parameter_id').references(
      () => progressParameters.id,
    ),
    questionId: integer('question_id').references(() => progressQuestions.id),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
  },
);

export const pathwayTrackingRequestDetails = main.table(
  'pathway_tracking_request_details',
  {
    id: serial('id').primaryKey().notNull(),
    pathwayId: integer('pathway_id')
      .notNull()
      .references(() => pathways.id),
    mentorId: integer('mentor_id')
      .notNull()
      .references(() => users.id),
    menteeId: integer('mentee_id')
      .notNull()
      .references(() => users.id),
    requestId: integer('request_id')
      .notNull()
      .references(() => pathwayTrackingRequest.id),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
  },
);

export const pathwayTrackingRequest = main.table('pathway_tracking_request', {
  id: serial('id').primaryKey().notNull(),
  pathwayId: integer('pathway_id')
    .notNull()
    .references(() => pathways.id),
  mentorId: integer('mentor_id')
    .notNull()
    .references(() => users.id),
  menteeId: integer('mentee_id')
    .notNull()
    .references(() => users.id),
  status: varchar('status', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
});

export const pathwayTrackingRequestParameterDetails = main.table(
  'pathway_tracking_request_parameter_details',
  {
    id: serial('id').primaryKey().notNull(),
    parameterId: integer('parameter_id')
      .notNull()
      .references(() => progressParameters.id),
    data: integer('data').notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
  },
);

export const pathwayTrackingRequestQuestionDetails = main.table(
  'pathway_tracking_request_question_details',
  {
    id: serial('id').primaryKey().notNull(),
    questionId: integer('question_id')
      .notNull()
      .references(() => progressQuestions.id),
    data: varchar('data', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
  },
);

export const pathwaysOngoingTopic = main.table('pathways_ongoing_topic', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  pathwayId: integer('pathway_id')
    .notNull()
    .references(() => pathwaysV2.id),
  courseId: integer('course_id')
    .notNull()
    .references(() => coursesV2.id),
  exerciseId: integer('exercise_id').references(() => exercisesV2.id),
  assessmentId: integer('assessment_id').references(() => assessment.id),
});

export const pathwayCompletionV2 = main.table('pathway_completion_v2', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id),
  completeAt: timestamp('complete_at', { withTimezone: true, mode: 'string' }),
  teamId: integer('team_id').references(() => c4CaTeams.id, {
    onDelete: 'set null',
  }),
  percentage: integer('percentage'),
  pathwayId: integer('pathway_id'),
});

export const progressParameters = main.table('progress_parameters', {
  id: serial('id').primaryKey().notNull(),
  type: varchar('type', { length: 10 }).notNull(),
  minRange: integer('min_range'),
  maxRange: integer('max_range'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  name: varchar('name', { length: 20 }).notNull(),
  description: varchar('description', { length: 5000 }).notNull(),
});

export const productionVersions = main.table('production_versions', {
  id: serial('id').primaryKey().notNull(),
  courseName: varchar('course_name', { length: 255 }),
  lang: char('lang', { length: 2 }).default('en').notNull(),
  version: varchar('version', { length: 255 }),
});

export const progressQuestions = main.table('progress_questions', {
  id: serial('id').primaryKey().notNull(),
  type: varchar('type', { length: 10 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  name: varchar('name', { length: 20 }).notNull(),
  description: varchar('description', { length: 5000 }).notNull(),
});

export const questions = main.table('questions', {
  id: serial('id').primaryKey().notNull(),
  commonText: varchar('common_text', { length: 2000 }),
  enText: varchar('en_text', { length: 2000 }),
  hiText: varchar('hi_text', { length: 2000 }).notNull(),
  difficulty: integer('difficulty').notNull(),
  topic: varchar('topic', { length: 45 }).notNull(),
  type: integer('type').notNull(),
  createdAt: varchar('created_at', { length: 45 }).notNull(),
  maText: varchar('ma_text', { length: 2000 }),
  schoolTest: varchar('school_test', { length: 255 }),
  schoolid: integer('schoolId'),
});

export const questionAttempts = main.table('question_attempts', {
  id: serial('id').primaryKey().notNull(),
  enrolmentKeyId: integer('enrolment_key_id').notNull(),
  questionId: integer('question_id').notNull(),
  selectedOptionId: integer('selected_option_id'),
  textAnswer: varchar('text_answer', { length: 45 }),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
});

export const recordVersionsOfPostDeleteExercisedetails = main.table(
  'record_versions_of_post_delete_exercisedetails',
  {
    id: serial('id').primaryKey().notNull(),
    courseId: integer('course_id').references(() => coursesV2.id),
    exerciseId: integer('exercise_id').references(() => exercisesV2.id),
    version: varchar('version', { length: 255 }),
    addedOrRemoved: boolean('addedOrRemoved'),
  },
);

export const questionBuckets = main.table('question_buckets', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  numQuestions: integer('num_questions').notNull(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
});

export const questionOptions = main.table(
  'question_options',
  {
    id: serial('id').primaryKey().notNull(),
    text: varchar('text', { length: 2000 }).notNull(),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id),
    correct: boolean('correct').notNull(),
    createdAt: varchar('created_at', { length: 45 }).notNull(),
  },
  (table) => {
    return {
      idx80322QuestionIdx: index('idx_80322_question_idx').on(table.questionId),
    };
  },
);

export const questionBucketChoices = main.table(
  'question_bucket_choices',
  {
    id: serial('id').primaryKey().notNull(),
    bucketId: integer('bucket_id').references(() => questionBuckets.id),
    questionIds: text('question_ids').notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
  },
  (table) => {
    return {
      idx80307QuestionBucketChoicesBucketidForeign: index(
        'idx_80307_question_bucket_choices_bucketid_foreign',
      ).on(table.bucketId),
    };
  },
);

export const questionSets = main.table(
  'question_sets',
  {
    id: serial('id').primaryKey().notNull(),
    questionIds: varchar('question_ids', { length: 8000 }).notNull(),
    versionId: integer('version_id')
      .notNull()
      .references(() => testVersions.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => {
    return {
      idx80331QuestionSetsVersionidForeign: index(
        'idx_80331_question_sets_versionid_foreign',
      ).on(table.versionId),
    };
  },
);

export const sansaarUserRoles = main.table(
  'sansaar_user_roles',
  {
    id: serial('id').primaryKey().notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    role: varchar('role', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => {
    return {
      mainSansaarUserRolesUserIdRoleUnique: unique(
        'main_sansaar_user_roles_user_id_role_unique',
      ).on(table.userId, table.role),
    };
  },
);

export const slotBooked = main.table('slot_booked', {
  id: serial('id').primaryKey().notNull(),
  interviewSlotId: integer('interview_slot_id').references(
    () => interviewSlot.id,
  ),
  studentId: integer('student_id').references(() => students.id),
  createdAt: date('created_at'),
});

export const scratch = main.table(
  'scratch',
  {
    id: serial('id').primaryKey().notNull(),
    projectId: varchar('project_id', { length: 255 }),
    url: varchar('url', { length: 255 }).notNull(),
    userIdScratch: integer('userId_scratch'),
    projectName: varchar('project_name', { length: 255 }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    teamId: integer('team_id'),
  },
  (table) => {
    return {
      mainScratchProjectIdUnique: unique('main_scratch_project_id_unique').on(
        table.projectId,
      ),
    };
  },
);

export const registrationFormData = main.table(
  'registration_form_data',
  {
    id: serial('id').primaryKey().notNull(),
    partnerId: integer('partner_id')
      .notNull()
      .references(() => partners.id),
    formData: json('form_data'),
  },
  (table) => {
    return {
      mainRegistrationFormDataPartnerIdUnique: unique(
        'main_registration_form_data_partner_id_unique',
      ).on(table.partnerId),
    };
  },
);

export const spaceGroup = main.table('space_group', {
  id: serial('id').primaryKey().notNull(),
  groupName: varchar('group_name', { length: 255 }),
  spaceId: integer('space_id').references(() => partnerSpace.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  webLink: varchar('web_link', { length: 255 }),
  androidLink: varchar('android_link', { length: 255 }),
  crcaLink: varchar('crca_link', { length: 255 }),
});

export const studentJobDetails = main.table('student_job_details', {
  id: serial('id').primaryKey().notNull(),
  studentId: integer('student_id')
    .notNull()
    .references(() => students.id),
  jobDesignation: varchar('job_designation', { length: 255 }),
  jobLocation: varchar('job_location', { length: 255 }),
  salary: varchar('salary', { length: 255 }),
  jobType: varchar('job_type', { length: 255 }),
  employer: varchar('employer', { length: 255 }),
  resume: varchar('resume', { length: 255 }),
  offerLetterDate: timestamp('offer_letter_date', {
    withTimezone: true,
    mode: 'string',
  }),
  videoLink: varchar('video_link', { length: 255 }),
  photoLink: varchar('photo_link', { length: 255 }),
  writeUp: varchar('write_up', { length: 255 }),
});

export const studentPathways = main.table(
  'student_pathways',
  {
    id: serial('id').primaryKey().notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    pathwayId: integer('pathway_id')
      .notNull()
      .references(() => pathways.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => {
    return {
      mainStudentPathwaysUserIdPathwayIdUnique: unique(
        'main_student_pathways_user_id_pathway_id_unique',
      ).on(table.userId, table.pathwayId),
    };
  },
);

export const registrationFormStructure = main.table(
  'registration_form_structure',
  {
    id: serial('id').primaryKey().notNull(),
    partnerId: integer('partner_id')
      .notNull()
      .references(() => partners.id),
    formStructure: json('form_structure'),
  },
  (table) => {
    return {
      mainRegistrationFormStructurePartnerIdUnique: unique(
        'main_registration_form_structure_partner_id_unique',
      ).on(table.partnerId),
    };
  },
);

export const schoolStage = main.table('school_stage', {
  id: serial('id').primaryKey().notNull(),
  schoolId: integer('school_id').references(() => school.id),
  stageName: varchar('stageName', { length: 255 }),
  stageType: varchar('stageType', { length: 255 }),
});

export const studentDocuments = main.table('student_documents', {
  id: serial('id').primaryKey().notNull(),
  studentId: integer('student_id')
    .notNull()
    .references(() => students.id),
  resumeLink: varchar('Resume_link', { length: 255 }),
  idProofLink: varchar('Id_proof_link', { length: 255 }),
  signedConsentLink: varchar('signed_consent_link', { length: 255 }),
  marksheetLink: varchar('marksheet_link', { length: 255 }),
});

export const teacherCapacityBuilding = main.table('teacher_capacity_building', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id, {
    onDelete: 'cascade',
  }),
  zone: varchar('zone', { length: 255 }),
  schoolName: varchar('school_name', { length: 255 }),
  teacherName: varchar('teacher_name', { length: 255 }),
  schoolId: integer('school_id'),
  teacherId: integer('teacher_id'),
  classOfTeacher: varchar('class_of_teacher', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phoneNumber: varchar('phone_number', { length: 255 }),
});

export const talkMitra = main.table('talk_mitra', {
  id: serial('id').primaryKey().notNull(),
  firstName: varchar('first_name', { length: 255 }).notNull(),
  lastName: text('last_name').notNull(),
  gender: varchar('gender', { length: 255 }).notNull(),
  country: varchar('country', { length: 255 }),
  password: varchar('password', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
});

export const userTokens = main.table(
  'user_tokens',
  {
    id: serial('id').primaryKey().notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    userEmail: varchar('user_email', { length: 255 })
      .notNull()
      .references(() => users.email),
    accessToken: varchar('access_token', { length: 300 }).notNull(),
    refreshToken: varchar('refresh_token', { length: 300 }).notNull(),
  },
  (table) => {
    return {
      mainUserTokensUserIdUnique: unique('main_user_tokens_user_id_unique').on(table.userId)
    };
  },
);

export const userRoles = main.table(
  'user_roles',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    userId: bigint('user_id', { mode: 'number' }).references(() => users.id),
    roles: userRolesRoles('roles').default('student'),
    center: userRolesCenter('center'),
  },
  (table) => {
    return {
      idx50519UserRoleIbfk1Idx: index('idx_50519_user_role_ibfk_1_idx').on(
        table.userId,
      ),
    };
  },
);

export const studentsSchool = main.table(
  'students_school',
  {
    id: serial('id').primaryKey().notNull(),
    schoolId: integer('school_id').references(() => school.id),
    studentId: integer('student_id').references(() => students.id),
  },
  (table) => {
    return {
      mainStudentsSchoolStudentIdUnique: unique(
        'main_students_school_student_id_unique',
      ).on(table.studentId),
    };
  },
);

export const userSession = main.table('user_session', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
});

export const testVersions = main.table('test_versions', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 45 }).notNull(),
  data: text('data').notNull(),
  current: boolean('current').notNull(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
});

export const studentsStages = main.table('students_stages', {
  id: serial('id').primaryKey().notNull(),
  studentId: integer('student_id').references(() => students.id),
  fromStage: varchar('from_stage', { length: 255 }),
  toStage: varchar('to_stage', { length: 255 }),
  createdAt: varchar('created_at', { length: 255 }),
  transitionDoneBy: varchar('transition_done_by', { length: 255 }),
});

export const usersPopularSearch = main.table(
  'users_popular_search',
  {
    id: serial('id').primaryKey().notNull(),
    courseName: varchar('course_name', { length: 255 }),
    count: integer('count').default(0).notNull(),
  },
  (table) => {
    return {
      mainUsersPopularSearchCourseNameUnique: unique(
        'main_users_popular_search_course_name_unique',
      ).on(table.courseName),
    };
  },
);

export const usersSearch = main.table('users_search', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id'),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
});

export const vbSentences = main.table('vb_sentences', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
  sentence: varchar('sentence', { length: 255 }).notNull(),
  hTranslation: varchar('h_translation', { length: 255 }).default('').notNull(),
  dLevel: bigint('d_level', { mode: 'number' }).notNull(),
});

export const vbWords = main.table('vb_words', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
  word: varchar('word', { length: 250 }).notNull(),
  eMeaning: varchar('e_meaning', { length: 250 }).default('').notNull(),
  hMeaning: varchar('h_meaning', { length: 250 }).default('').notNull(),
  wordType: varchar('word_type', { length: 5 }).default(''),
  dLevel: bigint('d_level', { mode: 'number' }).notNull(),
});

export const assessmentsHistory = main.table('assessments_history', {
  id: serial('id').primaryKey().notNull(),
  slugId: integer('slug_id').notNull(),
  selectedOption: varchar('selected_option', { length: 255 }).notNull(),
  status: varchar('status', { length: 255 }).notNull(),
  attemptCount: integer('attempt_count').notNull(),
  courseId: integer('course_id').notNull(),
  userId: integer('user_id').references(() => users.id),
  teamId: integer('team_id').references(() => c4CaTeams.id),
  lang: varchar('lang', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});

export const partners = main.table(
  'partners',
  {
    id: serial('id').primaryKey().notNull(),
    name: varchar('name', { length: 45 }),
    notes: varchar('notes', { length: 2000 }).notNull(),
    slug: varchar('slug', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    referredBy: varchar('referred_by', { length: 255 }),
    email: varchar('email', { length: 255 }),
    districts: text('districts').array(),
    merakiLink: varchar('meraki_link', { length: 255 }),
    webLink: varchar('web_link', { length: 255 }),
    state: varchar('state', { length: 255 }),
    description: text('description'),
    logo: text('logo'),
    websiteLink: text('website_link'),
    platform: varchar('platform', { length: 255 }),
    pointOfContactName: varchar('point_of_contact_name', { length: 255 }),
    status: text('status'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    phoneNumber: varchar('phone_number', { length: 255 }),
  },
  (table) => {
    return {
      idx80292PartnerName: uniqueIndex('idx_80292_partner_name').on(table.name),
      idx80292PartnersSlugUnique: uniqueIndex(
        'idx_80292_partners_slug_unique',
      ).on(table.slug),
    };
  },
);

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

export const cUsers = main.table(
  'c_users',
  {
    id: serial('id').primaryKey().notNull(),
    mobile: varchar('mobile', { length: 255 }),
    userName: varchar('user_name', { length: 255 }).notNull(),
    mailId: varchar('mail_id', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    password: bytea('password'),
    profilePic: varchar('profile_pic', { length: 255 }),
    googleUserId: varchar('google_user_id', { length: 255 }),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    partnerId: integer('partner_id').references(() => partners.id),
  },
  (table) => {
    return {
      idx80228UsersEmailUnique: uniqueIndex('idx_80228_users_email_unique').on(
        table.email,
      ),
    };
  },
);

export const contacts = main.table(
  'contacts',
  {
    id: serial('id').primaryKey().notNull(),
    studentId: integer('student_id'),
    mobile: varchar('mobile', { length: 10 }),
    isWhatsapp: boolean('is_whatsapp').default(false),
    contactType: varchar('contact_type', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    altMobile: varchar('alt_mobile', { length: 255 }),
  },
  (table) => {
    return {
      idx80237StudentIdx: index('idx_80237_student_idx').on(table.studentId),
    };
  },
);

export const incomingCalls = main.table(
  'incoming_calls',
  {
    id: serial('id').primaryKey().notNull(),
    contactId: integer('contact_id').references(() => contacts.id),
    callType: varchar('call_type', { length: 15 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => {
    return {
      idx80265ContactIdx: index('idx_80265_contact_idx').on(table.contactId),
    };
  },
);

export const courses = main.table('courses', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
  name: varchar('name', { length: 100 }),
  logo: varchar('logo', { length: 100 }),
  notes: varchar('notes', { length: 10000 }),
  daysToComplete: bigint('days_to_complete', { mode: 'number' }),
  shortDescription: varchar('short_description', { length: 300 }),
  type: text('type').default('html').notNull(),
  courseType: varchar('course_type', { length: 255 }),
});

export const courseEnrolments = main.table(
  'course_enrolments',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    studentId: bigint('student_id', { mode: 'number' }).references(
      () => users.id,
    ),
    courseId: bigint('course_id', { mode: 'number' }).references(
      () => courses.id,
    ),
    enrolledAt: timestamp('enrolled_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'string',
    }),
  },
  (table) => {
    return {
      idx50433CourseEnrolmentsIbfk2Idx: index(
        'idx_50433_course_enrolments_ibfk_2_idx',
      ).on(table.studentId),
      idx50433CourseEnrolmentsIbfk1Idx: index(
        'idx_50433_course_enrolments_ibfk_1_idx',
      ).on(table.courseId),
      mainCourseEnrolmentsStudentIdCourseIdUnique: unique(
        'main_course_enrolments_student_id_course_id_unique',
      ).on(table.studentId, table.courseId),
    };
  },
);

export const users = main.table("users", {
  id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
  email: varchar("email", { length: 50 }),
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
  groupId: integer("group_id").references(() => spaceGroup.id, { onDelete: "set null" }),
  spaceId: integer("space_id").references(() => partnerSpace.id, { onDelete: "cascade", onUpdate: "cascade" }),
  c4CaPartnerId: integer("c4ca_partner_id").references(() => c4CaPartners.id, { onDelete: "set null" }),
  c4CaFacilitatorId: integer("c4ca_facilitator_id").references(() => facilitators.id, { onDelete: "set null" }),
},
  (table) => {
    return {
      idx50526GoogleUserId: uniqueIndex("idx_50526_google_user_id").on(table.googleUserId),
    }
  });

export const courseRelation = main.table(
  'course_relation',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    courseId: bigint('course_id', { mode: 'number' }).references(
      () => courses.id,
    ),
    reliesOn: bigint('relies_on', { mode: 'number' }).references(
      () => courses.id,
    ),
  },
  (table) => {
    return {
      idx50441CourseRelationIbfk1: index('idx_50441_course_relation_ibfk_1').on(
        table.courseId,
      ),
      idx50441CourseRelationIbfk2: index('idx_50441_course_relation_ibfk_2').on(
        table.reliesOn,
      ),
    };
  },
);

export const enrolmentKeys = main.table(
  'enrolment_keys',
  {
    id: serial('id').primaryKey().notNull(),
    key: varchar('key', { length: 6 }),
    studentId: integer('student_id').references(() => students.id),
    startTime: timestamp('start_time', { withTimezone: true, mode: 'string' }),
    endTime: timestamp('end_time', { withTimezone: true, mode: 'string' }),
    totalMarks: varchar('total_marks', { length: 45 }),
    typeOfTest: varchar('type_of_test', { length: 255 }),
    questionSetId: integer('question_set_id').references(() => questionSets.id),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
  },
  (table) => {
    return {
      idx80250KeyUnique: uniqueIndex('idx_80250_key__unique').on(table.key),
      idx80250StudentIdx: index('idx_80250_student_idx').on(table.studentId),
      idx80250EnrolmentKeysQuestionsetidForeign: index(
        'idx_80250_enrolment_keys_questionsetid_foreign',
      ).on(table.questionSetId),
    };
  },
);

export const exercises = main.table(
  'exercises',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    parentExerciseId: bigint('parent_exercise_id', { mode: 'number' }),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id),
    name: varchar('name', { length: 300 }).default('').notNull(),
    slug: varchar('slug', { length: 100 }).default('').notNull(),
    sequenceNum: doublePrecision('sequence_num'),
    reviewType: exercisesReviewType('review_type').default('manual'),
    content: text('content'),
    submissionType: exercisesSubmissionType('submission_type'),
    githubLink: varchar('github_link', { length: 300 }),
    solution: text('solution'),
  },
  (table) => {
    return {
      idx50457CourseId: index('idx_50457_course_id').on(table.courseId),
      idx50457SlugUnique: uniqueIndex('idx_50457_slug__unique').on(table.slug),
    };
  },
);

export const students = main.table(
  'students',
  {
    id: serial('id').primaryKey().notNull(),
    name: varchar('name', { length: 300 }),
    gender: integer('gender'),
    dob: timestamp('dob', { withTimezone: true, mode: 'string' }),
    email: varchar('email', { length: 150 }),
    state: varchar('state', { length: 2 }),
    city: varchar('city', { length: 45 }),
    gpsLat: varchar('gps_lat', { length: 45 }),
    gpsLong: varchar('gps_long', { length: 45 }),
    pinCode: varchar('pin_code', { length: 10 }),
    qualification: integer('qualification'),
    currentStatus: integer('current_status'),
    schoolMedium: integer('school_medium'),
    religon: integer('religon'),
    caste: integer('caste'),
    percentageIn10Th: varchar('percentage_in10th', { length: 255 }),
    mathMarksIn10Th: integer('math_marks_in10th'),
    percentageIn12Th: varchar('percentage_in12th', { length: 255 }),
    mathMarksIn12Th: integer('math_marks_in12th'),
    stage: varchar('stage', { length: 45 }).notNull(),
    tag: varchar('tag', { length: 255 }),
    partnerId: integer('partner_id').references(() => partners.id),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    lastUpdated: timestamp('last_updated', {
      withTimezone: true,
      mode: 'string',
    }),
    district: varchar('district', { length: 255 }),
    currentOwnerId: integer('current_owner_id').references(
      () => interviewOwners.id,
    ),
    partnerRefer: varchar('partner_refer', { length: 255 }),
    evaluation: varchar('evaluation', { length: 255 }),
    redflag: varchar('redflag', { length: 255 }),
    imageUrl: text('image_url'),
    otherActivities: varchar('other_activities', { length: 255 }),
    campusStatus: varchar('campus_status', { length: 255 }),
    schoolStageId: integer('school_stage_id').references(() => schoolStage.id),
  },
  (table) => {
    return {
      idx80358StudentsPartneridForeign: index(
        'idx_80358_students_partnerid_foreign',
      ).on(table.partnerId),
    };
  },
);

export const coursesV2 = main.table('courses_v2', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  logo: varchar('logo', { length: 255 }),
  shortDescription: varchar('short_description', { length: 255 }),
  langAvailable: text('lang_available').array(),
});

export const assessment = main.table(
  'assessment',
  {
    id: serial('id').primaryKey().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    content: text('content'),
    courseId: integer('course_id').references(() => coursesV2.id),
    exerciseId: integer('exercise_id').references(() => exercisesV2.id),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => {
    return {
      mainAssessmentNameUnique: unique('main_assessment_name_unique').on(
        table.name,
      ),
    };
  },
);

export const exercisesV2 = main.table('exercises_v2', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
  courseId: integer('course_id').references(() => coursesV2.id),
  content: text('content'),
  type: varchar('type', { length: 255 }),
  sequenceNum: doublePrecision('sequence_num'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});

export const classesToCourses = main.table('classes_to_courses', {
  id: serial('id').primaryKey().notNull(),
  classId: integer('class_id').references(() => classes.id),
  pathwayV1: integer('pathway_v1').references(() => pathways.id),
  courseV1: integer('course_v1').references(() => courses.id),
  exerciseV1: integer('exercise_v1').references(() => exercises.id),
  pathwayV2: integer('pathway_v2').references(() => pathwaysV2.id),
  courseV2: integer('course_v2').references(() => coursesV2.id),
  exerciseV2: integer('exercise_v2').references(() => exercisesV2.id),
  pathwayV3: integer('pathway_v3'),
  courseV3: integer('course_v3'),
  exerciseV3: integer('exercise_v3'),
  slugId: integer('slug_id'),
});

export const c4CaRoles = main.table('c4ca_roles', {
  id: serial('id').primaryKey().notNull(),
  role: varchar('role', { length: 255 }).notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
});

export const c4CaPartners = main.table('c4ca_partners', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  pointOfContact: varchar('point_of_contact', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 255 }),
  status: varchar('status', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
});

export const campus = main.table('campus', {
  id: serial('id').primaryKey().notNull(),
  campus: varchar('campus', { length: 225 }),
  address: varchar('address', { length: 255 }),
});

export const campusSchool = main.table(
  'campus_school',
  {
    id: serial('id').primaryKey().notNull(),
    campusId: integer('campus_id').references(() => campus.id),
    schoolId: integer('school_id').references(() => school.id),
    capacityofschool: integer('capacityofschool'),
  },
  (table) => {
    return {
      mainCampusSchoolCampusIdSchoolIdUnique: unique(
        'main_campus_school_campus_id_school_id_unique',
      ).on(table.campusId, table.schoolId),
    };
  },
);

export const school = main.table('school', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 255 }),
});

export const studentCampus = main.table('student_campus', {
  id: serial('id').primaryKey().notNull(),
  studentId: integer('student_id').references(() => students.id),
  campusId: integer('campus_id').references(() => campus.id),
});

export const chanakyaUserRoles = main.table('chanakya_user_roles', {
  id: serial('id').primaryKey().notNull(),
  chanakyaUserEmailId: integer('chanakya_user_email_id').notNull(),
  roles: integer('roles').references(() => chanakyaRoles.id),
  privilege: integer('privilege').references(() => chanakyaPrivilege.id),
});

export const chanakyaAccess = main.table(
  'chanakya_access',
  {
    id: serial('id').primaryKey().notNull(),
    userRoleId: integer('user_role_id').references(() => chanakyaUserRoles.id),
    access: integer('access').notNull(),
  },
  (table) => {
    return {
      mainChanakyaAccessUserRoleIdAccessUnique: unique(
        'main_chanakya_access_user_role_id_access_unique',
      ).on(table.userRoleId, table.access),
    };
  },
);

export const chanakyaPartnerGroup = main.table('chanakya_partner_group', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 255 }),
});

export const chanakyaPartnerRelationship = main.table(
  'chanakya_partner_relationship',
  {
    id: serial('id').primaryKey().notNull(),
    partnerId: integer('partner_id')
      .notNull()
      .references(() => partners.id),
    partnerGroupId: integer('partner_group_id')
      .notNull()
      .references(() => chanakyaPartnerGroup.id),
  },
);

export const chanakyaPrivilege = main.table(
  'chanakya_privilege',
  {
    id: serial('id').primaryKey().notNull(),
    privilege: varchar('privilege', { length: 225 }).notNull(),
    description: varchar('description', { length: 225 }).notNull(),
  },
  (table) => {
    return {
      mainChanakyaPrivilegePrivilegeUnique: unique(
        'main_chanakya_privilege_privilege_unique',
      ).on(table.privilege),
      mainChanakyaPrivilegeDescriptionUnique: unique(
        'main_chanakya_privilege_description_unique',
      ).on(table.description),
    };
  },
);

export const chanakyaRoles = main.table(
  'chanakya_roles',
  {
    id: serial('id').primaryKey().notNull(),
    roles: varchar('roles', { length: 225 }).notNull(),
    description: varchar('description', { length: 225 }).notNull(),
  },
  (table) => {
    return {
      mainChanakyaRolesRolesUnique: unique(
        'main_chanakya_roles_roles_unique',
      ).on(table.roles),
      mainChanakyaRolesDescriptionUnique: unique(
        'main_chanakya_roles_description_unique',
      ).on(table.description),
    };
  },
);

export const classes = main.table('classes', {
  id: serial('id').primaryKey().notNull(),
  title: varchar('title', { length: 255 }),
  description: varchar('description', { length: 555 }),
  facilitatorId: integer('facilitator_id'),
  startTime: timestamp('start_time', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
  endTime: timestamp('end_time', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => category.id),
  videoId: varchar('video_id', { length: 45 }),
  lang: char('lang', { length: 2 }).default('hi').notNull(),
  type: varchar('type', { length: 255 }).notNull(),
  meetLink: varchar('meet_link', { length: 255 }),
  calendarEventId: varchar('calendar_event_id', { length: 255 }),
  facilitatorName: varchar('facilitator_name', { length: 80 }),
  facilitatorEmail: varchar('facilitator_email', { length: 120 }),
  materialLink: varchar('material_link', { length: 255 }),
  maxEnrolment: integer('max_enrolment'),
  recurringId: integer('recurring_id').references(() => recurringClasses.id),
  subTitle: varchar('sub_title', { length: 255 }),
  courseVersion: varchar('course_version', { length: 255 }),
  volunteerId: integer('volunteer_id').references(() => volunteer.id),
});

export const classRegistrations = main.table(
  'class_registrations',
  {
    id: serial('id').primaryKey().notNull(),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    registeredAt: timestamp('registered_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    feedback: varchar('feedback', { length: 1000 }),
    feedbackAt: timestamp('feedback_at', {
      withTimezone: true,
      mode: 'string',
    }),
    googleRegistrationStatus: boolean('google_registration_status'),
  },
  (table) => {
    return {
      mainClassRegistrationsUserIdClassIdUnique: unique(
        'main_class_registrations_user_id_class_id_unique',
      ).on(table.classId, table.userId),
    };
  },
);

export const category = main.table('category', {
  id: serial('id').primaryKey().notNull(),
  categoryName: varchar('category_name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
});

export const classesMail = main.table('classes_mail', {
  id: serial('id').primaryKey().notNull(),
  classId: integer('class_id').references(() => classes.id),
  facilitatorEmail: varchar('facilitator_email', { length: 80 }).notNull(),
  status: varchar('status', { length: 50 }),
  type: varchar('type', { length: 255 }).notNull(),
});

export const recurringClasses = main.table('recurring_classes', {
  id: serial('id').primaryKey().notNull(),
  frequency: varchar('frequency', { length: 255 }).notNull(),
  occurrence: integer('occurrence'),
  until: date('until'),
  onDays: varchar('on_days', { length: 255 }),
  calendarEventId: varchar('calendar_event_id', { length: 255 }),
  cohortRoomId: varchar('cohort_room_id', { length: 255 }),
});

export const pathways = main.table(
  'pathways',
  {
    id: serial('id').primaryKey().notNull(),
    code: varchar('code', { length: 6 }).notNull(),
    name: varchar('name', { length: 45 }).notNull(),
    description: varchar('description', { length: 5000 }).notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    trackingEnabled: boolean('tracking_enabled').default(false).notNull(),
    trackingFrequency: varchar('tracking_frequency', { length: 255 }),
    trackingDayOfWeek: integer('tracking_day_of_week'),
    trackingDaysLockBeforeCycle: integer('tracking_days_lock_before_cycle'),
    logo: varchar('logo', { length: 255 }),
  },
  (table) => {
    return {
      mainPathwaysCodeUnique: unique('main_pathways_code_unique').on(
        table.code,
      ),
    };
  },
);

export const pathwaysV2 = main.table(
  'pathways_v2',
  {
    id: serial('id').primaryKey().notNull(),
    code: varchar('code', { length: 6 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    logo: varchar('logo', { length: 255 }),
    description: varchar('description', { length: 5000 }).notNull(),
  },
  (table) => {
    return {
      mainPathwaysV2CodeUnique: unique('main_pathways_v2_code_unique').on(
        table.code,
      ),
    };
  },
);

export const volunteer = main.table('volunteer', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id),
  hoursPerWeek: integer('hours_per_week'),
  availableOnDays: varchar('available_on_days', { length: 255 }),
  availableOnTime: varchar('available_on_time', { length: 255 }),
  status: varchar('status', { length: 255 }),
  manualStatus: varchar('manual_status', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  pathwayId: integer('pathway_id'),
});

export const courseCategories = main.table('course_categories', {
  id: serial('id').primaryKey().notNull(),
  courseId: integer('course_id')
    .notNull()
    .references(() => courses.id),
  categoryId: integer('category_id')
    .notNull()
    .references(() => category.id),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
});

export const courseCompletion = main.table(
  'course_completion',
  {
    id: serial('id').primaryKey().notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id),
  },
  (table) => {
    return {
      mainCourseCompletionUserIdCourseIdUnique: unique(
        'main_course_completion_user_id_course_id_unique',
      ).on(table.userId, table.courseId),
    };
  },
);

export const courseCompletionV2 = main.table(
  'course_completion_v2',
  {
    id: serial('id').primaryKey().notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    courseId: integer('course_id')
      .notNull()
      .references(() => coursesV2.id),
    completeAt: timestamp('complete_at', {
      withTimezone: true,
      mode: 'string',
    }),
  },
  (table) => {
    return {
      mainCourseCompletionV2CourseIdUnique: unique(
        'main_course_completion_v2_course_id_unique',
      ).on(table.courseId),
    };
  },
);

export const courseEditorStatus = main.table('course_editor_status', {
  id: serial('id').primaryKey().notNull(),
  courseId: integer('course_id').references(() => coursesV2.id),
  courseStates: varchar('course_states', { length: 255 }),
  stateChangedate: timestamp('stateChangedate', {
    withTimezone: true,
    mode: 'string',
  }),
  contentEditorsUserId: integer('content_editors_user_id').references(
    () => users.id,
  ),
});

export const courseProductionVersions = main.table(
  'course_production_versions',
  {
    id: serial('id').primaryKey().notNull(),
    courseId: integer('course_id').references(() => coursesV2.id),
    lang: char('lang', { length: 2 }).default('en').notNull(),
    version: varchar('version', { length: 255 }),
  },
);



export const dashboardFlags = main.table('dashboard_flags', {
  id: serial('id').primaryKey().notNull(),
  studentId: integer('student_id')
    .notNull()
    .references(() => students.id),
  flag: varchar('flag', { length: 255 }),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'string' }),
});

export const emailReport = main.table(
  'email_report',
  {
    id: serial('id').primaryKey().notNull(),
    partnerId: integer('partner_id')
      .notNull()
      .references(() => partners.id),
    report: varchar('report', { length: 255 }),
    status: boolean('status'),
    emails: text('emails').array(),
    repeat: varchar('repeat', { length: 255 }),
  },
  (table) => {
    return {
      mainEmailReportPartnerIdUnique: unique(
        'main_email_report_partner_id_unique',
      ).on(table.partnerId),
    };
  },
);

export const exerciseCompletion = main.table(
  'exercise_completion',
  {
    id: serial('id').primaryKey().notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id),
  },
  (table) => {
    return {
      mainExerciseCompletionUserIdExerciseIdUnique: unique(
        'main_exercise_completion_user_id_exercise_id_unique',
      ).on(table.userId, table.exerciseId),
    };
  },
);

export const c4CaTeamProjectsubmitSolution = main.table(
  'c4ca_team_projectsubmit_solution',
  {
    id: serial('id').primaryKey().notNull(),
    projectLink: varchar('project_link', { length: 255 }),
    projectFileUrl: varchar('project_file_url', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    teamId: integer('team_id')
      .notNull()
      .references(() => c4CaTeams.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    teamName: varchar('team_name', { length: 255 }).notNull(),
    isSubmitted: boolean('is_submitted'),
    unlockedAt: timestamp('unlocked_at', {
      withTimezone: true,
      mode: 'string',
    }),
    moduleId: integer('module_id').notNull(),
    projectFileName: varchar('project_file_name', { length: 255 }),
  },
);

export const facilitators = main.table('facilitators', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  pointOfContact: varchar('point_of_contact', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull(),
  webLink: varchar('web_link', { length: 255 }),
  phoneNumber: varchar('phone_number', { length: 255 }).notNull(),
  c4CaPartnerId: integer('c4ca_partner_id').references(() => c4CaPartners.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
});

export const interviewOwners = main.table(
  'interview_owners',
  {
    id: serial('id').primaryKey().notNull(),

    userId: integer('user_id')
      .notNull()
      .references(() => cUsers.id),
    available: boolean('available'),
    maxLimit: integer('max_limit').default(10),
    type: text('type').array(),
    pendingInterviewCount: integer('pending_interview_count'),
    gender: integer('gender'),
  },
  (table) => {
    return {
      mainInterviewOwnersUserIdUnique: unique(
        'main_interview_owners_user_id_unique',
      ).on(table.userId),
    };
  },
);

export const interviewSlot = main.table('interview_slot', {
  id: serial('id').primaryKey().notNull(),
  ownerId: integer('owner_id').references(() => interviewOwners.id),
  studentId: integer('student_id')
    .notNull()
    .references(() => students.id),
  studentName: varchar('student_name', { length: 255 }),
  transitionId: integer('transition_id').references(() => stageTransitions.id),
  topicName: varchar('topic_name', { length: 255 }).notNull(),
  startTime: varchar('start_time', { length: 255 }).notNull(),
  endTime: varchar('end_time', { length: 255 }),
  endTimeExpected: varchar('end_time_expected', { length: 255 }).notNull(),
  onDate: timestamp('on_date', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
  duration: varchar('duration', { length: 255 }),
  status: varchar('status', { length: 255 }).notNull(),
  isCancelled: boolean('is_cancelled').default(false),
  cancelltionReason: varchar('cancelltion_reason', { length: 255 }),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});

export const stageTransitions = main.table(
  'stage_transitions',
  {
    id: serial('id').primaryKey().notNull(),
    studentId: integer('student_id').references(() => students.id),
    fromStage: varchar('from_stage', { length: 255 }),
    toStage: varchar('to_stage', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    transitionDoneBy: varchar('transition_done_by', { length: 255 }),
    school: varchar('school', { length: 255 }),
  },
  (table) => {
    return {
      idx80349StageTransitionsStudentidForeign: index(
        'idx_80349_stage_transitions_studentid_foreign',
      ).on(table.studentId),
    };
  },
);

export const c4CaTeamProjecttopic = main.table('c4ca_team_projecttopic', {
  id: serial('id').primaryKey().notNull(),
  projectTitle: varchar('project_title', { length: 255 }),
  projectSummary: varchar('project_summary', { length: 255 }),
  projectTopicUrl: varchar('project_topic_url', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
  teamId: integer('team_id')
    .notNull()
    .references(() => c4CaTeams.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  teamName: varchar('team_name', { length: 255 }).notNull(),
  isSubmitted: boolean('is_submitted'),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true, mode: 'string' }),
  moduleId: integer('module_id').notNull(),
  projectTopicFileName: varchar('projectTopic_file_name', { length: 255 }),
});

export const mentorTree = main.table(
  'mentor_tree',
  {
    id: serial('id').primaryKey().notNull(),
    mentorId: integer('mentor_id')
      .notNull()
      .references(() => users.id),
    menteeId: integer('mentee_id')
      .notNull()
      .references(() => users.id),
    pathwayId: integer('pathway_id')
      .notNull()
      .references(() => pathways.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => {
    return {
      mainMentorTreeMentorIdMenteeIdUnique: unique(
        'main_mentor_tree_mentor_id_mentee_id_unique',
      ).on(table.mentorId, table.menteeId),
    };
  },
);

export const c4CaTeachers = main.table('c4ca_teachers', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  school: varchar('school', { length: 255 }),
  district: varchar('district', { length: 255 }),
  state: varchar('state', { length: 255 }),
  phoneNumber: varchar('phone_number', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  profileUrl: varchar('profile_url', { length: 255 }),
  facilitatorId: integer('facilitator_id'),
  profileLink: varchar('profile_link', { length: 255 }),
  c4CaPartnerId: integer('c4ca_partner_id').references(() => c4CaPartners.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
});

export const c4CaStudents = main.table('c4ca_students', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  class: integer('class').notNull(),
  teacherId: integer('teacher_id')
    .notNull()
    .references(() => c4CaTeachers.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => c4CaTeams.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
});

export const subStage = main.table('sub_stage', {
  id: serial('id').primaryKey().notNull(),
  schoolId: integer('school_id'),
  stageId: integer('stage_id').references(() => schoolStage.id),
  stageName: varchar('stage_name', { length: 255 }),
  subStages: varchar('sub_stages', { length: 255 }),
});

export const c4CaStudentsProjectDetail = main.table(
  'c4ca_students_projectDetail',
  {
    id: serial('id').primaryKey().notNull(),
    projectTitle: varchar('project_title', { length: 255 }),
    projectSummary: varchar('project_summary', { length: 255 }),
    projectUploadFileUrl: varchar('project_uploadFile_url', {
      length: 255,
    }).notNull(),
    startedDate: date('Started_date'),
    teacherId: integer('teacher_id')
      .notNull()
      .references(() => c4CaTeachers.id),
    teamId: integer('team_id')
      .notNull()
      .references(() => c4CaTeams.id),
  },
);

export const c4CaTeams = main.table(
  'c4ca_teams',
  {
    id: serial('id').primaryKey().notNull(),
    teamName: varchar('team_name', { length: 255 }).notNull(),
    teamSize: integer('team_size').notNull(),
    teacherId: integer('teacher_id')
      .notNull()
      .references(() => c4CaTeachers.id),
    loginId: varchar('login_id', { length: 255 }).notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    lastLogin: timestamp('last_login', { withTimezone: true, mode: 'string' }),
    state: varchar('state', { length: 255 }),
    district: varchar('district', { length: 255 }),
    school: varchar('school', { length: 255 }),
  },
  (table) => {
    return {
      mainC4CaTeamsTeamNameUnique: unique(
        'main_c4ca_teams_team_name_unique',
      ).on(table.teamName),
    };
  },
);

export const assessmentOutcome = main.table('assessment_outcome', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id),
  assessmentId: integer('assessment_id').notNull(),
  status: varchar('status', { length: 255 }).notNull(),
  selectedOption: integer('selected_option'),
  attemptCount: integer('attempt_count').notNull(),
  teamId: integer('team_id').references(() => c4CaTeams.id, {
    onDelete: 'set null',
  }),
  selectedMultipleOption: varchar('selected_multiple_option', { length: 255 }),
  multiple_choice: integer('multiple_choice'),
});

export const assessmentResult = main.table('assessment_result', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id),
  assessmentId: integer('assessment_id')
    .notNull()
    .references(() => assessment.id),
  status: varchar('status', { length: 255 }).notNull(),
  selectedOption: integer('selected_option').notNull(),
  attemptCount: integer('attempt_count').default(1).notNull(),
  teamId: integer('team_id').references(() => c4CaTeams.id, {
    onDelete: 'set null',
  }),
});

export const courseCompletionV3 = main.table('course_completion_v3', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id),
  courseId: integer('course_id').notNull(),
  completeAt: timestamp('complete_at', { withTimezone: true, mode: 'string' }),
  teamId: integer('team_id').references(() => c4CaTeams.id, {
    onDelete: 'set null',
  }),
  percentage: integer('percentage'),
});

export const learningTrackStatus = main.table('learning_track_status', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id),
  pathwayId: integer('pathway_id'),
  courseId: integer('course_id'),
  exerciseId: integer('exercise_id')
    .notNull()
    .references(() => exercisesV2.id),
  teamId: integer('team_id').references(() => c4CaTeams.id, {
    onDelete: 'set null',
  }),
});

export const learningTrackStatusOutcome = main.table(
  'learning_track_status_outcome',
  {
    id: serial('id').primaryKey().notNull(),
    userId: integer('user_id').references(() => users.id),
    pathwayId: integer('pathway_id'),
    courseId: integer('course_id'),
    exerciseId: integer('exercise_id'),
    teamId: integer('team_id').references(() => c4CaTeams.id, {
      onDelete: 'set null',
    }),
    moduleId: integer('module_id'),
  },
);

export const youtubeBroadcast = main.table('youtube_broadcast', {
  id: serial('id').primaryKey().notNull(),
  videoId: varchar('video_id', { length: 255 }).notNull(),
  classId: integer('class_id'),
  recurringId: integer('recurring_id'),
});

export const exercisesHistory = main.table('exercises_history', {
  id: serial('id').primaryKey().notNull(),
  slugId: integer('slug_id').notNull(),
  courseId: integer('course_id').notNull(),
  lang: varchar('lang', { length: 255 }).notNull(),
  userId: integer('user_id').references(() => users.id),
  teamId: integer('team_id').references(() => c4CaTeams.id),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});

export const exerciseCompletionV2 = main.table('exercise_completion_v2', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id),
  completeAt: timestamp('complete_at', { withTimezone: true, mode: 'string' }),
  exerciseId: integer('exercise_id'),
  teamId: integer('team_id').references(() => c4CaTeams.id, {
    onDelete: 'set null',
  }),
  slugId: integer('slug_id'),
  courseId: integer('course_id'),
  lang: varchar('lang', { length: 255 }),
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
});

export const scratchSample = main.table('scratch_sample', {
  id: serial('id').primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull(),
  url: varchar('url', { length: 255 }).notNull(),
  projectName: varchar('project_name', { length: 255 }),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
});

export const zuvySessions = main.table('zuvy_sessions', {
  id: serial('id').primaryKey().notNull(),
  meetingId: text('meeting_id').notNull(),
  hangoutLink: text('hangout_link').notNull(),
  creator: text('creator').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  // references
  batchId: integer('batch_id')
    .notNull()
    .references(() => zuvyBatches.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  secondBatchId: integer('second_batch_id').references(() => zuvyBatches.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  bootcampId: integer('bootcamp_id')
    .notNull()
    .references(() => zuvyBootcamps.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  moduleId: integer('module_id')
    .notNull()
    .references(() => zuvyCourseModules.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  chapterId: integer('chapter_id')
    .notNull()
    .references(() => zuvyModuleChapter.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  title: text('title').notNull(),
  s3link: text('s3link'),
  recurringId: integer('recurring_id'),
  status: text('status').default('upcoming'),
  version: varchar('version', { length: 10 }),
  // Meeting type and Zoom fields
  isZoomMeet: boolean('is_zoom_meet').default(true), // true for Zoom, false for Google Meet
  zoomStartUrl: text('zoom_start_url'), // Admin start URL for Zoom
  zoomPassword: text('zoom_password'),
  zoomMeetingId: text('zoom_meeting_id'), // Zoom meeting ID
  // merged  
  hasBeenMerged: boolean('has_been_merged').default(false),
  isParentSession: boolean('is_parent_session').default(false),
  isChildSession: boolean('is_child_session').default(false),
  // multi-batch invited students snapshot
  invitedStudents: jsonb('invited_students').$type<{ userId: number; email: string }[]>().default([]).notNull(),
  youtubeVideoId: text('youtube_video_id').notNull()
});

export const zuvySessionMerge = main.table('zuvy_session_merge', {
  id: serial("id").primaryKey().notNull(),
  childSessionId: integer("child_session_id").references(() => zuvySessions.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  parentSessionId: integer("parent_session_id").references(() => zuvySessions.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  redirectMeetingUrl: text('redirect_meeting_url'),
  mergedJustification: text('merged_justification'),
  isActive: boolean('is_active').default(true), // Allow deactivating merges
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow()
})

// for each session entry 
export const zuvyStudentAttendance = main.table('zuvy_student_attendance', {
  id: serial('id').primaryKey().notNull(),
  meetingId: text('meeting_id'),
  attendance: jsonb('attendance'),
  batchId: integer('batch_id').references(() => zuvyBatches.id),
  bootcampId: integer('bootcamp_id').references(() => zuvyBootcamps.id),
  version: varchar('version', { length: 10 })
});
export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent'
};

// for each session and each student entry 
export const zuvyStudentAttendanceRecords = main.table('zuvy_student_attendance_records', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  batchId: integer('batch_id').references(() => zuvyBatches.id).notNull(),
  bootcampId: integer('bootcamp_id').references(() => zuvyBootcamps.id).notNull(),
  sessionId: integer('session_id').references(() => zuvySessions.id).notNull(),
  attendanceDate: date('attendance_date').notNull(),
  status: varchar('status', { length: 10 }).notNull().default(AttendanceStatus.ABSENT),
  version: varchar('version', { length: 10 }),
  duration: integer('duration').default(0), // Duration in seconds
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

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
  session: one(zuvySessions, {
    fields: [zuvyStudentAttendanceRecords.sessionId],
    references: [zuvySessions.id],
  }),
}));

export const zuvySessionVideoRecordings = main.table('zuvy_session_video_recordings', {
  id: serial('id').primaryKey().notNull(),
  recordingUrl: text('recording_url').notNull(),
  recordingSize: integer('recording_size').notNull(),
  recordingDuration: integer('recording_duration').notNull(),
  sessionId: integer('session_id').references(() => zuvySessions.id).notNull(),
  batchId: integer('batch_id').references(() => zuvyBatches.id),
  bootcampId: integer('bootcamp_id').references(() => zuvyBootcamps.id),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

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

export const zuvySessionRecordViews = main.table('zuvy_session_record_views', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  sessionId: integer('session_id').references(() => zuvySessions.id).notNull(),
  viewedAt: timestamp('viewed_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  version: varchar('version', { length: 10 })
})

// relations 
export const zuvySessionRecordViewsRelations = relations(zuvySessionRecordViews, ({ one }) => ({
  user: one(users, {
    fields: [zuvySessionRecordViews.userId],
    references: [users.id],
  }),
  session: one(zuvySessions, {
    fields: [zuvySessionRecordViews.sessionId],
    references: [zuvySessions.id],
  }),
}));

export const zuvySessionsRelations = relations(zuvySessions, ({ one, many }) => ({
  studentData: many(users),
  views: many(zuvySessionRecordViews),
  chapter: one(zuvyModuleChapter, {
    fields: [zuvySessions.chapterId],
    references: [zuvyModuleChapter.id],
  }),
  module: one(zuvyCourseModules, {
    fields: [zuvySessions.moduleId],
    references: [zuvyCourseModules.id],
  }),
  studentAttendanceRecords: many(zuvyStudentAttendanceRecords),
  // Relations for merged sessions
  childMerges: many(zuvySessionMerge, { relationName: "childSession" }),
  parentMerges: many(zuvySessionMerge, { relationName: "parentSession" })
}));

export const zuvySessionMergeRelations = relations(zuvySessionMerge, ({ one }) => ({
  childSession: one(zuvySessions, {
    fields: [zuvySessionMerge.childSessionId],
    references: [zuvySessions.id],
    relationName: "childSession"
  }),
  parentSession: one(zuvySessions, {
    fields: [zuvySessionMerge.parentSessionId],
    references: [zuvySessions.id],
    relationName: "parentSession"
  }),
  mergedByUser: one(users, {
    fields: [zuvySessionMerge.createdAt],
    references: [users.id],
  })
}));


export const zuvyBootcamps = main.table('zuvy_bootcamps', {
  id: serial('id').primaryKey().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  collaborator: text('collaborator'),
  coverImage: text('cover_image'),
  bootcampTopic: text('bootcamp_topic'),
  startTime: timestamp('start_time', { withTimezone: true, mode: 'string' }),
  duration: integer('duration'),
  language: text('language'),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  version: varchar('version', { length: 10 }),
});

export const zuvyBootcampType = main.table('zuvy_bootcamp_type', {
  id: serial('id').primaryKey().notNull(),
  bootcampId: integer('bootcamp_id').references(() => zuvyBootcamps.id, {
    onDelete: 'cascade',
  }),
  type: text('type').notNull(), // Type of bootcamp (Public, Private, etc.)
  isModuleLocked: boolean('is_module_locked').default(false),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
});

export const batchesRelations = relations(zuvyBootcamps, ({ one, many }) => ({
  batches: many(zuvyBatches),
}));


export const zuvyBatches = main.table("zuvy_batches", {
  id: serial("id").primaryKey().notNull(),
  name: text("name").notNull(),
  bootcampId: integer("bootcamp_id"),
  instructorId: integer("instructor_id"),
  startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }),
  endDate: timestamp("end_date", { withTimezone: true, mode: 'string' }),
  status: text("status"),
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

export const zuvyBatchesRelations = relations(
  zuvyBatches,
  ({ one, many }) => ({
    instructorDetails: one(users, {
      fields: [zuvyBatches.instructorId],
      references: [users.id]
    }),
    students: many(zuvyBatchEnrollments),
    bootcampDetail: one(zuvyBootcamps, {
      fields: [zuvyBatches.bootcampId],
      references: [zuvyBootcamps.id]
    }),
    sessions: many(zuvySessions)
  })
);

export const bootcampsEnrollmentsRelations = relations(
  zuvyBootcamps,
  ({ one, many }) => ({
    students: many(zuvyBatchEnrollments),
    sessions: many(zuvySessions)
  }),
);

export const sessionBootcampRelations = relations(
  zuvySessions,
  ({ one }) => ({
    bootcampDetail: one(zuvyBootcamps, {
      fields: [zuvySessions.bootcampId],
      references: [zuvyBootcamps.id]
    }),
    batches: one(zuvyBatches, {
      fields: [zuvySessions.batchId],
      references: [zuvyBatches.id]
    })
  })
)

export const zuvyBatchEnrollments = main.table('zuvy_batch_enrollments', {
  id: serial('id').primaryKey().notNull(),
  userId: bigserial('user_id', { mode: 'bigint' })
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),
  bootcampId: integer('bootcamp_id').references(() => zuvyBootcamps.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade'
  }),
  batchId: integer('batch_id').references(() => zuvyBatches.id, {
    onDelete: 'set null',
    onUpdate: 'cascade'
  }),
  enrolledDate: timestamp('enrolled_date', { withTimezone: true, mode: 'string' }),
  lastActiveDate: timestamp('last_active_date', { withTimezone: true, mode: 'string' }),
  status: varchar('status', { length: 32 }),
  attendance: integer('attendance'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .defaultNow()
    .notNull(),
  version: varchar('version', { length: 10 }),
});

export const classesInTheBatch = relations(
  zuvyBatchEnrollments,
  ({ one, many }) => ({
    batchClasses: many(zuvySessions),
    tracking: one(zuvyBootcampTracking, {
      fields: [zuvyBatchEnrollments.bootcampId],
      references: [zuvyBootcampTracking.bootcampId],
    }),
    userTracking: one(zuvyBootcampTracking, {
      fields: [zuvyBatchEnrollments.userId],
      references: [zuvyBootcampTracking.userId],
    }),

    classInfo: one(zuvySessions, {
      fields: [zuvyBatchEnrollments.batchId],
      references: [zuvySessions.batchId],
    }),

    classesInfo: many(zuvySessions),
    bootcamp: one(zuvyBootcamps, {
      fields: [zuvyBatchEnrollments.bootcampId],
      references: [zuvyBootcamps.id],
    }),
    userInfo: one(users, {
      fields: [zuvyBatchEnrollments.userId],
      references: [users.id],
    }),
    batchInfo: one(zuvyBatches, {
      fields: [zuvyBatchEnrollments.batchId],
      references: [zuvyBatches.id],
    }),
  })
);

export const zuvyTags = main.table('zuvy_tags', {
  id: serial('id').primaryKey().notNull(),
  tagName: varchar('tag_name'),
  version: varchar('version', { length: 10 }),
});

export const zuvyModuleQuiz = main.table('zuvy_module_quiz', {
  id: serial('id').primaryKey().notNull(),
  title: text('title'),
  difficulty: difficulty('difficulty'),
  tagId: integer('tag_id').references(() => zuvyTags.id),
  usage: integer('usage').default(0),
  content: text('content'),
  isRandomOptions: boolean('is_random_options').default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 }),
});

export const zuvyModuleQuizRelations = relations(zuvyModuleQuiz, ({ one, many }) => ({
  quizVariants: many(zuvyModuleQuizVariants), // One quiz can have many variants
}));

export const zuvyModuleQuizVariants = main.table('zuvy_module_quiz_variants', {
  id: serial('id').primaryKey().notNull(),
  quizId: integer('quiz_id').references(() => zuvyModuleQuiz.id), // Foreign key to main quiz
  question: text('question'),
  options: jsonb('options'),
  correctOption: integer('correct_option'),
  variantNumber: integer('variant_number').notNull(), // The variant number
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 }),
});

export const zuvyModuleQuizVariantsRelations = relations(zuvyModuleQuizVariants, ({ one }) => ({
  quiz: one(zuvyModuleQuiz, {
    fields: [zuvyModuleQuizVariants.quizId],
    references: [zuvyModuleQuiz.id],
  }),
}));

export const zuvyCourseModules = main.table("zuvy_course_modules", {
  id: serial("id").primaryKey().notNull(),
  typeId: integer("type_id"),
  isLock: boolean("is_lock").default(false),
  bootcampId: integer("bootcamp_id").references(() => zuvyBootcamps.id),
  name: varchar("name"),
  description: text("description"),
  projectId: integer("project_id").references(() => zuvyCourseProjects.id),
  order: integer("order"),
  timeAlloted: bigint("time_alloted", { mode: "number" }),
  version: varchar('version', { length: 10 }),
})

export const zuvyModuleData = relations(zuvyBootcamps, ({ one, many }) => ({
  bootcampModulesData: one(zuvyCourseModules, {
    fields: [zuvyBootcamps.id],
    references: [zuvyCourseModules.bootcampId],
  }),
  bootcampModules: many(zuvyCourseModules),
  bootcampTracking: one(zuvyBootcampTracking, {
    fields: [zuvyBootcamps.id],
    references: [zuvyBootcampTracking.bootcampId],
  })
}))

export const bootcampModuleRelation = relations(zuvyCourseModules, ({ one }) => ({
  moduleData: one(zuvyBootcamps, {
    fields: [zuvyCourseModules.bootcampId],
    references: [zuvyBootcamps.id],
  })
}))


export const studentChapterRelation = relations(
  zuvyBatchEnrollments,
  ({ many }) => ({
    studentChapterDetails: many(zuvyChapterTracking),
  }),
);

export const zuvyModuleTopics = main.table("zuvy_module_topics", {
  id: serial("id").primaryKey().notNull(),
  name: varchar("name"),
  version: varchar('version', { length: 10 }),
})

export const zuvyPracticeCode = main.table("zuvy_practice_code", {
  id: serial("id").primaryKey().notNull(),
  userId: bigserial("user_id", { mode: "bigint" }).notNull().references(() => users.id),
  status: varchar("status", { length: 255 }).notNull(),
  action: action("action").notNull(),
  questionId: integer("question_id").references(() => zuvyCodingQuestions.id),
  codingOutsourseId: integer("coding_outsourse_id").references(() => zuvyOutsourseCodingQuestions.id),
  submissionId: integer("submission_id").references(() => zuvyAssessmentSubmission.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  sourceCode: text("source_code"),
  version: varchar('version', { length: 10 }),
  programLangId: varchar('program_lang_id', { length: 255 }),
  chapterId: integer('chapter_id').references(() => zuvyModuleChapter.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
})

export const zuvyPracticeCodeRelations = relations(zuvyPracticeCode, ({ one, many }) => ({
  TestCasesSubmission: many(zuvyTestCasesSubmission),
  codeStatus: one(users, {
    fields: [zuvyPracticeCode.userId],
    references: [users.id],
  }),
  questionDetail: one(zuvyCodingQuestions, {
    fields: [zuvyPracticeCode.questionId],
    references: [zuvyCodingQuestions.id],
  }),
  submission: one(zuvyAssessmentSubmission, {
    fields: [zuvyPracticeCode.submissionId],
    references: [zuvyAssessmentSubmission.id],
  }),
}))


export const zuvyAssignmentSubmission = main.table("zuvy_assignment_submission", {
  id: serial("id").primaryKey().notNull(),
  userId: integer("user_id").references(() => users.id),
  moduleId: integer("module_id").notNull(),
  bootcampId: integer("bootcamp_id").references(() => zuvyBootcamps.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  chapterId: integer("chapter_id").notNull(),
  timeLimit: timestamp("time_limit", { withTimezone: true, mode: 'string' }).notNull(),
  projectUrl: varchar("project_url", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
});

export const zuvyCourseProjects = main.table("zuvy_course_projects", {
  id: serial("id").primaryKey().notNull(),
  title: varchar("title"),
  instruction: jsonb("instruction"),
  isLock: boolean("is_lock").default(false),
  deadline: timestamp("completed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
})

export const zuvyProjectTracking = main.table("zuvy_project_tracking", {
  id: serial("id").primaryKey().notNull(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  projectId: integer("project_id").references(() => zuvyCourseProjects.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  moduleId: integer("module_id").references(() => zuvyCourseModules.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  bootcampId: integer("bootcamp_id").references(() => zuvyBootcamps.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  projectLink: varchar("project_link"),
  isChecked: boolean("is_checked").default(false),
  grades: integer("grades"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
})

export const projectTrackingModuleRelation = relations(zuvyProjectTracking, ({ one, many }) => ({
  projectTrackingData: one(zuvyCourseProjects, {
    fields: [zuvyProjectTracking.projectId],
    references: [zuvyCourseProjects.id],
  }),
  userDetails: one(users, {
    fields: [zuvyProjectTracking.userId],
    references: [users.id],
  }),
}))
export const zuvyBootcampTracking = main.table("zuvy_bootcamp_tracking", {
  id: serial("id").primaryKey().notNull(),
  userId: integer("user_id").references(() => users.id),
  progress: integer("progress").default(0),
  bootcampId: integer("bootcamp_id").references(() => zuvyBootcamps.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
});


export const zuvyQuizTracking = main.table("zuvy_quiz_tracking", {
  id: serial("id").primaryKey().notNull(),
  userId: integer("user_id").references(() => users.id),
  moduleId: integer("module_id"),
  mcqId: integer("mcq_id"),
  attemptCount: integer("attempt_count").default(0),
  chapterId: integer("chapter_id"),
  status: varchar("status", { length: 255 }),
  assessmentSubmissionId: integer("assessment_submission_id").references(() => zuvyAssessmentSubmission.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  questionId: integer("question_id").references(() => zuvyOutsourseQuizzes.id),
  variantId: integer("variant_id"),
  chosenOption: integer("chosen_option"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
});

export const zuvyQuizTrackingRelations = relations(zuvyQuizTracking, ({ one }) => ({
  quizSubmissions: one(zuvyAssessmentSubmission, {
    fields: [zuvyQuizTracking.assessmentSubmissionId],
    references: [zuvyAssessmentSubmission.id]
  }),
  submissionData: one(zuvyOutsourseQuizzes, {
    fields: [zuvyQuizTracking.questionId],
    references: [zuvyOutsourseQuizzes.id]
  })

}))

export const zuvyModuleTracking = main.table("zuvy_module_tracking", {
  id: serial("id").primaryKey().notNull(),
  userId: integer("user_id").references(() => users.id),
  moduleId: integer("module_id").notNull(),
  progress: integer("progress").default(0),
  bootcampId: integer("bootcamp_id").references(() => zuvyBootcamps.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
});

export const zuvyModuleChapter = main.table('zuvy_module_chapter', {
  id: serial('id').primaryKey().notNull(),
  title: varchar('title'),
  description: text('description'),
  topicId: integer('topic_id').references(() => zuvyModuleTopics.id),
  moduleId: integer('module_id').references(() => zuvyCourseModules.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  file: bytea('file'),
  links: jsonb('links'),
  articleContent: jsonb('article_content'),
  quizQuestions: jsonb('quiz_questions'),
  codingQuestions: integer('coding_questions'),
  formQuestions: jsonb('form_questions'),
  assessmentId: integer('assessment_id'),
  completionDate: timestamp('completion_date', {
    withTimezone: true,
    mode: 'string',
  }),
  order: integer('order'),
  version: varchar('version', { length: 10 })
});
export const postsRelations = relations(zuvyModuleChapter, ({ one, many }) => ({
  courseModulesData: one(zuvyCourseModules, {
    fields: [zuvyModuleChapter.moduleId],
    references: [zuvyCourseModules.id],
  }),
  chapterTrackingDetails: many(zuvyChapterTracking),
  codingQuestionDetails: one(zuvyCodingQuestions, {
    fields: [zuvyModuleChapter.codingQuestions],
    references: [zuvyCodingQuestions.id],
  }),
  quizTrackingDetails: many(zuvyQuizTracking),
  formTrackingDetails: many(zuvyFormTracking),
  OutsourseAssessments: many(zuvyOutsourseAssessments),
  ModuleAssessment: many(zuvyModuleAssessment),
  assignmentTrackingDetails: many(zuvyAssignmentSubmission),
  moduleTracked: one(zuvyModuleTracking, {
    fields: [zuvyModuleChapter.moduleId],
    references: [zuvyModuleTracking.moduleId],
  }),
  sessions: many(zuvySessions),
}));



export const projectModuleRelations = relations(zuvyCourseProjects, ({ one }) => ({
  projectModuleData: one(zuvyCourseModules, {
    fields: [zuvyCourseProjects.id],
    references: [zuvyCourseModules.projectId]
  })
}))

export const moduleChapterRelations = relations(
  zuvyCourseModules,
  ({ many }) => ({
    moduleChapterData: many(zuvyModuleChapter),
    chapterTrackingData: many(zuvyChapterTracking),
    moduleTracking: many(zuvyModuleTracking),
    projectData: many(zuvyCourseProjects)
  }),
);

export const projectTrackingRelations = relations(
  zuvyCourseProjects,
  ({ many }) => ({
    projectTrackingData: many(zuvyProjectTracking)
  })
)

export const BootcampTrackingRelation = relations(
  zuvyBootcampTracking,
  ({ one }) => ({
    bootcampTracking: one(zuvyBootcamps, {
      fields: [zuvyBootcampTracking.bootcampId],
      references: [zuvyBootcamps.id]
    })
  })
)

export const moduleTrackingRelationOfUsers = relations(
  zuvyModuleTracking,
  ({ one, many }) => ({
    bootcampInfo: one(zuvyBootcamps, {
      fields: [zuvyModuleTracking.bootcampId],
      references: [zuvyBootcamps.id]
    }),
    chapterDetailss: many(zuvyModuleChapter),
    trackingOfModuleForUser: one(zuvyCourseModules, {
      fields: [zuvyModuleTracking.moduleId],
      references: [zuvyCourseModules.id]
    })
  })
)

export const zuvyModuleAssessment = main.table('zuvy_module_assessment', {
  id: serial('id').primaryKey().notNull(),
  title: varchar('title'),
  description: text('description'),
});

export const zuvyAssessmentrelations = relations(zuvyModuleAssessment, ({ one, many }) => ({
  assessmentSubmissions: many(zuvyAssessmentSubmission)
}));

export const zuvyAssessmentSubmission = main.table("zuvy_assessment_submission", {
  id: serial("id").primaryKey().notNull(),
  assessmentOutsourseId: integer("assessment_outsourse_id").references(() => zuvyOutsourseAssessments.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  marks: doublePrecision('marks'),
  startedAt: timestamp('started_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  copyPaste: integer('copy_paste'),
  fullScreenExit: integer('full_screen_exit'),
  tabChange: integer('tab_change'),
  eyeMomentCount: integer('eye_moment_count'),
  submitedAt: timestamp('submited_at', {
    withTimezone: true,
    mode: 'string',
  }),
  codingQuestionCount: integer('coding_question_count'),
  mcqQuestionCount: integer('mcq_question_count'),
  openEndedQuestionCount: integer('open_ended_question_count'),
  attemptedCodingQuestions: integer('attempted_coding_questions'),
  attemptedMCQQuestions: integer('attempted_mcq_questions'),
  attemptedOpenEndedQuestions: integer('attempted_open_ended_questions'),
  codingScore: doublePrecision('coding_score'),
  openEndedScore: doublePrecision('open_ended_score'),
  mcqScore: doublePrecision('mcq_score'),
  requiredCodingScore: doublePrecision('required_coding_score'),
  requiredOpenEndedScore: doublePrecision('required_open_ended_score'),
  requiredMCQScore: doublePrecision('required_mcq_score'),
  isPassed: boolean('is_passed'),
  percentage: doublePrecision('percentage'),
  typeOfsubmission: varchar('type_of_submission', { length: 255 }),
  version: varchar('version', { length: 10 }),
  active: boolean('active').default(true).notNull(),
  reattemptApproved: boolean('reattempt_approved').default(false).notNull(),
  reattemptRequested: boolean('reattempt_requested').default(false).notNull(),
});

export const zuvyAssessmentSubmissionRelation = relations(zuvyAssessmentSubmission, ({ one, many }) => ({
  user: one(users, {
    fields: [zuvyAssessmentSubmission.userId],
    references: [users.id],
  }),
  submitedOutsourseAssessment: one(zuvyOutsourseAssessments, {
    fields: [zuvyAssessmentSubmission.assessmentOutsourseId],
    references: [zuvyOutsourseAssessments.id],
  }),
  openEndedSubmission: many(zuvyOpenEndedQuestionSubmission),
  quizSubmission: many(zuvyQuizTracking),
  formSubmission: many(zuvyFormTracking),
  PracticeCode: many(zuvyPracticeCode),
  reattempt: many(zuvyAssessmentReattempt),
}))

export const zuvyAssessmentReattempt = main.table("zuvy_assessment_reattempt", {
  id: serial("id").primaryKey().notNull(),
  assessmentSubmissionId: integer("assessment_submission_id").references(() => zuvyAssessmentSubmission.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  remarks: text("remarks"),
  status: varchar("status", { length: 255 }).notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
})


export const zuvyAssessmentReattemptRelation = relations(zuvyAssessmentReattempt, ({ one }) => ({
  assessmentSubmission: one(zuvyAssessmentSubmission, {
    fields: [zuvyAssessmentReattempt.assessmentSubmissionId],
    references: [zuvyAssessmentSubmission.id],
  }),
  user: one(users, {
    fields: [zuvyAssessmentReattempt.userId],
    references: [users.id],
  })
}))

export const zuvyOpenEndedQuestionSubmission = main.table("zuvy_open_ended_question_submission", {
  id: serial("id").primaryKey().notNull(),
  questionId: integer("question_id").references(() => zuvyOutsourseOpenEndedQuestions.id).notNull(),
  assessmentSubmissionId: integer("assessment_submission_id").references(() => zuvyAssessmentSubmission.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  userId: integer("user_id").references(() => users.id).notNull(),
  answer: text("answer"),
  marks: integer("marks"),
  feedback: text("feedback"),
  submitAt: timestamp("submit_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
});

export const samaClients = pgTable("sama_clients", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  macAddress: varchar("mac_address", { length: 17 }).notNull(),
  softwareInstalled: boolean("software_installed").default(false),
  wallpaperChanged: boolean("wallpaper_changed").default(false),
  createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
}, (table) => {
  return {
    macAddressKey: uniqueIndex("sama_clients_mac_address_key").on(table.macAddress),
  };
});

export const samaSystemTracking = pgTable("sama_system_tracking", {
  id: serial("id").primaryKey(),
  macAddress: varchar("mac_address", { length: 17 }).notNull(),
  activeTime: integer("active_time").default(0),
  date: timestamp("date", { withTimezone: false }).defaultNow(),
  location: text("location"),
  createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
}, (table) => {
  return {
    macAddressForeignKey: foreignKey({
      columns: [table.macAddress],
      foreignColumns: [samaClients.macAddress],
    }),
  };
});

export const zuvyOpenEndedQuestionSubmissionRelation = relations(zuvyOpenEndedQuestionSubmission, ({ one, many }) => ({
  user: one(users, {
    fields: [zuvyOpenEndedQuestionSubmission.userId],
    references: [users.id],
  }),
  openEnded: one(zuvyOpenEndedQuestions, {
    fields: [zuvyOpenEndedQuestionSubmission.questionId],
    references: [zuvyOpenEndedQuestions.id],
  }),
  submissionData: one(zuvyOutsourseOpenEndedQuestions, {
    fields: [zuvyOpenEndedQuestionSubmission.questionId],
    references: [zuvyOutsourseOpenEndedQuestions.id],
  }),
  submission: one(zuvyAssessmentSubmission, {
    fields: [zuvyOpenEndedQuestionSubmission.assessmentSubmissionId],
    references: [zuvyAssessmentSubmission.id],
  })
}))

export const assessmentData = relations(zuvyCourseModules, ({ one, many }) => ({
  moduleAssessments: many(zuvyModuleAssessment),
  moduleChapterData: many(zuvyModuleChapter),
  chapterTrackingData: many(zuvyChapterTracking),
}))

export const assessmentSubmissionRelations = relations(zuvyAssessmentSubmission, ({ one, many }) => ({
  assessmentSubmissions: many(zuvyAssessmentSubmission),
}))

export const zuvyOpenEndedQuestions = main.table('zuvy_openEnded_questions', {
  id: serial('id').primaryKey().notNull(),
  question: text('question').notNull(),
  difficulty: difficulty('difficulty'),
  tagId: integer('tag_id').references(() => zuvyTags.id),
  marks: integer('marks'),
  usage: integer('usage').default(0),
});


export const zuvyChapterTracking = main.table('zuvy_chapter_tracking', {
  id: serial('id').primaryKey().notNull(),
  userId: bigserial('user_id', { mode: 'bigint' })
    .notNull()
    .references(() => users.id),
  chapterId: integer('chapter_id')
    .notNull()
    .references(() => zuvyModuleChapter.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  moduleId: integer('module_id')
    .notNull()
    .references(() => zuvyCourseModules.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  completedAt: timestamp('completed_at', {
    withTimezone: true,
    mode: 'string',
  }),
  answerDetails: text('answer_Details'),
  version: varchar('version', { length: 10 })
});

export const chapterTrackingRelations = relations(
  zuvyChapterTracking,
  ({ one }) => ({
    user: one(users, {
      fields: [zuvyChapterTracking.userId],
      references: [users.id],
    }),
    chapter: one(zuvyModuleChapter, {
      fields: [zuvyChapterTracking.chapterId],
      references: [zuvyModuleChapter.id],
    }),
  }),
);

export const userCodeRelationsTracking = relations(
  zuvyChapterTracking,
  ({ one }) => ({
    chapterTrackingData: one(zuvyCourseModules, {
      fields: [zuvyChapterTracking.moduleId],
      references: [zuvyCourseModules.id],
    }),
  }),
);

export const userCodeRelations = relations(users, ({ one, many }) => ({
  studentCodeDetails: many(zuvyPracticeCode),
  studentAssignmentStatus: one(zuvyAssignmentSubmission, {
    fields: [users.id],
    references: [zuvyAssignmentSubmission.userId],
  }),
}));

export const userAssignmentSubmissionRelations = relations(zuvyAssignmentSubmission, ({ one, many }) => ({
  assignmentSubmission: many(users),
  chapterDetails: one(zuvyModuleChapter, {
    fields: [zuvyAssignmentSubmission.chapterId],
    references: [zuvyModuleChapter.id],
  }),
}));
export const zuvyChapterRelations = relations(
  zuvyChapterTracking,
  ({ one }) => ({
    user: one(users, {
      fields: [zuvyChapterTracking.userId],
      references: [users.id],
    }),
    chapter: one(zuvyModuleChapter, {
      fields: [zuvyChapterTracking.chapterId],
      references: [zuvyModuleChapter.id],
    }),
  }),
);

export const trackingPostsRelations = relations(
  zuvyChapterTracking,
  ({ one }) => ({
    chapterTrackingData: one(zuvyCourseModules, {
      fields: [zuvyChapterTracking.moduleId],
      references: [zuvyCourseModules.id],
    }),
  }),
);

export const zuvyOutsourseAssessments = main.table('zuvy_outsourse_assessments', {
  id: serial('id').primaryKey().notNull(),
  assessmentId: integer('assessment_id').references(() => zuvyModuleAssessment.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  bootcampId: integer('bootcamp_id').references(() => zuvyBootcamps.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  moduleId: integer('module_id').references(() => zuvyCourseModules.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  chapterId: integer('chapter_id').references(() => zuvyModuleChapter.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  codingQuestionTagId: integer('coding_question_tag_id').array(),  // New field
  mcqTagId: integer('mcq_tag_id').array(),  // New field
  easyCodingQuestions: integer('easy_coding_questions'),  // New field
  mediumCodingQuestions: integer('medium_coding_questions'),  // New field
  hardCodingQuestions: integer('hard_coding_questions'),  // New field
  totalCodingQuestions: integer('total_coding_questions'),  // New field
  totalMcqQuestions: integer('total_mcq_questions'),  // New field
  easyMcqQuestions: integer('easy_mcq_questions'),  // New field
  mediumMcqQuestions: integer('medium_mcq_questions'),  // New field
  hardMcqQuestions: integer('hard_mcq_questions'),  // New field
  weightageCodingQuestions: integer('weightage_coding_questions'),  // New field
  weightageMcqQuestions: integer('weightage_mcq_questions'),  // New field
  easyCodingMark: doublePrecision('easy_coding_mark'),  // New field
  mediumCodingMark: doublePrecision('medium_coding_mark'),  // New field
  hardCodingMark: doublePrecision('hard_coding_mark'),  // New field
  easyMcqMark: doublePrecision('easy_mcq_mark'),  // New field
  mediumMcqMark: doublePrecision('medium_mcq_mark'),  // New field
  hardMcqMark: doublePrecision('hard_mcq_mark'),  // New field
  tabChange: boolean('tab_change'),
  webCamera: boolean('web_camera'),
  passPercentage: integer('pass_percentage'),
  screenRecord: boolean('screen_record'),
  embeddedGoogleSearch: boolean('embedded_google_search'),
  deadline: text('deadline'),
  timeLimit: bigint('time_limit', { mode: 'number' }),
  marks: integer('marks'),
  copyPaste: boolean('copy_paste'),
  order: integer('order'),
  canEyeTrack: boolean('can_eye_track'),
  canTabChange: boolean('can_tab_change'),
  canScreenExit: boolean('can_screen_exit'),
  canCopyPaste: boolean('can_copy_paste'),
  publishDatetime: timestamp('publish_datetime', { withTimezone: true, mode: 'string' }),
  startDatetime: timestamp('start_datetime', { withTimezone: true, mode: 'string' }),
  endDatetime: timestamp('end_datetime', { withTimezone: true, mode: 'string' }),
  unpublishDatetime: timestamp('unpublish_datetime', { withTimezone: true, mode: 'string' }),
  currentState: integer('current_state').default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
});

export const zuvyOutsourseAssessmentsRelations = relations(zuvyOutsourseAssessments, ({ one, many }) => ({
  ModuleAssessment: one(zuvyModuleAssessment, {
    fields: [zuvyOutsourseAssessments.assessmentId],
    references: [zuvyModuleAssessment.id],
  }),
  ModuleAssessments: many(zuvyModuleAssessment),
  ModuleChapter: one(zuvyModuleChapter, {
    fields: [zuvyOutsourseAssessments.moduleId],
    references: [zuvyModuleChapter.id],
  }),
  Bootcamp: one(zuvyBootcamps, {
    fields: [zuvyOutsourseAssessments.bootcampId],
    references: [zuvyBootcamps.id],
  }),

  submitedOutsourseAssessments: many(zuvyAssessmentSubmission),
  Module: one(zuvyCourseModules, {
    fields: [zuvyOutsourseAssessments.moduleId],
    references: [zuvyCourseModules.id],
  }),
  Quizzes: many(zuvyOutsourseQuizzes),
  OpenEndedQuestions: many(zuvyOutsourseOpenEndedQuestions),
  CodingQuestions: many(zuvyOutsourseCodingQuestions),
  OutsourseQuizzes: many(zuvyOutsourseQuizzes),
  OutsourseOpenEndedQuestions: many(zuvyOutsourseOpenEndedQuestions),
  OutsourseCodingQuestions: many(zuvyOutsourseCodingQuestions),
  codingSubmissions: many(zuvyPracticeCode),

}))

export const zuvyOutsourseCodingQuestions = main.table("zuvy_outsourse_coding_questions", {
  id: serial("id").primaryKey().notNull(),
  codingQuestionId: integer("coding_question_id").references(() => zuvyCodingQuestions.id),

  assessmentOutsourseId: integer("assessment_outsourse_id").references(() => zuvyOutsourseAssessments.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  bootcampId: integer("bootcamp_id").notNull().references(() => zuvyBootcamps.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  chapterId: integer('chapter_id').references(() => zuvyModuleChapter.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
})

export const zuvyOutsourseCodingQuestionsRelations = relations(zuvyOutsourseCodingQuestions, ({ one, many }) => ({
  ModuleAssessment: one(zuvyModuleAssessment, {
    fields: [zuvyOutsourseCodingQuestions.assessmentOutsourseId],
    references: [zuvyModuleAssessment.id],
  }),
  OutsourseCodingQuestion: one(zuvyOutsourseAssessments, {
    fields: [zuvyOutsourseCodingQuestions.assessmentOutsourseId],
    references: [zuvyOutsourseAssessments.id],
  }),
  ModuleChapter: one(zuvyModuleChapter, {
    fields: [zuvyOutsourseCodingQuestions.chapterId],
    references: [zuvyModuleChapter.id],
  }),
  Bootcamp: one(zuvyBootcamps, {
    fields: [zuvyOutsourseCodingQuestions.bootcampId],
    references: [zuvyBootcamps.id],
  }),
  CodingQuestion: one(zuvyCodingQuestions, {
    fields: [zuvyOutsourseCodingQuestions.codingQuestionId],
    references: [zuvyCodingQuestions.id],
  }),
}))

export const zuvyOutsourseOpenEndedQuestions = main.table('zuvy_outsourse_openEnded_questions', {
  id: serial('id').primaryKey().notNull(),
  openEndedQuestionId: integer('open_ended_question_id').references(() => zuvyOpenEndedQuestions.id),
  marks: integer('marks'),
  assessmentOutsourseId: integer("assessment_outsourse_id").references(() => zuvyOutsourseAssessments.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  bootcampId: integer("bootcamp_id").notNull().references(() => zuvyBootcamps.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  moduleId: integer('module_id').references(() => zuvyCourseModules.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  chapterId: integer('chapter_id').references(() => zuvyModuleChapter.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
})

export const OutsourseOpenEndedQuestionsRelations = relations(zuvyOutsourseOpenEndedQuestions, ({ one, many }) => ({
  ModuleAssessment: one(zuvyModuleAssessment, {
    fields: [zuvyOutsourseOpenEndedQuestions.assessmentOutsourseId],
    references: [zuvyModuleAssessment.id],
  }),
  OutsourseOpenEndedQuestion: one(zuvyOutsourseAssessments, {
    fields: [zuvyOutsourseOpenEndedQuestions.assessmentOutsourseId],
    references: [zuvyOutsourseAssessments.id],
  }),
  ModuleChapter: one(zuvyModuleChapter, {
    fields: [zuvyOutsourseOpenEndedQuestions.chapterId],
    references: [zuvyModuleChapter.id],
  }),
  Bootcamp: one(zuvyBootcamps, {
    fields: [zuvyOutsourseOpenEndedQuestions.bootcampId],
    references: [zuvyBootcamps.id],
  }),
  OpenEndedQuestion: one(zuvyOpenEndedQuestions, {
    fields: [zuvyOutsourseOpenEndedQuestions.openEndedQuestionId],
    references: [zuvyOpenEndedQuestions.id],
  }),
  submissionsData: many(zuvyOpenEndedQuestionSubmission),
}))

export const zuvyOutsourseQuizzes = main.table('zuvy_outsourse_quizzes', {
  id: serial('id').primaryKey().notNull(),
  quiz_id: integer('quiz_id').references(() => zuvyModuleQuiz.id),
  marks: integer('marks'),
  assessmentOutsourseId: integer("assessment_outsourse_id").references(() => zuvyOutsourseAssessments.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  bootcampId: integer("bootcamp_id").notNull().references(() => zuvyBootcamps.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  chapterId: integer('chapter_id').references(() => zuvyModuleChapter.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
});

export const zuvyRecentBootcamp = main.table('zuvy_recent_bootcamp', {
  id: serial('id').primaryKey().notNull(),
  userId: bigserial('user_id', { mode: 'bigint' })
    .notNull()
    .references(() => users.id),
  bootcampId: integer("bootcamp_id").notNull().references(() => zuvyBootcamps.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  moduleId: integer('module_id').references(() => zuvyCourseModules.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }).notNull(),
  chapterId: integer('chapter_id').references(() => zuvyModuleChapter.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  progress: integer('progress'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
})

export const OutsourseQuizzesRelations = relations(zuvyOutsourseQuizzes, ({ one, many }) => ({
  ModuleAssessment: one(zuvyModuleAssessment, {
    fields: [zuvyOutsourseQuizzes.assessmentOutsourseId],
    references: [zuvyModuleAssessment.id],
  }),

  ModuleChapter: one(zuvyModuleChapter, {
    fields: [zuvyOutsourseQuizzes.chapterId],
    references: [zuvyModuleChapter.id],
  }),
  Bootcamp: one(zuvyBootcamps, {
    fields: [zuvyOutsourseQuizzes.bootcampId],
    references: [zuvyBootcamps.id],
  }),
  Quiz: one(zuvyModuleQuiz, {
    fields: [zuvyOutsourseQuizzes.quiz_id],
    references: [zuvyModuleQuiz.id],
  }),
  OutsourseQuiz: one(zuvyOutsourseAssessments, {
    fields: [zuvyOutsourseQuizzes.assessmentOutsourseId],
    references: [zuvyOutsourseAssessments.id],
  }),
  submissionsData: many(zuvyQuizTracking),

}))


export const zuvyChapterTrackingRelations = relations(
  zuvyChapterTracking,
  ({ one }) => ({
    user: one(users, {
      fields: [zuvyChapterTracking.userId],
      references: [users.id],
    }),

    chapter: one(zuvyModuleChapter, {
      fields: [zuvyChapterTracking.chapterId],
      references: [zuvyModuleChapter.id],
    }),
  }),
);


export const quizChapterRelations = relations(
  zuvyCourseModules,
  ({ many, one }) => ({
    moduleChapterData: many(zuvyModuleChapter),
    chapterTrackingData: many(zuvyChapterTracking),
    quizTrackingData: many(zuvyQuizTracking),
    moduleQuizData: many(zuvyModuleQuizVariants)
  }),
);

export const quizModuleRelation = relations(
  zuvyModuleQuizVariants,
  ({ many }) => ({
    quizTrackingData: many(zuvyQuizTracking)
  })

);

export const quizTrackingRelation = relations(
  zuvyQuizTracking,
  ({ one }) => ({
    quizQuestion: one(zuvyModuleQuizVariants, {
      fields: [zuvyQuizTracking.mcqId],
      references: [zuvyModuleQuizVariants.id],
    }),
  })
);


export const zuvyModuleForm = main.table('zuvy_module_form', {
  id: serial('id').primaryKey().notNull(),
  chapterId: integer('chapter_id').references(() => zuvyModuleChapter.id).notNull(),
  question: text('question'),
  options: jsonb('options'),
  typeId: integer('type_id').references(() => zuvyQuestionTypes.id),
  isRequired: boolean('is_required').notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  usage: integer('usage').default(0),
  version: varchar('version', { length: 10 })
});

export const zuvyQuestionTypes = main.table('zuvy_question_type', {
  id: serial('id').primaryKey().notNull(),
  questionType: varchar('question_type'),
});

export const zuvyFormTracking = main.table("zuvy_form_tracking", {
  id: serial("id").primaryKey().notNull(),
  userId: integer("user_id").references(() => users.id),
  moduleId: integer("module_id"),
  questionId: integer("question_id"),
  chapterId: integer("chapter_id"),
  chosenOptions: integer("chosen_options").array(),
  answer: text("answer"),
  status: varchar("status", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
});


export const formModuleRelation = relations(
  zuvyModuleForm,
  ({ many }) => ({
    formTrackingData: many(zuvyFormTracking)
  })

);

export const formTrackingRelation = relations(
  zuvyFormTracking,
  ({ one }) => ({
    formQuestion: one(zuvyModuleForm, {
      fields: [zuvyFormTracking.questionId],
      references: [zuvyModuleForm.id],
    }),
  })
);

export const zuvyFormModuleRelations = relations(
  zuvyModuleTracking,
  ({ one }) => ({
    user: one(users, {
      fields: [zuvyModuleTracking.userId],
      references: [users.id],
    })
  }),
);

export const zuvyFormBatchRelations = relations(
  zuvyBatchEnrollments,
  ({ one }) => ({
    user: one(users, {
      fields: [zuvyBatchEnrollments.userId],
      references: [users.id],
    }),
    bootcamp: one(zuvyBootcamps, {
      fields: [zuvyBatchEnrollments.bootcampId],
      references: [zuvyBootcamps.id],
    }),
  }),
);

export const zuvyCodingQuestions = main.table("zuvy_coding_questions", {
  id: serial("id").primaryKey().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  difficulty: varchar("difficulty", { length: 50 }),
  content: jsonb("content"),
  constraints: text("constraints"),
  usage: integer("usage"),
  tagId: integer("tag_id").references(() => zuvyTags.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
})

export const codingQuestionRelations = relations(zuvyCodingQuestions, ({ one, many }) => ({
  submissions: many(zuvyPracticeCode),
  testCases: many(zuvyTestCases),
}))


export const zuvyTestCases = main.table("zuvy_test_cases", {
  id: serial("id").primaryKey().notNull(),
  questionId: integer("question_id").references(() => zuvyCodingQuestions.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  inputs: jsonb("inputs").notNull(),
  expectedOutput: jsonb("expected_output").notNull(),
  version: varchar('version', { length: 10 })
});

export const zuvyCodingQuestionsRelation = relations(zuvyTestCases, ({ one, many }) => ({
  codingQuestion: one(zuvyCodingQuestions, {
    fields: [zuvyTestCases.questionId],
    references: [zuvyCodingQuestions.id],
  }),
}))

export const zuvyTestCasesSubmission = main.table("zuvy_test_cases_submission", {
  id: serial("id").primaryKey().notNull(),
  testcastId: integer("testcast_id").references(() => zuvyTestCases.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  status: varchar("status", { length: 255 }),
  token: varchar("token", { length: 255 }),
  languageId: integer("language_id").references(() => zuvyLanguages.id),
  stdout: text("stdout"),
  submissionId: integer("submission_id").references(() => zuvyPracticeCode.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  memory: integer("memory"),
  time: numeric("time"),
  stderr: text("stderr"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  version: varchar('version', { length: 10 })
});

export const zuvyTestCasesSubmissionRelation = relations(zuvyTestCasesSubmission, ({ one, many }) => ({
  testCases: one(zuvyTestCases, {
    fields: [zuvyTestCasesSubmission.testcastId],
    references: [zuvyTestCases.id],
  }),
  submission: one(zuvyPracticeCode, {
    fields: [zuvyTestCasesSubmission.submissionId],
    references: [zuvyPracticeCode.id],
  }),
}))


export const zuvyLanguages = main.table("zuvy_languages", {
  id: serial("id").primaryKey().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  languageId: varchar("language_id", { length: 50 }).notNull(),
  defaultCodingTemplate: text("default_coding_template").notNull(),
  version: varchar('version', { length: 10 })
});

export const zuvyStudentApplicationRecord = main.table('zuvy_student_application_record', {
  id: serial('id').primaryKey().notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phoneNo: integer('phone_no').notNull(),
  year: text('year').notNull(),
  familyIncomeUnder3Lakhs: boolean('family_income_under_3lakhs').notNull(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  version: varchar('version', { length: 10 })
});
export const blacklistedTokens = main.table('blacklisted_tokens', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
  token: varchar('token', { length: 500 }).notNull(),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});


// Zoom license allocation tracking
export const zuvyZoomLicenses = main.table('zuvy_zoom_licenses', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').notNull(),
  // zoom license type: 1 basic, 2 licensed, 3 on-prem
  licenseType: integer('license_type').notNull().default(2),
  // current status: active, downgraded, revoked
  status: varchar('status', { length: 20 }).notNull().default('active'),
  // when this allocation started (first time assigned or upgraded)
  assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  // when downgraded/revoked
  releasedAt: timestamp('released_at', { withTimezone: true, mode: 'string' }),
  // optional reference to the session that triggered ensuring license
  lastSessionId: integer('last_session_id'),
  // counts for analytics
  meetingsHosted: integer('meetings_hosted').notNull().default(0),
  // auditing
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => {
  return {
    zuvyZoomLicenses: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'zoom_licenses_user_id_fkey'
    }).onUpdate('cascade').onDelete('cascade'),
    zoomLicensesLastSessionIdFkey: foreignKey({
      columns: [table.lastSessionId],
      foreignColumns: [zuvySessions.id],
      name: 'zoom_licenses_last_session_id_fkey'
    }).onUpdate('cascade').onDelete('set null'),
    zoomLicensesUserUniqueIdx: uniqueIndex('zoom_licenses_user_id_key').on(table.userId)
  };
});

// Zoom users table (tracks provisioned Zoom accounts mapped to platform users)
export const zuvyZoomUsers = main.table('zuvy_zoom_users', {
  id: serial('id').primaryKey().notNull(),
  userId: integer('user_id').notNull(), // FK to users table
  zoomEmail: varchar('zoom_email', { length: 255 }).notNull(),
  zoomUserId: varchar('zoom_user_id', { length: 128 }), // Zoom's internal user id (optional store)
  type: integer('type').notNull().default(1), // 1 Basic, 2 Licensed, 3 On-Prem
  status: varchar('status', { length: 30 }).notNull().default('active'), // active, pending, deactivated
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => {
  return {
    zoomUsersUserIdFkey: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'zoom_users_user_id_fkey'
    }).onUpdate('cascade').onDelete('cascade'),
    zoomUsersUserUnique: uniqueIndex('zoom_users_user_id_key').on(table.userId),
    zoomUsersZoomEmailUnique: uniqueIndex('zoom_users_zoom_email_key').on(table.zoomEmail)
  };
});

// RBAC: Roles Table
export const zuvyUserRoles = main.table('zuvy_user_roles', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 50 }).notNull().unique(), // e.g. 'admin', 'instructor', 'ops'
  description: text('description'),
});

export const zuvyResources = main.table('zuvy_resources', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 64 }).notNull().unique(),
  name: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
// RBAC: Permissions Table
export const zuvyPermissions = main.table('zuvy_permissions', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 100 }).notNull(), // e.g. 'view', 'create', etc. - not unique
  resourcesId: integer('resource_id').notNull().references(() => zuvyResources.id),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});
export const zuvyPermissionsRoles = main.table('zuvy_permissions_roles', {
  id: serial('id').primaryKey().notNull(),
  permissionId: integer('permission_id').notNull().references(() => zuvyPermissions.id),
  roleId: integer('role_id').notNull().references(() => zuvyUserRoles.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => ({
  uniqRolePermission: unique("uniq_role_permission").on(
    table.roleId,
    table.permissionId
  )
})
);
export const zuvyPermissionsRolesRelations = relations(zuvyPermissionsRoles, ({ many }) => ({
  permissions: many(zuvyPermissions),
  roles: many(zuvyUserRoles),
}));

export const zuvyUserPermissions = main.table('zuvy_user_permissions', {
  id: serial('id').primaryKey().notNull(),
  userId: bigserial("user_id", { mode: "bigint" }).notNull().references(() => users.id),
  permissionId: integer('permission_id').notNull().references(() => zuvyPermissions.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const zuvyUserPermissionsRelations = relations(zuvyUserPermissions, ({ one }) => ({
  user: one(users, {
    fields: [zuvyUserPermissions.userId],
    references: [users.id],
  }),
  permission: one(zuvyPermissions, {
    fields: [zuvyUserPermissions.permissionId],
    references: [zuvyPermissions.id],
  }),
}));

export const userPermissionsRelations = relations(zuvyUserPermissions, ({ many }) => ({
  userPermissions: many(zuvyUserPermissions),
  permissions: many(zuvyPermissions),
  users: many(users),
}));



// RBAC: UserRoles (M:N)
export const zuvyUserRolesAssigned = main.table('zuvy_user_roles_assigned', {
  id: serial('id').primaryKey().notNull(),
  userId: bigserial("user_id", { mode: "bigint" }).notNull().references(() => users.id),
  roleId: integer('role_id').notNull().references(() => zuvyUserRoles.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => ({
  pk: primaryKey(t.userId, t.roleId),
}));

// RBAC: RolePermissions (M:N)
export const zuvyRolePermissions = main.table('zuvy_role_permissions', {
  id: serial('id').primaryKey().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  roleId: integer('role_id').notNull().references(() => zuvyUserRoles.id),
  permissionId: integer('permission_id').notNull().references(() => zuvyPermissions.id),
}, (t) => ({
  pk: primaryKey(t.roleId, t.permissionId),
}));

// RBAC Relations
export const rolesRelations = relations(zuvyUserRoles, ({ many }) => ({
  userRoles: many(zuvyUserRolesAssigned),
  rolePermissions: many(zuvyRolePermissions),
}));

export const permissionsRelations = relations(zuvyPermissions, ({ many }) => ({
  rolePermissions: many(zuvyRolePermissions),
  permissionsScope: many(zuvyPermissionsScope),
}));

export const userRolesAssignedelations = relations(zuvyUserRolesAssigned, ({ one }) => ({
  user: one(users, {
    fields: [zuvyUserRolesAssigned.userId],
    references: [users.id],
  }),
  role: one(zuvyUserRoles, {
    fields: [zuvyUserRolesAssigned.roleId],
    references: [zuvyUserRoles.id],
  }),
}));

export const rolePermissionsRelations = relations(zuvyRolePermissions, ({ one }) => ({
  role: one(zuvyUserRoles, {
    fields: [zuvyRolePermissions.roleId],
    references: [zuvyUserRoles.id],
  }),
  permission: one(zuvyPermissions, {
    fields: [zuvyRolePermissions.permissionId],
    references: [zuvyPermissions.id],
  }),
}));

export const zuvyScopes = main.table('zuvy_scopes', {
  id: serial('id').primaryKey().notNull(),
  name: varchar('name', { length: 100 }).notNull().unique(), // e.g. 'self', 'org' etc.
  description: text('description'),
});

// RBAC: Permissions Scope (M:N)
export const zuvyPermissionsScope = main.table('zuvy_permissions_scope', {
  id: serial('id').primaryKey().notNull(),
  permissionId: integer('permission_id').notNull().references(() => zuvyPermissions.id),
  scopeId: integer('scope_id').notNull().references(() => zuvyScopes.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => ({
  pk: primaryKey(t.permissionId, t.scopeId),
}));

export const zuvyAuditLogs = main.table('zuvy_audit_logs', {
  id: serial('id').primaryKey().notNull(),
  actorUserId: bigserial("actor_user_id", { mode: "bigint" }).references(() => users.id),
  targetUserId: bigserial('target_user_id', { mode: "bigint" }).references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  roleId: integer('role_id').references(() => zuvyUserRoles.id),
  permissionId: integer('permission_id').references(() => zuvyPermissions.id),
  scopeId: integer('scope_id').references(() => zuvyScopes.id).default(null),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .defaultNow()
    .$onUpdate(() => sql`now()`),
})

// Relations for scopes and audit logs
export const zuvyScopesRelations = relations(zuvyScopes, ({ many }) => ({
  auditLogs: many(zuvyAuditLogs),
  permissionsScope: many(zuvyPermissionsScope),
}));

// RBAC: Permissions Scope Relations
export const zuvyPermissionsScopeRelations = relations(zuvyPermissionsScope, ({ one }) => ({
  permission: one(zuvyPermissions, {
    fields: [zuvyPermissionsScope.permissionId],
    references: [zuvyPermissions.id],
  }),
  scope: one(zuvyScopes, {
    fields: [zuvyPermissionsScope.scopeId],
    references: [zuvyScopes.id],
  }),
}));

export const zuvyAuditLogRelations = relations(zuvyAuditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [zuvyAuditLogs.actorUserId],
    references: [users.id],
    relationName: 'actorUser',
  }),
  target: one(users, {
    fields: [zuvyAuditLogs.targetUserId],
    references: [users.id],
    relationName: 'targetUser',
  }),
  role: one(zuvyUserRoles, {
    fields: [zuvyAuditLogs.roleId],
    references: [zuvyUserRoles.id],
  }),
  permission: one(zuvyPermissions, {
    fields: [zuvyAuditLogs.permissionId],
    references: [zuvyPermissions.id],
  }),
  scope: one(zuvyScopes, {
    fields: [zuvyAuditLogs.scopeId],
    references: [zuvyScopes.id],
  }),
}));

// Reverse relations on users to disambiguate actor/target
export const usersAuditRelations = relations(users, ({ many }) => ({
  actorAuditLogs: many(zuvyAuditLogs, { relationName: 'actorUser' }),
  targetAuditLogs: many(zuvyAuditLogs, { relationName: 'targetUser' }),
}));

export const zuvyExtraPermissions = main.table('zuvy_extra_permissions', {
  id: serial('id').primaryKey().notNull(),
  userId: bigserial('user_id', { mode: "bigint" }).notNull().references(() => users.id), // jisko extra permission mila
  grantedBy: bigserial('granted_by', { mode: "bigint" }).notNull().references(() => users.id), // admin jo grant kar raha hai
  permissionId: integer('permission_id').notNull().references(() => zuvyPermissions.id), // extra permission ka type (edit/delete etc.)
  resourceId: integer('resource_id').notNull().references(() => zuvyResources.id), // e.g. course, user
  courseName: varchar('course_name', { length: 255 }), // jis course pe action mila
  action: varchar('action', { length: 100 }).notNull(), // e.g. 'edit', 'delete'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const extraPermissionsRelations = relations(zuvyExtraPermissions, ({ one }) => ({
  user: one(users, {
    fields: [zuvyExtraPermissions.userId],
    references: [users.id],
    relationName: 'extraPermissionUser',
  }),
  grantedByUser: one(users, {
    fields: [zuvyExtraPermissions.grantedBy],
    references: [users.id],
    relationName: 'grantedByUser',
  }),
  permission: one(zuvyPermissions, {
    fields: [zuvyExtraPermissions.permissionId],
    references: [zuvyPermissions.id],
  }),
  resource: one(zuvyResources, {
    fields: [zuvyExtraPermissions.resourceId],
    references: [zuvyResources.id],
  }),
}));

export const usersExtraPermissionsRelations = relations(users, ({ many }) => ({
  extraPermissions: many(zuvyExtraPermissions, { relationName: 'extraPermissionUser' }),
  grantedPermissions: many(zuvyExtraPermissions, { relationName: 'grantedByUser' }),
}));

//llm related tables
export const aiAssessment = main.table("ai_assessment", {
  id: serial("id").primaryKey().notNull(),
  bootcampId: integer("bootcamp_id")
    .notNull()
    .references(() => zuvyBootcamps.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  topics: jsonb("topics").notNull(),
  audience: jsonb("audience").default(null),
  totalNumberOfQuestions: integer("total_number_of_questions").notNull(),
  totalQuestionsWithBuffer: integer("total_questions_with_buffer").notNull(),
  startDatetime: timestamp('start_datetime', { withTimezone: true, mode: 'string' }),
  endDatetime: timestamp('end_datetime', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

export const questionsByLLM = main.table("questions_by_llm", {
  id: serial("id").primaryKey().notNull(),
  topic: varchar("topic", { length: 100 }),
  difficulty: varchar("difficulty", { length: 50 }),
  aiAssessmentId: integer('ai_assessment_id').references(() => aiAssessment.id).notNull(),
  question: text("question").notNull(),
  language: varchar("language", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

export const mcqQuestionOptions = main.table("mcq_question_options", {
  id: serial("id").primaryKey().notNull(),
  questionId: integer("question_id").notNull().references(() => questionsByLLM.id, { onDelete: "cascade" }),
  optionText: text("option_text").notNull(),
  optionNumber: integer("option_number").notNull(), // e.g., 1,2,3,4
});

export const correctAnswers = main.table("correct_answers", {
  id: serial("id").primaryKey().notNull(),
  questionId: integer("question_id").notNull().references(() => questionsByLLM.id, { onDelete: "cascade" }),
  correctOptionId: integer("correct_option_id").notNull().references(() => mcqQuestionOptions.id, { onDelete: "cascade" }),
});

export const questionLevelRelation = main.table("question_level_relation", {
  id: serial("id").primaryKey().notNull(),
  levelId: integer("level_id").notNull().references(() => levels.id),
  questionId: integer("question_id").notNull().references(() => questionsByLLM.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
}, (table) => ({
  uniqStudentQuestion: unique("uniq_student_question").on(table.levelId, table.questionId),
}));

export const questionStudentAnswerRelation = main.table("question_student_answer_relation", {
  id: serial("id").primaryKey().notNull(),
  studentId: integer("student_id").notNull().references(() => users.id),
  questionId: integer("question_id").notNull().references(() => questionsByLLM.id),
  answer: integer("answer").notNull().references(() => correctAnswers.id),
  answeredAt: timestamp("answered_at", { withTimezone: true, mode: "string" }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
}, (table) => ({
  uniqStudentQuestionAnswer: unique("uniq_student_question_answer").on(table.studentId, table.questionId),
}));

export const levels = main.table("levels", {
  id: serial("id").primaryKey().notNull(),
  grade: varchar("grade", { length: 5 }).notNull(), // e.g. A+, A, B...
  scoreRange: varchar("score_range", { length: 50 }).notNull(), // e.g. ">= 90", "80-89"
  scoreMin: integer("score_min"), // optional numeric range start
  scoreMax: integer("score_max"), // optional numeric range end
  hardship: varchar("hardship", { length: 20 }), // "+20%", etc.
  meaning: text("meaning"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
}, (table) => ({
  uniqGrade: unique("uniq_level_grade").on(table.grade),
}));

export const studentLevelRelation = main.table("student_level_relation", {
  id: serial("id").primaryKey().notNull(),
  studentId: integer("student_id").notNull().references(() => users.id),
  levelId: integer("level_id").notNull().references(() => levels.id),
  aiAssessmentId: integer('ai_assessment_id').references(() => aiAssessment.id).default(null),
  assignedAt: timestamp("assigned_at", { withTimezone: true, mode: "string" }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
}, (table) => ({
  uniqStudentLevel: unique("uniq_student_assessment").on(table.studentId, table.aiAssessmentId),
}));

export const questionEvaluation = main.table('question_evaluation', {
  id: serial('id').primaryKey().notNull(),
  aiAssessmentId: integer('ai_assessment_id').references(() => aiAssessment.id).default(null),
  question: text('question').notNull(),
  topic: varchar('topic', { length: 255 }),
  difficulty: varchar('difficulty', { length: 50 }),
  options: jsonb('options').notNull(), // { "1": "A", "2": "B", "3": "C", "4": "D" }
  // correctOption: integer('correct_option').notNull(),
  selectedAnswerByStudent: integer('selected_answer_by_student').notNull(),
  language: varchar('language', { length: 50 }),
  status: varchar('status', { length: 50 }).default(null), // e.g., 'correct' or 'incorrect'
  explanation: text('explanation'),
  summary: text('summary'),
  recommendations: text('recommendations'),
  studentId: integer("student_id").notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const studentAssessment = main.table('student_assessment', {
  id: serial('id').primaryKey().notNull(),
  studentId: integer("student_id").notNull().references(() => users.id),
  aiAssessmentId: integer('ai_assessment_id').notNull().references(() => aiAssessment.id),
  status: integer('status').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => ({
  uniqStudentAssessment: unique("uniq_student_assessment").on(table.studentId, table.aiAssessmentId),
}));