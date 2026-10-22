// Pre-admission identities and boot policy, generated from authored sources.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { parseBakedTerrain } from '@wildshard/format/bakedTerrainBytes';
import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import PINE_TERRAIN from '../data/terrainBindings.json' with { type: 'json' };
import { pineBootInventory, pineKtx2Tables } from './bootInventory.ts';
import { FINISH_CARDS } from './finishCards.ts';
import { WILDLIFE_LOOK } from './wildlifeLook.ts';
import people from '../data/questNpcs.generated.json' with { type: 'json' };

/** Only these public trees affect recipe presence, phone fallbacks and GPU aliases. */
const roots = ['assets/hdri', 'assets/baked/pine-hollow', 'assets/tex', 'assets/models',
  'assets/pine-hollow', 'assets/gpu', 'assets/horizon', 'assets/lut'];
export function bootMetadata() {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  /** @type {Record<string, true>} */
  const inventory = {};
  for (const folder of roots) for (const file of readdirSync(resolve(root, 'public', folder), { recursive: true, withFileTypes: true })) {
    if (file.isFile()) {
      const path = resolve(file.parentPath, file.name);
      inventory[`/${path.slice(resolve(root, 'public').length + 1)}`] = true;
    }
  }
  const catalogue = v.parse(v.object({ jobs: v.array(v.object({
    buildOutputs: v.optional(v.record(v.string(), v.string()), {}),
    buildTimeOutputs: v.optional(v.array(v.string()), []),
  })) }), JSON.parse(readFileSync(resolve(root, 'scripts/generation-jobs.json'), 'utf8')));
  for (const job of catalogue.jobs) for (const path of [...Object.keys(job.buildOutputs), ...job.buildTimeOutputs]) {
    if (path.startsWith('public/assets/')) inventory[path.slice('public'.length)] = true;
  }
  const ordered = Object.fromEntries(Object.keys(inventory).filter(path => !path.endsWith('.DS_Store')).sort().map(path => [path, true]));
  // The existing texture baker publishes a literal table, also read by the prop/hero bakers.
  const source = readFileSync(resolve(root, 'src/shards/pine-hollow/runtime/boot/astc6/ktx2.generated.ts'), 'utf8');
  const astc = v.parse(v.record(v.string(), v.string()), JSON.parse(source.slice(source.indexOf(' = {') + 3, source.lastIndexOf('}') + 1)));
  return { boot: pineBootInventory(ordered, astc), gpu: pineKtx2Tables(astc) };
}
export const explorerMetadata = () => ({ cards: FINISH_CARDS, wildlifeLook: WILDLIFE_LOOK, names: Object.fromEntries(people.rows.map(row => [row.npc.id, row.npc.name])) });
/** Diagnostic eyes retain the shipping lattice's height and original angles. */
export function capturePoses() {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const grid = parseBakedTerrain(readFileSync(new URL('../../../../public/assets/baked/pine-hollow/terrain.bin', import.meta.url)), PINE_TERRAIN);
  if (grid === null) throw new Error('Capture poses require the authored Pine terrain');
  const { heightAt } = bakedSamplers(grid);
  return Object.fromEntries(manifest.captureProbes.map(probe => [probe.name, {
    probe, eye:[probe.x, heightAt(probe.x, probe.z) + 1.68, probe.z],
    yaw:-probe.yaw * 180 / Math.PI, pitch:probe.pitch * 180 / Math.PI, mockup:'', frame:probe.name,
  }]));
}
if (import.meta.main) {
  writeFileSync(new URL('../data/boot-poses.generated.json', import.meta.url), `${JSON.stringify(capturePoses())}\n`);
  const rows = bootMetadata();
  writeFileSync(new URL('../data/bootMetadata.generated.json', import.meta.url), `${JSON.stringify(rows.boot)}\n`);
  writeFileSync(new URL('../data/gpuTables.generated.json', import.meta.url), `${JSON.stringify(rows.gpu)}\n`);
  writeFileSync(new URL('../data/explorerMetadata.generated.json', import.meta.url), `${JSON.stringify(explorerMetadata())}\n`);
}
