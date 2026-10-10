import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { buildPrimitive } from '@wildshard/sdk/kit/mergedPrimitives';
import { fitModel, splitTriangles } from '@wildshard/sdk/looks/modelIntake';
import { hdMaterial, skyHd, skyMesh } from '../world/meshes';
import type { NpcDef } from '@wildshard/engine/quest/core';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { KEEPER_SCARF_EDITS } from '../data/paintLook';
import { FLAGS } from './flags';
import { STRINGS } from '../data/strings';
import { SPAWN } from '../data/layout';
import { KEEPER_AT } from '../data/quests';
import { FACETED_POSE, KEEPER_CODE, KEEPER_HALO, KEEPER_HD, KEEPER_LANTERN, KEEPER_MODEL, KEEPER_PAINTS, WAVE_RANGE } from '../data/keeperLook';

/** Where the bridge-keeper stands: at Sunrest's north rim, left of the rope bridge's posts, facing the spawn (mockup B). */
// E399: 0.8 m further left than loop 5's spot, so the views down the bridge's axis (mockups A and proposal B) frame the
// bridge between its posts with him and his stand outside the portrait frame; from the spawn he stands 16.5 deg left
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
  const p = g.getAttribute('position'), c = g.getAttribute('color'), H = KEEPER_MODEL.height, L = KEEPER_LANTERN, picks: { score: number; i: number }[] = [];
  for (let i = 0; i < p.count; i++) if (p.getX(i) > L.side && p.getY(i) > H * L.y0 && p.getY(i) < H * L.y1) picks.push({ score: c.getX(i) * 2 - c.getZ(i) * 2 + c.getY(i), i });
  picks.sort((x, y) => y.score - x.score);
  const top = picks.slice(0, L.picks), sum = new Vector3(), [r, gg, b] = L.lit, [fx, fy, fz] = L.fallback;
  for (const { i } of top) { sum.x += p.getX(i); sum.y += p.getY(i); sum.z += p.getZ(i); c.setXYZ(i, r, gg, b); }
  c.needsUpdate = true;
  return top.length > 0 ? sum.multiplyScalar(1 / top.length) : new Vector3(fx, H * fy, fz);
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

/** The arm's [shoulder lift, elbow bend] at idle, waving and talking (radians from the modelled pose). */
interface Pose { rest: readonly [number, number]; wave: readonly [number, number]; talk: readonly [number, number] }
interface Made { group: Group; shoulder: Group; elbow: Group; glow: Mesh<SphereGeometry, MeshBasicMaterial> | null; pose: Pose }
/** The lantern's warm halo: a ball, not a Sprite (the shard's global light patch reaches every material and a sprite's vertex shader lacks `transformed`). */
const halo = (): Mesh<SphereGeometry, MeshBasicMaterial> => new Mesh(new SphereGeometry(KEEPER_HALO.radius, KEEPER_HALO.widthSegments, KEEPER_HALO.heightSegments), new MeshBasicMaterial({ color: KEEPER_HALO.color, transparent: true, opacity: KEEPER_HALO.opacity, blending: AdditiveBlending, depthWrite: false }));
/** The textured keeper (Hunyuan3D-2's painted keeper): body + the waving right arm on its shoulder pivot, its forearm on the elbow. */
function textured(): Made | null {
  const made = skyHd('keeper-hd'); if (made === null) return null;
  const g = fitModel(made.geometry, { size: KEEPER_MODEL.height, by: 'height', floor: 0, centre: 'base' }), A = KEEPER_HD.arm, [sx, sy, sz] = KEEPER_HD.shoulder;
  const [body, arm] = splitTriangles(g, (x, y) => y > A.y0 && y < A.y1 && x < A.a + A.b * y);
  const material = hdMaterial(made.map), group = new Group(), shoulder = new Group();
  // his scarf and sash a warm rust-brown, not a loud red (council: 'the keeper's red scarf reads louder than the mockup's
  // brown one'): strongly red texels pulled toward brown, everything else as painted
  patchShader(material, 'far.keeper-scarf', PATCH_ORDER.decorate, (shader) => {
    editShader(shader, KEEPER_SCARF_EDITS);
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
  fitModel(g, { size: KEEPER_MODEL.height, by: 'height', floor: 0, centre: 'base' }); g.rotateY(KEEPER_MODEL.yaw);
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
    if (glow !== null) glow.material.opacity = KEEPER_HALO.opacity + Math.sin(t * 9) * 0.03 + Math.sin(t * 23) * 0.02;
  } };
}

/** The code figure: the stand-in while the generated model is not loaded. */
function codeKeeper(y: number): Keeper {
  const group = new Group(), shoulder = new Group(), paints = new Map<string, MeshStandardMaterial>();
  const paint = (key: keyof typeof KEEPER_PAINTS): MeshStandardMaterial => {
    const made = paints.get(key) ?? new MeshStandardMaterial({ color: KEEPER_PAINTS[key], roughness: 0.9, metalness: 0, flatShading: true }); paints.set(key, made); return made;
  };
  for (const part of KEEPER_CODE.parts) {
    const mesh = new Mesh(buildPrimitive(part.shape), paint(part.paint)), [x, yy, z] = part.at; mesh.position.set(x, yy, z);
    if ('turnX' in part) mesh.rotation.x = part.turnX;
    ('arm' in part ? shoulder : group).add(mesh);
  }
  const [sx, sy, sz] = KEEPER_CODE.shoulder; shoulder.position.set(sx, sy, sz); group.add(shoulder);
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
