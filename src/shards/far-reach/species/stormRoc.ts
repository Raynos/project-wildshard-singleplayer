import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies, BoneDef } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { BoxGeometry, Color, ConeGeometry, Float32BufferAttribute, IcosahedronGeometry, Uint16BufferAttribute, type BufferGeometry } from 'three';
import { bindRigid, fit, skyHd, skyMesh, type SkyHd } from '../world/meshes';
import { hull } from './rig';
import { StormRocBrain } from '../runtime/stormRocBrain';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { ROC } from '../layout';
import { STRINGS } from '../strings';
import { STORM_ROC_VARIANTS } from '../runtime/variants';


const brains = new WeakMap<Animal, StormRocBrain>();
export const rocBrain = (a: Animal): StormRocBrain => { let value = brains.get(a); if (!value) { value = new StormRocBrain(a); brains.set(a, value); } return value; };
export const STORM_ROC: SpeciesRow = { id: 'far.creature.stormRoc', kind: 'stormRoc', label: STRINGS.roc, aggressive: true, blood: false,
  // bank (engine 8252e3978): it rolls into its turns, so the lap round the dais banks (round 7: 'a frontal level bird')
  flight: { altitude: ROC.y, above: 'world', climbRate: 9, diveRate: 24, lockRange: 40, bank: 0.35 },
  variants: STORM_ROC_VARIANTS,
  think: (a, ctx) => { rocBrain(a).think(ctx); }, act: (a, ctx) => { rocBrain(a).act(ctx); } };


const BODY = 0, HEAD = 1, WING_L = 2, WING_R = 3, TAIL = 4;
const wing = (side: number, bone: number): { geometry: ConeGeometry; bone: number; color: number; at: readonly [number, number, number]; rot: readonly [number, number, number] }[] => [
  { geometry: new ConeGeometry(0.9, 4.8, 4), bone, color: 0x3b3150, at: [side * 2.9, 1.6, -0.2], rot: [0, 0, side * Math.PI / 2] },
  { geometry: new ConeGeometry(0.6, 3.2, 4), bone, color: 0xd9a066, at: [side * 4.4, 1.5, -0.7], rot: [0.2, 0, side * Math.PI / 2] },
];
/** Where a wing starts (metres off the centre line): outboard of it a facet rides its wing bone. */
const ROC_WING_ROOT = 1.1;
/** The Roc's wingspan (metres). */
// E399 (mockup D: a great eagle whose wings span the portrait frame from the arena's entrance; it was 11 m)
// (round 7, the seats: mockup D's eagle spans ~0.96 of the portrait frame from the arena; at its lap ~33 m out that is ~20 m)
const ROC_SPAN = 16;
const ROC_BONES = (head: number, headY: number, tail: number): BoneDef[] => [{ name: 'body', parent: null, pos: [0, 1.6, 0] },
  { name: 'head', parent: 'body', pos: [0, headY, head] }, { name: 'wingL', parent: 'body', pos: [ROC_WING_ROOT, 1.7, 0] },
  { name: 'wingR', parent: 'body', pos: [-ROC_WING_ROOT, 1.7, 0] }, { name: 'tail', parent: 'body', pos: [0, 1.5, tail] }];
/** The code Roc: primitive parts (the stand-in while the generated model is missing). */
function rocCode(): AnimalSpecies {
  return { bones: ROC_BONES(1.6, 2.1, -1.4), furParts: [], eyeParts: [],
    hardParts: [hull([
      { geometry: new IcosahedronGeometry(1.1, 0), bone: BODY, color: 0x463a5c, at: [0, 1.6, 0], rot: [0, 0, 0] },
      { geometry: new BoxGeometry(1.3, 1, 2.4), bone: BODY, color: 0x3b3150, at: [0, 1.6, -0.2] },
      { geometry: new IcosahedronGeometry(0.55, 0), bone: HEAD, color: 0xe8dcc8, at: [0, 2.2, 1.7] },
      { geometry: new ConeGeometry(0.22, 0.8, 4), bone: HEAD, color: 0xf0b542, at: [0, 2.1, 2.4], rot: [Math.PI / 2, 0, 0] },
      ...wing(1, WING_L), ...wing(-1, WING_R),
      { geometry: new ConeGeometry(0.7, 2.2, 4), bone: TAIL, color: 0x2e2640, at: [0, 1.5, -2.4], rot: [-Math.PI / 2, 0, 0] },
      { geometry: new BoxGeometry(0.18, 1.1, 0.18), bone: BODY, color: 0xf0b542, at: [0.35, 0.55, 0.1] },
      { geometry: new BoxGeometry(0.18, 1.1, 0.18), bone: BODY, color: 0xf0b542, at: [-0.35, 0.55, 0.1] },
    ])],
    dims: { bodyY: 1.6, bodyHalfLen: 1.4, bodyRadius: 1.1, headRadius: 0.55, legLen: 1, feet: [], halfWidth: 5.5 } };
}
/**
 * The generated Roc (C6: Hunyuan3D-2 from `art/far-reach/round-7-models/ref-roc.jpg`): generated upright (the ref faces the
 * camera), so it is pitched forward to fly, its pale banded front becoming the underside you see from the crown; 11 m from
 * wing tip to wing tip, its middle at the body bone. Facets outboard of the wing roots ride the wings; along the centre line the front third
 * is the head, the back third the tail.
 */
