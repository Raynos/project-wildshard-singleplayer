/**
 * The bullwhip's viewmodel: a leather-wrapped handle in a gloved fist and a braided thong drawn as one tube whose
 * centre line is recomputed every frame (one draw, ~200 vertices). The braid is vertex colour: two browns laid in a
 * spiral, so the plaits read without a texture. `pose(crack)` blends the hanging loop (0) into the thrown line (1).
 */
import { BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';

export const THONG_POINTS = 34;
const SIDES = 6, LENGTH = 6;
const DARK = [0.13, 0.065, 0.03] as const, LIGHT = [0.24, 0.125, 0.06] as const;
const _a = new Vector3(), _t = new Vector3(), _n = new Vector3(), _b = new Vector3(), _up = new Vector3();

export class WhipModel {
  readonly root = new Group();
  readonly thong: Mesh<BufferGeometry, MeshStandardMaterial>;
  private readonly points = Array.from({ length: THONG_POINTS }, () => new Vector3());
  private readonly radius = Array.from({ length: THONG_POINTS }, (_, i) => 0.016 * (1 - i / THONG_POINTS) + 0.0035);
  private readonly tip = new Vector3(0, 0.15, -0.02);

  constructor() {
    const leather = new MeshStandardMaterial({ color: 0x3a1f10, roughness: 0.78, metalness: 0 });
    const glove = new MeshStandardMaterial({ color: 0x1d1612, roughness: 0.9, metalness: 0 });
    const handle = new Mesh(new CylinderGeometry(0.016, 0.02, 0.3, 8), leather); handle.position.y = 0.02;
    const knob = new Mesh(new SphereGeometry(0.024, 8, 6), leather); knob.position.y = -0.13;
    const fist = new Mesh(new SphereGeometry(0.055, 10, 8), glove); fist.scale.set(1, 1.35, 0.95); fist.position.set(0.012, -0.03, 0.01);
    const geometry = new BufferGeometry(), count = THONG_POINTS * SIDES;
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(count * 3), 3));
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < THONG_POINTS; i++) for (let j = 0; j < SIDES; j++) {
      const c = (i * 2 + j) % 4 < 2 ? DARK : LIGHT, k = (i * SIDES + j) * 3;
      colors[k] = c[0]; colors[k + 1] = c[1]; colors[k + 2] = c[2];
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    const index: number[] = [];
    for (let i = 0; i < THONG_POINTS - 1; i++) for (let j = 0; j < SIDES; j++) {
      const a = i * SIDES + j, b = i * SIDES + (j + 1) % SIDES, c = a + SIDES, d = b + SIDES;
      index.push(a, c, b, b, c, d);
    }
    geometry.setIndex(index);
    this.thong = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 }));
    this.thong.frustumCulled = false;
    // the viewmodel pass (as the kit's weapons): a depth clear at 999, then the whip at 1000 in the transparent queue,
    // so the thong never clips into a dune
    const clearer = new Mesh(new BoxGeometry(0.001, 0.001, 0.001), new MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, fog: false }));
    clearer.renderOrder = 999; clearer.frustumCulled = false; clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    for (const part of [handle, knob, fist, this.thong]) { part.renderOrder = 1000; part.frustumCulled = false; part.material.transparent = true; part.material.depthWrite = true; }
    this.root.add(clearer, handle, knob, fist, this.thong);
    this.pose(0, 0);
  }

  /** `crack` 0 = the hanging loop, 1 = fully thrown; `t` sways the loop. */
  pose(crack: number, t: number): void {
    const sway = Math.sin(t * 1.7) * 0.02;
    for (let i = 0; i < THONG_POINTS; i++) {
      const u = i / (THONG_POINTS - 1), p = this.points[i];
      if (p === undefined) continue;
      // the loop: out over the knuckles, round, and down out of frame
      const ang = u * Math.PI * 1.75;
      const rx = -Math.sin(ang) * 0.17 - u * 0.12 + sway * u, ry = (Math.cos(ang) - 1) * 0.14 - u * u * 0.55, rz = -Math.sin(ang * 0.5) * 0.08;
      // the throw: the line rolls out ahead of the hand (the base first), with a travelling hump that runs to the tip
      const k = Math.min(1, Math.max(0, crack * 1.5 - u * 0.5)), roll = k * k * (3 - 2 * k);
      const hump = Math.sin(Math.PI * Math.min(1, u / Math.max(0.05, crack))) * 0.5 * (1 - crack);
      const sx = -u * 0.6, sy = hump + u * 0.25, sz = -u * LENGTH;
      p.set(this.tip.x + rx + (sx - rx) * roll, this.tip.y + ry + (sy - ry) * roll, this.tip.z + rz + (sz - rz) * roll);
    }
    this.writeTube();
  }

  private writeTube(): void {
    const pos = this.thong.geometry.getAttribute('position'), nor = this.thong.geometry.getAttribute('normal');
    for (let i = 0; i < THONG_POINTS; i++) {
      const p = this.points[i], q = this.points[Math.min(THONG_POINTS - 1, i + 1)], o = this.points[Math.max(0, i - 1)];
      if (p === undefined || q === undefined || o === undefined) continue;
      _t.subVectors(q, o).normalize();
      _up.set(0, 0, 1); if (Math.abs(_t.z) > 0.9) _up.set(1, 0, 0);
      _n.crossVectors(_t, _up).normalize(); _b.crossVectors(_t, _n);
      const r = this.radius[i] ?? 0.004;
      for (let j = 0; j < SIDES; j++) {
        const a = (j / SIDES) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), k = i * SIDES + j;
        _a.copy(_n).multiplyScalar(c).addScaledVector(_b, s);
        nor.setXYZ(k, _a.x, _a.y, _a.z);
        pos.setXYZ(k, p.x + _a.x * r, p.y + _a.y * r, p.z + _a.z * r);
      }
    }
    pos.needsUpdate = true; nor.needsUpdate = true;
  }
}
