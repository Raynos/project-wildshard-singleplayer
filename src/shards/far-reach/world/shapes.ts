import { BoxGeometry, type BufferGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry, DoubleSide, Euler, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, TubeGeometry, Vector3, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader, type ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { DECK_WOOD_EDITS, HOVER_FRAME_EDITS, POST_WEATHER_EDITS } from '../data/bridgeLook';
import { ropeSag } from '../layout';
import { fit, hdMaterial, skyHd, skyMesh, splitAbove } from './meshes';
import { towerMill } from './mill';
import { skyBakedGeometry } from './baked';

const SPLICE = new ShaderFamily({}, {});
/** `rows` with every `@{name}` in their text replaced from `extra`. */
const spliced = (rows: readonly ShaderEditRow[], extra: Readonly<Record<string, string>>): ShaderEditRow[] =>
  rows.map((r) => (typeof r.put === 'string' ? { stage: r.stage, find: r.find, put: SPLICE.glsl(r.put, extra) } : r));

/** The Sky Reach palette (sRGB hex): golden-hour grass, warm dirt, warm brown-grey keel strata, green pines (the mockup's). */
export const PALETTE = {
  grass: 0x7d9640, grassLight: 0xa6ad55, dirt: 0x8a6446, rock: 0x8a7468, rockDark: 0x6a5560,
  pine: 0x3f5a3c, trunk: 0x5a3f2e, plank: 0x8d6a4c, rope: 0x6a5c4a, tower: 0xd8cfc2, sail: 0xe8dcc4, glow: 0x9fe6f2,
} as const;

export const flat = (color = 0xffffff, extra: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...extra });

/** The code pines at `at` ([x, y, z, scale]), one instanced draw (SF72: the pine is baked, generators/geometries.ts). */
export function pines(at: readonly (readonly [number, number, number, number])[]): InstancedMesh {
  const mesh = new InstancedMesh(skyBakedGeometry('pine'), flat(0xffffff, { vertexColors: true, side: DoubleSide }), at.length), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  at.forEach(([x, y, z, s], i) => { q.setFromAxisAngle(up, i * 1.7); m.compose(new Vector3(x, y, z), q, new Vector3(s, s, s)); mesh.setMatrixAt(i, m); });
  mesh.computeBoundingSphere(); return mesh;
}

/**
 * A hover deck (loop 5; the bible §5 glass, council R1C-10 / R1B-2): ONE half-transparent cyan slab, so nothing overlaps
 * itself into stripes, held in a solid glowing frame (two edge bars, the end bars) with a short pylon at each corner.
 * It reads as a built thing you ride, and as plainly not a floor. `glass` is the shared deck material (the plugin
 * brightens it while you ride); the frame and pylons are lit by their own emissive cyan.
 */
function glassDeck(length: number, width: number, glass: MeshStandardMaterial): Mesh[] {
  const slab = new Mesh(new BoxGeometry(width - 0.16, 0.05, length - 0.16), glass); slab.position.set(0, -0.05, -length / 2); slab.renderOrder = 4;
  const frameMat = new MeshStandardMaterial({ color: PALETTE.glow, emissive: PALETTE.glow, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.2 });
  // the glow is for the rider near it (E399 round 6, the seats: 'the updraft ramp's glowing cyan edges cross A, B, C and
  // proposal B' from 60 m and more): full within ~25 m of the camera, a third beyond ~60 m (round 7, seat C: the updraft's
  // cue must still read from the spawn)
  patchShader(frameMat, 'far.hover-frame', PATCH_ORDER.decorate, (shader) => {
    editShader(shader, HOVER_FRAME_EDITS);
  }, { key: (prior) => `${prior}|far.hover-frame` });
  const bars: Mesh[] = [];
  for (const side of [-1, 1]) { const bar = new Mesh(new BoxGeometry(0.1, 0.1, length), frameMat); bar.position.set(side * (width / 2 - 0.05), -0.04, -length / 2); bars.push(bar); }
  for (const z of [0, -length]) {
    const end = new Mesh(new BoxGeometry(width, 0.1, 0.1), frameMat); end.position.set(0, -0.04, z); bars.push(end);
    for (const side of [-1, 1]) { const pylon = new Mesh(new CylinderGeometry(0.07, 0.1, 0.9, 6), frameMat); pylon.position.set(side * (width / 2 - 0.05), 0.4, z); bars.push(pylon); }
  }
  return [slab, ...bars];
}

