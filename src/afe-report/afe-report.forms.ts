/**
 * Reading the answers of the AFE Career Tours forms.
 *
 * Every tour (course module) starts with a sign-up form and ends with a
 * feedback form. Each language course has its own copy of both, and the copies
 * don't all ask the questions in the same order: the Gujarati, Kannada,
 * Marathi, Odia and Tamil sign-up forms ask "how many students" first. So
 * questions are recognised by their type and options, never by position.
 *
 * Question types (zuvy_question_type): 1 multiple choice, 2 checkboxes,
 * 3 long text, 4 date, 5 time. Options are stored as {"1": "text", ...} and
 * an answer stores the chosen option keys.
 */

export const QUESTION_TYPE = {
  MULTIPLE_CHOICE: 1,
  CHECKBOXES: 2,
  LONG_TEXT: 3,
} as const;

export interface FormQuestion {
  id: number;
  question: string | null;
  options: Record<string, string> | null;
  typeId: number | null;
}

export interface FormAnswer {
  chosenOptions: number[] | null;
  answer: string | null;
}

export interface SignupQuestionIds {
  role?: number;
  name?: number;
  email?: number;
  grade?: number;
  schoolType?: number;
  studentCount?: number;
}

export interface FeedbackQuestionIds {
  rating?: number;
  recommend?: number;
  bestPart?: number;
  improvements?: number;
}

export type Role = 'teacher' | 'student';

// "Teacher" and "Student" in the languages the courses use.
const TEACHER_WORDS = [
  'teacher',
  'ఉపాధ్యాయ', // Telugu
  'शिक्षक', // Hindi, Marathi
  'शिक्षिका',
  'શિક્ષક', // Gujarati
  'ಶಿಕ್ಷಕ', // Kannada
  'ଶିକ୍ଷକ', // Odia
  'ஆசிரிய', // Tamil
];
const STUDENT_WORDS = [
  'student',
  'విద్యార్థి', // Telugu
  'विद्यार्थी', // Hindi, Marathi
  'छात्र',
  'વિદ્યાર્થી', // Gujarati
  'ವಿದ್ಯಾರ್ಥಿ', // Kannada
  'ଛାତ୍ର', // Odia
  'மாணவ', // Tamil
];

// Grade options are the same seven in every language, in the same order.
const GRADE_BY_OPTION: Record<string, string> = {
  '1': '5',
  '2': '6',
  '3': '7',
  '4': '8',
  '5': '9',
  '6': '10',
  '7': '10+',
};

// School type options, same order in every language; reported in English.
const SCHOOL_TYPE_BY_OPTION: Record<string, string> = {
  '1': 'Government School',
  '2': 'Government Aided School',
  '3': 'Private School',
  '4': 'Central Government School (KV/JNV)',
  '5': 'EMRS / Tribal School',
  '6': 'KGBV',
  '7': 'Other',
};

// A typed number outside this range is treated as a typo (see studentCountOf).
export const MAX_STUDENT_COUNT = 500;

const STARS = /[⭐★]/gu; // ⭐ ★, for counting with match()
const HAS_STAR = /[⭐★]/u;

function optionEntries(q: FormQuestion): [string, string][] {
  if (!q.options || typeof q.options !== 'object') return [];
  return Object.entries(q.options).map(([k, v]) => [
    String(k),
    String(v ?? ''),
  ]);
}

function text(q: FormQuestion): string {
  return q.question ?? '';
}

export function roleOf(value: string | null | undefined): Role | null {
  const lower = (value ?? '').toLowerCase();
  if (TEACHER_WORDS.some((w) => lower.includes(w))) return 'teacher';
  if (STUDENT_WORDS.some((w) => lower.includes(w))) return 'student';
  return null;
}

/** Finds the sign-up form questions by what they ask, in any language. */
export function detectSignupQuestions(
  questions: FormQuestion[],
): SignupQuestionIds {
  const choice = questions.filter(
    (q) => q.typeId === QUESTION_TYPE.MULTIPLE_CHOICE,
  );
  const longText = questions.filter(
    (q) => q.typeId === QUESTION_TYPE.LONG_TEXT,
  );
  const checkboxes = questions.filter(
    (q) => q.typeId === QUESTION_TYPE.CHECKBOXES,
  );

  const schoolType = choice.find((q) =>
    optionEntries(q).some(([, v]) => /\bKGBV\b/i.test(v)),
  );
  const role = choice.find(
    (q) =>
      q !== schoolType && optionEntries(q).some(([, v]) => roleOf(v) !== null),
  );
  const grade =
    checkboxes.find((q) => optionEntries(q).length === 7) ?? checkboxes[0];
  const email = longText.find((q) => /e-?mail/i.test(text(q)));
  // "How many students are watching with you? (Type 1 if watching alone)":
  // mentions Career Tours in most languages, and the digit 1 in all of them.
  const studentCount = longText.find(
    (q) => q !== email && (/career/i.test(text(q)) || /\d/.test(text(q))),
  );
  const name = longText.find((q) => q !== email && q !== studentCount);

  return {
    role: role?.id,
    name: name?.id,
    email: email?.id,
    grade: grade?.id,
    schoolType: schoolType?.id,
    studentCount: studentCount?.id,
  };
}

