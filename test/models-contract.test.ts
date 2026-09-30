// E306 / E315 (docs/plans/MODEL-ARCHITECTURE.md, src/models/model.ts): the model contract. A model is defined once and
// placed; `place` draws it the way the old builder did (the merged path bit-identical to the loop it replaced),
// carries its own-space colliders to every placement, registers one piece per call and one catalog entry per model,
// and the static rules hold over the whole tree (scripts/check-models.mjs).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../src/core/rng';
import { WorldRegistry } from '../src/world/registry';
import type { Sky } from '../src/world/Sky';
import { rockGeometry, SHORE_ROCK } from '../src/world/rockKit';
import { defineModel, definedModels, modelContext, type Placement } from '../src/models/model';
import { cullPlaced, place, placedCopies } from '../src/models/place';
import { placeCollider, poseOf } from '../src/models/colliders';
import { placeSet } from '../src/models/sets';
import { shoreBoulder, type ShoreBoulderParams } from '../src/chunks/driftwood-isle/models/shoreBoulder';
import { checkModels } from '../scripts/check-models.mjs';

// a stand-in sky: the low-poly material only asks it to prepare the material (no renderer in a test)
const sky = { setupMaterial(_m: THREE.Material): void { /* nothing to prepare */ }, csm: { lightDirection: new THREE.Vector3(0, -1, 0) } } as Sky;
const ctx = modelContext(sky);

/** the specs the old Boulders.build looped over: position, size, turn, squash, and the slope's lean */
const SPECS = [
  { x: 10, y: 1.2, z: -40, r: 2.4, rot: 0.3, squash: 0.7, nx: 0.1, nz: -0.05 },
  { x: -32, y: 0.4, z: 18, r: 0.8, rot: 2.1, squash: 0.6, nx: -0.2, nz: 0.12 },
  { x: 55, y: 2.0, z: 60, r: 4.1, rot: 5.0, squash: 0.82, nx: 0, nz: 0.3 },
];

