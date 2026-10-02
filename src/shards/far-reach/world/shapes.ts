import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3, type Object3D } from 'three';
import type { Isle } from '../layout';
import { fit, skyMesh, splitAbove } from './meshes';

/** The Sky Reach palette (sRGB hex): golden-hour grass, warm dirt, warm brown-grey keel strata, green pines (the mockup's). */
export const PALETTE = {
  grass: 0x82ad4c, grassLight: 0xa3c060, dirt: 0x8a6446, rock: 0x8a7468, rockDark: 0x6a5560,
  pine: 0x3f5a3c, trunk: 0x5a3f2e, plank: 0x8d6a4c, rope: 0xd6c095, tower: 0xd8cfc2, sail: 0xe8dcc4, glow: 0x9fe6f2,
} as const;

type Tri = (a: Vector3, b: Vector3, c: Vector3, color: number, vary?: number) => void;
/** Macro colour noise (Gilded Air: painted variation, not one flat colour per facet): a soft value field over world metres. */
const macro = (x: number, z: number): number => Math.sin(x * 0.31 + Math.sin(z * 0.23) * 1.7) * 0.5 + Math.sin(z * 0.37 - x * 0.11) * 0.5;
function builder(): { tri: Tri; geometry: () => BufferGeometry } {
  const pos: number[] = [], col: number[] = [], c = new Color();
  const tri: Tri = (a, b, d, color, vary = 0) => {
    for (const p of [a, b, d]) {
      c.setHex(color); const k = 1 + vary * macro(p.x, p.z), warm = vary * Math.max(0, macro(p.z * 0.7, p.x * 0.7));
      pos.push(p.x, p.y, p.z); col.push(c.r * k + warm * 0.05, c.g * k + warm * 0.03, c.b * k * (1 - warm * 0.4));
    }
  };
  return { tri, geometry: () => { const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; } };
}
export const flat = (color = 0xffffff, extra: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...extra });

/**
 * A floating island: a flat 12-gon grass top at local y 0 (its collider top), a dirt band, then a jagged violet keel
 * tapering to a point `keel` metres down. Flat-shaded vertex colours, one draw.
 */
export function islandMesh(isle: Isle, random: () => number): Mesh {
  const { tri, geometry } = builder(), n = 12;
  const ring = (radius: number, y: number, jitter: number, yJitter = 0): Vector3[] => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, rr = radius * (1 - jitter * random());
    return new Vector3(Math.cos(a) * rr, y - yJitter * random(), Math.sin(a) * rr);
  });
  const centre = new Vector3(0, 0.08, 0), inner = ring(isle.r * 0.55, 0.12, 0.08), rim = ring(isle.r, 0, 0);
  const band = ring(isle.r * 0.97, -1.3, 0.02, 0.3), mid = ring(isle.r * 0.72, -isle.keel * 0.38, 0.12, 2);
  const low = ring(isle.r * 0.34, -isle.keel * 0.74, 0.2, 2), tip = new Vector3((random() - 0.5) * 2, -isle.keel, (random() - 0.5) * 2);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [ci, cj, ri, rj, bi, bj, mi, mj, li, lj] = [inner[i], inner[j], rim[i], rim[j], band[i], band[j], mid[i], mid[j], low[i], low[j]];
    if (!ci || !cj || !ri || !rj || !bi || !bj || !mi || !mj || !li || !lj) continue;
    // one grass colour with macro noise per vertex: the 12-gon's radial fan no longer shows (review item 3)
    tri(centre, cj, ci, PALETTE.grass, 0.16);
    tri(ci, cj, rj, PALETTE.grass, 0.16); tri(ci, rj, ri, PALETTE.grass, 0.16);
    tri(ri, rj, bj, PALETTE.dirt); tri(ri, bj, bi, PALETTE.dirt);
    tri(bi, bj, mj, PALETTE.rock); tri(bi, mj, mi, i % 2 ? PALETTE.rock : PALETTE.rockDark);
    tri(mi, mj, lj, PALETTE.rockDark); tri(mi, lj, li, PALETTE.rock);
    tri(li, lj, tip, PALETTE.rockDark);
  }
  return new Mesh(geometry(), flat(0xffffff, { vertexColors: true }));
}

