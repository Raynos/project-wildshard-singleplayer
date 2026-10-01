import type { Tag } from './maps';

export function hasTag(tags: ReadonlySet<Tag>, pattern: Tag | `${string}.*`): boolean {
  if (!pattern.endsWith('.*')) return tags.has(pattern as Tag);
  const prefix = pattern.slice(0, -1);
  const values: ReadonlySet<string> = tags;
  for (const tag of values) if (tag.startsWith(prefix)) return true;
  return false;
}
