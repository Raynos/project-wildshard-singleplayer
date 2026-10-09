import { AdditiveBlending, BufferGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector3, type Object3D } from 'three';
import { fit, hdMaterial, skyHd, skyMesh, splitTriangles } from '../world/meshes';
import type { NpcDef } from '@wildshard/engine/quest/core';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { FLAGS } from './flags';
import { STRINGS } from '../data/strings';
import { SPAWN } from '../data/layout';
import { KEEPER_AT } from '../data/quests';

/** Where the bridge-keeper stands: at Sunrest's north rim, left of the rope bridge's posts, facing the spawn (mockup B). */
// E399: 0.8 m further left than loop 5's spot, so the views down the bridge's axis (mockups A and proposal B) frame the
// bridge between its posts with him and his stand outside the portrait frame; from the spawn he stands 16.5 deg left
/** He waves while the player is this close (metres), as Wendell does. */
export const WAVE_RANGE = 16;

/** The keeper's lines: the first whose condition holds is what he says; his first talk is the quest's first step. */
/**
 * His book stand and lantern (E399, mockup B): a step behind him and to his right as the spawn sees him, outside the
 * views down the bridge's axis, its book turned to the spawn.
 */
const STAND_X = KEEPER_AT.x + 0.5, STAND_Z = KEEPER_AT.z - 1.2;
export const KEEPER_STAND = { x: STAND_X, z: STAND_Z, yaw: Math.atan2(SPAWN.x - STAND_X, SPAWN.z - STAND_Z) } as const;
export const KEEPER_NPC: NpcDef = {
  id: 'far.keeper', name: STRINGS.keeperName,
  dialogue: [
    { when: { all: [FLAGS.raised] }, lines: [STRINGS.keeperDone] },
    { when: { all: [FLAGS.notes] }, lines: [STRINGS.keeperLater] },
    { lines: [STRINGS.keeperHello, STRINGS.keeperAsk, STRINGS.keeperHow], sets: [FLAGS.notes] },
  ],
};

export interface Keeper { readonly group: Group; readonly head: Vector3; readonly speaker: { talking: boolean }; update: (t: number, player: Vector3) => void }

/** The generated keeper's frame (metres, his local space, facing +z): his height, the right arm that waves and its shoulder. */
export const KEEPER_MODEL = { height: 1.95, yaw: 0, arm: { x: -0.2, y0: 0.82, y1: 1.5 }, shoulder: [-0.26, 1.47, 0] } as const;

