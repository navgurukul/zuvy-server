// Pure shaping/aggregation for the admin quiz-submission APIs. All DB access
// lives in SubmissionService; these functions only turn fetched rows into
// response objects, so they can be unit tested without Postgres.
//
// Counting rules (shared by every quiz-submission API):
// - A quiz chapter is a module chapter with topicId 4 and at least one
//   question in `quizQuestions` (chapters with no questions can't be
//   submitted, so they are left out of every count).
// - A student has submitted a quiz chapter when they have at least one
//   zuvy_quiz_tracking row for it with a chosen option — the same rule the
//   student-facing chapter view uses to mark a quiz "Completed".
// - Only students enrolled in the bootcamp with a batch (optionally a given
//   batch) are counted, matching the other submission tabs.
// - If a question was answered more than once, the latest row (highest id)
//   wins. Marks are 1 per correct question, compared against the question's
//   current correct option.

export const QUIZ_TOPIC_ID = 4;
export const SUBMITTED = 'Submitted';
export const NOT_SUBMITTED = 'Not Submitted';

export interface QuizTrackingRow {
  id: number;
  userId: number;
  chapterId: number;
  mcqId: number | null;
  chosenOption: number | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface QuizVariantRow {
  id: number;
  quizId: number;
  question?: string | null;
  options?: Record<string, string> | null;
  correctOption: number | null;
  difficulty?: string | null;
}

export interface RosterRow {
  userId: number | bigint;
  name: string | null;
  email: string | null;
  batchId: number | null;
  batchName: string | null;
}

// `quizQuestions` is a jsonb map (or array) of zuvy_module_quiz ids.
export function getQuizQuestionIds(quizQuestions: unknown): number[] {
  if (!quizQuestions || typeof quizQuestions !== 'object') return [];
  return Array.from(
    new Set(
      Object.values(quizQuestions as Record<string, unknown>)
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );
}

export function isQuizChapter(chapter: {
  topicId?: number | null;
  quizQuestions?: unknown;
}): boolean {
  return (
    (chapter.topicId === undefined || chapter.topicId === QUIZ_TOPIC_ID) &&
    getQuizQuestionIds(chapter.quizQuestions).length > 0
  );
}

// One roster entry per user, in first-seen order (a user can have more than
// one enrollment row for the same bootcamp).
export function dedupeRoster<T extends RosterRow>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = String(r.userId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// userId -> chapterId -> mcqId -> latest answered row.
export function latestAnswersByUser(
  rows: QuizTrackingRow[],
): Map<number, Map<number, Map<number, QuizTrackingRow>>> {
  const byUser = new Map<number, Map<number, Map<number, QuizTrackingRow>>>();
  for (const row of rows) {
    if (row.chosenOption === null || row.chosenOption === undefined) continue;
    if (row.mcqId === null || row.mcqId === undefined) continue;
    const uid = Number(row.userId);
    const cid = Number(row.chapterId);
    if (!byUser.has(uid)) byUser.set(uid, new Map());
    const byChapter = byUser.get(uid);
    if (!byChapter.has(cid)) byChapter.set(cid, new Map());
    const byMcq = byChapter.get(cid);
    const current = byMcq.get(row.mcqId);
    if (!current || Number(row.id) > Number(current.id)) {
      byMcq.set(row.mcqId, row);
    }
  }
  return byUser;
}

function latestTimestamp(rows: QuizTrackingRow[]): string | null {
  let latest: string | null = null;
  for (const r of rows) {
    const ts = r.updatedAt || r.createdAt;
    if (ts && (!latest || new Date(ts) > new Date(latest))) latest = ts;
  }
  return latest;
}

function isAnswerCorrect(
  answer: QuizTrackingRow,
  variant: QuizVariantRow | undefined,
): boolean {
  if (variant && variant.correctOption !== null) {
    return Number(answer.chosenOption) === Number(variant.correctOption);
  }
  return answer.status === 'pass';
}

// Score of one student's answers for one chapter. Answers to variants whose
// question is no longer part of the chapter are ignored.
export function scoreChapterAnswers(
  answers: Map<number, QuizTrackingRow> | undefined,
  quizIds: number[],
  variantsById: Map<number, QuizVariantRow>,
) {
  const answerByQuizId = new Map<number, QuizTrackingRow>();
  const quizIdSet = new Set(quizIds);
  for (const answer of answers?.values() ?? []) {
    const variant = variantsById.get(Number(answer.mcqId));
    if (!variant || !quizIdSet.has(variant.quizId)) continue;
    const existing = answerByQuizId.get(variant.quizId);
    if (!existing || Number(answer.id) > Number(existing.id)) {
      answerByQuizId.set(variant.quizId, answer);
    }
  }

  let marksObtained = 0;
  answerByQuizId.forEach((answer, quizId) => {
    if (isAnswerCorrect(answer, variantsById.get(Number(answer.mcqId))))
      marksObtained++;
  });

  return {
    answerByQuizId,
    totalMarks: quizIds.length,
    marksObtained,
    attemptedQuestions: answerByQuizId.size,
  };
}

function percentage(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 10000) / 100 : 0;
}

/* ------------------------------------------------------------------ */
/* API 1: bootcamp → module quiz summary                               */
/* ------------------------------------------------------------------ */

export function buildQuizSummary(params: {
  bootcamp: { id: number; name: string };
  modules: Array<{
    id: number;
    name: string | null;
    order?: number | null;
    chapters: Array<{
      id: number;
      title: string | null;
      order?: number | null;
      quizQuestions: unknown;
    }>;
  }>;
  submittedByChapter: Map<number, number>;
  totalStudents: number;
}) {
  const { bootcamp, modules, submittedByChapter, totalStudents } = params;

  const totals = {
    totalQuizChapters: 0,
    submittedQuizChapters: 0,
    pendingQuizChapters: 0,
    totalSubmissions: 0,
    expectedSubmissions: 0,
  };

  const moduleRows = modules.map((m) => {
    const quizChapters = m.chapters
      .filter((c) => isQuizChapter(c))
      .map((c) => {
        const submittedStudents = Math.min(
          submittedByChapter.get(c.id) ?? 0,
          totalStudents,
        );
        return {
          chapterId: c.id,
          chapterTitle: c.title,
          order: c.order ?? null,
          totalQuestions: getQuizQuestionIds(c.quizQuestions).length,
          submittedStudents,
          pendingStudents: Math.max(totalStudents - submittedStudents, 0),
        };
      });

    const submittedQuizChapters = quizChapters.filter(
      (c) => c.submittedStudents > 0,
    ).length;
    const totalSubmissions = quizChapters.reduce(
      (sum, c) => sum + c.submittedStudents,
      0,
    );
    const expectedSubmissions = quizChapters.length * totalStudents;

    totals.totalQuizChapters += quizChapters.length;
    totals.submittedQuizChapters += submittedQuizChapters;
    totals.totalSubmissions += totalSubmissions;
    totals.expectedSubmissions += expectedSubmissions;

    return {
      moduleId: m.id,
      moduleName: m.name,
      order: m.order ?? null,
      totalQuizChapters: quizChapters.length,
      submittedQuizChapters,
      pendingQuizChapters: quizChapters.length - submittedQuizChapters,
      totalSubmissions,
      expectedSubmissions,
      pendingSubmissions: expectedSubmissions - totalSubmissions,
      submissionPercentage: percentage(totalSubmissions, expectedSubmissions),
      quizChapters,
    };
  });

  totals.pendingQuizChapters =
    totals.totalQuizChapters - totals.submittedQuizChapters;

  return {
    bootcampId: bootcamp.id,
    bootcampName: bootcamp.name,
    totalStudents,
    ...totals,
    pendingSubmissions: totals.expectedSubmissions - totals.totalSubmissions,
    submissionPercentage: percentage(
      totals.totalSubmissions,
      totals.expectedSubmissions,
    ),
    modules: moduleRows,
  };
}

/* ------------------------------------------------------------------ */
/* API 2: per-chapter student status                                   */
/* ------------------------------------------------------------------ */

export function buildQuizStudentStatusRows(params: {
  roster: RosterRow[];
  chapterId: number;
  quizIds: number[];
  answers: Map<number, Map<number, Map<number, QuizTrackingRow>>>;
  variantsById: Map<number, QuizVariantRow>;
  studentIdMap: Map<string, string>;
}) {
  const { roster, chapterId, quizIds, answers, variantsById, studentIdMap } =
    params;

  return dedupeRoster(roster).map((r) => {
    const uid = Number(r.userId);
    const chapterAnswers = answers.get(uid)?.get(chapterId);
    const submitted = !!chapterAnswers && chapterAnswers.size > 0;
    const score = scoreChapterAnswers(chapterAnswers, quizIds, variantsById);

    return {
      userId: uid,
      studentId: studentIdMap.get(String(r.userId)) ?? null,
      name: r.name,
      email: r.email,
      batchId: r.batchId ?? null,
      batchName: r.batchName ?? null,
      status: submitted ? SUBMITTED : NOT_SUBMITTED,
      submittedAt: submitted
        ? latestTimestamp(Array.from(chapterAnswers.values()))
        : null,
      totalMarks: score.totalMarks,
      marksObtained: submitted ? score.marksObtained : null,
      attemptedQuestions: submitted ? score.attemptedQuestions : 0,
    };
  });
}

export type QuizStudentStatusRow = ReturnType<
  typeof buildQuizStudentStatusRows
>[number];

export function filterSortPaginateStudents(
  rows: QuizStudentStatusRow[],
  opts: {
    searchStudent?: string;
    status?: string;
    orderBy?: string;
    orderDirection?: string;
    limit?: number;
    offset?: number;
  },
) {
  let result = rows;

  const search = opts.searchStudent?.trim().toLowerCase();
  if (search) {
    result = result.filter(
      (r) =>
        (r.name ?? '').toLowerCase().startsWith(search) ||
        (r.email ?? '').toLowerCase().startsWith(search) ||
        (r.studentId ?? '').toLowerCase().startsWith(search),
    );
  }

  const status = opts.status?.toLowerCase();
  if (status === 'submitted') {
    result = result.filter((r) => r.status === SUBMITTED);
  } else if (status === 'notsubmitted' || status === 'pending') {
    result = result.filter((r) => r.status === NOT_SUBMITTED);
  }

  const dir = opts.orderDirection?.toLowerCase() === 'desc' ? -1 : 1;
  const key = (r: QuizStudentStatusRow): string | number => {
    switch (opts.orderBy) {
      case 'submittedDate':
        return r.submittedAt ? new Date(r.submittedAt).getTime() : 0;
      case 'email':
        return (r.email ?? '').toLowerCase();
      case 'marks':
        return r.marksObtained ?? -1;
      case 'name':
        return (r.name ?? '').toLowerCase();
      default:
        return '';
    }
  };
  result = [...result].sort((a, b) => {
    if (!opts.orderBy) {
      // Default: submitted students first, then by name.
      if (a.status !== b.status) return a.status === SUBMITTED ? -1 : 1;
      return (a.name ?? '').localeCompare(b.name ?? '');
    }
    const va = key(a);
    const vb = key(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  const offsetNum =
    Number.isFinite(Number(opts.offset)) && Number(opts.offset) > 0
      ? Number(opts.offset)
      : 0;
  const limitNum =
    Number.isFinite(Number(opts.limit)) && Number(opts.limit) > 0
      ? Number(opts.limit)
      : undefined;

  return {
    filteredCount: result.length,
    rows: limitNum
      ? result.slice(offsetNum, offsetNum + limitNum)
      : result.slice(offsetNum),
    totalPages: limitNum ? Math.ceil(result.length / limitNum) : 1,
    currentPage: limitNum ? Math.floor(offsetNum / limitNum) + 1 : 1,
  };
}

/* ------------------------------------------------------------------ */
/* API 3: unified quiz report (one chapter, one or all students)       */
/* ------------------------------------------------------------------ */

export interface QuizOption {
  optionId: number;
  optionText: string;
}

// Options are stored as a jsonb map of option id -> text.
function toOptionList(options: unknown): QuizOption[] {
  if (!options || typeof options !== 'object') return [];
  return Object.entries(options as Record<string, unknown>)
    .map(([key, text]) => ({ optionId: Number(key), optionText: String(text) }))
    .filter((o) => Number.isFinite(o.optionId))
    .sort((a, b) => a.optionId - b.optionId);
}

function pickOptions(options: QuizOption[], ids: Array<number | null>) {
  const wanted = new Set(
    ids.filter((id) => id !== null && id !== undefined).map(Number),
  );
  return options.filter((o) => wanted.has(o.optionId));
}

// The submitted quiz of one student, or null when they haven't submitted.
export function buildStudentQuizReport(params: {
  chapter: { id: number; title: string | null; quizQuestions: unknown };
  answers: Map<number, QuizTrackingRow> | undefined;
  variantsById: Map<number, QuizVariantRow>;
}) {
  const { chapter, answers, variantsById } = params;
  if (!answers || answers.size === 0) return null;

  const quizIds = getQuizQuestionIds(chapter.quizQuestions);
  const score = scoreChapterAnswers(answers, quizIds, variantsById);

  const questions = quizIds.map((quizId) => {
    const answer = score.answerByQuizId.get(quizId);
    // Students get one variant per question; show the one they answered.
    // An unanswered question has no recorded variant.
    const variant = answer ? variantsById.get(Number(answer.mcqId)) : undefined;
    const options = toOptionList(variant?.options);
    const correct = answer ? isAnswerCorrect(answer, variant) : false;
    return {
      questionId: quizId,
      variantId: variant?.id ?? null,
      question: variant?.question ?? null,
      questionType: 'Multiple Choice',
      difficulty: variant?.difficulty ?? null,
      options,
      chosenOptions: answer ? pickOptions(options, [answer.chosenOption]) : [],
      correctOptions: variant
        ? pickOptions(options, [variant.correctOption])
        : [],
      status: answer ? (correct ? 'Correct' : 'Incorrect') : 'Not Attempted',
      marksObtained: correct ? 1 : 0,
      answeredAt: answer ? answer.updatedAt || answer.createdAt : null,
    };
  });

  return {
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    totalMarks: score.totalMarks,
    marksObtained: score.marksObtained,
    questions,
  };
}
