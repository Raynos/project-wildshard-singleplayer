import { resolve } from 'node:path';
import { readNamedBlob } from '@wildshard/sdk/blobs';
import { paintDataMap } from '../../../../scripts/bake-data-maps.mjs';
import { signalMapWorldFiles } from './mapWorld.mjs';

// Raw author input is faceted by the defining world bake before GLB output admission.
const well = await readNamedBlob(resolve(import.meta.dirname, '..'), 'source/well.bin', 'assets/models/dry-well.glb', 'bin');
await paintDataMap(resolve(import.meta.dirname, '../../../..'), 'sunscar-dunes', { sources: await signalMapWorldFiles(well.bytes) });
