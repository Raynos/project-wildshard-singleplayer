import { BufferAttribute, BufferGeometry, CapsuleGeometry, CatmullRomCurve3, CylinderGeometry, DataTexture, Group, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, RepeatWrapping, RGBAFormat, SphereGeometry, SRGBColorSpace, TubeGeometry, UnsignedByteType, Vector3 } from 'three';
import { duneHd, duneMesh, smoothColors, viewerLit } from '../world/meshes';

/** The hero glove's fit in the whip model's frame (metres, radians): its span, its offset and its turn. */
// round 9 (seat C: A, B and C hold big rings rising from the bottom edge, dusk-fire one low loose loop, only D a raised
// fist): the one idle hold lower, toward the four
// round 15 (the lead after round 14: a big smooth fist, knuckles to the camera; the loop under the HUD): 0.7 of its size,
// the fist and its loop above the DODGE / JUMP buttons; round 16 (seat B: the fingers still to the camera): turned the
// other way (y -0.4), the back of the hand and the cuff to the camera, the fingers round the handle, as mockup D
// round 17 (seat B, R15B-7: an upright fist with a ring hanging beside it; the mockups hold it low in the corner, leaning,
// the loop a teardrop rising from it): rolled 0.5 so the handle leans up and left, a touch larger and lower
// round 18 (the lead: re-pose it through mockup-to-model): glove-hd4, the same glove modelled with the back of the hand and
// the cuff toward the camera (art/sunscar-dunes/round-27-glove); its own frame, so a new fit
// round 21 (the lead: every mockup holds a coil hanging LOW in the lower-right corner, the handle inside the fist; the game
// held a loop up on a stick): the rig lower and pitched forward (the handle foreshortened into the fist), the coil hanging
export const HD_GLOVE = { size: 0.14, pos: [0.02, -0.19, 0] as [number, number, number], rot: [-0.5, 0.5, 0.2] as [number, number, number] }; // council round 2 (R2B-3c): the coil ~0.1 of the frame lower, laid diagonally; round 9 (seat C: A, B and C hold big rings
// rising from the bottom edge, dusk-fire one low loose loop, only D a raised fist): the one idle hold lower, toward the four // council round 2 (R2B-3c): the coil ~0.1 of the frame lower, laid diagonally

/** Warm saddle-leather browns: the braid's two strands, the glove, its cuff and the knob; the popper is pale cord. */
const STRAND_A = [0.46, 0.25, 0.12] as const, STRAND_B = [0.27, 0.14, 0.065] as const, POPPER = [0.78, 0.68, 0.52] as const;
/** The thrown lash is the handle's dark braid (loop 3: its first metre read as a pale cone against the dusk sun). */
const LASH_A = [0.24, 0.12, 0.055] as const, LASH_B = [0.13, 0.065, 0.03] as const;
// loop 4: a shade lighter than the glove, so the coil's loops read against both the fist and the dusk sand (mockup D)
const COIL_A = [0.12, 0.055, 0.022] as const, COIL_B = [0.045, 0.02, 0.009] as const; // linear: a dark brown plait // mockup D: a dark plait with warm highlights
const GLOVE = 0x7a4a28, CUFF = 0x5a3219, KNOB = 0x3a2214;
/** A low warm self-light: the dusk sun sits behind the player most of the time, and a backlit viewmodel reads as a black lump. */
const GLOW = 0x120804;
const RADIAL = 6, SEGMENTS = 30;

const leather = (color: number): MeshStandardMaterial => new MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, emissive: GLOW });
/** The lash's matte braid as a plain material (no vertex colours), for the pull's wrap coil. */
export const braidedMaterial = (): MeshStandardMaterial => new MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.85, metalness: 0, emissive: GLOW });
const braided = (): MeshStandardMaterial => new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, emissive: GLOW });

