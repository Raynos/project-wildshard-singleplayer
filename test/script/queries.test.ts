import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { loadRapier } from '../../src/engine/physics/rapier';
import { Physics } from '../../src/engine/physics/Physics';
import { groups } from '../../src/engine/physics/groups';
import { tagCollider } from '../../src/engine/physics/surface';
import { scriptPhysicsQueries } from '../../src/engine/script/queries';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

async function fixture() {
  const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), physics = new Physics(R);
  for (const id of [3, 1, 2]) {
    const collider = physics.world.createCollider(R.ColliderDesc.cuboid(0.25, 0.25, 0.25).setTranslation(id, 0, 0).setCollisionGroups(groups('WORLD')));
    tagCollider(collider, 'wood', id);
  }
  physics.step();
  let nodes = 0;
  const query = scriptPhysicsQueries({ physics, handle: (owner) => typeof owner === 'number' ? owner : undefined, navigation: {
    closestWalkable: (p) => new Vector3(p.x, 0, p.z),
    findPath: (from, to, _radius, _out, maxNodes) => { nodes = maxNodes ?? 0; return [new Vector3(from.x, from.y, from.z), new Vector3(to.x, to.y, to.z)]; },
  } });
  return { query, physics, nodes: () => nodes };
}
describe('read-only deterministic script physics adapter', () => {
  it('raycasts real collision bodies and returns stable entity handles', async () => {
    const { query, physics } = await fixture();
    try {
      const answer = query(1, [0, 0, 0, 1, 0, 0, 10, 0], 1);
      expect(answer[0]).toBeCloseTo(0.75, 6); expect(answer[7]).toBe(1);
      expect(query(1, [0, 0, 0, -1, 0, 0, 10, 0], 1)).toEqual([]);
      expect(physics.world.colliders.len()).toBe(3);
    } finally { physics.world.free(); }
  });
  it('sorts and deduplicates overlap handles independently of collider insertion order', async () => {
    const { query, physics } = await fixture();
    try { expect(query(2, [2, 0, 0, 3, 1, 1, 0, 0], 1)).toEqual([1, 2, 3]); } finally { physics.world.free(); }
  });
  it('delegates nearest and path to navigation with a bounded search and rejects bad requests', async () => {
    const { query, physics, nodes } = await fixture();
    try {
      expect(query(3, [2, 1, 3, 0, 0, 0, 0.5, 0], 1)).toEqual([2, 0, 3]);
      expect(query(4, [2, 1, 3, 4, 5, 6, 0.5, 0], 1)).toEqual([2, 1, 3, 4, 5, 6]); expect(nodes()).toBe(128);
      expect(() => query(1, [0, 0, 0, 0, 0, 0, 10, 0], 1)).toThrow('ray');
      expect(() => query(2, [0, 0, 0, -1, 1, 1, 0, 0], 1)).toThrow('overlap');
      expect(() => query(3, [300, 0, 0, 0, 0, 0, 1, 0], 1)).toThrow('bounds');
      expect(() => query(4, [0, 0, 0, 1, 1, 1, 6, 0], 1)).toThrow('radius');
    } finally { physics.world.free(); }
  });
});
