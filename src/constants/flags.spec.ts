describe('FLAGS (global constants loader)', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('./global.constants');
  });

  it('uses the values from global.constants.ts when the file exists', () => {
    jest.doMock('./global.constants', () => ({
      GLOBAL_CONSTANTS: { MENTOR_NO_SHOW_CREDIT_RULES: false },
    }));
    jest.isolateModules(() => {
      const { FLAGS } = require('./flags');
      expect(FLAGS.MENTOR_NO_SHOW_CREDIT_RULES).toBe(false);
    });
  });

  it('falls back to the defaults when global.constants.ts is missing (fresh clone, build server)', () => {
    jest.doMock('./global.constants', () => {
      throw new Error("Cannot find module './global.constants'");
    });
    jest.isolateModules(() => {
      const { FLAGS } = require('./flags');
      expect(FLAGS.MENTOR_NO_SHOW_CREDIT_RULES).toBe(true);
    });
  });
});
