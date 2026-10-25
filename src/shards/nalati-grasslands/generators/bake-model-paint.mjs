// Retained CLI publication for the source-owned fixed-model painter.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { MODEL_FILES, bakeModelPaint } from './modelPaint.mjs';

const root = resolve(import.meta.dirname, '../../../..');

if (import.meta.main) {
  const writer = byteWriter(process.argv.includes('--check'), 'nalati-model-paint');
  for (const file of MODEL_FILES) {
    const name = file.split('.')[0];
    const bytes = await bakeModelPaint(readFileSync(resolve(root, 'public/assets/nalati/models', file)), name);
    writer.put(resolve(root, 'public/assets/nalati/baked/painted-models', file), bytes);
  }
  writer.finish();
}
