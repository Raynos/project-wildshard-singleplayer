import { resolve } from 'node:path';
import { tamingPoses } from './bodies.ts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const writer = byteWriter(process.argv.includes('--check'), 'nalati-taming-poses');
writer.put(resolve(import.meta.dirname, '..', 'data', 'tamingPoses.generated.json'), jsonBytes(tamingPoses, 0));
writer.finish();
