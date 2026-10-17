// Retained transitional painted places/specimens runner; the nine dressing recipes are independent.
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { bakeNalatiPlacesOnTerrain } from './places.ts';
import { readNalatiTerrain, writeNalatiParts } from './bake-nalati-places.mjs';

import { prepareNativeTerrain } from '../../../../scripts/bake/nativeWorld.mjs';
import { game } from '@wildshard/game/shard/registry';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const terrain = readNalatiTerrain();
await prepareNativeTerrain(game.shard, { root: resolve(import.meta.dirname, '../../../..'), bytes: new Uint8Array(terrain) });

const read = key => JSON.parse(readFileSync(resolve(import.meta.dirname, `../data/dressing-${key}.generated.json`), 'utf8'));
const { clutter, ...plan } = Object.fromEntries(['boulder', 'slab', 'stone', 'juniper', 'rose', 'willow', 'lupin', 'daisy', 'reed', 'logs', 'stumps', 'ovoos', 'poles', 'fences', 'gates', 'drifts', 'colliders', 'clutter'].map(key => [key, read(key)]));
const made = bakeNalatiPlacesOnTerrain(terrain, withPortableMath, { plan, clutter });
writeNalatiParts([{ name: 'places', json: 'places.json', part: made.places },
  { name: 'specimens', json: 'placeSpecimens.json', part: made.specimens }], process.argv.includes('--check'));
