#!/usr/bin/env node
// G320: native WSTR ground compiled cold from retained source equations. No runtime, world or retained terrain input.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { driftwoodGroundBytes } from './groundRows.ts';

const root = resolve(import.meta.dirname, '../../../..');
const output = resolve(root, 'public/assets/baked/driftwood-isle/terrain.bin');
const bytes = driftwoodGroundBytes();
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, bytes);
console.log(`Driftwood author ground: ${String(bytes.byteLength)} WSTR bytes, cold retained source`);
