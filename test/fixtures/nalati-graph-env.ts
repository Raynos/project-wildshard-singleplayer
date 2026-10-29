import type { Shardfile } from '../../src/format/shardSchema';
import type { GraphNode } from '../../src/format/materialGraph';

type Material = Shardfile['look']['materials'][string];

/** The three Nalati look graphs that port the painterly preset (9a6083a939: their ambient took the sky's diffuse). */
const PORTED: ReadonlySet<string> = new Set(['nalati-crag', 'nalati-crag-phone', 'nalati-riders']);

/** one ported graph back to its pre-9a6083a939 ambient, refusing anything but that change's exact shape */
function restore(id: string, entry: Material): Material {
  if (entry.family !== 'graph' || !('graph' in entry)) throw new Error(`Missing ported Nalati graph ${id}`);
  const before = Object.entries(entry.graph.nodes);
  const shape = (key: string): string => JSON.stringify(before.find(([name]) => name === key)?.[1]);
  if (shape('irrL') !== '{"op":"irradiance"}' || shape('irrE') !== '{"op":"environmentIrradiance"}'
    || shape('irrA') !== '{"op":"add","in":["irrL","irrE"]}') throw new Error(`Nalati graph ${id} is not the 9a6083a939 shape`);
  const irradiance: GraphNode = { op: 'irradiance' };
  const nodes = Object.fromEntries(before.filter(([name]) => name !== 'irrL' && name !== 'irrE')
    .map(([name, node]): [string, GraphNode] => [name, name === 'irrA' ? irradiance : node]));
  return { ...entry, graph: { ...entry.graph, nodes } };
}

/**
 * 9a6083a939 gave the painterly preset's three Nalati ports the sky's image-based diffuse: each graph's ambient
 * `irrA: irradiance` became `irrL: irradiance`, `irrE: environmentIrradiance`, `irrA: add(irrL, irrE)`. Put exactly
 * those three graphs back (same key order, same node shape) for the unchanged pre-change header oracle; a missing
 * graph, or one not in that exact new shape, refuses. This is never a live product fallback.
 */
export function predecessorEnvGraphs(header: Shardfile): Shardfile {
  const entries = Object.entries(header.look.materials);
  if (entries.filter(([id]) => PORTED.has(id)).length !== PORTED.size) throw new Error('Missing a ported Nalati graph');
  const materials = Object.fromEntries(entries.map(([id, entry]): [string, Material] => [id, PORTED.has(id) ? restore(id, entry) : entry]));
  return { ...header, look: { ...header.look, materials } };
}
