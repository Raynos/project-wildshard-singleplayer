/**
 * The nomad camp's people (NALATI-MERGE Q2; N16 wave 5: "procedural painterly figures now, generated + rigged models
 * later" — row D2). Five figures on the shared painterly POI material (src/world/nalati/paint.ts PaintKit → poiMaterial,
 * soft cel bands, the cool painted shade, the warm rim), each built from smooth lathes, capsules and spheres with
 * per-vertex paint:
 *
 *   elder   Baqyt Ata, the quest giver — an indigo chapan with a gold hem, a red sash, a tall white kalpak with a black
 *           brim, a white beard, a staff (asa-tayaq); by the big yurt's door
 *   herder  Dauren at the corral gate (a fur tymaq with ear flaps, a whip) and Erlan at the hitching rail (a kalpak)
 *   child   Ayan — a green vest, an embroidered taqiya — skipping rings round the ribbon pole
 *   cook    Gulnar Apa at the iron stove — a long red dress, a velvet waistcoat, a white apron and headscarf, a ladle
 *
 * D2: the same five as generated + rigged models (src/nalati/campPeopleModels.ts, the image-to-3D pipeline — the user's
 * pick, N20) — one SkinnedMesh on the figures' own root / head / arm pivots, driven by this runtime. The procedural batch
 * below is their frame (heights, pivots), shows while they load, and its readable faces are what NALATI-FINISH B5 moves
 * onto the model bodies.
 *
 * ONE BatchedMesh for all of them (a body, a head and a right arm per figure = 15 instances): 1 draw + 1 shadow draw,
 * whatever the tier (the phone budget, ≤ ~110 calls at the camp). Each figure turns to face you as you come near,
 * breathes, glances about; the head follows you; while talking it gestures (the arm) and nods; the cook stirs, the
 * child skips until you are close. Colliders: a capsule each, registered with the world registry (the still ones as one
 * static piece, the child on a kinematic body that `follows` her), so they are drawn, collide and are in Explore's
 * catalog from one `add` (PHYSICS.md; the way P1 registers the Nalati builders).
 *
 *   const people = buildCampPeople(sky, floorAt, registry);
 *   people.update(dt, t, player.position)           // every frame (cheap: skipped past 90 m)
 *   people.fig.elder.talking = true                  // gestures + nods while the dialogue is open
 *   people.fig.elder.headWorld                       // where its "[E] Talk" prompt sits
 */
import * as THREE from 'three';
import { PaintKit, pole, v3, lathe, poiMaterial } from '../world/nalati/paint';
import type { Sky } from '../world/Sky';
import type { WorldRegistry, ColliderDesc } from '../world/registry';
import { CAMP_PEOPLE } from '../game/quest/nalati';
import { loadPeopleRig, type PersonFrame, type PeopleRig } from './campPeopleModels';

export type PersonId = keyof typeof CAMP_PEOPLE;

/** one figure's live state */
export interface Person {
  id: PersonId;
  /** feet, world */
  readonly feet: THREE.Vector3;
  /** the talk prompt's point (head height, world; follows the child) */
  readonly headWorld: THREE.Vector3;
  talking: boolean;
  /** body yaw now (radians; 0 = the figure faces +z) */
  yaw: number;
}

export interface CampPeople {
  group: THREE.Group;
  fig: Record<PersonId, Person>;
  update: (dt: number, t: number, player: THREE.Vector3) => void;
}

// ── the palette (painterly: saturated, warm) ─────────────────────────────────────────────────────────────────────────
const C = {
  skin: '#c89066', skinDark: '#a8704c', beard: '#ebe6dc', hair: '#2a211c',
  indigo: '#34315a', gold: '#d2a646', red: '#b5302a', felt: '#efe8d8', black: '#1c1a1a', boot: '#2a1d16',
  coat: '#7a5634', coat2: '#56613c', trousers: '#39373e', fur: '#8c6a47', tymaqTop: '#a3291f', wood: '#6e4a2c',
  under: '#6e2a2a', shirt: '#ece4d2', vest: '#2f7a4c', cap: '#a9322a', dress: '#9b2d2a', velvet: '#1f4a3f', apron: '#ebe3d1', scarf: '#f3eee4', iron: '#3b3a3c',
};

