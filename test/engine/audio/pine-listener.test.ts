import { describe, expect, it } from 'vitest';
import { VoicePool } from '#engine/audio/Voices';
import type { AudioMixer } from '#engine/audio/levelAudio';

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

// Pine's sampled bank owns its ear. Nearby samples must not wake a distant procedural quest glyph.
describe('independent content listener', () => {
  it('places the sample at its own ear while preserving the procedural listener', () => {
    const {audio,nodes} = fake();
    Object.assign(audio,{ready:true});
    const voices = audio.voice();
    const clip = {buffer:buffer(),offset:0,duration:1};
    voices.register({'sample.test':{clips:()=>[clip],policy:{jitter:0}}});
    expect(voices.sample([clip],{at:{x:200,y:0,z:0},listener:{x:200,y:0,z:0,yaw:0}},{jitter:0,cutoffScale:Infinity})).toBeDefined();
    expect(nodes[1]?.gain.value).toBe(1);
    expect(nodes[0]?.starts).toEqual([[10,0,1]]);
    expect(voices.play('sample.test',{at:{x:200,y:0,z:0}})).toBeUndefined();
    expect(voices.play('ui-glyph',{at:{x:200,y:0,z:0}})).toBeUndefined();
    expect(nodes[0]?.starts).toHaveLength(1);
  });
});
