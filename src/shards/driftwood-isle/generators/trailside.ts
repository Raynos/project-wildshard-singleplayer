import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext, type ModelBuild, type ModelPart, type Placement } from '@wildshard/engine/models/model';
import type { BoxSpec } from '@wildshard/engine/physics/box';
import { fencePost, plankStep, signpost, trailPart, TRAIL_COLOURS as C, type PlankStepParams, type SignpostParams } from '../models/trailside';
import { flightOf, trailsideSpecKey, type TrailsideSpec } from '../world/trailsideLayout';

const isParts = (b: ModelBuild): b is readonly ModelPart[] => Array.isArray(b);
/** Original static trail geometry plus the model placements and their exact world boxes. */
export interface TrailsideGeometry {
  geometry: THREE.BufferGeometry;
  metadata: {
    specKey: string;
    posts: { pls: Placement<Record<string, never>>[]; boxes: number[] };
    signs: { pls: Placement<SignpostParams>[]; boxes: number[] };
    planks: { pls: Placement<PlankStepParams>[]; boxes: number[] };
    colliders: BoxSpec[];
  };
}
/** Offline original weld; the supplied native height binding is the sole terrain authority. */
export function trailsideGeometry(spec: TrailsideSpec, heightAt: (x: number, z: number) => number): TrailsideGeometry {
  const ctx = modelContext(null), material = new THREE.MeshStandardMaterial();
  // Only geometry is retained; prime the models' shared material slot without a renderer or a sky service.
  ctx.once('driftwood-isle/trail:material', () => material);
  const colliders: BoxSpec[] = [];
    const rng = new Rng(SEED ^ 0x7a11);
    const parts: THREE.BufferGeometry[] = [];
    const add = trailPart(parts, rng);
    // a model's copy, built here from the trail's stream, stood at (x, y, z) and welded in; its world box kept
    const box = new THREE.Box3();
    const weld = (built: ModelBuild, x: number, y: number, z: number, boxes: number[]): boolean => {
      const part = isParts(built) ? built[0] : undefined;
      if (!part) return false;
      const g = part.geometry.translate(x, y, z);
      parts.push(g);
      g.computeBoundingBox();
      box.copy(g.boundingBox ?? box);
      boxes.push(box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z);
      return true;
    };
    const posts: { pls: Placement<Record<string, never>>[]; boxes: number[] } = { pls: [], boxes: [] };
    const signs: { pls: Placement<SignpostParams>[]; boxes: number[] } = { pls: [], boxes: [] };
    const planks: { pls: Placement<PlankStepParams>[]; boxes: number[] } = { pls: [], boxes: [] };
    const beam = (a: THREE.Vector3, b: THREE.Vector3, r: number, col: THREE.Color) => {
      const len = a.distanceTo(b), g = new THREE.CylinderGeometry(r, r, len, 4, 1, true);
      g.translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
      g.translate(a.x, a.y, a.z);
      add(g, col, 0.04);
    };

    // ── rope fences: a post every `spacing` metres along the polyline, rope in three sagging pieces ──
    for (const f of spec.fences) {
      const spacing = f.spacing ?? 2.6;
      const line: THREE.Vector3[] = [];
      for (let i = 0; i < f.path.length - 1; i++) {
        const pa = f.path[i], pb = f.path[i + 1];
        if (!pa || !pb) continue;
        const [ax, az] = pa, [bx, bz] = pb;
        const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / spacing));
        for (let k = i === 0 ? 0 : 1; k <= n; k++) { const t = k / n; const x = ax + (bx - ax) * t, z = az + (bz - az) * t; line.push(new THREE.Vector3(x, heightAt(x, z), z)); }
      }
      // thick weathered pilings, a rope lashing under the cap, the rope sagging in a catenary between them (E43)
      for (const p of line) {
        if (weld(fencePost.build(ctx, {}, rng), p.x, p.y, p.z, posts.boxes)) posts.pls.push({ x: p.x, y: p.y, z: p.z });
        colliders.push({ x: p.x, z: p.z, hw: 0.16, hd: 0.16, rot: 0, yTop: p.y + 1.2, yBottom: p.y - 1 });
      }
      for (let i = 0; i < line.length - 1; i++) {
        const pa = line[i], pb = line[i + 1];
        if (!pa || !pb) continue;
        const a = pa.clone().setY(pa.y + 1.0), b = pb.clone().setY(pb.y + 1.0);
        const seg = 6, sag = 0.1 + a.distanceTo(b) * 0.06;
        let prev = a;
        for (let k = 1; k <= seg; k++) {
          const t = k / seg, q = a.clone().lerp(b, t); q.y -= sag * 4 * t * (1 - t);
          beam(prev, q, 0.035, C.rope); prev = q;
        }
      }
    }
    // ── plank steps: treads every 0.7 m along a climb, each let into the slope ──
    // A tread rolls with the ground across it (E118): where a climb crosses a hillside — the headland ramp past its crest —
    // a level tread at its centre's height sank its uphill end into the sand. The side rails follow the ground in short
    // runs instead of one straight beam from the bottom to the top (that one went metres under the crest).
    for (const s of spec.steps) {
      const w = s.width ?? 2.4;
      const dx = s.to[0] - s.from[0], dz = s.to[1] - s.from[1], len = Math.hypot(dx, dz), n = Math.floor(len / 0.7);
      const ang = Math.atan2(dx, dz), ax = Math.cos(ang), az = -Math.sin(ang); // the tread's local +x (across), in the world
      const at = (t: number): [number, number] => [s.from[0] + dx * t, s.from[1] + dz * t];
      for (let i = 0; i <= n; i++) {
        const [x, z] = at(i / n), hw = w / 2;
        const lo = heightAt(x - ax * hw, z - az * hw), hi = heightAt(x + ax * hw, z + az * hw);
        const y = Math.max(heightAt(x, z), (lo + hi) / 2);
        const params: PlankStepParams = { w, roll: Math.atan2(hi - lo, w), yaw: ang, dark: i % 2 === 1 };
        if (weld(plankStep.build(ctx, params, rng), x, y, z, planks.boxes)) planks.pls.push({ x, y, z, params });
      }
      const runs = Math.max(1, Math.round(len / 2.8));
      for (const side of [-1, 1]) {
        const o = side * (w / 2 + 0.05);
        const rail = (t: number): THREE.Vector3 => { const [x, z] = at(t), rx = x + ax * o, rz = z + az * o; return new THREE.Vector3(rx, heightAt(rx, rz) + 0.1, rz); };
        for (let r = 0; r < runs; r++) {
          const a = rail(r / runs), b = rail((r + 1) / runs), l = a.distanceTo(b) + 0.06;
          const g = new THREE.BoxGeometry(0.12, 0.18, l);
          g.translate(0, 0, l / 2 - 0.03);
          g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize()));
          g.translate(a.x, a.y, a.z);
          add(g, C.plankDark, 0.05);
        }
      }
    }
    // ── trestle stairs: treads on two stringers, posts down to the ground every ~2.4 m, a handrail each side ──
    for (const f of spec.flights ?? []) {
      const fl = flightOf(f, heightAt), { ux, uz, sx, sz, w, m, run, rise } = fl;
      const at = (al: number, ac: number, y: number) => new THREE.Vector3(f.bottom[0] + ux * al + sx * ac, y, f.bottom[1] + uz * al + sz * ac);
      const yaw = Math.atan2(ux, uz);
      for (let i = 0; i < m; i++) {
        const c = at((i + 0.5) * run, 0, fl.yb + (i + 1) * rise - 0.035);
        const g = new THREE.BoxGeometry(w + rng.range(-0.03, 0.03), 0.07, run + 0.04); g.rotateY(yaw); g.translate(c.x, c.y, c.z);
        add(g, i % 3 === 0 ? C.plankDark : C.plank, 0.05);
      }
      const len = fl.len, slope = rise / run;
      for (const s of [-1, 1]) {
        const ac = s * (w / 2 + 0.07);
        // the stringer under the tread ends, then posts to the ground and a rail 1 m over the treads
        beam(at(-0.2, ac, fl.yb - 0.12), at(len + 0.1, ac, fl.yt - 0.1), 0.09, C.plankDark);
        beam(at(0, ac, fl.yb + 0.95), at(len, ac, fl.yt + 0.95), 0.045, C.plankDark);
        const n = Math.max(2, Math.ceil(len / 2.4));
        for (let k = 0; k <= n; k++) {
          const al = (k / n) * len, y = fl.yb + al * slope, p = at(al, ac, y), g = heightAt(p.x, p.z);
          beam(new THREE.Vector3(p.x, Math.min(g, y) - 0.4, p.z), new THREE.Vector3(p.x, y + 1.0, p.z), 0.08, C.post);
        }
      }
    }

    // ── signposts: a post with an arrow board per direction, stacked ──
    for (const sg of spec.signs) {
      const y = heightAt(sg.x, sg.z);
      const params: SignpostParams = { arrows: sg.arrows.map((a) => a.toward), labels: sg.arrows.map((a) => a.label ?? '') };
      if (weld(signpost.build(ctx, params, rng), sg.x, y, sg.z, signs.boxes)) signs.pls.push({ x: sg.x, y, z: sg.z, params });
      colliders.push({ x: sg.x, z: sg.z, hw: 0.12, hd: 0.12, rot: 0, yTop: y + 2.4, yBottom: y - 1 });
    }

    const geo = parts.length > 0 ? mergeGeometries(parts, false) : new THREE.BufferGeometry();
    geo.computeBoundingSphere();
  for (const part of parts) part.dispose();
  material.dispose();
  return { geometry: geo, metadata: { specKey: trailsideSpecKey(spec), posts, signs, planks, colliders } };
}
