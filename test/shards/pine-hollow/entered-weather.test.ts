// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene, Vector2, Vector3 } from 'three';
import { App } from '../../../src/engine/app/app';
import type { Game } from '../../../src/engine/core/Game';
import type { AnimalManager } from '../../../src/engine/entities/AnimalManager';
import type { SkyRig } from '../../../src/engine/world/skyRig';
import { fogUniforms, weatherUniforms, volumetricFog } from '../../../src/engine/world/Atmosphere';
import { waterWeather } from '../../../src/engine/world/waterSurface';
import { windBoost } from '../../../src/engine/world/wind';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { shardContext } from '../../../src/game/shard/context';
import { RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { emptyShardfileSource } from '../../../src/game/shardfile/loader';
import { emptyShardfile } from '../../../src/sdk/author';
import * as backdrop from '../../../src/shards/pine-hollow/look/skyBackdrop';
import { installWeather } from '../../../src/shards/pine-hollow/world/weather';
import { RainFx } from '../../../src/game/systems/looks/rainFx';
import { AMMO_ROWS } from '../../../src/shards/pine-hollow/loadout/effects';
import { legacyDouble } from '../../fake/FakeGame';

it('freezes the same rain state on the road and restores every borrowed weather uniform and answerer on two exits', () => {
  const app = new App(), scope = app.engineScope.child('pine.weather'); app.levelScope = scope;
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 }));
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const hooks = new RetainedRuntimeHooks(shardContext(installation.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } }));
  const before = app.events.census(), veil = { value: new Vector2(0.1, 0.2) };
  const sky = legacyDouble<SkyRig>({}), camera = new PerspectiveCamera(), scene = new Scene();
  const mod = { overcast: 0.2, fogDist: 1.1, fogHeight: 1.2, mist: 0.3 };
  vi.spyOn(backdrop, 'pineBackdrop').mockReturnValue(legacyDouble<backdrop.PineSkyBackdrop>({ mod,
    clock: legacyDouble<backdrop.PineSkyBackdrop['clock']>({ phase: 0.42 }),
  }));
  // The production weather loop and shared uniforms run; this fixture needs no GPU rain geometry.
  vi.spyOn(RainFx.prototype, 'build').mockImplementation(function buildWithoutGpu(this: RainFx) { return this; });
  vi.spyOn(RainFx.prototype, 'update').mockImplementation(() => undefined);
  const read = () => ({ height: fogUniforms.fogHeight.value, falloff: fogUniforms.fogHeightFalloff.value,
    wet: weatherUniforms.uWet.value, blob: weatherUniforms.fogBlob.value.toArray(), amount: weatherUniforms.fogBlobAmt.value,
    rain: waterWeather.uRainRings.value, wind: windBoost.value, mod: { ...mod }, veil: veil.value.toArray(),
    volumeHeight: volumetricFog.height, volumeFalloff: volumetricFog.falloff,
  });
  const borrowed = read(), ammo = AMMO_ROWS.find((row) => row.wet !== undefined);
  if (ammo === undefined) throw new Error('Missing authored wet ammo');
  const shot = { ammo, gravity: 10, drag: 2 };
  try {
    const rig = installWeather(hooks.context, { game: legacyDouble<Game>({ app, levelScope: scope, scene, camera }), sky,
      animals: legacyDouble<AnimalManager>({ animals: [], herds: [] }), trees: [], particles: null, ambience: null,
      roofAt: () => false, stagAt: () => null, viewer: () => new Vector3(), horizonVeil: veil,
    });
    if (rig === null) throw new Error('Missing clocked weather');
    rig.weather.force('rain', 0.5); rig.weather.hold = false;
    const tick = () => { for (const system of app.systemsByPhase().update) system.run(1 / 60, 0); };
    for (let entry = 0; entry < 2; entry++) {
      if (entry > 0) hooks.activate();
      tick(); expect(weatherUniforms.uWet.value).toBeGreaterThan(0.5);
      expect(app.events.ask('projectile.modify', shot).gravity).toBeGreaterThan(shot.gravity);
      hooks.deactivate(); expect(rig.fx.group.visible).toBe(false); expect(read()).toEqual(borrowed);
      const state = { t: rig.weather.phaseT, rain: rig.weather.rain, wet: rig.weather.wet };
      for (let held = 0; held < 600; held++) tick();
      expect({ t: rig.weather.phaseT, rain: rig.weather.rain, wet: rig.weather.wet }).toEqual(state);
      expect(app.events.ask('projectile.modify', shot)).toBe(shot);
      expect(app.events.census()).toEqual(before); expect(app.systemIds(scope)).toEqual([]);
    }
  } finally { app.engineScope.dispose(); vi.restoreAllMocks(); }
  expect(scope.census).toMatchObject({ listeners: 0, timers: 0, disposers: 0 });
});
