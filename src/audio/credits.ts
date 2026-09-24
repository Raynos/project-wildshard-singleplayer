// src/audio/credits.ts — the model credits the licences ask the UI to show (project/archive/2026-09-23-music.md v3): MiniMax-Music3 for the
// score, and the sound-effect set's own `credit` string (public/assets/sfx/best/sfx.json). The one generated set is the better
// take per sound of MOSS-SoundEffect v2 (Apache-2.0) and Stable Audio 3 Medium (Stability AI Community licence, which asks
// for "Powered by Stability AI"), so its credit names both (AGENTS.md "Audio engines"). The sfx.json credit arrives with
// the boot preload (the loading bar reads the manifest); until then the line is built from the set's name.
//
//   sfxCredit(getSfxSet())   → 'Sound effects: MOSS-SoundEffect v2 · Stable Audio 3 Medium — Powered by Stability AI' ('' for synth, or a set not shipped)
//   onSfxCredit(fn)          → a set's sfx.json credit arrived (Audio.ts calls setSfxCredit)
import type { SfxSet } from '../ui/Settings';
import { shipped } from './Stems';

export const MUSIC_CREDIT = 'Music: MiniMax-Music3';
const STABILITY = 'Powered by Stability AI';
const NAMES: Record<Exclude<SfxSet, 'synth'>, string> = {
  best: 'Sound effects: MOSS-SoundEffect v2 · Stable Audio 3 Medium — Powered by Stability AI',
};
/** the sets whose licence asks for the Stability line (the merged set carries Stable Audio 3 Medium sounds) */
const STABILITY_SETS: ReadonlySet<SfxSet> = new Set<SfxSet>(['best']);
const loaded = new Map<SfxSet, string>();
const listeners = new Set<() => void>();

export function sfxCredit(set: SfxSet): string {
  if (set === 'synth' || !shipped(`/assets/sfx/${set}/sfx.json`)) return ''; // a set this build does not ship plays no model's sounds
  const c = loaded.get(set) ?? NAMES[set];
  return !STABILITY_SETS.has(set) || c.includes('Stability AI') ? c : `${c} · ${STABILITY}`;
}
export function setSfxCredit(set: SfxSet, credit: string): void {
  if (credit.trim() === '' || loaded.get(set) === credit) return;
  loaded.set(set, credit.trim());
  listeners.forEach((fn) => fn());
}
export function onSfxCredit(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
