export function computePercentile(currentValue: number, allValues: number[]): number | null {
  if (allValues.length === 0) return null;
  const below = allValues.filter((v) => v < currentValue).length;
  return Math.round((below / allValues.length) * 100);
}
