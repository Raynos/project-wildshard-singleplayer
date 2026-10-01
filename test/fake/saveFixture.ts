/** Test-only raw fixture writer: invalid data must reach the store's validation boundary unchanged. */
export function saveFixture(scope: string, key: string, data: unknown): void {
  const name = `wildshard.save.v2.${scope}`;
  const raw: unknown = JSON.parse(localStorage.getItem(name) ?? '{"keys":{}}');
  const keys: Record<string, unknown> = typeof raw === 'object' && raw !== null && 'keys' in raw && typeof raw.keys === 'object' && raw.keys !== null ? { ...raw.keys } : {};
  keys[key] = { v: 1, data }; localStorage.setItem(name, JSON.stringify({ keys }));
}
export function readFixture(scope: string, key: string): unknown {
  const raw: unknown = JSON.parse(localStorage.getItem(`wildshard.save.v2.${scope}`) ?? '{"keys":{}}');
  if (typeof raw !== 'object' || raw === null || !('keys' in raw) || typeof raw.keys !== 'object' || raw.keys === null) return null;
  const entry: unknown = Reflect.get(raw.keys, key);
  return typeof entry === 'object' && entry !== null && 'data' in entry ? entry.data : null;
}
export function saveStorageFixture(scope: 'global' | 'device'): { getItem: (key: string) => string | null; setItem: (key: string, raw: string) => void; removeItem: (key: string) => void } {
  return {
    getItem: (key: string): string | null => { const data = readFixture(scope, key); return data === null ? null : JSON.stringify(data); },
    setItem: (key: string, raw: string): void => { let value: unknown; try { value = JSON.parse(raw); } catch { value = raw; } saveFixture(scope, key, value); },
    removeItem: (key: string): void => { saveFixture(scope, key, null); },
  };
}
