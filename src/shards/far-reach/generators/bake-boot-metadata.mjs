import * as assets from './fileInventory.ts';
import { BOOT_SOURCES, LATE_READS } from './bootInventory.ts';
import { SKY_AO_FLOOR } from './modelFrames.ts';
import { ISLET_POOL } from './restFiles.ts';
import { SKY_RIG_LIBRARY, SKY_MODEL_SPECIMENS } from './rigLibrary.ts';
import { SKY_WORLD_PREPARATION } from './worldTextures.ts';
import { filePolicy } from '@wildshard/engine/boot/filePolicy';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const publicRoot = resolve(root, 'public');
/** Phone variants affect only GPU references, exactly as in bootSourceFiles. */
/** @type {Record<string, number>} */
const inventory = {};
for (const file of readdirSync(resolve(publicRoot, 'assets/far-reach'), { recursive: true, withFileTypes: true })) {
  if (!file.isFile()) continue;
  const path = resolve(file.parentPath, file.name);
  inventory[`/${path.slice(publicRoot.length + 1)}`] = statSync(path).size;
}
const { gpu } = filePolicy('phone', 'img', BOOT_SOURCES.gpuFiles, inventory);
// The original all-file list deliberately uses phone image sources for either
// tier. Sources retain their original deferred GPU selection and read order.
const files = Object.values(BOOT_SOURCES.tiers.phone).flatMap(rows => rows.map(row => typeof row === 'string' ? row : gpu(row.gpu)));
const writer = byteWriter(process.argv.includes('--check'), 'sky-boot-metadata');
for (const [name, value] of Object.entries({ assets: { ...assets, SKY_AO_FLOOR, ISLET_POOL }, files, sources: BOOT_SOURCES, lateReads: LATE_READS,
  rigs: { library: SKY_RIG_LIBRARY, models: SKY_MODEL_SPECIMENS }, worldTextures: SKY_WORLD_PREPARATION })) {
  writer.put(resolve(root, `src/shards/far-reach/boot/${name}.generated.json`), jsonBytes(value));
}
writer.finish();
