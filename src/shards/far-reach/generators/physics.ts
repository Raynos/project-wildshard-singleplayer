import { SKY_SPAWNS } from '../data/spawns';
import rows from '../data/physicsRows.json' with { type: 'json' };
import { skyPhysicsPlacements } from './physicsPlacements';
import { skyBridgePhysicsPlacements } from './bridgeColliders';

/** The creature manager's stream (mulberry32 on the level seed + 31): scale, rig seed, actor seed, then three brain rolls. */
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Kind = keyof typeof rows.species;
const isKind = (kind: string): kind is Kind => kind in rows.species;
/** The kind's authored simulation spec and scale range (`data/physicsRows.json`; test/shards/far-reach/physics-bake.test.ts
 * holds them to the species rows). */
function species(kind: string): (typeof rows.species)[Kind] {
  if (!isKind(kind)) throw new Error(`Sky physics: no species row for ${kind}`);
  return rows.species[kind];
}

/** G350-FR: Sky's physics product from authoring inputs only: the island, lip, prop and bridge recipes, the species scale
 * ranges with the manager's seed stream, and the authored rows no recipe computes (native pieces, species, piece order). */
export function skyPhysics(): Record<string, unknown> {
  const pieces = new Map<string, unknown>([...skyPhysicsPlacements(), ...skyBridgePhysicsPlacements(), ...rows.pieces].map(piece => [piece.id, piece]));
  const ordered = rows.order.map(id => {
    const piece = pieces.get(id);
    if (piece === undefined) throw new Error(`Sky physics: no piece row for ${id}`);
    return piece;
  });
  if (ordered.length !== pieces.size) throw new Error('Sky physics: a piece row is missing from the authored order');
  // The flyers spawn in play (ray, roost rays, wisps, then the Roc); the goats on the first fixed step after them.
  const roster = [...SKY_SPAWNS.actors.filter(row => row.kind !== 'skyGoat'), ...SKY_SPAWNS.bosses, ...SKY_SPAWNS.actors.filter(row => row.kind === 'skyGoat')];
  const next = stream(rows.seed + 31);
  const actors = roster.map(row => {
    const made = species(row.kind), [low = 1, high = 1] = made.scale, scale = low + (high - low) * next();
    next(); const seed = next(); next(); next(); next();
    return { id: row.id, spec: made.spec, seed, scale };
  });
  return { version: 1, profile: 'authored rows', notice: 'DO NOT EDIT: regenerate with generators/physics.ts (sky-physics).', actors, pieces: ordered };
}
