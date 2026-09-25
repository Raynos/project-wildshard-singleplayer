import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Sky } from '../world/Sky';
import { heightAt, inChunk, normalAt } from '../world/Heightfield';
import { Rng } from '../core/rng';
import { loft, S, mix, sstep, srgb, type Paint } from './species/loft';
import { painterlyAnimalMaterial } from './painterlyAnimals';

/**
 * Marmots — the steppe's ambient sentries (docs/design/nalati/wolves-horses-taming.md "Sheep (ambient life)"): small
 * colonies of grey marmots around burrows. ONE InstancedMesh for every colony (one draw); the pose is a per-instance
 * `iPose` (stand 0..1 — up on the hind legs; sink 0..1 — down the burrow) folded into the instance matrix on the CPU,
 * so no custom shader: the plain shared painterly program.
 *
 *   const marmots = new Marmots(sky, seed).build(sites);  scene.add(marmots.mesh)     sites: {x, z}[] burrow centres
 *   marmots.update(dt, player.position, playerSpeed)
 *   marmots.onWhistle = (x, z) => …   a sentry saw you: Wildlife raises the awareness of animals within 30 m (+0.3)
 *
 * Behaviour: forage near the burrow (a slow shuffle, nose down), now and then one sits up as a sentry; the player
 * inside 35 m (walking) / 22 m (crouched) is seen by a sentry → it WHISTLES, the colony runs to the burrow and drops
 * out of sight for 10–18 s, then peeks back up.
 */

interface Marmot { x: number; z: number; bx: number; bz: number; yaw: number; stand: number; sink: number; state: 0 | 1 | 2 | 3; t: number; tx: number; tz: number }
// state: 0 forage, 1 sentry, 2 run home, 3 hidden

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3();

const FUR = srgb(0.62, 0.50, 0.34), BACK = srgb(0.42, 0.34, 0.25), BELLY = srgb(0.78, 0.68, 0.50), DARK = srgb(0.16, 0.12, 0.09);
const paint: Paint = (out, _x, y, _z, _nx, ny, _nz, part, t) => {
  if (part === 'eye') { out.copy(DARK); return; }
  if (part === 'tail') { mix(out, BACK, DARK, sstep(0.5, 1, t)); return; }
  out.copy(FUR);
  mix(out, out, BACK, sstep(0.2, 0.9, ny) * 0.8);
  mix(out, out, BELLY, sstep(-0.2, -0.8, ny));
  if (part === 'head') mix(out, out, DARK, sstep(0.85, 0.98, t) * 0.8 + sstep(0.26, 0.3, y) * 0.2);
};

function buildMarmotGeometry(): THREE.BufferGeometry {
  // ~0.5 m long, plump; origin at the hind feet (the stand pivot), +Z forward
  const parts = [
    loft([S(0, 0.10, -0.16, 0.02, 0.02, 0), S(0, 0.11, -0.13, 0.09, 0.08, 0), S(0, 0.12, -0.02, 0.12, 0.11, 0), S(0, 0.13, 0.10, 0.10, 0.10, 0), S(0, 0.15, 0.18, 0.07, 0.07, 0), S(0, 0.16, 0.21, 0.02, 0.02, 0)], 12, 'body', paint),
    loft([S(0, 0.16, 0.17, 0.055, 0.055, 0), S(0, 0.17, 0.22, 0.06, 0.055, 0), S(0, 0.16, 0.27, 0.042, 0.04, 0), S(0, 0.15, 0.30, 0.02, 0.02, 0)], 10, 'head', paint),
    loft([S(0, 0.11, -0.15, 0.025, 0.025, 0), S(0, 0.09, -0.23, 0.022, 0.02, 0), S(0, 0.08, -0.27, 0.01, 0.01, 0)], 6, 'tail', paint),
  ];
  for (const sx of [1, -1]) {
    parts.push(loft([S(sx * 0.07, 0.10, 0.08, 0.025, 0.025, 0), S(sx * 0.075, 0.03, 0.09, 0.02, 0.02, 0), S(sx * 0.075, 0.0, 0.1, 0.012, 0.012, 0)], 6, 'body', paint));
    const eye = new THREE.SphereGeometry(0.009, 6, 4);
    eye.translate(sx * 0.038, 0.185, 0.25);
    const n = eye.getAttribute('position').count;
    const col = new Float32Array(n * 3).fill(0.02);
    eye.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(eye);
  }
  const geos = parts.map((g) => {
    const out = new THREE.BufferGeometry();
    out.setIndex(g.index);
    out.setAttribute('position', g.getAttribute('position'));
    out.setAttribute('normal', g.getAttribute('normal'));
    out.setAttribute('color', g.getAttribute('color'));
    return out;
  });
  const merged = mergeGeometries(geos, false);
  merged.computeBoundingSphere();
  return merged;
}

