// src/audio/credits.ts — the model credits the licences ask the UI to show (docs/plans/MUSIC.md v3): MiniMax-Music3 for the
// score, and the selected sound-effect set's own `credit` string (public/assets/sfx/<set>/sfx.json). Three SFX models, three
// licences: MOSS-SoundEffect v2.0 (Apache-2.0) and EzAudio (MIT) just name themselves; Stable Audio 3 Medium (Stability AI
// Community licence) must also say "Powered by Stability AI" — only that set gets it. The sfx.json credits arrive with the
// boot preload (the loading bar reads every set's manifest); until then the line is built from the set's name.
//
//   sfxCredit(getSfxSet())   → 'Sound effects: MOSS-SoundEffect v2.0 (OpenMOSS, Apache-2.0)' ('' for the synth set, or a set not shipped)
//   onSfxCredit(fn)          → a set's sfx.json credit arrived (Audio.ts calls setSfxCredit)
import type { SfxSet } from '../ui/Settings';
import { shipped } from './Stems';

export const MUSIC_CREDIT = 'Music: MiniMax-Music3';
const STABILITY = 'Powered by Stability AI';
const NAMES: Record<Exclude<SfxSet, 'synth'>, string> = {
  moss: 'Sound effects: MOSS-SoundEffect v2.0 (OpenMOSS, Apache-2.0)',
  'sa3-medium': 'Sound effects: Stable Audio 3 Medium',
  ezaudio: 'Sound effects: EzAudio (OpenSound, MIT)',
};
/** the sets whose licence asks for the Stability line */
const STABILITY_SETS: ReadonlySet<SfxSet> = new Set<SfxSet>(['sa3-medium']);
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
