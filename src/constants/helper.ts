export const helperVariable= {
    admin: 'admin',
    instructor:'instructor',
    success: 'success',
    error: 'error',
    ongoing: 'ongoing',
    upcoming: 'upcoming',
    completed: 'completed',
    currentISOTime: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, -1) + '+05:30',
    ACCEPTED: 'Accepted',
    SUBMIT: 'submit',
    RUN: 'run',
    MCQ_POINTS: { "Easy": 4, "Medium": 8, "Hard": 12 },
    CODING_POINTS: { "Easy": 10, "Medium": 15, "Hard": 20 },
    OPEN_ENDED_POINTS: { "Easy": 3, "Medium": 6, "Hard": 9 },
    WAIT_API_RESPONSE: 1590,
  };