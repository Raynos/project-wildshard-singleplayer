import { CapsuleGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type Object3D } from 'three';
import type { NpcDef } from '#engine';
import { FLAGS } from './flags';
import { STRINGS } from '../strings';

/** Where the bridge-keeper stands: at Sunrest's north rim, left of the rope bridge's posts, facing the spawn (mockup B). */
export const KEEPER_AT = { x: -1.9, z: -13.6, yaw: Math.atan2(1.9, 4.6) } as const;
/** He waves while the player is this close (metres), as Wendell does. */
export const WAVE_RANGE = 16;

/** The keeper's lines: the first whose condition holds is what he says; his first talk is the quest's first step. */
export const KEEPER_NPC: NpcDef = {
  id: 'far.keeper', name: STRINGS.keeperName,
  dialogue: [
    { when: { all: [FLAGS.raised] }, lines: [STRINGS.keeperDone] },
    { when: { all: [FLAGS.notes] }, lines: [STRINGS.keeperLater] },
    { lines: [STRINGS.keeperHello, STRINGS.keeperAsk, STRINGS.keeperHow], sets: [FLAGS.notes] },
  ],
};

export interface Keeper { readonly group: Group; readonly head: Vector3; readonly speaker: { talking: boolean }; update: (t: number, player: Vector3) => void }

/**
 * The bridge-keeper: an old sky-sailor in a slate-blue coat with a cream scarf, a white beard and a long staff, built in
 * code (low-poly, Gilded Air palette). He waves his free arm when you come near and gestures while he talks.
 */
export function keeper(y: number): Keeper {
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
