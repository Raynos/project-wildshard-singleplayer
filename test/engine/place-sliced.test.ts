// SF67 (E461): `placeSliced` is `place` in slices. The merged draw pauses after every copy and every welded mesh; the
// result (geometry bytes, the rng stream each copy drew from, colliders, boxes, the registry piece) is `place`'s exactly,
// nothing registers before the last slice, and every slice runs under the owner the call was made in.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WorldRegistry } from '../../src/engine/world/registry';
import { modelContext, type ModelDef } from '../../src/engine/models/model';
import { type HandedBatch, place, placeSliced, type Placed } from '../../src/engine/models/place';
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

/** a model with two variants and two LODs: the instanced draws build each variant's levels once (op-hitch29) */
let lodBuilds = 0;
const tree: ModelDef<{ s: number }> = {
  id: 'shared/test-sliced-tree', name: 'Tree', category: 'nature', pipeline: 'code', file: 'test/engine/place-sliced.test.ts', defaults: { s: 1 },
  variants: [{ id: 'tall', label: 'Tall', params: { s: 2 } }, { id: 'short', label: 'Short', params: { s: 0.5 } }],
  build: (_c, p, rng) => [{ geometry: new THREE.CylinderGeometry(0.2, 0.3, p.s * (1 + rng.next()), 6), material: stone }, { geometry: new THREE.SphereGeometry(p.s, 6, 4), material: moss }],
  lods: [
    { from: 30, build: (_c, p, rng) => { lodBuilds++; return [{ geometry: new THREE.BoxGeometry(0.4, p.s * (1 + rng.next()), 0.4), material: stone }, { geometry: new THREE.OctahedronGeometry(p.s), material: moss }]; } },
    { from: 80, build: (_c, p) => { lodBuilds++; return [{ geometry: new THREE.BoxGeometry(p.s, p.s, p.s), material: moss }]; } },
  ],
  colliders: () => [{ kind: 'box', x: 0, y: 1, z: 0, hx: 0.3, hy: 1, hz: 0.3 }],
};
const forest = (n: number): { x: number; y: number; z: number; rotY: number; variant: string; color: number }[] =>
  Array.from({ length: n }, (_, i) => ({ x: i * 4, y: 0, z: (i % 3) * 5, rotY: i * 0.3, variant: i % 2 === 0 ? 'tall' : 'short', color: 0x204000 + i * 16 }));
function instances(p: Placed): number[][] {
  const out: number[][] = [];
  p.object.traverse((o) => {
    if (!(o instanceof THREE.InstancedMesh)) return;
    out.push([o.count, ...Array.from(o.instanceMatrix.array as ArrayLike<number>), ...Array.from((o.instanceColor?.array ?? []) as ArrayLike<number>)]);
  });
  return out;
}

describe('placeSliced (SF67)', () => {
  it('op-hitch29: an instanced draw pauses after every variant level and copy, and draws, collides and culls exactly as place', async () => {
    const a = new WorldRegistry(), b = new WorldRegistry();
    const sync = place(tree, forest(9), { ctx, draw: 'instanced', registry: a });
    const syncLods = lodBuilds;
    let pauses = 0, registeredMidway = false;
    const sliced = await placeSliced(tree, forest(9), { ctx, draw: 'instanced', registry: b }, () => {
      pauses++;
      if (b.pieces.length > 0) registeredMidway = true;
      return Promise.resolve();
    });
    expect(lodBuilds - syncLods).toBe(syncLods); // the same builds: 2 variants × 2 LODs each time
    expect(pauses).toBeGreaterThanOrEqual(9 + 2 * 3);
    expect(registeredMidway).toBe(false);
    expect(bytes(sliced)).toEqual(bytes(sync));
    expect(instances(sliced)).toEqual(instances(sync));
    expect(sliced.colliders).toEqual(sync.colliders);
    for (let i = 0; i < 9; i++) expect(sliced.copyBox(i, new THREE.Box3())).toEqual(sync.copyBox(i, new THREE.Box3()));
    a.retire(); b.retire();
  });

  it('op-hitch29: a shard-culled instanced draw hands the same batches, one part per pause, as place', async () => {
    const take = (into: HandedBatch[]): { take: (h: HandedBatch) => void } => ({ take: (h) => { into.push(h); } });
    const a = new WorldRegistry(), b = new WorldRegistry(), ha: HandedBatch[] = [], hb: HandedBatch[] = [];
    const sync = place(tree, forest(7), { ctx, draw: 'instanced', culler: take(ha), registry: a });
    let pauses = 0;
    const sliced = await placeSliced(tree, forest(7), { ctx, draw: 'instanced', culler: take(hb), registry: b }, () => { pauses++; return null; });
    expect(pauses).toBeGreaterThanOrEqual(7 + 2 * 3 + hb.length);
    expect(hb.map((h) => [h.levels.map((l) => [l.from, l.mesh?.name ?? null, l.mesh?.count ?? -1]), h.poses.map((m) => m.toArray())]))
      .toEqual(ha.map((h) => [h.levels.map((l) => [l.from, l.mesh?.name ?? null, l.mesh?.count ?? -1]), h.poses.map((m) => m.toArray())]));
    expect(bytes(sliced)).toEqual(bytes(sync));
    expect(instances(sliced)).toEqual(instances(sync));
    expect(sliced.colliders).toEqual(sync.colliders);
    a.retire(); b.retire();
  });

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