interface Parts { body: THREE.BufferGeometry; head: THREE.BufferGeometry; arm: THREE.BufferGeometry; neck: THREE.Vector3; shoulder: THREE.Vector3; height: number; radius: number }

/** a sphere shell open at the face (±57° round the front, below the height `open` of the way up the sphere): a headscarf, hair */
const hood = (r: number, open: number): THREE.BufferGeometry => {
  const g = new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.8);
  const pos = g.getAttribute('position'), idx = g.getIndex(), keep: number[] = [];
  if (idx) for (let i = 0; i + 2 < idx.count; i += 3) {
    let fx = 0, fy = 0, fz = 0;
    for (let k = 0; k < 3; k++) { const v = idx.getX(i + k); fx += pos.getX(v); fy += pos.getY(v); fz += pos.getZ(v); }
    const face = fz > 0 && Math.abs(Math.atan2(fx, fz)) < 1.0 && fy / 3 < r * (open - 0.5) * 2;
    if (!face) keep.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
  }
  g.setIndex(keep);
  return g;
};
/** how far round from the front (+z) a face centre is, radians 0…π — lathe front panels by whole faces (no zig-zag) */
const front = (p: THREE.Vector3): number => Math.abs(Math.atan2(p.x, p.z));
const sphere = (r: number, sx = 1, sy = 1, sz = 1, w = 12, h = 9): THREE.BufferGeometry => new THREE.SphereGeometry(r, w, h).scale(sx, sy, sz);

/** a head at the neck pivot (origin = the neck's top), facing +z: face, nose, eyes, ears, the neck (hats are added by the caller) */
function head(kit: PaintKit, skin: string, r: number): void {
  kit.add(sphere(r, 0.92, 1.05, 0.98).translate(0, r * 0.95, 0), skin, { brush: 0.05 });
  kit.add(sphere(r * 0.2, 0.8, 1, 1.1, 8, 6).translate(0, r * 0.85, r * 0.93), C.skinDark);        // nose
  for (const s of [-1, 1]) {
    kit.add(sphere(r * 0.1, 1, 1, 0.6, 6, 5).translate(s * r * 0.36, r * 1.08, r * 0.86), C.black, { jitter: 0 }); // eyes
    kit.add(sphere(r * 0.22, 0.5, 1, 0.8, 6, 5).translate(s * r * 0.93, r * 0.95, 0), C.skinDark);  // ears
  }
  kit.add(new THREE.CylinderGeometry(r * 0.42, r * 0.5, r * 0.5, 8).translate(0, -r * 0.05, 0), skin); // neck
}

/** a sleeve from the shoulder pivot (origin) hanging down-forward, with a hand */
function arm(kit: PaintKit, sleeve: string, skin: string, len: number, r: number, extra?: (k: PaintKit, hand: THREE.Vector3) => void): void {
  const hand = v3(0, -len, len * 0.28);
  kit.add(pole(v3(0, 0.02, 0), hand, r, r * 0.8, 8), sleeve, { brush: 0.06 });
  kit.add(sphere(r * 0.85, 1, 1.1, 1).translate(hand.x, hand.y - r * 0.6, hand.z), skin);
  extra?.(kit, v3(hand.x, hand.y - r * 0.6, hand.z));
}

function finish(kit: PaintKit, ao = false): THREE.BufferGeometry {
  const g = kit.finish({ ao: ao ? {} : false });
  if (g.hasAttribute('uv')) g.deleteAttribute('uv');
  return g;
}

// ── the figures (local frame: feet at the origin, facing +z, +x = the figure's LEFT) ─────────────────────────────────

