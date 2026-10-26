import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decorativeRows } from './decorative.ts';
import { nalatiPoiScenes } from './poiScenes.ts';
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const writer = byteWriter(process.argv.includes('--check'), 'nalati-decorative');
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/decorative.generated.json'), jsonBytes(withPortableMath(() => decorativeRows(new Uint8Array(readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')))))));
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/decorative.generated.json'), jsonBytes(withPortableMath(() => decorativeRows(new Uint8Array(readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')))))));
const places = JSON.parse(readFileSync(resolve(root, 'src/shards/nalati-grasslands/data/places.json'), 'utf8'));
const scenes = nalatiPoiScenes(places);
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/poiScenes.generated.json'), jsonBytes(scenes));
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/poiScenes.generated.json'), jsonBytes(scenes));
writer.finish();
