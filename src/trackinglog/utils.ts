export function diffRecords(
  oldRecord: Record<string, any>,
  newRecord: Record<string, any>,
): string[] {
  if (!oldRecord || !newRecord) return [];
  const skipKeys = new Set(['id', 'file']);
  const changes: string[] = [];
  for (const key of Object.keys(oldRecord)) {
    if (skipKeys.has(key) || key.endsWith('At')) continue;
    const oldVal = oldRecord[key];
    const newVal = newRecord[key];
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase());
    if (Array.isArray(oldVal) || Array.isArray(newVal)) {
      changes.push(
        `${label}: ${(oldVal as any[])?.length ?? 0} item(s) → ${(newVal as any[])?.length ?? 0} item(s)`,
      );
    } else {
      changes.push(`${label}: "${oldVal ?? 'empty'}" → "${newVal ?? 'empty'}"`);
    }
  }
  return changes;
}
