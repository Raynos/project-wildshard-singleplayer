import { parseWorldEntry, type WorldEntryRows, type WorldEntryStep } from '@wildshard/format/worldEntry';
import { ISLAND_KNOBS } from './tiers';
import cove from '../data/coveBake.json' with { type: 'json' };
import composition from '../data/coveComposition.json' with { type: 'json' };
import { ENTRY_LANDINGS } from './entryLandings';

const TIERS = ['phone', 'desktop'] as const;
/** a tier's foliage placement and its draw, named for its model, clipped by the island dressing */
const foliage = (kind: 'bushes' | 'palms', mesh: string, castShadow: (tier: typeof TIERS[number]) => boolean | undefined): WorldEntryStep[] => TIERS.flatMap(tier => {
  const placement = `foliage.${kind}.${tier}`, shadow = castShadow(tier);
  return [{ kind: 'place', id: placement, when: { tier } }, { kind: 'attach', id: mesh, as: 'mesh', nameAfter: placement, when: { tier },
    userData: { islandDressingClipped: true }, ...(shadow === undefined ? {} : { castShadow: shadow }) }];
});

/**
 * Driftwood Isle's declared world entry rows (each block one `entry` stage of generators/worldAssembly.ts, run by
 * @wildshard/game/shardfile/worldAssembly in world/build.ts): the shore boulders, the hibiscus bushes and the coconut palms for this tier, the wreck, the cove's piece and
 * the cove's small rocks.
 */
export function driftwoodWorldEntry(): WorldEntryRows {
  return parseWorldEntry({ blocks: {
    bushes: foliage('bushes', 'hibiscus.mesh', tier => ISLAND_KNOBS[tier].bushShadows),
    palms: foliage('palms', 'palms.mesh', () => undefined),
    // the wreck and its cargo, drift logs and reef rocks (generators/worldPlacements.ts), then its root into the world
    wreck: [...['wreck.ship', 'wreck.barrels', 'wreck.crates', 'wreck.coils', 'wreck.logs', 'wreck.reef'].map(id => ({ kind: 'place', id })), { kind: 'attach', id: 'wreck.root', as: 'group' }],
    // the sailboat moored by the pier and its mooring lines (their look lifts the cleat ends with the hull, world/build.ts)
    boat: [{ kind: 'place', id: 'harbour.boat' }, { kind: 'attach', id: 'moorings.mesh', as: 'mesh' }],
    shore: [{ kind: 'place', id: 'rocks.shore.copies' }, { kind: 'attach', id: 'rocks.shore', as: 'mesh', nameAfter: 'rocks.shore.copies' }],
    // the declared entry landings (the shardfile's socket-landing proof, as declared: solid stone at road height), then the
    // road decks that carry each on over the water (generators/worldPlacements.ts)
    decks: [{ kind: 'piece', id: 'entry-landings', name: 'Entry landings', file: 'src/shards/driftwood-isle/generators/entryLandings.ts', category: 'props',
      surface: 'stone', colliders: ENTRY_LANDINGS.map(({ box }) => box), floors: ENTRY_LANDINGS.map(({ box }) => ({ x: box.x, z: box.z, hw: box.hx, hd: box.hz, y: 0 })),
      floorPolicy: 'first', solidFloor: true, object: null }, { kind: 'place', id: 'entry.decks' }],
    // the trail's posts, signs and steps, drawn into its weld (generators/worldPlacements.ts)
    trail: ['trail.posts', 'trail.signs', 'trail.planks'].map(id => ({ kind: 'place', id })),
    // the lagoon shelf's coral, kelp and starfish (its fish school is page life, generators/fishDraw.ts)
    seabed: [{ kind: 'attach', id: 'reef.mesh', as: 'mesh' }],
    smallRocks: [{ kind: 'place', id: 'rocks.small.copies' }, { kind: 'attach', id: 'rocks.small', as: 'mesh', nameAfter: 'rocks.small.copies' }],
    // Wreck Cove: its cascade and plunge pool under its root group, then the cove as one world piece (G3: its rock walls and
    // treads, its walkable floors in authored order, its root group), then its reef rocks; the drawn terrain pokes up through
    // the sea cave, so the physics ground is cut below its floor
    cove: [{ kind: 'attach', id: composition.cascade, as: 'group', parent: composition.root }, { kind: 'piece', ...composition.piece, colliders: cove.native.descs, floors: cove.floors, floorPolicy: 'first', object: composition.root }, { kind: 'place', id: 'cove.reef' }, { kind: 'cut', cuts: cove.native.cuts }],
  } });
}
