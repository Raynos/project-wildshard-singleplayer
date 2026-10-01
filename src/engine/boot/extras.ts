/**
 * The loading bar's last two jobs (project/archive/2026-09-23-preload-offline.md, the user: "everything should be loaded at the loading bar
 * … No cheating and background loading"): what the title menu, the Explore viewer and the audio used to fetch after
 * "playable" — found by the row-1 audit (headless request log, both shards) — is downloaded, counted and decoded here.
 *
 *  - `bootFiles(def)`       the boot manifest (src/engine/boot/manifest.ts) + the `music` / `sfx` sources (every file of every
 *                           style and set, src/engine/boot/audioFiles.ts) + the `art` source: every shard card's thumbnail and hero
 *                           stills (both orientations — the title swipes between cards and a phone can turn) and, on a shard
 *                           with the Explore viewer, its panel art. Bundled files with hashed URLs, sized from
 *                           src/engine/boot/art.generated.ts (Vite copies them byte for byte).
 *  - `extraFetches(files)`  the art and the audio for the prefetch queue (after the shard's own files), in the order they
 *                           are needed: the art, then the selected style + set, then every other style and set.
 *  - `startMenuPreload()`   title art fetched during the bar. On phones only the selected card is decoded and kept in
 *                           memory; the other cards' compressed files remain in the offline cache until selected.
 *                           Explore panels are decoded into <img>s that the
 *                           viewer's own <img>s reuse; awaited by the 'menu' step, which also imports the lazy UI chunks
 *                           (Explore, Feedback) so opening them later makes no request.
 *  - `startAudioPreload()`  every audio file downloaded (the service worker caches each on its way in — a menu switch and an
 *                           offline launch read them from there), the selected music style (title + this shard's slot +
 *                           stings) and sound-effect set decoded on an OfflineAudioContext as their bytes land; awaited by
 *                           the 'audio' step, which closes the `music` and `sfx` byte sources. On Pine Hollow its own
 *                           music (the selected style) and SFX set ride along (src/engine/boot/audioFiles.ts), and the set's
 *                           one-shots + barks are decoded here too (PineHollowSfx `decodePineShots`) — nothing of the
 *                           shard's sound is fetched after the bar (E44).
 *  - `startDeferredAudioPreload()`  Nine Dragon on phones: the same counted downloads and offline cache, with selected
 *                           decoding serialized after the loader fades and the world starts (E246 memory A/B).
 */
import { texMode, type TexMode } from './gpuFiles';
import type { ShardManifest } from '#game/shard/manifest';
import { chunkFiles } from './manifest';
import { addBytes, type ChunkFiles } from './bytes';
import { ART_URL_BYTES } from '#game/shard/art.generated';
import { macrotask, type StepProgress } from './plan';
import { audioFiles, musicDir, sfxDir } from './audioFiles';
import { whenPrefetched } from './prefetch';
import { decodeBytes, type SfxBank } from '../audio/preload';
import type { StyleBank } from '../audio/Stems';
import { getMusicStyle, getSfxSet } from '../ui/Settings';
import { SHARDS } from '#game/shard/registry';
import { TIER } from '../core/tier';
import type { LevelAudioProfile, LevelAudioBank } from '../audio/levelAudio';
import { bootAudioFiles } from './audioInventory';


const pathOf = (url: string): string => { try { return new URL(url, location.href).pathname; } catch { return url; } };

/** the shard cards' pictures among the art (the rest is the Explore viewer's) */
const cardArt = new Set<string>();

function artFor(def: ShardManifest): { urls: string[]; bytes: Record<string, number> } {
  const urls: string[] = [], bytes: Record<string, number> = {};
  const cards = SHARDS.flatMap((card) => [card.card.thumb, card.card.portrait, ...(TIER === 'desktop' || card === def ? [card.card.landscape] : [])]);
  const cardUrls = new Set(cards);
  for (const url of new Set([...cards, ...(def.boot?.explore?.art ?? []), ...(def.boot?.precache ?? [])])) {
    if (url.startsWith('data:')) continue; // inlined into the bundle: nothing to fetch
    const size = ART_URL_BYTES[url];
    if (size === undefined) continue;
    const p = pathOf(url);
    urls.push(p); bytes[p] = size;
    if (cardUrls.has(url)) cardArt.add(p);
  }
  return { urls, bytes };
}

/** this shard's declared files: the boot manifest's sources plus the bundled title / explore art */
const audioPriority = new WeakMap<ChunkFiles, ReadonlySet<string>>();

export function bootFiles(def: ShardManifest, tex: TexMode = texMode(), profile?: LevelAudioProfile): ChunkFiles {
  const art = artFor(def);
  addBytes(art.bytes);
  const audio = profile?.files() ?? bootAudioFiles(def.boot) ?? audioFiles();
  const files = { ...chunkFiles(def, tex), art: art.urls, ...audio };
  const priority = profile?.priorityFiles?.();
  if (priority) audioPriority.set(files, new Set(priority));
  return files;
}

