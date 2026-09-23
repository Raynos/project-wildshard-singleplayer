/**
 * The loading bar's last two jobs (docs/plans/PRELOAD-OFFLINE.md, the user: "everything should be loaded at the loading bar
 * … No cheating and background loading"): what the title menu, the Explore viewer and the audio used to fetch after
 * "playable" — found by the row-1 audit (headless request log, both shards) — is downloaded, counted and decoded here.
 *
 *  - `bootFiles(def)`       the boot manifest (src/boot/manifest.ts) + the `music` / `sfx` sources (every file of every
 *                           style and set, src/boot/audioFiles.ts) + the `art` source: every shard card's thumbnail and hero
 *                           stills (both orientations — the title swipes between cards and a phone can turn) and, on a shard
 *                           with the Explore viewer, its panel art. Bundled files with hashed URLs, sized from
 *                           src/boot/art.generated.ts (Vite copies them byte for byte).
 *  - `extraFetches(files)`  the art and the audio for the prefetch queue (after the shard's own files), in the order they
 *                           are needed: the art, then the selected style + set, then every other style and set.
 *  - `startMenuPreload()`   each picture, once the queue has it, kept in memory: the shard cards' art as blob: URLs swapped
 *                           into the cards (the title's swipe used to fetch the neighbours' hero stills — even from the
 *                           worker's cache that is a request after the bar), the Explore panels decoded into <img>s the
 *                           viewer's own <img>s reuse; awaited by the 'menu' step, which also imports the lazy UI chunks
 *                           (Explore, Feedback) so opening them later makes no request.
 *  - `startAudioPreload()`  every audio file downloaded (the service worker caches each on its way in — a menu switch and an
 *                           offline launch read them from there), the selected music style (title + this shard's slot +
 *                           stings) and sound-effect set decoded on an OfflineAudioContext as their bytes land; awaited by
 *                           the 'audio' step, which closes the `music` and `sfx` byte sources.
 */
import type { ChunkDef } from '../chunks/ChunkDef';
import { chunkFiles } from './manifest';
import { addBytes, type ChunkFiles } from './bytes';
import { ART_BYTES } from './art.generated';
import type { StepProgress } from './plan';
import { audioFiles, musicDir, sfxDir } from './audioFiles';
import { whenPrefetched } from './prefetch';
import { decodeBytes, decodeSfxSet, sfxFiles, type SfxBank } from '../audio/preload';
import { decodeStyle, styleFiles, type SlotName, type StyleBank } from '../audio/Stems';
import { getMusicStyle, getSfxSet } from '../ui/Settings';
import { CHUNKS } from '../chunks/registry';
import { PLACEHOLDERS } from '../chunks/placeholders';

/** source path (`../chunks/thumbs/x.jpg`, relative to this file) → the bundle's URL for it */
const ART_URLS = import.meta.glob<string>(['../chunks/thumbs/*.{jpg,jpeg,png,webp}', '../explore/img/*.{jpg,jpeg,png,webp}'], { eager: true, query: '?url', import: 'default' });
const pathOf = (url: string): string => { try { return new URL(url, location.href).pathname; } catch { return url; } };

/** the shard cards' pictures among the art (the rest is the Explore viewer's) */
const cardArt = new Set<string>();

function artFor(def: ChunkDef): { urls: string[]; bytes: Record<string, number> } {
  const urls: string[] = [], bytes: Record<string, number> = {};
  for (const [key, url] of Object.entries(ART_URLS)) {
    if (url.startsWith('data:')) continue; // inlined into the bundle: nothing to fetch
    if (key.startsWith('../explore/') && def.ocean === undefined) continue; // EXPLORE WORLD is Driftwood's (EXPLORE-WORLD.md D4)
    const size = ART_BYTES[`src/${key.slice(3)}`];
    if (size === undefined) continue;
    const p = pathOf(url);
    urls.push(p); bytes[p] = size;
    if (key.startsWith('../chunks/')) cardArt.add(p);
  }
  return { urls, bytes };
}

/** this shard's declared files: the boot manifest's sources plus the bundled title / explore art */
export function bootFiles(def: ChunkDef): ChunkFiles {
  const art = artFor(def);
  addBytes(art.bytes);
  return { ...chunkFiles(def), art: art.urls, ...audioFiles() };
}

/** the art and the audio for the prefetch queue: the selected style + set (decoded in the bar) ahead of the others (downloaded only) */
export function extraFetches(files: ChunkFiles): string[] {
  const mine = (p: string): boolean => p.startsWith(musicDir(getMusicStyle())) || p.startsWith(sfxDir(getSfxSet()));
  const audio = [...files.music, ...files.sfx];
  return [...files.art, ...audio.filter(mine), ...audio.filter((p) => !mine(p))];
}

