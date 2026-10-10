import { Color, Float32BufferAttribute, MeshStandardMaterial, Uint16BufferAttribute, type BufferGeometry } from 'three';
import { readSourceModel, skinnedGlb, type RawTexture, type SkinnedBone, type SkinnedOutput } from '@wildshard/sdk/bake/skinned';
import type { AnimalDims } from '@wildshard/engine/entities/species/registry';
import { bindRigid } from '@wildshard/sdk/looks/modelLibrary';
import { facetedGeometry, fitModel, hdGeometry } from '@wildshard/sdk/looks/modelIntake';
import { SKY_AO_FLOOR } from '../world/meshes';
import { SKY_CREATURE_SOURCES, type SkyCreatureExtras } from '../data/creatures';
import type { SkyCreature } from '../boot/files';

/**
 * Build-time only (SHARD-PLATFORM M3, the offline skinned-model bake): Sky Reach's three generated creature bodies, baked by
 * `scripts/bake-sky-rigs.mjs` into `public/assets/far-reach/rigs/<creature>.glb` (the Roc's painted map inside it, the source's
 * exact WebP bytes, so the KTX2 bake makes its phone stand-in as it did for the source). Each generated source is read offline through the runtime's own intake
 * (`@wildshard/sdk/looks/modelIntake` facetedGeometry / hdGeometry), fitted, re-skinned and recoloured here exactly as the runtime did it,
 * and written as a standard skinned GLB (`@wildshard/sdk/bake/skinned`); the client only loads it (`species/bodies.ts`).
 * The code stand-ins (and the code-built gale wisp) stay in `species/`: headless builds them. `test/shards/far-reach/creature-bake.test.ts`
 * is the byte-exact stale gate.
 */

/** A processed body: what the species look's `build()` returns, plus its map. */
interface Body { bones: SkinnedBone[]; geometry: BufferGeometry; dims: AnimalDims; texture?: RawTexture; facetJitter?: number; selfLight?: number }

const BODY = 0, HEAD = 1, WING_L = 2, WING_R = 3, TAIL = 4;
const smooth = (a: number, b: number, v: number): number => { const k = Math.min(1, Math.max(0, (v - a) / (b - a))); return k * k * (3 - 2 * k); };

/** Where a Roc wing starts (metres off the centre line): outboard of it a facet rides its wing bone. */
const ROC_WING_ROOT = 1.1;
/** The Roc's wingspan (metres). */
// E399 (mockup D: a great eagle whose wings span the portrait frame from the arena's entrance; it was 11 m)
// (round 7, the seats: mockup D's eagle spans ~0.96 of the portrait frame from the arena; at its lap ~33 m out that is ~20 m)
const ROC_SPAN = 16;
const ROC_BONES = (head: number, headY: number, tail: number): SkinnedBone[] => [{ name: 'body', parent: null, pos: [0, 1.6, 0] },
  { name: 'head', parent: 'body', pos: [0, headY, head] }, { name: 'wingL', parent: 'body', pos: [ROC_WING_ROOT, 1.7, 0] },
  { name: 'wingR', parent: 'body', pos: [-ROC_WING_ROOT, 1.7, 0] }, { name: 'tail', parent: 'body', pos: [0, 1.5, tail] }];
/** How far below the flight line the lifted head still looks (radians): a soaring eagle eyes the ground ahead of it. */
const ROC_HEAD_DIP = 0.3;
/**
 * Skin the textured eagle with blended weights (council round 13, finding 1: 'torn: sky shows through its legs and tail').
 * Bound a whole triangle to one bone, every triangle across a wing root opened a crack as the wings flapped, and the
 * line x = ±1.1 m ran down through both legs and the tail fan. Here each vertex blends: a wing's weight eases in across
 * its root (|x| 1.3 to 2.6 m) and out again toward the tail fan, so the legs, the breast and the fan stay with the body
 * and the skin bends instead of splitting. The weights are read in the model's own upright frame (`pitch` undone:
 * `up` runs from the tail fan to the head, `fwd` out of the breast), so they hold for any flight pitch.
 */
