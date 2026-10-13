import type { GustRow, UpdraftRow } from '../../data/windLook';
import { BufferGeometry, CircleGeometry, Color, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type Material, type Object3D } from 'three';
import { skyLook } from '../../world/looks';

/**
 * Visible wind as a generic system (SHARD-PLATFORM M3; ex Sky Reach's world/windFx.ts, style bible §7, loop 3): a gust is a
 * cone of streaks with tumbling petals; an updraft is a soft spiral of streaks with rising leaves round a column. A streak is
 * a crossed pair of thin quads, instanced, in the shard's `wind-streak` look (data/windLook.ts) with a per-instance tint
 * (instanceColor) and fade (`aFade`), so each effect is one draw per kind and no textures. Nothing here knows a shard: the counts, timings, colours and names are the shard's rows.
 */

/** A crossed pair of quads, `z` 0 → −1 (length 1), 1 wide; uv.x runs along the length. */
function streakGeometry(): BufferGeometry {
  const pos: number[] = [], uv: number[] = [];
  for (const [ax, ay] of [[0.5, 0], [0, 0.5]] as const) {
    const q = [[-ax, -ay, 0, 0, 0], [ax, ay, 0, 0, 1], [ax, ay, -1, 1, 1], [-ax, -ay, 0, 0, 0], [ax, ay, -1, 1, 1], [-ax, -ay, -1, 1, 0]];
    for (const [x, y, z, u, v] of q) { pos.push(x ?? 0, y ?? 0, z ?? 0); uv.push(u ?? 0, v ?? 0); }
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); return g;
}

/** The streaks' look (shared by every effect; a faint plain streak before the looks are set). */
const streakMaterial = (): Material => skyLook('wind-streak') ?? new MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false, side: DoubleSide, fog: false });

const m = new Matrix4(), q = new Quaternion(), s = new Vector3(), p = new Vector3(), fwd = new Vector3(0, 0, -1), c = new Color();
function place(mesh: InstancedMesh, i: number, at: Vector3, dir: Vector3, width: number, length: number, tint: Color, fade: number): void {
  q.setFromUnitVectors(fwd, dir); m.compose(at, q, s.set(width, width, length)); mesh.setMatrixAt(i, m);
  mesh.setColorAt(i, tint); mesh.geometry.getAttribute('aFade').setX(i, Math.max(0, fade));
}
/** A streak mesh's matrices, tints and fades moved this frame. */
function faded(mesh: InstancedMesh): void { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.geometry.getAttribute('aFade').needsUpdate = true; }
function instanced(geometry: BufferGeometry, material: Material, count: number, name: string): InstancedMesh<BufferGeometry, Material> {
  const mesh = new InstancedMesh(geometry, material, count); mesh.name = name; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage); geometry.setAttribute('aFade', new InstancedBufferAttribute(new Float32Array(count), 1).setUsage(DynamicDrawUsage));
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(count * 3), 3); mesh.instanceColor.setUsage(DynamicDrawUsage);
  for (let i = 0; i < count; i++) { m.makeScale(0, 0, 0); mesh.setMatrixAt(i, m); }
  return mesh;
}
/** Tumbling petals / leaves: small double-sided quads, normal blending; a dead one scales to nothing. */
function flakes(count: number, name: string): InstancedMesh<BufferGeometry, MeshBasicMaterial> {
  const mesh = new InstancedMesh(new CircleGeometry(0.5, 5).scale(1, 0.55, 1), new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }), count);
  mesh.name = name; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  for (let i = 0; i < count; i++) { m.makeScale(0, 0, 0); mesh.setMatrixAt(i, m); }
  return mesh;
}

interface Bit { dir: Vector3; origin: Vector3; spin: number; speed: number; width: number; warm: boolean; delay: number; size: number }
/** A gust's meshes (add them to the scene), its disposal, `fire` (a burst from a point along a direction) and its tick. */
export interface GustFx { readonly objects: readonly Object3D[]; readonly dispose: () => void; readonly fire: (from: Vector3, dir: Vector3) => void; readonly update: (dt: number) => void }

