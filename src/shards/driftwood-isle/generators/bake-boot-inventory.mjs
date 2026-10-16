// Boot metadata exists before product admission; author recipes never enter the client bundle.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { driftwoodBootInventory } from './bootInventory.ts';
import { driftwoodCapturePoses } from './capturePoses.ts';
import * as v from 'valibot';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
/** Only these authored public trees affect recipe presence and phone fallbacks. */
const roots = ['assets/baked/driftwood-isle', 'assets/models/driftwood-blender', 'assets/models/driftwood-hero',
  'assets/horizon', 'assets/lut',
  'assets/gpu/horizon', 'assets/gpu/models/driftwood-blender', 'assets/gpu/models/driftwood-hero'];
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
const writer = byteWriter(process.argv.includes('--check'), 'driftwood-boot-inventory');
for (const [name, rows] of Object.entries(driftwoodBootInventory(ordered))) {
  writer.put(resolve(root, `src/shards/driftwood-isle/data/boot-${name}.generated.json`), jsonBytes(rows));
}
writer.put(resolve(root, 'src/shards/driftwood-isle/data/boot-poses.generated.json'), jsonBytes(driftwoodCapturePoses()));
writer.finish();
