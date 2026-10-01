import { CapsuleGeometry, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';

/** Segments in the braided lash; each one is an instance of one tapered cylinder. */
export const LASH_SEGMENTS = 26;
const UP = new Vector3(0, 1, 0);
const LEATHER = 0x8a5a30, DARK = 0x4a2c16, GLOVE = 0x3a2a20;

/** The camera-space bullwhip: a gloved hand, a braided handle and a lash that coils at rest and lays out on a crack. */
export class WhipModel {
  readonly root = new Group();
  readonly lash: InstancedMesh;
  private readonly tip = new Vector3(0.02, 0.17, -0.06);
  private readonly rest: Vector3[] = [];
  private readonly out: Vector3[] = [];
  private readonly points: Vector3[] = [];
  private readonly m = new Matrix4(); private readonly q = new Quaternion(); private readonly s = new Vector3(); private readonly d = new Vector3(); private readonly mid = new Vector3();

  constructor() {
    const glove = new MeshStandardMaterial({ color: GLOVE, roughness: 0.85 }), leather = new MeshStandardMaterial({ color: LEATHER, roughness: 0.7 });
    const fist = new Mesh(new CapsuleGeometry(0.055, 0.07, 4, 8), glove); fist.rotation.z = Math.PI / 2; fist.scale.set(1, 1.15, 1.25);
    const cuff = new Mesh(new CylinderGeometry(0.06, 0.07, 0.16, 10), glove); cuff.position.set(0.05, -0.1, 0.07); cuff.rotation.x = 0.9;
    const handle = new Mesh(new CylinderGeometry(0.017, 0.022, 0.26, 8), leather); handle.position.set(0.01, 0.07, -0.03); handle.rotation.x = -0.35;
    const knob = new Mesh(new SphereGeometry(0.026, 8, 6), new MeshStandardMaterial({ color: DARK, roughness: 0.6 })); knob.position.set(0.012, -0.05, 0.015);
    this.lash = new InstancedMesh(new CylinderGeometry(1, 1, 1, 6), new MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }), LASH_SEGMENTS);
    this.lash.frustumCulled = false;
    const light = new Color(LEATHER), dark = new Color(DARK);
    for (let i = 0; i < LASH_SEGMENTS; i++) this.lash.setColorAt(i, i % 2 === 0 ? light : dark);
    for (let i = 0; i <= LASH_SEGMENTS; i++) {
      const s = i / LASH_SEGMENTS, a = -0.4 + s * Math.PI * 1.75;
      // At rest: a loop hanging up and left of the hand (the mockup's coil), dropping back past the fist.
      this.rest.push(new Vector3(this.tip.x - 0.09 + Math.cos(a) * 0.1 * (1 - 0.3 * s), this.tip.y + 0.02 + Math.sin(a) * 0.13, this.tip.z - 0.03 - s * 0.05));
      this.out.push(new Vector3()); this.points.push(new Vector3());
    }
    this.root.add(fist, cuff, handle, knob, this.lash);
    this.root.position.set(0.17, -0.3, -0.42); this.root.rotation.set(0.15, -0.25, -0.12);
    this.pose(0, 0);
  }
  /** `reach` 0 = coiled, 1 = laid out ~3 m ahead; `wave` 0..1 travels a ripple down the lash as it snaps. */
  pose(reach: number, wave: number): void {
    const length = 3.1;
    for (let i = 0; i <= LASH_SEGMENTS; i++) {
      const s = i / LASH_SEGMENTS, rest = this.rest[i], out = this.out[i], p = this.points[i];
      if (rest === undefined || out === undefined || p === undefined) continue;
      const ripple = Math.sin((s - wave) * Math.PI * 3) * 0.12 * s * (1 - reach * 0.6);
      out.set(this.tip.x + ripple * 0.5, this.tip.y + 0.05 + Math.sin(s * Math.PI) * 0.12 - s * s * 0.25 + ripple, this.tip.z - s * length);
      const k = Math.min(1, Math.max(0, reach * 1.6 - s * 0.6));
      p.lerpVectors(rest, out, k);
    }
    for (let i = 0; i < LASH_SEGMENTS; i++) {
      const a = this.points[i], b = this.points[i + 1]; if (a === undefined || b === undefined) continue;
      this.d.subVectors(b, a); const len = this.d.length(); if (len < 1e-5) continue;
      this.q.setFromUnitVectors(UP, this.d.divideScalar(len)); this.mid.addVectors(a, b).multiplyScalar(0.5);
      const r = 0.012 * (1 - 0.75 * i / LASH_SEGMENTS) + 0.002;
      this.m.compose(this.mid, this.q, this.s.set(r, len * 1.04, r)); this.lash.setMatrixAt(i, this.m);
    }
    this.lash.instanceMatrix.needsUpdate = true;
  }
}
