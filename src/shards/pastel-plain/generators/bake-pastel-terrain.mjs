// G320: only the shard's retained authoring law and the SDK compiler produce these files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pastelTerrain } from './terrain.ts';

const project = resolve(import.meta.dirname, '..');
const { assets, ...rows } = pastelTerrain();
mkdirSync(resolve(project, 'assets'), { recursive: true });
for (const [hash, bytes] of assets) writeFileSync(resolve(project, 'assets', hash), bytes);
writeFileSync(resolve(project, 'data/terrain.json'), `${JSON.stringify(rows, null, 2)}\n`);
console.info(`pastel terrain: ${String(assets.size)} immutable files, authoring-only`);
