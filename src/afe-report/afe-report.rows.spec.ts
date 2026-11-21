import { AFE_FORMS } from './__fixtures__/afe-forms.fixture';
import { FormAnswer, FormQuestion } from './afe-report.forms';
import {
  ChapterRow,
  LearnerInfo,
  ReportInputs,
  TOPIC,
  answerKey,
  assembleTours,
  buildReportRows,
  chapterKey,
  istDate,
  istDayNumber,
  istHour,
  istMidnight,
  istWallClock,
  languageOf,
  productNameOf,
  reportNotes,
  sessionAt,
} from './afe-report.rows';

// A Hindi Robotics tour: sign-up form, three videos (one without a length),
// a quiz, the feedback form and the certificate chapter.
const SIGNUP = AFE_FORMS.Hindi.signup;
const FEEDBACK = AFE_FORMS.Hindi.feedback;
const chapter = (over: Partial<ChapterRow>): ChapterRow => ({
  bootcampId: 131,
  bootcampName: 'AFE-Career-Tours(Hindi)',
  bootcampLanguage: 'English', // wrong in production; the name is used instead
  moduleId: 323,
  moduleName: 'Robotics Fulfillment Center Tour (Hindi)',
  chapterId: 0,
  topicId: TOPIC.VIDEO,
  order: 0,
  videoDurationSeconds: null,
  formQuestions: null,
  ...over,
});
const CHAPTERS: ChapterRow[] = [
  chapter({
    chapterId: 10,
    order: 1,
    topicId: TOPIC.FORM,
    formQuestions: SIGNUP.map((q) => q.id),
  }),
  chapter({ chapterId: 11, order: 2, videoDurationSeconds: 244 }),
  chapter({ chapterId: 12, order: 3, videoDurationSeconds: 160 }),
  chapter({ chapterId: 13, order: 4, topicId: 4 }),
  chapter({ chapterId: 14, order: 5, videoDurationSeconds: null }),
  chapter({
    chapterId: 15,
    order: 6,
    topicId: TOPIC.FORM,
    formQuestions: FEEDBACK.map((q) => q.id),
  }),
  chapter({ chapterId: 16, order: 7, topicId: 10 }),
  // A module with a single form can't be finished: skipped.
  chapter({
    moduleId: 999,
    moduleName: 'Draft tour',
    chapterId: 90,
    order: 1,
    topicId: TOPIC.FORM,
    formQuestions: [SIGNUP[0].id],
  }),
];
const QUESTIONS: FormQuestion[] = [...SIGNUP, ...FEEDBACK];

// Hindi sign-up: Q1 role (1 = student, 2 = teacher), Q2 name, Q3 email,
// Q4 grade, Q5 school type, Q6 student count.
// Hindi feedback: Q5 stars (1 = 5 stars), Q6 recommend, Q3/Q4 free text.
function answersFor(
  userId: number,
  a: {
    role: number;
    name?: string;
    email?: string;
    grades: number[];
    school: number;
    count: string;
    stars?: number;
    recommend?: string;
    best?: string;
    improve?: string;
  },
) {
  const map = new Map<string, FormAnswer>();
  const set = (q: FormQuestion, v: FormAnswer) =>
    map.set(answerKey(userId, q.id), v);
  set(SIGNUP[0], { chosenOptions: [a.role], answer: null });
  set(SIGNUP[1], { chosenOptions: [], answer: a.name ?? null });
  set(SIGNUP[2], { chosenOptions: [], answer: a.email ?? null });
  set(SIGNUP[3], { chosenOptions: a.grades, answer: null });
  set(SIGNUP[4], { chosenOptions: [a.school], answer: null });
  set(SIGNUP[5], { chosenOptions: [], answer: a.count });
  if (a.stars) set(FEEDBACK[4], { chosenOptions: [a.stars], answer: null });
  set(FEEDBACK[5], { chosenOptions: [], answer: a.recommend ?? null });
  set(FEEDBACK[2], { chosenOptions: [], answer: a.best ?? null });
  set(FEEDBACK[3], { chosenOptions: [], answer: a.improve ?? null });
  return map;
}

