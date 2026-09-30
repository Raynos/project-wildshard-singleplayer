// E315 M1 (docs/plans/MODEL-ARCHITECTURE.md): the interactables kit's things are models (src/models/interact.ts) — every
// one builds its specimen at rest on the origin, and the kit places each row's drawnInto its batches.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Sky } from '../src/world/Sky';
import { modelContext } from '../src/models/model';
import { place } from '../src/models/place';
import * as Models from '../src/models/interact';

const sky = { setupMaterial(_m: THREE.Material): void { /* nothing to prepare */ }, csm: { lightDirection: new THREE.Vector3(0, -1, 0) } } as Sky;
const ctx = modelContext(sky);

describe('interactables models (E315 M1)', () => {
  it('every kind builds its specimen at rest on the origin', () => {
    const all = [Models.seaChest, Models.holdKey, Models.flintKit, Models.seaGlass, Models.doubloon, Models.resinDrop, Models.carvedToken, Models.glyphShard,
      Models.door, Models.lever, Models.pressurePlate, Models.puzzleBarrel, Models.beacon, Models.bench, Models.shardAltar];
    expect(new Set(all.map((m) => m.id)).size).toBe(all.length);
    for (const m of all) {
      const placed = place(m as typeof Models.lever, [{ x: 0, y: 0, z: 0 }], { ctx, draw: 'single', registry: null });
      const box = new THREE.Box3().setFromObject(placed.object), c = box.getCenter(new THREE.Vector3());
      expect(box.isEmpty(), m.id).toBe(false);
      expect(Math.hypot(c.x, c.z), m.id).toBeLessThan(1.3); // at the origin (a plank door hangs from its hinge)
      expect(box.min.y, m.id).toBeGreaterThan(-0.6);        // on the floor, never under it
      expect(m.id.startsWith('shared/'), m.id).toBe(true);
    }
  });
});
