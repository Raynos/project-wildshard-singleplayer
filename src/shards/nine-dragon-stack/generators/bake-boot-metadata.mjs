import { manifestDeclaration } from '../../../../scripts/manifest-declaration.mjs';
import discovery from '../data/discovery.json' with { type: 'json' };
import { ND_BUDGET_INPUTS } from '../data/budgets.ts';
import { MOCKUP_CAMERAS } from './mockupCameras.ts';
import { NINE_MANIFEST_ROWS } from './manifestRows.ts';
import { bootSources } from './bootFiles.ts';
import manifest from '../data/manifest.json' with { type: 'json' };
import strings from '../data/strings.json' with { type: 'json' };
import ceilings from '../data/budgetCeilings.json' with { type: 'json' };
import runtimeCost from '../data/runtimeCost.json' with { type: 'json' };
import samples from '../data/audioSamples.json' with { type: 'json' };
import explorerModels from '../data/explorerModels.json' with { type: 'json' };
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import * as v from 'valibot';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
/** Only these authored public trees affect recipe presence and phone fallbacks. */
const roots = ['assets/nine-dragon', 'assets/baked/nine-dragon-stack'];
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
const resolveMode = (tier, tex) => bootSources(tier, tex, manifest.BOOT_FILES, ordered);
const sources = { modes: {
  phone: { img: resolveMode('phone', 'img'), ktx2: resolveMode('phone', 'ktx2') },
  desktop: { img: resolveMode('desktop', 'img'), ktx2: resolveMode('desktop', 'ktx2') },
} };
const writer = byteWriter(process.argv.includes('--check'), 'nine-boot-metadata');
writer.put(resolve(root, 'src/shards/nine-dragon-stack/boot/metadata.generated.json'), jsonBytes({ sources, manifest: { BOOT_FILES: manifest.BOOT_FILES, COMPARE_ROWS: manifest.COMPARE_ROWS }, ceilings, runtimeCost, samples, strings, rows: NINE_MANIFEST_ROWS, explorerModels }));
const { extraArt, compareImages, ...fixed } = discovery;
if (compareImages.length !== manifest.COMPARE_ROWS.length) throw new Error('Comparison rows require one image pair each');
const explore = { ...fixed.explore, compare: manifest.COMPARE_ROWS.map((row, index) => ({ ...row, ...compareImages[index] })) };
writer.put(resolve(root, 'src/shards/nine-dragon-stack/boot/declaration.generated.ts'), manifestDeclaration(root, 'nine-dragon-stack', {
  ...NINE_MANIFEST_ROWS, ...fixed, budgets: ND_BUDGET_INPUTS, runtimeCost,
  fight: { ...fixed.fight, attackers: fixed.fight.attackers === 'unbounded' ? Infinity : fixed.fight.attackers }, poses: MOCKUP_CAMERAS,
  explore,
  audio: { ...fixed.audio, bed: samples.bed, samples: { omitLoops: samples.omitLoops, omitShots: samples.omitShots, loopGains: samples.loopGains } },
  boot: { ...fixed.boot, files: manifest.BOOT_FILES, sources, explore: { art: [...Object.values(explore.art), ...explore.compare.flatMap(({ live, image }) => [live, image]), ...extraArt] } },
}, ['load', 'ground', 'slug']));
writer.finish();
