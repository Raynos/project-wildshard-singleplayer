/** Snapshot-only normalization: native libm may differ in the last float bits across macOS/Linux.
 * Round nested numeric values to 1e-6; integer ticks, hashes, strings and event order stay exact.
 * Keep live legacy/platform comparisons raw so this does not hide a graduation mismatch. */
export function weaponTraceJson(value: unknown): string {
  const json = JSON.stringify(value, (_key, field: unknown): unknown => {
    if (typeof field !== 'number' || !Number.isFinite(field) || Number.isInteger(field)) return field;
    return Math.round(field * 1_000_000) / 1_000_000;
  });
  return json;
}

/** Normalize persisted trace values as well as the frame bytes fed into their hashes. */
export function weaponTraceSnapshot(value: unknown): unknown {
  const snapshot: unknown = JSON.parse(weaponTraceJson(value));
  return snapshot;
}
