// Template and defaults for the on/off switches in global.constants.ts.
//
// global.constants.ts is gitignored so each environment can set its own
// values: copy this file to global.constants.ts and change what you need.
// When global.constants.ts doesn't exist, these defaults are used (see
// flags.ts), so a fresh clone or a build server still builds and runs.
export const GLOBAL_CONSTANTS = {
  // Mentor sessions: when Zoom's attendance report shows the mentor didn't
  // join, or nobody joined, give the student's credit back and lift their
  // booking cooldown. Attendance and COMPLETED/MISSED are recorded either way.
  MENTOR_NO_SHOW_CREDIT_RULES: true,
};

export type GlobalConstants = typeof GLOBAL_CONSTANTS;
