import type { MoverPose } from '@wildshard/engine/physics/mover';
import type { ColliderDesc, Piece } from '@wildshard/engine/world/registry';
import { BoxGeometry, Group, InstancedMesh, Mesh, TorusGeometry } from 'three';
import type { Isle } from '../data/layout';
import { STRINGS } from '../data/strings';
import { islandMesh } from './isle';
import { RISING_ISLETS } from './islets';
import type { RisingIslet } from '../data/isletDesign';
import isletMotion from '../data/isletMotion.generated.json' with { type: 'json' };
import { PALETTE, flat } from './shapes';
import { skyBakedPiece } from './baked';
import { bakedColliders } from '@wildshard/game/shardfile/bakedKinds';
import ISLET_RIG from '../data/isletRig.json' with { type: 'json' };

/**
 * SF49-g (G183): the shared Rising Islet builder. Every entry in world/islets.ts gets the same parts:
 * - the static stone lip at road height (the shardfile's declared landing, installed exactly);
 * - the gate isle, an ordinary island (its baked shape, islandMesh, + the island strip colliders);
 * - the moving islet: one SF30 kinematic mover row (the fixed ride driver moves it in the fixed step; the engine's
 *   KinematicMover carries the rider), drawn as a small baked island that follows the published pose;
 * - four chains from the islet up to two lantern posts on the gate isle's rim: one InstancedMesh of links for all four
 *   entries (no facade multi-draw), relaid only while an islet moves.
 * The rope bridge from the gate isle is one more rope span in world/build.ts (the shard's own bridge builder).
 */
const FILE = 'src/shards/far-reach/world/risingIslet.ts';
const { counts: ISLET_VIEW_COUNTS, rest: ISLET_VIEW_REST } = isletMotion;
/** The gate isles as islands (world/build.ts draws and collides them with the playable ones' builder). */
export const GATE_ISLES: readonly Isle[] = RISING_ISLETS.map((entry) => entry.gate);

/** The lip's collider exactly as the shardfile declares it. */
export function lipCollider(entry: RisingIslet): ColliderDesc {
  const l = entry.landing;
  return { kind: 'box', x: l.x, y: l.y, z: l.z, hx: l.hx, hy: l.hy, hz: l.hz, surface: l.surface };
}

/** The static parts of every entry: the lips, the posts with their lanterns (baked, `generators/isletRig.ts`) and the rails. */
export function isletPieces(): Piece[] {
  const stone = flat(PALETTE.rock), rigs = skyBakedPiece('islet-rig'); rigs.root.name = 'far.islet.posts';
  const lips = RISING_ISLETS.map((entry): Piece => {
    const l = entry.landing, mesh = new Mesh(new BoxGeometry(2 * l.hx, 2 * l.hy, 2 * l.hz), stone);
    mesh.position.set(l.x, l.y, l.z); mesh.name = `far.islet.lip.${entry.edge}`;
    return { id: `far.islet.lip.${entry.edge}`, name: STRINGS.isletLip, category: 'buildings', file: FILE, object: mesh, colliders: [lipCollider(entry)], surface: 'stone' };
  });
  // round 3 (#8): each resting islet's rail (generators/isletRig.ts), collided always, drawn by `isletViews` while it rests
  const rails: Piece = { id: 'far.islet.rails', name: STRINGS.isletRail, category: 'props', file: FILE, colliders: bakedColliders(ISLET_RIG.rails.flat().map((r) => r.box)), surface: 'wood' };
  return [...lips, rails, { id: 'far.islet.posts', name: STRINGS.islet, category: 'props', file: FILE, object: rigs.root, colliders: rigs.colliders, surface: 'wood' }];
}

/** Existing private scene storage driven only by copied native poses. */
export interface IsletViews { readonly group: Group; readonly ids: readonly string[]; update: (pose: (id: string) => MoverPose) => void }
export function isletViews(bind: (targets: ReadonlyMap<string, unknown>, owners: readonly string[]) => IsletViews['update']): IsletViews {
  const group = new Group(); group.name = 'far.islets';
  const targets = new Map<string, Group | InstancedMesh>();
  for (const entry of RISING_ISLETS) {
    const object = new Group(); object.name = `far.islet.${entry.edge}`;
    object.add(islandMesh(`islet.${entry.edge}`)); group.add(object); targets.set(`islet.${entry.edge}`, object);
  }
  const links = new InstancedMesh(new TorusGeometry(0.3, 0.075, 3, 6), flat(0x4a4244, { roughness: 0.7, metalness: 0.3 }), ISLET_VIEW_COUNTS.links);
  const gates = new InstancedMesh(new BoxGeometry(1, 1, 1), flat(PALETTE.trunk), ISLET_VIEW_COUNTS.gates);
  const rails = new InstancedMesh(new BoxGeometry(1, 1, 1), flat(PALETTE.trunk), ISLET_VIEW_COUNTS.rails);
  for (const [id, object] of [['links', links], ['gates', gates], ['rails', rails]] as const) {
    object.name = id === 'links' ? 'far.islet.chains' : `far.islet.${id}`;
    object.frustumCulled = false; group.add(object); targets.set(id, object);
  }
  const rest = new Map(ISLET_VIEW_REST.map(row => [row.id, row])), ids = [...rest.keys()];
  const update = bind(targets, ids);
  update(id => { const pose = rest.get(id); if (pose === undefined) throw new Error('Missing initial islet pose'); return pose; });
  return { group, ids: RISING_ISLETS.map(entry => `far.islet.${entry.edge}`), update };
}