function rocSkin(g: BufferGeometry, pitch: number): { bones: SkinnedBone[]; len: number } {
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
/**
 * The textured Roc (E392/E399, mockup D; `art/far-reach/round-19-hero-models/refs/ref-rocbelow`): Hunyuan3D-2's painted
 * great eagle (dark brown underwings with pale barred flight feathers, a cream-white head and breast, a golden beak and
 * talons), generated from straight below in one plane, so it is pitched forward to fly with its painted side down. Its own
 * paint is the map (the vertex colours stay white), fed back a little as emissive so it reads against the low sun.
 */
// (top-10 row 8, art/far-reach/round-27-roc: the eagle from mockup D, modelled from the front: pitched into flight and
// turned so its head leads)
// (round 13, seat A and the lead: pitched only 0.45 it flew nearly upright, head up behind the boss bar and its tail fan
// hanging over the sun; 1.1 lays its body near level, head forward and below the wings, tail trailing behind)
const ROC_HD = { pitch: 1.1, yaw: 0, selfLight: 0.35 } as const;
function rocHd(source: BufferGeometry, texture: RawTexture): Body {
  const g = source.toNonIndexed(); source.dispose();
  g.rotateY(ROC_HD.yaw); fitModel(g, { size: ROC_SPAN, by: 'span', middle: 1.6, pitch: ROC_HD.pitch });
  g.setAttribute('color', new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));
  const { bones, len } = rocSkin(g, ROC_HD.pitch);
  return { bones, geometry: g, texture, facetJitter: 0, selfLight: ROC_HD.selfLight,
    dims: { bodyY: 1.6, bodyHalfLen: Math.max(1.4, len / 2), bodyRadius: 1.1, headRadius: 0.55, legLen: 1, feet: [], halfWidth: ROC_SPAN / 2 } };
}

/** The cream the goat's coat leans toward (linear rgb, #f9efdc): warm enough to stay cream under the violet sky light. */
const CREAM = [0.95, 0.87, 0.72] as const;
/** How far a bright facet moves toward CREAM; a dark one (horns, hooves) keeps its own colour. */
const COAT_LIFT = 0.62;
/**
 * The goat's coat read mauve under Sky Reach's violet sky light (C6 board). The generated albedo carries purple shading
 * (blue over green): those facets lose that blue, then every facet moves toward a warm cream by its brightness.
 */
export function warmCoat(g: BufferGeometry): BufferGeometry {
  const c = g.getAttribute('color');
  for (let i = 0; i < c.count; i++) {
    const r = c.getX(i), gr = c.getY(i), bl = Math.min(c.getZ(i), gr * 0.9), lum = 0.2126 * r + 0.7152 * gr + 0.0722 * bl;
    const t = COAT_LIFT * Math.min(1, Math.max(0, (lum - 0.02) / 0.25));
    c.setXYZ(i, r + (CREAM[0] - r) * t, gr + (CREAM[1] - gr) * t, bl + (CREAM[2] - bl) * t);
  }
  c.needsUpdate = true; return g;
}
const LEG_FL = 2;
/** Leg facets: below this share of the goat's height. */
const GOAT_LEG = 0.42;
/**
 * The generated goat (C6: Hunyuan3D-2 from `art/far-reach/round-7-models/ref-goat.jpg`): 1.45 m nose to tail, hooves at
 * y 0. Facets low under the body ride the leg of their quadrant (each leg bone sits at its leg's top); the front third
 * above the shoulder is the head and horns.
 */