function elder(seed: number): Parts {
  const b = new PaintKit(seed);
  // the chapan: a long robe to the ankles, a gold hem band, the front edges trimmed
  const robe = lathe([[0.001, 0.06], [0.34, 0.06], [0.33, 0.3], [0.3, 0.7], [0.26, 0.98], [0.23, 1.15], [0.25, 1.33], [0.2, 1.46], [0.1, 1.52], [0.001, 1.53]], 24);
  b.add(robe, (p) => { const a = front(p); return p.y < 0.16 ? C.gold : a < 0.2 ? C.under : a < 0.45 ? C.gold : C.indigo; }, { foot: 0.8 });
  b.add(new THREE.TorusGeometry(0.245, 0.045, 6, 18).rotateX(Math.PI / 2).translate(0, 1.0, 0), C.red);                  // the sash
  kit2Boots(b, 0.26);
  // the left arm, merged: down to the staff
  b.add(pole(v3(0.23, 1.4, 0), v3(0.3, 1.02, 0.2), 0.065, 0.055, 8), C.indigo);
  b.add(sphere(0.05).translate(0.31, 0.98, 0.23), C.skin);
  b.add(pole(v3(0.32, 0.0, 0.26), v3(0.31, 1.62, 0.22), 0.025, 0.02, 6), C.wood);                                         // the staff
  b.add(sphere(0.045).translate(0.31, 1.64, 0.22), C.wood);
  const h = new PaintKit(seed + 1);
  head(h, C.skin, 0.115);
  h.add(new THREE.ConeGeometry(0.078, 0.21, 9).rotateX(Math.PI).scale(1, 1, 0.7).translate(0, -0.04, 0.078), C.beard, { brush: 0.12 }); // the beard, from the mouth down
  h.add(pole(v3(-0.07, 0.07, 0.1), v3(0.07, 0.07, 0.1), 0.018, 0.018, 5), C.beard);                                       // moustache
  h.add(lathe([[0.001, 0.2], [0.125, 0.19], [0.11, 0.3], [0.075, 0.4], [0.03, 0.44], [0.001, 0.445]], 12), C.felt);        // the kalpak
  h.add(new THREE.TorusGeometry(0.125, 0.028, 5, 14).rotateX(Math.PI / 2).translate(0, 0.205, 0), C.black);                // its brim
  const a = new PaintKit(seed + 2);
  arm(a, C.indigo, C.skin, 0.44, 0.065);
  return { body: finish(b, true), head: finish(h), arm: finish(a), neck: v3(0, 1.5, 0.01), shoulder: v3(-0.23, 1.4, 0), height: 1.95, radius: 0.34 };
}

/** two boot toes peeking out under a robe */
function kit2Boots(k: PaintKit, fwd: number): void {
  for (const s of [-1, 1]) k.add(sphere(0.06, 1, 0.7, 1.7).translate(s * 0.1, 0.045, fwd), C.boot);
}

