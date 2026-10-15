import type { Tag } from './maps';

export function hasTag<T extends Tag>(tags: ReadonlySet<T>, pattern: T | `${string}.*`): boolean {
  const values: ReadonlySet<string> = tags;
  if (!pattern.endsWith('.*')) return values.has(pattern);
  const prefix = pattern.slice(0, -1);
  for (const tag of values) if (tag.startsWith(prefix)) return true;
  return false;
}