function goatMesh(source: BufferGeometry): Body {
  const g = warmCoat(fitModel(source, { size: 1.45, by: 'span', floor: 0 })), b = g.boundingBox, p = g.getAttribute('position');
  const h = b ? b.max.y : 1.3, z0 = b ? b.min.z : -0.7, z1 = b ? b.max.z : 0.7, legTop = h * GOAT_LEG, head = z1 - (z1 - z0) * 0.3;
  // each leg's top: the mean x / z of its quadrant's low vertices
  const sum = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], quad = (x: number, z: number): number => (z > 0 ? 0 : 2) + (x > 0 ? 0 : 1);
  for (let i = 0; i < p.count; i++) if (p.getY(i) < legTop * 0.8 && p.getZ(i) < head) { const q = sum[quad(p.getX(i), p.getZ(i))]; if (q) { q[0] = (q[0] ?? 0) + p.getX(i); q[1] = (q[1] ?? 0) + p.getZ(i); q[2] = (q[2] ?? 0) + 1; } }
  const top = (q: number, x: number, z: number): [number, number, number] => { const s = sum[q], n = s?.[2] ?? 0; return n > 0 ? [(s?.[0] ?? 0) / n, legTop, (s?.[1] ?? 0) / n] : [x, legTop, z]; };
  bindRigid(g, (x, y, z) => z > head && y > h * 0.5 ? 1 : y < legTop && z <= head + 0.05 ? LEG_FL + quad(x, z) : BODY);
  return { bones: [{ name: 'body', parent: null, pos: [0, h * 0.55, 0] }, { name: 'head', parent: 'body', pos: [0, h * 0.62, head] },
    { name: 'legFL', parent: 'body', pos: top(0, 0.2, 0.4) }, { name: 'legFR', parent: 'body', pos: top(1, -0.2, 0.4) },
    { name: 'legBL', parent: 'body', pos: top(2, 0.2, -0.4) }, { name: 'legBR', parent: 'body', pos: top(3, -0.2, -0.4) }],
    geometry: g, dims: { bodyY: h * 0.55, bodyHalfLen: (z1 - z0) / 2, bodyRadius: 0.35, headRadius: 0.22, legLen: legTop, feet: [], halfWidth: 0.35 } };
}

/** Where a ray fin starts (metres off the centre line): outboard of it a facet rides its wing bone. */
const RAY_WING_ROOT = 0.85;
/**
 * The mockup's manta (review item 9): pale sky blue on top, near-white below, the whip tail a brighter cyan. The generated
 * model's own shading (its baked value) is kept as the shade, its hue replaced.
 */
const RAY_PALE = { back: new Color(0x8fb4d6), belly: new Color(0xeef3f8), tail: new Color(0x9fe6f2) } as const;
function paleRay(g: BufferGeometry, tailZ: number): void {
  if (!g.hasAttribute('color')) return;
  const c = g.getAttribute('color'), p = g.getAttribute('position'), n = g.hasAttribute('normal') ? g.getAttribute('normal') : null;
  const out = new Color();
  for (let i = 0; i < c.count; i++) {
    const value = Math.min(1, 0.35 + 0.9 * (0.2126 * c.getX(i) + 0.7152 * c.getY(i) + 0.0722 * c.getZ(i)));
    const up = n === null ? 1 : n.getY(i);
    out.copy(up < -0.2 ? RAY_PALE.belly : RAY_PALE.back);
    if (p.getZ(i) < tailZ && Math.abs(p.getX(i)) < RAY_WING_ROOT) out.copy(RAY_PALE.tail);
    out.multiplyScalar(value);
    c.setXYZ(i, out.r, out.g, out.b);
  }
  c.needsUpdate = true;
}
/**
 * The generated ray (C6: Hunyuan3D-2 from `art/far-reach/round-7-models/ref-manta.jpg`): 5.4 m fin to fin, its middle at
 * the body bone. Facets outboard of the fin roots ride the wings; the back of the centre line (the whip) rides the tail.
 */