function herder(seed: number, hat: 'tymaq' | 'kalpak', coat: string): Parts {
  const b = new PaintKit(seed);
  for (const s of [-1, 1]) {
    b.add(pole(v3(s * 0.1, 0.1, 0), v3(s * 0.11, 0.86, 0), 0.07, 0.08, 8), C.trousers);
    b.add(lathe([[0.001, 0.0], [0.075, 0.0], [0.075, 0.34], [0.07, 0.36], [0.001, 0.36]], 9).scale(1, 1, 1.25).translate(s * 0.1, 0, 0.02), C.boot); // tall boots
    b.add(sphere(0.06, 1, 0.7, 1.5).translate(s * 0.1, 0.04, 0.08), C.boot);
  }
  // the short chapan to the knee, open at the front over a shirt
  const coatG = lathe([[0.001, 0.52], [0.27, 0.52], [0.25, 0.8], [0.23, 1.02], [0.25, 1.3], [0.2, 1.44], [0.1, 1.5], [0.001, 1.51]], 24);
  b.add(coatG, (p) => { const a = front(p); return a < 0.2 && p.y > 1.05 ? C.shirt : p.y < 0.6 || (a < 0.45 && a >= 0.2) ? C.gold : coat; }, { foot: 0.85 });
  b.add(new THREE.TorusGeometry(0.235, 0.04, 6, 18).rotateX(Math.PI / 2).translate(0, 1.02, 0), C.red);
  b.add(pole(v3(0.22, 1.38, 0), v3(0.28, 1.0, 0.12), 0.06, 0.05, 8), coat);                                              // the left arm, merged
  b.add(sphere(0.048).translate(0.29, 0.96, 0.14), C.skin);
  const h = new PaintKit(seed + 1);
  head(h, C.skin, 0.11);
  h.add(pole(v3(-0.07, 0.075, 0.098), v3(0.07, 0.075, 0.098), 0.014, 0.014, 5), C.hair);                                 // moustache
  if (hat === 'tymaq') {
    h.add(sphere(0.135, 1, 0.75, 1, 12, 8).translate(0, 0.19, -0.005), C.tymaqTop);
    h.add(new THREE.TorusGeometry(0.12, 0.045, 6, 14).rotateX(Math.PI / 2).translate(0, 0.17, 0), C.fur, { brush: 0.15 });
    for (const s of [-1, 1]) h.add(sphere(0.055, 0.5, 1.2, 1).translate(s * 0.125, 0.07, -0.01), C.fur, { brush: 0.15 }); // ear flaps
    h.add(sphere(0.07, 1, 0.8, 0.5).translate(0, 0.08, -0.12), C.fur, { brush: 0.15 });                                    // the neck flap
  } else {
    h.add(lathe([[0.001, 0.2], [0.12, 0.19], [0.105, 0.29], [0.07, 0.37], [0.001, 0.4]], 12), C.felt);
    h.add(new THREE.TorusGeometry(0.12, 0.026, 5, 14).rotateX(Math.PI / 2).translate(0, 0.205, 0), C.black);
  }
  const a = new PaintKit(seed + 2);
  arm(a, coat, C.skin, 0.42, 0.062, hat === 'tymaq'
    ? (k, hand) => { k.add(pole(hand, v3(hand.x - 0.02, hand.y - 0.02, hand.z + 0.34), 0.016, 0.012, 5), C.wood); k.add(pole(v3(hand.x - 0.02, hand.y - 0.02, hand.z + 0.34), v3(hand.x - 0.05, hand.y - 0.5, hand.z + 0.4), 0.007, 0.005, 4), C.boot); } // the qamshy (whip)
    : undefined);
  return { body: finish(b, true), head: finish(h), arm: finish(a), neck: v3(0, 1.48, 0.01), shoulder: v3(-0.22, 1.38, 0), height: 1.85, radius: 0.3 };
}

function child(seed: number): Parts {
  const b = new PaintKit(seed);
  for (const s of [-1, 1]) {
    b.add(pole(v3(s * 0.065, 0.06, 0), v3(s * 0.07, 0.5, 0), 0.045, 0.05, 7), C.trousers);
    b.add(sphere(0.045, 1, 0.8, 1.5).translate(s * 0.065, 0.04, 0.03), C.boot);
  }
  b.add(lathe([[0.001, 0.46], [0.16, 0.46], [0.15, 0.62], [0.14, 0.78], [0.12, 0.86], [0.06, 0.9], [0.001, 0.905]], 24), (p) => (p.y > 0.55 && front(p) < 0.45 ? C.shirt : p.y < 0.52 ? C.gold : C.vest), { foot: 0.9 });
  b.add(pole(v3(0.13, 0.84, 0), v3(0.19, 0.58, 0.06), 0.036, 0.032, 7), C.shirt);
  b.add(sphere(0.03).translate(0.195, 0.55, 0.07), C.skin);
  const h = new PaintKit(seed + 1);
  head(h, C.skin, 0.1);
  h.add(hood(0.104, 0.62).translate(0, 0.1, -0.01), C.hair);                                                            // hair under the cap
  h.add(lathe([[0.001, 0.15], [0.1, 0.15], [0.098, 0.2], [0.07, 0.23], [0.001, 0.24]], 10), (p) => (Math.floor(Math.atan2(p.x, p.z) * 2.5) % 2 === 0 ? C.cap : C.gold)); // the taqiya
  const a = new PaintKit(seed + 2);
  arm(a, C.shirt, C.skin, 0.28, 0.036);
  return { body: finish(b, true), head: finish(h), arm: finish(a), neck: v3(0, 0.88, 0.01), shoulder: v3(-0.13, 0.84, 0), height: 1.15, radius: 0.2 };
}

