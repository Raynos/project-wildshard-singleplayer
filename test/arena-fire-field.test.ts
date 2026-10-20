import { afterEach, expect, test } from 'vitest';
import { BoxGeometry, BufferGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Rng } from '../src/engine/core/rng';
import { overrideTerrain } from '../src/engine/world/Heightfield';
import { ArenaField } from '../src/game/boss/arenaField';
import { ArenaFireView } from '../src/game/boss/arenaFire';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import program from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };

// A made-up reed marsh (the fire cells' fixture second user): a 3 × 2 field of 2 m cells on a 1 m bank, burning 1 s.
const reeds = { flameLook: 'reed-flame', smokeLook: 'reed-smoke', flameCount: 8, smokeCount: [4, 4], smokeDetail: [0, 0],
  front: [0.5, 0.5], heat: [0.5, 0.5], flameWidth: 1, life: [0.5, 0], rise: [1, 0], radius: [0.5, 0], expansion: [1, 0],
  cells: { burn: 1, scatter: 0, sink: 0.25, size: 2, smoke: [1000, 1000], scorch: { jitter: 0, lift: 0.1, scale: [1, 0] } } };
const marsh = { x: 10, z: 20, width: 3, depth: 2, cell: 2, observations: { cx: 13, cz: 22, radius: 50, burn: 1 },
  neighbours: [[-1, 0], [1, 0]] as [number, number][], signals: { ignite: 'fieldIgnite', step: 'fire', clock: 'fieldClock' } };

let restore = (): void => undefined;
afterEach(() => { restore(); });

function burning() {
  restore = overrideTerrain({ heightAt: () => 1, normalAt: () => [0, 1, 0] });
  const scope = new Scope('reed-marsh'), scene = new Scene();
  lendLooks(scope, { materials: new Map(['reed-flame', 'reed-smoke'].map(id => [id, new MeshBasicMaterial()])),
    setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => { throw new Error('Unused'); } });
  const fire = new ArenaFireView(scene, reeds, new BufferGeometry().copy(new BoxGeometry()).toJSON());
  const field = new ArenaField(marsh, ReturnProgram.page(program.fire), new Rng(7)), scorch = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 2);
  fire.attachScorch(scorch);
  return { fire, field, scorch, scope };
}

test('a second shard\'s burning cells draw as flames on its bank with smoke rolling off', () => {
  const { fire, field, scope } = burning();
  try {
    field.ignite(11, 21); field.ignite(15, 21);
    fire.drawField(field, 0.1, 1, 0);
    expect(fire.flames.count).toBe(2); expect(fire.smoke.count).toBe(0);
    const at = new Vector3().setFromMatrixPosition(new Matrix4().fromArray(fire.flames.instanceMatrix.array, 0));
    expect(at.toArray()).toEqual([11, 0.75, 21]);
    fire.update(0.01, 0, 0, 0, 0, new Color('white'), 0);
    expect(fire.smoke.count).toBeGreaterThan(0);
    fire.out(); expect(fire.flames.count).toBe(0);
  } finally { scope.dispose(); }
});

test('burnt-out cells leave a bounded scorch that a reset clears', () => {
  const { fire, field, scorch, scope } = burning();
  try {
    for (const cell of [0, 1, 2]) fire.scorchCell(field, cell);
    expect(scorch.count).toBe(2);
    const at = new Vector3().setFromMatrixPosition(new Matrix4().fromArray(scorch.instanceMatrix.array, 16));
    expect(at.toArray().map(n => Math.round(n * 1000) / 1000)).toEqual([13, 1.1, 21]);
    fire.clear(); expect(scorch.count).toBe(0);
  } finally { scope.dispose(); }
});

test('a fire without cell rows refuses to draw a field', () => {
  const { field, scope } = burning(), { cells: _cells, ...plain } = reeds;
  try {
    const fire = new ArenaFireView(new Scene(), plain, new BufferGeometry().copy(new BoxGeometry()).toJSON());
    expect(() => { fire.drawField(field, 0.1, 0, 0); }).toThrow('cell rows');
  } finally { scope.dispose(); }
});
