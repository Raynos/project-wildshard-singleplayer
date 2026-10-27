// A standalone author tool (GR6): the product builds the crag rows itself and checks the committed shape bank
// (public/assets/nalati/baked/crags.bin) is its construction's exact bytes. Run this by hand to rewrite that bank when the
// crags change (`--check` reports a stale bank).
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { nalatiCragRock } from './cragRockProgram.ts';

const root = resolve(import.meta.dirname, '../../../..');
const made = nalatiCragRock(readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')));
const writer = byteWriter(process.argv.includes('--check'), 'nalati-crags');
writer.put(resolve(root, 'public/assets/nalati/baked/crags.bin'), made.bin);
writer.finish();