/** Paints a tube's rings with two strands laid in a spiral (the plait), so the braid reads without a texture. */
function braid(geometry: BufferGeometry, rings: number, sides: number, popperRings = 0, a: readonly number[] = STRAND_A, b: readonly number[] = STRAND_B): void {
  const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    const i = Math.floor(v / sides), j = v % sides;
    const c = i >= rings - popperRings ? POPPER : (i * 2 + j) % 4 < 2 ? a : b;
    colors[v * 3] = c[0] ?? 0; colors[v * 3 + 1] = c[1] ?? 0; colors[v * 3 + 2] = c[2] ?? 0;
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
    braid(geometry, rings, RADIAL, 2, LASH_A, LASH_B);
    // matte: a glossy lash catches the low sun along its whole near length
    const material = braided(); material.roughness = 0.85;
    this.mesh = new Mesh(geometry, material);
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
      // A thong as thick as the handle's keeper (1.3 cm) tapering fast into the thin fall, and a frayed popper that
      // stays a few pixels wide 7 m out (loop 3: the first metre was a 3 cm cone filling the lower right).
      const radius = 0.0045 * (1 - u) ** 2.5 + 0.0022 + (u > 0.93 ? 0.002 : 0);
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

/**
 * The plait's tile, made in code (round 8, council rounds 1-7: the model-space plait read as a checker tape): u along the
 * cord, v round it. Four strand columns round the cord (two face the eye, one chevron spine between them), each leaning 45 deg the other way from its neighbour, so the
 * strands meet in the chevrons a plaited thong shows (mockup D). Each strand is a raised lozenge (a crown, dark creases
 * between); the normal map carries that relief and the roughness map puts a sheen on the crowns only, so the key and
 * the viewer light give each strand its own small highlight.
 */
const PLAIT = { size: 128, columns: 4, rows: 4 } as const;
function plaitTextures(): { map: DataTexture; normal: DataTexture; rough: DataTexture } {
  const n = PLAIT.size, h = new Float32Array(n * n), tone = new Float32Array(n * n);
  const hash = (a: number, b: number): number => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = (y + 0.5) / n * PLAIT.columns, col = Math.floor(v), cv = v - col, lean = col % 2 === 0 ? 1 : -1;
    const q = (x + 0.5) / n * PLAIT.rows + lean * cv, row = Math.floor(q), across = q - row;
    // the strand's width profile (round crown, creased edges) times its fall-off into the column's spine
    const crown = Math.sin(Math.PI * across) ** 0.7 * Math.sin(Math.PI * cv) ** 0.35;
    h[y * n + x] = crown; tone[y * n + x] = hash(row + 17 * col, col * 3.1); // each strand a little lighter or darker
  }
  const map = new Uint8Array(n * n * 4), nor = new Uint8Array(n * n * 4), rough = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, c = h[i] ?? 0, t = tone[i] ?? 0.5;
    const dx = (h[y * n + (x + 1) % n] ?? 0) - (h[y * n + (x + n - 1) % n] ?? 0), dy = (h[((y + 1) % n) * n + x] ?? 0) - (h[((y + n - 1) % n) * n + x] ?? 0);
    // sRGB leather: near-black creases, a dark brown strand, a warmer worn crown
    const k = Math.min(1, Math.max(0, c)), base = 0.55 + 0.45 * k, w = 0.85 + 0.3 * t;
    // round 10 (R9B-4: the crowns' sheen read 51 against the mockup's 103): a lighter copper-brown crown for the light to catch
    map[i * 4] = Math.round(Math.min(255, (12 + 98 * base * k) * w)); map[i * 4 + 1] = Math.round(Math.min(255, (8 + 58 * base * k) * w));
    map[i * 4 + 2] = Math.round(Math.min(255, (7 + 38 * base * k) * w)); map[i * 4 + 3] = 255;
    const s = 4.0, nx = -dx * s, ny = -dy * s, l = Math.hypot(nx, ny, 1);
    nor[i * 4] = Math.round(255 * (0.5 + 0.5 * nx / l)); nor[i * 4 + 1] = Math.round(255 * (0.5 + 0.5 * ny / l)); nor[i * 4 + 2] = Math.round(255 * (0.5 + 0.5 / l)); nor[i * 4 + 3] = 255;
    rough[i * 4 + 1] = Math.round(255 * (0.92 - 0.68 * k * k)); rough[i * 4 + 3] = 255; // round 9: a sheen on each crown (strand p99 56 against the mockup's ~140)
  }
  const tex = (data: Uint8Array, srgb: boolean): DataTexture => {
    const t = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
    t.wrapS = RepeatWrapping; t.wrapT = RepeatWrapping; t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = 4; if (srgb) t.colorSpace = SRGBColorSpace; t.needsUpdate = true;
    return t;
  };
  return { map: tex(map, true), normal: tex(nor, false), rough: tex(rough, false) };
}

