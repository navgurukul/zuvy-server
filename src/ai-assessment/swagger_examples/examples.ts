export const submitAssessmentExample = {
  answers: [
    {
      id: 1,
      question:
        'What will be the output of the following code?\n\n```javascript\nconsole.log(typeof null);\n```',
      topic: 'JavaScript Basics',
      difficulty: 'Easy',
      options: {
        '1': '"object"',
        '2': '"null"',
        '3': '"undefined"',
        '4': '"number"',
      },
      correctOption: 1,
      selectedAnswerByStudent: 1,
      language: 'JavaScript',
    },
    {
      id: 2,
      question: 'What is the result of `2 + "2"` in JavaScript?',
      topic: 'Type Coercion',
      difficulty: 'Easy',
      options: {
        '1': '"4"',
        '2': '"22"',
        '3': 'NaN',
        '4': 'undefined',
      },
      correctOption: 2,
      selectedAnswerByStudent: 2,
      language: 'JavaScript',
    },
    {
      id: 3,
      question: 'Which keyword is used to declare a constant in JavaScript?',
      topic: 'Variables',
      difficulty: 'Easy',
      options: {
        '1': 'var',
        '2': 'let',
        '3': 'const',
        '4': 'static',
      },
      correctOption: 3,
      selectedAnswerByStudent: 3,
      language: 'JavaScript',
    },
  ],
};

export const createAiAssessment = {
  bootcampId: 803,
  title: 'Assessment Title',
  description: 'This is a description',
  difficulty: 'Medium',
  topics: {
    Trees: 4,
    'Linked Lists': 4,
  },
  audience: 'Any previous cohorts (based on bootcampId)',
  totalNumberOfQuestions: 8,
};

export const createAiAssessmentBootcamp = {
  bootcampId: 803,
  chapterId: 1201,
  moduleId: 44,
  title: 'JavaScript Fundamentals Assessment',
  objective: 'Evaluate JavaScript fundamentals for the selected chapter',
  description: 'Covers variables, functions, arrays, and control flow.',
  expectedOutcomes: 'Students can solve foundational JavaScript questions.',
  totalNumberOfQuestions: 10,
  chapterIds: [1201],
  poolTopics: [
    { id: 1, name: 'JavaScript Basics' },
    { id: 2, name: 'Arrays' },
  ],
};
