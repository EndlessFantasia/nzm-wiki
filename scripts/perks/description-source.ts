/** Row names can retain another skill's ID; use the explicit identity fields. */
export function createMgeDescriptionLookup<T extends { MGEId?: number; TextID?: number }>(
  rows: Record<string, T>,
) {
  const index = new Map<string, { rowKey: string; row: T }[]>();
  for (const [rowKey, row] of Object.entries(rows)) {
    if (row.MGEId === undefined || row.TextID === undefined) continue;
    const identity = `${row.MGEId}_${row.TextID}`;
    index.set(identity, [...(index.get(identity) ?? []), { rowKey, row }]);
  }
  return (identity: string) => {
    const matches = index.get(identity) ?? [];
    if (matches.length > 1) {
      throw new Error(`Ambiguous MGE description identity ${identity}: ${matches.map(match => match.rowKey).join(", ")}`);
    }
    return matches[0];
  };
}
