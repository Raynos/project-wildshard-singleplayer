import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { bakePlantedForest } from '@wildshard/sdk/bake/forest';
import { Rng } from '@wildshard/sdk/random';
import declared from '../data/publicInputs.json' with { type: 'json' };
import bindings from '../data/terrainBindings.json' with { type: 'json' };
import manifest from '../manifest.json' with { type: 'json' };
import { pineForestRows } from './forestRows';
import { pineGeographyRows } from './geographyRows';
import { pinePerches } from './perches';
import { perchRows, type BarkPerch, type PointPerch } from './perchRows';

/** The retained terrain's URL (its public path under `/assets/`). */
const TERRAIN_URL = `/${bindings.terrain.replace(/^public\//u, '')}`;

/** GR8 (G32): the ambient perches, as the retired bake-perches.mjs and bake-perch-rows.mjs made them. The tree set's
 *  trunk spines are read from its GLB (and the variant order from its sidecar), the forest the page plants is planted
 *  from data (`bakePlantedForest`: the declared candidates and ground over the retained bake), and each planted tree
 *  gives its perches; all three inputs are read through `ctx.cached`. */
export async function pineAmbientPerches(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<{ snags: PointPerch[]; bark: BarkPerch[] }> {
  const inputs = { 'trees.glb': declared.trees.glb, 'trees.json': declared.trees.sidecar, 'terrain.bin': TERRAIN_URL };
  const files = await ctx.cached({ id: 'perch-inputs', inputs: Object.values(inputs) }, read => new Map(Object.entries(inputs).map(([name, url]) => {
    const bytes = read.get(url);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing declared Pine perch input ${url}`);
    return [name, bytes];
  })));
  const file = (name: keyof typeof inputs): Uint8Array => {
    const bytes = files.get(name);
    if (bytes === undefined) throw new Error(`Missing cached Pine perch input ${name}`);
    return bytes;
  };
  const sidecar: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(file('trees.json')));
  if (typeof sidecar !== 'object' || sidecar === null || !('variants' in sidecar) || !Array.isArray(sidecar.variants)) throw new Error('Pine tree sidecar has no variants');
  const names = sidecar.variants.map((row: unknown) => {
    if (typeof row !== 'object' || row === null || !('name' in row) || typeof row.name !== 'string') throw new Error('Pine tree variant has no name');
    return row.name;
  });
  const spines = await pinePerches(file('trees.glb'), names), ground = pineGeographyRows().ground;
  const planted = bakePlantedForest({
    seed: manifest.seed, treeCount: manifest.treeCount, forest: manifest.forest, candidates: pineForestRows(manifest),
    ground: { seed: ground.terrain.seed, trails: ground.trails, cabinSites: ground.cabinSites, pond: ground.pond, water: ground.water },
    terrain: file('terrain.bin'),
    variants: manifest.trees.setVariants.map(row => ({ trunkRadius: row.trunk, height: row.height, species: row.species, collider: row.collider })),
  });
  return perchRows(planted.trees, spines, new Rng(0x71fe));
}
