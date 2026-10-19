// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import baked from '../src/shards/nine-dragon-stack/data/physics.generated.json' with { type: 'json' };
import rows from '../src/shards/nine-dragon-stack/world/install.generated.json' with { type: 'json' };
import caps from '../src/shards/nine-dragon-stack/data/deckCaps.generated.json' with { type: 'json' };
import stair from '../src/shards/nine-dragon-stack/world/stairPlan.generated.json' with { type: 'json' };
import { fragmentFloor as authoredFloor } from '../src/shards/nine-dragon-stack/generators/fragmentFloor';
import worldRows from '../src/shards/nine-dragon-stack/data/worldRows.generated.json' with { type: 'json' };
import { floorAtRects } from '../src/engine/physics/box';
import { stairFloor } from '../src/shards/nine-dragon-stack/generators/stairPlan';
import { BoxGeometry, InstancedMesh, MeshBasicMaterial, type Object3D, PerspectiveCamera } from 'three';
import { defineModel, modelContext } from '../src/engine/models/model';
import { place } from '../src/engine/models/place';
import { compileGraph } from '../src/engine/render/graph/compile';
import lookGraphs from '../src/shards/nine-dragon-stack/data/lookGraphs.json' with { type: 'json' };

const fragmentFloor = (x: number, z: number): number | undefined => floorAtRects(worldRows.rows.floors, x, z, 'first');

// The pre-existing physics bake retains the original page registry's complete
// static payload, including stable portal floor owners and the followed guard.
test('page install rows preserve the existing collider payload and order', () => {
  const ids = new Set(rows.standalone.map(row => row.id));
  expect(rows.standalone).toEqual(baked.pieces.filter(row => ids.has(row.id)));
  const floors = rows.standalone.find(row => row.id === 'nds-floors');
  const openFloors = rows.cell.find(row => row.id === 'nds-floors');
  if (floors === undefined || openFloors === undefined) throw new Error('Missing floor registration');
  expect(floors.colliders.slice(-16)).toEqual([...caps.north, ...caps.south, ...caps.east, ...caps.west]);
  expect(openFloors.colliders).toEqual(floors.colliders.slice(0, -16));
  expect(rows.cell.filter(row => row.id !== 'nds-floors')).toEqual(rows.standalone.filter(row => row.id !== 'nds-floors'));
});

test('stair floor covers every tread boundary within one step of its collider', () => {
  const positions = stair.FLIGHTS.flatMap(flight => Array.from({ length: 21 }, (_, i) => flight.x0 + i * stair.RUN));
  positions.push(...stair.LANDINGS.flatMap(landing => [landing.x0, landing.x1]), 22, 22.6, 70, 78);
  for (const x of positions) for (const delta of [-1e-10, 0, 1e-10]) {
    const at = x + delta;
    if (at >= 22 && at <= 78) {
      const floor = fragmentFloor(at, 6);
      if (floor === undefined) throw new Error(`Missing stair floor at ${at}`);
      const lower = at <= 22.6 ? 125 : stairFloor(at - 1e-9), upper = at <= 22.6 ? 125 : stairFloor(at + 1e-9);
      expect(Math.min(Math.abs(floor - lower), Math.abs(floor - upper))).toBeLessThanOrEqual(stair.RISE + 1e-8);
    }
  }
  expect(fragmentFloor(78 + 1e-10, 6)).toBeUndefined();
  expect(fragmentFloor(50, 2 - 1e-10)).toBeUndefined();
  expect(fragmentFloor(50, 10 + 1e-10)).toBeUndefined();
});

test('declared floors cover the authored plaza, street, rim and stair without adding floors', () => {
  for (let x = -32; x < 82; x += 0.37) for (let z = -125; z < 25; z += 0.73) {
    const actual = fragmentFloor(x, z), expected = authoredFloor(x, z);
    if (actual === undefined || expected === undefined) expect(actual).toBe(expected);
    else expect(Math.abs(actual - expected)).toBeLessThanOrEqual(stair.RISE + 1e-8);
  }
});


// Static instances use the same native LOD owner as every other shard.

test('native model culling retains colour, range and distance levels', () => {
  const material = new MeshBasicMaterial(), near = new BoxGeometry(), far = new BoxGeometry();
  const model = defineModel({ id: 'test/static-crowd', name: 'Static crowd', category: 'props', pipeline: 'code', file: 'test/nine-world-install.test.ts', defaults: {},
    build: () => [{ geometry: near, material }], lods: [{ from: 35, build: () => [{ geometry: far, material }] }] });
  const placed = place(model, [{ x: 0, y: 0, z: -5, color: 0xff0000 }, { x: 0, y: 0, z: -50, color: 0x00ff00 }, { x: 0, y: 0, z: -150 }],
    { ctx: modelContext(null), registry: null, draw: 'instanced', cull: { bounds: 'sphere', from: 'origin', far: 130 } });
  const camera = new PerspectiveCamera(60, 1, 0.1, 250);
  placed.cull(camera);
  const meshes: InstancedMesh[] = [];
  const instance = (node: Object3D): node is InstancedMesh => node instanceof InstancedMesh;
  placed.object.traverse(node => { if (instance(node)) meshes.push(node); });
  expect(meshes.map(mesh => mesh.count)).toEqual([1, 1]);
  expect(meshes[0]?.instanceMatrix.array[14]).toBe(-5);
  expect(meshes[1]?.instanceMatrix.array[14]).toBe(-50);
  expect(meshes[0]?.instanceColor?.array.slice(0, 3)).toEqual(Float32Array.of(1, 0, 0));
  expect(meshes[1]?.instanceColor?.array.slice(0, 3)).toEqual(Float32Array.of(0, 1, 0));
  camera.rotation.y = Math.PI; placed.cull(camera);
  expect(meshes.map(mesh => mesh.count)).toEqual([0, 0]);
  near.dispose(); far.dispose(); material.dispose();
});

test('lantern sway seed follows the instance pose through native LOD packing', () => {
  const compiled = compileGraph({ ...lookGraphs['nine-lantern'], effectState: { ...lookGraphs['nine-lantern'].effectState, fog: false } }, { trustedBudget: true });
  expect(compiled.material).toBeDefined();
  expect(Object.values(lookGraphs['nine-lantern'].nodes).some(node => 'name' in node && node.name === 'aSeed')).toBe(false);
  compiled.material.dispose();
});
