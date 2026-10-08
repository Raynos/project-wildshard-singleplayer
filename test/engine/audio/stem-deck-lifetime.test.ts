import { describe, expect, it } from 'vitest';
import { Deck, type SlotAudio } from '../../../src/engine/audio/Stems';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';

class Param implements AudioParam {
  value = 0; automationRate: AutomationRate = 'a-rate'; defaultValue = 0; minValue = -Infinity; maxValue = Infinity;
  readonly ramps: number[][] = [];
  setTargetAtTime(value: number, _time: number, _constant: number): AudioParam { this.value = value; return this; }
  setValueAtTime(value: number, _time: number): AudioParam { this.value = value; return this; }
  linearRampToValueAtTime(value: number, time: number): AudioParam { this.ramps.push([value, time]); return this; }
  exponentialRampToValueAtTime(value: number, _time: number): AudioParam { this.value = value; return this; }
  setValueCurveAtTime(_values: Float32Array, _time: number, _duration: number): AudioParam { return this; }
  cancelScheduledValues(_time: number): AudioParam { return this; }
  cancelAndHoldAtTime(_time: number): AudioParam { return this; }
}
class Node extends EventTarget {
  channelCount = 2; channelCountMode: ChannelCountMode = 'max'; channelInterpretation: ChannelInterpretation = 'speakers';
  context = {} as BaseAudioContext; numberOfInputs = 1; numberOfOutputs = 1;
  detune = new Param(); playbackRate = new Param(); onended = null;
  gain = new Param(); buffer: AudioBuffer | null = null;
  loop = false; loopStart = 0; loopEnd = 0;
  readonly starts: number[][] = []; readonly stops: (number | undefined)[] = [];
  disconnected = false;
  connect(node: AudioNode, output?: number, input?: number): AudioNode;
  connect(node: AudioParam, output?: number): void;
  connect(node: AudioNode | AudioParam, _output?: number, _input?: number): AudioNode | void { if ('connect' in node) return node; }
  disconnect(): void { this.disconnected = true; }
  start(...args: number[]): void { this.starts.push(args); }
  stop(time?: number): void { this.stops.push(time); }
}
function fixture(state: AudioContextState = 'running') {
  const gains: Node[] = [], sources: Node[] = [], scope = new Scope('region');
  const ctx = Object.assign(new EventTarget(), {
    state, currentTime: 10,
    createGain: (): GainNode => { const n = new Node(); gains.push(n); return n as GainNode; },
    createBufferSource: (): AudioBufferSourceNode => { const n = new Node(); sources.push(n); return n as AudioBufferSourceNode; },
  });
  const audio: SlotAudio = {
    genre: 'piano', slot: 'calm', calm: { duration: 32 } as AudioBuffer,
    tension: { duration: 32 } as AudioBuffer, layers: [{ duration: 32 } as AudioBuffer],
    spec: { calm: 'calm.ogg', tension: 'tension.ogg', layers: ['bass.ogg'], phases: { 1: [0], 2: [1] },
      bpm: 120, beatsPerBar: 4, loopStart: 2, loopEnd: 30, duration: 32 },
  };
  const make = (): Deck => withOwner(scope, () => new Deck(ctx as BaseAudioContext, audio, new Node() as AudioNode, 10, 2));
  return { ctx, gains, sources, scope, audio, make };
}

describe('stem deck PCM lifetime', () => {
  it('keeps the running bar/crossfade schedule and releases all PCM on ended', () => {
    const f = fixture(), deck = f.make();
    expect(deck.nextBar(12.01)).toBe(14);
    expect(f.sources.map(s => s.starts)).toEqual([[[10, 0]], [[10, 0]], [[10, 0]]]);
    deck.fadeOut(14, 4);
    expect(f.gains[0]?.gain.ramps).toEqual([[1, 12], [0, 18]]);
    expect(f.sources.map(s => s.stops)).toEqual([[18.05], [18.05], [18.05]]);
    expect(deck.audio).toBe(f.audio);
    expect(f.sources.every(s => s.buffer !== null)).toBe(true);
    f.sources[0]?.dispatchEvent(new Event('ended'));
    expect(f.sources.every(s => s.buffer === null && s.disconnected)).toBe(true);
    expect(f.gains.every(g => g.disconnected)).toBe(true);
    expect(() => deck.audio).toThrow('retired');
    expect(deck.slot).toBe('calm');
    expect(deck.nextBar(12.01)).toBe(14);
    expect(f.scope.census.listeners).toBe(0);
    expect(f.scope.census.sounds).toBe(0);
    expect(f.scope.census.disposers).toBe(0);
    deck.dispose(); f.scope.dispose();
  });

  it('retires suspended tracks without waiting for a stopped audio clock', () => {
    const f = fixture('suspended');
    for (let i = 0; i < 8; i++) {
      const deck = f.make(); deck.fadeOut(14, 4); deck.fadeOut(14, 4); deck.dispose();
      expect(f.scope.census.listeners).toBe(0);
      expect(f.scope.census.sounds).toBe(0);
      expect(f.scope.census.disposers).toBe(0);
    }
    expect(f.sources.every(s => s.buffer === null && s.stops.length === 1)).toBe(true);
    f.scope.dispose();
  });

  it('releases a fading deck if the context suspends before its scheduled stop', () => {
    const f = fixture(), deck = f.make(); deck.fadeOut(14, 4);
    f.ctx.state = 'suspended'; f.ctx.dispatchEvent(new Event('statechange'));
    expect(f.sources.every(s => s.buffer === null)).toBe(true);
    expect(f.scope.census.listeners).toBe(0);
    f.scope.dispose();
  });

  it('owns playing sources in the deck child scope and releases them on region retirement', () => {
    const f = fixture(), deck = f.make();
    expect(f.scope.census.sounds).toBe(3);
    f.scope.dispose();
    expect(f.sources.every(s => s.buffer === null && s.stops.length === 1)).toBe(true);
    expect(() => deck.audio).toThrow('retired');
    expect(f.scope.census.listeners).toBe(0);
    deck.dispose();
  });
});
