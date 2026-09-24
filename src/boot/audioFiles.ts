/**
 * Every audio file the game can play, for the loading bar (project/archive/2026-09-23-preload-offline.md, the user's pick: "the shard being
 * launched + ALL audio"). The lists come from the manifests the build compiled in (src/boot/audio.generated.ts, written by
 * vite.config.ts from public/assets/music/<style>/music.json and public/assets/sfx/<set>/sfx.json), crossed with the styles
 * and sets the Settings menu offers (MUSIC_STYLES / SFX_SETS) — neither list is spelled out here, so a set renamed or added
 * in Settings + its sfx.json needs no edit in this file. The selected style / set comes first: it is the one decoded before
 * "playable", so its bytes should land first.
 */
import { MUSIC_MANIFESTS, SFX_MANIFESTS } from './audio.generated';
import { PUBLIC_BYTES } from './bytes.generated';
import { MUSIC_STYLES, SFX_SETS, getMusicStyle, getSfxSet } from '../ui/Settings';

const AUDIO_RE = /\.(m4a|mp3|ogg|opus|wav|webm|flac)$/;
const TABLE: Readonly<Record<string, number>> = PUBLIC_BYTES;

/** every audio file name a manifest mentions, wherever it sits (slots, stings, beds, hums, one-shot variants) */
export function manifestFiles(m: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') { if (AUDIO_RE.test(v) && !v.includes('..') && !v.includes('/')) out.push(v); }
    else if (Array.isArray(v)) for (const x of v) walk(x);
    else if (typeof v === 'object' && v !== null) for (const x of Object.values(v)) walk(x);
  };
  walk(m);
  return [...new Set(out)];
}

/** the selected one first, then the rest in the menu's order; only those the build has a manifest for */
function ordered<T extends string>(all: readonly T[], selected: T, manifests: Readonly<Record<string, unknown>>): T[] {
  const have = all.filter((v) => Object.hasOwn(manifests, v));
  return [...have.filter((v) => v === selected), ...have.filter((v) => v !== selected)];
}
export const musicStyles = (): string[] => ordered(MUSIC_STYLES, getMusicStyle(), MUSIC_MANIFESTS);
export const sfxSets = (): string[] => ordered(SFX_SETS, getSfxSet(), SFX_MANIFESTS);

const filesOf = (dir: string, manifest: unknown): string[] => manifestFiles(manifest).map((f) => `${dir}${f}`).filter((p) => p in TABLE); // a file the build does not ship is never asked for

export const musicDir = (style: string): string => `/assets/music/${style}/`;
export const sfxDir = (set: string): string => `/assets/sfx/${set}/`;

/** the loading bar's `music` and `sfx` byte sources: every file of every style / set, the selected one first */
export function audioFiles(): { music: string[]; sfx: string[] } {
  return {
    music: musicStyles().flatMap((s) => filesOf(musicDir(s), MUSIC_MANIFESTS[s])),
    sfx: sfxSets().flatMap((s) => filesOf(sfxDir(s), SFX_MANIFESTS[s])),
  };
}