function rayMesh(source: BufferGeometry): Body {
  const g = fitModel(source, { size: 5.4, by: 'span', middle: 0.3 }), p = g.getAttribute('position');
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < RAY_WING_ROOT) { z0 = Math.min(z0, p.getZ(i)); z1 = Math.max(z1, p.getZ(i)); }
  const len = Math.max(0.5, z1 - z0), head = z1 - len * 0.18, tail = z0 + len * 0.45;
  bindRigid(g, (x, _y, z) => x > RAY_WING_ROOT ? WING_L : x < -RAY_WING_ROOT ? WING_R : z > head ? HEAD : z < tail ? TAIL : BODY);
  paleRay(g, tail);
  return { bones: [{ name: 'body', parent: null, pos: [0, 0.3, 0] }, { name: 'head', parent: 'body', pos: [0, 0.3, head] },
    { name: 'wingL', parent: 'body', pos: [RAY_WING_ROOT, 0.3, 0] }, { name: 'wingR', parent: 'body', pos: [-RAY_WING_ROOT, 0.3, 0] }, { name: 'tail', parent: 'body', pos: [0, 0.3, tail] }],
    geometry: g, dims: { bodyY: 0.3, bodyHalfLen: 1.4, bodyRadius: 0.9, headRadius: 0.4, legLen: 0.1, feet: [], halfWidth: 2.7 } };
}

/** Process each creature's source as the runtime did (a source GLB's bytes by its public URL). */
export async function skyCreatureBodies(read: (url: string) => Uint8Array): Promise<Record<SkyCreature, Body>> {
  const roc = await readSourceModel(read(SKY_CREATURE_SOURCES['storm-roc']));
  const painted = hdGeometry(roc.gltf.scene, (material) => roc.texture(material) !== null), texture = painted === null ? null : roc.texture(painted.material);
  if (painted === null || texture === null) throw new Error('storm-roc: no textured mesh');
  const faceted = async (creature: 'sky-goat' | 'drift-ray'): Promise<BufferGeometry> => {
    const g = facetedGeometry((await readSourceModel(read(SKY_CREATURE_SOURCES[creature]))).gltf.scene, SKY_AO_FLOOR);
    if (g === null) throw new Error(`${creature}: no mesh`);
    return g;
  };
  return { 'storm-roc': rocHd(painted.geometry, texture), 'sky-goat': goatMesh(await faceted('sky-goat')), 'drift-ray': rayMesh(await faceted('drift-ray')) };
}

/** Bake every creature body to its skinned GLB. */
export async function bakeSkyCreatures(read: (url: string) => Uint8Array): Promise<Record<SkyCreature, SkinnedOutput>> {
  const bodies = await skyCreatureBodies(read);
  const bake = (creature: SkyCreature): SkinnedOutput => {
    const body = bodies[creature], d = body.dims;
    const extras = { dims: { bodyY: d.bodyY, bodyHalfLen: d.bodyHalfLen, bodyRadius: d.bodyRadius, headRadius: d.headRadius, legLen: d.legLen, feet: d.feet, halfWidth: d.halfWidth },
      ...(body.facetJitter === undefined ? {} : { facetJitter: body.facetJitter }), ...(body.selfLight === undefined ? {} : { selfLight: body.selfLight }) } satisfies SkyCreatureExtras;
    if (body.texture !== undefined && body.texture.mimeType !== 'image/webp') throw new Error(`${creature}: its map is not a WebP`);
    const material = new MeshStandardMaterial({ name: `far.${creature}`, vertexColors: true });
    const output = skinnedGlb({ name: `far.${creature}`, bones: body.bones, parts: [{ geometry: body.geometry, material, name: `far.${creature}`, ...(body.texture === undefined ? {} : { texture: body.texture }) }],
      extras });
    material.dispose();
    return output;
  };
  return { 'storm-roc': bake('storm-roc'), 'sky-goat': bake('sky-goat'), 'drift-ray': bake('drift-ray') };
}
