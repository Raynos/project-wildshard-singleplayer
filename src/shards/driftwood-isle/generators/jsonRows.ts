// GR7: the banks hand their rows to readers that admit plain JSON only, as the retired jobs' JSON files were.
/** A number as the job's JSON held it: no negative zero (placements and the client plan admit plain JSON only). */
export const n = (value: number): number => (value === 0 ? 0 : value);
export const numbers = (values: ArrayLike<number>): number[] => Array.from(values, n);
/** A value as the job's JSON held it: typed arrays as arrays, no negative zero, no undefined field. */
export function plainJson(value: unknown): unknown {
  if (typeof value === 'number') return n(value);
  if (value instanceof Float32Array || value instanceof Uint32Array) return numbers(value);
  if (Array.isArray(value)) return (value as readonly unknown[]).map(plainJson);
  if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, plainJson(item)]));
  return value;
}
