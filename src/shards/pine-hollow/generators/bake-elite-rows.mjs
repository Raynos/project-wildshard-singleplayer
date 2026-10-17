// Retained authors for Pine's existing elite/strike hosts; no runtime policy is generated.
import { resolve } from 'node:path';
import nightStages from '../data/nightStages.json' with { type: 'json' };
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { ANTLER_KING_BOSS_PROFILE } from './kingFight.ts';
import { pineNightSpec } from './nightSpec.ts';

const root = resolve(import.meta.dirname, '../../../..');
const writer = byteWriter(process.argv.includes('--check'), 'pine elite rows');
for (const [name, value] of Object.entries({
  kingFight: ANTLER_KING_BOSS_PROFILE,
  nightPopulation: {spec:pineNightSpec(3),stages:nightStages},
})) writer.put(resolve(root, `src/shards/pine-hollow/data/${name}.generated.json`), jsonBytes(value));
writer.finish();
