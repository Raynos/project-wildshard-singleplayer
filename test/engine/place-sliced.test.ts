// SF67 (E461): `placeSliced` is `place` in slices. The merged draw pauses after every copy and every welded mesh; the
// result (geometry bytes, the rng stream each copy drew from, colliders, boxes, the registry piece) is `place`'s exactly,
// nothing registers before the last slice, and every slice runs under the owner the call was made in.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WorldRegistry } from '../../src/engine/world/registry';
import { modelContext, type ModelDef } from '../../src/engine/models/model';
import { place, placeSliced, type Placed } from '../../src/engine/models/place';
import { Scope } from '../../src/engine/app/scope';
import { currentOwner, withOwner } from '../../src/engine/app/ownership';

const stone = new THREE.MeshBasicMaterial(), moss = new THREE.MeshBasicMaterial();
const ctx = modelContext(null);
const owners: (Scope | null)[] = [];
const rock: ModelDef<{ s: number }> = {
  id: 'shared/test-sliced-rock', name: 'Rock', category: 'nature', pipeline: 'code', file: 'test/engine/place-sliced.test.ts', defaults: { s: 1 },
  build: (_c, p, rng) => {
    owners.push(currentOwner());
    const h = p.s * (0.5 + rng.next()); // the copy's own draw from the model's rng stream
    return [
      { geometry: new THREE.BoxGeometry(p.s, h, p.s), material: stone },
      { geometry: new THREE.ConeGeometry(p.s * 0.6, h * 0.4, 7).translate(0, h * 0.7, 0), material: moss },
    ];
  },
};
const copies = (n: number): { x: number; y: number; z: number; rotY: number; params: { s: number } }[] =>
  Array.from({ length: n }, (_, i) => ({ x: (i % 5) * 9 - 18, y: 0, z: Math.floor(i / 5) * 9, rotY: i * 0.7, params: { s: 1 + (i % 3) * 0.5 } }));

function bytes(p: Placed): number[][] {
  const out: number[][] = [];
  p.object.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = o.geometry as THREE.BufferGeometry;
    for (const name of Object.keys(g.attributes).sort()) out.push(Array.from(g.getAttribute(name).array as ArrayLike<number>));
    if (g.index) out.push(Array.from(g.index.array as ArrayLike<number>));
  });
  return out;
}

describe('placeSliced (SF67)', () => {
  it('draws, registers and collides exactly as place does, pausing between copies', async () => {
    const a = new WorldRegistry(), b = new WorldRegistry();
    const sync = place(rock, copies(17), { ctx, draw: 'merged', cell: 20, registry: a });
    let pauses = 0, registeredMidway = false;
    const sliced = await placeSliced(rock, copies(17), { ctx, draw: 'merged', cell: 20, registry: b }, () => {
      pauses++;
      if (b.pieces.length > 0) registeredMidway = true;
      return Promise.resolve();
    });
    expect(pauses).toBeGreaterThanOrEqual(17);
    expect(registeredMidway).toBe(false);
    expect(bytes(sliced)).toEqual(bytes(sync));
    expect(sliced.colliders).toEqual(sync.colliders);
    expect(sliced.copies).toBe(sync.copies);
    const box = (p: Placed, i: number): number[] => p.copyBox(i, new THREE.Box3()).min.toArray().concat(p.copyBox(i, new THREE.Box3()).max.toArray());
    for (let i = 0; i < 17; i++) expect(box(sliced, i)).toEqual(box(sync, i));
    expect(b.pieces.map((p) => p.id)).toEqual(a.pieces.map((p) => p.id));
    a.retire(); b.retire();
  });

  it('a pause the caller does not ask for keeps it in one task; every slice runs under the calling owner', async () => {
    const owner = new Scope('test.sliced');
    owners.length = 0;
    const r = new WorldRegistry();
    await withOwner(owner, () => placeSliced(rock, copies(4), { ctx, draw: 'merged', registry: r }, () => new Promise<void>((resolve) => { setTimeout(resolve, 0); })));
    expect(owners).toHaveLength(4);
    expect(owners.every((o) => o === owner)).toBe(true);
    let asked = 0;
    await placeSliced(rock, copies(4), { ctx, draw: 'merged', registry: r }, () => { asked++; return null; });
    expect(asked).toBeGreaterThan(0);
    r.retire(); owner.dispose();
  });
});
