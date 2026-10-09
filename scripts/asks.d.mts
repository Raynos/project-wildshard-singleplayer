// Types for scripts/asks.mjs (imported by test/asks.test.ts).

export const STATES: string[];
export interface Ask {
  title: string | null;
  status: string;
  state: string | null;
  closed: boolean;
  date: string | null;
  target: string | null;
  ask: string;
}
export function parseAsk(text: string): Ask;
export function checkAsk(id: string, text: string, exists?: (path: string) => boolean): string[];
