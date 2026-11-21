import { AFE_FORMS } from './__fixtures__/afe-forms.fixture';
import {
  FormQuestion,
  detectFeedbackQuestions,
  detectSignupQuestions,
  feedbackText,
  gradeAnswer,
  itpAverage,
  looksLikeEmail,
  recommendScoreOf,
  roleAnswer,
  roleOf,
  schoolTypeAnswer,
  starRatingAnswer,
  studentCountOf,
} from './afe-report.forms';

const LANGUAGES = Object.keys(AFE_FORMS);
const byId = (questions: FormQuestion[], id: number) =>
  questions.find((q) => q.id === id);
const keyOf = (q: FormQuestion, predicate: (text: string) => boolean) =>
  Number(Object.entries(q.options).find(([, v]) => predicate(v))[0]);

describe('AFE forms: question detection on the real production forms', () => {
  it('covers all eight course languages', () => {
    expect(LANGUAGES.sort()).toEqual(
      [
        'English',
        'Gujarati',
        'Hindi',
        'Kannada',
        'Marathi',
        'Odia',
        'Tamil',
        'Telugu',
      ].sort(),
    );
  });

  it.each(LANGUAGES)(
    '%s sign-up form: finds all six questions, each once',
    (lang) => {
      const { signup } = AFE_FORMS[lang];
      const ids = detectSignupQuestions(signup);
      const found = [
        ids.role,
        ids.name,
        ids.email,
        ids.grade,
        ids.schoolType,
        ids.studentCount,
      ];
      expect(found.every((id) => typeof id === 'number')).toBe(true);
      expect(new Set(found).size).toBe(6);
      // Spot-check by type: grade is the checkbox question, the rest by content.
      expect(byId(signup, ids.grade).typeId).toBe(2);
      expect(Object.values(byId(signup, ids.schoolType).options)).toContain(
        'KGBV',
      );
      expect(byId(signup, ids.email).question).toMatch(/e-?mail/i);
      expect(byId(signup, ids.studentCount).typeId).toBe(3);
      expect(byId(signup, ids.name).typeId).toBe(3);
    },
  );

  it('works whichever order the questions are in', () => {
    // English asks "teacher or student" first; Gujarati asks "how many students" first.
    const en = detectSignupQuestions(AFE_FORMS.English.signup);
    const gu = detectSignupQuestions(AFE_FORMS.Gujarati.signup);
    expect(AFE_FORMS.English.signup[0].id).toBe(en.role);
    expect(AFE_FORMS.English.signup[5].id).toBe(en.studentCount);
    expect(AFE_FORMS.Gujarati.signup[0].id).toBe(gu.studentCount);
    expect(AFE_FORMS.Gujarati.signup[1].id).toBe(gu.role);
  });

  it.each(LANGUAGES)(
    '%s feedback form: rating, recommend and both free-text questions',
    (lang) => {
      const { feedback } = AFE_FORMS[lang];
      const ids = detectFeedbackQuestions(feedback);
      // Q5 stars, Q6 recommend 0-10, Q3 favourite part, Q4 suggestions.
      expect(ids.rating).toBe(feedback[4].id);
      expect(ids.recommend).toBe(feedback[5].id);
      expect(ids.bestPart).toBe(feedback[2].id);
      expect(ids.improvements).toBe(feedback[3].id);
    },
  );
});

