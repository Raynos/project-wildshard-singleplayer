// oxlint-disable-next-line import/no-nodejs-modules -- The committed terrain lattice feeds the predecessor placement.
import { readFileSync } from 'node:fs';
import { prepareNalatiDressingInputs } from '../../src/shards/nalati-grasslands/generators/dressingInputs';
import { bakeNalatiDressingSource } from '../../src/shards/nalati-grasslands/generators/dressingSource';
import { originalGeographyFiles } from './nalati-geography-original';

const GROUPS = ['boulder', 'slab', 'stone', 'juniper', 'rose', 'willow', 'lupin', 'daisy', 'reed', 'logs', 'stumps', 'ovoos', 'poles', 'fences', 'gates', 'drifts', 'colliders', 'clutter'] as const;

/** QF24's predecessor layer: the 18 dressing placement files as the product made them before 2c1ad0bbcc, over the
 *  sampled 256 forest lattice (`data/geography-forest.bin`) instead of LEGACY's continuous spruce mask. */
export async function sampledDressingPlacements(): Promise<ReadonlyMap<string, Uint8Array>> {
  const geography = originalGeographyFiles(), scalarBlocks = new Map<string, Uint8Array>();
  for (const name of ['pond', 'red', 'green', 'blue', 'forest']) {
    const file = `data/geography-${name}.bin`, bytes = geography.get(file);
    if (bytes === undefined) throw new Error(`Missing original geography ${file}`);
    scalarBlocks.set(file, bytes);
  }
  const terrain = new Uint8Array(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'));
  const made = await bakeNalatiDressingSource(prepareNalatiDressingInputs({ terrain, scalarBlocks, forest: 'sampled', phone: false }));
  const rows: Record<string, unknown> = { ...made.plan, clutter: made.clutter };
  return new Map(GROUPS.map(group => [`dressing-${group}.json`, new TextEncoder().encode(`${JSON.stringify(rows[group])}\n`)]));
}
