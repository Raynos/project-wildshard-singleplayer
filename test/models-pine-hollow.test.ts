// E315 M2 (docs/plans/MODEL-ARCHITECTURE.md): Pine Hollow's models on the contract — the hollow log's own-space
// colliders land where the old world-space builder put them; the `until` detail set of a single-drawn building drops
// with distance (the old landmark LOD, as data); and M8: the migrated Pine Hollow files never register a thing by hand
// again, and draw by hand only what they declare world.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Sky } from '../src/world/Sky';
import { WorldRegistry } from '../src/world/registry';
import { defineModel, definedModels, modelContext } from '../src/models/model';
import { cullPlaced, place } from '../src/models/place';
import { placeCollider, poseOf } from '../src/models/colliders';
import { hollowLog } from '../src/chunks/pine-hollow/models/hollowLog';
import { forestTree } from '../src/chunks/pine-hollow/models/forestTree';
import { mossyBoulder } from '../src/chunks/pine-hollow/models/mossyBoulder';

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
