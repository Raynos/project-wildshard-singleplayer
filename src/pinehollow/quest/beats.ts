/**
 * `?quest=<beat>` — the dev / capture jumps into *The Warden's Hollow* (PINE-HOLLOW-REMASTER PH-C1): the shard's quest
 * flags are wiped, the flags of every beat BEFORE this one are raised, and you start where the beat starts (at night
 * for the stag and the King). `?quest=done` is the finished quest; `?quest=hamlet` is the lodge with nothing done.
 */
export type Beat = 'ranger' | 'pond' | 'ridge' | 'zip' | 'den' | 'stag' | 'king' | 'dawn' | 'done' | 'hamlet';

interface BeatDef {
  /** the flags this beat adds on top of the previous beat's */
  adds: string[];
  /** where you start: a named site the runtime resolves, or world x / z looking at `look` */
  at: 'ranger' | 'deck' | 'launch' | 'lodge' | 'xz';
  x: number; z: number;
  look: { x: number; z: number };
  night?: boolean;
  day?: boolean;
}

const ORDER: readonly Beat[] = ['ranger', 'pond', 'ridge', 'zip', 'den', 'stag', 'king', 'dawn', 'done'];

export const BEATS: Record<Beat, BeatDef> = {
  ranger: { adds: [], at: 'ranger', x: 0, z: 0, look: { x: 0, z: 0 }, day: true },
  pond: { adds: ['talked:ranger'], at: 'xz', x: -129, z: 60, look: { x: -138, z: 64 }, day: true },
  ridge: { adds: ['lever:dam-log-a', 'lever:dam-log-b', 'open:dam-sluice', 'taken:pond-glass', 'lit:pond'], at: 'deck', x: 0, z: 0, look: { x: 36, z: 214 }, day: true },
  zip: { adds: ['taken:ridge-flint', 'lit:ridge'], at: 'launch', x: 0, z: 0, look: { x: 4, z: 20 }, day: true },
  den: { adds: ['used:ph-zip'], at: 'xz', x: 182, z: 180, look: { x: 200, z: 200 }, day: true },
  stag: { adds: ['lit:den'], at: 'xz', x: 12, z: -8, look: { x: 30, z: -2 }, night: true },
  king: { adds: ['followed:stag'], at: 'xz', x: 154, z: 4, look: { x: 150, z: -30 }, night: true },
  dawn: { adds: ['dead:king'], at: 'xz', x: 6, z: -4, look: { x: -60, z: -14 }, night: true },
  done: { adds: ['seen:dawn', 'quest:warden-done'], at: 'ranger', x: 0, z: 0, look: { x: 0, z: 0 }, day: true },
  hamlet: { adds: [], at: 'lodge', x: 0, z: 0, look: { x: 0, z: 0 }, day: true },
};

export function isBeat(s: string): s is Beat { return s in BEATS; }

/** every flag raised before `beat` starts (the beats in order; `hamlet` raises none) */
export function beatFlags(beat: Beat): string[] {
  if (beat === 'hamlet') return [];
  const out: string[] = [];
  for (const b of ORDER) { out.push(...BEATS[b].adds); if (b === beat) break; }
  return out;
}
