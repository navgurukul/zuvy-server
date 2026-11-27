import {
  NOT_SUBMITTED,
  SUBMITTED,
  QuizTrackingRow,
  QuizVariantRow,
  buildQuizStudentStatusRows,
  buildQuizSummary,
  buildStudentQuizReport,
  filterSortPaginateStudents,
  getQuizQuestionIds,
  latestAnswersByUser,
} from './quiz-submission.helpers';

// Chapter 10 has quiz questions 1 and 2. Each question has two variants;
// correctOption is the key of the right answer in `options`.
const variants: QuizVariantRow[] = [
  {
    id: 101,
    quizId: 1,
    question: 'Q1 v1',
    options: { '1': 'A', '2': 'B' },
    correctOption: 1,
  },
  {
    id: 102,
    quizId: 1,
    question: 'Q1 v2',
    options: { '1': 'C', '2': 'D' },
    correctOption: 2,
  },
  {
    id: 201,
    quizId: 2,
    question: 'Q2 v1',
    options: { '1': 'E', '2': 'F' },
    correctOption: 2,
  },
  {
    id: 202,
    quizId: 2,
    question: 'Q2 v2',
    options: { '1': 'G', '2': 'H' },
    correctOption: 1,
  },
];
const variantsById = new Map(variants.map((v) => [v.id, v]));

let nextId = 1;
function answer(
  userId: number,
  mcqId: number,
  chosenOption: number | null,
  updatedAt = '2026-10-07T11:07:00+00:00',
  chapterId = 10,
): QuizTrackingRow {
  return {
    id: nextId++,
    userId,
    chapterId,
    mcqId,
    chosenOption,
    status: null,
    createdAt: updatedAt,
    updatedAt,
  };
}

const roster = [
  {
    userId: BigInt(1),
    name: 'Prashant',
    email: 'p@x.com',
    batchId: 5,
    batchName: 'Batch 1',
  },
  {
    userId: BigInt(2),
    name: 'Nikita',
    email: 'n@x.com',
    batchId: 5,
    batchName: 'Batch 1',
  },
  {
    userId: BigInt(3),
    name: 'Aman',
    email: 'a@x.com',
    batchId: 6,
    batchName: 'Batch 2',
  },
];

describe('getQuizQuestionIds', () => {
  it('reads ids from a jsonb map or array and ignores junk', () => {
    expect(getQuizQuestionIds({ a: 3, b: '4', c: null, d: 'x' })).toEqual([
      3, 4,
    ]);
    expect(getQuizQuestionIds([5, 5, 6])).toEqual([5, 6]);
    expect(getQuizQuestionIds(null)).toEqual([]);
    expect(getQuizQuestionIds({})).toEqual([]);
  });
});

describe('latestAnswersByUser', () => {
  it('keeps the latest row per question and skips unanswered rows', () => {
    const first = answer(1, 101, 2);
    const retry = answer(1, 101, 1);
    const blank = answer(1, 201, null);
    // Input order must not matter: the higher id wins.
    const map = latestAnswersByUser([retry, first, blank]);
    const chapter = map.get(1).get(10);
    expect(chapter.size).toBe(1);
    expect(chapter.get(101).chosenOption).toBe(1);
  });
});

