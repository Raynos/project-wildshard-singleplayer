// Cold author-only manifest query product; no runtime constructor or retained output seeds it.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signalDrapeGround, signalManifestGround, signalNativeGround } from './manifestGround.ts';

const root = resolve(import.meta.dirname, '../../../..');
const { metadata } = signalManifestGround();
writeFileSync(resolve(root, 'src/shards/sunscar-dunes/data/manifestGround.generated.json'), `${JSON.stringify(metadata, null, 2)}\n`);
writeFileSync(resolve(root, 'src/shards/sunscar-dunes/data/drapeGround.generated.json'), `${JSON.stringify(signalDrapeGround())}\n`);
writeFileSync(resolve(root, 'src/shards/sunscar-dunes/data/nativeGround.generated.json'), `${JSON.stringify(signalNativeGround())}\n`);
console.info('Signal manifest ground: original pose heights and the pools\' lattice blocks');
