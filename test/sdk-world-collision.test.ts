import { Document, NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import { bakeWorldCollision, type BakedWorldCollision } from '../src/sdk/bake/worldCollision';
import { normalizeWorldGlb, type WorldPrimitive, type WorldPanel } from '../src/sdk/bake/world';
import { decodeMeshCollision, MESH_COLLISION_LIMITS } from '../src/engine/core/meshCollision';
import { addBakedMeshCollider } from '../src/engine/physics/meshCollision';
import { floorBelow, canStandAt } from '../src/engine/physics/query';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { Scope } from '../src/engine/app/scope';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

function plane(y: number, extent = 100): WorldPrimitive {
  return { node: 'Bridge', objectId: 'bridge', material: 0, terrain: false,
    positions: Float64Array.of(-extent, y, -extent, extent, y, -extent, -extent, y, extent, extent, y, extent),
    normals: null, uv: null, colours: null, tangents: null, indices: Uint32Array.of(0, 2, 1, 1, 2, 3) };
}
const bytesOf = (baked: BakedWorldCollision, hash: string): Uint8Array => { const bytes = baked.assets.get(hash); if (bytes === undefined) throw new Error('Missing baked collider'); return bytes; };
function panel(): WorldPanel { return { id: 'door', colliderId: 'door.collider', node: 'Door', transform: [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 150, 3, 4, 1], primitives: [plane(0, 1)] }; }

it('clips exact collision to ordered L0 tiles and keeps ground/bridge layers and panel bytes deterministic', () => {
  const source = { collision: [plane(0), plane(4)], panels: [panel()] }, before = structuredClone(source);
  const a = bakeWorldCollision(source), b = bakeWorldCollision(source);
  expect(a).toEqual(b); expect(source).toEqual(before); expect(a.tiles).toHaveLength(16); expect(a.panels).toHaveLength(1);
  for (const tile of a.tiles) {
    const data = decodeMeshCollision(bytesOf(a, tile.file)); expect(data.indices.length / 3).toBe(tile.triangles);
    for (let i = 0; i < data.vertices.length; i += 3) {
      const x = data.vertices[i], y = data.vertices[i + 1], z = data.vertices[i + 2];
      expect(x).toBeGreaterThanOrEqual(-250 + tile.x * 62.5); expect(x).toBeLessThanOrEqual(-250 + (tile.x + 1) * 62.5);
      expect(z).toBeGreaterThanOrEqual(-250 + tile.z * 62.5); expect(z).toBeLessThanOrEqual(-250 + (tile.z + 1) * 62.5); expect([0, 4]).toContain(y);
    }
  }
  const door = a.panels[0]; if (door === undefined) throw new Error('Panel');
  expect(Array.from(decodeMeshCollision(bytesOf(a, door.file)).vertices).filter((_, i) => i % 3 === 1)).toEqual([3, 3, 3, 3]);
  expect(a.tiles.some(tile => tile.file === door.file)).toBe(false);
});
it('welds clipped positions on both sides of a tile seam and assigns a seam-aligned vertical wall once', () => {
  const source = plane(0), wall = { ...plane(0), node: 'Wall', positions: Float64Array.of(0, 0, -5, 0, 3, -5, 0, 0, 5), indices: Uint32Array.of(0, 1, 2) };
  const baked = bakeWorldCollision({ collision: [source], panels: [] });
  const seam = (x: number) => baked.tiles.filter(tile => tile.x === x).flatMap(tile => {
    const { vertices } = decodeMeshCollision(bytesOf(baked, tile.file)), values: string[] = [];
    for (let i = 0; i < vertices.length; i += 3) if (vertices[i] === 0) values.push(`${vertices[i + 1]},${vertices[i + 2]}`);
    return values;
  });
  expect([...new Set(seam(3))].sort()).toEqual([...new Set(seam(4))].sort());
  const walls = bakeWorldCollision({ collision: [wall], panels: [] }); expect(walls.tiles.every(tile => tile.x === 4)).toBe(true);
  expect(walls.tiles.reduce((n, tile) => n + tile.triangles, 0)).toBe(3);
});
it('shared sloping source edges retain identical seam coordinates under opposite winding', () => {
  const source = { ...plane(0), positions: Float64Array.of(-94.12345, 0.124001, -89.25, 93.758, 12.456001, -88.19, -97.857, 3.654321, 92.2364, 98.93751, 16.200023, 95.1531) };
  const baked = bakeWorldCollision({ collision: [source], panels: [] });
  const seam = (x: number): string[] => {
    const values = new Set<string>();
    for (const tile of baked.tiles.filter(t => t.x === x)) {
      const { vertices } = decodeMeshCollision(bytesOf(baked, tile.file));
      for (let i = 0; i < vertices.length; i += 3) if (vertices[i] === 0) values.add(`${vertices[i + 1]},${vertices[i + 2]}`);
    }
    return [...values].sort();
  };
  expect(seam(3).length).toBeGreaterThan(3); expect(seam(3)).toEqual(seam(4));
});
it('drops only unrepresentable clipped seam slivers from a valid large ground face', () => {
  const source = { ...plane(0), node: 'Large ground', positions: Float64Array.of(-250, 0, -250, -6, 0, -250, -6, 0, -6, -250, 0, -6), indices: Uint32Array.of(0, 3, 2, 0, 2, 1) };
  const baked = bakeWorldCollision({ collision: [source], panels: [] });
  expect(baked.tiles).toHaveLength(16);
  for (const tile of baked.tiles) {
    const bytes = bytesOf(baked, tile.file);
    expect(decodeMeshCollision(bytes).indices.length).toBeGreaterThan(0);
  }
  expect(bakeWorldCollision({ collision: [source], panels: [] })).toEqual(baked);
});
it('real GLB normalization feeds tiled collision while a transformed interactive node remains separate', async () => {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('World'), material = doc.createMaterial('Clay'); doc.getRoot().setDefaultScene(scene);
  const quad = doc.createPrimitive().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(plane(0, 3).positions)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint16Array.from(plane(0, 3).indices)).setBuffer(buffer)).setMaterial(material);
  scene.addChild(doc.createNode('Ground').setMesh(doc.createMesh().addPrimitive(quad)));
  scene.addChild(doc.createNode('Bridge').setTranslation([0, 5, 0]).setMesh(doc.createMesh().addPrimitive(quad.clone())));
  scene.addChild(doc.createNode('Door').setTranslation([10, 2, 10]).setScale([-1, 2, 1]).setMesh(doc.createMesh().addPrimitive(quad.clone())));
  const world = await normalizeWorldGlb(await new NodeIO().writeBinary(doc), { glb: 'assets/world.glb', materials: { Clay: 'pbr' }, colliders: 'mesh', interactive: [{ node: 'Door', id: 'door', colliderId: 'door.collider' }] }, ['pbr']);
  expect(world.collision.map(row => row.node)).toEqual(['Ground', 'Bridge']);
  const baked = bakeWorldCollision(world); expect(baked.tiles).toHaveLength(4); expect(baked.panels[0]?.colliderId).toBe('door.collider');
  for (const tile of baked.tiles) {
    const data = decodeMeshCollision(bytesOf(baked, tile.file));
    expect(Array.from(data.vertices).filter((_, i) => i % 3 === 1).every(y => y === 0 || y === 5)).toBe(true);
  }
});
it('native capsule traverses 140 m across tiled ground with >98% aggregate travel; independent panel winding survives its mirror', async () => {
  const baked = bakeWorldCollision({ collision: [plane(0), plane(4)], panels: [panel()] });
  const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer())), scope = new Scope('world-collision');
  let motor: CharacterMotor | undefined;
  try {
    for (const tile of baked.tiles) addBakedMeshCollider(physics, bytesOf(baked, tile.file), scope, { owner: 'static' });
    const door = baked.panels[0]; if (door === undefined) throw new Error('Panel');
    const collider = addBakedMeshCollider(physics, bytesOf(baked, door.file), scope, { owner: door.colliderId }); physics.step();
    expect(floorBelow(physics, 0.2, 0.2, 8, 10)).toBeCloseTo(4, 5); expect(floorBelow(physics, 0.2, 0.2, 3, 10)).toBeCloseTo(0, 5);
    expect(canStandAt(physics, { x: 150, y: 3, z: 4 }, { radius: 0.35, height: 1.8 }, 'door.collider')).toBe(true);
    motor = new CharacterMotor(physics, { radius: 0.35, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'] });
    const feet = { x: -70, y: 0, z: -2 };
    let worstFreedom = 1;
    // Rapier's casts briefly deflect at an internal diagonal; this proves overall travel, not >98% per step.
    for (let tick = 0; tick < 840; tick++) {
      physics.step(); const result = motor.move(feet, { x: 10 / 60, y: -22 / 60 / 60, z: 0 });
      worstFreedom = Math.min(worstFreedom, result.horizontalFreedom);
      expect(result.horizontalFreedom, `tick ${tick} at ${JSON.stringify(feet)}`).toBeGreaterThan(0); expect(Math.abs(feet.y)).toBeLessThan(0.06);
    }
    expect((feet.x + 70) / 140, `worst ${worstFreedom}, feet ${JSON.stringify(feet)}`).toBeGreaterThan(0.98);
    collider.setEnabled(false); expect(canStandAt(physics, { x: 150, y: 3, z: 4 }, { radius: 0.35, height: 1.8 }, 'door.collider')).toBe(false);
    motor.dispose(); motor = undefined; scope.dispose(); expect(physics.world.colliders.len()).toBe(0);
  } finally { motor?.dispose(); scope.dispose(); physics.dispose(); }
});
it.each(['nan', 'index', 'degenerate', 'precision', 'triangles', 'panel', 'matrix'] as const)('refuses malformed or over-budget %s source with node identity', kind => {
  const primitive = plane(0), door = panel();
  if (kind === 'nan') primitive.positions[0] = Infinity;
  if (kind === 'index') primitive.indices[0] = 100;
  if (kind === 'degenerate') primitive.indices[1] = 0;
  if (kind === 'precision') primitive.positions = Float64Array.of(100, 0, 100, 100.00000001, 0, 100, 100, 0, 100.00000001);
  if (kind === 'precision') primitive.indices = Uint32Array.of(0, 1, 2);
  if (kind === 'triangles') { primitive.positions = Float64Array.of(1, 0, 1, 2, 0, 1, 1, 0, 2); primitive.indices = Uint32Array.from({ length: (MESH_COLLISION_LIMITS.triangles + 1) * 3 }, (_, i) => i % 3); }
  if (kind === 'matrix') door.transform[0] = 0;
  const panels = kind === 'panel' ? [door, door] : [door];
  expect(() => bakeWorldCollision({ collision: [primitive], panels })).toThrow(/World collision.*(Bridge|door)/u);
});