export class Marmots {
  mesh!: THREE.InstancedMesh;
  onWhistle?: ((x: number, z: number) => void) | undefined;
  private list: Marmot[] = [];
  private rng: Rng;
  private acc = 0;

  constructor(private readonly sky: Sky, seed: number) { this.rng = new Rng(seed ^ 0x6a2b); }

  build(sites: { x: number; z: number }[], perSite = 5): this {
    const rng = this.rng;
    for (const s of sites) {
      if (!inChunk(s.x, s.z, 10)) continue;
      const n = rng.int(3, perSite);
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, Math.PI * 2), r = rng.range(0.5, 5);
        const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
        this.list.push({ x, z, bx: s.x + Math.cos(a) * 0.4, bz: s.z + Math.sin(a) * 0.4, yaw: rng.range(0, Math.PI * 2), stand: 0, sink: 0, state: 0, t: rng.range(1, 6), tx: x, tz: z });
      }
    }
    const mat = painterlyAnimalMaterial(this.sky);
    this.mesh = new THREE.InstancedMesh(buildMarmotGeometry(), mat, Math.max(1, this.list.length));
    this.mesh.count = this.list.length;
    this.mesh.castShadow = false; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.name = 'marmots';
    this.write();
    return this;
  }

  update(dt: number, player: THREE.Vector3, playerSpeed: number, crouched: boolean): void {
    this.acc += dt;
    const think = this.acc >= 0.1;
    if (think) this.acc = 0;
    const rng = this.rng;
    let whistled = false;
    for (const m of this.list) {
      const d = Math.hypot(player.x - m.x, player.z - m.z);
      if (think) {
        m.t -= 0.1;
        const seeR = crouched ? 22 : playerSpeed > 5 ? 45 : 35;
        if ((m.state === 0 || m.state === 1) && d < seeR && (m.state === 1 || d < seeR * 0.6)) {
          // spotted: a sentry whistles once for the colony; everyone bolts for the burrow
          if (!whistled && m.state === 1) { whistled = true; this.onWhistle?.(m.x, m.z); }
          m.state = 2; m.t = 3;
        } else if (m.state === 0 && m.t <= 0) {
          if (rng.next() < 0.3) { m.state = 1; m.t = rng.range(4, 9); }
          else { const a = rng.range(0, Math.PI * 2), r = rng.range(0.5, 3); m.tx = m.bx + Math.cos(a) * r; m.tz = m.bz + Math.sin(a) * r; m.t = rng.range(2, 6); }
        } else if (m.state === 1 && m.t <= 0) { m.state = 0; m.t = rng.range(2, 5); }
        else if (m.state === 2 && Math.hypot(m.x - m.bx, m.z - m.bz) < 0.3) { m.state = 3; m.t = rng.range(10, 18); }
        else if (m.state === 3 && m.t <= 0 && d > 25) { m.state = 1; m.t = rng.range(4, 8); }
      }
      // motion
      const run = m.state === 2;
      const tx = run || m.state === 3 ? m.bx : m.tx, tz = run || m.state === 3 ? m.bz : m.tz;
      const dx = tx - m.x, dz = tz - m.z, dd = Math.hypot(dx, dz);
      if (dd > 0.05 && m.state !== 1) {
        const sp = Math.min(dd, (run ? 3.5 : 0.35) * dt);
        m.x += (dx / dd) * sp; m.z += (dz / dd) * sp;
        m.yaw = Math.atan2(dx, dz);
      }
      m.stand += ((m.state === 1 ? 1 : 0) - m.stand) * Math.min(1, dt * 6);
      m.sink += ((m.state === 3 ? 1 : 0) - m.sink) * Math.min(1, dt * 5);
    }
    if (whistled) for (const m of this.list) if (m.state === 0 || m.state === 1) { m.state = 2; m.t = 3; }
    this.write();
  }

  private write(): void {
    this.list.forEach((m, i) => {
      const g = heightAt(m.x, m.z);
      _e.set(-m.stand * 1.25, m.yaw, 0);
      _q.setFromEuler(_e);
      _p.set(m.x, g - m.sink * 0.45, m.z);
      _s.setScalar(1);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** burrow sites: `n` spots on open, gentle ground inside the given box, seeded */
  static scatter(seed: number, n: number, box: { x0: number; x1: number; z0: number; z1: number }): { x: number; z: number }[] {
    const rng = new Rng(seed ^ 0x1717), out: { x: number; z: number }[] = [];
    for (let i = 0; i < n * 20 && out.length < n; i++) {
      const x = rng.range(box.x0, box.x1), z = rng.range(box.z0, box.z1);
      if (!inChunk(x, z, 20) || normalAt(x, z)[1] < 0.93) continue;
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 25)) continue;
      out.push({ x, z });
    }
    return out;
  }
}
