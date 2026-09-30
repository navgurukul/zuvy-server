/**
 * Chapter locking inside a single module. Two independent rules decide it,
 * and a chapter is open only when neither of them locks it:
 *
 * 1. Manual lock: an admin locked this chapter (zuvy_module_chapter.is_lock).
 * 2. Ordered lock: the course has Chapter Lock on
 *    (zuvy_bootcamp_type.is_chapter_locked). The first chapter is open, every
 *    chapter up to the last completed one stays open, and the chapter right
 *    after the last completed one unlocks. Everything after that is locked.
 *
 * A chapter is complete (100%) once a zuvy_chapter_tracking row exists for it.
 * Neither rule depends on Module Lock.
 *
 * `chapters` must already be in display order (zuvy_module_chapter.order) and
 * contain only the chapters the student can see.
 */
export type ChapterLockReason =
  | 'LOCKED_BY_ADMIN'
  | 'PREVIOUS_CHAPTER_INCOMPLETE';

export const CHAPTER_LOCK_MESSAGES: Record<ChapterLockReason, string> = {
  LOCKED_BY_ADMIN:
    'This chapter has been locked by your course admin. Please check back later.',
  PREVIOUS_CHAPTER_INCOMPLETE:
    'Please complete the previous chapter before accessing this chapter.',
};

export interface ChapterLockState {
  isLock: boolean;
  lockReason: ChapterLockReason | null;
  lockMessage: string | null;
}

export function computeChapterLockStates(
  chapters: { id: number; isLock?: boolean | null }[],
  completedChapterIds: Set<number>,
  isChapterLockEnabled: boolean,
): Map<number, ChapterLockState> {
  let lastCompletedIndex = -1;
  if (isChapterLockEnabled) {
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (completedChapterIds.has(chapters[i].id)) {
        lastCompletedIndex = i;
        break;
      }
    }
  }

  const states = new Map<number, ChapterLockState>();
  chapters.forEach((chapter, index) => {
    let lockReason: ChapterLockReason | null = null;
    if (chapter.isLock) {
      lockReason = 'LOCKED_BY_ADMIN';
    } else if (isChapterLockEnabled && index > lastCompletedIndex + 1) {
      lockReason = 'PREVIOUS_CHAPTER_INCOMPLETE';
    }
    states.set(chapter.id, {
      isLock: lockReason !== null,
      lockReason,
      lockMessage: lockReason ? CHAPTER_LOCK_MESSAGES[lockReason] : null,
    });
  });
  return states;
}

export function computeChapterLocks(
  chapters: { id: number; isLock?: boolean | null }[],
  completedChapterIds: Set<number>,
  isChapterLockEnabled: boolean,
): Map<number, boolean> {
  const locks = new Map<number, boolean>();
  computeChapterLockStates(
    chapters,
    completedChapterIds,
    isChapterLockEnabled,
  ).forEach((state, id) => locks.set(id, state.isLock));
  return locks;
}
