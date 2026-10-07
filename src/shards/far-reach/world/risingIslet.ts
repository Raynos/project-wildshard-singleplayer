import type { MoverBox, MoverPose } from '@wildshard/engine/physics/mover';
import { boxDesc, type ColliderDesc, type Piece } from '@wildshard/engine/world/registry';
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, Quaternion, TorusGeometry, Vector3 } from 'three';
import { apothem, type Isle } from '../layout';
import { STRINGS } from '../strings';
import { islandMesh } from './isle';
import { ISLET, RISING_ISLETS, type P3, type RisingIslet } from './islets';
import { PALETTE, flat } from './shapes';

/**
 * SF49-g (G183): the shared Rising Islet builder. Every entry in world/islets.ts gets the same parts:
 * - the static stone lip at road height (the shardfile's declared landing, installed exactly);
 * - the gate isle, an ordinary island of the shard's own builder (islandMesh + the island strip colliders);
 * - the moving islet: one SF30 kinematic mover row (behaviour/islet.as moves it in the fixed step; the engine's
 *   KinematicMover carries the rider), drawn as a small island of the same builder that follows the published pose;
 * - four chains from the islet up to two lantern posts on the gate isle's rim: one InstancedMesh of links for all four
 *   entries (no facade multi-draw), relaid only while an islet moves.
 * The rope bridge from the gate isle is one more rope span in world/build.ts (the shard's own bridge builder).
 */
const FILE = 'src/shards/far-reach/world/risingIslet.ts';
/** The mover id of an entry's islet. */
export const isletId = (entry: RisingIslet): string => `far.islet.${entry.edge}`;
/** The islet's footprint as an island (centred at its local origin, deck top y 0). */
export const ISLET_ISLE: Isle = { id: 'islet', x: 0, z: 0, r: ISLET.islet.r, y: 0, keel: ISLET.islet.keel };
/** The gate isles as islands (world/build.ts draws and collides them with the playable ones' builder). */
export const GATE_ISLES: readonly Isle[] = RISING_ISLETS.map((entry) => entry.gate);

/** The islet's deck: six strips 30° apart over its 12-gon (world/build.ts islandColliders), as local mover boxes. */
export function isletBoxes(): MoverBox[] {
  const half = apothem(ISLET_ISLE), width = ISLET_ISLE.r * 0.26;
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i * Math.PI) / 6, q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -a);
    return { x: 0, y: -1, z: 0, hx: half, hy: 1, hz: width, rot: { x: q.x, y: q.y, z: q.z, w: q.w } };
  });
}
/** The four islet mover rows (generators/movers.ts bakes them): parameters rest, dock, dwell, travel, phase. */
export function isletMoverRows(module: string): { id: string; entity: number; module: string; kind: 'platform'; at: P3; euler: P3; enabled: boolean; boxes: MoverBox[]; input: number[] }[] {
  return RISING_ISLETS.map((entry, i) => ({ id: isletId(entry), entity: 8020 + i, module, kind: 'platform', at: { ...entry.rest }, euler: { x: 0, y: 0, z: 0 }, enabled: true,
    boxes: isletBoxes(), input: [entry.rest.x, entry.rest.y, entry.rest.z, entry.dock.x, entry.dock.y, entry.dock.z, ISLET.dwell, entry.travel, 0] }));
}
/** The lip's collider exactly as the shardfile declares it. */
export function lipCollider(entry: RisingIslet): ColliderDesc {
  const l = entry.landing;
  return { kind: 'box', x: l.x, y: l.y, z: l.z, hx: l.hx, hy: l.hy, hz: l.hz, surface: l.surface };
}

/** Where the chains meet the islet and the gate isle (the horizontal climb direction `h`, its perpendicular `p`). */
interface Rig { readonly h: Vector3; readonly p: Vector3; readonly tops: readonly Vector3[]; readonly local: readonly Vector3[] }
const POST = { h: 2.8, side: 3.2, inset: 0.7 } as const;
function rig(entry: RisingIslet): Rig {
  const h = new Vector3(entry.dock.x - entry.rest.x, 0, entry.dock.z - entry.rest.z).normalize(), p = new Vector3(-h.z, 0, h.x);
  const rim = new Vector3(entry.dock.x, entry.gate.y, entry.dock.z).addScaledVector(h, apothem(ISLET_ISLE) + ISLET.gap + POST.inset);
  const tops = [-1, 1].map((k) => rim.clone().addScaledVector(p, k * POST.side).setY(entry.gate.y + POST.h - 0.3));
  // the islet's four rings: a near and a far pair, one each side; each side's pair meets that side's post
  const local = [-1, 1].flatMap((k) => [-1, 1].map((f) => new Vector3().addScaledVector(p, k * (POST.side + 0.2)).addScaledVector(h, f * 2.4).setY(0.15)));
  return { h, p, tops, local };
}