/**
 * The Roc's underside (council R2C-2: during the dive its plain belly filled the frame): cream breast feathers with dark
 * chevrons under the body, barred flight feathers under the wings with dark tips, painted into the model's vertex colours
 * on every face that looks down.
 */
function paintUnderside(g: BufferGeometry): void {
  if (!g.hasAttribute('color')) return;
  if (!g.hasAttribute('normal')) g.computeVertexNormals();
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.getAttribute('color');
  // E399 (mockup D: a great eagle, dark brown wings with paler barred flight feathers, a cream breast; it is seen from
  // below against the low sun, so the old cream-and-slate underside read as a grey blur)
  const cream = new Color(0xe9dcc2), slate = new Color(0x3c3446), rust = new Color(0x9a5a34), brown = new Color(0x5e4230), barred = new Color(0xb39572), dusk = new Color(0x2b221c), out = new Color();
  for (let i = 0; i < p.count; i++) {
    const down = -n.getY(i); if (down < 0.25) continue;
    const x = p.getX(i), z = p.getZ(i), ax = Math.abs(x), k = Math.min(1, (down - 0.25) / 0.4);
    if (ax < ROC_WING_ROOT * 1.3) {
      // the breast: cream with dark chevrons down the body, a rust wash toward the tail
      const chevron = (((z + ax * 0.7) * 2.6) % 1 + 1) % 1 < 0.3;
      out.copy(cream).lerp(rust, Math.max(0, -z) * 0.12).lerp(slate, chevron ? 0.75 : 0);
    } else {
      // the wings: barred flight feathers, the tips dark
      const bar = ((ax * 1.7) % 1 + 1) % 1 < 0.28, tip = ax > ROC_SPAN * 0.42;
      out.copy(tip ? dusk : bar ? barred : brown);
    }
    c.setXYZ(i, c.getX(i) + (out.r - c.getX(i)) * k, c.getY(i) + (out.g - c.getY(i)) * k, c.getZ(i) + (out.b - c.getZ(i)) * k);
  }
  c.needsUpdate = true;
}
/** Rig a fitted Roc (facing +z, wings along x, its middle at the body bone): facets outboard of the wing roots ride the
 * wings; along the centre line the front third is the head, the back third the tail. */
