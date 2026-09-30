// E315 M2 (project/archive/2026-09-30-model-architecture.md): Pine Hollow's models on the contract — the hollow log's own-space
// colliders land where the old world-space builder put them; the `until` detail set of a single-drawn building drops
// with distance (the old landmark LOD, as data); and M8: the migrated Pine Hollow files never register a thing by hand
// again, and draw by hand only what they declare world.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Sky } from '../src/world/Sky';
import { WorldRegistry } from '../src/world/registry';
import { defineModel, definedModels, modelContext } from '../src/models/model';
import { copiesNear, cullPlaced, place } from '../src/models/place';
import { placeCollider, poseOf } from '../src/models/colliders';
import { hollowLog } from '../src/chunks/pine-hollow/models/hollowLog';
import { forestTree } from '../src/chunks/pine-hollow/models/forestTree';
import { mossyBoulder } from '../src/chunks/pine-hollow/models/mossyBoulder';
import { Forest } from '../src/world/Forest';

/** the migrated files' sources and the shard's setup, as text (the M8 check below) */
const SOURCES = import.meta.glob<string>(['../src/world/*.ts', '../src/main.ts', '../src/chunks/pine-hollow/world/*.ts', '../src/pinehollow/quest/*.ts'], { query: '?raw', import: 'default', eager: true });
const source = (file: string): string => { const s = SOURCES[`../${file}`]; if (s === undefined) throw new Error(`no source ${file}`); return s; };

const sky = { setupMaterial(_m: THREE.Material): void { /* nothing to prepare */ }, csm: { lightDirection: new THREE.Vector3(0, -1, 0) } } as Sky;
const ctx = modelContext(sky);