/** A gust (see the module note): `random` draws each burst's scatter (the shard's cosmetic stream). */
export function gustFx(row: GustRow, random: () => number): GustFx {
  const streaks = instanced(streakGeometry(), streakMaterial(), row.streaks, row.streakName), petals = flakes(row.petals, row.petalName);
  const tint = new Color(row.tint), warmTint = new Color(row.warm);
  const bits: Bit[] = [], leafs: Bit[] = [], spinQ = new Quaternion(), axis = new Vector3(), side = new Vector3(), up = new Vector3();
  let age = 99, from = new Vector3(), base = new Vector3(0, 0, -1);
  // nothing draws between bursts: both meshes show from `fire` until the last petal is gone
  const show = (on: boolean): void => { streaks.visible = on; petals.visible = on; }; show(false);
  const cone = (dir: Vector3, spread: number): Vector3 => {
    side.set(0, 1, 0).cross(dir); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize(); up.copy(dir).cross(side).normalize();
    const a = random() * Math.PI * 2, r = Math.sqrt(random()) * spread;
    return dir.clone().addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
  };
  return { objects: [streaks, petals],
    dispose: () => { streaks.removeFromParent(); petals.removeFromParent(); streaks.geometry.dispose(); petals.geometry.dispose(); petals.material.dispose(); streaks.dispose(); petals.dispose(); },
    fire: (origin, dir) => {
      age = 0; show(true); from = origin.clone(); base = dir.clone().normalize(); bits.length = 0; leafs.length = 0;
      // speed lines: streaks leave a wide patch around the origin and fly out along the gust, so they read as long lines
      // radiating from the crosshair, not as dots seen end-on
      side.set(0, 1, 0).cross(base).normalize(); up.copy(base).cross(side).normalize();
      for (let i = 0; i < row.streaks; i++) {
        const a = random() * Math.PI * 2, r = 0.35 + random() * row.spread * 0.5;
        const start = from.clone().addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r * 0.7);
        bits.push({ dir: cone(base, 0.16), origin: start, spin: (random() - 0.5) * 1.2, speed: row.speed * (0.75 + random() * 0.5),
          width: 0.05 + random() * 0.07, warm: random() < 0.3, delay: random() * 0.1, size: 0 });
      }
      for (let i = 0; i < row.petals; i++) leafs.push({ dir: cone(base, 0.5), origin: from.clone(), spin: (random() - 0.5) * 14, speed: row.speed * (0.35 + random() * 0.25),
        width: 0, warm: false, delay: random() * 0.08, size: 0.035 + random() * 0.03 });
      leafs.forEach((_, i) => { petals.setColorAt(i, c.setHex(row.petalColours[i % row.petalColours.length] ?? 0xffffff)); });
      if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
    },
    update: (dt) => {
      if (age > row.life + 0.2) { show(false); return; }
      age += dt;
      bits.forEach((b, i) => {
        const t = Math.max(0, age - b.delay), k = t / row.life;
        if (k <= 0 || k >= 1) { m.makeScale(0, 0, 0); streaks.setMatrixAt(i, m); return; }
        // the streak curls a little round the gust's axis as it flies (wind, not bullets)
        axis.copy(base); spinQ.setFromAxisAngle(axis, b.spin * k); const d = b.dir.clone().applyQuaternion(spinQ);
        const dist = row.start + b.speed * t * (1 - k * 0.45), length = 1 + 3.2 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5);
        p.copy(b.origin).addScaledVector(d, dist);
        const fade = Math.min(1, k * 8) * (1 - k) ** 1.3 * 0.8;
        place(streaks, i, p, d, b.width * (1 + k), length, b.warm ? warmTint : tint, fade);
      });
      leafs.forEach((b, i) => {
        const t = Math.max(0, age - b.delay), k = t / (row.life + 0.2);
        if (k <= 0 || k >= 1) { m.makeScale(0, 0, 0); petals.setMatrixAt(i, m); return; }
        p.copy(b.origin).addScaledVector(b.dir, row.start + 0.6 + b.speed * t); p.y -= 1.2 * t * t;
        q.setFromAxisAngle(axis.set(Math.sin(i), 1, Math.cos(i * 1.7)).normalize(), b.spin * t);
        m.compose(p, q, s.setScalar(b.size * (1 - k * k))); petals.setMatrixAt(i, m);
      });
      faded(streaks); petals.instanceMatrix.needsUpdate = true;
    } };
}

/** An updraft's meshes (add them to the scene) and its tick (`t`: seconds). */
export interface UpdraftFx { readonly objects: readonly Object3D[]; readonly update: (t: number) => void }

/** An updraft (see the module note): `a` → `b` is the column's axis (bottom to top). */
export function updraftFx(row: UpdraftRow, a: Vector3, b: Vector3): UpdraftFx {
  const streaks = instanced(streakGeometry(), streakMaterial(), row.streaks, row.streakName), leaves = flakes(row.leaves, row.leafName);
  for (let i = 0; i < row.leaves; i++) leaves.setColorAt(i, c.setHex(row.leafColours[i % row.leafColours.length] ?? 0xffffff));
  const axisDir = b.clone().sub(a), len = axisDir.length(); axisDir.normalize();
  const side = new Vector3(1, 0, 0).cross(axisDir).normalize().cross(axisDir).normalize(), up2 = axisDir.clone().cross(side).normalize();
  const at = (f: number, angle: number, r: number, out: Vector3): Vector3 =>
    out.copy(a).addScaledVector(axisDir, f * len).addScaledVector(side, Math.cos(angle) * r).addScaledVector(up2, Math.sin(angle) * r);
  const p2 = new Vector3(), dir = new Vector3(), tint = new Color(row.tint);
  return { objects: [streaks, leaves], update: (t) => {
    for (let i = 0; i < row.streaks; i++) {
      const f = (i / row.streaks + t * row.rate) % 1, angle = f * row.turns * Math.PI * 2 + i * 2.39996, r = row.radius * (0.8 + 0.3 * Math.sin(i * 1.7));
      at(f, angle, r, p); at(f + 0.012, angle + 0.55, r, p2); dir.copy(p2).sub(p).normalize();
      const fade = Math.sin(f * Math.PI) * 0.42;
      place(streaks, i, p2, dir, 0.07, 2.4, tint, fade);
    }
    for (let i = 0; i < row.leaves; i++) {
      const f = (i / row.leaves + t * row.rate * 0.8) % 1, angle = -f * row.turns * 1.4 * Math.PI * 2 + i * 1.3;
      at(f, angle, row.radius * 1.1, p);
      q.setFromAxisAngle(dir.set(Math.sin(i * 3.1), 1, Math.cos(i)).normalize(), t * (3 + i % 3));
      m.compose(p, q, s.setScalar(0.26 * Math.min(1, Math.sin(f * Math.PI) * 3))); leaves.setMatrixAt(i, m);
    }
    faded(streaks);
    leaves.instanceMatrix.needsUpdate = true; if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  } };
}