function rocRig(g: BufferGeometry): { bones: BoneDef[]; len: number } {
  const p = g.getAttribute('position');
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < ROC_WING_ROOT) { z0 = Math.min(z0, p.getZ(i)); z1 = Math.max(z1, p.getZ(i)); }
  const len = Math.max(0.5, z1 - z0), head = z1 - len * 0.3, tail = z0 + len * 0.3;
  bindRigid(g, (x, _y, z) => x > ROC_WING_ROOT ? WING_L : x < -ROC_WING_ROOT ? WING_R : z > head ? HEAD : z < tail ? TAIL : BODY);
  return { bones: ROC_BONES(head, 1.8, tail), len };
}
/** How far below the flight line the lifted head still looks (radians): a soaring eagle eyes the ground ahead of it. */
const ROC_HEAD_DIP = 0.3;
const smooth = (a: number, b: number, v: number): number => { const k = Math.min(1, Math.max(0, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
/**
 * Skin the textured eagle with blended weights (council round 13, finding 1: 'torn: sky shows through its legs and tail').
 * Bound a whole triangle to one bone, every triangle across a wing root opened a crack as the wings flapped, and the
 * line x = ±1.1 m ran down through both legs and the tail fan. Here each vertex blends: a wing's weight eases in across
 * its root (|x| 1.3 to 2.6 m) and out again toward the tail fan, so the legs, the breast and the fan stay with the body
 * and the skin bends instead of splitting. The weights are read in the model's own upright frame (`pitch` undone:
 * `up` runs from the tail fan to the head, `fwd` out of the breast), so they hold for any flight pitch.
 */
function rocSkin(g: BufferGeometry, pitch: number): { bones: BoneDef[]; len: number } {
  const p = g.getAttribute('position'), n = p.count, c = Math.cos(pitch), s = Math.sin(pitch);
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) if (Math.abs(p.getX(i)) < ROC_WING_ROOT) { z0 = Math.min(z0, p.getZ(i)); z1 = Math.max(z1, p.getZ(i)); }
  const len = Math.max(0.5, z1 - z0), head = z1 - len * 0.3, tail = z0 + len * 0.3;
  const index = new Uint16Array(n * 4), weight = new Float32Array(n * 4), lift = new Float32Array(n);
  const upOf = (i: number): number => p.getY(i) * c + p.getZ(i) * s, fwdOf = (i: number): number => p.getZ(i) * c - p.getY(i) * s;
  let up0 = Infinity, fwd0 = Infinity;
  for (let i = 0; i < n; i++) { up0 = Math.min(up0, upOf(i)); fwd0 = Math.min(fwd0, fwdOf(i)); }
  for (let i = 0; i < n; i++) {
    // metres up from the tail fan's tip, and forward from the tail's back edge (the 16 m eagle: its fan is the lowest ~2.8 m)
    const x = p.getX(i), z = p.getZ(i), up = upOf(i) - up0, fwd = fwdOf(i) - fwd0;
    // the wings: out from the shoulder, and not the tail fan below them (the fan's sides reach |x| 3 m)
    const wingW = smooth(ROC_WING_ROOT * 1.2, ROC_WING_ROOT * 2.4, Math.abs(x)) * (1 - smooth(2.9, 1.7, up));
    // the tail: the fan below and behind the legs
    const fan = (1 - wingW) * smooth(2.7, 1.5, up) * smooth(3.3, 2.3, fwd);
    // the head: the front of the centre line, eased in across the neck so it can turn without a seam
    const rest = 1 - wingW - fan, headW = rest * smooth(head - 0.7, head + 0.5, z);
    index[i * 4] = x > 0 ? WING_L : WING_R; weight[i * 4] = wingW;
    index[i * 4 + 1] = TAIL; weight[i * 4 + 1] = fan;
    index[i * 4 + 2] = HEAD; weight[i * 4 + 2] = headW;
    index[i * 4 + 3] = BODY; weight[i * 4 + 3] = rest - headW;
    lift[i] = rest * smooth(head - 0.6, head + 0.9, z);
  }
  // the neck: where the centre line crosses into the head
  let ny = 0, nk = 0;
  for (let i = 0; i < n; i++) if (Math.abs(p.getX(i)) < ROC_WING_ROOT && Math.abs(p.getZ(i) - head) < 0.4) { ny += p.getY(i); nk++; }
  const neckY = nk > 0 ? ny / nk : 1.8, neckZ = head;
  // (round 13: 'no face or beak shows') the eagle was modelled upright, its face toward the camera; laid level to fly, its
  // face looked at the ground and a viewer below saw only its white crown. Lift the head back up by the flight pitch
  // (less ROC_HEAD_DIP), bending the neck smoothly across its blend, so the face and hooked beak look ahead along the flight.
  if (!g.hasAttribute('normal')) g.computeVertexNormals();
  const nrm = g.getAttribute('normal'), bend = ROC_HEAD_DIP - pitch;
  for (let i = 0; i < n; i++) {
    const a = bend * (lift[i] ?? 0); if (a === 0) continue;
    const ca = Math.cos(a), sa = Math.sin(a), dy = p.getY(i) - neckY, dz = p.getZ(i) - neckZ;
    p.setXYZ(i, p.getX(i), neckY + dy * ca - dz * sa, neckZ + dy * sa + dz * ca);
    const ny0 = nrm.getY(i), nz0 = nrm.getZ(i); nrm.setXYZ(i, nrm.getX(i), ny0 * ca - nz0 * sa, ny0 * sa + nz0 * ca);
  }
  p.needsUpdate = true; nrm.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere();
  g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  return { bones: ROC_BONES(head, neckY - 1.6, tail), len };
}
const rocDims = (len: number): AnimalSpecies['dims'] => ({ bodyY: 1.6, bodyHalfLen: Math.max(1.4, len / 2), bodyRadius: 1.1, headRadius: 0.55, legLen: 1, feet: [], halfWidth: ROC_SPAN / 2 });
function rocMesh(source: BufferGeometry): AnimalSpecies {
  const g = fit(source, { size: ROC_SPAN, by: 'span', middle: 1.6, pitch: Math.PI / 2 }), { bones, len } = rocRig(g);
  paintUnderside(g);
  return { bones, furParts: [], eyeParts: [], hardParts: [g], dims: rocDims(len) };
}
/**
 * The textured Roc (E392/E399, mockup D; `art/far-reach/round-19-hero-models/refs/ref-rocbelow`): Hunyuan3D-2's painted
 * great eagle (dark brown underwings with pale barred flight feathers, a cream-white head and breast, a golden beak and
 * talons), generated from straight below in one plane, so it is pitched forward to fly with its painted side down. Its own paint is the map (the vertex colours stay white), fed back a little as emissive so
 * it reads against the low sun; rigged like the faceted one, so the wings flap.
 */
// (top-10 row 8, art/far-reach/round-27-roc: the eagle from mockup D, modelled from the front: pitched into flight and
// turned so its head leads)
// (round 13, seat A and the lead: pitched only 0.45 it flew nearly upright, head up behind the boss bar and its tail fan
// hanging over the sun; 1.1 lays its body near level, head forward and below the wings, tail trailing behind)
const ROC_HD = { pitch: 1.1, yaw: 0, selfLight: 0.35 } as const;
function rocHd(m: SkyHd): AnimalSpecies {
  const g = m.geometry.toNonIndexed(); m.geometry.dispose();
  g.rotateY(ROC_HD.yaw); fit(g, { size: ROC_SPAN, by: 'span', middle: 1.6, pitch: ROC_HD.pitch });
  g.setAttribute('color', new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));
  const { bones, len } = rocSkin(g, ROC_HD.pitch);
  return { bones, furParts: [], eyeParts: [], hardParts: [g], dims: rocDims(len), map: m.map, facetJitter: 0, selfLight: ROC_HD.selfLight };
}
/** The body: the textured model when it loaded, else the faceted generated one, else the code one. */
export const rocBody = (): AnimalSpecies => { const t = skyHd('roc-hd'); if (t) return rocHd(t); const g = skyMesh('storm-roc'); return g ? rocMesh(g) : rocCode(); };
/** The soaring wings' raised V (radians): level, from the arena they read edge-on; raised, their undersides face a viewer below. */
const ROC_DIHEDRAL = 0.1;
export const STORM_ROC_LOOK: SpeciesLook = { id: 'far.look.stormRoc', species: STORM_ROC.id, kind: 'stormRoc', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.stormRoc', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => rocBody(),
  animate: ({ bones, t, dt, alive, mem }) => {
    // a 19 m raptor soars (round 7: a steady beat caught the wings raised edge-on in half the frames; mockup D's eagle glides,
    // wings spread): a slow flex, with a few strong beats in a short burst every ~6 s
    const burst = Math.max(0, Math.sin(t * 1.05) - 0.85) / 0.15;
    const flap = alive ? ROC_DIHEDRAL + Math.sin(t * 0.9) * 0.06 + Math.sin(t * 3.8) * 0.45 * burst : 0.9;
    const l = bones['wingL'], r = bones['wingR'], tail = bones['tail'], body = bones['body'];
    if (l) l.rotation.z = flap; if (r) r.rotation.z = -flap; if (tail) tail.rotation.x = alive ? Math.sin(t * 1.1) * 0.15 : 0;
    // the take-off's lean into its swing onto the player (the brain's rocLean), eased; level flight adds the engine's bank
    const lean = (mem['rocBank'] ?? 0) + ((alive ? mem['rocLean'] ?? 0 : 0) - (mem['rocBank'] ?? 0)) * Math.min(1, dt * 3);
    mem['rocBank'] = lean; if (body) body.rotation.z = lean;
    // (round 13: 'no face or beak shows') the head looks into the turn it leans into, so from the ground you see a turned
    // white head and its hooked beak, as mockup D's eagle shows them
    const head = bones['head'];
    if (head) head.rotation.y = alive ? Math.max(-0.6, Math.min(0.6, -lean * 1.8)) + Math.sin(t * 0.45) * 0.12 : 0;
  },
};
