// G320: the retained template seed, trail, pool and road law produce every terrain byte in Node.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { templateTerrain } from './terrain.ts';

const project = resolve(import.meta.dirname, '..');
const { assets, ...rows } = templateTerrain();
mkdirSync(resolve(project, 'assets'), { recursive: true });
for (const [hash, bytes] of assets) writeFileSync(resolve(project, 'assets', hash), bytes);
writeFileSync(resolve(project, 'data/terrain.json'), `${JSON.stringify(rows, null, 2)}\n`);
console.info(`template terrain: ${String(assets.size)} immutable files, authoring-only`);
