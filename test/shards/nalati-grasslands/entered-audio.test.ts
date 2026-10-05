// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../../../src/engine/app/app';
import { withOwner } from '../../../src/engine/app/ownership';
import { Audio } from '../../../src/engine/audio/Audio';
import { Music } from '../../../src/engine/audio/Music';
import type { AnimalManager } from '../../../src/engine/entities/AnimalManager';
import type { Player } from '../../../src/engine/player/Player';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { installEnteredRuntimeService, RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { shardContext } from '../../../src/game/shard/context';
import { emptyShardfileSource } from '../../../src/game/shardfile/loader';
import { emptyShardfile } from '../../../src/sdk/author';
import type { Wildlife } from '../../../src/shards/nalati-grasslands/creatures/wildlife';
import type { NalatiWeather } from '../../../src/shards/nalati-grasslands/world/installWeather';
import { wireSound } from '../../../src/shards/nalati-grasslands/runtime/audio/sound';

function fixturePort<T extends object>(fields: Partial<T>): T {
  return new Proxy(fields, { get(target, key) {
    if (!(key in target)) throw new Error(`Unused fixture port ${String(key)}`);
    return Reflect.get(target, key);
  } }) as T;
}

it('reinstalls real Nalati voices and score on two entries, restoring borrowed callbacks on the road', () => {
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
  const sound = wireSound({ boss: fixturePort({}), titan: fixturePort({}) },
    { player, weather: fixturePort<NalatiWeather>({}), scope: resident, on: hooks.context.on, debug: hooks.context.debug },
    (install) => { installEnteredRuntimeService(hooks.context, install); });
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