/**
 * E407 row 4 (the lead after round 14: every mockup shows a compact gloved fist low in the corner holding a ROUND coil of
 * plaited whip, one to two fists across; a thin cord rising from the fist read as nothing): a real coil in the held glove's own
 * frame (it spans ~2 units, ~0.13 m a unit; the handle's top at (-0.53, 0.95, 0.19)): the cord leaves the handle's top
 * into a closed coil beside the fist (round 15: see plaitedLoop), and the fall drops out of the frame behind the hand.
 */
// round 23 (seat B after round 21: one turn ~0.25 wide, its top near y 0.66; A, B and C hold TWO coils ~0.5 wide, tops near
// 0.60): the fist on the coil's right side, two turns stepped apart, a thicker cord; A / B / C: ~0.5 wide, tops 0.57-0.60
// (D's and dusk-fire's mockups hang smaller coils: one hold serves every view, three of five hold the big pair)
// round 24 (seats B and C after round 23: the coils sat ~0.22 too far left, x 0.11-0.60 against the mockups' 0.33-0.86,
// covering C's plinth, and D's and dusk-fire's mockups hang smaller loops): the handle's top at the coil's upper left
// (start 2.0), so the two turns hang to the right of it and behind the fist, smaller (rx 0.8, ry 0.85): x ~0.45-0.85, top ~0.6
// round 25 (seat B after round 24: one hoop, ~0.07 too far right and 0.05 low; the mockups' two SEPARATE loops): the second
// turn stepped up and to the left of the first (step -0.35, 0.2), the start at 1.8: two rings across x ~0.33-0.80
export const LOOP = { cord: 0.075, from: [-0.613, 0.922, -0.537], start: 1.8, rx: 0.8, ry: 0.85, face: 0.4, turns: 2, step: [-0.35, 0.2, 0.06], tail: [[-0.45, -0.4, -1.0], [-0.15, -1.8, -1.1]] } as const;

/**
 * The coil (LOOP) as one plaited tube. Round 15 (the lead after round 14: an open hook with a kink, the strands crossing
 * in front of the fingers, the loop under the HUD): a closed upright ellipse, its two turns lying close, the fall dropping
 * behind the hand. Round 17 (seat B: the mockups' loop is a teardrop rising from the fist, not a ring beside it): the
 * cord leaves the handle's top straight into the ellipse at `start` (radians), turns and leaves at its foot for the fall,
 * so no stretch of cord crosses the loop's middle. Round 21 (the lead): `start` 1.3, so the ellipse's centre is below the
 * handle's top and the coil HANGS from the fist, ~1.5 turns.
 */
function plaitedLoop(): Mesh {
  const [fx, fy, fz] = LOOP.from, a0 = LOOP.start;
  // the ellipse placed so its point at `start` is the handle's top (in the plane turned by `face`)
  const cx = fx - Math.cos(a0) * LOOP.rx * Math.cos(LOOP.face), cy = fy - Math.sin(a0) * LOOP.ry, cz = fz - Math.cos(a0) * LOOP.rx * Math.sin(LOOP.face);
  const pts: Vector3[] = [];
  // counter-clockwise as the camera sees it: up the right side, over the top, down the left; ends at the foot
  const n = 40 * LOOP.turns, sweep = Math.PI * 2 * LOOP.turns - (a0 + Math.PI * 0.5);
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + t * sweep, k = t * (LOOP.turns - 1);
    const wob = 1 - 0.04 * Math.sin(a * 3 + 0.7);
    // the ellipse's plane turned back by `face` against the glove's own turn (HD_GLOVE.rot y), so it opens to the camera
    const ex = Math.cos(a) * LOOP.rx * wob;
    pts.push(new Vector3(cx + ex * Math.cos(LOOP.face) + LOOP.step[0] * k, cy + Math.sin(a) * LOOP.ry * wob + LOOP.step[1] * k, cz + ex * Math.sin(LOOP.face) + LOOP.step[2] * k + Math.sin(a) * 0.05));
  }
  for (const q of LOOP.tail) pts.push(new Vector3(q[0], q[1], q[2]));
  return plaitedTube(pts, LOOP.cord);
}

