import {
  CHAPTER_LOCK_MESSAGES,
  computeChapterLockStates,
  computeChapterLocks,
} from './chapterLock';

const chapters = [{ id: 11 }, { id: 12 }, { id: 13 }];
const locked = (locks: Map<number, boolean>) =>
  chapters.map((c) => locks.get(c.id));

describe('computeChapterLocks', () => {
  it('unlocks every chapter when chapter lock is off', () => {
    expect(locked(computeChapterLocks(chapters, new Set(), false))).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('unlocks only the first chapter when nothing is complete', () => {
    expect(locked(computeChapterLocks(chapters, new Set(), true))).toEqual([
      false,
      true,
      true,
    ]);
  });

  it('unlocks the next chapter once the previous one is complete', () => {
    expect(locked(computeChapterLocks(chapters, new Set([11]), true))).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('keeps everything open when the last chapter is complete', () => {
    expect(
      locked(computeChapterLocks(chapters, new Set([11, 12, 13]), true)),
    ).toEqual([false, false, false]);
  });

  it('keeps chapters completed while the lock was off accessible', () => {
    // Chapter 12 was completed out of order before the lock was turned on.
    expect(locked(computeChapterLocks(chapters, new Set([12]), true))).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('handles a module with one chapter', () => {
    const locks = computeChapterLocks([{ id: 1 }], new Set(), true);
    expect(locks.get(1)).toBe(false);
  });

  it('handles a module with no chapters', () => {
    expect(computeChapterLocks([], new Set(), true).size).toBe(0);
  });
  describe('manual lock', () => {
    const withManualLock = [{ id: 11 }, { id: 12, isLock: true }, { id: 13 }];
    const lockedManual = (locks: Map<number, boolean>) =>
      withManualLock.map((c) => locks.get(c.id));

    it('locks only the admin-locked chapter when chapter lock is off', () => {
      expect(
        lockedManual(computeChapterLocks(withManualLock, new Set(), false)),
      ).toEqual([false, true, false]);
    });

    it('keeps an admin-locked chapter locked even if the previous one is complete', () => {
      expect(
        lockedManual(computeChapterLocks(withManualLock, new Set([11]), true)),
      ).toEqual([false, true, true]);
    });

    it('keeps an admin-locked chapter locked even if it was completed', () => {
      expect(
        lockedManual(
          computeChapterLocks(withManualLock, new Set([11, 12]), true),
        ),
      ).toEqual([false, true, false]);
    });

    it('can lock the first chapter', () => {
      const locks = computeChapterLocks(
        [{ id: 1, isLock: true }],
        new Set(),
        true,
      );
      expect(locks.get(1)).toBe(true);
    });
  });

  describe('lock reasons', () => {
    it('explains a chapter locked by the ordered lock', () => {
      const states = computeChapterLockStates(chapters, new Set(), true);
      expect(states.get(11)).toEqual({
        isLock: false,
        lockReason: null,
        lockMessage: null,
      });
      expect(states.get(12)).toEqual({
        isLock: true,
        lockReason: 'PREVIOUS_CHAPTER_INCOMPLETE',
        lockMessage: CHAPTER_LOCK_MESSAGES.PREVIOUS_CHAPTER_INCOMPLETE,
      });
    });

    it('prefers the admin reason when both locks apply', () => {
      const states = computeChapterLockStates(
        [{ id: 11 }, { id: 12, isLock: true }],
        new Set(),
        true,
      );
      expect(states.get(12).lockReason).toBe('LOCKED_BY_ADMIN');
    });
  });
});