function cook(seed: number): Parts {
  const b = new PaintKit(seed);
  b.add(lathe([[0.001, 0.04], [0.33, 0.04], [0.31, 0.35], [0.27, 0.72], [0.22, 0.98], [0.21, 1.12], [0.24, 1.3], [0.19, 1.42], [0.09, 1.47], [0.001, 1.48]], 24),
    (p) => (p.y > 0.95 && p.y < 1.4 ? C.velvet : front(p) < 0.7 && p.y < 0.98 && p.y > 0.12 ? C.apron : p.y < 0.1 ? C.gold : C.dress), { foot: 0.85 });
  kit2Boots(b, 0.25);
  b.add(pole(v3(0.21, 1.34, 0), v3(0.26, 0.98, 0.16), 0.058, 0.05, 8), C.dress);
  b.add(sphere(0.045).translate(0.265, 0.95, 0.18), C.skin);
  const h = new PaintKit(seed + 1);
  head(h, C.skin, 0.105);
  // the oramal: a white scarf over the head, knotted at the back, its tail down the neck
  h.add(hood(0.126, 0.7).translate(0, 0.105, -0.012), C.scarf);
  h.add(sphere(0.06, 1, 1.4, 0.7).translate(0, 0.02, -0.13), C.scarf);
  const a = new PaintKit(seed + 2);
  arm(a, C.dress, C.skin, 0.36, 0.058, (k, hand) => {
    k.add(pole(hand, v3(hand.x, hand.y - 0.05, hand.z + 0.42), 0.012, 0.012, 5), C.wood);                               // the ladle
    k.add(sphere(0.045, 1, 0.55, 1).translate(hand.x, hand.y - 0.07, hand.z + 0.45), C.iron);
  });
  return { body: finish(b, true), head: finish(h), arm: finish(a), neck: v3(0, 1.45, 0.01), shoulder: v3(-0.21, 1.34, 0), height: 1.75, radius: 0.33 };
}

/** each figure's builder (the seeds fix its brush noise) */
const BUILD: Readonly<Record<PersonId, () => Parts>> = {
  elder: () => elder(0xe1d3), herderGate: () => herder(0x4e7a, 'tymaq', C.coat), herderRail: () => herder(0x4e7b, 'kalpak', C.coat2),
  child: () => child(0xc41d), cook: () => cook(0xc00c),
};

/** one procedural figure at rest (feet at the origin, facing +z) — the comparison sheets (scripts/nalati-models-merge-compare.mjs) */
export function personPreview(sky: Sky, id: PersonId): THREE.Group {
  const p = BUILD[id](), mat = poiMaterial(sky), g = new THREE.Group();
  g.add(new THREE.Mesh(p.body, mat));
  const headM = new THREE.Mesh(p.head, mat); headM.position.copy(p.neck); g.add(headM);
  const armM = new THREE.Mesh(p.arm, mat); armM.position.copy(p.shoulder); g.add(armM);
  return g;
}

// ── the runtime ──────────────────────────────────────────────────────────────────────────────────────────────────────

interface Live extends Person {
  parts: Parts;
  ids: { body: number; head: number; arm: number };
  idleYaw: number;
  headYaw: number; headPitch: number;
  armX: number; armZ: number;
  glanceT: number; glance: number;
  phase: number;
  /** the child's ring round the pole (angle) */
  ring: number;
  anchor: THREE.Object3D | null;
}

const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a: number, b: number, k: number, dt: number): number => a + (b - a) * (1 - Math.exp(-k * dt));

const CHILD_RING = 2.3;

