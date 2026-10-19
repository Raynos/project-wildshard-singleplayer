import { postChainRows } from './postChain.ts';
import { manifestDeclaration } from '../../../../scripts/manifest-declaration.mjs';
import paintedTextures from '../data/paintedTextures.json' with { type: 'json' };
import discovery from '../data/discovery.json' with { type: 'json' };
import { NALATI_MAP } from './layout.ts';
import { nalatiDayClockRow } from './dayClock.ts';
import { NALATI_MANIFEST_ROWS } from './manifestRows.ts';
import { NALATI_BUDGET_INPUTS } from './budgets.ts';
import { NALATI_HORIZON_V2 } from './horizon.ts';
import strings from '../data/strings.json' with { type: 'json' };
import { NALATI_GRASS_LAYOUT } from './grassFieldLayout.ts';
import runtimeCost from '../data/runtimeCost.json' with { type: 'json' };
// Boot metadata exists before product admission; author recipes never enter the client bundle.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { nalatiBootInventory } from './bootInventory.ts';
import * as v from 'valibot';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
/** Only these authored public trees affect recipe presence and phone fallbacks. */
const roots = ['assets/nalati', 'assets/baked/nalati-grasslands', 'assets/baked/common', 'assets/gpu/nalati'];
/** @type {Record<string,number | true>} */
const bytes = {};
for (const folder of roots) for (const file of readdirSync(resolve(root, 'public', folder), { recursive: true, withFileTypes: true })) {
  if (file.isFile()) {
    const path = resolve(file.parentPath, file.name);
    bytes[`/${path.slice(resolve(root, 'public').length + 1)}`] = statSync(path).size;
  }
}
// Generation verifies and publishes these outputs before writing PUBLIC_BYTES.
// Their declared presence is independent of which cache outputs a warm slot retains.
const catalogue = v.parse(v.object({ jobs: v.array(v.object({
  buildOutputs: v.optional(v.record(v.string(), v.string()), {}),
  buildTimeOutputs: v.optional(v.array(v.string()), []),
})) }), JSON.parse(readFileSync(resolve(root, 'scripts/generation-jobs.json'), 'utf8')));
for (const job of catalogue.jobs) for (const path of [...Object.keys(job.buildOutputs), ...job.buildTimeOutputs]) {
  if (path.startsWith('public/assets/')) bytes[path.slice('public'.length)] = true;
}
// The page's generated PUBLIC_BYTES table has this exact lexical ordering.
const ordered = Object.fromEntries(Object.keys(bytes).filter(path => !path.endsWith('.DS_Store')).sort().map(path => [path, bytes[path]]));
const writer = byteWriter(process.argv.includes('--check'), 'nalati-boot-metadata');
writer.put(resolve(root, 'src/shards/nalati-grasslands/bootMetadata.generated.json'), jsonBytes({ ...nalatiBootInventory(ordered), dayClock: nalatiDayClockRow(), postChain: postChainRows(), runtimeCost, strings, grassLayout: NALATI_GRASS_LAYOUT, manifest: NALATI_MANIFEST_ROWS, budgets: NALATI_BUDGET_INPUTS, horizon: NALATI_HORIZON_V2 }));
const { captureProbes: _captureProbes, extraArt, ...fixed } = discovery;
const inventory = nalatiBootInventory(ordered);
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/declaration.generated.ts'), manifestDeclaration(root, 'nalati-grasslands', {
  ...NALATI_MANIFEST_ROWS, ...fixed, budgets: NALATI_BUDGET_INPUTS, runtimeCost,
  horizon: NALATI_HORIZON_V2,
  pois: NALATI_MAP.pois.map(p => ({ id: p.label.toLowerCase().replaceAll(' ', '-'), name: p.label.charAt(0) + p.label.slice(1).toLowerCase(), x: p.x, z: p.z, r: 24 })),
  minimap: { image: '/assets/nalati-grasslands/map/top.webp' },
  boot: { ...fixed.boot, files: inventory.files, sources: inventory.sources, steps: inventory.steps, lateReads: inventory.lateReads, explore: { art: [...Object.values(fixed.explore.art), ...extraArt, ...fixed.explore.compare.flatMap(({ live, image }) => [live, image])] } },
}, ['load', 'ground', 'seed', 'spawn', 'slug']));
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/paintedTextures.generated.json'), jsonBytes(paintedTextures));
writer.finish();