/** One pine (trunk + two stacked cones) as a single vertex-coloured geometry for instancing. */
export function pineGeometry(): BufferGeometry {
  const parts: [BufferGeometry, number][] = [];
  const trunk = new CylinderGeometry(0.18, 0.28, 1.6, 5); trunk.translate(0, 0.8, 0); parts.push([trunk, PALETTE.trunk]);
  const low = new ConeGeometry(1.7, 3.6, 6); low.translate(0, 3, 0); parts.push([low, PALETTE.pine]);
  const high = new ConeGeometry(1.15, 3, 6); high.translate(0, 5.1, 0); parts.push([high, PALETTE.pine]);
  const { tri, geometry } = builder(), a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (const [part, color] of parts) {
    const flatPart = part.toNonIndexed(), p = flatPart.getAttribute('position');
    for (let i = 0; i < p.count; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); tri(a, b, c, color); }
    part.dispose(); flatPart.dispose();
  }
  return geometry();
}
export function pines(at: readonly (readonly [number, number, number, number])[]): InstancedMesh {
  const mesh = new InstancedMesh(pineGeometry(), flat(0xffffff, { vertexColors: true }), at.length), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  at.forEach(([x, y, z, s], i) => { q.setFromAxisAngle(up, i * 1.7); m.compose(new Vector3(x, y, z), q, new Vector3(s, s, s)); mesh.setMatrixAt(i, m); });
  mesh.computeBoundingSphere(); return mesh;
}

/** A plank bridge along a local -Z run of `length` metres, `width` wide, deck top at local y 0. */
export function plankBridge(length: number, width: number, material: MeshStandardMaterial, rails: MeshStandardMaterial | null): Group {
  const group = new Group(), step = 0.62, count = Math.max(1, Math.floor(length / step)), m = new Matrix4();
  // a rope bridge lays the generated plank segments when the kit loaded; a hover deck (no rails) keeps its glass planks
  const kit = rails !== null ? kitDeck(length, width) : null;
  if (kit !== null) group.add(kit);
  else {
    const planks = new InstancedMesh(new BoxGeometry(width, 0.12, 0.5), material, count);
    for (let i = 0; i < count; i++) { m.makeTranslation(0, -0.06, -(i + 0.5) * (length / count)); planks.setMatrixAt(i, m); }
    planks.computeBoundingSphere(); group.add(planks);
  }
  if (rails !== null) {
    const posts = kitPosts(width, length);
    if (posts !== null) group.add(posts);
    for (const side of [-1, 1]) {
      const rope = new Mesh(new BoxGeometry(0.06, 0.06, length), rails); rope.position.set(side * width / 2, 1, -length / 2); group.add(rope);
      const low = new Mesh(new BoxGeometry(0.05, 0.05, length), rails); low.position.set(side * width / 2, 0.45, -length / 2); group.add(low);
      if (posts === null) for (const z of [0, -length]) { const post = new Mesh(new BoxGeometry(0.16, 1.3, 0.16), flat(PALETTE.trunk)); post.position.set(side * width / 2, 0.55, z); group.add(post); }
    }
  }
  return group;
}

/** The rope-bridge kit (Hunyuan3D-2 from `art/far-reach/round-9-bridge/ref-bridge-*.jpg`): a plank deck segment about this long, and an anchor post this tall. */
const DECK_SEGMENT = 4.8, POST_HEIGHT = 1.6;
/** The generated deck segments laid end to end along local −Z, top at y 0, stretched to the span's width; null without the kit. */
function kitDeck(length: number, width: number): InstancedMesh | null {
  const source = skyMesh('bridge-deck'); if (source === null) return null;
  // fitted along its long axis (x), then turned so that axis runs down the span
  const g = fit(source, { size: DECK_SEGMENT, by: 'span', floor: 0 }); g.rotateY(Math.PI / 2); g.computeBoundingBox();
  const b = g.boundingBox; if (b === null) return null;
  const n = Math.max(1, Math.round(length / DECK_SEGMENT)), seg = length / n;
  g.translate(-(b.min.x + b.max.x) / 2, -b.max.y, -(b.min.z + b.max.z) / 2);
  g.scale(width / Math.max(1e-3, b.max.x - b.min.x), 1, seg / Math.max(1e-3, b.max.z - b.min.z)); g.computeVertexNormals();
  const mesh = new InstancedMesh(g, flat(0xffffff, { vertexColors: true }), n), m = new Matrix4();
  for (let i = 0; i < n; i++) { m.makeTranslation(0, 0, -(i + 0.5) * seg); mesh.setMatrixAt(i, m); }
  mesh.computeBoundingSphere(); return mesh;
}
/** The generated anchor posts at the span's four corners, just outside the rope rails; null without the kit. */
function kitPosts(width: number, length: number): InstancedMesh | null {
  const source = skyMesh('bridge-post'); if (source === null) return null;
  const g = fit(source, { size: POST_HEIGHT, by: 'height', floor: 0, centre: 'base' }), mesh = new InstancedMesh(g, flat(0xffffff, { vertexColors: true }), 4), m = new Matrix4();
  let i = 0;
  for (const side of [-1, 1]) for (const z of [0, -length]) { m.makeTranslation(side * (width / 2 + 0.12), -0.05, z); mesh.setMatrixAt(i++, m); }
  mesh.computeBoundingSphere(); return mesh;
}
/** The rope-bridge kit for the Model Explorer: one deck segment with its four posts and the code ropes. */
export function bridgeKit(): Group { return plankBridge(DECK_SEGMENT, 2.6, flat(PALETTE.plank), flat(PALETTE.rope)); }

