import { BufferAttribute, BufferGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three';

const LEATHER = 0x5a3320, DARK = 0x2e1a12, GLOVE = 0x3a2418;
const RADIAL = 5, SEGMENTS = 28;

/** The lash: one tube whose rings are rewritten along a moving curve (no per-frame allocation). */
export class Lash {
  readonly mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
  private readonly positions: Float32Array;
  private readonly point = new Vector3(); private readonly next = new Vector3();
  private readonly side = new Vector3(); private readonly up = new Vector3(); private readonly tangent = new Vector3();
  constructor() {
    const geometry = new BufferGeometry(), rings = SEGMENTS + 1;
    this.positions = new Float32Array(rings * RADIAL * 3);
    const index: number[] = [];
    for (let s = 0; s < SEGMENTS; s++) for (let r = 0; r < RADIAL; r++) {
      const a = s * RADIAL + r, b = s * RADIAL + (r + 1) % RADIAL, c = a + RADIAL, d = b + RADIAL;
      index.push(a, c, b, b, c, d);
    }
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    geometry.setIndex(index);
    this.mesh = new Mesh(geometry, new MeshStandardMaterial({ color: LEATHER, roughness: 0.85, flatShading: true }));
    this.mesh.visible = false;
  }
  /**
   * Lays the lash from `from` towards `to` (camera space). `ext` 0 → 1 unrolls it; `wave` is the travelling
   * S-curve's height, which dies out as the lash straightens.
   */
  shape(from: Vector3, to: Vector3, ext: number, wave: number, time: number): void {
    const length = from.distanceTo(to);
    this.tangent.subVectors(to, from).normalize();
    this.side.set(1, 0, 0).cross(this.tangent).normalize(); this.up.crossVectors(this.tangent, this.side).normalize();
    for (let s = 0; s <= SEGMENTS; s++) {
      const u = s / SEGMENTS, along = u * length * ext;
      const lift = Math.sin(u * Math.PI) * wave * (1 - ext * 0.7) + Math.sin(u * 9 - time * 40) * wave * 0.25 * u;
      this.point.copy(from).addScaledVector(this.tangent, along).addScaledVector(this.side, lift).addScaledVector(this.up, -Math.sin(u * 3.1) * 0.05 * length * (1 - ext));
      const radius = 0.009 * (1 - u) + 0.0025;
      for (let r = 0; r < RADIAL; r++) {
        const a = (r / RADIAL) * Math.PI * 2;
        this.next.copy(this.point).addScaledVector(this.side, Math.cos(a) * radius).addScaledVector(this.up, Math.sin(a) * radius);
        const at = (s * RADIAL + r) * 3;
        this.positions[at] = this.next.x; this.positions[at + 1] = this.next.y; this.positions[at + 2] = this.next.z;
      }
    }
    const position = this.mesh.geometry.getAttribute('position');
    position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals(); this.mesh.geometry.computeBoundingSphere();
  }
}

export interface WhipParts { root: Group; grip: Group; coil: Mesh; lash: Lash; tip: Vector3 }

/** A braided brown leather bullwhip held in a dark glove: the handle, the knob, a coil of lash and the live lash. */
export function buildWhipModel(): WhipParts {
  const root = new Group(), grip = new Group(), leather = new MeshStandardMaterial({ color: LEATHER, roughness: 0.8, flatShading: true });
  const dark = new MeshStandardMaterial({ color: DARK, roughness: 0.9, flatShading: true });
  const handle = new Mesh(new CylinderGeometry(0.016, 0.019, 0.24, 7, 6), leather);
  const braid = handle.geometry.getAttribute('position');
  for (let i = 0; i < braid.count; i++) { const y = braid.getY(i), a = Math.atan2(braid.getZ(i), braid.getX(i)), k = 1 + Math.sin(y * 120 + a * 2) * 0.12;
    braid.setX(i, braid.getX(i) * k); braid.setZ(i, braid.getZ(i) * k); }
  handle.geometry.computeVertexNormals();
  const knob = new Mesh(new SphereGeometry(0.024, 8, 6), dark); knob.position.y = -0.13;
  const fist = new Mesh(new SphereGeometry(0.05, 8, 6), new MeshStandardMaterial({ color: GLOVE, roughness: 0.95, flatShading: true }));
  fist.scale.set(1, 1.35, 1.1); fist.position.y = -0.02;
  const cuff = new Mesh(new CylinderGeometry(0.05, 0.055, 0.08, 8), dark); cuff.position.y = -0.12;
  grip.add(handle, knob, fist, cuff);
  grip.rotation.set(-1.0, 0, -0.25);
  const coil = new Mesh(new TorusGeometry(0.075, 0.009, 5, 18), leather);
  coil.position.set(-0.03, -0.08, 0.02); coil.rotation.set(0.3, 0.9, 0);
  root.add(grip, coil);
  const lash = new Lash(); root.add(lash.mesh);
  // The keeper end of the handle in root space, where the lash leaves the hand.
  const tip = new Vector3(0, 0.12, 0).applyEuler(grip.rotation);
  return { root, grip, coil, lash, tip };
}
