// Cold author-only manifest/tint query product; no runtime constructor or retained output seeds it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { zlibSync } from 'fflate';
import { createHash } from 'node:crypto';
import { signalManifestGround } from './manifestGround.ts';
import { signalNativeTerrain } from './nativeTerrain.ts';

const root = resolve(import.meta.dirname, '../../../..');
const { metadata, means } = signalManifestGround();
const bytes = new Uint8Array(means.length * 8), view = new DataView(bytes.buffer);
for (let i = 0; i < means.length; i++) view.setFloat64(i * 8, means[i] ?? 0, true);
const folder = resolve(root, 'public/assets/sunscar-dunes/ground');
mkdirSync(folder, { recursive: true });
writeFileSync(resolve(folder, 'ring-mean.bin'), zlibSync(bytes));
writeFileSync(resolve(root, 'src/shards/sunscar-dunes/data/manifestGround.generated.json'), `${JSON.stringify(metadata, null, 2)}\n`);
const terrain = signalNativeTerrain(), terrainFolder = resolve(root, 'public/assets/baked/sunscar-dunes');
mkdirSync(terrainFolder, { recursive: true });
writeFileSync(resolve(terrainFolder, 'terrain.bin'), terrain.bytes);
writeFileSync(resolve(terrainFolder, 'terrain.json'), `${JSON.stringify({ hash: createHash('sha256').update(terrain.bytes).digest('hex'), version: 1,
  res: 256, size: 500, seed: metadata.seed, landscapeHash: terrain.landscapeHash, bytes: terrain.bytes.length, placement: null, heightRange: terrain.heightRange }, null, 2)}\n`);
console.info(`Signal manifest ground: ${means.length} exact f64 ring means and original pose heights`);