const ONE = new Vector3(1, 1, 1);
/** The plank's tilt at `s` along the sag: its forward end follows the curve down then up. */
function sagTilt(sag: (s: number) => number, s: number): Quaternion {
  const ds = 0.05, slope = (sag(s + ds) - sag(s - ds)) / (2 * ds);
  return new Quaternion().setFromEuler(new Euler(-Math.atan(slope), 0, 0));
}
/** A rope hung `at` metres over the deck line at `x`, sagging `k` times the deck's sag. */
function hungRope(length: number, sag: (s: number) => number, x: number, at: number, k: number, radius: number): TubeGeometry {
  const pts: Vector3[] = [];
  for (let i = 0; i <= 16; i++) { const s = (i / 16) * length; pts.push(new Vector3(x, at - sag(s) * k, -s)); }
  return new TubeGeometry(new CatmullRomCurve3(pts), 48, radius, 6, false);
}
/** A plank bridge along a local -Z run of `length` metres, `width` wide, deck top at local y 0. */
export function plankBridge(length: number, width: number, material: MeshStandardMaterial, rails: MeshStandardMaterial | null, hangs = true): Group {
  // a rigid deck (the crown's drawbridge swings up whole) does not sag
  const sag = (s: number): number => hangs ? ropeSag(length, s) : 0;
  const group = new Group(), step = 0.62, count = Math.max(1, Math.floor(length / step)), m = new Matrix4();
  if (rails === null) { group.add(...glassDeck(length, width, material)); return group; }
  // a rope bridge lays the generated plank segments when the kit loaded, hanging along its sag (layout ropeSag)
  const kit = kitDeck(length, width, sag);
  if (kit !== null) group.add(kit);
  else {
    const planks = new InstancedMesh(new BoxGeometry(width, 0.08, 0.5), material, count);
    for (let i = 0; i < count; i++) { const s = (i + 0.5) * (length / count); m.compose(new Vector3(0, -0.06 - sag(s), -s), sagTilt(sag, s), ONE); planks.setMatrixAt(i, m); }
    planks.computeBoundingSphere(); group.add(planks);
  }
  const posts = kitPosts(width, length);
  if (posts !== null) group.add(posts);
  for (const side of [-1, 1]) {
    // the hand ropes (E399 round 6, seat A: 'tied rails'; the seats since round 5: 'smooth orange ropes in deep unsupported
    // curves'): a thick top rope from the post heads, drawn tighter than the deck, a lighter mid rope, and ties from the top
    // rope down to the deck's edge every 1.25 m, as the mockups' bridges are netted
    const x = side * width / 2, topAt = 1.45, topK = 0.7, ties: BufferGeometry[] = [];
    // (round 7, seat B: 'every 1.25 m the sides read as fences and ladders'): every 2.5 m and thin, the sky reads through
    for (let t = 2.5; t < length - 1.2; t += 2.5) {
      const deckY = -sag(t), ropeY = topAt - sag(t) * topK, tie = new CylinderGeometry(0.009, 0.009, ropeY - deckY, 4, 1);
      tie.translate(x, (ropeY + deckY) / 2, -t); ties.push(tie.toNonIndexed());
    }
    group.add(new Mesh(hungRope(length, sag, x, topAt, topK, 0.045), rails), new Mesh(hungRope(length, sag, x, 0.7, 0.88, 0.026), rails));
    if (ties.length > 0) { group.add(new Mesh(mergeGeometries(ties), rails)); for (const g of ties) g.dispose(); }
    if (posts === null) for (const z of [0, -length]) { const post = new Mesh(new BoxGeometry(0.16, 1.3, 0.16), flat(PALETTE.trunk)); post.position.set(side * width / 2, 0.55, z); group.add(post); }
  }
  return group;
}

/** Weathered wood (E392: the targets' planks and posts are silver-grey-brown; the generated kit's are saturated orange):
 * the geometry's own vertex colours pulled most of the way to their grey. */
