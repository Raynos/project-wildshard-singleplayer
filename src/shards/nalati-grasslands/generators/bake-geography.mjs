import { resolve } from 'node:path';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { nalatiGeographySources } from './geographySource.ts';

// Retained publication delegates to the defining source recipe until its final reader migrates.
const writer = byteWriter(process.argv.includes('--check'), 'nalati-geography');
for (const [file, bytes] of nalatiGeographySources()) writer.put(resolve(import.meta.dirname, '..', file), bytes);
writer.finish();
