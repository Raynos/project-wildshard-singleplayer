import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../../src/engine/app/scope';
import { PositionalLoops } from '../../src/engine/audio/AmbienceBeds';
import { AmbienceZones } from '../../src/engine/audio/ambience';
import type { AudioMixer } from '../../src/engine/audio/levelAudio';

/** Enforce the browser's one non-null buffer assignment and start-before-stop rules. */
class StrictSource extends EventTarget {
  private assigned: AudioBuffer | null = null;
  assignments = 0;
  starts: number[][] = [];
  stops = 0;
  disconnected = false;
  failStart = false;
  loop = false; loopStart = 0; loopEnd = 0;
  get buffer(): AudioBuffer | null { return this.assigned; }
  set buffer(value: AudioBuffer | null) {
    if (value !== null && this.assigned !== null) throw new DOMException('buffer already assigned', 'InvalidStateError');
    this.assigned = value; this.assignments++;
  }
  connect(node: AudioNode, output?: number, input?: number): AudioNode;
  connect(node: AudioParam, output?: number): void;
  connect(node: AudioNode | AudioParam, _output?: number, _input?: number): AudioNode | void { if ('connect' in node) return node; }
  disconnect(): void { this.disconnected = true; }
  start(...args: number[]): void {
    if (this.failStart) throw new DOMException('start failed', 'InvalidStateError');
    this.starts.push(args);
  }
  stop(): void {
    if (this.starts.length === 0) throw new DOMException('stop before start', 'InvalidStateError');
    this.stops++;
  }
}
function fake<T extends object>(fields: Partial<T>): T {
  return new Proxy(fields, { get: (target, key) => Reflect.get(target, key) }) as T;
}
function fixture(failStart = false) {
  const sources: StrictSource[] = [], nodes: { disconnected: boolean }[] = [], scope = new Scope('positional-loops');
  const graph = (): GainNode & StereoPannerNode => {
    const state = { disconnected: false }; nodes.push(state);
    const param: AudioParam = fake<AudioParam>({ value: 0, setTargetAtTime: (): AudioParam => param });
    const wiring = new StrictSource();
    return fake<GainNode & StereoPannerNode>({ gain: param, pan: param, connect: wiring.connect.bind(wiring),
      disconnect: (): void => { state.disconnected = true; } });
  };
  const ctx = fake<BaseAudioContext>({ currentTime: 10, createGain: graph, createStereoPanner: graph, createBufferSource: () => {
    const source = new StrictSource(); source.failStart = failStart; sources.push(source);
    return fake<AudioBufferSourceNode>({ get buffer() { return source.buffer; }, set buffer(value) { source.buffer = value; },
      get loop() { return source.loop; }, set loop(value) { source.loop = value; },
      get loopStart() { return source.loopStart; }, set loopStart(value) { source.loopStart = value; },
      get loopEnd() { return source.loopEnd; }, set loopEnd(value) { source.loopEnd = value; },
      connect: source.connect.bind(source), disconnect: source.disconnect.bind(source),
      start: source.start.bind(source), stop: source.stop.bind(source),
      addEventListener: source.addEventListener.bind(source), removeEventListener: source.removeEventListener.bind(source) });
  } });
  const audio = fake<AudioMixer>({ ready: true, ctx, bus: () => fake<GainNode>({}) });
  const sample = { buffer: fake<AudioBuffer>({ duration: 20 }), loopStart: 2, loopEnd: 8, gain: 0.5 };
  return { loops: new PositionalLoops(audio, scope, [new Vector3(1, 0, 0)], () => sample,
    () => { /* Observe source lifecycle only. */ }, () => 0.5), scope, sources, nodes, audio, sample };
}

describe('positional loop source lifecycle', () => {
  it('assigns each buffer once, preserves loop offset, and safely unloads after a voice leaves range', () => {
    const { loops, scope, sources, nodes } = fixture();
    loops.update(new Vector3(), 0);
    expect(sources[0]?.assignments).toBe(1);
    expect(sources[0]?.starts).toEqual([[10, 5]]);
    expect(sources[0]).toMatchObject({ loop: true, loopStart: 2, loopEnd: 8 });
    expect(scope.census.sounds).toBe(1);
    loops.update(new Vector3(30, 0, 0), 0);
    expect(sources[0]?.stops).toBe(1);
    loops.update(new Vector3(), 0);
    expect(() => { scope.dispose(); scope.dispose(); }).not.toThrow();
    expect(sources.map((source) => source.stops)).toEqual([1, 1]);
    expect(sources.every((source) => source.disconnected)).toBe(true);
    expect(nodes.every((node) => node.disconnected)).toBe(true);
    expect(loops.count).toBe(0); expect(scope.census.sounds).toBe(0);
  });
  it('disconnects a failed start immediately without stopping an unstarted source or retaining a disposer', () => {
    const { loops, scope, sources, nodes } = fixture(true);
    const before = scope.census;
    expect(() => { loops.update(new Vector3(), 0); }).toThrow('start failed');
    expect(sources[0]?.stops).toBe(0);
    expect(sources[0]?.disconnected).toBe(true);
    expect(nodes.every((node) => node.disconnected)).toBe(true);
    expect(scope.census).toEqual(before); expect(loops.count).toBe(0);
    expect(() => { scope.dispose(); scope.dispose(); }).not.toThrow();
  });
  it('releases a failed zone start and its scaling node without stop-before-start on later unload', () => {
    const { audio, scope, sample, sources, nodes } = fixture(true);
    const zones = new AmbienceZones(audio, () => 0.5, scope);
    const before = scope.census;
    expect(() => { zones.start({ id: 'bed', started: () => { /* Must not be reached. */ } }, sample, 10, 0.5); }).toThrow('start failed');
    expect(scope.census.sounds).toBe(0);
    expect(scope.census).toEqual(before);
    expect(sources[0]?.stops).toBe(0); expect(sources[0]?.disconnected).toBe(true);
    expect(nodes.at(-1)?.disconnected).toBe(true);
    expect(() => { scope.dispose(); scope.dispose(); zones.dispose(); }).not.toThrow();
    expect(nodes.every((node) => node.disconnected)).toBe(true);
  });
});
