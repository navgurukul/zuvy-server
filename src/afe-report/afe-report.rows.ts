import {
  FormAnswer,
  FormQuestion,
  detectFeedbackQuestions,
  detectSignupQuestions,
  feedbackText,
  gradeAnswer,
  itpAverage,
  looksLikeEmail,
  recommendScoreOf,
  roleAnswer,
  schoolTypeAnswer,
  starRatingAnswer,
  studentCountOf,
  textAnswer,
} from './afe-report.forms';

/**
 * Turning loaded data into report rows. Nothing here touches the database,
 * so all of it is unit tested.
 *
 * One row = one Student ID account (signed up without an email) that finished
 * one tour. A tour is finished when the student submits its feedback form (the
 * last form in the module); that time is the completion_date, and each
 * finished tour is reported exactly once, in the report whose period contains
 * that time.
 */

export const TOPIC = { VIDEO: 1, FORM: 7 } as const;

export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The report's columns, in the order of the client's sample sheet. */
export const REPORT_COLUMNS = [
  { key: 'studentName', header: 'Student Name', width: 24 },
  { key: 'studentId', header: 'Student ID', width: 22 },
  { key: 'email', header: 'Email', width: 30 },
  { key: 'state', header: 'State', width: 16 },
  { key: 'city', header: 'City', width: 18 },
  { key: 'schoolName', header: 'School name', width: 34 },
  { key: 'schoolUdise', header: 'School UDISE', width: 14 },
  { key: 'grade', header: "Student's grade", width: 14 },
  { key: 'schoolType', header: 'Enter school type', width: 26 },
  { key: 'courseContent', header: 'Course content', width: 44 },
  { key: 'sessionId', header: 'Session ID', width: 38 },
  { key: 'completionDate', header: 'completion_date', width: 24 },
  { key: 'studentCount', header: 'student_count', width: 13 },
  { key: 'dataCollectionMethod', header: 'data_collection_method', width: 22 },
  { key: 'unitType', header: 'unit_type', width: 10 },
  { key: 'itpAvg', header: 'itp_avg', width: 8 },
  {
    key: 'totalWatchTimeSeconds',
    header: 'total_watch_time_seconds',
    width: 24,
  },
  { key: 'sessionCompletedFlag', header: 'session_completed_flag', width: 22 },
  { key: 'teacherFeedbackText', header: 'teacher_feedback_text', width: 40 },
  { key: 'dataSource', header: 'data_source', width: 14 },
  { key: 'facilitatorName', header: 'facilitator_name', width: 16 },
  { key: 'language', header: 'language', width: 10 },
  { key: 'partnerName', header: 'partner_name', width: 12 },
] as const;

export type ReportColumnKey = (typeof REPORT_COLUMNS)[number]['key'];

export interface ReportRow {
  studentName: string;
  studentId: string;
  email: string;
  state: string;
  city: string;
  schoolName: string;
  schoolUdise: string;
  grade: string;
  schoolType: string;
  courseContent: string;
  sessionId: string;
  completionDate: Date;
  studentCount: number;
  dataCollectionMethod: 'Individual' | 'Classroom aggregation';
  unitType: 'Students' | 'Teachers';
  itpAvg: number | null;
  totalWatchTimeSeconds: number;
  sessionCompletedFlag: 0 | 1;
  teacherFeedbackText: string;
  dataSource: string;
  facilitatorName: string;
  language: string;
  partnerName: string;
}

export const DATA_SOURCE = 'Zuvy Platform';
export const PARTNER_NAME = 'Zuvy';

// The three tours, by the English names the client uses. Module names in
// other languages keep the Latin "AWS" / "Robotics" / "Amazon Music".
const PRODUCTS: { match: RegExp; name: string }[] = [
  {
    match: /\bAWS\b/i,
    name: 'AWS Data Center Tour: Uncovering Cloud Computing',
  },
  { match: /robotics/i, name: 'Robotics Fulfillment Center Tour' },
  { match: /amazon\s*music/i, name: 'Amazon Music: Careers Behind the Beats' },
];

export function productNameOf(moduleName: string | null): string {
  const name = (moduleName ?? '').replace(/\s+/g, ' ').trim();
  const product = PRODUCTS.find((p) => p.match.test(name));
  return product ? product.name : name.replace(/\s*\([^)]*\)\s*$/, '');
}

/** "AFE-Career-Tours(Telugu)" -> "Telugu". The language column is unreliable. */
export function languageOf(
  bootcampName: string | null,
  bootcampLanguage: string | null,
): string {
  const match = (bootcampName ?? '').match(/\(([^)]+)\)\s*$/);
  return (match?.[1] ?? bootcampLanguage ?? '').trim();
}

export interface ChapterRow {
  bootcampId: number;
  bootcampName: string | null;
  bootcampLanguage: string | null;
  moduleId: number;
  moduleName: string | null;
  chapterId: number;
  topicId: number | null;
  order: number | null;
  videoDurationSeconds: number | null;
  formQuestions: unknown;
}

