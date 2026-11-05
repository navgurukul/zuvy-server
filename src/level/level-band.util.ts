export type LevelBand = {
  grade?: string | null;
  scoreMin?: number | null;
  scoreMax?: number | null;
};

export function bandsWithFloors<T extends LevelBand>(
  levels: readonly T[],
): Array<{ band: T; floor: number }> {
  const ordered = [...levels].sort(
    (a, b) => (a.scoreMax ?? Infinity) - (b.scoreMax ?? Infinity),
  );

  let previousCeiling: number | null = null;
  return ordered.map((band) => {
    const floor =
      band.scoreMin ?? (previousCeiling === null ? 0 : previousCeiling + 1);
    previousCeiling = band.scoreMax ?? Infinity;
    return { band, floor };
  });
}

export function resolveLevelBand<T extends LevelBand>(
  levels: readonly T[],
  score: number,
): T | null {
  if (!levels.length) return null;

  const ladder = bandsWithFloors(levels);
  for (let i = ladder.length - 1; i >= 0; i--) {
    if (score >= ladder[i].floor) return ladder[i].band;
  }

  return ladder[0].band;
}
