// E322 F-M3: the Pine Hollow people's rig B (src/shards/pine-hollow/quest/npcRig.ts), measured on every file it rigs — the three
// people (E343: the one face each, Hunyuan3D-2's own paint) × desktop / phone. A check the rig says it passes
// is evaluated at sampled times, never assumed (the img2-character rule): the weights, the legs' split, the walk's planted
// feet, the arm raise at the shoulder.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { rigLegs } from '../../../src/shards/pine-hollow/quest/npcRig';
import { footPlan, legBones, legPose, LEG_BONE_NAMES, WALK, type LegBuilt } from '../../../src/game/systems/npc/npcRig';
import type { NpcKind } from '../../../src/shards/pine-hollow/models/people';

const DIR = new URL('../../../public/assets/pine-hollow/npcs/', import.meta.url);
/** every file the rig loads: npcModels.ts npcModelUrl — the people × the tiers (E343: one face file each, no variants) */
const FILES = ['ranger', 'trader', 'miller'].flatMap((k) => [`${k}.glb`, `${k}.phone.glb`]);

async function geometryOf(file: string): Promise<THREE.BufferGeometry> {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(new URL(file, DIR).pathname);
  const node = doc.getRoot().listNodes().find((nd) => nd.getMesh() !== null);
  const prim = node?.getMesh()?.listPrimitives()[0];
  const pos = prim?.getAttribute('POSITION');
  if (!node || !prim || !pos) throw new Error(`${file}: no mesh`);
  const m = new THREE.Matrix4().fromArray(node.getWorldMatrix());
  const n = pos.getCount(), out = new Float32Array(n * 3), e: number[] = [0, 0, 0], v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { pos.getElement(i, e); v.set(e[0] ?? 0, e[1] ?? 0, e[2] ?? 0).applyMatrix4(m); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  const idx = prim.getIndices()?.getArray();
  if (idx) g.setIndex(Array.from(idx));
  return g;
}

const kindOf = (file: string): NpcKind => (file.includes('ranger') ? 'ranger' : file.includes('trader') ? 'trader' : 'miller');
const bone = (name: string): number => LEG_BONE_NAMES.indexOf(name as (typeof LEG_BONE_NAMES)[number]);

function skinned(b: LegBuilt): { mesh: THREE.SkinnedMesh; bones: THREE.Bone[]; pose: ReturnType<typeof legPose> } {
  const bones = legBones(b), mesh = new THREE.SkinnedMesh(b.geometry, new THREE.MeshBasicMaterial());
  const root = bones[0];
  if (root) mesh.add(root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  return { mesh, bones, pose: legPose(bones, b) };
}

describe('Pine Hollow NPC rig B (E322 F-M3)', () => {
  it('rigs every person file (3 people × 2 tiers, one face each since E343)', () => { expect(FILES.length).toBe(6); });

  for (const file of FILES) {
    describe(file, () => {
      const ready = (async () => { const g = await geometryOf(file); return { g, b: rigLegs(kindOf(file), g) }; })();

      it('weights: normalised, in range, the legs split by side, the feet on the feet', async () => {
        const { b } = await ready;
        const si = b.geometry.getAttribute('skinIndex'), sw = b.geometry.getAttribute('skinWeight'), P = b.geometry.getAttribute('position');
        const H = b.height, xm = b.rest[0]?.x ?? 0;
        const right = new Set(['thighR', 'shinR', 'footR'].map(bone)), left = new Set(['thighL', 'shinL', 'footL'].map(bone));
        let worstSum = 0, maxIdx = 0, crossed = 0, footOnHips = 0;
        for (let i = 0; i < si.count; i++) {
          let s = 0, onR = 0, onL = 0, onHips = 0;
          for (let k = 0; k < 4; k++) {
            const j = si.getComponent(i, k), w = sw.getComponent(i, k);
            s += w; maxIdx = Math.max(maxIdx, w > 0 ? j : 0);
            if (right.has(j)) onR += w; if (left.has(j)) onL += w; if (j === 0) onHips += w;
          }
          worstSum = Math.max(worstSum, Math.abs(1 - s));
          const y = P.getY(i) - b.y0, x = P.getX(i) - xm;
          if (y < 0.3 * H && ((x > 0.05 * H && onR > 0.01) || (x < -0.05 * H && onL > 0.01))) crossed++;
          if (y < 0.2 * H && onHips > 0.01) footOnHips++;
        }
        expect(worstSum).toBeLessThan(1e-5);
        expect(maxIdx).toBeLessThan(LEG_BONE_NAMES.length);
        expect(crossed).toBe(0);
        expect(footOnHips).toBe(0);
        // medial / lateral: the left chain at +x, the right at −x (the person faces +z)
        expect((b.rest[bone('shoulderL')]?.x ?? 0)).toBeGreaterThan(b.rest[bone('shoulderR')]?.x ?? 0);
        expect((b.rest[bone('thighL')]?.x ?? 0)).toBeGreaterThan(b.rest[bone('thighR')]?.x ?? 0);
      });

      it('the walk: each planted ball of the foot stays put (≤ 0.01 H), the hips rise 0.015–0.025 H', async () => {
        const { b } = await ready;
        const { mesh, bones, pose } = skinned(b);
        const H = b.height, ballBone = [bone('footR'), bone('footL')];
        const inv = ballBone.map((j) => new THREE.Matrix4().copy(mesh.skeleton.boneInverses[j] ?? new THREE.Matrix4()));
        const slide = [0, 0], anchor: (THREE.Vector3 | null)[] = [null, null];
        let hipLo = Infinity, hipHi = -Infinity;
        const N = 240;
        for (let s = 0; s <= N; s++) {
          const ph = s / N, t = ph * WALK.cycle, travel = b.walkSpeed * t;
          pose({ t, talk: 0, point: 0, pointYaw: 0, look: 0, walk: 1, phase: ph });
          mesh.updateMatrixWorld(true);
          const hy = bones[0]?.position.y ?? 0;
          hipLo = Math.min(hipLo, hy); hipHi = Math.max(hipHi, hy);
          [0, 1].forEach((k) => {
            const plan = footPlan(k === 0 ? ph : (ph + 0.5) % 1);
            const fb = bones[ballBone[k] ?? 0];
            if (!fb) return;
            const w = (b.ball[k] ?? new THREE.Vector3()).clone().applyMatrix4(inv[k] ?? new THREE.Matrix4()).applyMatrix4(fb.matrixWorld);
            w.z += travel;
            if (!plan.stance) { anchor[k] = null; return; }
            const a = anchor[k];
            if (a === null || a === undefined) anchor[k] = w; else slide[k] = Math.max(slide[k] ?? 0, w.distanceTo(a));
          });
        }
        expect(slide[0]).toBeLessThan(0.01 * H);
        expect(slide[1]).toBeLessThan(0.01 * H);
        expect(hipHi - hipLo).toBeGreaterThan(0.015 * H);
        expect(hipHi - hipLo).toBeLessThan(0.03 * H);
        // walk speed in the walk band (0.30–0.60 H/s)
        expect(b.walkSpeed / H).toBeGreaterThanOrEqual(0.3);
        expect(b.walkSpeed / H).toBeLessThan(0.6);
      });

      // The edges within 0.2 H of either shoulder (a generated mesh's slivers < 0.003 H left out: a ratio on them is noise).
      // A (today's rig), measured 2026-09-30 on the phone files with this metric, Hale's point: p99 2.4–5.5×, worst 16–25×
      // (the armpit: one vertex on the arm, its neighbour on the chest). B: p99 1.5–2.1×, worst 5.6–13×. Idle: B is bound
      // in A's hang, so its idle barely moves the mesh from the bind (a breath).
      const shoulderEdges = (b: LegBuilt, inp: Parameters<ReturnType<typeof legPose>>[0]): number[] => {
        const { mesh, pose } = skinned(b);
        const P = b.geometry.getAttribute('position'), idx = b.geometry.getIndex(), H = b.height;
        const js = [b.rest[bone('shoulderR')], b.rest[bone('shoulderL')]].map((v) => v ?? new THREE.Vector3());
        const nearSet = new Set<number>();
        for (let i = 0; i < P.count; i++) { const v = new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)); if (js.some((j) => v.distanceTo(j) < 0.2 * H)) nearSet.add(i); }
        pose(inp);
        mesh.updateMatrixWorld(true);
        const posed = new Map<number, THREE.Vector3>();
        for (const i of nearSet) posed.set(i, mesh.applyBoneTransform(i, new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i))));
        const ratios: number[] = [];
        const tri = idx ? idx.count / 3 : 0;
        for (let f = 0; f < tri; f++) {
          const v = [idx?.getX(f * 3) ?? 0, idx?.getX(f * 3 + 1) ?? 0, idx?.getX(f * 3 + 2) ?? 0];
          for (let e = 0; e < 3; e++) {
            const a = v[e] ?? 0, c = v[(e + 1) % 3] ?? 0;
            if (!nearSet.has(a) || !nearSet.has(c)) continue;
            const r0 = new THREE.Vector3(P.getX(a), P.getY(a), P.getZ(a)).distanceTo(new THREE.Vector3(P.getX(c), P.getY(c), P.getZ(c)));
            if (r0 < 0.003 * H) continue;
            ratios.push((posed.get(a) ?? new THREE.Vector3()).distanceTo(posed.get(c) ?? new THREE.Vector3()) / r0);
          }
        }
        return ratios.sort((x, y) => x - y);
      };
      it('Hale\'s point: the edges round the shoulders stretch p99 < 2.5×, never past 15×', async () => {
        const { b } = await ready;
        const r = shoulderEdges(b, { t: 1.3, talk: 1, point: 1, pointYaw: 0.6, look: 0, walk: 0, phase: 0 });
        expect(r.length).toBeGreaterThan(500);
        expect(r[Math.floor(0.99 * (r.length - 1))]).toBeLessThan(2.5);
        expect(r[r.length - 1]).toBeLessThan(15);
      });
      // E350 F-X3: the generator webbed each hanging forearm (and Hale's lantern) to the coat; his point pulled the web into
      // a grey sheet (92–137 triangles past 0.3 m and 2.5×, the worst edge 1.4 m). rigLegs splits it at the seam
      // (npcRig.ts splitWebs): no triangle joins a forearm to the body, and nothing anywhere on the mesh spans the air
      it('the webs are split: no triangle joins a forearm to the body; Hale\'s point stretches nothing past 0.3 m and 2.5×', async () => {
        const { b } = await ready;
        const { mesh, pose } = skinned(b);
        const g = b.geometry, P = g.getAttribute('position'), idx = g.getIndex(), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
        const fore = new Set(['twistR', 'elbowR', 'handR', 'twistL', 'elbowL', 'handL'].map(bone)), body = new Set(['hips', 'spine', 'chest', 'thighR', 'shinR', 'footR', 'thighL', 'shinL', 'footL'].map(bone));
        const share = (i: number, s: Set<number>): number => { let w = 0; for (let k = 0; k < 4; k++) if (s.has(si.getComponent(i, k))) w += sw.getComponent(i, k); return w; };
        expect(b.webs.split + b.webs.coatOnly).toBeGreaterThan(50);
        pose({ t: 1.3, talk: 1, point: 1, pointYaw: 0.6, look: 0, walk: 0, phase: 0 });
        mesh.updateMatrixWorld(true);
        const posed = Array.from({ length: P.count }, (_, i) => mesh.applyBoneTransform(i, new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i))));
        const rest = (i: number): THREE.Vector3 => new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i));
        let joined = 0, stretched = 0;
        for (let f = 0; f < (idx?.count ?? 0); f += 3) {
          const t = [idx?.getX(f) ?? 0, idx?.getX(f + 1) ?? 0, idx?.getX(f + 2) ?? 0];
          if (t.some((i) => share(i, fore) >= 0.5) && t.some((i) => share(i, body) >= 0.5 && share(i, fore) < 0.05)) joined++;
          for (let e = 0; e < 3; e++) {
            const a = t[e] ?? 0, c = t[(e + 1) % 3] ?? 0, r0 = rest(a).distanceTo(rest(c)), r1 = (posed[a] ?? new THREE.Vector3()).distanceTo(posed[c] ?? new THREE.Vector3());
            if (r1 > 0.3 && r1 > 2.5 * r0) { stretched++; break; }
          }
        }
        expect(joined).toBe(0);
        // Hale is the one who points: none; the miller's desktop file keeps one sliver on his (never raised) right elbow
        expect(stretched).toBeLessThanOrEqual(kindOf(file) === 'ranger' ? 0 : 2);
      });
      it('idle is the bind (A\'s hang): no edge round the shoulders moves past 1.6×', async () => {
        const { b } = await ready;
        const r = shoulderEdges(b, { t: 1.3, talk: 0, point: 0, pointYaw: 0, look: 0, walk: 0, phase: 0 });
        expect(r[r.length - 1]).toBeLessThan(1.6);
        expect(r[0]).toBeGreaterThan(0.6);
      });
    });
  }
});