export interface TourForm {
  chapterId: number;
  questions: FormQuestion[]; // in form order
}

export interface TourModule {
  moduleId: number;
  moduleName: string;
  bootcampId: number;
  language: string;
  productName: string;
  signup: TourForm | null;
  feedback: TourForm;
  videos: { chapterId: number; durationSeconds: number | null }[];
}

export interface AssembledTours {
  tours: Map<number, TourModule>;
  /** Modules that can't be reported (no feedback form), for the notes. */
  skipped: { moduleId: number; moduleName: string; reason: string }[];
}

export function formQuestionIds(formQuestions: unknown): number[] {
  if (!formQuestions || typeof formQuestions !== 'object') return [];
  return Object.values(formQuestions as Record<string, unknown>)
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);
}

/**
 * Builds the tours of the AFE courses from their chapters. The first form in
 * a module is the sign-up form and the last one the feedback form; a module
 * with fewer than two forms has no feedback form and is skipped.
 */
export function assembleTours(
  chapters: ChapterRow[],
  questions: FormQuestion[],
): AssembledTours {
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const byModule = new Map<number, ChapterRow[]>();
  for (const c of chapters) {
    const list = byModule.get(c.moduleId) ?? [];
    list.push(c);
    byModule.set(c.moduleId, list);
  }

  const tours = new Map<number, TourModule>();
  const skipped: AssembledTours['skipped'] = [];
  for (const [moduleId, list] of byModule) {
    list.sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.chapterId - b.chapterId,
    );
    const first = list[0];
    const moduleName = (first.moduleName ?? '').trim();
    const toForm = (c: ChapterRow): TourForm => ({
      chapterId: c.chapterId,
      questions: formQuestionIds(c.formQuestions)
        .map((id) => questionById.get(id))
        .filter((q): q is FormQuestion => q !== undefined),
    });
    const forms = list.filter((c) => c.topicId === TOPIC.FORM);
    if (forms.length < 2) {
      skipped.push({ moduleId, moduleName, reason: 'no feedback form' });
      continue;
    }
    tours.set(moduleId, {
      moduleId,
      moduleName,
      bootcampId: first.bootcampId,
      language: languageOf(first.bootcampName, first.bootcampLanguage),
      productName: productNameOf(first.moduleName),
      signup: toForm(forms[0]),
      feedback: toForm(forms[forms.length - 1]),
      videos: list
        .filter((c) => c.topicId === TOPIC.VIDEO)
        .map((c) => ({
          chapterId: c.chapterId,
          durationSeconds: c.videoDurationSeconds,
        })),
    });
  }
  return { tours, skipped };
}

export interface Finish {
  userId: number;
  moduleId: number;
  completedAt: Date;
}

export interface LearnerInfo {
  name: string | null;
  email: string | null;
  state: string | null;
  city: string | null;
  schoolName: string | null;
  udiseCode: string | null;
}

export interface ReportInputs {
  finishes: Finish[];
  learners: Map<number, LearnerInfo>;
  /** Latest answer per `${userId}:${questionId}`. */
  answers: Map<string, FormAnswer>;
  /** `${userId}:${chapterId}` for every video chapter the user completed. */
  watchedVideos: Set<string>;
  /** Login sessions per user, oldest first. */
  sessions: Map<number, { id: string; createdAt: Date }[]>;
}

export const answerKey = (userId: number, questionId: number) =>
  `${userId}:${questionId}`;
export const chapterKey = (userId: number, chapterId: number) =>
  `${userId}:${chapterId}`;

/** The login session the tour was finished in: the latest one started before. */
export function sessionAt(
  sessions: { id: string; createdAt: Date }[] | undefined,
  at: Date,
): string {
  let found = '';
  for (const s of sessions ?? []) {
    if (s.createdAt.getTime() <= at.getTime()) found = s.id;
    else break;
  }
  return found;
}