const learner = (over: Partial<LearnerInfo>): LearnerInfo => ({
  name: null,
  email: null,
  state: null,
  city: null,
  schoolName: null,
  udiseCode: null,
  ...over,
});

describe('assembleTours', () => {
  const { tours, skipped } = assembleTours(CHAPTERS, QUESTIONS);

  it('uses the first form as sign-up and the last as feedback', () => {
    const tour = tours.get(323);
    expect(tour.signup.chapterId).toBe(10);
    expect(tour.feedback.chapterId).toBe(15);
    expect(tour.signup.questions.map((q) => q.id)).toEqual(
      SIGNUP.map((q) => q.id),
    );
    expect(tour.videos.map((v) => v.chapterId)).toEqual([11, 12, 14]);
  });

  it('takes the language from the course name and the English tour name', () => {
    expect(tours.get(323).language).toBe('Hindi');
    expect(tours.get(323).productName).toBe('Robotics Fulfillment Center Tour');
  });

  it('skips modules without a feedback form', () => {
    expect(tours.has(999)).toBe(false);
    expect(skipped).toEqual([
      { moduleId: 999, moduleName: 'Draft tour', reason: 'no feedback form' },
    ]);
  });

  it('reads form_questions stored as an array or as an object', () => {
    const asObject = CHAPTERS.map((c) =>
      c.chapterId === 10
        ? {
            ...c,
            formQuestions: Object.fromEntries(
              SIGNUP.map((q, i) => [String(i), q.id]),
            ),
          }
        : c,
    );
    expect(
      assembleTours(asObject, QUESTIONS).tours.get(323).signup.questions,
    ).toHaveLength(6);
  });
});

