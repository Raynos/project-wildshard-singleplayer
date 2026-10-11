import rows from '../data/islets.generated.json' with { type: 'json' };
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { ISLET_EDGES, type EntryEdge, type RisingIslet, type P3 } from '../data/isletDesign';

const OUTWARD: Readonly<Record<EntryEdge, readonly [number, number]>> = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };
/** The entry's frame: `t` along the edge (to the right looking inward), `u` inward from the cell edge. */
export function entryFrame(edge: EntryEdge): (t: number, u: number, y: number) => P3 {
  const [ox, oz] = OUTWARD[edge], tx = -oz, tz = ox;
  return (t, u, y) => ({ x: ox * (CHUNK_HALF - u) + tx * t, y, z: oz * (CHUNK_HALF - u) + tz * t });
}

/** Cached layout in native registration order, with the original coordinate callback for dock geometry.
 * Refuse mismatched edge/kind tags rather than admitting a different generated floor. */
export const RISING_ISLETS: readonly RisingIslet[] = ISLET_EDGES.map((edge, index) => {
  const row = rows.entries[index];
  if (row === undefined || row.edge !== edge || row.landing.kind !== 'box' || row.landing.surface !== 'stone' || row.bridge.kind !== 'rope')
    throw new Error('Malformed generated Rising Islet');
  const { strips: _strips, ...entry } = row, result = {};
  return Object.assign(result, entry, { edge, landing: { ...entry.landing, kind: 'box' as const, surface: 'stone' as const },
    bridge: { ...entry.bridge, kind: 'rope' as const }, at: entryFrame(edge) });
});
