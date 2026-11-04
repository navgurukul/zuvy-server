export function shuffleMcqOptionOrder(
  options: Record<string, string>,
  correctOption: number,
): { options: Record<string, string>; correctOption: number } {
  const positions = ['1', '2', '3', '4'];
  if (positions.some((p) => typeof options[p] !== 'string')) {
    return { options, correctOption };
  }

  const shuffledSourcePositions = [...positions];
  for (let i = shuffledSourcePositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledSourcePositions[i], shuffledSourcePositions[j]] = [
      shuffledSourcePositions[j],
      shuffledSourcePositions[i],
    ];
  }

  const correctSourcePosition = String(correctOption);
  const newOptions: Record<string, string> = {};
  let newCorrectOption = correctOption;

  positions.forEach((newPosition, idx) => {
    const sourcePosition = shuffledSourcePositions[idx];
    newOptions[newPosition] = options[sourcePosition];
    if (sourcePosition === correctSourcePosition) {
      newCorrectOption = Number(newPosition);
    }
  });

  return { options: newOptions, correctOption: newCorrectOption };
}
