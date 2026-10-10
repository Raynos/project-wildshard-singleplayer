import { type BufferGeometry, CapsuleGeometry, CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { braidColours, coilPoints as heldCoil, LashCord, plaitedCord, type CordRgb, type LashCordView } from '@wildshard/sdk/items/lashView';
import { COIL_A, COIL_B, GLOW, LASH_CORD, LOOP, PLAIT, POPPER, RADIAL, STRAND_A, STRAND_B } from '../data/whip';
import { smoothColors } from '@wildshard/sdk/looks/modelLibrary';
import { duneHd, duneMesh, heldSurface } from '../world/meshes';
import { COIL_SURFACE } from '../data/surfaces';

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

/** The code fist's leathers: the glove, its cuff and the knob (the generated glove replaces it when its file loads). */
const GLOVE = 0x7a4a28, CUFF = 0x5a3219, KNOB = 0x3a2214;

const leather = (color: number): MeshStandardMaterial => new MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, emissive: GLOW });
/** The lash's matte braid as a plain material (no vertex colours), for the pull's wrap coil. */
export const braidedMaterial = (): MeshStandardMaterial => new MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.85, metalness: 0, emissive: GLOW });
const braided = (): MeshStandardMaterial => new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, emissive: GLOW });

/** Paints a tube's rings with the plait's two strands (the handle's by default), the last `popperRings` the popper. */
const braid = (geometry: BufferGeometry, rings: number, sides: number, popperRings = 0, a: CordRgb = STRAND_A, b: CordRgb = STRAND_B): void => {
  braidColours(geometry, rings, sides, popperRings, a, b, POPPER);
};

export interface WhipParts { root: Group; grip: Group; coil: Mesh; lash: LashCordView; tip: Vector3; glove: Mesh | null; hd: Group | null }

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
  const lash = new LashCord(LASH_CORD); root.add(lash.mesh);
  // The keeper end of the handle in root space, where the lash leaves the hand.
  const tip = new Vector3(0, made === null ? 0.15 : made.top, 0).applyEuler(grip.rotation);
  // loop 6 (mockup D): the textured hero glove-and-coiled-whip when it loaded, posed as the reference shows it (the fist
  // at the lower right, the coils held up beside it); it replaces the facet glove and the code coil at rest
  const hd = duneHd('glove-hd4', { size: HD_GLOVE.size, by: 'span' });
  if (hd !== null) {
    hd.position.set(...HD_GLOVE.pos); hd.rotation.set(...HD_GLOVE.rot); root.add(hd);
    // the code coil in the glove model's own frame (duneHd: out → holder (scaled) → turn (centred) → the scene)
    const turn = hd.children[0]?.children[0];
    // the coil as one plaited tube (data/whip.ts LOOP, PLAIT), the viewer-side light and a glancing sheen
    const coilMesh = plaitedCord(heldCoil(LOOP), LOOP.cord, PLAIT);
    coilMesh.material.userData['sunscarNoRim'] = true; heldSurface(coilMesh.material, COIL_SURFACE);
    turn?.add(coilMesh);
    grip.visible = false; coil.visible = false;
  }
  return { root, grip, coil, lash, tip, glove: made?.mesh ?? null, hd };
}