export function buildCampPeople(sky: Sky, floorAt: (x: number, z: number) => number, registry: WorldRegistry | null): CampPeople {
  const built: Record<PersonId, Parts> = { elder: BUILD.elder(), herderGate: BUILD.herderGate(), herderRail: BUILD.herderRail(), child: BUILD.child(), cook: BUILD.cook() };
  const ids = Object.keys(built) as PersonId[];
  let verts = 0;
  for (const id of ids) { const p = built[id]; verts += p.body.getAttribute('position').count + p.head.getAttribute('position').count + p.arm.getAttribute('position').count; }
  const batch = new THREE.BatchedMesh(ids.length * 3, verts, 0, poiMaterial(sky));
  batch.name = 'nalati-camp-people';
  batch.castShadow = true; batch.receiveShadow = true;
  batch.sortObjects = false; batch.perObjectFrustumCulled = true; batch.frustumCulled = false; // instances move: three culls each one
  const group = new THREE.Group();
  group.name = 'nalati-camp-people';
  group.add(batch);

  const fig = {} as Record<PersonId, Live>;
  for (const id of ids) {
    const parts = built[id], spot = CAMP_PEOPLE[id];
    const g = { body: batch.addGeometry(parts.body), head: batch.addGeometry(parts.head), arm: batch.addGeometry(parts.arm) };
    parts.body.dispose(); parts.head.dispose(); parts.arm.dispose();
    const x = id === 'child' ? spot.x + CHILD_RING : spot.x, z = spot.z;
    fig[id] = {
      id, parts, feet: v3(x, floorAt(x, z), z), headWorld: new THREE.Vector3(), talking: false, yaw: spot.yaw,
      ids: { body: batch.addInstance(g.body), head: batch.addInstance(g.head), arm: batch.addInstance(g.arm) },
      idleYaw: spot.yaw, headYaw: 0, headPitch: 0, armX: 0, armZ: 0, glanceT: 2 + ids.indexOf(id), glance: 0, phase: ids.indexOf(id) * 1.7, ring: 0, anchor: null,
    };
  }

  // colliders: a capsule per figure; the four who stay put as one static piece, the child on a body that follows her
  const capsule = (p: Live, local: boolean): ColliderDesc => {
    const r = p.parts.radius, hh = Math.max(0.05, p.parts.height / 2 - r);
    return { kind: 'capsule', x: local ? 0 : p.feet.x, y: (local ? 0 : p.feet.y) + p.parts.height / 2, z: local ? 0 : p.feet.z, halfHeight: hh, radius: r, surface: 'flesh' };
  };
  const still = ids.filter((id) => id !== 'child').map((id) => capsule(fig[id], false));
  const childAnchor = new THREE.Object3D();
  childAnchor.name = 'nalati-camp-child';
  group.add(childAnchor);
  fig.child.anchor = childAnchor;
  const place = (p: Live): void => { p.anchor?.position.copy(p.feet); p.anchor?.updateMatrixWorld(true); };
  place(fig.child);
  if (registry) {
    registry.add({ id: 'nalati-camp-people', name: 'Camp people', category: 'creatures', file: 'src/nalati/campPeople.ts', object: group, colliders: still, surface: 'flesh', model: { category: 'creatures' } });
    registry.add({ id: 'nalati-camp-child', name: 'Camp child', category: 'creatures', file: 'src/nalati/campPeople.ts', colliders: [capsule(fig.child, true)], surface: 'flesh', follows: childAnchor });
  }

  // D2: the generated + rigged figures (campPeopleModels.ts) on the procedural figures' frames
  const frames = {} as Record<PersonId, PersonFrame>;
  for (const id of ids) { const pp = fig[id].parts; frames[id] = { height: pp.height, neck: pp.neck, shoulder: pp.shoulder }; }
  let rig: PeopleRig<PersonId> | null = null;

  const _hq = new THREE.Quaternion(), _aq = new THREE.Quaternion();
  const pose = (p: Live): void => {
    const breathe = 1 + Math.sin(p.phase * 1.3) * 0.012;
    _b.compose(p.feet, _q.setFromEuler(_e.set(0, p.yaw, 0)), _s.set(1, breathe, 1));
    // the head: a turn + a tilt about the neck; the arm: a swing about the shoulder
    _hq.setFromEuler(_e.set(p.headPitch, p.headYaw, 0, 'YXZ'));
    _aq.setFromEuler(_e.set(p.armX, 0, p.armZ));
    _s.set(1, 1, 1);
    if (rig) {
      const b = rig.bones[p.id];
      b.root.matrixWorld.copy(_b);
      b.head.matrixWorld.compose(b.neck, _hq, _s).premultiply(_b);
      b.arm.matrixWorld.compose(b.shoulder, _aq, _s).premultiply(_b);
    } else {
      batch.setMatrixAt(p.ids.body, _b);
      batch.setMatrixAt(p.ids.head, _m.compose(p.parts.neck, _hq, _s).premultiply(_b));
      batch.setMatrixAt(p.ids.arm, _m.compose(p.parts.shoulder, _aq, _s).premultiply(_b));
    }
    p.headWorld.copy(p.parts.neck).applyMatrix4(_b);
    p.headWorld.y += 0.12;
  };

  // the image-to-3D figures (N20, the user's pick): the procedural batch stands until they have loaded (and stays if they fail)
  for (const id of ids) pose(fig[id]);
  void loadPeopleRig(sky, frames).then((r) => {
    group.add(r.mesh);
    rig = r; batch.visible = false;
    for (const id of ids) pose(fig[id]);
    return r;
  }).catch((e: unknown) => { console.warn('[nalati] camp people models failed: the procedural figures stay', e); });

  let asleep = false;
  const update = (dt: number, t: number, player: THREE.Vector3): void => {
    const far = Math.hypot(player.x - fig.elder.feet.x, player.z - fig.elder.feet.z) > 90;
    if (far) { asleep = true; return; }   // nothing to see from out of the valley: the last pose holds
    if (asleep) asleep = false;
    for (const id of ids) {
      const p = fig[id];
      p.phase += dt;
      const dx = player.x - p.feet.x, dz = player.z - p.feet.z, d = Math.hypot(dx, dz), toYou = Math.atan2(dx, dz);
      // the child skips round the ribbon pole until you come close (or talk)
      if (id === 'child') {
        const spot = CAMP_PEOPLE.child;
        const stop = d < 5 || p.talking;
        if (!stop) {
          p.ring += dt * 0.55;
          const x = spot.x + Math.cos(p.ring) * CHILD_RING, z = spot.z + Math.sin(p.ring) * CHILD_RING;
          p.feet.set(x, floorAt(x, z) + Math.abs(Math.sin(p.phase * 6.5)) * 0.1, z);
          p.idleYaw = Math.atan2(-Math.sin(p.ring), Math.cos(p.ring));   // the ring's tangent (counter-clockwise)
          place(p);
        } else p.feet.y = damp(p.feet.y, floorAt(p.feet.x, p.feet.z), 10, dt);
      }
      // the body turns to you inside 7 m (a little, from further for the talker), else back to its own facing
      const face = p.talking || d < 7 ? toYou : p.idleYaw;
      p.yaw += wrap(face - p.yaw) * (1 - Math.exp(-(p.talking ? 5 : 2.5) * dt));
      // the head follows you inside 12 m (±70° off the body), else glances about now and then
      p.glanceT -= dt;
      if (p.glanceT < 0) { p.glanceT = 2.5 + ((p.phase * 7.3) % 3); p.glance = (Math.sin(p.phase * 3.1) * 0.9); }
      let hy = p.glance * 0.6, hp = 0;
      if (d < 12 || p.talking) {
        hy = Math.max(-1.2, Math.min(1.2, wrap(toYou - p.yaw)));
        hp = -Math.atan2(player.y + 1.6 - (p.feet.y + p.parts.neck.y), Math.max(0.5, d)) * 0.6;
      }
      if (p.talking) hp += Math.sin(t * 5.2) * 0.06;                                   // nods as it talks
      if (id === 'cook' && !p.talking && d > 3) { hy = -0.35; hp = 0.35; }           // eyes on the pot
      if (id === 'child' && !p.talking && d > 5) { hy = 0; hp = -0.1; }
      p.headYaw = damp(p.headYaw, hy, 4, dt); p.headPitch = damp(p.headPitch, hp, 4, dt);
      // the arm: a gesture while talking, the cook's stir, a hang and sway otherwise
      let ax = Math.sin(p.phase * 1.1) * 0.04, az = -0.05;
      if (p.talking) { ax = -0.55 - Math.max(0, Math.sin(t * 2.3)) * 0.45; az = -0.25 + Math.sin(t * 1.7) * 0.15; }
      else if (id === 'cook' && d > 3) { ax = -0.75 + Math.sin(t * 2.4) * 0.14; az = -0.2 + Math.cos(t * 2.4) * 0.14; }
      else if (id === 'child' && d > 5) ax = Math.sin(p.phase * 6.5) * 0.6;          // swinging as it skips
      p.armX = damp(p.armX, ax, 6, dt); p.armZ = damp(p.armZ, az, 6, dt);
      pose(p);
    }
  };
  return { group, fig, update };
}