/** the art and the audio for the prefetch queue: the selected style + set (decoded in the bar) ahead of the others (downloaded only) */
export function extraFetches(files: ChunkFiles): string[] {
  const own = audioPriority.get(files);
  const mine = (url: string): boolean => url.startsWith(musicDir(getMusicStyle())) || url.startsWith(sfxDir(getSfxSet())) || own?.has(url) === true;
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
/** every card's pictures pointed at their in-memory copies (the title menu reads them when it builds its deck) */
function swapCardArt(blobs: ReadonlyMap<string, string>): void {
  for (const c of SHARDS) {
    c.card.thumb = blobs.get(pathOf(c.card.thumb)) ?? c.card.thumb;
    c.card.portrait = blobs.get(pathOf(c.card.portrait)) ?? c.card.portrait;
    c.card.landscape = blobs.get(pathOf(c.card.landscape)) ?? c.card.landscape;
  }
}

export interface Preload<T> { wait: (p: StepProgress) => Promise<T> }

/** pictures already in memory (E155: a shard built later in the page, or rebuilt, finds the cards' art decoded) */
const artLoaded = new Set<string>();

export function startMenuPreload(files: ChunkFiles, def: ShardManifest): Preload<void> {
  const art = files.art;
  const c = counter(art.length + (def.boot?.explore === undefined ? 1 : 2));
  const blobs = new Map<string, string>();
  // The phone page runs one shard at a time. Keep the other cards' bytes in the
  // offline cache, but do not hold their decoded full-size heroes in WebKit's
  // image memory while the selected shard allocates its textures (E244).
  const activeCardArt = new Set([def.card.thumb, def.card.portrait, def.card.landscape].map(pathOf));
  const images = art.map(async (u) => {
    if (artLoaded.has(u)) { c.tick(); return; }
    artLoaded.add(u);
    await whenPrefetched(u);
    if (TIER === 'phone' && cardArt.has(u) && !activeCardArt.has(u)) {
      c.tick();
      return;
    }
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
      const code = [import('../ui/Feedback'), ...(def.boot?.explore === undefined ? [] : [import('../explore/Explore')])].map(async (m) => { await m; c.tick(); });
      await Promise.all([...images, ...code]);
      swapCardArt(blobs);
    },
  };
}

/** audio files this page already read to the end once */
const downloaded = new Set<string>();

export interface AudioBanks { music: StyleBank | undefined; sfx: SfxBank; profile?: LevelAudioBank }

/** Nine Dragon's phone boot: count/cache every file, then decode the selected banks after the world starts. */
export function startDeferredAudioPreload(files: ChunkFiles, def: ShardManifest, profile?: LevelAudioProfile): Preload<void> & { readonly style: ReturnType<typeof getMusicStyle>; decode: () => Promise<AudioBanks> } {
  const style = getMusicStyle(), set = getSfxSet();
  if (profile === undefined) throw new Error(`${def.slug}: boot audio requires the authored preload profile`);
  const selected = new Set(profile.bootFiles(style));
  const urls = [...new Set([...files.music, ...files.sfx])];
  const c = counter(urls.length);
  // Keep only the selected compressed bytes until decode. That makes the post-bar decode work offline even if
  // Cache Storage is unavailable; all other styles/sets remain in the service worker's offline cache.
  const selectedBytes = new Map<string, ArrayBuffer>();
  const downloads = urls.map(async (url) => {
    try {
      await whenPrefetched(url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      const bytes = await response.arrayBuffer();
      if (selected.has(url)) selectedBytes.set(url, bytes);
      downloaded.add(url);
    } catch { downloaded.delete(url); /* a missing sound keeps its synth fallback */ }
    c.tick();
  });
  let decoding: Promise<AudioBanks> | undefined;
  return {
    style,
    async wait(p) { c.attach(p, 'audio files'); await Promise.all(downloads); },
    decode() {
      if (decoding) return decoding;
      decoding = (async () => {
        await Promise.all(downloads);
        let tail: Promise<void> = Promise.resolve();
        // decodeStyle and decodeSfxSet both start every file at once. Gate their decoder, not their reads,
        // so WebKit never holds dozens of simultaneous native PCM outputs during this memory A/B.
        const oneAtATime = (bytes: ArrayBuffer): Promise<AudioBuffer> => {
          const next = tail.then(async () => { await macrotask(); return decodeBytes(bytes); });
          tail = next.then(() => undefined, () => undefined);
          return next;
        };
        const read = (url: string): Promise<ArrayBuffer> => {
          const bytes = selectedBytes.get(url);
          if (!bytes) return Promise.reject(new Error(`${url} was not downloaded during the loading bar`));
          return Promise.resolve(bytes.slice(0)); // decodeAudioData detaches its argument
        };
        try {
          const bank = await profile.decode(style, read, oneAtATime);
          return { music: undefined, sfx: { set, credit: undefined, loops: new Map(), shots: new Map() }, profile: bank };
        } finally { selectedBytes.clear(); }
      })();
      return decoding;
    },
  };
}

export function startAudioPreload(files: ChunkFiles, def: ShardManifest, profile?: LevelAudioProfile): Preload<AudioBanks> {
  const preload = startDeferredAudioPreload(files, def, profile);
  return { wait: async (p) => { await preload.wait(p); return preload.decode(); } };
}