/** A plaited cord along `pts` (true UVs, the plait tile at 45 deg, the viewer-side light and a glancing sheen). */
function plaitedTube(pts: Vector3[], cord: number): Mesh {
  const curve = new CatmullRomCurve3(pts, false, 'centripetal'), length = curve.getLength();
  const geometry = new TubeGeometry(curve, 360, cord, 12, false);
  const { map, normal, rough } = plaitTextures();
  const along = length / (PLAIT.rows * (2 * Math.PI * cord) / PLAIT.columns);
  for (const t of [map, normal, rough]) t.repeat.set(along, 1);
  const material = new MeshStandardMaterial({ map, normalMap: normal, roughnessMap: rough, roughness: 1, metalness: 0, fog: false });
  material.userData['sunscarNoRim'] = true;
  viewerLit(material, [0.42, 0.37, 0.33], 0.16);
  return new Mesh(geometry, material);
}

export interface WhipParts { root: Group; grip: Group; coil: Mesh; lash: Lash; tip: Vector3; glove: Mesh | null; hd: Group | null }

/**
 * The generated gloved fist on the braided handle (loop 2, P3: `art/sunscar-dunes/round-11-loop-2/ref-glove.jpg` →
 * Hunyuan3D-2, painted facets). Its file lies with the handle along +X from the butt, the knuckles toward +Z and the
 * cuff up; here the handle is stood on the grip's +Y (butt down, the fist at the origin), scaled to a hand's size and
 * turned about it so the cuff runs back down toward the lower-right corner and the fingers wrap away (`GLOVE_TURN`).
 */
export const GLOVE_TURN = { y: -2.06, scale: 0.55 } as const;
/** Averages the normals of every vertex at one position (round 1, R1A-2 / R1C-4: the flat facets of the generated
 *  glove read as a decimated scan; smoothed, the painted leather reads as a glove). */
function smoothNormals(g: BufferGeometry): void {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), sum = new Map<string, [number, number, number]>();
  const key = (i: number): string => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  for (let i = 0; i < p.count; i++) { const k = key(i), v = sum.get(k) ?? [0, 0, 0]; v[0] += n.getX(i); v[1] += n.getY(i); v[2] += n.getZ(i); sum.set(k, v); }
  for (let i = 0; i < p.count; i++) { const v = sum.get(key(i)) ?? [0, 1, 0], l = Math.hypot(v[0], v[1], v[2]) || 1; n.setXYZ(i, v[0] / l, v[1] / l, v[2] / l); }
  n.needsUpdate = true;
  smoothColors(g, 0.45); // check pass: fully averaged it was a clay mitt; half keeps the seams, knuckles and braid
}