describe('AFE forms: reading answers', () => {
  it.each(LANGUAGES)(
    '%s: teacher and student options are told apart',
    (lang) => {
      const { signup } = AFE_FORMS[lang];
      const roleQ = byId(signup, detectSignupQuestions(signup).role);
      const roles = Object.values(roleQ.options).map(roleOf);
      expect(roles.sort()).toEqual(['student', 'teacher']);
    },
  );

  it('role follows the option text, not its position (option 1 is Teacher in English, Student in Hindi)', () => {
    const en = AFE_FORMS.English.signup;
    const hi = AFE_FORMS.Hindi.signup;
    const enRole = byId(en, detectSignupQuestions(en).role);
    const hiRole = byId(hi, detectSignupQuestions(hi).role);
    expect(roleAnswer(enRole, { chosenOptions: [1], answer: null })).toBe(
      'teacher',
    );
    expect(roleAnswer(hiRole, { chosenOptions: [1], answer: null })).toBe(
      'student',
    );
    expect(roleAnswer(enRole, { chosenOptions: [3], answer: null })).toBeNull(); // option no longer exists
    expect(roleAnswer(enRole, undefined)).toBeNull();
  });

  it.each(LANGUAGES)('%s: grade options map to 5..10+', (lang) => {
    const { signup } = AFE_FORMS[lang];
    const gradeQ = byId(signup, detectSignupQuestions(signup).grade);
    expect(gradeAnswer(gradeQ, { chosenOptions: [4], answer: null })).toBe('8');
    expect(gradeAnswer(gradeQ, { chosenOptions: [7], answer: null })).toBe(
      '10+',
    );
    expect(gradeAnswer(gradeQ, { chosenOptions: [3, 2], answer: null })).toBe(
      '6, 7',
    );
    expect(gradeAnswer(gradeQ, { chosenOptions: [], answer: null })).toBe('');
  });

  it.each(LANGUAGES)('%s: school type comes out in English', (lang) => {
    const { signup } = AFE_FORMS[lang];
    const q = byId(signup, detectSignupQuestions(signup).schoolType);
    expect(schoolTypeAnswer(q, { chosenOptions: [6], answer: null })).toBe(
      'KGBV',
    );
    expect(schoolTypeAnswer(q, { chosenOptions: [1], answer: null })).toBe(
      'Government School',
    );
    expect(schoolTypeAnswer(q, { chosenOptions: [4], answer: null })).toBe(
      'Central Government School (KV/JNV)',
    );
    expect(schoolTypeAnswer(q, { chosenOptions: [], answer: null })).toBe('');
  });

  it('school type falls back to the option text on a non-standard question', () => {
    const q: FormQuestion = {
      id: 1,
      typeId: 1,
      question: 'School',
      options: { '1': ' Govt  ', '2': 'KGBV' },
    };
    expect(schoolTypeAnswer(q, { chosenOptions: [1], answer: null })).toBe(
      'Govt',
    );
  });

  it('student count: first number, else 1; 0 and absurd numbers count as 1', () => {
    expect(studentCountOf('1')).toBe(1);
    expect(studentCountOf('45')).toBe(45);
    expect(studentCountOf('2 students')).toBe(2);
    expect(studentCountOf('1\n')).toBe(1);
    expect(studentCountOf('0')).toBe(1);
    expect(studentCountOf('Good')).toBe(1);
    expect(studentCountOf(null)).toBe(1);
    expect(studentCountOf('500')).toBe(500);
    expect(studentCountOf('1000000')).toBe(1);
  });

  it.each(LANGUAGES)(
    '%s: star rating counts the stars (option 1 is 5 stars)',
    (lang) => {
      const { feedback } = AFE_FORMS[lang];
      const q = byId(feedback, detectFeedbackQuestions(feedback).rating);
      const fiveStarKey = keyOf(q, (v) => (v.match(/⭐/gu) ?? []).length === 5);
      expect(
        starRatingAnswer(q, { chosenOptions: [fiveStarKey], answer: null }),
      ).toBe(5);
      expect(starRatingAnswer(q, { chosenOptions: [1], answer: null })).toBe(5);
      expect(starRatingAnswer(q, { chosenOptions: [2], answer: null })).toBe(4);
      expect(starRatingAnswer(q, { chosenOptions: [5], answer: null })).toBe(1);
      expect(
        starRatingAnswer(q, { chosenOptions: [], answer: null }),
      ).toBeNull();
    },
  );

  it('recommend score: 0-10 only', () => {
    expect(recommendScoreOf('8')).toBe(8);
    expect(recommendScoreOf('10/10')).toBe(10);
    expect(recommendScoreOf('0')).toBe(0);
    expect(recommendScoreOf('23')).toBeNull();
    expect(recommendScoreOf('1000000000')).toBeNull();
    expect(recommendScoreOf('N/A')).toBeNull();
    expect(recommendScoreOf(null)).toBeNull();
  });

  it('itp_avg averages stars with the recommend score on a 1-5 scale', () => {
    expect(itpAverage(4, 10)).toBe(4.5); // (4 + 5) / 2
    expect(itpAverage(5, 8)).toBe(4.6); // (5 + 4.2) / 2
    expect(itpAverage(3, 0)).toBe(2); // (3 + 1) / 2
    expect(itpAverage(4, null)).toBe(4);
    expect(itpAverage(null, 5)).toBe(3);
    expect(itpAverage(null, null)).toBeNull();
  });

  it('feedback text and email helpers', () => {
    expect(feedbackText('Robots', 'More videos')).toBe(
      'Favourite part: Robots | Suggestions: More videos',
    );
    expect(feedbackText('', 'More videos')).toBe('Suggestions: More videos');
    expect(feedbackText('', '')).toBe('');
    expect(looksLikeEmail('a@b.org')).toBe(true);
    expect(looksLikeEmail('not an email')).toBe(false);
  });
});
