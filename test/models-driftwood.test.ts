// E315 M1 (docs/plans/MODEL-ARCHITECTURE.md): Driftwood's models on the contract — a moving copy's colliders ride it
// (`piece.follows: 'copy'`, the sailboat), and the island's models build in their own space (origin at their foot).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WorldRegistry } from '../src/world/registry';
import type { Sky } from '../src/world/Sky';
import { defineModel, modelContext } from '../src/models/model';
import { place } from '../src/models/place';
import { boat, boatColliders } from '../src/chunks/driftwood-isle/models/boat';
import { palm } from '../src/chunks/driftwood-isle/models/palm';
import { hut, hutLayout } from '../src/chunks/driftwood-isle/models/hut';

// a stand-in sky: the materials only ask it to prepare them (no renderer in a test)
const sky = { setupMaterial(_m: THREE.Material): void { /* nothing to prepare */ }, csm: { lightDirection: new THREE.Vector3(0, -1, 0) } } as Sky;
const ctx = modelContext(sky);

describe('Driftwood models (E315 M1)', () => {
  it("piece.follows 'copy': the piece rides its one single copy, its colliders in the copy's own space", () => {
    const reg = new WorldRegistry();
    const mat = new THREE.MeshBasicMaterial();
    const raft = defineModel({
      id: 'shared/test-raft', name: 'Raft', category: 'props', pipeline: 'code', file: 'test/models-driftwood.test.ts', defaults: {},
      build: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 3), mat)); return g; },
      colliders: () => [{ kind: 'box', x: 0, y: 0.1, z: 0, hx: 1, hy: 0.1, hz: 1.5 }],
    });
    const placed = place(raft, [{ x: 10, y: 1, z: -5, yaw: 0.4 }], { ctx, draw: 'single', registry: reg, piece: { id: 'raft', follows: 'copy' } });
    const piece = reg.get('raft');
    expect(piece?.follows).toBe(placed.object);
    expect(piece?.colliders).toEqual([{ kind: 'box', x: 0, y: 0.1, z: 0, hx: 1, hy: 0.1, hz: 1.5 }]); // own space
    expect(placed.colliders[0]).toMatchObject({ kind: 'box', x: 10, z: -5 }); // the Placed keeps the placed ones
    expect(placed.object.position.toArray()).toEqual([10, 1, -5]);
    expect(() => place(raft, [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }], { ctx, draw: 'single', registry: reg, piece: { follows: 'copy' } })).toThrow(/one 'single' placement/);
  });

  it('the sailboat: placed single, its walls and floor ride it exactly as the old local set', () => {
    const reg = new WorldRegistry();
    const placed = place(boat, [{ x: -4.2, y: 0.8, z: -244 }], { ctx, draw: 'single', registry: reg, piece: { id: 'boat', follows: 'copy', solidFloor: true } });
    expect(placed.drawnAs).toBe('single');
    expect(reg.get('boat')?.colliders).toEqual(boatColliders());
    expect(reg.models().find((m) => m.id === 'driftwood-isle/boat')).toMatchObject({ name: 'Sailboat', copies: 1, pipeline: 'code', category: 'buildings' });
  });

  it('own space: a palm stands on its origin, its trunk capsules around the axis', () => {
    const placed = place(palm, [{ x: 0, y: 0, z: 0, params: { h: 8, lean: 0, leanDir: 0, rot: 0, fronds: 10 } }], { ctx, draw: 'merged', registry: null });
    const box = new THREE.Box3().setFromObject(placed.object);
    expect(box.min.y).toBeCloseTo(-0.3, 0); // the coconuts and frond tips hang lower than the crown, never under the foot
    expect(box.max.y).toBeGreaterThan(8);
    expect(placed.colliders).toHaveLength(3);
    for (const c of placed.colliders) expect(Math.hypot(c.kind === 'capsule' ? c.x : 99, c.kind === 'capsule' ? c.z : 99)).toBeLessThan(1e-9);
  });

  it("the hut's layout and its geometry come from one build per site", () => {
    const ground = (): number => 0.5;
    const lay = hutLayout({ ground });
    expect(lay.floorY).toBeCloseTo(0.5 + 1.1, 9); // the cabin floor stands 1.1 m over the ground at its centre
    expect(lay.floorHeightAt(0, 0)).toBeCloseTo(1.6, 9);
    expect(Object.keys(lay.anchors).sort()).toEqual(['door', 'hutChest', 'npc', 'porch']);
    const placed = place(hut, [{ x: 0, y: 0, z: 0, params: { ground } }], { ctx, draw: 'merged', registry: null });
    expect(hutLayout({ ground })).toBe(lay); // the same builder
    expect(placed.colliders.length).toBe(lay.colliderDescs().length);
  });
});
