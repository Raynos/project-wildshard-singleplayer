import { describe, expect, it } from 'vitest';
import { VoicePool } from '#engine-internal/audio/Voices';
import type { AudioMixer } from '#engine-internal/audio/levelAudio';
import type { Audio } from '#engine-internal/audio/Audio';
import { PineHollowSfx } from '#shards/pine-hollow/audio/sfx';
import { legacyDouble } from '../../fake/FakeGame';

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
  const ctx = { currentTime: 10, createGain: () => gain(node()), createBiquadFilter: () => {
    const n = node(); return { ...wiring(n), frequency: new Param(), type: 'lowpass' } as BiquadFilterNode;
  }, createStereoPanner: () => {
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

describe('Pine shared listener (E357 J1 / P5)', () => {
  it('moves every sample voice with Pine and keeps its distinct roll-off policy', () => {
    const { audio, nodes } = fake();
    Object.assign(audio, { ready: true });
    const voices = audio.voice(), sfx = new PineHollowSfx(legacyDouble<Audio>({ voices }));
    const clip = { buffer: buffer(), offset: 0, duration: 1 };
    voices.register({ 'sample.test': { clips: () => [clip], policy: { jitter: 0 } } });
    expect(voices.play('sample.test', { at: { x: 200, y: 0, z: 0 } })).toBeUndefined();
    sfx.setListener(200, 0, 0, 0);
    expect(voices.sample([clip], { at: { x: 200, y: 0, z: 0 } }, { jitter: 0 })).toBeDefined();
    expect(nodes[1]?.gain.value).toBe(1);
    expect(voices.play('sample.test', { at: { x: 200, y: 0, z: 0 } })).toBeDefined();
    expect(nodes[4]?.gain.value).toBe(1);
    expect(voices.sample([clip], { at: { x: 360, y: 0, z: 0 } }, { reach: 220, scale: 10, power: 1.3, jitter: 0 })).toBeDefined();
    expect(nodes[7]?.gain.value).toBeCloseTo(1 / 17 ** 1.3);
    expect(voices.play('sample.test', { at: { x: 360, y: 0, z: 0 } })).toBeUndefined();
    sfx.setListener(0, 0, 0, 0);
    expect(voices.play('sample.test', { at: { x: 200, y: 0, z: 0 } })).toBeUndefined();
  });
});
