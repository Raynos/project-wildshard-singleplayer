// Dome B (E169, round-10-dome-b): the square's TRELLIS props, merged from the organic lab (the dev labs (deleted in E357 F7)
// props3d.ts, round-9-lab-organic): local TRELLIS.2 image → 3D (codex ref "one object on white" → trellis_batch.py →
// driftwood_post.py → meshopt), loaded through glb.ts (smooth normals, AO), colour-RAMPED to the style bible's washes and
// drawn by the Jiehua program as ONE InstancedMesh per prop:
//  - the guardian lions (石獅): the lab's post-top lion on every third post of the Well's balustrade and both ends of
//    the street's, and a pair scaled up on the pedestals before the paifang's centre bay (gate.ts builds the pedestals);
//  - glazed pots (boxwood, a cloud-pruned pine, jade, azalea) by the shrine, the gate and the stall;
//  - two red lantern trios in the banyan (the red paper glows).
// Dome B kept its own noodle-stall counter and mahjong tables (richer than the TRELLIS ones at dome B's cameras; the
// TRELLIS sets also bring stools that would double under the seated players).
// (E306 M4) the lion and the sets are models (../models/lion.ts, market.ts, balustradePanel.ts); this file keeps where
// they stand — the queues the square's builders fill — and squareProps.ts places them.
import { type BufferGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { GATE, PLAZA, STREET, WELL, Y0 } from '../layout';

/**
 * which balustrade posts carry a lion (balustrade() leaves their lotus finial off): the two ends of the street run.
 * (E281: none on the plaza run any more — style-A and the A1 / A2 targets carry a lotus bud on every post there; the
 * lion by the spawn read as a dark lump in the mockup's left foreground)
 */
export function lionOnPost(run: 'plaza' | 'street', i: number, n: number): boolean {
  return run === 'plaza' ? false : i === 0 || i === n;
}

/** the gate's lion pedestals (gate.ts `lionPedestal`): the two spots before the centre posts, pedestal top height */
export const GATE_LIONS = {
  spots: [GATE.posts[1] - 0.2 * GATE.s, GATE.posts[2] + 0.2 * GATE.s] as const,
  z: GATE.z + 2.3 * GATE.s,
  top: 0.96 * 0.95,
  scale: 2.4,
} as const;

const place = (x: number, y: number, z: number, yaw: number, s = 1): Matrix4 =>
  new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw), new Vector3(s, s, s));

/** the balustrade's post tops (square.ts `balustrade`: n = round(len / 2.3) bays), with the lion rule */
function lionPosts(run: 'plaza' | 'street', at: number, a0: number, a1: number): Vector3[] {
  const len = a0 - a1, n = Math.max(1, Math.round(len / 2.3)), step = len / n;
  const out: Vector3[] = [];
  for (let i = 0; i <= n; i++) if (lionOnPost(run, i, n)) out.push(new Vector3(at, Y0 + 1.12, a0 - i * step));
  return out;
}

/** the lions other domes queued (placeLion) */
const queued: Matrix4[] = [];
/** how many of the last `takeLions` stand where (in its order: the plaza's balustrade, the street's, then the Well rim's queue) */
let lionCounts = { plaza: 0, street: 0, rim: 0 };

/**
 * Other domes' lions (dome C's Well-rim balustrade): `placeLion` queues one TRELLIS guardian lion; squareProps.ts places
 * the queue with dome B's (one instanced draw, no extra call) and empties it, so a rebuilt fragment re-queues.
 * Call it while the world is being built (before squareProps.ts runs in build.ts: any world/ builder does).
 * - (x, y, z): the lion's base, i.e. the top of the post it sits on (dome B's balustrade posts: y = Y0 + 1.12);
 * - rotY (radians, about +y): the way it faces — 0 = +z (south), π/2 = +x (east), π = −z (north), −π/2 = −x (west);
 * - scale: 1 = the post-top lion (0.62 m tall, 0.44 m across; ~8 k triangles each).
 */
export function placeLion(x: number, y: number, z: number, rotY: number, scale = 1): void {
  queued.push(place(x, y, z, rotY, scale));
}

/** E281: procedural sets drawn instanced (stalls.ts `marketRow`): one geometry, built at the first copy, and its copies */
const sets = new Map<string, { geo: BufferGeometry; at: Matrix4[] }>();

/**
 * Queue one copy of a procedural set (a Kit + KitX geometry in its own frame) at `m`; `build` runs only for the first
 * copy of `name` (the booth's cook draws from its builder's stream there). squareProps.ts places every set as its model
 * (ONE InstancedMesh, `set:<name>`, one draw) with that geometry and empties the queue.
 */
export function placeSet(name: string, build: () => BufferGeometry, m: Matrix4): void {
  let s = sets.get(name);
  if (s === undefined) { s = { geo: build(), at: [] }; sets.set(name, s); }
  s.at.push(m.clone());
}

/** the lion queue and the queued sets as the layout bake recorded them (world/layoutBake.ts), in place of the builders' */
export function restoreQueued(lions: readonly Matrix4[], recorded: readonly (readonly [string, { geo: BufferGeometry; at: Matrix4[] }])[]): void {
  queued.length = 0;
  queued.push(...lions);
  sets.clear();
  for (const [name, s] of recorded) sets.set(name, s);
}

/** the lion queue and the queued sets as they stand (the layout bake's record of them: ../generators/layout.ts) */
export function peekQueued(): { lions: readonly Matrix4[]; sets: readonly (readonly [string, { geo: BufferGeometry; at: readonly Matrix4[] }])[] } {
  return { lions: queued, sets: [...sets] };
}

/** the lions' placements (dome B's posts, then the queue other domes filled), emptying the queue. (The TRELLIS pots and
 *  lantern trios are out since the budget round: two draws and 23 k triangles for four small props; the procedural lanterns
 *  carry the banyan and the stall. The gate's pair is off since A2 round 1: style-A and the A2 targets have none; to bring
 *  them back push `place(x, Y0 + GATE_LIONS.top, GATE_LIONS.z, ±0.2, GATE_LIONS.scale)` per spot and set square.ts
 *  `lions: true`. Tried at half its triangles via crowd.ts `clusterLod`: the lion by the spawn went blobby.) */
export function takeLions(): Matrix4[] {
  // the model faces glTF +z; on the Well's balustrade (x ≈ 0.2) a quarter turn faces the plaza, a little more the spawn
  const plaza = lionPosts('plaza', PLAZA.x0 + 0.2, PLAZA.z1, PLAZA.z0), street = lionPosts('street', STREET.x0 + 0.2, PLAZA.z0 - 0.1, WELL.z0);
  const lions = [...plaza, ...street].map((p) => place(p.x, p.y, p.z, Math.PI / 2 + 0.35, 1));
  lionCounts = { plaza: plaza.length, street: street.length, rim: queued.length };
  lions.push(...queued.splice(0));
  return lions;
}

/** the last `takeLions`' lions by where they stand, as index lists into its order (M12: each named place's Set lists its lions) */
export function lionShares(): { readonly plaza: number[]; readonly street: number[]; readonly rim: number[] } {
  const { plaza, street, rim } = lionCounts, span = (from: number, n: number): number[] => Array.from({ length: n }, (_, i) => from + i);
  return { plaza: span(0, plaza), street: span(plaza, street), rim: span(plaza + street, rim) };
}

/** the sets queued so far, by name, in the order they were first placed (built geometry + placements), emptying the queue */
export function takeSets(): [string, { geo: BufferGeometry; at: Matrix4[] }][] {
  const out = [...sets];
  sets.clear();
  return out;
}
