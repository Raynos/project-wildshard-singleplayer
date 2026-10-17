import { afterEach, expect, test, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene, Vector3 } from 'three';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import type { PainterField, SkyBackdropContext, WorldLookContext } from '../src/engine/render/look';
import type { Terrain } from '../src/engine/world/Terrain';
import * as geometry from '../src/engine/models/ownedGeometry';
import { ToonLook } from '../src/engine/render/families/toon';
import { TOON_DAY_PRESET, ToonDaySchema, parseToonLook } from '../src/format/toonLook';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import * as materials from '../src/game/shardfile/runtimeProduct';
import * as sky from '../src/game/looks/graphDaySky';
import { toonLook, toonLookState } from '../src/game/looks/toonLook';
import { dayClock } from '../src/game/looks/dayClock';
import DRIFTWOOD_SKY_DAY from '../src/shards/driftwood-isle/data/skyDay.json' with { type: 'json' };

// A fictional chalk coast supplies its own graph names, files, puff positions, fog and lighting.
// Its admission/build runs the real host; only GPU/file decoder seams are observed.
function fixture() {
  const day = v.parse(ToonDaySchema, {
    dayFraction: .7, start: .3, schedule: [{ phase: 'day', from: 0, to: .7, minutes: 12 }, { phase: 'night', from: .7, to: 1, minutes: 4 }],
    presets: { chalk: { sky: { zenith: [.2, .4, .6], horizon: [.5, .6, .7], below: [.1, .2, .3], sunGlow: [1, .9, .8], cloudLit: [.8, .8, .9], cloudShade: [.2, .3, .4], night: .1 },
      light: [1, .9, .8], lightI: 2, hemiSky: [.4, .5, .6], hemiGround: [.2, .1, .1], hemiI: .7,
      lift: [.1, .2, .3], rim: [.4, .3, .2], fogNear: [.5, .6, .7], fogSun: [.8, .7, .6], disc: [1, .8, .7], cloudShadow: .3, dusk: .2 } },
    frames: [[0, 'chalk'], [1, 'chalk']], fixed: { midday: .3, golden: .6, sunset: .7, night: .85 }, namedPhases: { dawn: 0, noon: .3, dusk: .7, night: .85 },
    sun: { rise: 80, sweep: 180, noon: 60, nightRise: 260, nightSweep: 180, nadir: 50 }, moon: { rise: 60, sweep: 160, base: 20, arc: 50 },
    night: { rise: [.7, .8], fall: [.95, 1] }, fade: { sunY: [0, .1], moonIn: [.7, .8], moonOut: [.95, 1] },
    shadowStepDeg: .5, envRefresh: 5, envSize: 32, startSun: [1, 1, 0], planetHaze: [.2, .3, .4], planetHazeDay: .2, moonDisc: .3, sunIBase: 2,
  });
  return parseToonLook({ id: 'chalk-toon', lighting: { id: 'chalk-light', initial: { uToonLift: [.12, .2, .3], uToonRim: [.3, .2, .1], uCloudShadow: .4, uToonNight: 0, uSeaLevel: -20, uCloudTime: 7 } },
    fog: { start: 40, end: 900, near: [.1, .2, .3], zenith: [.4, .5, .6], order: 250 },
    shadows: { rig: 'tier', normalBias: .05, radius: .3 },
    ground: { materials: { ground: 'chalk-ground', slab: 'chalk-slab' }, files: { ground: 'models/chalk.glb', slab: 'models/walls.glb' }, kit: {} },
    sky: { day: { ...day, envRefresh: 5, envSize: 32 }, cycleSeconds: 600, name: 'chalk-sky', channels: 'chalk.channels',
      dome: { look: 'chalk-dome', radius: 1500, segments: [24, 12], order: -30 }, clouds: { look: 'chalk-clouds', order: -25, puffs: [[2, 100, 4, 12, .1, .2, 80]] },
      midday: { zenith: [.4, .5, .6], horizon: [.2, .3, .4], cloudLit: [.7, .8, .9], sunGlow: [1, .8, .6] }, environment: { near: 2, far: 2000 }, crisp: .8 },
  });
}
function product(row = fixture()) {
  return createShardProduct({ slug: 'chalk-coast', revision: 1,
    shardfile: emptyShardfile({ slug: 'chalk-coast', name: 'Chalk', author: 'Fixture', revision: 1, seed: 2 }),
    sections: new Map([['look/toon', row]]),
    files: new Map(Object.values(row.ground.files).map(file => [file, { hash: file, url: `/chalk/${file}` }])),
    read: () => Promise.resolve(new Uint8Array([1, 2, 3])),
  });
}
const scopes: Scope[] = [];
afterEach(() => { for (const scope of scopes) scope.dispose(); scopes.length = 0; vi.restoreAllMocks(); });

test('rejects executable look rows and missing or unsorted day keys', () => {
  const row = fixture();
  expect(() => parseToonLook({ ...row, update: () => undefined })).toThrow('plain JSON');
  expect(() => parseToonLook({ ...row, sky: { ...row.sky, day: { ...row.sky.day, frames: [[.8, 'midday'], [.2, 'missing']] } } })).toThrow('frame');
  expect(() => parseToonLook({ ...row, ground: { ...row.ground, files: { ground: '', slab: 'ok' } } })).toThrow();
});

