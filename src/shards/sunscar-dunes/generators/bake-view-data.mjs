// Compile the original boot and model rows; JSON imports retain literal and tuple types.
import { fileURLToPath } from 'node:url';
import * as models from './rows/files.ts';
import * as surfaces from './rows/surfaces.ts';
import * as boot from './rows/boot.ts';
import { BUDGETS } from './rows/budgets.ts';
import { SIGNAL_DEV_POSES } from './rows/devPoses.ts';
import { SIGNAL_PIECES } from './rows/pieces.ts';
import runtimeBoot from '../data/runtimeBoot.json' with { type: 'json' };
import striderRig from '../data/striderRig.json' with { type: 'json' };
import cues from '../data/cues.json' with { type: 'json' };
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

// Same declaration-only companion pattern as the Nalati fixed-coordinate bake.
function shape(value) {
  if (Array.isArray(value)) return `readonly [${value.map(shape).join(',')}]`;
  if (typeof value === 'object' && value !== null) return `{${Object.entries(value).map(([key, item]) => `readonly ${JSON.stringify(key)}: ${shape(item)}`).join(';')}}`;
  return typeof value === 'number' ? 'number' : JSON.stringify(value);
}
const writer = byteWriter(process.argv.includes('--check'), 'signal-view-data');
for (const [name, rows] of Object.entries({ models, surfaces, boot: boot.BOOT_FILES, bootSources: boot.BOOT_SOURCES, lateReads: boot.LATE_READS, budgets: BUDGETS, devPoses: SIGNAL_DEV_POSES, pieces: SIGNAL_PIECES, runtimeBoot, striderRig, cues })) {
  writer.put(fileURLToPath(new URL(`../assets/${name}.generated.json`, import.meta.url)), jsonBytes(rows));
  writer.put(fileURLToPath(new URL(`../assets/${name}.generated.d.json.ts`, import.meta.url)), Buffer.from(`// Generated row types; no runtime declarations.\ndeclare const rows: ${shape(rows)};\nexport default rows;\n`));
}
writer.finish();
