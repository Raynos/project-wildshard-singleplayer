import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { VoicePool } from '#engine/audio/Voices';
import { panFromYaw } from '#engine/audio/util';
import { Scope } from '#engine/app/scope';
import type { SampleLoop } from '#engine/audio/Audio';
import type { AudioMixer } from '#engine/audio/levelAudio';
import { AmbienceBeds, PositionalLoops } from '#engine/audio/AmbienceBeds';
import { CuePlayer, cueFiles, decodeCueSet } from '#engine/audio/Cues';
import { SetScore, scoreFiles, decodeScore } from '#engine/audio/SetScore';
import { ndPick, createNdAudio, SCORE_SET } from '#shards/nine-dragon-stack/audio/files';
import { ndZones } from '#shards/nine-dragon-stack/audio/ambience';
import { ndCueMap } from '#shards/nine-dragon-stack/audio/cues';
import { tap, ambientTick } from '#engine/core/harnessTap';
import type { MusicState } from '#engine/audio/Music';

const buffer = (duration = 100): AudioBuffer => ({ duration } as AudioBuffer);
class Param implements AudioParam {
  value = 0;
  automationRate: AutomationRate = 'a-rate';
  defaultValue = 0; minValue = -Infinity; maxValue = Infinity;
  setTargetAtTime(value: number, _time: number, _constant: number): AudioParam { this.value = value; return this; }
  setValueAtTime(value: number, _time: number): AudioParam { this.value = value; return this; }
  linearRampToValueAtTime(value: number, _time: number): AudioParam { this.value = value; return this; }
  exponentialRampToValueAtTime(value: number, _time: number): AudioParam { this.value = value; return this; }
  setValueCurveAtTime(_values: Float32Array, _time: number, _duration: number): AudioParam { return this; }
  cancelScheduledValues(_time: number): AudioParam { return this; }
  cancelAndHoldAtTime(_time: number): AudioParam { return this; }
}
class Node extends EventTarget {
  gain = new Param(); pan = new Param();
  buffer: AudioBuffer | null = null;
  loop = false; loopStart = 0; loopEnd = 0;
  stopped = false; disconnected = false;
  starts: number[][] = [];
  connect(node: AudioNode, output?: number, input?: number): AudioNode;
  connect(node: AudioParam, output?: number): void;
  connect(node: AudioNode | AudioParam, _output?: number, _input?: number): AudioNode | void { if ('connect' in node) return node; }
  disconnect(): void { this.disconnected = true; }
  start(...args: number[]): void { this.starts.push(args); }
  stop(): void { this.stopped = true; }
}
function fake(): { audio: AudioMixer; nodes: Node[]; bus: Node } {
  const nodes: Node[] = [], bus = new Node();
  const node = (): Node => { const n = new Node(); nodes.push(n); return n; };
  const wiring = (n: Node): Pick<AudioNode, 'connect' | 'disconnect'> => ({ connect: n.connect.bind(n), disconnect: () => { n.disconnect(); } });
  const gain = (n: Node): GainNode => ({ ...wiring(n), gain: n.gain } as GainNode);
  const ctx = { currentTime: 10, createGain: () => gain(node()), createStereoPanner: () => {
    const n = node(); return { ...wiring(n), pan: n.pan } as StereoPannerNode;
  }, createBufferSource: () => {
    const n = node();
    return { ...wiring(n), buffer: n.buffer, loop: n.loop, loopStart: n.loopStart, loopEnd: n.loopEnd,
      start: (...args: number[]) => { n.start(...args); }, stop: () => { n.stop(); }, addEventListener: n.addEventListener.bind(n), removeEventListener: n.removeEventListener.bind(n) } as AudioBufferSourceNode;
  } } as BaseAudioContext;
  const state = { ready: false };
  const voices = new VoicePool({ get ready() { return state.ready; }, ctx, sfx: gain(bus) });
  const audio = Object.assign(state, { ctx, bus: () => gain(bus), voice: (): VoicePool => voices });
  return { audio, nodes, bus };
}
const sample: SampleLoop = { buffer: buffer(), loopStart: 2, loopEnd: 8, gain: 0.5 };
const state: MusicState = { shard: 'pine', mode: 'calm', intensity: 0, underwater: false };

