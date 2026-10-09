import type { MoverBox, MoverPose } from '@wildshard/engine/physics/mover';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { boxDesc, type ColliderDesc, type Piece } from '@wildshard/engine/world/registry';
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, Quaternion, TorusGeometry, Vector3 } from 'three';
import type { Isle } from '../data/layout';
import { apothem } from '../layout';
import { STRINGS } from '../data/strings';
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
/** The mover id of an entry's stationary road gate (SF8c socketLift). */
export const gateId = (entry: RisingIslet): string => `far.islet.${entry.edge}.gate`;
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
interface LiftRow { id: string; entity: number; module: string; kind: 'platform' | 'static'; at: P3; euler: P3; enabled: boolean; boxes: MoverBox[]; input: number[] }
/** The four islet mover rows and their four stationary road gates (generators/movers.ts bakes them; shard.config.ts
 *  declares them as the shardfile's compiled `movers`): parameters rest, dock, travel, part (0 islet, 1 gate), dwell. */
export function isletMoverRows(module: string): LiftRow[] {
  const zero = { x: 0, y: 0, z: 0 };
  const islets = RISING_ISLETS.map((entry, i): LiftRow => ({ id: isletId(entry), entity: 8020 + i, module, kind: 'platform', at: { ...entry.rest }, euler: zero, enabled: true,
    boxes: isletBoxes(), input: [entry.rest.x, entry.rest.y, entry.rest.z, entry.dock.x, entry.dock.y, entry.dock.z, entry.travel, 0, ISLET.dwell] }));
  const gates = RISING_ISLETS.map((entry, i): LiftRow => {
    const g = entry.gateBar;
    return { id: gateId(entry), entity: 8030 + i, module, kind: 'static', at: { x: g.x, y: g.y, z: g.z }, euler: zero, enabled: false,
      boxes: [{ x: 0, y: 0, z: 0, hx: g.hx, hy: g.hy, hz: g.hz, rot: { x: 0, y: 0, z: 0, w: 1 } }], input: [g.x, g.y, g.z, g.x, g.y, g.z, entry.travel, 1, ISLET.dwell] };
  });
  return [...islets, ...gates];
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
  return [...lips, rails(), { id: 'far.islet.posts', name: STRINGS.islet, category: 'props', file: FILE, object: rigGroup, colliders: postColliders, surface: 'wood' }];
}

/**
 * Playtest round 3 (#8): the resting islet's rail. Driving straight in from the road crossed the lip and the resting islet
 * and went off its far rim into the cloud sea ("FELL TOO FAR") before the RIDE prompt could matter. Around every rim edge but
 * the two that face the lip (the way on and off), a timber rail stands just outside the resting islet's rim, so a walker or a
 * hover rider stops on the deck, inside the RIDE prompt. The rail's colliders are static (`isletPieces`); it is drawn with
 * the moving parts (`isletViews`) only while its islet rests at the road, and the islet lifts out of it.
 */