describe('buildReportRows', () => {
  const { tours } = assembleTours(CHAPTERS, QUESTIONS);
  const finishedAt = new Date('2026-11-18T14:43:14.000Z'); // 18 Nov, 8:13:14 PM IST

  function inputs(over: Partial<ReportInputs>): ReportInputs {
    return {
      finishes: [],
      learners: new Map(),
      answers: new Map(),
      watchedVideos: new Set(),
      sessions: new Map(),
      ...over,
    };
  }

  it('fills a Student ID learner who watched in a class of 4', () => {
    const [row] = buildReportRows(
      tours,
      inputs({
        finishes: [{ userId: 7, moduleId: 323, completedAt: finishedAt }],
        learners: new Map([
          [
            7,
            learner({
              name: 'Chaganti Chandrika',
              state: 'TELANGANA',
              city: 'HYDERABAD',
              schoolName: 'ZPHS KONDAPUR',
              udiseCode: '36060100101',
            }),
          ],
        ]),
        answers: answersFor(7, {
          role: 1,
          grades: [4],
          school: 6,
          count: '4',
          stars: 2,
          recommend: '10',
        }),
        watchedVideos: new Set([
          chapterKey(7, 11),
          chapterKey(7, 12),
          chapterKey(7, 14),
        ]),
        sessions: new Map([
          [
            7,
            [
              {
                id: 'CT_IN_20261117_36060100101_0000003',
                createdAt: new Date('2026-11-17T05:00:00Z'),
              },
              {
                id: 'CT_IN_20261118_36060100101_0000001',
                createdAt: new Date('2026-11-18T14:00:00Z'),
              },
              {
                id: 'CT_IN_20261119_36060100101_0000002',
                createdAt: new Date('2026-11-19T05:00:00Z'),
              },
            ],
          ],
        ]),
      }),
    );
    expect(row).toEqual({
      studentName: 'Chaganti Chandrika',
      studentId: '7', // the numeric user id
      email: '',
      state: 'TELANGANA',
      city: 'HYDERABAD',
      schoolName: 'ZPHS KONDAPUR',
      schoolUdise: '36060100101',
      grade: '8',
      schoolType: 'KGBV',
      courseContent: 'Robotics Fulfillment Center Tour',
      sessionId: 'CT_IN_20261118_36060100101_0000001', // the login before the finish
      completionDate: finishedAt,
      studentCount: 4,
      dataCollectionMethod: 'Classroom aggregation',
      unitType: 'Students',
      itpAvg: 4.5, // 4 stars and 10/10 -> (4 + 5) / 2
      totalWatchTimeSeconds: 404, // 244 + 160 + (no length set)
      sessionCompletedFlag: 1,
      teacherFeedbackText: '',
      dataSource: 'Zuvy Platform',
      facilitatorName: '',
      language: 'Hindi',
      partnerName: 'Zuvy',
    });
  });

  it('fills a Google learner: user id as Student ID, no school, partial watching', () => {
    const [row] = buildReportRows(
      tours,
      inputs({
        finishes: [{ userId: 73302, moduleId: 323, completedAt: finishedAt }],
        learners: new Map([
          [73302, learner({ name: 'Asha', email: 'asha@gmail.com' })],
        ]),
        answers: answersFor(73302, {
          role: 1,
          grades: [6],
          school: 1,
          count: '1',
          stars: 1,
        }),
        watchedVideos: new Set([chapterKey(73302, 11)]),
      }),
    );
    expect(row.studentId).toBe('73302');
    expect(row.email).toBe('asha@gmail.com');
    expect([row.state, row.city, row.schoolName, row.schoolUdise]).toEqual([
      '',
      '',
      '',
      '',
    ]);
    expect(row.dataCollectionMethod).toBe('Individual');
    expect(row.itpAvg).toBe(5);
    expect(row.totalWatchTimeSeconds).toBe(244);
    expect(row.sessionCompletedFlag).toBe(0);
    expect(row.sessionId).toBe('');
  });

  it('teacher watching alone: unit_type Teachers and their feedback text', () => {
    const [row] = buildReportRows(
      tours,
      inputs({
        finishes: [{ userId: 5, moduleId: 323, completedAt: finishedAt }],
        learners: new Map([[5, learner({ name: '' })]]),
        answers: answersFor(5, {
          role: 2,
          name: 'Meena Teacher',
          email: 'meena@school.in',
          grades: [2, 3],
          school: 2,
          count: '1',
          best: 'The  robots',
          improve: 'Longer videos',
        }),
      }),
    );
    expect(row.studentName).toBe('Meena Teacher'); // from the form when the account has no name
    expect(row.email).toBe('meena@school.in'); // from the form when the account has none
    expect(row.unitType).toBe('Teachers');
    expect(row.grade).toBe('6, 7');
    expect(row.schoolType).toBe('Government Aided School');
    expect(row.teacherFeedbackText).toBe(
      'Favourite part: The robots | Suggestions: Longer videos',
    );
    expect(row.itpAvg).toBeNull();
  });

  it('teacher with a class: unit_type stays Students', () => {
    const [row] = buildReportRows(
      tours,
      inputs({
        finishes: [{ userId: 5, moduleId: 323, completedAt: finishedAt }],
        answers: answersFor(5, {
          role: 2,
          grades: [4],
          school: 1,
          count: '35 students',
        }),
      }),
    );
    expect(row.unitType).toBe('Students');
    expect(row.studentCount).toBe(35);
  });

  it('a student never gets teacher_feedback_text, and a bad typed email is dropped', () => {
    const [row] = buildReportRows(
      tours,
      inputs({
        finishes: [{ userId: 9, moduleId: 323, completedAt: finishedAt }],
        answers: answersFor(9, {
          role: 1,
          email: 'no email',
          grades: [4],
          school: 1,
          count: '1',
          best: 'Fun',
        }),
      }),
    );
    expect(row.teacherFeedbackText).toBe('');
    expect(row.email).toBe('');
  });

  it('missing answers give empty cells, not errors', () => {
    const [row] = buildReportRows(
      tours,
      inputs({
        finishes: [{ userId: 3, moduleId: 323, completedAt: finishedAt }],
      }),
    );
    expect(row.grade).toBe('');
    expect(row.schoolType).toBe('');
    expect(row.studentCount).toBe(1);
    expect(row.unitType).toBe('Students');
    expect(row.itpAvg).toBeNull();
    expect(row.studentId).toBe('3');
  });

  it('ignores finishes of unknown modules and sorts by completion time', () => {
    const rows = buildReportRows(
      tours,
      inputs({
        finishes: [
          {
            userId: 2,
            moduleId: 323,
            completedAt: new Date('2026-11-19T00:00:00Z'),
          },
          {
            userId: 1,
            moduleId: 323,
            completedAt: new Date('2026-11-18T00:00:00Z'),
          },
          {
            userId: 4,
            moduleId: 12345,
            completedAt: new Date('2026-11-18T00:00:00Z'),
          },
        ],
      }),
    );
    expect(rows.map((r) => r.studentId)).toEqual(['1', '2']);
  });
});