describe('level-owned audio slice', () => {
  it('registers sampled voices in the same pool as procedural voices and releases the table on unload', () => {
    const { audio, nodes } = fake(), scope = new Scope('voice-table');
    const voices = audio.voice();
    voices.register({ 'sample.test': { clips: () => [{ buffer: buffer(), offset: 3, duration: 0.7 }], policy: { jitter: 0 } } }, scope);
    expect(voices.play('sample.test')).toBeUndefined();
    Object.assign(audio, { ready: true });
    expect(voices.buffer('sample.test')?.duration).toBe(100);
    expect(voices.play('sample.test')).toBeDefined();
    expect(nodes[0]?.starts).toEqual([[10, 3, 0.7]]);
    scope.dispose();
    expect(voices.play('sample.test')).toBeUndefined();
    expect(voices.buffer('sample.test')).toBeUndefined();
  });
  it('preserves each audio pan spread, yaw convention and three-dimensional distance normalization', () => {
    expect(panFromYaw(10, 0, 0, 0.8)).toBe(0.8);
    expect(panFromYaw(0, 10, Math.PI / 2, 0.7)).toBe(-0.7);
    expect(panFromYaw(10, 0, 0, 0.8, 20)).toBe(0.4);
    expect(panFromYaw(0.2, 0, 0)).toBe(0);
  });
  it('downloads only title cuts, the own score, beds, hum and sprite; boot decodes only market plus stings', async () => {
    const ND_AUDIO = await createNdAudio();
    const files = ND_AUDIO.files(), selected = ND_AUDIO.bootFiles('folk');
    expect(files.music.some((url) => /\/pine[.-]/.test(url))).toBe(false);
    expect(files.sfx).toHaveLength(4);
    expect(files.sfx.filter((url) => url.includes('oneshots'))).toHaveLength(1);
    expect(selected.some((url) => url.includes('nd-market-calm'))).toBe(true);
    expect(selected.some((url) => url.includes('nd-well'))).toBe(false);
    expect(scoreFiles(SCORE_SET).filter((url) => url.includes('nd-well'))).toHaveLength(2);
    const reads: string[] = [];
    const bank = await ND_AUDIO.decode('folk', (url) => { reads.push(url); return Promise.resolve(new ArrayBuffer(1)); }, () => Promise.resolve(buffer()));
    expect(new Set(reads)).toEqual(new Set(selected));
    expect([...bank.score.slots.keys()]).toEqual(['nd-market']);
    expect([...bank.cues.loops.keys()].sort()).toEqual(['bed.nd.market', 'bed.nd.well', 'hum.lantern']);
    expect(bank.cues.shots.has('jian.swing')).toBe(true);
    expect(bank.cues.shots.has('step.metal.1')).toBe(false);
  });
  it('chooses fight, Well or market and holds lazy decoding until the deferred boot bank arrives', async () => {
    expect(ndPick({ well: 1 }, state)[0]).toBe('nd-well');
    expect(ndPick({ well: 0.5 }, state)[0]).toBe('nd-market');
    expect(ndPick({ well: 1 }, { ...state, mode: 'combat' })[0]).toBe('nd-fight');
    const read = vi.fn(() => Promise.resolve(new ArrayBuffer(1)));
    const source = new SetScore({ ...SCORE_SET, scene: {}, pick: () => ['nd-market'], read, decode: () => Promise.resolve(buffer()), onReady: (): void => { /* Test inspects readiness directly. */ }, waitForBank: true });
    expect(source.want(undefined)).toBeUndefined(); expect(source.pending).toBe(true); expect(read).not.toHaveBeenCalled();
    const bank = await decodeScore(SCORE_SET, ['nd-market'], read, () => Promise.resolve(buffer()), true);
    source.useBank(bank);
    expect(source.want(undefined)?.slot).toBe('nd-market'); expect(source.pending).toBe(false);
    source.dispose(); expect(source.resident).toEqual([]); expect(source.stings.size).toBe(0);
  });
  it('uses the layout rectangles with a six-metre seam, across every market area and into the Well', () => {
    expect(ndZones({ x: 10, z: 0 })).toEqual({ market: 1, well: 0 });
    expect(ndZones({ x: 5, z: -80 })).toEqual({ market: 1, well: 0 });
    expect(ndZones({ x: 40, z: 6 })).toEqual({ market: 1, well: 0 });
    expect(ndZones({ x: -14, z: -10 })).toEqual({ market: 0, well: 1 });
    expect(ndZones({ x: 0, z: 0 })).toEqual({ market: 0.5, well: 0.5 });
    expect(ndZones({ x: 3, z: 0 })['market']).toBe(1);
    expect(ndZones({ x: -3, z: 0 })['well']).toBe(1);
  });
  it('keeps bed graph creation gesture-gated and releases every scoped source and intermediate node', () => {
    const { audio, nodes } = fake(), scope = new Scope('beds');
    const started = vi.fn<() => void>();
    const beds = new AmbienceBeds(audio, scope, [{ id: 'bed.a', zone: 'a', sample: () => sample, started }], () => ({ a: 0.25 }), 3, () => 0.5);
    beds.update(new Vector3()); expect(nodes).toEqual([]);
    Object.assign(audio, { ready: true }); beds.update(new Vector3());
    expect(started).toHaveBeenCalledOnce(); expect(nodes[0]?.gain.value).toBe(0.125);
    expect(nodes[2]?.starts).toEqual([[10, 5]]); expect(scope.census.sounds).toBe(1);
    scope.dispose(); expect(nodes.every((node) => node.disconnected)).toBe(true); expect(nodes[2]?.stopped).toBe(true); expect(scope.census.sounds).toBe(0);
  });
  it('keeps nearest four positional loops, stops departed ones and leaves no voices after unload', () => {
    const { audio, nodes } = fake(), scope = new Scope('hums'); Object.assign(audio, { ready: true });
    const positions = [1, 2, 3, 4, 5, 30].map((x) => new Vector3(x, 0, 0));
    const loops = new PositionalLoops(audio, scope, positions, () => sample, () => undefined, () => 0, 4, 14);
    loops.update(new Vector3(), 0); expect(loops.count).toBe(4); expect(scope.census.sounds).toBe(4);
    loops.update(new Vector3(30, 0, 0), 0); expect(loops.count).toBe(1); expect(scope.census.sounds).toBe(1);
    expect(nodes.filter((n) => n.stopped)).toHaveLength(4);
    scope.dispose(); expect(loops.count).toBe(0); expect(nodes.every((n) => n.disconnected)).toBe(true);
  });
  it('plays bounded sprite segments through sfx, maps each literal cue and leaves rejected/missing families to synth', async () => {
    const { audio, nodes } = fake(), scope = new Scope('cues'); Object.assign(audio, { ready: true });
    const player = new CuePlayer(audio, scope, () => 0);
    player.useBank(await decodeCueSet('nine-dragon-stack', () => Promise.resolve(new ArrayBuffer(1)), () => Promise.resolve(buffer())));
    expect(cueFiles('nine-dragon-stack')).toHaveLength(4);
    const map = ndCueMap(player, () => 0), sound = vi.fn<(id: string, kind?: 'ambient') => void>(); tap.sound = sound;
    try {
      expect(map('melee.swing', {})).toBe(true); expect(sound).toHaveBeenLastCalledWith('nd.jian.swing');
      expect(nodes[0]?.starts[0]?.[1]).toBeGreaterThan(0); expect(nodes[0]?.starts[0]?.[2]).toBeGreaterThan(0);
      expect(map('step', { surface: 'metal' })).toBe(false); expect(sound).toHaveBeenLastCalledWith('nd.step.metal');
      expect(map('hurt', {})).toBe(false); expect(map('pickup', {})).toBe(false);
      ambientTick('test.scheduler', () => { map('chime.gust', {}); expect(tap.ambientDepth).toBe(1); });
      expect(sound).toHaveBeenCalledWith('test.scheduler', 'ambient'); expect(tap.ambientDepth).toBe(0);
    } finally { tap.sound = null; scope.dispose(); }
    expect(nodes.every((n) => n.disconnected)).toBe(true); expect(scope.census.sounds).toBe(0);
  });
});