/** a counter the bar's step reports once it runs (events before the step starts would be dropped by the plan) */
function counter(total: number): { tick: () => void; attach: (p: StepProgress, label: string) => void } {
  let done = 0, sink: ((d: number) => void) | undefined;
  return {
    tick() { done++; sink?.(done); },
    attach(p, label) { sink = (d) => { p.set(d, total, `${d} / ${total} ${label}`); }; sink(done); },
  };
}

/** the decoded images live here for the page's life: the menu's CSS backgrounds and <img>s are served from memory */
const keep: HTMLImageElement[] = [];
interface CardArt { thumbnail: string; heroPortrait: string; heroLandscape: string }
/** every card's pictures pointed at their in-memory copies (the title menu reads them when it builds its deck) */
function swapCardArt(blobs: ReadonlyMap<string, string>): void {
  const swap = (c: CardArt): void => {
    c.thumbnail = blobs.get(pathOf(c.thumbnail)) ?? c.thumbnail;
    c.heroPortrait = blobs.get(pathOf(c.heroPortrait)) ?? c.heroPortrait;
    c.heroLandscape = blobs.get(pathOf(c.heroLandscape)) ?? c.heroLandscape;
  };
  for (const c of CHUNKS) swap(c);
  for (const t of PLACEHOLDERS) swap(t);
}

export interface Preload<T> { wait: (p: StepProgress) => Promise<T> }

export function startMenuPreload(files: ChunkFiles, def: ChunkDef): Preload<void> {
  const art = files.art;
  const c = counter(art.length + (def.ocean === undefined ? 1 : 2));
  const blobs = new Map<string, string>();
  const images = art.map(async (u) => {
    await whenPrefetched(u);
    try {
      const blob = await (await fetch(u)).blob(); // the counted download, handed over by the queue (the service worker keeps a copy)
      const card = cardArt.has(u);
      const src = card ? URL.createObjectURL(blob) : u; // Explore's own <img>s use the bundle URL: decoded once here, reused from memory
      if (card) blobs.set(u, src);
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      keep.push(img);
      await img.decode();
    } catch { /* a missing picture: the card shows its colour, as before */ }
    c.tick();
  });
  return {
    async wait(p) {
      c.attach(p, 'pictures · UI');
      // the lazy UI chunks, fetched and evaluated now: a later import() is answered from the module map
      const code = [import('../ui/Feedback'), ...(def.ocean === undefined ? [] : [import('../explore/Explore')])].map(async (m) => { await m; c.tick(); });
      await Promise.all([...images, ...code]);
      swapCardArt(blobs);
    },
  };
}

export interface AudioBanks { music: StyleBank | undefined; sfx: SfxBank }

export function startAudioPreload(files: ChunkFiles, def: ChunkDef): Preload<AudioBanks> {
  const ocean = def.ocean !== undefined;
  const style = getMusicStyle(), set = getSfxSet();
  const slots: SlotName[] = ['title', ocean ? 'island' : 'pine']; // the other shard's slot is never played here (a shard change reloads)
  const bed = ocean ? 'island' : 'forest';
  const decoded = new Set([...styleFiles(style, slots), ...sfxFiles(set, bed)]);
  const rest = [...files.music, ...files.sfx].filter((u) => !decoded.has(u));
  const c = counter(decoded.size + rest.length);
  // the boot's counted fetch (the prefetch hands over the bytes it already has); a file two decoders share is read once
  const reads = new Map<string, Promise<ArrayBuffer>>();
  const load = async (url: string): Promise<ArrayBuffer> => {
    await whenPrefetched(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.arrayBuffer();
  };
  const read = async (url: string): Promise<ArrayBuffer> => {
    let r = reads.get(url);
    if (!r) { r = load(url); reads.set(url, r); }
    return (await r).slice(0); // decodeAudioData detaches what it is given
  };
  const music = decodeStyle(style, slots, read, decodeBytes, c.tick).catch((e: unknown) => {
    if (style !== 'synth') console.info(`[music] ${style}: ${e instanceof Error ? e.message : String(e)} — the synth plays`);
    return undefined;
  });
  const sfx = decodeSfxSet(set, bed, read, c.tick);
  // every other style / set: downloaded to the last byte (through the service worker, which keeps it), then let go
  const others = rest.map(async (u) => {
    try { await whenPrefetched(u); const res = await fetch(u); await res.arrayBuffer(); } catch { /* offline with no copy: that style / set decodes to the synth later */ }
    c.tick();
  });
  return {
    async wait(p) {
      c.attach(p, 'audio files');
      const [m, s] = await Promise.all([music, sfx, ...others]);
      reads.clear();
      return { music: m, sfx: s };
    },
  };
}
