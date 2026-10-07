import { describe, expect, it } from 'vitest';
import { decodeMeshCollision, encodeMeshCollision, isMeshCollisionData, meshCollisionCost, MESH_COLLISION_LIMITS } from '../src/engine/core/meshCollision';
import { addBakedMeshCollider } from '../src/engine/physics/meshCollision';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { floorBelow, castRay, canStandAt } from '../src/engine/physics/query';
import { Scope } from '../src/engine/app/scope';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const bridge = () => ({
  vertices: Float32Array.of(-10, 0, -10, 10, 0, -10, -10, 0, 10, 10, 0, 10,
    -2, 4, -5, 2, 4, -5, -2, 4, 5, 2, 4, 5,
    5, 2, -2, 9, 2, -2, 5, 2, 2, 9, 2, 2),
  indices: Uint32Array.of(0, 2, 1, 1, 2, 3, 4, 6, 5, 5, 6, 7, 8, 10, 9, 9, 10, 11),
});
describe('bounded mesh collision', () => {
  it('probes real native snapshots against the provisional model at three mesh sizes, with zero GPU or render draws', async () => {
    const rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
    for (const resolution of [2, 9, 33]) {
      const vertices = new Float32Array(resolution ** 2 * 3), indices: number[] = [];
      for (let z = 0; z < resolution; z++) for (let x = 0; x < resolution; x++) {
        vertices.set([x, 0, z], (z * resolution + x) * 3);
        if (x + 1 < resolution && z + 1 < resolution) {
          const a = z * resolution + x; indices.push(a, a + resolution, a + 1, a + 1, a + resolution, a + resolution + 1);
        }
      }
      const data = { vertices, indices: Uint32Array.from(indices) }, wire = encodeMeshCollision(data), cost = meshCollisionCost(data);
      expect(cost).toEqual({ decoded: 2 * wire.length + 64 * resolution ** 2 + 256 * indices.length / 3, gpu: 0, triangles: 0, draws: 0 });
      const physics = new Physics(rapier), scope = new Scope('mesh-cost-probe');
      try {
        const before = physics.snapshot().length;
        addBakedMeshCollider(physics, wire, scope); physics.step();
        const addedSnapshot = physics.snapshot().length - before;
        expect(addedSnapshot).toBeGreaterThan(0); expect(addedSnapshot).toBeLessThanOrEqual(cost.decoded);
        scope.dispose(); expect(physics.world.colliders.len()).toBe(0);
      } finally { scope.dispose(); physics.dispose(); }
    }
  });
  it('preserves exact winding and stacked geometry with deterministic, owned, unaligned round trips', () => {
    const data = bridge(), wire = encodeMeshCollision(data), buffer = new Uint8Array(wire.length + 7); buffer.set(wire, 3);
    expect(encodeMeshCollision(data)).toEqual(wire); expect(isMeshCollisionData(wire)).toBe(true);
    const decoded = decodeMeshCollision(buffer.subarray(3, 3 + wire.length)); expect(decoded).toEqual(data);
    decoded.vertices[0] = 1; decoded.indices[0] = 1;
    expect(decodeMeshCollision(wire)).toEqual(data); expect(buffer.subarray(3, 3 + wire.length)).toEqual(wire);
  });
  it.each(['version', 'flags', 'reserved', 'counts', 'length', 'position', 'index', 'degenerate'] as const)('refuses malformed %s bytes', kind => {
    let bytes = encodeMeshCollision(bridge()); const v = new DataView(bytes.buffer);
    if (kind === 'version') v.setUint16(4, 2, true);
    if (kind === 'flags') v.setUint16(6, 1, true);
    if (kind === 'reserved') v.setUint32(20, 1, true);
    if (kind === 'counts') v.setUint32(8, 0xffffffff, true);
    if (kind === 'length') bytes = bytes.subarray(0, -1);
    if (kind === 'position') v.setFloat32(24, Number.NaN, true);
    if (kind === 'index') v.setUint32(24 + bridge().vertices.byteLength, 12, true);
    if (kind === 'degenerate') v.setUint32(24 + bridge().vertices.byteLength + 4, 0, true);
    expect(() => decodeMeshCollision(bytes)).toThrow('Mesh collision');
  });
  it('bounds encoder inputs and refuses unreferenced or collapsed geometry', () => {
    const outside = bridge(); outside.vertices[0] = 251; expect(() => encodeMeshCollision(outside)).toThrow('bounds');
    const unused = bridge(); unused.vertices = Float32Array.from([...unused.vertices, 1, 2, 3]); expect(() => encodeMeshCollision(unused)).toThrow('unreferenced');
    const collapsed = bridge(); collapsed.vertices.set(collapsed.vertices.subarray(0, 3), 6); expect(() => encodeMeshCollision(collapsed)).toThrow('degenerate');
    expect(() => encodeMeshCollision({ vertices: new Float32Array((MESH_COLLISION_LIMITS.vertices + 1) * 3), indices: Uint32Array.of(0, 1, 2) })).toThrow('limits');
    expect(() => decodeMeshCollision(new Uint8Array(23))).toThrow('header'); expect(isMeshCollisionData(new Uint8Array(3))).toBe(false);
  });
  it('native queries retain the bridge, ground below it and actual overhang capsule clearance; unload releases the collider', async () => {
    const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer())), scope = new Scope('mesh-fixture');
    try {
      const collider = addBakedMeshCollider(physics, encodeMeshCollision(bridge()), scope, { owner: 'bridge', material: 'stone' }); physics.step();
      expect(physics.scopedCensus(scope)).toEqual({ bodies: 0, colliders: 1 });
      expect(floorBelow(physics, 0, 0, 8, 10)).toBeCloseTo(4, 5);
      expect(floorBelow(physics, 0, 0, 3, 10)).toBeCloseTo(0, 5);
      expect(canStandAt(physics, { x: 0, y: 0, z: 0 }, { radius: 0.35, height: 1.8 }, 'bridge')).toBe(true);
      expect(canStandAt(physics, { x: 7, y: 0, z: 0 }, { radius: 0.35, height: 2.2 }, 'bridge')).toBe(false);
      expect(castRay(physics, { x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }, 10)).toMatchObject({ owner: 'bridge', material: 'stone', point: { y: 4 } });
      scope.dispose(); expect(collider.isValid()).toBe(false); expect(physics.world.colliders.len()).toBe(0);
      expect(physics.scopedCensus(scope)).toEqual({ bodies: 0, colliders: 0 }); scope.dispose();
    } finally { scope.dispose(); physics.dispose(); }
  });
  it('rejects malformed wire before allocating any native collider', async () => {
    const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer())), scope = new Scope('bad-mesh');
    try {
      expect(() => addBakedMeshCollider(physics, new Uint8Array(24), scope)).toThrow(); expect(physics.world.colliders.len()).toBe(0);
      scope.dispose(); expect(() => addBakedMeshCollider(physics, encodeMeshCollision(bridge()), scope)).toThrow('live scope'); expect(physics.world.colliders.len()).toBe(0);
    }
    finally { scope.dispose(); physics.dispose(); }
  });
});