/** Finds the feedback form questions by what they ask, in any language. */
export function detectFeedbackQuestions(
  questions: FormQuestion[],
): FeedbackQuestionIds {
  const rating = questions.find(
    (q) =>
      q.typeId === QUESTION_TYPE.MULTIPLE_CHOICE &&
      optionEntries(q).some(([, v]) => HAS_STAR.test(v)),
  );
  const longText = questions.filter(
    (q) => q.typeId === QUESTION_TYPE.LONG_TEXT,
  );
  // "How likely are you to recommend ... from 0 to 10"
  const recommend = longText.find((q) => /(^|\D)10(\D|$)/.test(text(q)));
  // The other two free-text questions, in form order: favourite part, then
  // suggestions.
  const [bestPart, improvements] = longText.filter((q) => q !== recommend);
  return {
    rating: rating?.id,
    recommend: recommend?.id,
    bestPart: bestPart?.id,
    improvements: improvements?.id,
  };
}

function chosenKeys(answer: FormAnswer | undefined): string[] {
  const keys = (answer?.chosenOptions ?? [])
    .map((k) => Number(k))
    .filter((k) => Number.isInteger(k));
  return [...new Set(keys)].sort((a, b) => a - b).map(String);
}

function chosenTexts(q: FormQuestion, answer: FormAnswer | undefined) {
  const options = Object.fromEntries(optionEntries(q));
  return chosenKeys(answer)
    .map((k) => options[k])
    .filter((v): v is string => v !== undefined)
    .map((v) => v.replace(/\s+/g, ' ').trim());
}

export function roleAnswer(
  q: FormQuestion | undefined,
  answer: FormAnswer | undefined,
): Role | null {
  if (!q) return null;
  const [first] = chosenTexts(q, answer);
  return roleOf(first);
}

/** "8", or "6, 7" when a teacher ticked several grades. */
export function gradeAnswer(
  q: FormQuestion | undefined,
  answer: FormAnswer | undefined,
): string {
  if (!q) return '';
  if (optionEntries(q).length === 7) {
    return chosenKeys(answer)
      .map((k) => GRADE_BY_OPTION[k])
      .filter(Boolean)
      .join(', ');
  }
  return chosenTexts(q, answer).join(', ');
}

/** School type in English, whatever the language of the form. */
export function schoolTypeAnswer(
  q: FormQuestion | undefined,
  answer: FormAnswer | undefined,
): string {
  if (!q) return '';
  const options = Object.fromEntries(optionEntries(q));
  const standard =
    optionEntries(q).length === 7 && /\bKGBV\b/i.test(options['6'] ?? '');
  const [key] = chosenKeys(answer);
  if (key === undefined) return '';
  if (standard && SCHOOL_TYPE_BY_OPTION[key]) return SCHOOL_TYPE_BY_OPTION[key];
  return (options[key] ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Number of students watching together, from the typed answer ("Type 1 if
 * watching alone"). The first whole number in the answer is used ("2
 * students" -> 2). No number, 0, or more than MAX_STUDENT_COUNT counts as
 * the student alone: 1. Rather undercount than report a typo as a classroom.
 */
export function studentCountOf(value: string | null | undefined): number {
  const match = (value ?? '').match(/\d+/);
  if (!match) return 1;
  const n = Number.parseInt(match[0], 10);
  return n >= 1 && n <= MAX_STUDENT_COUNT ? n : 1;
}

/** Star rating 1-5 from the chosen option, e.g. "⭐⭐⭐⭐ (Good)" -> 4. */
export function starRatingAnswer(
  q: FormQuestion | undefined,
  answer: FormAnswer | undefined,
): number | null {
  if (!q) return null;
  const [chosen] = chosenTexts(q, answer);
  if (chosen === undefined) return null;
  const stars = (chosen.match(STARS) ?? []).length;
  if (stars >= 1 && stars <= 5) return stars;
  const digit = chosen.match(/\b([1-5])\b/);
  return digit ? Number(digit[1]) : null;
}

/** 0-10 "how likely to recommend" score from the typed answer, or null. */
export function recommendScoreOf(
  value: string | null | undefined,
): number | null {
  const match = (value ?? '').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return n >= 0 && n <= 10 ? n : null;
}

/**
 * itp_avg: the star rating (1-5) and the recommend score converted to the
 * same 1-5 scale (0 -> 1, 10 -> 5), averaged and rounded to one decimal. If
 * only one was answered, that one is used.
 */
export function itpAverage(
  stars: number | null,
  recommend: number | null,
): number | null {
  const parts: number[] = [];
  if (stars !== null) parts.push(stars);
  if (recommend !== null) parts.push(1 + recommend * 0.4);
  if (parts.length === 0) return null;
  const mean = parts.reduce((a, b) => a + b, 0) / parts.length;
  return Math.round(mean * 10) / 10;
}

export function textAnswer(answer: FormAnswer | undefined): string {
  return (answer?.answer ?? '').replace(/\s+/g, ' ').trim();
}

/** Favourite part and suggestions in one cell. */
export function feedbackText(bestPart: string, improvements: string): string {
  return [
    bestPart && `Favourite part: ${bestPart}`,
    improvements && `Suggestions: ${improvements}`,
  ]
    .filter(Boolean)
    .join(' | ');
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
