import { SIGNAL_QUEST_PAGE } from './questPage';

/** Compile page policy for the existing shared saved-quest owner. */
export function questPageFiles(): ReadonlyMap<string, Uint8Array> {
  const bytes = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value)}\n`);
  return new Map([
    ['data/questPage.generated.json', bytes(SIGNAL_QUEST_PAGE)],
  ]);
}