describe('buildQuizSummary', () => {
  const modules = [
    {
      id: 1,
      name: 'Module 1',
      chapters: [
        { id: 10, title: 'Quiz A', quizQuestions: { a: 1, b: 2 } },
        { id: 11, title: 'Quiz B', quizQuestions: { a: 1 } },
        // No questions: can't be submitted, so it isn't counted.
        { id: 12, title: 'Empty quiz', quizQuestions: null },
      ],
    },
    {
      id: 2,
      name: 'Module 2',
      chapters: [{ id: 20, title: 'Quiz C', quizQuestions: [2] }],
    },
    { id: 3, name: 'Module without quizzes', chapters: [] },
  ];

  it('counts quiz chapters and student submissions per module and overall', () => {
    const summary = buildQuizSummary({
      bootcamp: { id: 101, name: 'AEE Career Tours' },
      modules,
      submittedByChapter: new Map([
        [10, 3],
        [20, 1],
      ]),
      totalStudents: 3,
    });

    expect(summary).toMatchObject({
      bootcampId: 101,
      bootcampName: 'AEE Career Tours',
      totalStudents: 3,
      totalQuizChapters: 3,
      submittedQuizChapters: 2,
      pendingQuizChapters: 1,
      totalSubmissions: 4,
      expectedSubmissions: 9,
      pendingSubmissions: 5,
      submissionPercentage: 44.44,
    });

    const [m1, m2, m3] = summary.modules;
    expect(m1).toMatchObject({
      totalQuizChapters: 2,
      submittedQuizChapters: 1,
      pendingQuizChapters: 1,
      totalSubmissions: 3,
      expectedSubmissions: 6,
      pendingSubmissions: 3,
    });
    expect(m1.quizChapters.map((c) => c.chapterId)).toEqual([10, 11]);
    expect(m1.quizChapters[0]).toMatchObject({
      totalQuestions: 2,
      submittedStudents: 3,
      pendingStudents: 0,
    });
    expect(m2).toMatchObject({
      totalQuizChapters: 1,
      submittedQuizChapters: 1,
    });
    expect(m3).toMatchObject({
      totalQuizChapters: 0,
      submittedQuizChapters: 0,
      pendingQuizChapters: 0,
      submissionPercentage: 0,
    });
  });

  it('returns zeros for a bootcamp with no students and no submissions', () => {
    const summary = buildQuizSummary({
      bootcamp: { id: 1, name: 'Empty' },
      modules,
      submittedByChapter: new Map(),
      totalStudents: 0,
    });
    expect(summary).toMatchObject({
      totalQuizChapters: 3,
      submittedQuizChapters: 0,
      pendingQuizChapters: 3,
      totalSubmissions: 0,
      expectedSubmissions: 0,
      submissionPercentage: 0,
    });
  });
});

describe('buildQuizStudentStatusRows', () => {
  const studentIdMap = new Map([['1', 'STU001']]);

  it('lists submitted and not submitted students with marks', () => {
    const answers = latestAnswersByUser([
      answer(1, 101, 1, '2026-10-07T10:00:00+00:00'), // correct
      answer(1, 202, 2, '2026-10-07T11:07:00+00:00'), // wrong
      answer(2, 102, 2), // correct, Q2 unanswered
    ]);

    const rows = buildQuizStudentStatusRows({
      roster,
      chapterId: 10,
      quizIds: [1, 2],
      answers,
      variantsById,
      studentIdMap,
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      userId: 1,
      studentId: 'STU001',
      status: SUBMITTED,
      submittedAt: '2026-10-07T11:07:00+00:00',
      totalMarks: 2,
      marksObtained: 1,
      attemptedQuestions: 2,
      batchName: 'Batch 1',
    });
    expect(rows[1]).toMatchObject({
      userId: 2,
      status: SUBMITTED,
      marksObtained: 1,
      attemptedQuestions: 1,
    });
    expect(rows[2]).toMatchObject({
      userId: 3,
      studentId: null,
      status: NOT_SUBMITTED,
      submittedAt: null,
      marksObtained: null,
      attemptedQuestions: 0,
    });
  });

  it('does not duplicate students with more than one enrollment row', () => {
    const rows = buildQuizStudentStatusRows({
      roster: [...roster, { ...roster[0], batchId: 6, batchName: 'Batch 2' }],
      chapterId: 10,
      quizIds: [1, 2],
      answers: new Map(),
      variantsById,
      studentIdMap,
    });
    expect(rows.map((r) => r.userId)).toEqual([1, 2, 3]);
    expect(rows.every((r) => r.status === NOT_SUBMITTED)).toBe(true);
  });

  it('ignores answers given for another chapter', () => {
    const answers = latestAnswersByUser([answer(1, 101, 1, undefined, 99)]);
    const rows = buildQuizStudentStatusRows({
      roster,
      chapterId: 10,
      quizIds: [1, 2],
      answers,
      variantsById,
      studentIdMap,
    });
    expect(rows[0].status).toBe(NOT_SUBMITTED);
  });

  it('uses the latest attempt when a question was answered twice', () => {
    const answers = latestAnswersByUser([
      answer(1, 101, 2), // wrong
      answer(1, 101, 1), // correct, later
    ]);
    const [row] = buildQuizStudentStatusRows({
      roster: [roster[0]],
      chapterId: 10,
      quizIds: [1, 2],
      answers,
      variantsById,
      studentIdMap,
    });
    expect(row.marksObtained).toBe(1);
  });
});

