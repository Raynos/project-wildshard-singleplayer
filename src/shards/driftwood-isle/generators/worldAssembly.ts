/** Ordered static build facts; native scene handles carry every rendered owner. */
import { OCEAN, JETTIES, BRIDGE } from './worldSites';
import { driftwoodWorldEntry } from './worldEntry';
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
  { kind: 'site', id: 'shrine', label: 'Shrine', model: 'shrine', choice: 'world' }, ...jetties.map(({ id, label }) => ({ kind: 'place', id, label })),
  entry('bushes', 'Bushes', { object: { as: 'mesh', part: 'hibiscus.mesh' } }), entry('trail', 'Trailside', { object: { as: 'mesh', part: 'trail.mesh' } }),
  entry('seabed', 'Seabed', { object: { as: 'mesh', part: 'reef.mesh' } }),
  entry('cove', 'Cove', { object: { as: 'group', part: cove.root } }), entry('palms', 'Palms', { object: { as: 'mesh', part: 'palms.mesh' } }),
  entry('smallRocks', 'Small rocks', { object: { as: 'mesh', part: 'rocks.small' } })] };
