import {
  GLOBAL_CONSTANTS as DEFAULTS,
  GlobalConstants,
} from './global.constants.example';

// global.constants.ts is gitignored, so it won't exist on a fresh clone or a
// build server. A require inside try/catch is optional to webpack (a warning
// rather than a failed build when the file is missing), and the defaults
// apply at runtime.
function loadLocalConstants(): Partial<GlobalConstants> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./global.constants').GLOBAL_CONSTANTS ?? {};
  } catch {
    return {};
  }
}

export const FLAGS: GlobalConstants = { ...DEFAULTS, ...loadLocalConstants() };
