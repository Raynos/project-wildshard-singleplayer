/** Ordered static build facts; native scene handles carry every rendered owner. */
import { OCEAN, JETTIES, BRIDGE } from './worldSites';

export const WORLD_ASSEMBLY = { ocean: OCEAN, bridge: BRIDGE,
  piers: [{ id: 'piers.world-0', label: 'Pier' }, ...JETTIES.map((_, i) => ({ id: `piers.world-${i + 1}`, label: `Jetty ${i + 1}` }))] };
const [pier, ...jetties] = WORLD_ASSEMBLY.piers;
if (pier === undefined) throw new Error('Driftwood needs its entry pier');
/** G571: the world build's typed stages, in build order (game/shardfile/worldAssembly): the entry pier, the hut and
 *  lookout sites, then the three jetties; each publishes its object, Placed and floor loans under its id. */
export const WORLD_STAGES = { stages: [{ kind: 'place', ...pier }, { kind: 'site', id: 'hut', label: 'Hut', model: 'hut', choice: 'world' },
  { kind: 'site', id: 'lookout', label: 'Lookout', model: 'lookout', choice: 'world' }, ...jetties.map(({ id, label }) => ({ kind: 'place', id, label }))] };
