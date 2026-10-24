import { legacyContentIdentity } from '../list';

/** Held for LD: frozen callers can pass their original content id explicitly.
 * Keep that standalone state in the registered copy's independent namespace;
 * placed instances and every ordinary source retain their exact identity. */
export function legacyRuntimeStateInstance(slug: string, instance: string): string {
  const primary = legacyContentIdentity(slug);
  return primary !== undefined && instance === primary ? slug : instance;
}