describe('filterSortPaginateStudents', () => {
  const rows = buildQuizStudentStatusRows({
    roster,
    chapterId: 10,
    quizIds: [1, 2],
    answers: latestAnswersByUser([answer(2, 101, 1), answer(2, 201, 2)]),
    variantsById,
    studentIdMap: new Map([['3', 'ZX9']]),
  });

  it('puts submitted students first by default', () => {
    const page = filterSortPaginateStudents(rows, {});
    expect(page.rows.map((r) => r.name)).toEqual([
      'Nikita',
      'Aman',
      'Prashant',
    ]);
  });

  it('filters by status', () => {
    expect(
      filterSortPaginateStudents(rows, { status: 'submitted' }).rows.map(
        (r) => r.userId,
      ),
    ).toEqual([2]);
    const pending = filterSortPaginateStudents(rows, {
      status: 'notSubmitted',
    });
    expect(pending.filteredCount).toBe(2);
  });

  it('searches by name, email or Student ID', () => {
    expect(
      filterSortPaginateStudents(rows, { searchStudent: 'pra' }).rows[0].userId,
    ).toBe(1);
    expect(
      filterSortPaginateStudents(rows, { searchStudent: 'n@' }).rows[0].userId,
    ).toBe(2);
    expect(
      filterSortPaginateStudents(rows, { searchStudent: 'zx' }).rows[0].userId,
    ).toBe(3);
  });

  it('sorts and paginates', () => {
    const page = filterSortPaginateStudents(rows, {
      orderBy: 'name',
      orderDirection: 'desc',
      limit: 2,
      offset: 2,
    });
    expect(page.rows.map((r) => r.name)).toEqual(['Aman']);
    expect(page).toMatchObject({
      filteredCount: 3,
      totalPages: 2,
      currentPage: 2,
    });
  });
});

describe('buildStudentQuizReport', () => {
  const chapter = {
    id: 10,
    title: 'Quiz Chapter 1',
    quizQuestions: { a: 1, b: 2 },
  };

  it('returns every question with all options, chosen and correct options', () => {
    const answers = latestAnswersByUser([answer(1, 102, 2), answer(1, 201, 1)]);
    const report = buildStudentQuizReport({
      chapter,
      answers: answers.get(1).get(10),
      variantsById,
    });

    expect(report).toMatchObject({
      chapterId: 10,
      chapterTitle: 'Quiz Chapter 1',
      totalMarks: 2,
      marksObtained: 1,
    });
    expect(report.questions).toEqual([
      expect.objectContaining({
        questionId: 1,
        variantId: 102,
        question: 'Q1 v2',
        questionType: 'Multiple Choice',
        options: [
          { optionId: 1, optionText: 'C' },
          { optionId: 2, optionText: 'D' },
        ],
        chosenOptions: [{ optionId: 2, optionText: 'D' }],
        correctOptions: [{ optionId: 2, optionText: 'D' }],
        status: 'Correct',
        marksObtained: 1,
      }),
      expect.objectContaining({
        questionId: 2,
        variantId: 201,
        chosenOptions: [{ optionId: 1, optionText: 'E' }],
        correctOptions: [{ optionId: 2, optionText: 'F' }],
        status: 'Incorrect',
        marksObtained: 0,
      }),
    ]);
  });

  it('marks unanswered questions as Not Attempted', () => {
    const answers = latestAnswersByUser([answer(1, 101, 1)]);
    const report = buildStudentQuizReport({
      chapter,
      answers: answers.get(1).get(10),
      variantsById,
    });
    expect(report.questions[1]).toMatchObject({
      questionId: 2,
      variantId: null,
      options: [],
      chosenOptions: [],
      correctOptions: [],
      status: 'Not Attempted',
      marksObtained: 0,
    });
    expect(report.marksObtained).toBe(1);
  });

  it('returns null for a student who has not submitted', () => {
    expect(
      buildStudentQuizReport({ chapter, answers: undefined, variantsById }),
    ).toBeNull();
    expect(
      buildStudentQuizReport({ chapter, answers: new Map(), variantsById }),
    ).toBeNull();
  });

  it('does not score answers whose variant no longer exists', () => {
    const row = { ...answer(1, 101, 1), status: 'pass' };
    const report = buildStudentQuizReport({
      chapter: { ...chapter, quizQuestions: { a: 1 } },
      answers: new Map([[101, row]]),
      variantsById: new Map(),
    });
    // The answer can't be tied to a current question, so it isn't scored.
    expect(report.marksObtained).toBe(0);
    expect(report.questions[0].status).toBe('Not Attempted');
  });
});
