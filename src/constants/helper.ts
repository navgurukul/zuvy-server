export const helperVariable = {
  schemaName: 'stage_template',
  admin: 'admin',
  instructor: 'instructor',
  success: 'success',
  error: 'error',
  ongoing: 'ongoing',
  upcoming: 'upcoming',
  completed: 'completed',
  currentISOTime:
    new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, -1) + '+05:30',
  ACCEPTED: 'Accepted',
  SUBMIT: 'submit',
  RUN: 'run',
  MCQ_POINTS: { Easy: 4, Medium: 8, Hard: 12 },
  CODING_POINTS: { Easy: 10, Medium: 15, Hard: 20 },
  OPEN_ENDED_POINTS: { Easy: 3, Medium: 6, Hard: 9 },
  WAIT_API_RESPONSE: 2990,
  TOTAL_SCORE: 100,
  DIFFICULTY: {
    EASY: 'Easy',
    MEDIUM: 'Medium',
    HARD: 'Hard',
  },
  PROGRAM_DETAILS: {
    NAME: 'Amazon Future Engineer Bootcamp 2024',
    APPLICATION_LINK: 'www.zuvy.org/apply',
    ORGANIZATION_NAME: 'Zuvy Team',
  },
  CONTACT_DETAILS: {
    WHATSAPP_NUMBER: '+918949619081',
    EMAIL: 'join-zuvy@navgurukul.org',
  },
  QUESTIONNAIRE: {
    DEADLINE: 'within the next 2 days',
    DURATION: 'approximately 10 to 15 minutes',
  },
  REQUIRED_DOCUMENTS: [
    'Aadhaar Card',
    'College ID',
    'B.Tech Entrance Exam Rank Certificate',
    'Income Certificate',
  ],
  REATTMEPT_STATUS: {
    NOT_ATTEMPTED: 'Not Attempted',
    ATTEMPTED: 'Attempted',
    REATTEMPTED: 'Reattempted',
    REJECTED: 'Rejected',
    ACCEPTED: 'Accepted',
    PENDING: 'Pending',
    SUBMITTED: 'Submitted',
  },
};
