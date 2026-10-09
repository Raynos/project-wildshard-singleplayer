import * as v from 'valibot';
import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIM_API_VERSION, type SimLevel } from '@wildshard/engine/sim';
import { addPiece } from '@wildshard/engine/physics/pieces';
import type { Physics } from '@wildshard/engine/physics/Physics';
import type { Material } from '@wildshard/engine/physics/surface';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { portalLinkEntries } from '@wildshard/game/shardfile/portalLink';
import { provePortalLinks } from '@wildshard/game/shardfile/portalLinkProof';
import { JIAN_ROW } from '../vm/jianRow';
import { entryCapColliders } from '../world/floorRows';
import { installNineJian, JIAN_ID } from './jian';
import baked from './physics.baked.json' with { type: 'json' };

const finite = v.pipe(v.number(), v.finite());
const SURFACES: readonly Material[] = ['wood', 'metal', 'flesh', 'felt', 'stone', 'rock', 'sand'];
const Surface = v.picklist(SURFACES);
const Vec = v.strictObject({ x: finite, y: finite, z: finite });
const Placed = { x: finite, y: finite, z: finite, yaw: v.exactOptional(finite), rot: v.exactOptional(v.strictObject({ x: finite, y: finite, z: finite, w: finite })), surface: v.exactOptional(Surface) };
/** One baked collider, strictly: every engine `ColliderDesc` kind the page registered, an unknown field refuses the bake. */
const Collider = v.variant('kind', [
  v.strictObject({ kind: v.literal('box'), ...Placed, hx: finite, hy: finite, hz: finite }),
  v.strictObject({ kind: v.literal('capsule'), ...Placed, halfHeight: finite, radius: finite }),
  v.strictObject({ kind: v.literal('ball'), ...Placed, radius: finite }),
  v.strictObject({ kind: v.literal('hull'), ...Placed, points: v.array(finite) }),
  v.strictObject({ kind: v.literal('trimesh'), ...Placed, vertices: v.array(finite), indices: v.array(v.pipe(finite, v.integer(), v.minValue(0))) }),
  v.strictObject({ kind: v.literal('treads'), from: Vec, to: Vec, width: finite, count: v.pipe(finite, v.integer(), v.minValue(1)), surface: v.exactOptional(Surface) }),
]);
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const Piece = v.strictObject({ id: v.string(), name: v.string(), category: v.string(), file: v.string(), colliders: v.array(Collider), active: v.boolean(),
  surface: v.exactOptional(Surface), colliderOwner: v.exactOptional(v.string()),
  // a followed piece (the Well safety cap) baked at rest: its frame is the world's, so it stands where its boxes say
  follows: v.optional(v.strictObject({ matrix: v.pipe(v.array(finite), v.check(m => m.length === 16 && m.every((x, i) => x === IDENTITY[i]), 'a baked followed piece rests at the world frame')), rotation: v.boolean() })) });
/** The browser-baked native colliders (scripts/bake-nine-physics.mjs), strictly. */
export const NINE_PIECES = v.parse(v.array(Piece), baked.pieces);

function desc(c: v.InferOutput<typeof Collider>): ColliderDesc {
  if (c.kind === 'hull') return { ...c, points: Float32Array.from(c.points) };
  if (c.kind === 'trimesh') return { ...c, vertices: Float32Array.from(c.vertices), indices: Uint32Array.from(c.indices) };
  return c;
}
/** The engine's own HUD / Weapon Explorer arena (engine/practice), registered under every Developer page: not Nine's world. */
const PRACTICE = 'src/engine/practice/';
/** The fragment's floors piece (world/install.ts), which carries the standalone deck caps. */
const FLOORS = 'nds-floors';
/**
 * The cell as the grid builds it: a standalone page closes each deck's open end with its balustrade cap (world/install.ts
 * `entryCapColliders(entryCapsFor(null))`), the grid leaves the decks open to the road. The headless cell is the grid's,
 * so exactly those boxes leave the baked floors piece; each must be found, or the bake no longer matches the recipe.
 */
function withoutCaps(colliders: readonly ColliderDesc[]): ColliderDesc[] {
  const left = [...colliders], key = (c: ColliderDesc): string => JSON.stringify(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)));
  entryCapColliders(true).forEach(cap => {
    const want = key(cap), at = left.findIndex(c => key(c) === want);
    if (at === -1) throw new Error('The baked Nine floors lack a standalone deck cap the recipe names');
    left.splice(at, 1);
  });
  return left;
}
/** Every piece of Nine's world the page had standing at load, each collider answering to its piece's id (or declared owner). */
export function addNinePieces(physics: Physics): number {
  let added = 0;
  NINE_PIECES.forEach(piece => {
    if (!piece.active || piece.file.startsWith(PRACTICE)) return;
    const colliders = piece.colliders.map(desc);
    addPiece(physics, { id: piece.id, name: piece.name, category: 'buildings', file: piece.file, colliders: piece.id === FLOORS ? withoutCaps(colliders) : colliders,
      ...(piece.surface === undefined ? {} : { surface: piece.surface }), colliderOwner: piece.colliderOwner ?? piece.id });
    added++;
  });
  return added;
}
/**
 * Nine Dragon Stack's renderer-free trusted runtime (SF72, `@wildshard/sdk/headlessRuntime`). Owns: the browser-baked
 * native colliders of the grid's cell (the fragment at +125 m, the four road-height landing decks open to the road, the
 * square's slab, the Well's crossings and safety cap, every placed model's colliders), the player standing at the declared spawn in Lantern Square, and the
 * Jian as its declared item row on the swept melee family's own clock (runtime/jian.ts). The fragment declares no quest,
 * creature, encounter or ledger rule, so none is installed. The entry proof is the format's own portal-link proof
 * (`provePortalLinks`): 23 capsule lanes across each deck's 8 m opening, then the bound ride to the square, the walked
 * route to its exit and the ride back, through the host's own collision world, so `finish` answers with real lanes,
 * steps and transfers. The Fei Zhua's rope sim stays the browser's (SF72 next step), so the Well's safety cap stands as
 * baked.
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = ({ shard, assets }) => {
  const jian = shard.items.rows.find(row => row.id === JIAN_ID);
  if (jian?.kind !== 'weapon') throw new Error('Nine Dragon declares its Jian row');
  const entries = portalLinkEntries(shard.entryways);
  if (entries.length !== 4) throw new Error('Nine Dragon declares four portal-link entryways');
  const level: SimLevel = { version: SIM_API_VERSION, id: shard.identity.slug, seed: shard.identity.seed, ground: { size: 500, height: 0 },
    player: { at: { x: shard.spawn.x, y: shard.spawn.y + 0.1, z: shard.spawn.z }, yaw: shard.spawn.yaw, speed: Math.min(5, shard.authorCaps.speed) },
    // the host's player strike is a zero-damage probe, never the Jian: the Jian is its declared item row (runtime/jian.ts)
    entities: [], quests: [], weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] } };
  return { level, ports: { ground: false }, proveEntries: host => {
    const proof = provePortalLinks(entries, shard, assets, { physics: host.physics });
    return { lanes: proof.lanes, steps: proof.steps, portalTransfers: proof.transfers };
  }, install: (host, context) => {
    if (!context.restoring) addNinePieces(host.physics);
    installNineJian(host, jian, JIAN_ROW, () => context.commands().some(command => command.kind === 'player' && command.attack !== undefined));
  } };
};
