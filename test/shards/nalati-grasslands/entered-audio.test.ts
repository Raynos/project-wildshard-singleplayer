// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Freeze the actual native call clock and RNG argument trace.
import { createHash } from 'node:crypto';
import { AmbienceZones } from '../../../src/engine/audio/ambience';
import { SteppeAmbience } from '../../../src/shards/nalati-grasslands/runtime/audio/SteppeAmbience';
import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../../../src/engine/app/app';
import { withOwner } from '../../../src/engine/app/ownership';
import { Audio } from '../../../src/engine/audio/Audio';
import { Music } from '../../../src/engine/audio/Music';
import type { AnimalManager } from '../../../src/engine/entities/AnimalManager';
import type { Player } from '../../../src/engine/player/Player';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { installEnteredRuntimeService, RetainedRuntimeHooks } from "../../../src/game/shard/retainedHooks";
import { shardContext } from "../../../src/game/plugin/context";
import { emptyShardfileSource } from '../../../src/game/plugin/ui';
import { emptyShardfile } from '../../../src/sdk/author';
import type { Wildlife } from '../../../src/shards/nalati-grasslands/creatures/wildlife';
import type { NalatiWeather } from '../../../src/shards/nalati-grasslands/world/installWeather';
import { parseAudioData } from '@wildshard/format/audio';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { runtimeAudio } from '../../../src/game/plugin/audio';
import { wireSound } from '../../../src/shards/nalati-grasslands/runtime/audio/sound';

function fixturePort<T extends object>(fields: Partial<T>): T {
  return new Proxy(fields, { get(target, key) {
    if (!(key in target)) throw new Error(`Unused fixture port ${String(key)}`);
    return Reflect.get(target, key);
  } }) as T;
}

it.each(['legacy', 'emitted'] as const)('reinstalls real Nalati voices and score on two entries through %s rows', (arm) => {
  const app = new App(), resident = app.engineScope.child('nalati.audio');
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 }));
  const installation = createLevelInstallation(app, resident, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const hooks = new RetainedRuntimeHooks(shardContext(installation.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } }));
  const audio = withOwner(resident, () => new Audio({ bed: 'road' })), music = withOwner(resident, () => new Music(audio));
  const roadHoof: NonNullable<Audio['hoofSurfaceAt']> = () => 'wood';
  const roadAnimal: NonNullable<AnimalManager['onSound']> = () => undefined;
  const roadWildlife: NonNullable<Wildlife['onSound']> = () => undefined;
  const animals = fixturePort<AnimalManager>({ animals: [], onSound: roadAnimal });
  const wildlife = fixturePort<Wildlife>({ onSound: roadWildlife });
  audio.hoofSurfaceAt = roadHoof;
  const player = fixturePort<Player>({ position: new Vector3(), yaw: 0 });
  const wire = JSON.stringify(source.audio), rows = parseAudioData(JSON.parse(wire));
  const sound = wireSound({ boss: fixturePort({}), titan: fixturePort({}) },
    { player, weather: fixturePort<NalatiWeather>({}), scope: resident, on: hooks.context.on, debug: hooks.context.debug },
    (install) => { installEnteredRuntimeService(hooks.context, install); }, arm === 'emitted' ? runtimeAudio({ game: { declaredAudio: rows } }, source.audio) : undefined);
  try {
    sound.bind(audio, music, animals, wildlife);
    let previousAmbience = sound.ambience;
    for (let visit = 0; visit < 2; visit++) {
      if (visit > 0) { hooks.activate(); expect(sound.ambience).not.toBe(previousAmbience); }
      expect(sound.voices).not.toBeNull(); expect(sound.ambience).not.toBeNull(); expect(music.scoreId).toBe('score.nalati');
      expect(audio.hoofSurfaceAt).not.toBe(roadHoof); expect(animals.onSound).not.toBe(roadAnimal); expect(wildlife.onSound).not.toBe(roadWildlife);
      previousAmbience = sound.ambience; hooks.deactivate();
      expect(sound.voices).toBeNull(); expect(sound.ambience).toBeNull(); expect(music.scoreId).toBeUndefined();
      expect(audio.hoofSurfaceAt).toBe(roadHoof); expect(audio.bedId).toBe('road');
      expect(animals.onSound).toBe(roadAnimal); expect(wildlife.onSound).toBe(roadWildlife);
    }
  } finally { app.engineScope.dispose(); audio.dispose(); }
  expect(resident.census.disposers).toBe(0);
});