/** The static parts of every entry: lip, posts and lanterns (the gate isles and bridges are world/build.ts's). */
export function isletPieces(): Piece[] {
  const stone = flat(PALETTE.rock), posts = new InstancedMesh(new BoxGeometry(0.36, POST.h, 0.36), flat(PALETTE.trunk), RISING_ISLETS.length * 2);
  const lanterns = new InstancedMesh(new BoxGeometry(0.34, 0.42, 0.34), flat(0xffc56a, { emissive: 0xffa040, emissiveIntensity: 1.4 }), RISING_ISLETS.length * 2);
  const m = new Matrix4(), q = new Quaternion(), one = new Vector3(1, 1, 1), postColliders: ColliderDesc[] = [];
  RISING_ISLETS.forEach((entry, i) => {
    rig(entry).tops.forEach((top, k) => {
      posts.setMatrixAt(i * 2 + k, m.compose(new Vector3(top.x, entry.gate.y + POST.h / 2, top.z), q, one));
      lanterns.setMatrixAt(i * 2 + k, m.compose(new Vector3(top.x, entry.gate.y + POST.h + 0.2, top.z), q, one));
      postColliders.push(boxDesc({ x: top.x, z: top.z, hw: 0.18, hd: 0.18, rot: 0, yBottom: entry.gate.y, yTop: entry.gate.y + POST.h }, 'wood'));
    });
  });
  posts.computeBoundingSphere(); lanterns.computeBoundingSphere();
  const rigGroup = new Group(); rigGroup.name = 'far.islet.posts'; rigGroup.add(posts, lanterns);
  const lips = RISING_ISLETS.map((entry): Piece => {
    const l = entry.landing, mesh = new Mesh(new BoxGeometry(2 * l.hx, 2 * l.hy, 2 * l.hz), stone);
    mesh.position.set(l.x, l.y, l.z); mesh.name = `far.islet.lip.${entry.edge}`;
    return { id: `far.islet.lip.${entry.edge}`, name: STRINGS.isletLip, category: 'buildings', file: FILE, object: mesh, colliders: [lipCollider(entry)], surface: 'stone' };
  });
  return [...lips, { id: 'far.islet.posts', name: STRINGS.islet, category: 'props', file: FILE, object: rigGroup, colliders: postColliders, surface: 'wood' }];
}

const LINK = { r: 0.3, tube: 0.075, pitch: 0.46 } as const;
/** The moving parts: each islet's island and the chains, posed from the mover runtime's published poses. */
export interface IsletViews { readonly group: Group; readonly ids: readonly string[]; update: (pose: (id: string) => MoverPose) => void }
export function isletViews(): IsletViews {
  const group = new Group(); group.name = 'far.islets';
  let seed = 4183; const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const rigs = RISING_ISLETS.map(rig), islets = RISING_ISLETS.map((entry) => {
    const g = new Group(), mesh = islandMesh(ISLET_ISLE, rnd); g.name = isletId(entry); g.add(mesh); g.position.set(entry.rest.x, entry.rest.y, entry.rest.z); group.add(g); return g;
  });
  // the most links a chain needs: its length with the islet at rest
  const most = RISING_ISLETS.map((entry, i) => Math.max(...(rigs[i]?.local ?? []).map((l, k) => {
    const top = rigs[i]?.tops[k < 2 ? 0 : 1]; if (top === undefined) return 0;
    return Math.ceil(new Vector3(entry.rest.x + l.x, entry.rest.y + l.y, entry.rest.z + l.z).distanceTo(top) / LINK.pitch) + 2;
  })));
  const offsets = most.map((_, i) => most.slice(0, i).reduce((a, b) => a + b * 4, 0)), total = most.reduce((a, b) => a + b * 4, 0);
  const links = new InstancedMesh(new TorusGeometry(LINK.r, LINK.tube, 3, 6), flat(0x4a4244, { roughness: 0.7, metalness: 0.3 }), total);
  links.name = 'far.islet.chains'; links.frustumCulled = false; group.add(links);
  const m = new Matrix4(), q = new Quaternion(), turned = new Quaternion(), rot = new Quaternion(), y = new Vector3(0, 1, 0), zero = new Vector3(0, 0, 0), one = new Vector3(1, 1, 1);
  const a = new Vector3(), d = new Vector3(), c = new Vector3(), hidden = new Matrix4().compose(zero, q, zero), last = RISING_ISLETS.map(() => Number.NaN);
  const lay = (i: number, at: P3): void => {
    const r = rigs[i], base = offsets[i], count = most[i]; if (r === undefined || base === undefined || count === undefined) return;
    r.local.forEach((l, k) => {
      const top = r.tops[k < 2 ? 0 : 1]; if (top === undefined) return;
      a.set(at.x + l.x, at.y + l.y, at.z + l.z); d.subVectors(top, a); const length = d.length(); d.normalize();
      // a torus rings its local z: its y runs along the chain, every other link turned a quarter about it
      q.setFromUnitVectors(y, d); turned.setFromAxisAngle(y, Math.PI / 2).premultiply(q); const n = Math.min(count, Math.max(1, Math.floor(length / LINK.pitch)));
      for (let j = 0; j < count; j++) {
        const slot = base + k * count + j;
        if (j >= n) { links.setMatrixAt(slot, hidden); continue; }
        // links hang from the post down to the islet's ring
        rot.copy(j % 2 === 0 ? q : turned);
        links.setMatrixAt(slot, m.compose(c.copy(top).addScaledVector(d, -(j + 0.5) * (length / n)), rot, one));
      }
    });
  };
  RISING_ISLETS.forEach((entry, i) => { lay(i, entry.rest); });
  links.instanceMatrix.needsUpdate = true;
  return { group, ids: RISING_ISLETS.map(isletId), update: (pose) => {
    let moved = false;
    for (let i = 0; i < RISING_ISLETS.length; i++) {
      const entry = RISING_ISLETS[i], g = islets[i]; if (entry === undefined || g === undefined) continue;
      const p = pose(isletId(entry)).position; g.position.set(p.x, p.y, p.z);
      const key = p.x * 1e-3 + p.y + p.z * 1e-6; if (key === last[i]) continue;
      last[i] = key; lay(i, p); moved = true;
    }
    if (moved) links.instanceMatrix.needsUpdate = true;
  } };
}
