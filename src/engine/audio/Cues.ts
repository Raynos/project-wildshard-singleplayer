import { SFX_MANIFESTS } from '../boot/audio.generated';
import { shipped } from './Stems';
import type { SampleLoop } from './Audio';
import type { AudioMixer } from './levelAudio';
import type { AudioRead, AudioDecode } from './SetScore';
import type { Scope } from '../app/scope';

export interface SampleClip { buffer: AudioBuffer; offset: number; duration: number; gain: number }
export interface CueBank { loops: Map<string, SampleLoop>; shots: Map<string, SampleClip[]> }
export interface CueOpts { pan?: number; gain?: number; strength?: number; sprinting?: boolean; surface?: string }
export type CueMap = (id: string, opts: CueOpts) => boolean;
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number): number => typeof v === 'number' && Number.isFinite(v) ? v : d;
const file = (dir: string, v: unknown): string | undefined => typeof v === 'string' && !v.includes('..') && !v.includes('/') && shipped(`${dir}${v}`) ? `${dir}${v}` : undefined;

/** An own set uses one sprite for shots, plus its beds and positional loops. */
export function cueFiles(key: string): string[] {
  const raw = SFX_MANIFESTS[key], dir = `/assets/sfx/${key}/`;
  if (!obj(raw)) return [];
  const files: string[] = [];
  for (const section of ['beds', 'hums']) {
    const entries = raw[section];
    if (obj(entries)) for (const value of Object.values(entries)) if (obj(value)) {
      const url = file(dir, value['file']); if (url) files.push(url);
    }
  }
  const sprite = raw['sprite'];
  if (obj(sprite)) { const url = file(dir, sprite['file']); if (url) files.push(url); }
  return [...new Set(files)];
}
export async function decodeCueSet(key: string, read: AudioRead, decode: AudioDecode, onFile?: () => void): Promise<CueBank> {
  const raw = SFX_MANIFESTS[key], dir = `/assets/sfx/${key}/`, bank: CueBank = { loops: new Map(), shots: new Map() };
  if (!obj(raw)) return bank;
  const buffers = new Map<string, AudioBuffer>();
  await Promise.all(cueFiles(key).map(async (url) => {
    try { buffers.set(url, await decode(await read(url))); }
    catch (error) { console.info(`[sfx] ${url}: ${error instanceof Error ? error.message : String(error)} — synth kept`); }
    finally { onFile?.(); }
  }));
  for (const section of ['beds', 'hums']) {
    const entries = raw[section];
    if (!obj(entries)) continue;
    for (const [name, value] of Object.entries(entries)) {
      if (!obj(value)) continue;
      const url = file(dir, value['file']), buffer = url ? buffers.get(url) : undefined;
      if (!buffer) continue;
      const loopEnd = Math.min(buffer.duration, num(value['loopEnd'], buffer.duration));
      const loopStart = Math.max(0, Math.min(loopEnd - 0.05, num(value['loopStart'], 0)));
      if (loopEnd > loopStart) bank.loops.set(`${section === 'beds' ? 'bed' : 'hum'}.${name}`, { buffer, loopStart, loopEnd, gain: num(value['gain'], 1) });
    }
  }
  const sprite = raw['sprite'], shots = raw['oneshots'];
  if (!obj(sprite) || !obj(shots) || !obj(sprite['clips'])) return bank;
  const url = file(dir, sprite['file']), buffer = url ? buffers.get(url) : undefined;
  if (!buffer) return bank;
  const clips = sprite['clips'];
  for (const [family, value] of Object.entries(shots)) {
    if (!obj(value) || !Array.isArray(value['files'])) continue;
    const decoded: SampleClip[] = [];
    for (const name of value['files']) {
      if (typeof name !== 'string') continue;
      const bounds = clips[name];
      if (!Array.isArray(bounds)) continue;
      const offset = num(bounds[0], -1), duration = num(bounds[1], -1);
      if (offset >= 0 && duration > 0 && offset + duration <= buffer.duration + 0.05) decoded.push({ buffer, offset, duration, gain: num(value['gain'], 1) });
    }
    if (decoded.length > 0) bank.shots.set(family, decoded);
  }
  return bank;
}

/** Content calls tap.sound with its literal id, then asks this shared positional shot player. */
export class CuePlayer {
  private bank: CueBank = { loops: new Map(), shots: new Map() };
  private readonly audio: AudioMixer;
  private readonly scope: Scope;
  private readonly random: () => number;
  constructor(audio: AudioMixer, scope: Scope, random: () => number) { this.audio = audio; this.scope = scope; this.random = random; }
  useBank(bank: CueBank): void { if (!this.scope.disposed) this.bank = bank; }
  loop(id: string): SampleLoop | undefined { return this.bank.loops.get(id); }
  play(family: string, opts: CueOpts = {}): boolean {
    if (this.scope.disposed || !this.audio.ready) return false;
    const clips = this.bank.shots.get(family), clip = clips?.[Math.floor(this.random() * clips.length)];
    if (!clip) return false;
    const ctx = this.audio.ctx, source = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
    source.buffer = clip.buffer;
    gain.gain.value = clip.gain * (opts.gain ?? 1);
    pan.pan.value = Math.min(1, Math.max(-1, opts.pan ?? 0));
    source.connect(gain).connect(pan).connect(this.audio.bus('sfx'));
    let ended = false;
    const forget = this.scope.capture('sounds', () => {
      if (!ended) source.stop();
      source.disconnect(); gain.disconnect(); pan.disconnect();
    });
    this.scope.listen(source, 'ended', () => { ended = true; forget(); source.disconnect(); gain.disconnect(); pan.disconnect(); }, { once: true });
    source.start(ctx.currentTime, clip.offset, clip.duration);
    return true;
  }
}
