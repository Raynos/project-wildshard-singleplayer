// src/audio/preload.ts — audio decoded at the loading bar, not after it (project/archive/2026-09-23-preload-offline.md rows 3–4).
//
//   decodeBytes(bytes)                 → AudioBuffer, decoded on one shared OfflineAudioContext at the files' rate (48 kHz)
//   cachedBytes(url)                   → the file's bytes from Cache Storage (the service worker stored it while the bar
//                                        downloaded it), else a plain fetch (no worker: dev, ?sw=0, the native shell)
//   decodeSfxSet(set, bed, read)       → an SfxBank: sfx.json's beds (this shard's + underwater), hums, one-shots
//   trackBusy('music' | 'sfx', work)   → work, flagging the menu's picker busy only if it runs past BUSY_MS
//   onAudioBusy(fn)                    → the picker's spinner (src/ui/Menu.ts)
//
// No AudioContext before the first gesture (218e19a: creating one is a ~150 ms main-thread task on the phone, and iOS only
// unlocks a context made inside a gesture): an OfflineAudioContext never opens an audio device, and its decodeAudioData is
// the same decoder. An AudioBuffer belongs to no context — "An AudioBuffer may be used by one or more AudioContexts, and can
// be shared between an OfflineAudioContext and an AudioContext" (W3C Web Audio API 1.1, §AudioBuffer); WebKit's
// AudioBufferSourceNode takes any buffer and plays it at buffer.sampleRate / context.sampleRate (AudioBufferSourceNode.cpp),
// so a 44.1 kHz live context still plays these 48 kHz buffers at pitch. The context is made at 48 kHz because every file is
// 48 kHz AAC: decodeAudioData resamples to its context's rate, and at the files' own rate it resamples nothing.
import type { AmbientBed, LoopName, SampleLoop } from './Audio';
import { SFX_MANIFESTS } from '../boot/audio.generated';
import { PUBLIC_BYTES } from '../boot/bytes.generated';
import { sfxDir } from '../boot/audioFiles';

export const DECODE_RATE = 48000;
let offline: OfflineAudioContext | undefined;
function decodeContext(): OfflineAudioContext {
  offline ??= new OfflineAudioContext(2, 1, DECODE_RATE); // the 3-argument form: Safari's constructor
  return offline;
}
/** decode compressed audio into an AudioBuffer without an AudioContext (the bytes are detached) */
export function decodeBytes(bytes: ArrayBuffer): Promise<AudioBuffer> { return decodeContext().decodeAudioData(bytes); }