test('the data clock preserves shipping sky curves at all 1001 day/night phases', () => {
  const original = dayClock(TOON_DAY_PRESET, DRIFTWOOD_SKY_DAY, { dusk: 'dusk' });
  const admitted = dayClock(TOON_DAY_PRESET, v.parse(ToonDaySchema, DRIFTWOOD_SKY_DAY), { dusk: 'dusk' });
  for (let i = 0; i <= 1000; i++) {
    const p = i / 1000;
    expect(admitted.sunAt(p, new Vector3()).toArray()).toEqual(original.sunAt(p, new Vector3()).toArray());
    expect(admitted.moonAt(p, new Vector3()).toArray()).toEqual(original.moonAt(p, new Vector3()).toArray());
    expect(admitted.nightAt(p)).toBe(original.nightAt(p));
    expect(admitted.spec.curves.dusk(p)).toBe(original.spec.curves.dusk(p));
  }
});

test('builds different ground ids and owns their toon follow within the prepared scope', async () => {
  const p = product(), row = fixture(), look = toonLook(p), family = new ToonLook();
  const groundMaterial = new MeshBasicMaterial(), slabMaterial = new MeshBasicMaterial();
  vi.spyOn(materials, 'runtimeLookMaterials').mockResolvedValue({ toon: family,
    materials: new Map([[row.ground.materials.ground, groundMaterial], [row.ground.materials.slab, slabMaterial]]),
    setParam: () => undefined, setTexture: () => undefined, textures: new Map(), compile: () => new MeshBasicMaterial(),
    bindMeshMap: () => new MeshBasicMaterial(), tick: () => undefined, outline: () => [],
    graphs: { bind: () => undefined, readout: { compiled: 0, fallback: 0, reasons: [] } }, surfaces: null });
  const decoded = [new BoxGeometry(2, 1, 3), new BoxGeometry(3, 2, 1)];
  const loads: string[] = [];
  vi.spyOn(geometry, 'createOwnedGeometry').mockImplementation(url => ({ load: () => { loads.push(url); return Promise.resolve(); },
    take: () => decoded.shift() ?? new BoxGeometry(), copy: () => new BoxGeometry(), adopt: () => undefined }));
  const scope = new Scope('chalk-ground'); scopes.push(scope);
  const context = { scope, sky: {}, renderer: {} } as WorldLookContext;
  const terrain = { group: new Group() } as Terrain;
  const field: PainterField = { ready: () => Promise.resolve(true), heightAt: () => 0, normalAt: () => [0, 1, 0], trails: () => [], trailDistance: () => 0 };
  if (look.terrainPainter === undefined || look.prepareWorld === undefined) throw new Error('Missing toon ground');
  await expect(look.terrainPainter.build(terrain, field, scope)).rejects.toThrow('prepared');
  await look.prepareWorld(context); await look.terrainPainter.build(terrain, field, scope);
  expect(loads).toEqual(['/chalk/models/chalk.glb', '/chalk/models/walls.glb']);
  expect(terrain.group.children).toHaveLength(2);
  expect(terrain.mesh.material).toBe(groundMaterial);
  const sides = terrain.group.children[1]; if (!(sides instanceof Mesh)) throw new Error('Missing walls');
  expect(sides.material).toBe(slabMaterial);
  expect(terrain.mesh.castShadow && terrain.mesh.receiveShadow).toBe(true);
  const state = toonLookState(p); state.dayLight.uCloudTime.value = 123;
  terrain.mesh.onBeforeRender({} as Parameters<Mesh['onBeforeRender']>[0], new Scene(), {} as Parameters<Mesh['onBeforeRender']>[2], terrain.mesh.geometry, groundMaterial, {} as Parameters<Mesh['onBeforeRender']>[5]);
  expect(family.uniforms.famToonTime.value).toBe(123);
  expect(look.fog?.order).toBe(250); expect(look.shadows?.rig).toBe('tier');
  scope.dispose(); await expect(look.terrainPainter.build(terrain, field, scope)).rejects.toThrow('prepared');
});

test('declares a fictional sky through the graph host without a shard callback', async () => {
  const p = product();
  const factory = vi.spyOn(sky, 'graphDaySkyBackdrop').mockReturnValue(() => Promise.reject(new Error('Unused graph factory')));
  toonLook(p);
  const options = factory.mock.calls[0]?.[0]; if (options === undefined) throw new Error('Missing graph sky');
  expect(options.channels).toBe('chalk.channels'); expect(options.dome.radius).toBe(1500);
  const scene = new Scene(), dome = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  const context = { scene, sky: { sunDir: new Vector3() }, level: { sky: { envIntensity: .8, sunIntensity: 2 } } } as SkyBackdropContext;
  const body = await options.build(context, { material: () => new MeshBasicMaterial(), setParam: () => undefined, setTexture: () => undefined }, dome);
  expect(dome.children).toHaveLength(1); expect(dome.children[0]?.renderOrder).toBe(-25);
  expect(body.environment.source.kind).toBe('scene'); expect(body.environment.refresh.every).toBe(5);
  const state = toonLookState(p), previous = state.dayLight.uCloudTime.value;
  body.tick?.(.25); expect(state.dayLight.uCloudTime.value).toBe(previous + .25);
});
