const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const empty = (value: unknown): boolean => object(value) && Object.keys(value).length === 0;
const exact = <K extends string>(value: unknown, keys: readonly K[]): value is Record<K, unknown> => object(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/** SaveStore.exportAll always emits the global document, even when no key was ever stored.
 * Admit only that exact empty envelope, not arbitrary empty scopes/reset metadata or saved entries.
 * A null save observation is legitimate only before the practice demo exists.
 */
export function nativeOwnerPersistenceEmpty(value: unknown, phase: 'preboot' | 'running'): boolean {
  if (!exact(value, ['local', 'session', 'saved']) || !empty(value.local) || !empty(value.session)) return false;
  const saved = value.saved;
  if (phase === 'preboot') return saved === null;
  if (!exact(saved, ['global'])) return false;
  const global = saved.global;
  return exact(global, ['keys']) && empty(global.keys);
}