function gloveMesh(): { mesh: Mesh; top: number } | null {
  const g = duneMesh('whip-glove'); if (g === null) return null;
  g.computeBoundingBox(); const b = g.boundingBox; if (b === null) return null;
  // the handle's axis: the mean of the collar just short of the keeper end (the thong curls down past it)
  const p = g.getAttribute('position'), x1 = b.max.x - 0.16, x2 = b.max.x - 0.1; let n = 0, y = 0, z = 0;
  for (let i = 0; i < p.count; i++) if (p.getX(i) > x1 && p.getX(i) < x2) { y += p.getY(i); z += p.getZ(i); n++; }
  const fist = b.min.x + (b.max.x - b.min.x) * 0.48;
  g.translate(-fist, n > 0 ? -y / n : -(b.min.y + b.max.y) / 2, n > 0 ? -z / n : -(b.min.z + b.max.z) / 2);
  g.rotateZ(Math.PI / 2); g.rotateY(GLOVE_TURN.y); g.scale(GLOVE_TURN.scale, GLOVE_TURN.scale, GLOVE_TURN.scale);
  g.computeVertexNormals(); smoothNormals(g); g.computeBoundingSphere();
  // where the lash leaves the hand: the handle's keeper end, just short of the thong's curl
  const top = (b.max.x - fist - 0.06) * GLOVE_TURN.scale;
  // Painted facets, matte; a touch of warm self-light so the backlit glove never reads as a black lump.
  // loop 4: the painted leather a little lighter (it read as one brown lump against the sand next to the bar's weapons)
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, emissive: GLOW });
  material.color.setRGB(0.42, 0.32, 0.25); // loop 5 (mockup D): dark worn brown leather, the rim picks out its edges
  return { mesh: new Mesh(g, material), top };
}

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
  // The generated glove and handle replace the code fist when its file loaded (the code fist stays the stand-in).
  const made = gloveMesh();
  if (made !== null) { handle.visible = false; knob.visible = false; fist.visible = false; grip.add(made.mesh); }
  // round 1 (R1C-4): the handle tilts forward and toward the crosshair, not straight up like a stick
  // loop 5 (mockup D): the handle runs down and back into the palm, the fist holds the coiled lash up beside it
  grip.rotation.set(made === null ? -1.2 : -0.9, 0, made === null ? -0.25 : -0.55);
  // The coil (mockup D): a small loop and a half hanging below the fist toward the bottom-right edge, its tail out of frame.
  // With the generated glove (mockup D) the coil is the real cord's weight: two and a half thin loops beside the fist.
  // loop 5 (mockup D): two big braided loops held up out of the fist, each a little apart, the fall hanging below
  const turns = made === null ? 3.2 : 2.2, loopR = made === null ? 0.064 : 0.05, cord = made === null ? 0.0085 : 0.006;
  const coilPoints: Vector3[] = [];
  for (let i = 0; i <= 80; i++) {
    const s = i / 80, a = -Math.PI / 2 + s * Math.PI * 2 * turns / 2, r = loopR * (1 - 0.12 * s);
    coilPoints.push(new Vector3(-0.005 + Math.cos(a) * r * 0.85 - s * 0.03, -0.01 + (Math.sin(a) + 1) * r, -0.02 - s * 0.03));
  }
  coilPoints.push(new Vector3(-0.02, -0.06, -0.04), new Vector3(0.0, -0.2, -0.05), new Vector3(0.02, -0.36, -0.06));
  const coilGeometry = new TubeGeometry(new CatmullRomCurve3(coilPoints), 140, cord, RADIAL, false);
  // the coil is the lash's own dark braid, a shade lighter (loop 3: the handle's pale strands read cream in the sun)
  braid(coilGeometry, 141, RADIAL + 1, 0, COIL_A, COIL_B);
  const coilMaterial = braided(); coilMaterial.roughness = 0.75; coilMaterial.userData['sunscarNoRim'] = true;
  const coil = new Mesh(coilGeometry, coilMaterial);
  if (made === null) { coil.position.set(0, 0.1, -0.02); coil.rotation.set(0.1, 0.4, 0.1); } else { coil.position.set(0.01, -0.02, -0.01); coil.rotation.set(0.05, 0.35, 0.12); }
  root.add(grip, coil);
  const lash = new Lash(); root.add(lash.mesh);
  // The keeper end of the handle in root space, where the lash leaves the hand.
  const tip = new Vector3(0, made === null ? 0.15 : made.top, 0).applyEuler(grip.rotation);
  // loop 6 (mockup D): the textured hero glove-and-coiled-whip when it loaded, posed as the reference shows it (the fist
  // at the lower right, the coils held up beside it); it replaces the facet glove and the code coil at rest
  const hd = duneHd('glove-hd4', { size: HD_GLOVE.size, by: 'span' });
  if (hd !== null) {
    hd.position.set(...HD_GLOVE.pos); hd.rotation.set(...HD_GLOVE.rot); root.add(hd);
    // the code coil in the glove model's own frame (duneHd: out → holder (scaled) → turn (centred) → the scene)
    const turn = hd.children[0]?.children[0];
    turn?.add(plaitedLoop());
    grip.visible = false; coil.visible = false;
  }
  return { root, grip, coil, lash, tip, glove: made?.mesh ?? null, hd };
}