function greyWood(g: BufferGeometry): BufferGeometry {
  if (!g.hasAttribute('color')) return g;
  const c = g.getAttribute('color');
  for (let i = 0; i < c.count; i++) {
    const r = c.getX(i), gg = c.getY(i), b = c.getZ(i), lum = r * 0.3 + gg * 0.59 + b * 0.11;
    c.setXYZ(i, r + (lum * 1.04 - r) * 0.65, gg + (lum * 0.99 - gg) * 0.65, b + (lum * 0.92 - b) * 0.65);
  }
  c.needsUpdate = true; return g;
}
/** The rope-bridge kit (Hunyuan3D-2 from `art/far-reach/round-9-bridge/ref-bridge-*.jpg`): a plank deck segment about this long, and an anchor post this tall. */
const DECK_SEGMENT = 4.8, POST_HEIGHT = 1.6;
/** The generated deck segments laid end to end along local −Z, top at y 0, stretched to the span's width; null without the kit. */
/**
 * The deck's painted wood (E399 round 2, seat C: 'flat-shaded planks with jagged facets next to the textured posts'):
 * smooth-shaded, a grain of fine streaks along each plank (the local x runs across the deck, z along it), a tone per plank
 * across the deck, silvered wear down the middle where feet go, darker toward the plank ends.
 */
/** How far the bridge timber is greyed toward weathered silver: the deck's planks (plus their worn middle) and the post's wood. */
const WEATHER = { deck: 0.6, post: 0.8 } as const;
function deckWood(): MeshStandardMaterial {
  const m = flat(0xffffff, { vertexColors: true, flatShading: false, roughness: 0.9 });
  patchShader(m, 'far.deck-wood', PATCH_ORDER.decorate, (shader) => {
    editShader(shader, spliced(DECK_WOOD_EDITS, { weather: WEATHER.deck.toFixed(2) }));
  }, { key: (prior) => `${prior}|far.deck-wood` });
  return m;
}
function kitDeck(length: number, width: number, sag: (s: number) => number): InstancedMesh | null {
  const source = skyMesh('bridge-deck'); if (source === null) return null;
  // fitted along its long axis (x), then turned so that axis runs down the span
  const g = fit(source, { size: DECK_SEGMENT, by: 'span', floor: 0 }); g.rotateY(Math.PI / 2); g.computeBoundingBox();
  const b = g.boundingBox; if (b === null) return null;
  const n = Math.max(1, Math.round(length / DECK_SEGMENT)), seg = length / n;
  g.translate(-(b.min.x + b.max.x) / 2, -b.max.y, -(b.min.z + b.max.z) / 2);
  // (round 6, seat A: 'thinner plank wedges'; the seats: 'a solid dark near edge'): half the kit's plank depth, the walking top unchanged
  g.scale(width / Math.max(1e-3, b.max.x - b.min.x), 0.5, seg / Math.max(1e-3, b.max.z - b.min.z)); g.computeVertexNormals();
  // weathered wood (E392: the mockups' planks are grey-brown, ours read saturated orange)
  greyWood(g);
  const mesh = new InstancedMesh(g, deckWood(), n), m = new Matrix4();
  for (let i = 0; i < n; i++) { const s = (i + 0.5) * seg; m.compose(new Vector3(0, -sag(s), -s), sagTilt(sag, s), ONE); mesh.setMatrixAt(i, m); }
  mesh.computeBoundingSphere(); return mesh;
}
/**
 * The textured anchor post (E392/E399, mockup A: weathered silver-grey timber wrapped in thick hemp rope under an iron
 * band, on a footing of mossy stones; `art/far-reach/round-19-hero-models/`): its height, and how far its middle stands
 * outside the rope rails (half its stone footing).
 */
