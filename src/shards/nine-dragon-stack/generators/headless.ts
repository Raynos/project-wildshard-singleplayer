import * as v from 'valibot';
import type { Material } from '@wildshard/engine/physics/surface';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { treadBoxes } from '@wildshard/engine/physics/pieces';
import { bakedColliderDesc, bakedColliderSchemas } from './bakedColliders';
import capRows from '../data/deckCaps.generated.json' with { type: 'json' };
import { PORTAL_FADE, PORTAL_TRIGGER } from '../data/portals';
import source from '../shard.config';
import baked from '../data/physics.generated.json' with { type: 'json' };

const finite = v.pipe(v.number(), v.finite());
const SURFACES: readonly Material[] = ['wood', 'metal', 'flesh', 'felt', 'stone', 'rock', 'sand'];
const Vec = v.strictObject({ x: finite, y: finite, z: finite });
/** One baked collider, strictly (@wildshard/sdk/props/bakedColliders): every engine `ColliderDesc` kind the page registered, an unknown field refuses the bake. */
const { Surface, Collider } = bakedColliderSchemas(SURFACES);
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const Piece = v.strictObject({ id: v.string(), name: v.string(), category: v.string(), file: v.string(), colliders: v.array(Collider), active: v.boolean(),
  surface: v.exactOptional(Surface), colliderOwner: v.exactOptional(v.string()),
  // a followed piece (the Well safety cap) baked at rest: its frame is the world's, so it stands where its boxes say
  follows: v.optional(v.strictObject({ matrix: v.pipe(v.array(finite), v.check(m => m.length === 16 && m.every((x, i) => x === IDENTITY[i]), 'a baked followed piece rests at the world frame')), rotation: v.boolean() })) });
/** Nine's native colliders, from authored rows (generators/physics.ts, G350-ND), strictly. */
const NINE_PIECES = v.parse(v.array(Piece), baked.pieces);
/** The Fei Zhua's dragon hooks (the ring centres the claw bites) as the page's world placed them, from the same bake. */
const NINE_HOOKS = v.parse(v.array(Vec), baked.hooks);
/** The engine's own HUD / Weapon Explorer arena (engine/practice), registered under every Developer page: not Nine's world. */
const PRACTICE = 'src/engine/practice/';
/** The fragment's floors piece (world/install.ts), which carries the standalone deck caps. */
const FLOORS = 'nds-floors';
/**
 * The cell as the grid builds it: a standalone page closes each deck's open end with its balustrade cap (world/install.ts
 * `data/deckCaps.generated.json`), the grid leaves the decks open to the road. The headless cell is the grid's,
 * so exactly those boxes leave the baked floors piece; each must be found, or the bake no longer matches the recipe.
 */
function withoutCaps(colliders: readonly ColliderDesc[]): ColliderDesc[] {
  const left = [...colliders], key = (c: ColliderDesc): string => JSON.stringify(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)));
  (['north', 'south', 'east', 'west'] as const).flatMap(edge => v.parse(v.pipe(v.array(Collider), v.length(4)), capRows[edge]).map(bakedColliderDesc)).forEach(cap => {
    const want = key(cap), at = left.findIndex(c => key(c) === want);
    if (at === -1) throw new Error('The baked Nine floors lack a standalone deck cap the recipe names');
    left.splice(at, 1);
  });
  return left;
}

/** Grid collision in the original registry order, admitted before publication.
 * Treads expand with the engine's own law; hull floats retain their original
 * float32 payload. No runtime adapter filters or rewrites this payload. */
export const headlessConstants: Record<string, unknown> = {
  spawnY: source.spawn.y + 0.1, hooks: NINE_HOOKS,
  fade: PORTAL_FADE, trigger: PORTAL_TRIGGER,
  pieces: NINE_PIECES.filter(piece => piece.active && !piece.file.startsWith(PRACTICE)).map(piece => ({
    id: piece.id, name: piece.name, category: 'buildings', file: piece.file, active: true,
    surface: piece.surface ?? 'wood', owner: piece.colliderOwner ?? piece.id,
    colliders: (piece.id === FLOORS ? withoutCaps(piece.colliders.map(bakedColliderDesc)) : piece.colliders.map(bakedColliderDesc))
      .flatMap(c => c.kind === 'treads' ? treadBoxes(c) : [c])
      .map(c => {
        if (c.kind !== 'hull') return c;
        const row: Record<string, unknown> = {};
        Object.assign(row, c);
        row['points'] = Array.from(c.points);
        return row;
      }),
  })),
};