describe('the model contract', () => {
  it('merged: bit-identical to the loop it replaced (the shore boulder, E306 M0b)', () => {
    // the old Boulders.build, verbatim: one rng stream, moss then shape, turned yaw → lean X → lean Z → up, merged
    const rng = new Rng(0x5ea1 ^ 0x70c5), parts: THREE.BufferGeometry[] = [], hulls: Float32Array[] = [];
    for (const b of SPECS) {
      const g = rockGeometry(b.r, rng, { squash: b.squash, palette: SHORE_ROCK, moss: rng.range(0.25, 0.85), ground: -0.35 * b.r * b.squash });
      g.rotateY(b.rot); g.rotateX(b.nz * 0.6); g.rotateZ(-b.nx * 0.6);
      g.translate(b.x, b.y, b.z);
      parts.push(g);
      if (b.r > 0.9) {
        const p = g.getAttribute('position'), pts = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) { pts[i * 3] = p.getX(i) - b.x; pts[i * 3 + 1] = p.getY(i) - b.y; pts[i * 3 + 2] = p.getZ(i) - b.z; }
        hulls.push(pts);
      }
    }
    const old = mergeGeometries(parts, false);
    const placements: Placement<ShoreBoulderParams>[] = SPECS.map((b) => ({ x: b.x, y: b.y, z: b.z, yaw: b.rot, leanX: b.nz * 0.6, leanZ: -b.nx * 0.6, params: { r: b.r, squash: b.squash } }));
    const placed = place(shoreBoulder, placements, { ctx, draw: 'merged', registry: null });
    expect(placed.object).toBeInstanceOf(THREE.Mesh);
    const geo = (placed.object as THREE.Mesh).geometry;
    for (const name of ['position', 'normal', 'color']) {
      expect(Array.from(geo.getAttribute(name).array), name).toEqual(Array.from(old.getAttribute(name).array));
    }
    expect(placed.drawnAs).toBe('merged');
    expect(placed.copies).toBe(3);
    // the colliders: a hull of what each big rock draws, relative to its placement, exactly as before
    expect(placed.colliders.map((c) => c.kind)).toEqual(['hull', 'hull']);
    placed.colliders.forEach((c, i) => {
      if (c.kind !== 'hull') throw new Error('not a hull');
      expect(Array.from(c.points)).toEqual(Array.from(hulls[i] ?? []));
    });
  });

  it('instanced: one InstancedMesh per part per variant; own-space colliders carried to each placement', () => {
    const mat = new THREE.MeshBasicMaterial();
    const post = defineModel<{ h: number }>({
      id: 'shared/test-post', name: 'Post', category: 'props', pipeline: 'code', file: 'test/models-contract.test.ts', defaults: { h: 2 },
      variants: [{ id: 'tall', label: 'Tall', params: { h: 4 } }],
      build: (_c, p) => [{ geometry: new THREE.BoxGeometry(0.2, p.h, 0.2).translate(0, p.h / 2, 0), material: mat }],
      colliders: (p) => [{ kind: 'box', x: 0, y: p.h / 2, z: 0, hx: 0.1, hy: p.h / 2, hz: 0.1 }],
    });
    const pls: Placement<{ h: number }>[] = [
      { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0, yaw: Math.PI / 2 }, { x: 0, y: 1, z: 5, variant: 'tall', scale: 2 },
    ];
    const placed = place(post, pls, { ctx, draw: 'instanced', registry: null });
    const meshes = placed.object.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
    expect(meshes.map((m) => m.count).sort((x, y) => x - y)).toEqual([1, 2]); // the base variant ×2, the tall one ×1
    expect(placed.colliders).toHaveLength(3);
    const [a, b, c] = placed.colliders;
    expect(a).toMatchObject({ kind: 'box', x: 0, y: 1, z: 0, hy: 1 });
    expect(b?.kind === 'box' ? b.yaw : undefined).toBeCloseTo(Math.PI / 2, 9);
    expect(c).toMatchObject({ kind: 'box', x: 0, hy: 4, hx: 0.2 }); // tall (h 4) at scale 2: centre 4 m up + 1
    expect(c?.kind === 'box' ? c.y : 0).toBeCloseTo(5, 9);
    expect(placed.copyBox(1, new THREE.Box3()).getCenter(new THREE.Vector3()).x).toBeCloseTo(5, 6);
  });

  it('instanced with culling and LODs: only the copies in view and range, each at its level', () => {
    const mat = new THREE.MeshBasicMaterial();
    const fern = defineModel({
      id: 'shared/test-fern', name: 'Fern', category: 'nature', pipeline: 'code', file: 'test/models-contract.test.ts', defaults: {},
      build: () => [{ geometry: new THREE.ConeGeometry(0.5, 1, 6), material: mat }],
      lods: [{ from: 20, build: () => [{ geometry: new THREE.PlaneGeometry(1, 1), material: mat }] }, { from: 60, build: () => [] }],
    });
    const pls = [{ x: 0, y: 0, z: -5 }, { x: 0, y: 0, z: -30 }, { x: 0, y: 0, z: -80 }, { x: 0, y: 0, z: 10 }];
    const reg = new WorldRegistry();
    const placed = place(fern, pls, { ctx, draw: 'instanced', cull: { keepNear: 0 }, registry: reg });
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    cam.position.set(0, 1, 0); cam.lookAt(0, 1, -1); cam.updateMatrixWorld();
    cullPlaced(cam);
    const [near, far] = placed.object.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
    expect(near?.count).toBe(1); // z −5 (z +10 is behind the camera)
    expect(far?.count).toBe(1); // z −30 on the far level; z −80 is past the last level: not drawn
    expect(placed.drawnAs).toBe('instanced');
  });

  it('merged cells, batched without multi-draw, single with LODs', () => {
    const mat = new THREE.MeshBasicMaterial();
    const stone = defineModel({
      id: 'shared/test-stone', name: 'Stone', category: 'nature', pipeline: 'code', file: 'test/models-contract.test.ts', defaults: {},
      build: () => [{ geometry: new THREE.IcosahedronGeometry(0.5), material: mat }],
      lods: [{ from: 40, build: () => [{ geometry: new THREE.TetrahedronGeometry(0.5), material: mat }] }],
    });
    const pls = [{ x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 2 }, { x: 150, y: 0, z: 1 }];
    const cells = place(stone, pls, { ctx, draw: 'merged', cell: 100, registry: null });
    expect(cells.object.children).toHaveLength(2); // two cells, each a holder of its levels
    const batched = place(stone, pls, { ctx, draw: 'batched', registry: null });
    expect(batched.drawnAs).toBe('instanced'); // no renderer here: no multi-draw, the instanced path
    const single = place(stone, pls.slice(0, 1), { ctx, draw: 'single', registry: null });
    expect(single.object).toBeInstanceOf(THREE.LOD);
    expect((single.object as THREE.LOD).levels.map((l) => l.distance)).toEqual([0, 40]);
  });

  it('registers one piece per place call and one catalog entry per model, copies summed; sets group placements', () => {
    const reg = new WorldRegistry();
    const mat = new THREE.MeshBasicMaterial();
    const yurt = defineModel({
      id: 'shared/test-yurt', name: 'Yurt', category: 'buildings', pipeline: ['code', 'trellis'], file: 'test/models-contract.test.ts', defaults: {},
      build: () => [{ geometry: new THREE.CylinderGeometry(3, 3, 3), material: mat }],
    });
    const a = place(yurt, [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }], { ctx, draw: 'merged', registry: reg });
    const b = place(yurt, [{ x: 100, y: 0, z: 100 }], { ctx, draw: 'merged', registry: reg, piece: { id: 'summer-yurts' } });
    expect(reg.pieces.map((p) => p.id)).toEqual(['shared/test-yurt', 'summer-yurts']);
    const m = reg.models().find((x) => x.id === 'shared/test-yurt');
    expect(m).toMatchObject({ copies: 3, drawnAs: 'merged', pipeline: ['code', 'trellis'], live: false, category: 'buildings' });
    expect(placedCopies('shared/test-yurt')).toBe(3);
    expect(m?.worldBox?.(new THREE.Vector3(90, 0, 90))?.getCenter(new THREE.Vector3()).x).toBeCloseTo(100, 6);
    expect(reg.picks.filter((p) => p.entry === 'shared/test-yurt')).toHaveLength(2);
    const set = placeSet({ id: 'shared/test-camp', name: 'Camp', file: 'test/models-contract.test.ts', members: [a, b], registry: reg });
    expect(set.members).toEqual([{ model: 'shared/test-yurt', copies: 3 }]);
    expect(reg.sets).toHaveLength(1);
  });

  it('a props piece is a prop in the catalog (E306: it used to land under Buildings)', () => {
    const reg = new WorldRegistry();
    reg.add({ id: 't-kokpar', name: 'Kokpar field', category: 'props', file: 'x.ts', object: new THREE.Group(), model: {} });
    expect(reg.models()[0]?.category).toBe('props');
  });

  it('carries colliders through a leaning, scaled pose; treads keep their run', () => {
    const pose = poseOf({ x: 1, y: 2, z: 3, yaw: 0.5, leanX: 0.2, scale: 2 });
    const box = placeCollider({ kind: 'box', x: 0, y: 1, z: 0, hx: 1, hy: 1, hz: 1 }, pose);
    expect(box).toMatchObject({ kind: 'box', hx: 2, hy: 2, hz: 2 });
    expect(box.kind === 'box' ? box.rot : undefined).toBeDefined(); // a lean is not a yaw: a full rotation
    const up = poseOf({ x: 10, y: 0, z: 0, yaw: Math.PI });
    const treads = placeCollider({ kind: 'treads', from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 1, z: 2 }, width: 1, count: 3 }, up);
    expect(treads.kind === 'treads' ? [treads.to.x, treads.to.z] : []).toEqual([expect.closeTo(10, 9), expect.closeTo(-2, 9)]);
  });

  it('every model id is unique and every defined model says how it is made', () => {
    const ids = definedModels().map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('driftwood-isle/shore-boulder');
    for (const m of definedModels()) expect(m.pipeline.length, m.id).toBeGreaterThan(0);
    expect(() => defineModel({ ...shoreBoulder, file: 'elsewhere.ts' })).toThrow(/defined by/);
  });

  it('the static rules hold over the tree (scripts/check-models.mjs)', () => {
    expect(checkModels().violations).toEqual([]);
    // and they catch what they should
    const bad = checkModels({
      'src/world/Foo.ts': "import { defineModel } from '../models/model';\nexport const foo = defineModel({ id: 'shared/foo' });",
      'src/chunks/pine-hollow/world/x.ts': "import { yurt } from '../../nalati-grasslands/models/yurt';",
      'src/chunks/pine-hollow/models/helper.ts': 'export const k = 1;',
      'src/chunks/pine-hollow/models/stone.ts': "export const s = defineModel({ id: 'nalati-grasslands/stone' });",
      'src/models/leak.ts': "import { x } from '../chunks/driftwood-isle';",
    }).violations;
    expect(bad).toHaveLength(5);
  });
});