const HD_POST = { height: 1.9, out: 0.3 } as const;
/** The textured posts at the span's four corners, their hanging rope ends turned outward; null when it did not load. */
function hdPosts(width: number, length: number): InstancedMesh | null {
  const source = skyHd('post-hd'); if (source === null) return null;
  const material = hdMaterial(source.map);
  // the timber weathered to the mockups' silver-grey (its paint came out orange-brown); the gold hemp and the iron band,
  // brighter or bluer than the wood, kept
  patchShader(material, 'far.post-weather', PATCH_ORDER.decorate, (shader) => {
    editShader(shader, spliced(POST_WEATHER_EDITS, { weather: WEATHER.post.toFixed(2) }));
  }, { key: (prior) => `${prior}|far.post-weather` });
  const g = fit(source.geometry, { size: HD_POST.height, by: 'height', floor: 0, centre: 'base' }), mesh = new InstancedMesh(g, material, 4);
  const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), one = new Vector3(1, 1, 1);
  let i = 0;
  for (const side of [-1, 1]) for (const z of [0, -length]) {
    // the file's knot hangs on its +x side: turned so it hangs on the post's outer side either way
    q.setFromAxisAngle(up, side > 0 ? 0 : Math.PI);
    m.compose(new Vector3(side * (width / 2 + HD_POST.out), -0.05, z), q, one); mesh.setMatrixAt(i++, m);
  }
  mesh.computeBoundingSphere(); return mesh;
}
/** The generated anchor posts at the span's four corners, just outside the rope rails (the textured ones when they loaded); null without the kit. */
function kitPosts(width: number, length: number): InstancedMesh | null {
  const textured = hdPosts(width, length); if (textured !== null) return textured;
  const source = skyMesh('bridge-post'); if (source === null) return null;
  const g = fit(source, { size: POST_HEIGHT, by: 'height', floor: 0, centre: 'base' }), mesh = new InstancedMesh(greyWood(g), flat(0xffffff, { vertexColors: true }), 4), m = new Matrix4();
  let i = 0;
  for (const side of [-1, 1]) for (const z of [0, -length]) { m.makeTranslation(side * (width / 2 + 0.12), -0.05, z); mesh.setMatrixAt(i++, m); }
  mesh.computeBoundingSphere(); return mesh;
}
/** The rope-bridge kit for the Model Explorer: one deck segment with its four posts and the code ropes. */
export function bridgeKit(): Group { return plankBridge(DECK_SEGMENT, 2.6, flat(PALETTE.plank), flat(PALETTE.rope)); }

/** The windmill: the code-built tower mill (loop 5, world/mill.ts); the generated C6 tower stays in the Model Explorer. */
export function windmill(): { group: Group; hub: Object3D } {
  const { group, hub } = towerMill();
  return { group, hub };
}

/** The bridge winch: a drum between two posts and a crank. */
export function winch(): Group {
  const group = new Group(), wood = flat(PALETTE.trunk);
  for (const x of [-0.7, 0.7]) { const post = new Mesh(new BoxGeometry(0.2, 1.2, 0.2), wood); post.position.set(x, 0.6, 0); group.add(post); }
  const drum = new Mesh(new CylinderGeometry(0.32, 0.32, 1.2, 8), flat(PALETTE.rope)); drum.rotation.z = Math.PI / 2; drum.position.y = 0.95; group.add(drum);
  const crank = new Mesh(new BoxGeometry(0.1, 0.6, 0.1), wood); crank.position.set(0.85, 1.15, 0); group.add(crank);
  return group;
}

/** The generated vane's rotor: every facet above this height (the cups and the arrow) turns. */
const VANE_ROTOR_Y = 2.2;
/**
 * A wind vane: the generated shrine post (C6, Hunyuan3D-2 from `art/far-reach/round-7-models/ref-vane.jpg`), its cups and
 * arrow split off as the rotor the plugin spins once a GUST hits it; without it, a code post and a four-cup rotor.
 */
export function vane(): { group: Group; rotor: Object3D } {
  const group = new Group(), rotor = new Group(), model = skyMesh('wind-vane');
  if (model !== null) {
    const g = fit(model, { size: 3.6, by: 'height', floor: 0, centre: 'base' }), [post, top] = splitAbove(g, VANE_ROTOR_Y), mat = flat(0xffffff, { vertexColors: true });
    group.add(new Mesh(post, mat)); top.translate(0, -VANE_ROTOR_Y, 0); rotor.add(new Mesh(top, mat)); rotor.position.y = VANE_ROTOR_Y; group.add(rotor);
    return { group, rotor };
  }
  const wood = flat(PALETTE.trunk), cloth = flat(PALETTE.glow, { emissive: PALETTE.glow, emissiveIntensity: 0.15 });
  const pole = new Mesh(new CylinderGeometry(0.1, 0.16, 3.2, 6), wood); pole.position.y = 1.6; group.add(pole);
  rotor.position.y = 3.3; group.add(rotor);
  for (let i = 0; i < 4; i++) {
    const arm = new Mesh(new BoxGeometry(1.4, 0.06, 0.06), wood); arm.rotation.y = (i * Math.PI) / 2; arm.position.set(Math.cos(arm.rotation.y) * 0.7, 0, -Math.sin(arm.rotation.y) * 0.7); rotor.add(arm);
    const cup = new Mesh(new ConeGeometry(0.22, 0.4, 6, 1, true), cloth); cup.rotation.z = Math.PI / 2;
    cup.position.set(Math.cos(arm.rotation.y) * 1.4, 0, -Math.sin(arm.rotation.y) * 1.4); cup.rotation.y = arm.rotation.y; rotor.add(cup);
  }
  return { group, rotor };
}