/** Split a flat geometry by triangle centroid: [the rest, the triangles `pick` claims]. */
function split(g: BufferGeometry, pick: (x: number, y: number, z: number) => boolean): [BufferGeometry, BufferGeometry] {
  const p = g.getAttribute('position'), c = g.getAttribute('color'), out = [{ pos: [] as number[], col: [] as number[] }, { pos: [] as number[], col: [] as number[] }];
  for (let t = 0; t + 2 < p.count; t += 3) {
    const side = out[pick((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3) ? 1 : 0];
    if (side) for (let v = t; v < t + 3; v++) { side.pos.push(p.getX(v), p.getY(v), p.getZ(v)); side.col.push(c.getX(v), c.getY(v), c.getZ(v)); }
  }
  const make = (part: { pos: number[]; col: number[] } | undefined): BufferGeometry => {
    const r = new BufferGeometry(); r.setAttribute('position', new Float32BufferAttribute(part?.pos ?? [], 3)); r.setAttribute('color', new Float32BufferAttribute(part?.col ?? [], 3));
    r.computeVertexNormals(); return r;
  };
  g.dispose(); return [make(out[0]), make(out[1])];
}

/** Where the lantern is: the centroid of the most amber vertices on his staff side (+x), high up; they are lit amber. */
function lanternAt(g: BufferGeometry): Vector3 {
  const p = g.getAttribute('position'), c = g.getAttribute('color'), H = KEEPER_MODEL.height, picks: { score: number; i: number }[] = [];
  for (let i = 0; i < p.count; i++) if (p.getX(i) > 0.2 && p.getY(i) > H * 0.7 && p.getY(i) < H * 0.9) picks.push({ score: c.getX(i) * 2 - c.getZ(i) * 2 + c.getY(i), i });
  picks.sort((x, y) => y.score - x.score);
  const top = picks.slice(0, 24), sum = new Vector3();
  // the lantern's own facets burn bright amber (it reads lit at golden hour)
  for (const { i } of top) { sum.x += p.getX(i); sum.y += p.getY(i); sum.z += p.getZ(i); c.setXYZ(i, 1, 0.82, 0.46); }
  c.needsUpdate = true;
  return top.length > 0 ? sum.multiplyScalar(1 / top.length) : new Vector3(0.35, H * 0.72, 0.1);
}

/** The beard and scarf (light facets under the hat, over the chest) go nearer white: the warm key light turns them peach. */
function whiten(g: BufferGeometry): void {
  const p = g.getAttribute('position'), c = g.getAttribute('color'), H = KEEPER_MODEL.height;
  for (let i = 0; i < c.count; i++) {
    const x = p.getX(i), y = p.getY(i), r = c.getX(i), gg = c.getY(i), b = c.getZ(i), hi = Math.max(r, gg, b);
    // linear colours: the beard and scarf are pale peach (g/r ≳ 0.55), the skin a deeper tan, the coat dark
    if (Math.abs(x) > 0.3 || y < H * 0.58 || y > H * 0.84 || hi < 0.4 || gg < r * 0.55 || b < r * 0.28) continue;
    c.setXYZ(i, r + (1 - r) * 0.55, gg + (1 - gg) * 0.6, b + (1 - b) * 0.7);
  }
  c.needsUpdate = true;
}

/**
 * The textured keeper's frame (E410 row 8, `art/far-reach/round-33-keeper/`: mockup B's keeper modelled in a rig pose, his
 * right arm held out from the coat, the hand open, the staff gripped in his left; metres once fitted to KEEPER_MODEL's
 * height, facing +z): his free right arm (−x) is every triangle outboard of a line slanting from x `a + b·y` between `y0`
 * and `y1` (measured on the fitted model: the gap between sleeve and coat runs from x −0.34 at y 0.9 to −0.22 at the
 * shoulder), its shoulder pivot, and the elbow. `pose` is the arm's turns from the modelled pose (radians; shoulder out,
 * elbow up): `rest` lowers the held-out arm toward his side while he idles; `wave` keeps the upper arm out and down and
 * folds the forearm up so the open hand stands beside his head (mockup B); `talk` an open-hand gesture. His
 * staff carries no lantern now: it hangs from the lectern's arm (world/bookStand.ts), as in mockup B.
 */
export const KEEPER_HD = { arm: { a: -0.506, b: 0.185, y0: 0.85, y1: 1.6 }, shoulder: [-0.25, 1.5, 0.03] as const,
  pose: { rest: [-0.3, 0], wave: [0.1, 2.3], talk: [0, 0.9] },
  /**
   * the elbow (round 8, seat A: 'an open waving hand'; mockup B raises the forearm, palm out), halfway down the held-out
   * arm: the forearm is the arm past the plane through it square to `axis` (the arm's direction, shoulder to hand, in x-y)
   */
  elbow: [-0.5, 1.24, 0] as const, axis: [-0.7, -0.71] as const } as const;
/** The arm's [shoulder lift, elbow bend] at idle, waving and talking (radians from the modelled pose). */
interface Pose { rest: readonly [number, number]; wave: readonly [number, number]; talk: readonly [number, number] }
/** The faceted keeper's arm hangs at his side: it lifts out to the side and bends up (round 8). */
const FACETED_POSE: Pose = { rest: [0, 0], wave: [1.2, 2.0], talk: [0.9, 0.5] };
interface Made { group: Group; shoulder: Group; elbow: Group; glow: Mesh<SphereGeometry, MeshBasicMaterial> | null; pose: Pose }
/** The lantern's warm halo: a ball, not a Sprite (the shard's global light patch reaches every material and a sprite's vertex shader lacks `transformed`). */
const halo = (): Mesh<SphereGeometry, MeshBasicMaterial> => new Mesh(new SphereGeometry(0.13, 12, 8), new MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: 0.2, blending: AdditiveBlending, depthWrite: false }));
/** The textured keeper (Hunyuan3D-2's painted keeper): body + the waving right arm on its shoulder pivot, its forearm on the elbow. */
function textured(): Made | null {
  const made = skyHd('keeper-hd'); if (made === null) return null;
  const g = fit(made.geometry, { size: KEEPER_MODEL.height, by: 'height', floor: 0, centre: 'base' }), A = KEEPER_HD.arm, [sx, sy, sz] = KEEPER_HD.shoulder;
  const [body, arm] = splitTriangles(g, (x, y) => y > A.y0 && y < A.y1 && x < A.a + A.b * y);
  const material = hdMaterial(made.map), group = new Group(), shoulder = new Group();
  // his scarf and sash a warm rust-brown, not a loud red (council: 'the keeper's red scarf reads louder than the mockup's
  // brown one'): strongly red texels pulled toward brown, everything else as painted
  patchShader(material, 'far.keeper-scarf', PATCH_ORDER.decorate, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 c = diffuseColor.rgb; float red = smoothstep(0.08, 0.25, c.r - max(c.g, c.b) * 1.1);
    diffuseColor.rgb = mix(c, vec3(c.r * 0.72, c.r * 0.42, c.r * 0.24), red * 0.8); }`);
  }, { key: (prior) => `${prior}|far.keeper-scarf` });
  group.add(new Mesh(body, material));
  shoulder.position.set(sx, sy, sz); group.add(shoulder);
  // the arm split again at the elbow, square to the arm (a level cut halved the wide cuff): the upper arm rides the
  // shoulder, the forearm and hand the elbow
  const [ex, ey, ez] = KEEPER_HD.elbow, [ax, ay] = KEEPER_HD.axis, [upper, fore] = splitTriangles(arm, (x, y) => (x - ex) * ax + (y - ey) * ay > 0), elbow = new Group();
  shoulder.add(new Mesh(upper.translate(-sx, -sy, -sz), material));
  elbow.position.set(ex - sx, ey - sy, ez - sz); shoulder.add(elbow);
  elbow.add(new Mesh(fore.translate(-ex, -ey, -ez), material));
  return { group, shoulder, elbow, glow: null, pose: KEEPER_HD.pose };
}

/** The generated keeper (loop 3; `art/far-reach/round-13-loop-3/`): body + a waving right arm on a shoulder pivot, and a lantern glow. */
function generated(): Made | null {
  const hd = textured(); if (hd !== null) return hd;
  const g = skyMesh('keeper'); if (g === null) return null;
  fit(g, { size: KEEPER_MODEL.height, by: 'height', floor: 0, centre: 'base' }); g.rotateY(KEEPER_MODEL.yaw);
  whiten(g); const lantern = lanternAt(g), A = KEEPER_MODEL.arm, [sx, sy, sz] = KEEPER_MODEL.shoulder;
  const [body, arm] = split(g, (x, y) => x < A.x && y > A.y0 && y < A.y1);
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });
  const group = new Group(), shoulder = new Group();
  group.add(new Mesh(body, material));
  shoulder.position.set(sx, sy, sz); group.add(shoulder);
  shoulder.add(new Mesh(arm.translate(-sx, -sy, -sz), material));
  const glow = halo(); glow.position.copy(lantern); group.add(glow);
  const elbow = new Group(); shoulder.add(elbow);
  return { group, shoulder, elbow, glow, pose: FACETED_POSE };
}

/**
 * The bridge-keeper: an old sky-sailor in a slate-blue coat and hat, a rust-brown scarf, a long white beard, a satchel, a
 * gnarled staff (mockup B). The textured model (round 33), else the faceted one (Hunyuan3D-2), else the code figure below. He waves
 * his free arm when you come near and gestures while he talks.
 */
export function keeper(y: number): Keeper {
  const made = generated();
  if (made === null) return codeKeeper(y);
  const { group, shoulder, elbow, glow, pose } = made;
  group.position.set(KEEPER_AT.x, y, KEEPER_AT.z); group.rotation.y = KEEPER_AT.yaw;
  const head = new Vector3(KEEPER_AT.x, y + 1.8, KEEPER_AT.z), speaker = { talking: false };
  return { group, head, speaker, update: (t, player) => {
    const near = Math.hypot(player.x - KEEPER_AT.x, player.z - KEEPER_AT.z) < WAVE_RANGE;
    // his right arm (−x) lifts out sideways: a wave near, an open-hand gesture while he talks
    // (round 8: mockup B's wave is the upper arm out to his side and the forearm raised, palm out, not a straight raised arm)
    const [l, b] = speaker.talking ? pose.talk : near ? pose.wave : pose.rest;
    const lift = l + (speaker.talking ? Math.sin(t * 2.2) * 0.2 : near ? Math.sin(t * 3) * 0.05 : 0);
    const bend = b + (near && !speaker.talking ? Math.sin(t * 7) * 0.25 : 0);
    shoulder.rotation.z += (-lift - shoulder.rotation.z) * 0.15;
    elbow.rotation.z += (-bend - elbow.rotation.z) * 0.15;
    // a slow breath of a turn, and the lantern's flicker
    group.rotation.y = KEEPER_AT.yaw + Math.sin(t * 0.6) * 0.03;
    // a small warm flicker round the glass (E399 seat: a big orange disc over him)
    if (glow !== null) glow.material.opacity = 0.2 + Math.sin(t * 9) * 0.03 + Math.sin(t * 23) * 0.02;
  } };
}

/** The code figure: the stand-in while the generated model is not loaded. */
function codeKeeper(y: number): Keeper {
  const group = new Group(), m = (color: number): MeshStandardMaterial => new MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true });
  const coat = m(0x4f6a8f), scarf = m(0xe8dcc4), skin = m(0xe0b48e), beard = m(0xf1ece2), wood = m(0x6b4a30), boot = m(0x3a2a20);
  const add = (mesh: Mesh, x: number, yy: number, z: number, parent: Object3D = group): Mesh => { mesh.position.set(x, yy, z); parent.add(mesh); return mesh; };
  add(new Mesh(new ConeGeometry(0.42, 1.25, 8), coat), 0, 0.62, 0);
  add(new Mesh(new CylinderGeometry(0.2, 0.27, 0.5, 8), coat), 0, 1.38, 0);
  add(new Mesh(new CylinderGeometry(0.21, 0.21, 0.12, 8), scarf), 0, 1.6, 0);
  add(new Mesh(new SphereGeometry(0.15, 10, 8), skin), 0, 1.78, 0);
  add(new Mesh(new ConeGeometry(0.12, 0.3, 6), beard), 0, 1.62, 0.09).rotation.x = Math.PI;
  add(new Mesh(new CylinderGeometry(0.17, 0.2, 0.08, 10), m(0x3e4d63)), 0, 1.9, 0);
  add(new Mesh(new ConeGeometry(0.12, 0.14, 10), m(0x3e4d63)), 0, 1.99, 0);
  for (const x of [-0.12, 0.12]) add(new Mesh(new CapsuleGeometry(0.06, 0.1, 2, 6), boot), x, 0.06, 0.04);
  // the staff in his left hand, a lantern hook at its top
  add(new Mesh(new CylinderGeometry(0.025, 0.03, 2.1, 6), wood), -0.36, 1.05, 0.08);
  add(new Mesh(new SphereGeometry(0.05, 6, 5), m(0xd8a84a)), -0.36, 2.12, 0.08);
  // the waving right arm, pivoting at the shoulder
  const shoulder = new Group(); shoulder.position.set(0.25, 1.52, 0); group.add(shoulder);
  add(new Mesh(new CapsuleGeometry(0.065, 0.42, 2, 6), coat), 0, -0.26, 0, shoulder);
  add(new Mesh(new SphereGeometry(0.07, 6, 5), skin), 0, -0.55, 0, shoulder);
  group.position.set(KEEPER_AT.x, y, KEEPER_AT.z); group.rotation.y = KEEPER_AT.yaw;
  const head = new Vector3(KEEPER_AT.x, y + 1.8, KEEPER_AT.z), speaker = { talking: false };
  return { group, head, speaker, update: (t, player) => {
    const near = Math.hypot(player.x - KEEPER_AT.x, player.z - KEEPER_AT.z) < WAVE_RANGE;
    // waving: the arm raised and swinging; talking: a slower open-hand gesture; else at his side
    const lift = speaker.talking ? 1.3 + Math.sin(t * 2.2) * 0.25 : near ? 2.6 + Math.sin(t * 7) * 0.35 : 0.15;
    shoulder.rotation.z += (lift - shoulder.rotation.z) * 0.15;
    group.rotation.y = KEEPER_AT.yaw;
  } };
}
