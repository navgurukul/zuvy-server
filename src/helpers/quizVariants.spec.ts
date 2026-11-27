import { pickQuizVariantPerQuestion } from './quizVariants';

// Mirrors chapter 8686 on the dev DB: quiz_questions [893, 898, 932];
// quiz 893 has two variants, the others one each.
const variants = [
  { id: 877, quizId: 893, variantNumber: 2 },
  { id: 876, quizId: 893, variantNumber: 1 },
  { id: 883, quizId: 898, variantNumber: 1 },
  { id: 965, quizId: 932, variantNumber: 1 },
];
const quizIds = [893, 898, 932];
const ids = (list: Array<{ id: number } | undefined>) => list.map((v) => v?.id);

describe('pickQuizVariantPerQuestion', () => {
  it('returns variant 1 of each question before submission, like the admin side', () => {
    expect(ids(pickQuizVariantPerQuestion(quizIds, variants))).toEqual([
      876, 883, 965,
    ]);
  });

  it('returns exactly one variant per question after submission, never extra variants', () => {
    const picked = pickQuizVariantPerQuestion(
      quizIds,
      variants,
      [876, 883, 965],
    );
    expect(ids(picked)).toEqual([876, 883, 965]);
  });

  it('keeps the variant a student actually answered (older submissions)', () => {
    const picked = pickQuizVariantPerQuestion(quizIds, variants, [877, 883]);
    // 932 was not answered, so it falls back to variant 1.
    expect(ids(picked)).toEqual([877, 883, 965]);
  });

  it('ignores answers to variants of other quizzes', () => {
    const picked = pickQuizVariantPerQuestion([898], variants, [877]);
    expect(ids(picked)).toEqual([883]);
  });

  it('falls back to the lowest variant number when variant 1 is missing', () => {
    const picked = pickQuizVariantPerQuestion(
      [1],
      [
        { id: 12, quizId: 1, variantNumber: 3 },
        { id: 11, quizId: 1, variantNumber: 2 },
      ],
    );
    expect(ids(picked)).toEqual([11]);
  });

  it('marks questions without variants as undefined and keeps the order', () => {
    expect(ids(pickQuizVariantPerQuestion([932, 999, 898], variants))).toEqual([
      965,
      undefined,
      883,
    ]);
  });
});
