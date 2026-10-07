import today from './whatsNew.json' with { type: 'json' };
/**
 * The day's WHAT'S NEW lines on the main menu (SHARD-PLATFORM SF60, Jake's pick G214: B, a slim banner under the logo;
 * `art/menu/round-12-whats-new/B-banner*.jpg`). The coordinator rewrites `whatsNew.json` beside this file with each daily
 * playtest pin: 3–5 short lines of what changed and what to try, newest first. An empty `entries` list hides the banner.
 * The lines are data (they name shards, which game code never does, E405), typed here.
 *
 *   { "date": "7 OCT 2026", "entries": ["… ride the Rising Islet up from the road (Developer)", …] }
 *
 * The banner (src/game/whatsNewBanner.ts) shows only with Settings ▸ Developer on, and HIDE UNTIL NEXT BUILD keeps it
 * folded away until the running build changes.
 */
export interface WhatsNew {
  /** the day the lines were written, as the banner's build line shows it ("7 OCT 2026"); optional */
  readonly date?: string;
  /** the lines, plain text, one change each */
  readonly entries: readonly string[];
}

export const WHATS_NEW: WhatsNew = today;
