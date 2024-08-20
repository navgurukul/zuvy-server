export const helperVariable= {
    admin: 'admin',
    instructor:'instructor',
    success: 'success',
    error: 'error',
    ongoing: 'ongoing',
    upcoming: 'upcoming',
    completed: 'completed',
    currentISOTime: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, -1) + '+05:30'
  };