describe('notes', () => {
  const { tours, skipped } = assembleTours(CHAPTERS, QUESTIONS);
  it('flags videos without a length in reported tours, and skipped modules', () => {
    const finishes = [{ userId: 1, moduleId: 323, completedAt: new Date() }];
    const notes = reportNotes([{} as any], finishes, tours, skipped);
    expect(notes[0]).toMatch(
      /1 video\(s\) in "Robotics Fulfillment Center Tour \(Hindi\)" have no length/,
    );
    expect(notes[1]).toMatch(/Draft tour/);
  });
  it('says when nothing was finished', () => {
    expect(reportNotes([], [], tours, [])).toEqual([
      'No tours were finished in this period.',
    ]);
  });
});

describe('names and sessions', () => {
  it('maps module names in any language to the three tours', () => {
    expect(productNameOf('AWS डेटा सेंटर टूर: Cloud Computing की खोज')).toBe(
      'AWS Data Center Tour: Uncovering Cloud Computing',
    );
    expect(productNameOf('Robotics ఫుల్‌ఫిల్మెంట్  సెంటర్ టూర్ (Telugu)')).toBe(
      'Robotics Fulfillment Center Tour',
    );
    expect(productNameOf('Amazon Music: Beats ପଛର Careers (Odia)')).toBe(
      'Amazon Music: Careers Behind the Beats',
    );
    expect(productNameOf('Some New Tour (Bengali)')).toBe('Some New Tour');
  });

  it('language from the course name', () => {
    expect(languageOf('AFE-Career-Tours(Telugu)', 'English')).toBe('Telugu');
    expect(languageOf('AFE-Career-Tours', 'Hindi')).toBe('Hindi');
    expect(languageOf('AFE-Career-Tours', null)).toBe('');
  });

  it('session: latest login started at or before the finish', () => {
    const s = [
      { id: 'a', createdAt: new Date('2026-11-01T00:00:00Z') },
      { id: 'b', createdAt: new Date('2026-11-02T00:00:00Z') },
    ];
    expect(sessionAt(s, new Date('2026-11-02T00:00:00Z'))).toBe('b');
    expect(sessionAt(s, new Date('2026-11-01T12:00:00Z'))).toBe('a');
    expect(sessionAt(s, new Date('2026-10-31T00:00:00Z'))).toBe('');
    expect(sessionAt(undefined, new Date())).toBe('');
  });
});

describe('India time helpers', () => {
  it('day number and hour follow IST', () => {
    const lateEvening = new Date('2026-11-19T18:29:59Z'); // 23:59:59 IST, 19 Nov
    const midnight = new Date('2026-11-19T18:30:00Z'); // 00:00 IST, 20 Nov
    expect(istDayNumber(midnight) - istDayNumber(lateEvening)).toBe(1);
    expect(istHour(new Date('2026-11-20T03:30:00Z'))).toBe(9);
    expect(istDate(midnight)).toBe('2026-11-20');
  });

  it('istMidnight and wall clock', () => {
    expect(istMidnight('2026-11-20').toISOString()).toBe(
      '2026-11-19T18:30:00.000Z',
    );
    expect(() => istMidnight('2026-02-30')).toThrow();
    expect(() => istMidnight('20-11-2026')).toThrow();
    expect(istWallClock(new Date('2026-11-18T14:43:14Z')).toISOString()).toBe(
      '2026-11-18T20:13:14.000Z',
    );
  });
});