/** the bytes of `url` from the offline cache the bar filled — a style / set switch never touches the network */
export async function cachedBytes(url: string): Promise<ArrayBuffer> {
  if (typeof caches !== 'undefined') {
    try {
      const hit = await caches.match(url, { ignoreVary: true });
      if (hit) return await hit.arrayBuffer();
    } catch { /* storage blocked (private mode): fetch below */ }
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.arrayBuffer();
}

// ─────────────── the menu's "busy" flag (a style / set decoding from the cache) ───────────────
export type AudioKind = 'music' | 'sfx';
const BUSY_MS = 300;
const busyFns = new Set<(kind: AudioKind, on: boolean) => void>();
export function onAudioBusy(fn: (kind: AudioKind, on: boolean) => void): () => void { busyFns.add(fn); return () => { busyFns.delete(fn); }; }
/** run `work`; the picker shows a spinner only if it is still running after BUSY_MS */
export function trackBusy<T>(kind: AudioKind, work: Promise<T>): Promise<T> {
  let shown = false;
  const timer = setTimeout(() => { shown = true; busyFns.forEach((fn) => fn(kind, true)); }, BUSY_MS);
  const settle = (): void => { clearTimeout(timer); if (shown) busyFns.forEach((fn) => fn(kind, false)); };
  void work.finally(settle).catch(() => undefined); // the caller handles the rejection; this copy only clears the flag
  return work;
}

// ─────────────── sound-effect sets (sfx.json) ───────────────
/** a decoded sound-effect set: what Audio.ts plays in place of the synth versions */
export interface SfxBank { set: string; credit: string | undefined; loops: Map<LoopName, SampleLoop>; shots: Map<string, { bufs: AudioBuffer[]; gain: number }> }
/** a sample's level before sfx.json's own `gain` (beds sit under the synth bed's ~0.1 winds; hums near the synth hum's 0.11) */
const LOOP_GAIN: Record<LoopName, number> = { forest: 0.5, island: 0.5, underwater: 0.5, pickup: 0.35, shrine: 0.6 };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const TABLE: Readonly<Record<string, number>> = PUBLIC_BYTES;

/** the files `decodeSfxSet(set, bed)` reads (URLs), so the loading bar can tell them from the files it only downloads */
export function sfxFiles(set: string, bed: AmbientBed): string[] { return [...new Set(sfxJobs(set, bed).map((j) => j.url))]; }

interface Job { url: string; apply: (buf: AudioBuffer, bank: SfxBank) => void }
function sfxJobs(set: string, bed: AmbientBed): Job[] {
  const j = SFX_MANIFESTS[set];
  if (!isObj(j)) return [];
  const dir = sfxDir(set), jobs: Job[] = [];
  const url = (f: unknown): string | undefined => (typeof f === 'string' && !f.includes('..') && `${dir}${f}` in TABLE ? `${dir}${f}` : undefined);
  const loop = (name: LoopName, v: unknown): void => {
    if (!isObj(v)) return;
    const u = url(v['file']);
    if (u === undefined) return;
    jobs.push({ url: u, apply: (buffer, bank) => {
      const loopEnd = Math.min(buffer.duration, num(v['loopEnd'], buffer.duration)), loopStart = Math.max(0, Math.min(loopEnd - 0.05, num(v['loopStart'], 0)));
      bank.loops.set(name, { buffer, loopStart, loopEnd, gain: LOOP_GAIN[name] * num(v['gain'], 1) });
    } });
  };
  const beds = isObj(j['beds']) ? j['beds'] : {}, hums = isObj(j['hums']) ? j['hums'] : {}, shots = isObj(j['oneshots']) ? j['oneshots'] : {};
  // this shard's bed first (never the other shard's: a shard change reloads the page), then the rest
  loop(bed, beds[bed]); loop('underwater', beds['underwater']); loop('pickup', hums['pickup']); loop('shrine', hums['shrine']);
  for (const [family, v] of Object.entries(shots)) {
    const files = Array.isArray(v) ? v : isObj(v) && Array.isArray(v['files']) ? v['files'] : [];
    const gain = isObj(v) ? num(v['gain'], 1) : 1;
    for (const f of files) {
      const u = url(f);
      if (u !== undefined) jobs.push({ url: u, apply: (buf, bank) => { const s = bank.shots.get(family); if (s) s.bufs.push(buf); else bank.shots.set(family, { bufs: [buf], gain }); } });
    }
  }
  return jobs;
}

/**
 * Decode `set` — every file its sfx.json lists that this shard can play — from `read` (the boot's counted fetch at the bar;
 * `cachedBytes` for a switch in the menu). A file that fails keeps its synth version; the set as a whole never rejects.
 */
export async function decodeSfxSet(set: string, bed: AmbientBed, read: (url: string) => Promise<ArrayBuffer>, onFile?: () => void): Promise<SfxBank> {
  const j = SFX_MANIFESTS[set];
  const bank: SfxBank = { set, credit: isObj(j) && typeof j['credit'] === 'string' ? j['credit'] : undefined, loops: new Map(), shots: new Map() };
  await Promise.all(sfxJobs(set, bed).map(async (job) => {
    try { job.apply(await decodeBytes(await read(job.url)), bank); }
    catch (e) { console.info(`[sfx] ${job.url}: ${e instanceof Error ? e.message : String(e)} — synth kept`); }
    onFile?.();
  }));
  return bank;
}
