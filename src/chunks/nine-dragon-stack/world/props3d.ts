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
import type { GlbOpt } from './hero/glb';
import { K } from './kit';
import { BANYAN, GATE, PLAZA, STREET, WELL, Y0 } from '../layout';

/** the wet granite of the balustrade, dark to light (the lab's ramp; the lion's own is models/lion.ts's) */
const STONE_RAMP = [0x2f2f33, 0x45454a, 0x5b5b60, 0x6e6e73, 0x808086, 0x94949a];
const WOOD_RAMP = [0x2a1d14, 0x3f2b1d, 0x563a26, 0x6e4a30, 0x86603f, 0xa07a55];
const STEEL_RAMP = [0x3a3d44, 0x585d66, 0x7a808a, 0x9aa1ab, 0xb8bec6, 0xd2d6dc];
const HUES = { skin: 0xb07a52, red: 0xa8321f, blue: 0x2f4f8e, green: 0x3f6a4a };

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

/** a prop and where it stands (`off`: not drawn; the pots and lantern trios would each be a model if they came back, their
 *  red paper glowing: aMisc.x on the red hue class) */
interface PropSpec { name: string; opt: GlbOpt; glowRed?: number; at: Matrix4[]; off?: boolean; maxTris?: number }

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

function specs(): PropSpec[] {
  // the model faces glTF +z; on the Well's balustrade (x ≈ 0.2) a quarter turn faces the plaza, a little more the spawn
  const plaza = lionPosts('plaza', PLAZA.x0 + 0.2, PLAZA.z1, PLAZA.z0), street = lionPosts('street', STREET.x0 + 0.2, PLAZA.z0 - 0.1, WELL.z0);
  const lions = [...plaza, ...street].map((p) => place(p.x, p.y, p.z, Math.PI / 2 + 0.35, 1));
  lionCounts = { plaza: plaza.length, street: street.length, rim: queued.length };
  lions.push(...queued.splice(0));
  // the gate's pair, facing the square, turned a little in toward the passage
  // (the gate's pair is off since A2 round 1: style-A and the A2 targets have none, and the pedestals blocked A2's left /
  // right views; to bring them back push `place(x, Y0 + GATE_LIONS.top, GATE_LIONS.z, ±0.2, GATE_LIONS.scale)` per spot
  // and set square.ts `lions: true`)
  return [
    // (tried at half its triangles, `maxTris: 4000` via crowd.ts `clusterLod`: the lion by the spawn went blobby — reverted;
    // the lever stays: −36 k if the lane ever needs it)
    { name: 'lion', opt: { kind: K.stone, line: 0, ao: 0.85, ramp: STONE_RAMP, hues: {} }, at: lions },
    // (the TRELLIS pots and lantern trios are out since the budget round: two draws and 23 k triangles for four small
    // props; the procedural lanterns carry the banyan and the stall)
    {
      name: 'pots', opt: { kind: 0, line: 0, ao: 0.7, ramp: STEEL_RAMP, hues: { green: HUES.green, blue: HUES.blue, red: 0xc0392b, skin: 0x8a6a4a } }, off: true,
      at: [
        place(BANYAN.x - 4.5, Y0, BANYAN.z + 2.3, 0.3), // west of the earth-god shrine
        place(GATE.posts[3] + 1.4, Y0, GATE.z + 1.7, -0.5), // east of the gate (the stall-corner pot read as a cobalt blob in domeb-2's foreground: reverted)
      ],
    },
    {
      name: 'lanterns', opt: { kind: 0, line: 0, ao: 0.5, ramp: WOOD_RAMP, hues: { red: 0xc8401f, skin: 0xc9a24a } }, glowRed: 2.6, off: true,
      at: [place(BANYAN.x - 2.4, Y0 + 5.2, BANYAN.z + 2.0, 0.8, 1.1), place(BANYAN.x + 2.2, Y0 + 5.6, BANYAN.z + 1.4, -0.7, 1.1)],
    },
  ];
}

/** the lions' placements (dome B's posts, then the queue other domes filled), emptying the queue */
export function takeLions(): Matrix4[] {
  return specs().find((x) => x.name === 'lion')?.at ?? [];
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