describe('Pine Hollow models (E315 M2)', () => {
  it("the hollow log's own-space colliders, placed on its bed, are the old builder's world-space boxes", () => {
    const L = { x: 112, z: -86, yaw: 0.35, len: 11, R: 1.6, r: 1.3 }, floorY = 3.7;
    // the old builder (src/pinehollow/quest/hollowLog.ts before M2), verbatim: the bed and a seven-box shell, world frame
    const cy = floorY + L.r - 0.42, bedW = 2 * Math.sqrt(L.r * L.r - (L.r - 0.42) ** 2);
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), L.yaw);
    const old: { c: THREE.Vector3; q: THREE.Quaternion; h: [number, number, number] }[] = [{ c: new THREE.Vector3(L.x, floorY - 0.25, L.z), q: qYaw.clone(), h: [L.len / 2, 0.25, bedW / 2] }];
    const T = L.R - L.r, midR = (L.R + L.r) / 2, N = 8, chord = 2 * midR * Math.tan(Math.PI / N) + 0.05;
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2;
      if (Math.abs(Math.cos(th) + 1) < 0.2) continue;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), th).premultiply(qYaw);
      const c = new THREE.Vector3(0, Math.cos(th) * midR, Math.sin(th) * midR).applyQuaternion(qYaw).add(new THREE.Vector3(L.x, cy, L.z));
      old.push({ c, q, h: [L.len / 2, T / 2, chord / 2] });
    }
    // what `place` does with them (its build needs the cabins' textures): each own-space collider carried to the pose
    const pose = poseOf({ x: L.x, y: floorY, z: L.z, yaw: L.yaw });
    const placed = (hollowLog.colliders?.({ len: L.len, R: L.R, r: L.r }, ctx) ?? []).map((c) => { if (c.kind === 'drawn-hull') throw new Error('drawn hull'); return placeCollider(c, pose); });
    expect(placed).toHaveLength(old.length);
    // world corners of each box, old against new (the new ones carry a yaw or a rotation: the same box)
    const corners = (c: THREE.Vector3, q: THREE.Quaternion, h: readonly number[]): THREE.Vector3[] => [-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => [-1, 1].map((sz) =>
      new THREE.Vector3(sx * (h[0] ?? 0), sy * (h[1] ?? 0), sz * (h[2] ?? 0)).applyQuaternion(q).add(c))));
    placed.forEach((d, i) => {
      if (d.kind !== 'box') throw new Error('not a box');
      const q = d.rot ? new THREE.Quaternion(d.rot.x, d.rot.y, d.rot.z, d.rot.w) : new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.yaw ?? 0);
      const got = corners(new THREE.Vector3(d.x, d.y, d.z), q, [d.hx, d.hy, d.hz]), want = old[i];
      if (!want) throw new Error('no old box');
      const exp = corners(want.c, want.q, want.h);
      got.forEach((p, k) => { expect(p.distanceTo(exp[k] ?? new THREE.Vector3())).toBeLessThan(1e-9); });
    });
  });

  it("single draw: a part tagged `userData.until` is drawn only while the camera is nearer to its copy (a building's detail)", () => {
    const mat = new THREE.MeshBasicMaterial();
    const shed = defineModel({
      id: 'shared/test-until-shed', name: 'Shed', category: 'buildings', pipeline: 'code', file: 'test/models-pine-hollow.test.ts', defaults: {},
      build: () => {
        const g = new THREE.Group();
        const core = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), mat), hinge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat);
        hinge.userData['until'] = 40;
        g.add(core, hinge);
        return g;
      },
    });
    const placed = place(shed, [{ x: 0, y: 0, z: -10 }], { ctx, draw: 'single', registry: new WorldRegistry() });
    const hinge = placed.object.children[1];
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    cam.position.set(0, 1, 0); cam.lookAt(0, 1, -10); cam.updateMatrixWorld();
    cullPlaced(cam);
    expect(hinge?.visible).toBe(true);
    cam.position.set(0, 1, 45); cam.updateMatrixWorld();
    cullPlaced(cam);
    expect(hinge?.visible).toBe(false);
    expect(placed.object.children[0]?.visible).toBe(true); // untagged parts stay
  });

  it("single draw: a copy's LOD is chosen by cullPlaced, not by three — a pass that hides opaque meshes and re-renders keeps them hidden", () => {
    const mat = new THREE.MeshBasicMaterial();
    const log = defineModel({
      id: 'shared/test-lod-log', name: 'Log', category: 'nature', pipeline: 'code', file: 'test/models-pine-hollow.test.ts', defaults: {},
      build: () => [{ geometry: new THREE.CylinderGeometry(1, 1, 8, 12), material: mat }],
      lods: [{ from: 60, build: () => [{ geometry: new THREE.CylinderGeometry(1, 1, 8, 6), material: mat }] }],
    });
    const placed = place(log, [{ x: 0, y: 0, z: -100 }], { ctx, draw: 'single', registry: new WorldRegistry() });
    const lod = placed.object as THREE.LOD;
    expect(lod.autoUpdate).toBe(false);
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    cam.position.set(0, 1, 0); cam.lookAt(0, 1, -1); cam.updateMatrixWorld();
    cullPlaced(cam);
    expect(lod.levels.map((l) => l.object.visible)).toEqual([false, true]);
    // n8ao hides the opaque level and renders: nothing it does to the LOD's own update may show it again
    const far = lod.levels[1]?.object;
    if (far) far.visible = false;
    lod.updateMatrixWorld();
    expect(far?.visible).toBe(false);
    cam.position.set(0, 1, -90); cam.updateMatrixWorld();
    cullPlaced(cam);
    expect(lod.levels.map((l) => l.object.visible)).toEqual([true, false]);
  });

  it("cull.cells: place()'s cell culler writes exactly what the forest floor's old CelledInstances wrote, view after view", () => {
    // the old culler (src/world/Culling.ts CelledInstances, before the E315 second pass), verbatim: its buckets and its cull
    const oldCull = (matrices: Float32Array, colors: Float32Array, pos: Float32Array, maxDist: number, cell: number, pad: number, frustum: THREE.Frustum, viewer: THREE.Vector3): { m: Float32Array; c: Float32Array; n: number } => {
      const buckets = new Map<string, number[]>();
      const n = pos.length / 3;
      for (let i = 0; i < n; i++) { const k = `${Math.floor((pos[i * 3] ?? 0) / cell)},${Math.floor((pos[i * 3 + 2] ?? 0) / cell)}`; let b = buckets.get(k); if (!b) buckets.set(k, (b = [])); b.push(i); }
      const cells: { cx: number; cy: number; cz: number; r: number; idx: number[] }[] = [];
      for (const [k, idx] of buckets) {
        const [ix = 0, iz = 0] = k.split(',').map(Number);
        let ymin = Infinity, ymax = -Infinity;
        for (const i of idx) { const y = pos[i * 3 + 1] ?? 0; if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
        cells.push({ cx: (ix + 0.5) * cell, cy: (ymin + ymax) * 0.5, cz: (iz + 0.5) * cell, r: Math.hypot(cell * 0.5, (ymax - ymin) * 0.5, cell * 0.5) + pad, idx });
      }
      const arr = new Float32Array(n * 16), col = new Float32Array(n * 3), sphere = new THREE.Sphere(), max2 = maxDist * maxDist;
      let out = 0;
      for (const c of cells) {
        const dx = c.cx - viewer.x, dz = c.cz - viewer.z;
        if (dx * dx + dz * dz > (maxDist + c.r) * (maxDist + c.r)) continue;
        sphere.center.set(c.cx, c.cy, c.cz); sphere.radius = c.r;
        if (!frustum.intersectsSphere(sphere)) continue;
        for (const i of c.idx) {
          const ex = (pos[i * 3] ?? 0) - viewer.x, ez = (pos[i * 3 + 2] ?? 0) - viewer.z;
          if (ex * ex + ez * ez > max2) continue;
          arr.set(matrices.subarray(i * 16, i * 16 + 16), out * 16); col.set(colors.subarray(i * 3, i * 3 + 3), out * 3); out++;
        }
      }
      return { m: arr.subarray(0, out * 16), c: col.subarray(0, out * 3), n: out };
    };
    let seed = 12345; // a local LCG: the same copies and views every run
    const rnd = (): number => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
    const tuft = defineModel({ id: 'shared/test-cells-tuft', name: 'Tuft', category: 'nature', pipeline: 'code', file: 'test/models-pine-hollow.test.ts', defaults: {},
      build: () => [{ geometry: new THREE.PlaneGeometry(1, 1), material: new THREE.MeshBasicMaterial() }] });
    const pls = Array.from({ length: 3000 }, () => {
      const x = (rnd() - 0.5) * 480, z = (rnd() - 0.5) * 480, y = rnd() * 30;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6), new THREE.Vector3(1, 1, 1).multiplyScalar(0.5 + rnd()));
      return { x, y, z, matrix: m, color: new THREE.Color(rnd(), rnd(), rnd()) };
    });
    const listeners: ((f: THREE.Frustum, e: THREE.Vector3) => void)[] = [];
    const placed = place(tuft, pls, { ctx, draw: 'instanced', registry: null, cull: { view: { onViewChange: (fn) => { listeners.push(fn); } }, cells: { size: 32, pad: 2.5 }, far: 62 } });
    const mesh = placed.object as THREE.InstancedMesh;
    const matrices = new Float32Array(pls.length * 16), colors = new Float32Array(pls.length * 3), pos = new Float32Array(pls.length * 3);
    pls.forEach((p, i) => { p.matrix.toArray(matrices, i * 16); colors.set([p.color.r, p.color.g, p.color.b], i * 3); pos.set([p.x, p.y, p.z], i * 3); });
    const cam = new THREE.PerspectiveCamera(84, 0.46, 0.1, 2000);
    let seen = 0;
    for (let k = 0; k < 40; k++) {
      cam.position.set((rnd() - 0.5) * 400, 1.7 + rnd() * 20, (rnd() - 0.5) * 400);
      cam.rotation.set((rnd() - 0.5) * 0.6, rnd() * 6.28, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      for (const fn of listeners) fn(frustum, cam.position);
      const want = oldCull(matrices, colors, pos, 62, 32, 2.5, frustum, cam.position);
      expect(mesh.count).toBe(want.n);
      seen += want.n;
      expect(mesh.visible).toBe(want.n > 0);
      expect(Array.from((mesh.instanceMatrix.array as Float32Array).subarray(0, want.n * 16))).toEqual(Array.from(want.m));
      expect(Array.from((mesh.instanceColor ? mesh.instanceColor.array as Float32Array : new Float32Array(0)).subarray(0, want.n * 3))).toEqual(Array.from(want.c));
    }
    expect(seen).toBeGreaterThan(500); // the views saw real copies
  });

  it("the forest's LOD bands on place(): batched and instanced copies are what the forest's own loops drew, view after view", () => {
    // four species, each part a geometry with its own vertex count (a batch's geometry id then names its source)
    const hi = 60, far = 130, twig = 24, fade = 12, V = 4;
    const plane = (n: number): THREE.BufferGeometry => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3).map((_, k) => (k % 7) * 0.3), 3)); g.setIndex(Array.from({ length: n }, (_, k) => k)); return g; };
    const kinds = ['trunk', 'trunkLo', 'hi', 'lo', 'twig', 'far'] as const;
    const geo = Array.from({ length: V }, (_, v) => Object.fromEntries(kinds.map((k, j) => [k, plane(3 * (1 + v * 10 + j))])) as Record<(typeof kinds)[number], THREE.BufferGeometry>);
    const bark = new THREE.MeshStandardMaterial(), needles = new THREE.MeshStandardMaterial(), twigs = new THREE.MeshStandardMaterial(), imp = new THREE.MeshBasicMaterial();
    const tree = defineModel<{ v: number }>({ id: 'shared/test-forest-bands', name: 'Tree', category: 'nature', pipeline: 'code', file: 'test/models-pine-hollow.test.ts', defaults: { v: 0 },
      variants: Array.from({ length: V }, (_, v) => ({ id: `s${v}`, label: `s${v}`, params: { v } })),
      build: (_c, p) => [{ geometry: geo[p.v]?.trunk ?? plane(3), material: bark, castShadow: true, receiveShadow: true, tint: false },
        { geometry: geo[p.v]?.hi ?? plane(3), material: needles, castShadow: true, receiveShadow: true, sortObjects: true },
        { geometry: geo[p.v]?.twig ?? plane(3), material: twigs, castShadow: true, receiveShadow: true, until: twig }],
      lods: [{ from: hi, build: (_c, p) => [{ geometry: geo[p.v]?.trunkLo ?? plane(3), material: bark, tint: false }, { geometry: geo[p.v]?.lo ?? plane(3), material: needles, sortObjects: true }] },
        { from: far, fade, build: (_c, p) => [{ geometry: geo[p.v]?.far ?? plane(3), material: imp, receiveShadow: true }] }],
    });
    let seed = 777; // a local LCG
    const rnd = (): number => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
    const trees = Array.from({ length: 600 }, (_, i) => ({ x: (rnd() - 0.5) * 460, y: rnd() * 20, z: (rnd() - 0.5) * 460, v: i % V, rot: rnd() * 6.28, s: 0.8 + rnd() * 0.4, tint: new THREE.Color(rnd(), rnd(), rnd()) }));
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3(), sc = new THREE.Vector3();
    const pls = trees.map((t) => ({ x: t.x, y: t.y, z: t.z, variant: `s${t.v}`, color: t.tint, matrix: new THREE.Matrix4().compose(at.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.rot), sc.set(t.s, t.s, t.s)) }));
    // the view's visibility: any pure test of (tree, distance) — the forest's is its padded frustum and shadow keep
    let phase = 0;
    const keeps = (i: number, d2: number): boolean => d2 <= 45 * 45 || ((i * 7 + phase) % 5) !== 0;
    const listeners: ((f: THREE.Frustum, e: THREE.Vector3) => void)[] = [];
    const view = { onViewChange: (fn: (f: THREE.Frustum, e: THREE.Vector3) => void): void => { listeners.push(fn); } };
    const multi = modelContext(sky, { extensions: { has: () => true } } as unknown as THREE.WebGLRenderer);
    const batched = place(tree, pls, { ctx: multi, draw: 'batched', registry: null, sortObjects: false, cull: { view, test: keeps, from: 'origin', flat: true } });
    const instanced = place(tree, pls, { ctx, draw: 'instanced', registry: null, cull: { view, test: keeps, from: 'origin', flat: true } });
    const batches = batched.object.children as THREE.BatchedMesh[];
    const batchOf = (m: THREE.Material): THREE.BatchedMesh => { const b = batches.find((x) => x.material === m); if (!b) throw new Error('no batch'); return b; };
    expect(batchOf(needles).sortObjects).toBe(true);
    expect(batchOf(bark).sortObjects).toBe(false);
    expect(batchOf(imp).receiveShadow).toBe(true);
    const vcount = (bm: THREE.BatchedMesh, i: number): number => bm.getGeometryRangeAt(bm.getGeometryIdAt(i))?.vertexCount ?? -1;
    const meshes = instanced.object.children as THREE.InstancedMesh[];
    const eye = new THREE.Vector3();
    let seen = 0;
    for (let k = 0; k < 30; k++) {
      eye.set((rnd() - 0.5) * 400, 2, (rnd() - 0.5) * 400); phase = k;
      for (const fn of listeners) fn(new THREE.Frustum(), eye);
      // the forest's own loops (src/world/Forest.ts update(), before E315's second pass), verbatim in what they decide
      const hiD2 = hi * hi, farD2 = far * far, twD2 = twig * twig, bandD2 = (far - fade) * (far - fade);
      const lists = new Map<THREE.BufferGeometry, number[]>();
      const put = (g: THREE.BufferGeometry | undefined, i: number): void => { if (!g) return; const l = lists.get(g) ?? []; l.push(i); lists.set(g, l); };
      trees.forEach((t, i) => {
        const dx = t.x - eye.x, dz = t.z - eye.z, d2 = dx * dx + dz * dz, G = geo[t.v];
        const vis = keeps(i, d2), near = d2 < hiD2, mid = d2 < farD2;
        // batched: the four batches' visibility and geometry per tree
        expect(batchOf(needles).getVisibleAt(i)).toBe(vis && mid);
        if (vis && mid) expect(vcount(batchOf(needles), i)).toBe((near ? G?.hi : G?.lo)?.getAttribute('position').count);
        expect(batchOf(bark).getVisibleAt(i)).toBe(vis && mid);
        if (vis && mid) expect(vcount(batchOf(bark), i)).toBe((near ? G?.trunk : G?.trunkLo)?.getAttribute('position').count);
        expect(batchOf(imp).getVisibleAt(i)).toBe(vis && d2 >= bandD2);
        expect(batchOf(twigs).getVisibleAt(i)).toBe(vis && d2 < twD2);
        // instanced: which band meshes the tree is written into, in tree order
        if (!vis) return;
        seen++;
        if (d2 < hiD2) { put(G?.hi, i); put(G?.trunk, i); if (d2 < twD2) put(G?.twig, i); }
        else if (d2 < farD2) { put(G?.lo, i); put(G?.trunkLo, i); }
        if (d2 >= bandD2) put(G?.far, i);
      });
      for (const m of meshes) {
        const want = lists.get(m.geometry) ?? [];
        expect(m.count, m.name).toBe(want.length);
        const arr = m.instanceMatrix.array as Float32Array, e = new Float32Array(16);
        want.forEach((i, j) => { pls[i]?.matrix.toArray(e); expect(Array.from(arr.subarray(j * 16, j * 16 + 16))).toEqual(Array.from(e)); });
        // the bark is never tinted; the rest wear their tree's tint
        if (m.material === bark) expect(m.instanceColor).toBeNull();
        else want.forEach((i, j) => { const c = trees[i]?.tint, col = m.instanceColor ? m.instanceColor.array as Float32Array : new Float32Array(0); expect(Array.from(col.subarray(j * 3, j * 3 + 3))).toEqual(Array.from(new Float32Array([c?.r ?? 0, c?.g ?? 0, c?.b ?? 0]))); });
      }
    }
    expect(seen).toBeGreaterThan(2000); // the views drew real trees in every band
  });

  it("the forest tree's own-space trunk capsule, placed on its tree, is the forest's world-space capsule", () => {
    let seed = 99;
    const rnd = (): number => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let k = 0; k < 200; k++) {
      const scale = 0.7 + rnd() * 0.6, t = { x: (rnd() - 0.5) * 400, y: rnd() * 40, z: (rnd() - 0.5) * 400, rot: rnd() * 6.28, height: (0.5 + rnd() * 30) * scale, r: 0.1 + rnd() * 0.6 };
      const want = Forest.prototype.colliderDescs.call({ trees: [t] } as unknown as Forest)[0];
      const pose = poseOf({ x: t.x, y: t.y, z: t.z, matrix: new THREE.Matrix4().compose(at.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.rot), sc.set(scale, scale, scale)) });
      const own = forestTree.colliders?.({ v: 0, height: t.height, r: t.r, scale }, ctx) ?? [];
      expect(own).toHaveLength(1);
      const got = own[0]?.kind === 'capsule' ? placeCollider(own[0], pose) : null;
      if (got?.kind !== 'capsule' || want?.kind !== 'capsule') throw new Error('not a capsule');
      for (const f of ['x', 'y', 'z', 'halfHeight', 'radius'] as const) expect(Math.abs(got[f] - want[f]), f).toBeLessThan(1e-9);
      // an upright capsule: any turn about +Y is the same solid
      if (got.rot) expect(Math.abs(got.rot.x) + Math.abs(got.rot.z)).toBeLessThan(1e-9);
    }
  });

  it("copiesNear: a named place's share of a place call — the copies standing in each circle, boxed as the call boxes them", () => {
    const stone = defineModel({ id: 'shared/test-near-stone', name: 'Stone', category: 'nature', pipeline: 'code', file: 'test/models-pine-hollow.test.ts', defaults: {},
      build: () => [{ geometry: new THREE.BoxGeometry(1, 1, 1), material: new THREE.MeshBasicMaterial() }] });
    const pls = Array.from({ length: 50 }, (_, i) => ({ x: (i % 10) * 10, y: 0, z: Math.floor(i / 10) * 10 }));
    const all = place(stone, pls, { ctx, draw: 'instanced', registry: null });
    const [a, b, none, every] = copiesNear(all, [{ x: 0, z: 0, r: 10.5 }, { x: 45, z: 20, r: 6 }, { x: 500, z: 500, r: 5 }, { x: 45, z: 20, r: 100 }]);
    expect(a?.copies).toBe(3); // (0, 0), (10, 0), (0, 10)
    expect(b?.copies).toBe(2); // (40, 20), (50, 20)
    expect(none).toBeNull();
    expect(every).toBe(all);
    const box = new THREE.Box3();
    expect(b?.copyBox(0, box).getCenter(new THREE.Vector3()).toArray()).toEqual([40, 0, 20]);
    expect(b?.nearest(new THREE.Vector3(52, 0, 21))).toBe(1);
    expect(b?.colliders).toEqual([]);
  });

  it('every Pine Hollow model says how it is made, and the tree family carries its 14 species variants', () => {
    const pine = definedModels().filter((m) => m.id.startsWith('pine-hollow/'));
    expect(pine.map((m) => m.id)).toEqual(expect.arrayContaining(['pine-hollow/hollow-log', 'pine-hollow/forest-tree', 'pine-hollow/mossy-boulder']));
    for (const m of pine) expect(['code', 'blender', 'trellis', 'hunyuan', 'cc0']).toContain(m.pipeline);
    expect(forestTree.variants?.map((v) => v.id)).toHaveLength(14);
    expect(mossyBoulder.variants).toHaveLength(6);
  });

  it('M8: the Pine Hollow files on the contract never register a thing by hand, and draw by hand only what they declare world', () => {
    /** each migrated world-side file: what it may still draw itself, and why (a file that grows one more fails) */
    const WORLD: Record<string, { why: string; draws: Partial<Record<'mergeGeometries' | 'InstancedMesh' | 'BatchedMesh' | 'Mesh', number>>; registers?: number }> = {
      'src/chunks/pine-hollow/world/props.ts': { why: '', draws: {} },
      'src/chunks/pine-hollow/world/drawnModels.ts': { why: '', draws: {} },
      'src/chunks/pine-hollow/world/places.ts': { why: '', draws: {} },
      'src/world/Undergrowth.ts': { why: '', draws: {} },
      'src/chunks/pine-hollow/world/cabins.ts': { why: '', draws: {} },
      'src/chunks/pine-hollow/world/cabinKit.ts': { why: '', draws: {} },
      'src/chunks/pine-hollow/world/timber.ts': { why: "the timber kit's glass pane (merged per building: the models' own parts)", draws: { Mesh: 1 } },
      'src/pinehollow/quest/hollowLog.ts': { why: '', draws: {} },
      'src/world/PineCrags.ts': { why: 'the ONE batch the models are placed into, sized for the face skin and the cave (world); the cave\'s light shaft and drips (effects)', draws: { BatchedMesh: 1, Mesh: 2 } },
      'src/world/PineLandmarks.ts': { why: "the waystones' glow (an effect); its lights group is added as world, without colliders", draws: { Mesh: 1 }, registers: 1 },
    };
    const strip = (s: string): string => s.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/^\s*\/\/.*$/gm, '');
    const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
    for (const [file, w] of Object.entries(WORLD)) {
      const code = strip(source(file));
      expect(count(code, /\bregisterModel\(|\bregisterSolid\(|\.add\(\{[^}]*?\bobject:|\bmodel:\s*(?:\{|true)|\baddBuilt\(/g), `${file} registers by hand`).toBeLessThanOrEqual(w.registers ?? 0);
      const got = {
        mergeGeometries: count(code, /\bmergeGeometries\(/g), InstancedMesh: count(code, /new (?:THREE\.)?InstancedMesh\(/g),
        BatchedMesh: count(code, /new (?:THREE\.)?BatchedMesh\(/g), Mesh: count(code, /new (?:THREE\.)?(?:Mesh|Points|LineSegments)\(/g),
      };
      for (const [k, n] of Object.entries(got)) expect(n, `${file}: ${k} (declared world: ${w.why || 'nothing'})`).toBeLessThanOrEqual(w.draws[k as keyof typeof got] ?? 0);
    }
    // the quest places the hollow log (a model): it never registers it by hand again
    expect(strip(source('src/pinehollow/quest/index.ts'))).not.toMatch(/registry\.add\(\{ id: 'hollow-log'/);
    // and the shard's setup never hand-registers the migrated pieces again
    const main = strip(source('src/main.ts'));
    for (const id of ['props', 'props-rocks-2', 'props-wood', 'pine-landmark-props', 'pine-crags-', 'hollow-log', 'cabins']) expect(main, id).not.toMatch(new RegExp(`registry\\.add\\(\\{ id: '${id}`));
    expect(main, 'registerPineHollowModels').not.toMatch(/registerPineHollowModels/);
  });
});
