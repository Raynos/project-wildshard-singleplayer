import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import { BoxGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { bakeKinds, type PieceBake } from '@wildshard/sdk/bake/kinds';
import { apothem } from '../layout';
import { RISING_ISLETS } from '../world/islets';
import { ISLET, type RisingIslet } from '../data/isletDesign';
import { ISLET_ISLE } from '../world/risingIslet';
import { PALETTE, flat } from '../world/shapes';

/**
 * Build-time only (SHARD-PLATFORM M3): the Rising Islets' static rig, baked by `bake-sky-world.mjs` into
 * `baked/islet-rig.glb` + `data/isletRig.json`; the client draws the bake and reads the rows (`world/risingIslet.ts`).
 * - the two lantern posts on each gate isle's rim (one instanced draw of posts, one of lanterns) and their colliders;
 * - where each entry's four chains meet its posts and its islet (`rigs`: the chains are drawn live, at the islet's pose);
 * - each entry's rail round its resting islet (`rails`: a box per closed rim edge, collided always, drawn while it rests).
 */
/** Where the chains meet the islet and the gate isle (the horizontal climb direction `h`, its perpendicular `p`). */
const POST = { h: 2.8, side: 3.2, inset: 0.7 } as const;
type P = [number, number, number];
const xyz = (v: Vector3): P => [v.x, v.y, v.z];
function rig(entry: RisingIslet): { tops: P[]; local: P[] } {
  const h = new Vector3(entry.dock.x - entry.rest.x, 0, entry.dock.z - entry.rest.z).normalize(), p = new Vector3(-h.z, 0, h.x);
  const rim = new Vector3(entry.dock.x, entry.gate.y, entry.dock.z).addScaledVector(h, apothem(ISLET_ISLE) + ISLET.gap + POST.inset);
  const tops = [-1, 1].map((k) => rim.clone().addScaledVector(p, k * POST.side).setY(entry.gate.y + POST.h - 0.3));
  // the islet's four rings: a near and a far pair, one each side; each side's pair meets that side's post
  const local = [-1, 1].flatMap((k) => [-1, 1].map((f) => new Vector3().addScaledVector(p, k * (POST.side + 0.2)).addScaledVector(h, f * 2.4).setY(0.15)));
  return { tops: tops.map(xyz), local: local.map(xyz) };
}

/**
 * Playtest round 3 (#8): the resting islet's rail. Driving straight in from the road crossed the lip and the resting islet
 * and went off its far rim into the cloud sea ("FELL TOO FAR") before the RIDE prompt could matter. Around every rim edge but
 * the two that face the lip (the way on and off), a timber rail stands just outside the resting islet's rim, so a walker or a
 * hover rider stops on the deck, inside the RIDE prompt.
 */
const RAIL = { thick: 0.22, height: 1 } as const;
const OUTWARD_OF: Readonly<Record<RisingIslet['edge'], readonly [number, number]>> = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };
/** An entry's rail: per closed rim edge (the 12-gon's edge normal `a`, radians from +x toward +z), one box. */
export function railBoxes(entry: RisingIslet): { a: number; box: ReturnType<typeof boxDesc> }[] {
  const [ox, oz] = OUTWARD_OF[entry.edge], lip = Math.atan2(oz, ox), inner = apothem(ISLET_ISLE) + ISLET.gap, mid = inner + RAIL.thick / 2;
  const half = (inner + RAIL.thick) * Math.tan(Math.PI / 12), out: { a: number; box: ReturnType<typeof boxDesc> }[] = [];
  for (let k = 0; k < 12; k++) {
    const a = Math.PI / 12 + (k * Math.PI) / 6;
    if (Math.abs(Math.atan2(Math.sin(a - lip), Math.cos(a - lip))) < Math.PI / 6) continue; // faces the lip: open
    out.push({ a, box: boxDesc({ x: entry.rest.x + Math.cos(a) * mid, z: entry.rest.z + Math.sin(a) * mid, hw: RAIL.thick / 2, hd: half, rot: a, yBottom: 0, yTop: RAIL.height }, 'wood') });
  }
  return out;
}

/** The posts and lanterns of every entry as two instanced meshes, with the posts' colliders. */
export function buildIsletRig(entries: readonly RisingIslet[] = RISING_ISLETS): { posts: InstancedMesh; lanterns: InstancedMesh; colliders: ColliderDesc[] } {
  const posts = new InstancedMesh(new BoxGeometry(0.36, POST.h, 0.36), flat(PALETTE.trunk), entries.length * 2);
  const lanterns = new InstancedMesh(new BoxGeometry(0.34, 0.42, 0.34), flat(0xffc56a, { emissive: 0xffa040, emissiveIntensity: 1.4 }), entries.length * 2);
  const m = new Matrix4(), q = new Quaternion(), one = new Vector3(1, 1, 1), colliders: ColliderDesc[] = [];
  entries.forEach((entry, i) => {
    rig(entry).tops.forEach(([x, , z], k) => {
      posts.setMatrixAt(i * 2 + k, m.compose(new Vector3(x, entry.gate.y + POST.h / 2, z), q, one));
      lanterns.setMatrixAt(i * 2 + k, m.compose(new Vector3(x, entry.gate.y + POST.h + 0.2, z), q, one));
      colliders.push(boxDesc({ x, z, hw: 0.18, hd: 0.18, rot: 0, yBottom: entry.gate.y, yTop: entry.gate.y + POST.h }, 'wood'));
    });
  });
  posts.computeBoundingSphere(); lanterns.computeBoundingSphere();
  return { posts, lanterns, colliders };
}

/** The rig's bake: the posts and lanterns as two kinds with the posts' colliders, plus each entry's chain ends and rail rows. */
export interface IsletRigBake extends PieceBake { rigs: { tops: P[]; local: P[] }[]; rails: { a: number; box: ReturnType<typeof boxDesc> }[][] }
export function bakeSkyIsletRig(): IsletRigBake {
  const built = buildIsletRig();
  return { ...bakeKinds('far.islet.posts', [['post', built.posts], ['lantern', built.lanterns]], built.colliders), rigs: RISING_ISLETS.map(rig), rails: RISING_ISLETS.map(railBoxes) };
}
