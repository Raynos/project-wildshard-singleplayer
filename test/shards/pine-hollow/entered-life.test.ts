// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { SkinnedMesh, MeshStandardMaterial, PerspectiveCamera, Scene, Vector3 } from 'three';
import { App } from '../../../src/engine/app/app';
import { app as pageApp } from '../../../src/engine/app/runtime';
import { withOwner } from '../../../src/engine/app/ownership';
import type { Audio } from '../../../src/engine/audio/Audio';
import type { EquipmentService } from '../../../src/engine/combat/EquipmentService';
import type { Game } from '../../../src/engine/core/Game';
import type { Animal } from '../../../src/engine/entities/AnimalView';
import type { AnimalManager } from '../../../src/engine/entities/AnimalManager';
import type { Player } from '../../../src/engine/player/Player';
import type { SkyRig } from '../../../src/engine/world/skyRig';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { shardContext } from '../../../src/game/shard/context';
import { RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { emptyShardfileSource } from '../../../src/game/shardfile/loader';
import { emptyShardfile } from '../../../src/sdk/author';
import { installPineLife } from '../../../src/shards/pine-hollow/life/index';
import type { PineHollowSfx } from '../../../src/shards/pine-hollow/runtime/audio/sfx';
import { legacyDouble } from '../../fake/FakeGame';

it('cancels the actual skinning beat without a road reward, hides its knife and resumes the resident wildlife on re-entry', () => {
  const app = new App(), scope = app.engineScope.child('pine.life');
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 }));
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const hooks = new RetainedRuntimeHooks(shardContext(installation.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } }));
  const camera = new PerspectiveCamera(); camera.position.set(0, 1.7, 0);
  const scene = new Scene(), sky = legacyDouble<SkyRig>({ setupMaterial: () => undefined, dayNight: null });
  const game = legacyDouble<Game>({ app, levelScope: scope, playerScope: scope, scene, camera, onUpdate: () => undefined, onPlayerUpdate: () => undefined });
  const weapons = legacyDouble<EquipmentService>({ enabled: true, visible: true, setEnabled: (enabled) => { weapons.enabled = enabled; } });
  const player = legacyDouble<Player>({ position: new Vector3(), swimming: false, sprinting: false, yaw: 0 });
  const mesh = new SkinnedMesh(undefined, new MeshStandardMaterial());
  const carcass = legacyDouble<Animal>({ kind: 'deer', alive: false, hidden: false, position: new Vector3(0, 0, -2), mesh, fadeOut: () => undefined });
  let rewards = 0, cancelled = 0;
  const harvested = new Set<Animal>();
  const clock = pageApp.clock.snapshot();
  try {
    const life = withOwner(scope, () => installPineLife({ ctx: hooks.context, game, sky, player, weapons,
      animals: legacyDouble<AnimalManager>({ animals: [carcass] }), audio: legacyDouble<Audio>({ footstep: () => undefined }),
      trees: [], trunks: [], places: null, visited: () => false, inCombat: () => false, params: new URLSearchParams(),
      sfx: legacyDouble<PineHollowSfx>({ shot: () => true }),
    }));
    if (life === null) throw new Error('Life fixture unexpectedly disabled');
    const step = (dt: number) => { for (const system of app.systemsByPhase().update) system.run(dt, 0); };
    for (let entry = 0; entry < 2; entry++) {
      if (entry > 0) hooks.activate();
      expect(weapons.enabled).toBe(true); expect(weapons.visible).toBe(true);
      const original = { pitch: camera.rotation.x, y: camera.position.y };
      harvested.add(carcass);
      life.harvest(carcass, () => { rewards++; }, () => { harvested.delete(carcass); cancelled++; }); step(0.2);
      expect(Reflect.get(window, '__pineLife')).toMatchObject({ carcasses: [{ visit: 'waiting' }] });
      expect(life.busy).toBe(true); expect(camera.position.y).toBeLessThan(original.y);
      expect(camera.getObjectByName('skin-knife')?.visible).toBe(true);
      hooks.deactivate(); expect(life.busy).toBe(false);
      expect(harvested.has(carcass)).toBe(false); expect(cancelled).toBe(entry + 1);
      expect(mesh.material.color.getHex()).toBe(0xffffff);
      expect(camera.rotation.x).toBeCloseTo(original.pitch); expect(camera.position.y).toBeCloseTo(original.y);
      expect(camera.getObjectByName('skin-knife')?.visible).toBe(false);
      expect(weapons.visible).toBe(false); // the border owns stow; cancellation must not reveal a shard weapon on the road
      const frozen = Array.from(life.mesh.instanceMatrix.array);
      for (let held = 0; held < 600; held++) { pageApp.clock.tick(1 / 60); step(1 / 60); }
      expect(rewards).toBe(0); expect(Array.from(life.mesh.instanceMatrix.array)).toEqual(frozen);
      expect(app.systemIds(scope)).toEqual([]);
    }
    hooks.activate();
    harvested.add(carcass);
    life.harvest(carcass, () => { rewards++; }, () => { harvested.delete(carcass); cancelled++; });
    for (let frame = 0; frame < 120; frame++) step(1 / 60);
    expect(Reflect.get(window, '__pineLife')).toMatchObject({ carcasses: [{ visit: 'waiting' }] });
    expect(life.busy).toBe(false); expect(rewards).toBe(1); expect(cancelled).toBe(2);
    expect(harvested.has(carcass)).toBe(true);
    hooks.deactivate();
    for (let frame = 0; frame < 600; frame++) step(1 / 60);
    expect(rewards).toBe(1); expect(cancelled).toBe(2);
  } finally { app.engineScope.dispose(); pageApp.clock.restore(clock); mesh.geometry.dispose(); mesh.material.dispose(); }
  expect(scope.census).toMatchObject({ listeners: 0, timers: 0, disposers: 0, meshes: 0 });
});
