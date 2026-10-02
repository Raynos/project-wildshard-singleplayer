import { BufferAttribute, BufferGeometry, CapsuleGeometry, CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three';

/** Warm saddle-leather browns: the braid's two strands, the glove, its cuff and the knob; the popper is pale cord. */
const STRAND_A = [0.46, 0.25, 0.12] as const, STRAND_B = [0.27, 0.14, 0.065] as const, POPPER = [0.78, 0.68, 0.52] as const;
const GLOVE = 0x7a4a28, CUFF = 0x5a3219, KNOB = 0x3a2214;
/** A low warm self-light: the dusk sun sits behind the player most of the time, and a backlit viewmodel reads as a black lump. */
const GLOW = 0x120804;
const RADIAL = 6, SEGMENTS = 30;

const leather = (color: number): MeshStandardMaterial => new MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, emissive: GLOW });
const braided = (): MeshStandardMaterial => new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, emissive: GLOW });

/** Paints a tube's rings with two strands laid in a spiral (the plait), so the braid reads without a texture. */
function braid(geometry: BufferGeometry, rings: number, sides: number, popperRings = 0): void {
  const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    const i = Math.floor(v / sides), j = v % sides;
    const c = i >= rings - popperRings ? POPPER : (i * 2 + j) % 4 < 2 ? STRAND_A : STRAND_B;
    colors[v * 3] = c[0]; colors[v * 3 + 1] = c[1]; colors[v * 3 + 2] = c[2];
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
}

/** The lash: one braided tube whose rings are rewritten along a moving curve (no per-frame allocation). */
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
    braid(geometry, rings, RADIAL, 2);
    this.mesh = new Mesh(geometry, braided());
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
      // Thick at the handle, a thin fall, and a frayed popper that stays a few pixels wide 7 m out.
      const radius = 0.013 * (1 - u) ** 1.5 + 0.0035 + (u > 0.93 ? 0.002 : 0);
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

/**
 * A braided leather bullwhip in a gloved fist (E374 polish, after Jake's "the custom whip we built was a lot better"):
 * the first build's warm brown glove and hand-sized loop, the rebuild's braided coil. The coil hangs from the handle's
 * fall end at rest; a crack hides it and throws the live lash.
 */
export function buildWhipModel(): WhipParts {
  const root = new Group(), grip = new Group(), glove = leather(GLOVE), cuffLeather = leather(CUFF);
  // The handle: a braided cylinder, thicker at the butt, with a turned knob.
  const handleGeometry = new CylinderGeometry(0.017, 0.021, 0.26, RADIAL, 12, true);
  braid(handleGeometry, 13, RADIAL + 1);
  const handle = new Mesh(handleGeometry, braided()); handle.position.y = 0.02;
  const knob = new Mesh(new SphereGeometry(0.025, 10, 8), leather(KNOB)); knob.position.y = -0.115; knob.scale.set(1, 0.8, 1);
  // The gloved fist round the handle: a palm, four knuckles over the front, a thumb along the top, a flared cuff.
  const palm = new Mesh(new CapsuleGeometry(0.04, 0.05, 4, 10), glove); palm.position.set(0.012, -0.04, 0.008); palm.scale.set(1.05, 1, 1.15);
  const fist = new Group(); fist.add(palm);
  for (let k = 0; k < 4; k++) {
    const finger = new Mesh(new CapsuleGeometry(0.013, 0.03, 3, 8), glove);
    finger.rotation.z = Math.PI / 2; finger.position.set(-0.012, -0.002 - k * 0.022, -0.034); fist.add(finger);
  }
  const thumb = new Mesh(new CapsuleGeometry(0.012, 0.038, 3, 8), glove); thumb.position.set(-0.03, 0.01, -0.006); thumb.rotation.set(0.2, 0, 0.45);
  const cuff = new Mesh(new CylinderGeometry(0.046, 0.06, 0.11, 12, 1, true), cuffLeather); cuff.position.set(0.02, -0.12, 0.016);
  fist.add(thumb, cuff);
  grip.add(handle, knob, fist);
  grip.rotation.set(-1.0, 0, -0.25);
  // The coil (mockup D): a small loop and a half hanging below the fist toward the bottom-right edge, its tail out of frame.
  const coilPoints: Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const s = i / 40, a = 0.6 + s * Math.PI * 3.2, r = 0.064 * (1 - 0.15 * s);
    coilPoints.push(new Vector3(0.0 + Math.cos(a) * r, -0.1 + Math.sin(a) * r - s * s * 0.06, 0.02 - s * 0.03));
  }
  coilPoints.push(new Vector3(0.02, -0.24, -0.02), new Vector3(0.05, -0.36, -0.05));
  const coilGeometry = new TubeGeometry(new CatmullRomCurve3(coilPoints), 96, 0.0085, RADIAL, false);
  braid(coilGeometry, 97, RADIAL + 1);
  const coil = new Mesh(coilGeometry, braided());
  coil.position.set(0, 0.1, -0.02); coil.rotation.set(0.1, 0.4, 0.1);
  root.add(grip, coil);
  const lash = new Lash(); root.add(lash.mesh);
  // The keeper end of the handle in root space, where the lash leaves the hand.
  const tip = new Vector3(0, 0.15, 0).applyEuler(grip.rotation);
  return { root, grip, coil, lash, tip };
}