export function buildReportRows(
  tours: Map<number, TourModule>,
  inputs: ReportInputs,
): ReportRow[] {
  const rows: ReportRow[] = [];
  for (const finish of inputs.finishes) {
    const tour = tours.get(finish.moduleId);
    if (!tour) continue;
    const learner = inputs.learners.get(finish.userId);
    const answerOf = (questionId: number | undefined) =>
      questionId === undefined
        ? undefined
        : inputs.answers.get(answerKey(finish.userId, questionId));
    const questionOf = (form: TourForm | null, id: number | undefined) =>
      id === undefined ? undefined : form?.questions.find((q) => q.id === id);

    const signupIds = detectSignupQuestions(tour.signup?.questions ?? []);
    const feedbackIds = detectFeedbackQuestions(tour.feedback.questions);

    const role = roleAnswer(
      questionOf(tour.signup, signupIds.role),
      answerOf(signupIds.role),
    );
    const studentCount = studentCountOf(
      textAnswer(answerOf(signupIds.studentCount)),
    );
    const stars = starRatingAnswer(
      questionOf(tour.feedback, feedbackIds.rating),
      answerOf(feedbackIds.rating),
    );
    const recommend = recommendScoreOf(
      textAnswer(answerOf(feedbackIds.recommend)),
    );

    const watched = tour.videos.filter((v) =>
      inputs.watchedVideos.has(chapterKey(finish.userId, v.chapterId)),
    );
    const formEmail = textAnswer(answerOf(signupIds.email));

    rows.push({
      studentName:
        (learner?.name ?? '').trim() || textAnswer(answerOf(signupIds.name)),
      // The numeric Zuvy user id, the account's unique id.
      studentId: String(finish.userId),
      email:
        (learner?.email ?? '').trim() ||
        (looksLikeEmail(formEmail) ? formEmail : ''),
      state: learner?.state ?? '',
      city: learner?.city ?? '',
      schoolName: learner?.schoolName ?? '',
      schoolUdise: learner?.udiseCode ?? '',
      grade: gradeAnswer(
        questionOf(tour.signup, signupIds.grade),
        answerOf(signupIds.grade),
      ),
      schoolType: schoolTypeAnswer(
        questionOf(tour.signup, signupIds.schoolType),
        answerOf(signupIds.schoolType),
      ),
      courseContent: tour.productName,
      sessionId: sessionAt(
        inputs.sessions.get(finish.userId),
        finish.completedAt,
      ),
      completionDate: finish.completedAt,
      studentCount,
      dataCollectionMethod:
        studentCount > 1 ? 'Classroom aggregation' : 'Individual',
      // Students, except a teacher who watched alone.
      unitType:
        role === 'teacher' && studentCount === 1 ? 'Teachers' : 'Students',
      itpAvg: itpAverage(stars, recommend),
      totalWatchTimeSeconds: watched.reduce(
        (sum, v) => sum + (v.durationSeconds ?? 0),
        0,
      ),
      sessionCompletedFlag:
        tour.videos.length > 0 && watched.length === tour.videos.length ? 1 : 0,
      teacherFeedbackText:
        role === 'teacher'
          ? feedbackText(
              textAnswer(answerOf(feedbackIds.bestPart)),
              textAnswer(answerOf(feedbackIds.improvements)),
            )
          : '',
      dataSource: DATA_SOURCE,
      facilitatorName: '', // not asked in the forms
      language: tour.language,
      partnerName: PARTNER_NAME,
    });
  }
  rows.sort(
    (a, b) =>
      a.completionDate.getTime() - b.completionDate.getTime() ||
      a.studentName.localeCompare(b.studentName),
  );
  return rows;
}

/** Things the team should know about the data in this report. */
export function reportNotes(
  rows: ReportRow[],
  finishes: Finish[],
  tours: Map<number, TourModule>,
  skipped: AssembledTours['skipped'],
): string[] {
  const notes: string[] = [];
  const reported = new Set(finishes.map((f) => f.moduleId));
  for (const moduleId of reported) {
    const tour = tours.get(moduleId);
    const missing =
      tour?.videos.filter((v) => v.durationSeconds === null).length ?? 0;
    if (tour && missing > 0) {
      notes.push(
        `${missing} video(s) in "${tour.moduleName}" have no length set, so total_watch_time_seconds is too low for that tour. Set the video length in the course editor.`,
      );
    }
  }
  for (const s of skipped) {
    notes.push(
      `Not reported: "${s.moduleName}" (module ${s.moduleId}) has ${s.reason}.`,
    );
  }
  if (rows.length === 0) notes.push('No tours were finished in this period.');
  return notes;
}

// ---- dates (India Standard Time, UTC+5:30, no daylight saving) ----

/** Days since 1970-01-01 counted on the Indian calendar. */
export function istDayNumber(d: Date): number {
  return Math.floor((d.getTime() + IST_OFFSET_MS) / DAY_MS);
}

export function istHour(d: Date): number {
  return new Date(d.getTime() + IST_OFFSET_MS).getUTCHours();
}

/** A Date whose UTC fields read as the Indian wall-clock time (for Excel). */
export function istWallClock(d: Date): Date {
  return new Date(d.getTime() + IST_OFFSET_MS);
}

/** "20 Nov 2026, 9:05 AM" in IST. */
export function formatIst(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/** "2026-11-20" in IST, for file names. */
export function istDate(d: Date): string {
  return istWallClock(d).toISOString().slice(0, 10);
}

/** Midnight IST at the start of a "YYYY-MM-DD" day. */
export function istMidnight(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Invalid date ${day}`);
  const utcMidnight = Date.parse(`${day}T00:00:00.000Z`);
  // Date.parse rolls 2026-02-30 over to 2 March; reject such days.
  if (
    Number.isNaN(utcMidnight) ||
    new Date(utcMidnight).toISOString().slice(0, 10) !== day
  ) {
    throw new Error(`Invalid date ${day}`);
  }
  return new Date(utcMidnight - IST_OFFSET_MS);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}
