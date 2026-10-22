import authoredCover from '../data/groundCover.json' with { type: 'json' };
import fixedGeometry from '../data/fixedGeometry.json' with { type: 'json' };
import { WORLD_GULL_PERCHES } from './staticWorld';
import { GULL_FLOCK } from './gullsLook';
import { GULL_GRAPH_LOOK } from './gullGraphLook';
import shrineBake from '../data/shrineBake.json' with { type: 'json' };
import { FIREFLY_LOOK } from './fireflyLook';
/** Ordered static build facts; native scene handles carry every rendered owner. */
import { OCEAN, JETTIES, BRIDGE } from './worldSites';
import { driftwoodWorldEntry } from './worldEntry';
import { driftwoodRopeDeckSite } from './ropeDeckSite';
import cove from '../data/coveComposition.json' with { type: 'json' };

export const WORLD_ASSEMBLY = { ocean: OCEAN, bridge: BRIDGE,
  piers: [{ id: 'piers.world-0', label: 'Pier' }, ...JETTIES.map((_, i) => ({ id: `piers.world-${i + 1}`, label: `Jetty ${i + 1}` }))] };
const [pier, ...jetties] = WORLD_ASSEMBLY.piers;
if (pier === undefined) throw new Error('Driftwood needs its entry pier');
const { blocks } = driftwoodWorldEntry();
/** a world entry block (generators/worldEntry.ts) as one entry stage */
const entry = (id: string, label: string, published: { object?: { as: 'group' | 'mesh' | 'object'; part: string }; floor?: string } = {}) => {
  const rows = blocks[id]; if (rows === undefined) throw new Error(`Driftwood needs its world entry block ${id}`);
  return { kind: 'entry', id, label, rows, ...published };
};
/** G571: the world build's typed stages, in build order (game/shardfile/worldAssembly): the entry pier and its decks, the
 *  moored boat, the shore boulders, the hut and lookout sites, the wreck, the shrine site, the three jetties, then the bushes, trail, seabed, cove, palms and
 *  small rocks; each publishes its loans under its id. */
export const WORLD_STAGES = { stages: [{ kind: 'place', ...pier }, entry('decks', 'Entry decks'), entry('boat', 'Boat', { object: { as: 'object', part: 'harbour.boat.root' }, floor: 'harbour.boat' }),
  entry('shore', 'Shore boulders', { object: { as: 'mesh', part: 'rocks.shore' } }),
  { kind: 'site', id: 'hut', label: 'Hut', model: 'hut', choice: 'world' }, { kind: 'site', id: 'lookout', label: 'Lookout', model: 'lookout', choice: 'world' },
  entry('wreck', 'Wreck', { object: { as: 'group', part: 'wreck.root' }, floor: 'wreck.ship' }),
  { kind: 'site', id: 'shrine', label: 'Shrine', model: 'shrine', choice: 'world', life: {
    file: 'world/building-life.json', root: 'shrine.root', cloud: { draw: 'shrineFireflies', look: FIREFLY_LOOK,
      pose: { seeds: false, name: 'shrine-fireflies', at: { point: 'shrine.root', offset: [0, shrineBake.world.baseY, 0] }, parent: 'shrine.root',
        center: [0, shrineBake.world.terrace - shrineBake.world.baseY, 0], radius: 18, order: 4 } } } }, ...jetties.map(({ id, label }) => ({ kind: 'place', id, label })),
  entry('bushes', 'Bushes', { object: { as: 'mesh', part: 'hibiscus.mesh' } }),
  { kind: 'ambient-flock', id: 'driftwood.gulls', label: 'Gulls', rows: GULL_FLOCK, draw: { slot: 'gull', look: GULL_GRAPH_LOOK, castShadow: true }, perches: WORLD_GULL_PERCHES },
  entry('trail', 'Trailside', { object: { as: 'mesh', part: 'trail.mesh' } }),
  { kind: 'rope-deck', id: 'bridge', label: 'Rope bridge', site: driftwoodRopeDeckSite(), span: BRIDGE },
  entry('seabed', 'Seabed', { object: { as: 'mesh', part: 'reef.mesh' } }),
  entry('cove', 'Cove', { object: { as: 'group', part: cove.root } }), entry('palms', 'Palms', { object: { as: 'mesh', part: 'palms.mesh' } }),
  { kind: 'streamed-cover', id: 'cover', label: 'Ground cover', rows: authoredCover.GROUND_COVER, file: 'world/cover-composition.json', placement: 'foliage.logs',
    draws: fixedGeometry.groups.cover, object: 'driftwood.cover', system: 'shard.driftwood.cover' },
  { kind: 'rope-chain', id: 'bridge.deck', label: 'Bridge physics and paths', deck: 'bridge', capture: 'shard.driftwood.bridge.capture' },
  entry('smallRocks', 'Small rocks', { object: { as: 'mesh', part: 'rocks.small' } })] };
