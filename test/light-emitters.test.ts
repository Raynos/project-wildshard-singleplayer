// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Color, Group, Matrix4, MeshStandardMaterial, PointLight, Vector3, Vector4 } from 'three';
import { LightEmitters } from '../src/engine/fx/lightEmitters';
import { Scope } from '../src/engine/app/scope';
import { applyGround, updateGround } from '../src/engine/render/families/ground';
import { parseGroundLayer } from '../src/format/materialFamilies';
import { parseLightEmitters } from '../src/format/lightEmitters';
import { lightPoolRows } from '../src/shards/nine-dragon-stack/look/light/install';
import { gatherPools } from '../src/shards/nine-dragon-stack-legacy/look/light/pools';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { EmitterPresentation } from '../src/game/shardfile/lightEmitters';
import { sceneVectors } from '../src/game/shardfile/sceneInputs';
import { SIGNAL_EMITTERS } from '../src/shards/sunscar-dunes/generators/lightEmitters';
import POOL from '../src/shards/nine-dragon-stack/data/lightPools.json' with { type: 'json' };
import type { ShardContext } from '../src/game/plugin/context';

test('Nine source order, linear colours and falloffs match its sealed volume inputs exactly', () => {
  const emitter = (w: number, h: number, power: number, spill: number) => ({ at: new Vector3(w, h, power), color: new Color(0xb47248), w, h, power, spill });
  const lanterns = [emitter(0.2, 0.4, 1, 0.3), emitter(0.75, 1, 2, 0.1)],
    shops = [emitter(1.5, 1, 1, 0.1), emitter(4, 2, 1, 0.9)], lamps = [emitter(0.34, 0.3, 1, 0.3)],
    signs = [emitter(1, 3, 2, 0.3), emitter(2, 1, 0.5, 0)],
    windows = [0, 0.8, 1.15].map(lit => ({ m: new Matrix4().makeRotationY(0.7).scale(new Vector3(1.2, 2.4, 1)).setPosition(3, 4, 5), win: new Vector4(0, lit, 0, 0), light: new Color(0xffaa55) }));
  const rows = lightPoolRows({ lanterns, ctxEmitters: [...shops, ...lamps], signs, windows }, POOL);
  expect(new LightEmitters(rows).volume()).toEqual(gatherPools({ lanterns, shops, lamps: lamps.map(row => row.at), signs, windows }));
  const shared = { value: rows.map(() => new Vector4()) }, current = new LightEmitters(rows, shared);
  current.set('light.0', false); expect(shared.value[0]?.w).toBe(0);
  expect(current.volume()[1]).toEqual(gatherPools({ lanterns, shops, lamps: lamps.map(row => row.at), signs, windows })[1]);
  expect(() => current.set('missing', true)).toThrow();
  expect(() => new LightEmitters([...rows, ...rows])).toThrow();
  const invalid = structuredClone(rows);
  for (const row of invalid) row.gain = Number.NaN;
  expect(() => new LightEmitters(invalid)).toThrow();
});

test('ground reads the owning emitter uniform through dusk updates without a copy or shader rebuild', () => {
  const uniform = { value: Array.from({ length: 4 }, () => new Vector4()) }, material = new MeshStandardMaterial();
  const rows = parseGroundLayer({ pools: { source: 'emitters', low: [1, 0.7, 0.3], high: [1, 0.4, 0.1], split: 0.5, radius: 10, gain: 0.17 } });
  applyGround(material, rows, () => { throw new Error('No textures'); }, id => {
    expect(id).toBe('emitters'); return uniform;
  });
  const readPools = (): unknown => {
    const values: unknown = material.userData['familyUniforms'];
    if (typeof values !== 'object' || values === null || !('famGPools' in values)) throw new Error('Missing pool uniform');
    return values.famGPools;
  };
  expect(readPools()).toBe(uniform);
  const before = material.customProgramCacheKey();
  uniform.value[0]?.set(1, 2, 3, 1); updateGround(material, { albedo: 0.7 });
  expect(readPools()).toBe(uniform);
  expect(material.customProgramCacheKey()).toBe(before); material.dispose();
  expect(() => applyGround(new MeshStandardMaterial(), rows, () => { throw new Error('No textures'); })).toThrow();
});

test('emitter switches restore exact pool and ember state and retain the original flicker waves', () => {
  const rows = parseLightEmitters({ version: 1, input: 'firelights', clock: 'firetime', rows: [{
    id: 'beacon', parent: 'flame', at: { point: 'at' }, pool: { slot: 0, gain: 1 }, initially: false, draws: [],
    emissive: { collection: 'embers', gain: 1.1 },
    light: { part: 'light', at: { point: 'at' }, colour: 0xff8a3a, gain: 14, distance: 40, decay: 1.6, shared: false, waves: [[13, 0, 0.06], [29, 1.3, 0.04]] },
  }] });
  const scope = new Scope('emitters'), handles = new SceneHandles(), root = new Group(), flame = new Group(), light = new PointLight(), embers = new MeshStandardMaterial();
  handles.publish('flame', flame); handles.publish('light', light); handles.publish('at', new Vector3(2, 3, 4)); handles.publishMaterials('embers', [embers]);
  const ctx = { root, product: { slug: 'fixture-emitter' } } as ShardContext;
  const host = new EmitterPresentation(rows, handles, ctx, scope, new Map());
  expect(flame.visible).toBe(false); expect(embers.emissiveIntensity).toBe(0);
  host.set('beacon', true); expect(embers.emissiveIntensity).toBe(1.1);
  expect(sceneVectors('fixture-emitter', 'firelights', 4).value[0]?.toArray()).toEqual([2, 3, 4, 1]);
  host.step(10, new Vector3()); expect(light.intensity).toBe(14 * (1 + Math.sin(130) * 0.06 + Math.sin(291.3) * 0.04));
  host.set('beacon', false); host.step(11, new Vector3()); expect(light.intensity).toBe(0);
  scope.dispose(); embers.dispose();
  expect(() => parseLightEmitters({ ...rows, rows: [...rows.rows, ...rows.rows] })).toThrow();
});

test('Signal generator admits every original fire graph and keeps the four pool slots in order', () => {
  const pools = SIGNAL_EMITTERS.rows.filter(row => row.pool !== undefined).sort((a, b) => (a.pool?.slot ?? 0) - (b.pool?.slot ?? 0));
  expect(pools.map(row => [row.id, row.pool?.slot, row.pool?.gain])).toEqual([
    ['brazier.0', 0, 1], ['brazier.1', 1, 1], ['brazier.2', 2, 1], ['caravan.pool', 3, 0.22],
  ]);
  expect([...new Set(SIGNAL_EMITTERS.rows.flatMap(row => row.draws.map(draw => draw.material)))].sort()).toEqual([
    'fire-embers', 'fire-flame', 'fire-glow', 'fire-lamp-glow', 'fire-pool', 'fire-smoke', 'fire-wisp',
  ]);
  expect(SIGNAL_EMITTERS.rows.filter(row => !row.initially).map(row => row.id)).toEqual(['signal', 'brazier.0', 'brazier.1', 'brazier.2']);
  const shared = SIGNAL_EMITTERS.rows.find(row => row.light?.shared === true);
  if (shared?.light === undefined) throw new Error('Missing declared shared lamp');
  expect(() => parseLightEmitters({ ...SIGNAL_EMITTERS, rows: [{ ...shared, light: { ...shared.light, decay: 1 } }] })).toThrow();
});