/** The windmill's generated tower (C6) is fitted to this height; its sail hub stub sits at `MILL_HUB` on it. */
const MILL_HEIGHT = 10.6, MILL_HUB = { y: 7.92, z: 2.85 } as const;
/**
 * The old windmill: the generated stone-and-timber tower (C6, Hunyuan3D-2 from `art/far-reach/round-7-models/ref-windmill.jpg`)
 * or, without it, a tapered octagonal tower and cap; four lattice sails on a hub that the plugin turns.
 */
export function windmill(): { group: Group; hub: Object3D } {
  const group = new Group(), hub = new Group(), tower = skyMesh('windmill');
  if (tower !== null) {
    group.add(new Mesh(fit(tower, { size: MILL_HEIGHT, by: 'height', floor: 0, centre: 'base' }), flat(0xffffff, { vertexColors: true })));
    hub.position.set(0, MILL_HUB.y, MILL_HUB.z);
  } else {
    const body = new Mesh(new CylinderGeometry(1.5, 2.5, 9, 8), flat(PALETTE.tower)); body.position.y = 4.5; group.add(body);
    const cap = new Mesh(new ConeGeometry(2.1, 2.4, 8), flat(PALETTE.rockDark)); cap.position.y = 10.2; group.add(cap);
    const door = new Mesh(new BoxGeometry(1, 1.8, 0.2), flat(PALETTE.rockDark)); door.position.set(0, 0.9, 2.4); group.add(door);
    hub.position.set(0, 8.6, 2.2);
  }
  group.add(hub);
  const sail = flat(PALETTE.sail);
  for (let i = 0; i < 4; i++) {
    const arm = new Group(); arm.rotation.z = (i * Math.PI) / 2; hub.add(arm);
    const spar = new Mesh(new BoxGeometry(0.22, 7, 0.22), sail); spar.position.y = 3.5; arm.add(spar);
    const cloth = new Mesh(new BoxGeometry(1.5, 5.2, 0.06), sail); cloth.position.set(0.85, 4.2, 0.05); arm.add(cloth);
  }
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
/** The bridge-keeper's notes: a weathered lectern with a pinned page. */
export function lectern(): Group {
  const group = new Group(), wood = flat(PALETTE.trunk);
  const stand = new Mesh(new BoxGeometry(0.4, 1.05, 0.4), wood); stand.position.y = 0.52; group.add(stand);
  const top = new Mesh(new BoxGeometry(0.8, 0.08, 0.6), wood); top.position.y = 1.1; top.rotation.x = -0.35; group.add(top);
  const page = new Mesh(new BoxGeometry(0.5, 0.02, 0.38), flat(0xefe6d2)); page.position.set(0, 1.16, 0.02); page.rotation.x = -0.35; group.add(page);
  return group;
}
/** The storm crown's dais and its ring of broken pillars. */
export function crownRuin(daisR: number, daisH: number): Group {
  const group = new Group(), stone = flat(0x6b6177);
  const dais = new Mesh(new CylinderGeometry(daisR, daisR + 0.4, daisH, 10), stone); dais.position.y = daisH / 2; group.add(dais);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, h = 2 + ((i * 37) % 5) * 0.7, pillar = new Mesh(new CylinderGeometry(0.45, 0.55, h, 6), stone);
    pillar.position.set(Math.cos(a) * 12.5, h / 2, Math.sin(a) * 12.5); group.add(pillar);
  }
  return group;
}
/** Storm clouds: soft pale puffs that ring the crown. */
export function stormClouds(count: number, radius: number): InstancedMesh {
  // soft, smooth-shaded and pale (lit by the painted rim from the sun behind them), not dark faceted blobs
  const mesh = new InstancedMesh(puff(), new MeshStandardMaterial({ color: 0xb7a2c2, emissive: 0x2c2036, roughness: 1, metalness: 0 }), count), m = new Matrix4(), q = new Quaternion();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2, s = 5 + (i % 3) * 2.5;
    m.compose(new Vector3(Math.cos(a) * radius, (i % 4) * 2.5, Math.sin(a) * radius), q, new Vector3(s * 1.6, s * 0.6, s)); mesh.setMatrixAt(i, m);
  }
  mesh.computeBoundingSphere(); return mesh;
}
function puff(): BufferGeometry { return new IcosahedronGeometry(1, 3); }
