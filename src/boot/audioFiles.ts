/**
 * Every audio file the game can play, for the loading bar (project/archive/2026-09-23-preload-offline.md, the user's pick: "the shard being
 * launched + ALL audio"). The lists come from the manifests the build compiled in (src/boot/audio.generated.ts, written by
 * vite.config.ts from public/assets/music/<style>/music.json and public/assets/sfx/<set>/sfx.json), crossed with the styles
 * and sets the Settings menu offers (MUSIC_STYLES / SFX_SETS) — neither list is spelled out here, so a set renamed or added
 * in Settings + its sfx.json needs no edit in this file. The selected style / set comes first: it is the one decoded before
 * "playable", so its bytes should land first.
 *
 * A shard's own sets ride on its bar only (E44, PINE-HOLLOW-REMASTER A-rows): Pine Hollow adds its music for the selected
 * style (public/assets/music/pine-hollow-<style>/: calm-night, the Antler King's phases, the dawn sting) and its SFX set
 * (public/assets/sfx/pine-hollow/: the zoned beds, the one-shots, the barks), and leaves out the base styles' Driftwood slot
 * ('island' — never played on Pine Hollow; a shard change reloads). Driftwood's list is exactly what it was.
 *
 * The one SFX set carries another shard's sounds too (NALATI-MERGE A1: an entry tagged `shard: 'nalati'` — the steppe's
 * creatures, weapons, weather and ten beds; preload.ts decodes them on the steppe only). Pine Hollow's bar leaves those out
 * as it leaves out 'island': 49 families, ~2.4 MB and ~80 requests it never plays (the phone's 180-request row).
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

const PINE = 'pine-hollow';
/** the shard's own music sets (dirs under /assets/music/): Pine Hollow's, in the selected style — none for the synth */
export function shardMusicSets(slug: string): string[] {
  const style = getMusicStyle(), set = `${PINE}-${style}`;
  return slug === PINE && style !== 'synth' && Object.hasOwn(MUSIC_MANIFESTS, set) ? [set] : [];
}
/** the shard's own SFX sets (dirs under /assets/sfx/): Pine Hollow's — downloaded whatever Settings plays (a switch reads the cache) */
export const shardSfxSets = (slug: string): string[] => (slug === PINE && Object.hasOwn(SFX_MANIFESTS, PINE) ? [PINE] : []);
/** a base style's slots this shard never plays (Pine Hollow: Driftwood's 'island') */
const unplayed = (slug: string): readonly string[] => (slug === PINE ? ['island'] : []);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/**
 * Driftwood's own sounds in the one shared set, untagged: its creatures (crabs, monkeys, the drowned sailors), the coconuts, the
 * gulls, the shrine's hum and the island bed. Pine Hollow has none of them (PH-P3, 2026-09-25: ~0.45 MiB and 16 requests of
 * its phone bar); src/audio/preload.ts leaves them undecoded there too, so nothing asks for them after the bar.
 */
export const DRIFTWOOD_SOUNDS: Readonly<Record<'beds' | 'hums' | 'oneshots', readonly string[]>> = {
  beds: ['island'], hums: ['shrine'],
  oneshots: ['crab_click', 'crab_snap', 'monkey_chatter', 'monkey_shriek', 'sailor_groan', 'sailor_slash', 'coconut_hit', 'coconut_land', 'gull'],
};
/** the files of `m`'s beds / hums / one-shots tagged for another shard (`shard: 'nalati'`) or Driftwood's own, which `slug` never plays */
function otherShardFiles(m: unknown, slug: string): Set<string> {
  const out = new Set<string>();
  if (slug !== PINE || !isObj(m)) return out;
  for (const sec of ['beds', 'hums', 'oneshots'] as const) {
    const entries = m[sec];
    if (!isObj(entries)) continue;
    for (const [k, v] of Object.entries(entries)) if ((isObj(v) && typeof v['shard'] === 'string') || DRIFTWOOD_SOUNDS[sec].includes(k)) for (const f of manifestFiles(v)) out.add(f);
  }
  return out;
}
/** the files of SFX set `set` for shard `slug` (URLs): all of them, but another shard's own sounds */
function sfxFilesFor(set: string, slug: string): string[] {
  const m = SFX_MANIFESTS[set], skip = otherShardFiles(m, slug), dir = sfxDir(set);
  return filesOf(dir, m).filter((p) => !skip.has(p.slice(dir.length)));
}
/** the manifest without `drop`'s slots */
function withoutSlots(m: unknown, drop: readonly string[]): unknown {
  if (drop.length === 0 || typeof m !== 'object' || m === null || Array.isArray(m)) return m;
  const slots: unknown = (m as Record<string, unknown>)['slots'];
  if (typeof slots !== 'object' || slots === null || Array.isArray(slots)) return m;
  return { ...m, slots: Object.fromEntries(Object.entries(slots).filter(([k]) => !drop.includes(k))) };
}

/** the loading bar's `music` and `sfx` byte sources for shard `slug`: every file of every style / set (the selected one
 *  first; on Pine Hollow without another shard's own sounds), then the shard's own sets. Without a slug (or on Driftwood):
 *  the base styles and sets, every slot. */
export function audioFiles(slug = ''): { music: string[]; sfx: string[] } {
  const drop = unplayed(slug);
  return {
    music: [...musicStyles().flatMap((s) => filesOf(musicDir(s), withoutSlots(MUSIC_MANIFESTS[s], drop))), ...shardMusicSets(slug).flatMap((s) => filesOf(musicDir(s), MUSIC_MANIFESTS[s]))],
    sfx: [...sfxSets().flatMap((s) => sfxFilesFor(s, slug)), ...shardSfxSets(slug).flatMap((s) => filesOf(sfxDir(s), SFX_MANIFESTS[s]))],
  };
}
