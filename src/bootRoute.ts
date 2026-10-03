/**
 * Where a page load goes (the composition root's first decision, src/entry.ts): the renderer-free title, or a level.
 * Pure, so it is tested as a function (test/entry-rescue.test.ts) rather than by mocking the entry's imports (E422).
 *
 * Safari may reload the same document after WebContent dies: when the previous page ended abruptly while booting the
 * level this URL asks for again, the load is rescued to the title until the player chooses a level again. A bare URL
 * (or one with only `?v=`) is the title too.
 */
export interface BootRoute { readonly rescue: boolean; readonly titleOnly: boolean }
export function bootRoute(search: URLSearchParams, previous: { readonly line: string; readonly level: string }): BootRoute {
  const rescue = previous.line !== '' && search.get('chunk') === previous.level;
  return { rescue, titleOnly: rescue || search.size === 0 || (search.size === 1 && search.has('v')) };
}