const RAIL = { thick: 0.22, height: 1 } as const;
type RailBox = ReturnType<typeof boxDesc>;
const OUTWARD_OF: Readonly<Record<RisingIslet['edge'], readonly [number, number]>> = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };
/** An entry's rail: per closed rim edge (the 12-gon's edge normal `a`, radians from +x toward +z), one box. */
export function railBoxes(entry: RisingIslet): { a: number; box: RailBox }[] {
  const [ox, oz] = OUTWARD_OF[entry.edge], lip = Math.atan2(oz, ox), inner = apothem(ISLET_ISLE) + ISLET.gap, mid = inner + RAIL.thick / 2;
  const half = (inner + RAIL.thick) * Math.tan(Math.PI / 12), out: { a: number; box: RailBox }[] = [];
  for (let k = 0; k < 12; k++) {
    const a = Math.PI / 12 + (k * Math.PI) / 6;
    if (Math.abs(Math.atan2(Math.sin(a - lip), Math.cos(a - lip))) < Math.PI / 6) continue; // faces the lip: open
    out.push({ a, box: boxDesc({ x: entry.rest.x + Math.cos(a) * mid, z: entry.rest.z + Math.sin(a) * mid, hw: RAIL.thick / 2, hd: half, rot: a, yBottom: 0, yTop: RAIL.height }, 'wood') });
  }
  return out;
}
function rails(): Piece {
  return { id: 'far.islet.rails', name: STRINGS.isletRail, category: 'props', file: FILE, colliders: RISING_ISLETS.flatMap((entry) => railBoxes(entry).map((r) => r.box)), surface: 'wood' };
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
  // SF8c: each entry's stationary road gate, a timber bar across the lip's road edge, drawn while its mover collides
  const bars = new InstancedMesh(new BoxGeometry(1, 1, 1), flat(PALETTE.trunk), RISING_ISLETS.length), shut = RISING_ISLETS.map(() => false);
  bars.name = 'far.islet.gates'; bars.frustumCulled = false; group.add(bars);
  const barAt = (i: number, on: boolean): void => {
    const g = RISING_ISLETS[i]?.gateBar; if (g === undefined) return;
    bars.setMatrixAt(i, on ? m.compose(c.set(g.x, g.y, g.z), q.identity(), a.set(2 * g.hx, 2 * g.hy, 2 * g.hz)) : hidden);
  };
  RISING_ISLETS.forEach((_entry, i) => { barAt(i, false); });
  bars.instanceMatrix.needsUpdate = true;
  // round 3 (#8): each entry's rail, drawn while its islet rests at the road (its colliders are isletPieces')
  const railRows = RISING_ISLETS.map((entry) => railBoxes(entry)), perEntry = Math.max(...railRows.map((r) => r.length));
  const railMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), flat(PALETTE.trunk), RISING_ISLETS.length * perEntry), resting = RISING_ISLETS.map(() => true);
  railMesh.name = 'far.islet.rails'; railMesh.frustumCulled = false; group.add(railMesh);
  const railAt = (i: number, on: boolean): void => {
    const rows = railRows[i] ?? [];
    for (let j = 0; j < perEntry; j++) {
      const row = rows[j];
      railMesh.setMatrixAt(i * perEntry + j, row !== undefined && on ? m.compose(c.set(row.box.x, row.box.y, row.box.z), q.setFromAxisAngle(y, -row.a), a.set(2 * row.box.hx, 2 * row.box.hy, 2 * row.box.hz)) : hidden);
    }
  };
  RISING_ISLETS.forEach((_entry, i) => { railAt(i, true); });
  railMesh.instanceMatrix.needsUpdate = true;
  return { group, ids: RISING_ISLETS.map(isletId), update: (pose) => {
    let moved = false, gated = false;
    for (let i = 0; i < RISING_ISLETS.length; i++) {
      const entry = RISING_ISLETS[i]; if (entry === undefined) continue;
      const on = pose(gateId(entry)).enabled; if (on === shut[i]) continue;
      shut[i] = on; barAt(i, on); gated = true;
    }
    if (gated) bars.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < RISING_ISLETS.length; i++) {
      const entry = RISING_ISLETS[i], g = islets[i]; if (entry === undefined || g === undefined) continue;
      const p = pose(isletId(entry)).position; g.position.set(p.x, p.y, p.z);
      const atRest = Math.hypot(p.x - entry.rest.x, p.y - entry.rest.y, p.z - entry.rest.z) < 0.001;
      if (atRest !== resting[i]) { resting[i] = atRest; railAt(i, atRest); railMesh.instanceMatrix.needsUpdate = true; }
      const key = p.x * 1e-3 + p.y + p.z * 1e-6; if (key === last[i]) continue;
      last[i] = key; lay(i, p); moved = true;
    }
    if (moved) links.instanceMatrix.needsUpdate = true;
  } };
}

/**
 * SF8c socketLift on the normal INTERACT binding: per entry, RIDE on the resting islet (action 1, at either stop), CALL on
 * the road lip while the islet rests at the top (action 2) and CALL on the gate isle while it rests at the road (action 3).
 * A prompt that does not apply right now parks far below the world, so it never shows. The command goes through the
 * platform's `commandSocketLift` (the caller's), on the islet and its road gate together.
 */
export interface IsletCalls { readonly interactables: readonly Interactable[]; update: (pose: (id: string) => MoverPose) => void }
export function isletCalls(command: (entry: RisingIslet, action: 1 | 2 | 3) => void): IsletCalls {
  const away = -1e5, items: Interactable[] = [], updates: ((pose: (id: string) => MoverPose) => void)[] = [];
  for (const entry of RISING_ISLETS) {
    const ride: Interactable = { label: STRINGS.rideIslet, position: new Vector3(entry.rest.x, away, entry.rest.z), radius: apothem(ISLET_ISLE) + 0.05, onInteract: () => { command(entry, 1); } }; // round 3 (#8): reaches a rider stopped at the rail, never the lip
    const l = entry.landing, down: Interactable = { label: STRINGS.callIslet, position: new Vector3(l.x, away, l.z), radius: 3, onInteract: () => { command(entry, 2); } };
    const h = new Vector3(entry.dock.x - entry.rest.x, 0, entry.dock.z - entry.rest.z).normalize(), rim = new Vector3(entry.dock.x, entry.gate.y + 1, entry.dock.z).addScaledVector(h, apothem(ISLET_ISLE) + 1.5);
    const up: Interactable = { label: STRINGS.callIslet, position: rim.clone().setY(away), radius: 3, onInteract: () => { command(entry, 3); } };
    items.push(ride, down, up);
    updates.push((pose) => {
      const p = pose(isletId(entry)).position;
      const atRoad = Math.hypot(p.x - entry.rest.x, p.y - entry.rest.y, p.z - entry.rest.z) < 0.001, atTop = Math.hypot(p.x - entry.dock.x, p.y - entry.dock.y, p.z - entry.dock.z) < 0.001;
      ride.position.set(p.x, atRoad || atTop ? p.y + 1 : away, p.z);
      down.position.y = atTop ? 1 : away; up.position.y = atRoad ? rim.y : away;
    });
  }
  return { interactables: items, update: (pose) => { for (const update of updates) update(pose); } };
}
