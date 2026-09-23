// src/audio/credits.ts — the model credits the licences ask the UI to show (docs/plans/MUSIC.md v3): MiniMax-Music3 for the
// score, and the selected sound-effect set's own `credit` string (public/assets/sfx/<set>/sfx.json) — both SFX models are
// under the Stability AI Community licence, which asks for "Powered by Stability AI". Until a set's sfx.json has loaded
// (it loads after ENTER WORLD, never at boot) the line is built from the set's name, so the title screen can show it too.
//
//   sfxCredit(getSfxSet())   → 'Sound effects: Stable Audio 3 · Powered by Stability AI' ('' for the synth set, or a set not shipped)
//   onSfxCredit(fn)          → a set's sfx.json credit arrived (Audio.ts calls setSfxCredit)
import type { SfxSet } from '../ui/Settings';
import { shipped } from './Stems';

export const MUSIC_CREDIT = 'Music: MiniMax-Music3';
const STABILITY = 'Powered by Stability AI';
const NAMES: Record<Exclude<SfxSet, 'synth'>, string> = { sa3: 'Sound effects: Stable Audio 3', tangoflux: 'Sound effects: TangoFlux' };
const loaded = new Map<SfxSet, string>();
const listeners = new Set<() => void>();

export function sfxCredit(set: SfxSet): string {
  if (set === 'synth' || !shipped(`/assets/sfx/${set}/sfx.json`)) return ''; // a set this build does not ship plays no model's sounds
  const c = loaded.get(set) ?? NAMES[set];
  return c.includes('Stability AI') ? c : `${c} · ${STABILITY}`;
}
export function setSfxCredit(set: SfxSet, credit: string): void {
  if (credit.trim() === '' || loaded.get(set) === credit) return;
  loaded.set(set, credit.trim());
  listeners.forEach((fn) => fn());
}
export function onSfxCredit(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
