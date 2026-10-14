import { sfxManifests } from '../boot/tables';
import { shipped } from './Stems';
import type { SampleLoop } from './Audio';
import type { AudioMixer } from './levelAudio';
import type { AudioRead, AudioDecode } from './SetScore';
import type { VoicePool } from './Voices';
import type { Scope } from '../app/scope';
import type { Vector3 } from 'three';

export interface SampleClip { buffer: AudioBuffer; offset: number; duration: number; gain: number }
export interface CueBank { loops: Map<string, SampleLoop>; shots: Map<string, SampleClip[]> }
export interface CueOpts {
  pan?: number; gain?: number; strength?: number; sprinting?: boolean; surface?: string;
  point?: Vector3; dir?: Vector3 | -1 | 1; speed?: number; heavy?: boolean; kind?: string;
}
export type CueMap = (id: string, opts: CueOpts) => boolean;
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number): number => typeof v === 'number' && Number.isFinite(v) ? v : d;
const file = (dir: string, v: unknown): string | undefined => typeof v === 'string' && !v.includes('..') && !v.includes('/') && shipped(`${dir}${v}`) ? `${dir}${v}` : undefined;

/** One shipped sprite and its original take offsets; no PCM is copied. */
export interface CueSprite { url:string;clips:ReadonlyMap<string,Readonly<{offset:number;duration:number}>> }
/** The installed recording catalogue, shared by eager banks and lazy family players. */
export function cueManifest(key:string):Record<string,unknown>|undefined {const raw=sfxManifests()[key];return obj(raw)?raw:undefined;}
/** Resolve only a confined filename present in the shipped byte table. */
export function cueFile(key:string,value:unknown):string|undefined {return file(`/assets/sfx/${key}/`,value);}
/** Original family order for array and object-form manifests. */
export function cueFamilyNames(manifest:Record<string,unknown>|undefined,family:string):string[] {
  const rows=manifest?.['oneshots'],value=obj(rows)?rows[family]:undefined;
  const list:unknown[]=Array.isArray(value)?value:obj(value)&&Array.isArray(value['files'])?value['files']:[];
  return list.filter((name):name is string=>typeof name==='string');
}
/** Admit a sprite's shipped file and positive slice bounds without decoding it. */
export function cueSprite(key:string,manifest:Record<string,unknown>|undefined):CueSprite|undefined {
  const sprite=manifest?.['sprite'],url=obj(sprite)?cueFile(key,sprite['file']):undefined,raw=obj(sprite)?sprite['clips']:undefined;
  if(url===undefined||!obj(raw))return undefined;
  const clips=new Map<string,{offset:number;duration:number}>();
  for(const [name,value]of Object.entries(raw)){
    const pair:unknown[]=Array.isArray(value)?value:[],offset=pair[0],duration=pair[1];
    if(typeof offset==='number'&&typeof duration==='number'&&offset>=0&&duration>0)clips.set(name,{offset,duration});
  }
  return {url,clips};
}
/** Cut named slices on one buffer, retaining each caller's end tolerance and gain policy. */
export function cutCueSprite(manifest:Record<string,unknown>|undefined,sprite:CueSprite,buffer:AudioBuffer,
  into:Map<string,SampleClip[]>,policy:{tolerance:number;arrayFamilies:boolean;familyGain:boolean}):void {
  const families=manifest?.['oneshots'];if(!obj(families))return;
  for(const [family,value]of Object.entries(families)){
    if(!policy.arrayFamilies&&(!obj(value)||!Array.isArray(value['files'])))continue;
    const clips:SampleClip[]=[];
    for(const name of cueFamilyNames(manifest,family)){
      const clip=sprite.clips.get(name);
      if(clip!==undefined&&clip.offset+clip.duration<=buffer.duration+policy.tolerance)clips.push({buffer,offset:clip.offset,duration:clip.duration,gain:policy.familyGain&&obj(value)?num(value['gain'],1):1});
    }
    if(clips.length>0)into.set(family,clips);
  }
}

/** An own set uses one sprite for shots, plus its beds and positional loops. */
export function cueFiles(key: string): string[] {
  const raw = sfxManifests()[key], dir = `/assets/sfx/${key}/`;
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
  else if (obj(raw['oneshots'])) for (const value of Object.values(raw['oneshots'])) {
    const takes = Array.isArray(value) ? value : obj(value) && Array.isArray(value['files']) ? value['files'] : [];
    for (const take of takes) { const url = file(dir, take); if (url) files.push(url); }
  }
  return [...new Set(files)];
}
export async function decodeCueSet(key: string, read: AudioRead, decode: AudioDecode, onFile?: () => void): Promise<CueBank> {
  const raw = sfxManifests()[key], dir = `/assets/sfx/${key}/`, bank: CueBank = { loops: new Map(), shots: new Map() };
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
  if (!obj(shots)) return bank;
  if (!obj(sprite)) {
    for (const [family, value] of Object.entries(shots)) {
      const takes = Array.isArray(value) ? value : obj(value) && Array.isArray(value['files']) ? value['files'] : [];
      const clips: SampleClip[] = [];
      for (const take of takes) { const url = file(dir, take), buffer = url ? buffers.get(url) : undefined; if (buffer) clips.push({ buffer, offset: 0, duration: buffer.duration, gain: obj(value) ? num(value['gain'], 1) : 1 }); }
      if (clips.length > 0) bank.shots.set(family, clips);
    }
    return bank;
  }
  const parsed=cueSprite(key,raw),buffer=parsed===undefined?undefined:buffers.get(parsed.url);
  if(parsed!==undefined&&buffer!==undefined)cutCueSprite(raw,parsed,buffer,bank.shots,{tolerance:0.05,arrayFamilies:false,familyGain:true});
  return bank;
}

/** Content calls tap.sound with its literal id, then asks this shared positional shot player. */
export class CuePlayer {
  private bank: CueBank = { loops: new Map(), shots: new Map() };
  private readonly audio: AudioMixer;
  private readonly scope: Scope;
  private readonly random: () => number;
  private readonly voices: VoicePool;
  constructor(audio: AudioMixer, scope: Scope, random: () => number) { this.audio = audio; this.scope = scope; this.random = random; this.voices = audio.voice(); }
  useBank(bank: CueBank): void { if (!this.scope.disposed) this.bank = bank; }
  loop(id: string): SampleLoop | undefined { return this.bank.loops.get(id); }
  play(family: string, opts: CueOpts = {}): boolean {
    if (this.scope.disposed || !this.audio.ready) return false;
    const clips = this.bank.shots.get(family);
    return clips !== undefined && this.voices.sample(clips, opts, { jitter: 0, panAlways: true }, this.random, this.scope) !== undefined;
  }
}
