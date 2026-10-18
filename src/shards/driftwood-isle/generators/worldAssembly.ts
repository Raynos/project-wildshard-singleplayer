/** Ordered static build facts; native scene handles carry every rendered owner. */
import { OCEAN, JETTIES, BRIDGE } from './worldSites';

export const WORLD_ASSEMBLY = { ocean: OCEAN, bridge: BRIDGE,
  piers: [{ id: 'piers.world-0', label: 'Pier' }, ...JETTIES.map((_, i) => ({ id: `piers.world-${i + 1}`, label: `Jetty ${i + 1}` }))] };
