// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { PerspectiveCamera } from 'three';
import type { Game } from '../../../src/engine/core/Game';
import type { AnimalManager } from '../../../src/engine/entities/AnimalManager';
import type { SkyRig } from '../../../src/engine/world/skyRig';
import { App } from '../../../src/engine/app/app';
import { withOwner } from '../../../src/engine/app/ownership';
import { Audio } from '../../../src/engine/audio/Audio';
import { Music } from '../../../src/engine/audio/Music';
import type { Voices } from '../../../src/engine/audio/Voices';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { shardContext } from '../../../src/game/shard/context';
import { RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { emptyShardfileSource } from '../../../src/game/shardfile/loader';
import { emptyShardfile } from '../../../src/sdk/author';
import { ForestAmbience } from '../../../src/shards/pine-hollow/runtime/audio/ambience';
import { PineHollowSfx, type PhLoop } from '../../../src/shards/pine-hollow/runtime/audio/sfx';
import { installPineAudio, type PineAudioHost } from '../../../src/shards/pine-hollow/runtime/audio/wiring';
import { legacyDouble } from '../../fake/FakeGame';

function param(value = 0): AudioParam {
  const result: AudioParam = legacyDouble<AudioParam>({ value,
    cancelScheduledValues: () => result,
    setValueAtTime: (next) => { result.value = next; return result; },
    setTargetAtTime: (next) => { result.value = next; return result; },
  });
  return result;
}

function graph() {
  const gains: GainNode[] = [], sources: AudioBufferSourceNode[] = [];
  const disconnected = new Set<GainNode>();
  const stops: (() => void)[] = [];
  function connect(node: AudioNode, output?: number, input?: number): AudioNode;
  function connect(node: AudioParam, output?: number): void;
  function connect(node: AudioNode | AudioParam, _output?: number, _input?: number): AudioNode | void {
    if ('connect' in node) return node;
  }
  const wiring = { connect, disconnect: () => undefined };
  const gain = (): GainNode => {
    const node: GainNode = legacyDouble<GainNode>({ ...wiring, gain: param(), disconnect: () => { disconnected.add(node); } }); gains.push(node); return node;
  };
  const sample = legacyDouble<AudioBuffer>({ duration: 1 });
  const ctx = legacyDouble<AudioContext>({ currentTime: 10,
    listener: legacyDouble<AudioListener>({ forwardX: param(), forwardZ: param(-1) }),
    createGain: gain,
    createBiquadFilter: () => legacyDouble<BiquadFilterNode>({ ...wiring, frequency: param(), Q: param(), type: 'lowpass' }),
    createStereoPanner: () => legacyDouble<StereoPannerNode>({ ...wiring, pan: param() }),
    createConvolver: () => legacyDouble<ConvolverNode>({ ...wiring, buffer: null, normalize: false }),
    createBufferSource: () => {
      const events = new EventTarget();
      const stop = vi.fn(() => { events.dispatchEvent(new Event('ended')); }); stops.push(stop);
      const node = legacyDouble<AudioBufferSourceNode>({ ...wiring, buffer: null, loop: false, loopStart: 0, loopEnd: 0,
        start: () => undefined, stop,
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
      });
      sources.push(node); return node;
    },
  });
  let shade = { level: 0.7, cutoff: 9000 };
  const audio = legacyDouble<Audio>({ ready: true, ctx, world: gain(), sfx: gain(),
    voices: legacyDouble<Voices>({ prewarm: () => undefined, buffer: () => sample, setListener: () => undefined }),
    get ambientShade() { return shade; }, shadeAmbient: (level, cutoff: number | undefined) => { shade = { level, cutoff: cutoff ?? 20000 }; },
  });
  return { audio, gains, sources, sample, disconnected, stops };
}

it('drops actual beds, reverb sends and timers on both exits and refuses a late bed decode from the departed entry', async () => {
  vi.useFakeTimers();
  const app = new App(), scope = app.engineScope.child('pine.ambience');
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 }));
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const hooks = new RetainedRuntimeHooks(shardContext(installation.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } }));
  const g = graph(), musicAudio = withOwner(scope, () => new Audio()), music = withOwner(scope, () => new Music(musicAudio));
  const camera = new PerspectiveCamera(); camera.position.set(0, 2, 0); camera.updateMatrixWorld();
  const amb = new ForestAmbience(g.audio, { heightAt: () => 0, scope });
  const doors = new Set<Parameters<NonNullable<PineAudioHost['cabins']>['onDoor']>[0]>();
  const previous = Object.getOwnPropertyDescriptor(window, '__pineAudio');
  const diagnostic = { borrowed: true }; Object.defineProperty(window, '__pineAudio', { configurable: true, value: diagnostic, writable: true });
  let resolveLoop: ((loop: PhLoop) => void) | undefined;
  const pending = new Promise<PhLoop>((resolve) => { resolveLoop = resolve; });
  vi.spyOn(PineHollowSfx.prototype, 'available', 'get').mockReturnValue(true);
  const decode = vi.spyOn(PineHollowSfx.prototype, 'bed').mockReturnValue(pending);
  try {
    installPineAudio({ context: hooks.context, audio: g.audio,
      game: legacyDouble<Game>({ app, levelScope: scope, camera }), sky: legacyDouble<SkyRig>({ dayNight: null }),
      animals: legacyDouble<AnimalManager>({ animals: [] }), music, ambience: amb, params: new URLSearchParams(),
      eliteEngaged: () => false, cabins: { interactables: [], wheelSpeed: 0, onDoor: (fn) => { doors.add(fn); return () => { doors.delete(fn); }; } },
    });
    amb.update(0.2, camera); expect(decode).toHaveBeenCalled(); expect(scope.census.timers).toBe(1);
    expect(g.gains.some((node) => node.gain.value > 0)).toBe(true);
    hooks.deactivate(); expect(doors.size).toBe(0); expect(app.systemIds(scope)).toEqual([]);
    expect(scope.census.timers).toBe(0); expect(g.audio.ambientShade).toEqual({ level: 0.7, cutoff: 9000 });
    expect(Object.getOwnPropertyDescriptor(window, '__pineAudio')?.value).toBe(diagnostic);
    if (resolveLoop === undefined) throw new Error('Missing pending decoder');
    const loop: PhLoop = { buffer: g.sample, gain: 1, loopStart: 0, loopEnd: 1, zone: undefined, live: true };
    resolveLoop(loop); await pending; await Promise.resolve(); expect(g.sources).toEqual([]);
    decode.mockResolvedValue(loop);
    hooks.activate(); expect(doors.size).toBe(1);
    amb.update(0.2, camera); await Promise.resolve(); expect(g.sources.length).toBeGreaterThan(0);
    expect(g.gains.some((node) => node.gain.value > 0)).toBe(true);
    hooks.deactivate();
    for (const stop of g.stops) expect(stop).toHaveBeenCalledOnce();
    expect(g.gains.every((node) => node.gain.value === 0 || g.disconnected.has(node))).toBe(true);
    expect(amb.diag.beds).toEqual([]); expect(Object.values(amb.diag.sends)).toEqual([0, 0, 0, 0]);
    expect(g.audio.ambientShade).toEqual({ level: 0.7, cutoff: 9000 });
    expect(scope.census).toMatchObject({ timers: 0, sounds: 0 });
    const stoppedCount = g.sources.length, decodeCount = decode.mock.calls.length;
    vi.advanceTimersByTime(60000);
    for (let tick = 0; tick < 600; tick++) amb.update(1 / 60, camera);
    expect(g.sources).toHaveLength(stoppedCount); expect(decode).toHaveBeenCalledTimes(decodeCount); expect(doors.size).toBe(0);
  } finally {
    amb.dispose(); app.engineScope.dispose(); musicAudio.dispose(); vi.useRealTimers(); vi.restoreAllMocks();
    if (previous === undefined) Reflect.deleteProperty(window, '__pineAudio'); else Object.defineProperty(window, '__pineAudio', previous);
  }
});

it('reads a borrowed Audio shade without allocating its graph', () => {
  const audio = new Audio();
  try { expect(audio.ready).toBe(false); expect(audio.ambientShade).toEqual({ level: 1, cutoff: 20000 }); expect(audio.ready).toBe(false); }
  finally { audio.dispose(); }
});
