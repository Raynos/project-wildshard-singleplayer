// oxlint-disable-next-line import/no-nodejs-modules -- Read the committed water data fixture.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { PerspectiveCamera } from 'three';
import { WaterSchema, shardfileWater } from '../src/game/shardfile/water';
import { WaterBodies } from '../src/engine/world/water/body';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { Player } from '../src/engine/player/Player';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import { overrideTerrain } from '../src/engine/world/Heightfield';
import { legacyDouble } from './fake/FakeGame';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const raw: unknown = JSON.parse(readFileSync('test/fixtures/shardfile/water.json', 'utf8'));
it('data pools, seas and sloping streams answer the existing water registry and leave with its scope', () => {
  const bodies = shardfileWater(raw), water = new WaterBodies(), scope = new Scope('water-data');
  try {
    for (const body of bodies) water.add(body, scope);
    expect(water.restAt(25, 20)).toBe(0); expect(water.restAt(30, 20)).toBe(-10);
    expect(water.inside(25, 20, -1)?.id).toBe('fixture.pool');
    expect(water.restAt(-15, -20)).toBe(1.5); expect(water.restAt(-10, -15)).toBe(0.5);
    expect(water.inside(-15, -20, 1.6)?.id).not.toBe('fixture.stream');
    expect(water.restAt(251, 0)).toBeNull(); expect(water.restAt(Number.NaN, 0)).toBeNull();
    expect(water.sea?.surfaceAt(0, 0)).not.toBe(-10);
  } finally { scope.dispose(); }
  expect(water.size).toBe(0);
});
it('bounded polygon pools support concave outlines without mutating their source', () => {
  const source = [{ id: 'pool', kind: 'pool', level: 2, shape: { kind: 'polygon', points: [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]] } }];
  const pool = shardfileWater(source)[0]; if (pool === undefined) throw new Error('Pool');
  expect(pool.restAt(0.5, 3)).toBe(2); expect(pool.restAt(3, 0.5)).toBe(2); expect(pool.restAt(3, 3)).toBeNull();
  const first = source[0]; if (first === undefined) throw new Error('Source'); first.level = 100;
  expect(pool.restAt(0.5, 3)).toBe(2); expect(pool.inside(0.5, 3, 3)).toBe(false);
});
it('rejects unknown properties, nonfinite values, ambiguous identities, bad polygons and zero-length streams', () => {
  const pool = { id: 'pool', kind: 'pool', level: 0, shape: { kind: 'circle', x: 0, z: 0, radius: 5 } };
  for (const value of [[{ ...pool, shader: 'custom' }], [{ ...pool, level: Number.NaN }], [pool, pool], [{ ...pool, shape: { kind: 'circle', x: 249, z: 0, radius: 5 } }],
    [{ ...pool, shape: { kind: 'polygon', points: [[0, 0], [4, 4], [0, 4], [4, 0]] } }], [{ ...pool, shape: { kind: 'polygon', points: [[0, 0], [1, 0], [2, 0]] } }],
    [{ id: 'stream', kind: 'stream', width: 4, points: [{ x: 0, z: 0, level: 0 }, { x: 0, z: 0, level: 1 }] }],
    [{ id: 'sea', kind: 'sea', level: 0, waves: false }, pool]]) expect(() => v.parse(WaterSchema, value)).toThrow();
});
it('the real player swims in a declared pool, wades on its shallow shelf and walks off its boundary', async () => {
  const parsed = v.parse(WaterSchema, raw), first = parsed[0]; if (first === undefined) throw new Error('Fixture pool');
  const scope = new Scope('declared-pool'), restore = overrideTerrain({ heightAt: (x) => x > 28 ? -0.5 : -3 });
  const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), physics = new Physics(R);
  physics.world.createCollider(R.ColliderDesc.cuboid(20, 0.5, 20).setTranslation(25, -3.5, 20).setCollisionGroups(groups('WORLD')));
  physics.world.createCollider(R.ColliderDesc.cuboid(1, 1.25, 10).setTranslation(29, -1.75, 20).setCollisionGroups(groups('WORLD')));
  const player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  const step = (ticks: number) => { for (let tick = 0; tick < ticks; tick++) { player.input(1 / 60); physics.step(); player.step(1 / 60); } };
  try {
    for (const body of shardfileWater([first])) app.world.water.add(body, scope);
    player.spawn(25, 20, 0, -1); step(120);
    expect(player.swimming).toBe(true); expect(player.wading).toBe(false); expect(player.waterSurface).toBe(0);
    expect(player.position.y).toBeGreaterThan(-1.5); expect(player.position.y).toBeLessThan(0);
    player.spawn(29, 20, 0, -0.45); step(60);
    expect(player.swimming).toBe(false); expect(player.wading).toBe(true);
    player.spawn(31, 20, 0, -0.45); step(30);
    expect(player.swimming).toBe(false); expect(player.wading).toBe(false); expect(player.waterSurface).toBeNull();
  } finally { scope.dispose(); restore(); player.motor.dispose(); physics.dispose(); }
  expect(app.world.water.get('fixture.pool')).toBeNull();
});
