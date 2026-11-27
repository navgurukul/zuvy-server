/**
 * Which variant of each quiz question a student sees in a quiz chapter.
 *
 * A chapter stores quiz ids (zuvy_module_chapter.quiz_questions); each quiz
 * can have several variants (zuvy_module_quiz_variants). The admin side shows
 * variant 1 as the question, so the student sees exactly one variant per quiz:
 *
 * - the variant the student answered, if they answered this question (older
 *   submissions may have been made on another variant), otherwise
 * - variant 1, falling back to the lowest variant number if 1 is missing.
 *
 * The result follows `quizIds` order. A quiz without any variants yields
 * `undefined` at its position so callers can decide how to handle it.
 */
export function pickQuizVariantPerQuestion<
  T extends { id: number; quizId: number | null; variantNumber: number },
>(
  quizIds: number[],
  variants: T[],
  answeredVariantIds: Iterable<number> = [],
): Array<T | undefined> {
  const answered = new Set(Array.from(answeredVariantIds, Number));
  const byQuizId = new Map<number, T[]>();
  for (const variant of variants) {
    const list = byQuizId.get(Number(variant.quizId)) ?? [];
    list.push(variant);
    byQuizId.set(Number(variant.quizId), list);
  }

  return quizIds.map((quizId) => {
    const list = byQuizId.get(Number(quizId)) ?? [];
    const answeredVariant = list.find((v) => answered.has(v.id));
    if (answeredVariant) return answeredVariant;
    return [...list].sort((a, b) => a.variantNumber - b.variantNumber)[0];
  });
}
