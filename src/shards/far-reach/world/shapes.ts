import { BoxGeometry, type BufferGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, TubeGeometry, Vector3, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader, spliceEdits } from '@wildshard/sdk/looks/shaderEdits';
import { DECK_WOOD_EDITS, HOVER_FRAME_EDITS, POST_WEATHER_EDITS } from '../data/bridgeLook';
import { fitModel, splitAbove } from '@wildshard/sdk/looks/modelIntake';
import { GeometryPack, fetchDeflated, packedRows } from '@wildshard/sdk/kit/geometryPack';
import bridgeRows from '../data/bridges.json' with { type: 'json' };
import { BRIDGES_URL } from '../boot/files';
import { hdMaterial, skyHd, skyMesh } from './meshes';
import { towerMill } from './mill';
import { skyBakedGeometry } from './baked';

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

/** A hover deck along a local -Z run of `length` metres, `width` wide, top at local y 0, in the shared `glass`. */
export function hoverBridge(length: number, width: number, glass: MeshStandardMaterial): Group {
  const group = new Group(); group.add(...glassDeck(length, width, glass)); return group;
}

let bridges: InstanceType<typeof GeometryPack> | null = null;
const BRIDGE_ROWS = packedRows(bridgeRows);
/** Load the rope bridges' bake (with the other baked pieces, before the world is built); a failed load stands them undrawn. */
export async function loadSkyBridges(): Promise<void> {
  try { bridges = new GeometryPack(await fetchDeflated(BRIDGES_URL), BRIDGE_ROWS, 'far-reach bridges'); } catch (e: unknown) { console.error('[far-reach] the baked rope bridges did not load; they stand undrawn:', e); }
}
/** How far the bridge timber is greyed toward weathered silver: the deck's planks (plus their worn middle) and the post's wood. */
const WEATHER = { deck: 0.6, post: 0.8 } as const;
/**
 * The deck's painted wood (E399 round 2, seat C: 'flat-shaded planks with jagged facets next to the textured posts'):
 * smooth-shaded, a grain of fine streaks along each plank, a tone per plank across the deck, silvered wear down the middle
 * where feet go, darker toward the plank ends.
 */
function deckWood(): MeshStandardMaterial {
  const m = flat(0xffffff, { vertexColors: true, flatShading: false, roughness: 0.9 });
  patchShader(m, 'far.deck-wood', PATCH_ORDER.decorate, (shader) => {
    editShader(shader, spliceEdits(DECK_WOOD_EDITS, { weather: WEATHER.deck.toFixed(2) }));
  }, { key: (prior) => `${prior}|far.deck-wood` });
  return m;
}
/**
 * The textured anchor post, 1.9 m tall on its footing, in its material (E392/E399, mockup A: weathered silver-grey timber wrapped in thick hemp rope under
 * an iron band; `art/far-reach/round-19-hero-models/`), or null when its model did not load: the timber weathered to the
 * mockups' silver-grey (its paint came out orange-brown); the gold hemp and the iron band, brighter or bluer, kept.
 */
function anchorPost(): { geometry: BufferGeometry; material: MeshStandardMaterial } | null {
  const source = skyHd('post-hd'); if (source === null) return null;
  const material = hdMaterial(source.map);
  patchShader(material, 'far.post-weather', PATCH_ORDER.decorate, (shader) => {
    editShader(shader, spliceEdits(POST_WEATHER_EDITS, { weather: WEATHER.post.toFixed(2) }));
  }, { key: (prior) => `${prior}|far.post-weather` });
  return { geometry: fitModel(source.geometry, { size: 1.9, by: 'height', floor: 0, centre: 'base' }), material };
}
/**
 * A rope span from its bake (SHARD-PLATFORM M3: generators/bridges.ts, by span id; `kit` is the Explorer's one segment):
 * the generated deck segments in their painted wood along the sag, the textured posts at its corners, the hand ropes (tubes
 * through their baked points) and ties in `rails`. Empty when the bake did not load (the span's colliders are its own).
 */
export function ropeBridge(id: string, rails: MeshStandardMaterial): Group {
  const group = new Group(), span = bridgeRows.spans.find((s) => s.id === id), pack = bridges;
  if (pack === null || span === undefined) return group;
  const instanced = (geometry: BufferGeometry, material: MeshStandardMaterial, block: number): InstancedMesh => {
    const at = pack.floats(block), mesh = new InstancedMesh(geometry, material, at.length / 16); mesh.instanceMatrix.array.set(at); mesh.computeBoundingSphere(); return mesh;
  };
  // the deck segment stretched to the span (its normals as the stretch leaves them), one instance per segment along the sag
  const [sx = 1, sy = 1, sz = 1] = span.deck.scale, deck = pack.geometry(bridgeRows.deck);
  deck.scale(sx, sy, sz); deck.computeVertexNormals(); deck.computeBoundingBox();
  group.add(instanced(deck, deckWood(), span.deck.at));
  const post = anchorPost(); if (post !== null) group.add(instanced(post.geometry, post.material, span.posts));
  const rope = (r: { r: number; at: readonly number[] }): Mesh => {
    const points = Array.from({ length: r.at.length / 3 }, (_, i) => new Vector3(r.at[i * 3], r.at[i * 3 + 1], -(r.at[i * 3 + 2] ?? 0)));
    return new Mesh(new TubeGeometry(new CatmullRomCurve3(points), 48, r.r, 6, false), rails);
  };
  for (const side of span.sides) {
    group.add(rope(side.top), rope(side.mid));
    const ties: BufferGeometry[] = [];
    for (let i = 0; i + 3 < side.ties.length; i += 4) {
      const tie = new CylinderGeometry(0.009, 0.009, side.ties[i + 3], 4, 1); tie.translate(side.ties[i] ?? 0, side.ties[i + 1] ?? 0, -(side.ties[i + 2] ?? 0)); ties.push(tie.toNonIndexed());
    }
    if (ties.length > 0) { group.add(new Mesh(mergeGeometries(ties), rails)); for (const g of ties) g.dispose(); }
  }
  return group;
}
/** The rope-bridge kit for the Model Explorer: one deck segment with its four posts and the ropes. */
export function bridgeKit(): Group { return ropeBridge('kit', flat(PALETTE.rope)); }

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
    const g = fitModel(model, { size: 3.6, by: 'height', floor: 0, centre: 'base' }), [post, top] = splitAbove(g, VANE_ROTOR_Y), mat = flat(0xffffff, { vertexColors: true });
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