it('preserves emitted steppe mix/call clocks and RNG, and consumes the declared zone hold', () => {
  function trace(emitted: boolean, changed = false) {
    const wire = JSON.stringify(source.audio), rows = parseAudioData(JSON.parse(wire));
    if (changed) {
      if (rows.zones === undefined) throw new Error('Missing declared steppe zones');
      rows.zones.smoothSeconds = 0.19; rows.zones.levels['river'] = 0.123;
    }
    const calls: unknown[][] = [], levels: unknown[][] = [], zones: string[] = [];
    const mix = vi.spyOn(AmbienceZones.prototype, 'mix').mockImplementation((def, _sample, level, tau) => { levels.push([def.id, level, tau]); });
    let tick = 0;
    const audio = fixturePort<Audio>({ ready: true, ctx: fixturePort<AudioContext>({ currentTime: 0 }), loop: () => undefined, restartSynthBed: () => undefined,
      animal: (name, at, listener, yaw) => { calls.push([tick, name, at.x, at.y, at.z, listener.x, listener.y, listener.z, yaw]); } });
    const sample = { buffer: fixturePort<AudioBuffer>({ duration: 1 }), gain: 1, loopStart: 0, loopEnd: 1 };
    Object.defineProperty(audio, 'loop', { value: () => sample });
    const amb = new SteppeAmbience(audio, emitted ? rows.zones : undefined);
    amb.onZone = zone => { zones.push(zone); };
    try {
      for (; tick < 6000; tick++) {
        const phase = Math.floor(tick / 1000) % 3;
        amb.set({ zones: phase === 0 ? [1, 0, 0] : phase === 1 ? [0, 1, 0] : [0, 0, 1],
          river: 0.6, melt: 0.2, camp: 0.4, night: 0, wind: 5, gust: 0.3, out: 1, pan: { river: 0.2, camp: 0.1, melt: -0.1 } });
        amb.update(1 / 30, { x: 12, y: 3, z: -7 }, 0.3);
      }
      expect(calls.length).toBeGreaterThan(5);
      return { calls, levels, zones, diag: { ...amb.diag } };
    } finally { amb.dispose(); mix.mockRestore(); }
  }
  const emitted = trace(true), legacy = trace(false);
  expect(emitted.levels).toEqual(legacy.levels); expect(emitted.zones).toEqual(legacy.zones);
  // Captured from the native owner at 5cc0b17bf before emitted bed adoption.
  expect(createHash('sha256').update(JSON.stringify({ emitted: emitted.calls, legacy: legacy.calls })).digest('hex')).toBe('7d978f55742f4d899820e3e1c7b1992ccde0cea48e6c375386c758493e81b53e');
  const changed = trace(true, true);
  expect(changed.levels.find(row => row[0] === 'river')).toEqual(['river', 0.123 * 0.6, 0.19]);
  const wire = JSON.stringify(source.audio), rows = parseAudioData(JSON.parse(wire));
  if (rows.zones === undefined) throw new Error('Missing declared steppe zones');
  rows.zones.holdSeconds = 0.2;
  const audio = new Audio(), amb = new SteppeAmbience(audio, rows.zones);
  try {
    const place = { river: 0, melt: 0, camp: 0, night: 0, wind: 5, gust: 0, out: 1, pan: { river: 0, camp: 0, melt: 0 } };
    amb.set({ ...place, zones: [1, 0, 0] }); amb.set({ ...place, zones: [0, 0, 1] });
    amb.update(0.19, { x: 0, y: 0, z: 0 }, 0); expect(amb.zone).toBe('grass');
    amb.update(0.02, { x: 0, y: 0, z: 0 }, 0); expect(amb.zone).toBe('snow');
  } finally { amb.dispose(); audio.dispose(); }
});

it('refuses missing emitted steppe geometry before allocating listeners or native voices', () => {
  const wire = JSON.stringify(source.audio), rows = parseAudioData(JSON.parse(wire));
  if (rows.zones === undefined) throw new Error('Missing declared steppe zones');
  rows.zones.zones = rows.zones.zones.filter(zone => zone.id !== 'camp');
  const on = vi.fn(() => undefined), debug = fixturePort<NonNullable<Parameters<typeof wireSound>[1]['debug']>>({});
  const app = new App(), scope = app.engineScope.child('steppe.preflight');
  try {
    expect(() => wireSound({ boss: fixturePort({}), titan: fixturePort({}) },
      { player: fixturePort<Player>({}), weather: fixturePort<NalatiWeather>({}), scope, on, debug }, undefined, rows)).toThrow('Missing declared audio profile: camp');
    expect(on).not.toHaveBeenCalled(); expect(scope.census.disposers).toBe(0);
  } finally { app.engineScope.dispose(); }
});
