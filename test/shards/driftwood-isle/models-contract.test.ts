// E306 / E315 (project/archive/2026-09-30-model-architecture.md, src/engine/models/model.ts): the model contract. A model is defined once and
// placed; `place` draws it the way the old builder did (the merged path bit-identical to the loop it replaced),
// carries its own-space colliders to every placement, registers one piece per call and one catalog entry per model,
// and the static rules hold over the whole tree (scripts/check-models.mjs).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../../../src/engine/core/rng';
import { WorldRegistry } from '../../../src/engine/world/registry';
import type { SkyRig as Sky } from '../../../src/engine/world/skyRig';
import { rockGeometry, SHORE_ROCK } from '../../../src/shards/driftwood-isle/world/rockKit';
import { defineModel, definedModels, modelContext, type Placement } from '../../../src/engine/models/model';
import { cullPlaced, place, placedCopies } from '../../../src/engine/models/place';
import { placeCollider, poseOf } from '../../../src/engine/models/colliders';
import { placeSet } from '../../../src/engine/models/sets';
import { shoreBoulder, type ShoreBoulderParams } from '../../../src/shards/driftwood-isle/models/shoreBoulder';
import { checkModels } from '../../../scripts/check-models.mjs';

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
      id: 'shared/test-post', name: 'Post', category: 'props', pipeline: 'code', file: 'test/shards/driftwood-isle/models-contract.test.ts', defaults: { h: 2 },
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
      id: 'shared/test-fern', name: 'Fern', category: 'nature', pipeline: 'code', file: 'test/shards/driftwood-isle/models-contract.test.ts', defaults: {},
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
      id: 'shared/test-stone', name: 'Stone', category: 'nature', pipeline: 'code', file: 'test/shards/driftwood-isle/models-contract.test.ts', defaults: {},
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

  it('M2 knobs: a set LOD switches every copy together (one draw per level; three culls each level whole)', () => {
    const mat = new THREE.MeshBasicMaterial();
    const stone = defineModel({
      id: 'shared/test-set-stone', name: 'Stone', category: 'nature', pipeline: 'trellis', file: 'test/shards/driftwood-isle/models-contract.test.ts', defaults: {},
      build: () => [{ geometry: new THREE.IcosahedronGeometry(1, 2), material: mat, castShadow: true }],
      lods: [{ from: 60, build: () => [{ geometry: new THREE.IcosahedronGeometry(1, 0), material: mat }] }],
    });
    const pls = [{ x: 0, y: 0, z: -30 }, { x: 0, y: 0, z: -90 }, { x: 40, y: 0, z: -95 }];
    const placed = place(stone, pls, { ctx, draw: 'instanced', cull: { lodBy: 'set', flat: true, from: 'origin', far: 200 }, registry: null });
    const [near, far] = placed.object.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
    expect(near?.count).toBe(3); expect(far?.count).toBe(3); // every copy in each level, written once
    expect(near?.frustumCulled).toBe(true);
    expect([near?.visible, far?.visible]).toEqual([true, false]); // as built: the full model
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    cam.position.set(0, 50, 20); cam.lookAt(0, 0, -30); cam.updateMatrixWorld(); // 50 m up: on the ground the nearest is 50 m off
    placed.cull(cam);
    expect([near?.visible, far?.visible]).toEqual([true, false]);
    cam.position.set(0, 1, 40); cam.updateMatrixWorld(); // 70 m: the whole set at its far level
    placed.cull(cam);
    expect([near?.visible, far?.visible]).toEqual([false, true]);
    cam.position.set(0, 1, 250); cam.updateMatrixWorld(); // past `far`: nothing
    placed.cull(cam);
    expect([near?.visible, far?.visible]).toEqual([false, false]);
  });

  it('M2 knobs: a handed-in view drives the copies; a shared batch, range-only culling, a radius bias and a step', () => {
    const mat = new THREE.MeshBasicMaterial();
    const crag = defineModel({
      id: 'shared/test-crag', name: 'Crag', category: 'nature', pipeline: 'blender', file: 'test/shards/driftwood-isle/models-contract.test.ts', defaults: {},
      build: () => [{ geometry: new THREE.BoxGeometry(8, 8, 8), material: mat }],
      lods: [{ from: 50, build: () => [{ geometry: new THREE.BoxGeometry(8, 8, 8, 1, 1, 1), material: mat }] }],
    });
    const shared = new THREE.BatchedMesh(8, 4000, 8000, mat);
    shared.sortObjects = false;
    const pls = [{ x: 0, y: 0, z: -40 }, { x: 0, y: 0, z: 40 }];
    const placed = place(crag, pls, { ctx, draw: 'batched', batch: shared, cull: { frustum: false, radiusBias: 0.5, step: 1, bounds: 'sphere' }, registry: null });
    expect(placed.drawnAs).toBe('batched');
    expect(placed.object).toBe(shared); // no BatchedMesh of its own, no instanced fallback without a renderer
    expect(shared.instanceCount).toBe(2);
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    cam.position.set(0, 0, 0); cam.lookAt(0, 0, -1); cam.updateMatrixWorld();
    placed.cull(cam);
    // range only: the copy behind the camera is still shown; 40 m less half its radius (≈3.5 m) is inside the 50 m detail
    expect([shared.getVisibleAt(0), shared.getVisibleAt(1)]).toEqual([true, true]);
    const ids = [shared.getGeometryIdAt(0), shared.getGeometryIdAt(1)];
    expect(ids[0]).toBe(ids[1]);
    cam.position.set(0, 0, -0.5); cam.updateMatrixWorld(); // a half-metre move: under the step, nothing re-chosen
    placed.cull(cam);
    cam.position.set(0, 0, -14); cam.updateMatrixWorld(); // the +z copy is now 54 m − 3.5 m ≈ 50.5 m off: its far level
    placed.cull(cam);
    expect(shared.getGeometryIdAt(1)).not.toBe(ids[1]);
    expect(shared.getGeometryIdAt(0)).toBe(ids[0]);
    // a view handed in: the copies follow it, never cullPlaced
    const view: { tell: ((f: THREE.Frustum, e: THREE.Vector3) => void) | null } = { tell: null };
    const mat2 = new THREE.MeshBasicMaterial();
    const fern = defineModel({
      id: 'shared/test-view-fern', name: 'Fern', category: 'nature', pipeline: 'code', file: 'test/shards/driftwood-isle/models-contract.test.ts', defaults: {},
      build: () => [{ geometry: new THREE.ConeGeometry(0.5, 1, 6), material: mat2 }],
    });
    const ferns = place(fern, [{ x: 0, y: 0, z: -5 }, { x: 0, y: 0, z: -80 }], { ctx, draw: 'instanced', cull: { far: 50, keepNear: 0, view: { onViewChange: (fn) => { view.tell = fn; } } }, registry: null });
    const im = ferns.object as THREE.InstancedMesh;
    cam.position.set(0, 0, 0); cam.updateMatrixWorld();
    cullPlaced(cam);
    expect(im.count).toBe(0); // the camera does not drive it
    const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    expect(view.tell).not.toBeNull();
    view.tell?.(f, new THREE.Vector3(0, 0, 0));
    expect(im.count).toBe(1); // −80 is past `far`
  });

  it('M2 knobs: colliders registered a task apart (piece.split); own-space colliders read the shard context', async () => {
    const reg = new WorldRegistry();
    const mat = new THREE.MeshBasicMaterial();
    const post = defineModel<{ h: number }>({
      id: 'shared/test-split-post', name: 'Post', category: 'props', pipeline: 'code', file: 'test/shards/driftwood-isle/models-contract.test.ts', defaults: { h: 2 },
      build: () => [{ geometry: new THREE.BoxGeometry(0.2, 2, 0.2), material: mat }],
      colliders: (p, c) => [{ kind: 'box', x: 0, y: c.once('test-split-lift', () => 1), z: 0, hx: 0.1, hy: p.h / 2, hz: 0.1 }],
    });
    let ticks = 0;
    const pls = Array.from({ length: 5 }, (_, i) => ({ x: i * 3, y: 0, z: 0 }));
    const placed = place(post, pls, { ctx, draw: 'instanced', registry: reg, piece: { id: 'posts', split: { every: 2, yieldTask: () => { ticks++; return Promise.resolve(); } } } });
    expect(reg.pieces.map((p) => p.id)).toEqual(['posts']);
    expect(reg.pieces[0]?.colliders).toHaveLength(2);
    await placed.registered;
    expect(reg.pieces.map((p) => [p.id, p.colliders?.length, Boolean(p.object)])).toEqual([['posts', 2, true], ['posts-2', 2, false], ['posts-3', 1, false]]);
    expect(ticks).toBe(2);
    expect(reg.pieces[1]?.colliders?.[0]).toMatchObject({ kind: 'box', y: 1 });
  });

  it('registers one piece per place call and one catalog entry per model, copies summed; sets group placements', () => {
    const reg = new WorldRegistry();
    const mat = new THREE.MeshBasicMaterial();
    const yurt = defineModel({
      id: 'shared/test-yurt', name: 'Yurt', category: 'buildings', pipeline: ['code', 'trellis'], file: 'test/shards/driftwood-isle/models-contract.test.ts', defaults: {},
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
    const set = placeSet({ id: 'shared/test-camp', name: 'Camp', file: 'test/shards/driftwood-isle/models-contract.test.ts', members: [a, b], registry: reg });
    expect(set.members).toEqual([{ model: 'shared/test-yurt', copies: 3 }]);
    expect(reg.sets).toHaveLength(1);
  });

  it('a model\'s catalog category is its own, never guessed from the piece (E306: a props piece used to land under Buildings)', () => {
    const reg = new WorldRegistry();
    const o = new THREE.Group();
    reg.add({ id: 't-kokpar', name: 'Kokpar field', category: 'buildings', file: 'x.ts', object: o, model: { id: 't-kokpar', category: 'props', live: true, object: () => o } });
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
      'src/shards/pine-hollow/world/x.ts': "import { yurt } from '../../nalati-grasslands/models/yurt';",
      'src/shards/pine-hollow/models/helper.ts': 'export const k = 1;',
      'src/shards/pine-hollow/models/stone.ts': "export const s = defineModel({ id: 'nalati-grasslands/stone' });",
      'src/engine/models/leak.ts': "import { x } from '../../shards/driftwood-isle';",
    }).violations;
    expect(bad).toHaveLength(5);
  });
});
