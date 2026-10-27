import { resolve } from 'node:path';
import { paintDataMap, repoSource } from '../../../../scripts/bake-data-maps.mjs';
import { nalatiMapFiles } from './mapAssembly.mjs';
import { nalatiTerrainScene } from './terrainSceneProgram.ts';

const root = resolve(import.meta.dirname, '../../../..');
const source = repoSource(root);
// the native terrain draws the painter reads (map.json painter.glbs), built here rather than read from a handoff
const terrain = nalatiTerrainScene(source('public/assets/baked/nalati-grasslands/terrain.bin'))
  .map(blob => [`assets/world-terrain/${(blob.file.name ?? '').split('/').at(-1)?.replace('.glb', '') ?? ''}.generated.glb`, blob.bytes]);
await paintDataMap(root, 'nalati-grasslands', { sources: new Map([...await nalatiMapFiles(source), ...terrain]) });
