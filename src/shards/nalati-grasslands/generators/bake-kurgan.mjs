// Retain the shipping encounter arithmetic offline; native owners consume only admitted JSON.
import { resolve } from 'node:path';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { parseBossProfile } from '@wildshard/format/bossProfiles';
import { strike } from '@wildshard/sdk/species';
import * as layout from './kurganLayout.ts';
import { GOLDEN_KING_BOSS_PROFILE } from './goldenKingArena.ts';
import { KING_ENCOUNTER, KING_REWARD, KING_TUNING } from './goldenKingFight.ts';
import { NALATI_STRIKE_ROWS } from './strikeProfiles.ts';

const root = resolve(import.meta.dirname, '../../../..');
const strikes = Object.fromEntries(Object.entries(NALATI_STRIKE_ROWS).map(([name, row]) =>
  [name, Array.isArray(row) ? row.map(value => strike(value)) : strike(row)]));
const writer = byteWriter(process.argv.includes('--check'), 'nalati-kurgan');
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/kurganLayout.generated.json'), jsonBytes(layout));
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/goldenKing.generated.json'), jsonBytes({
  profile: parseBossProfile(GOLDEN_KING_BOSS_PROFILE), encounter: KING_ENCOUNTER, reward: KING_REWARD, tuning: KING_TUNING,
}));
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/strikeProfiles.generated.json'), jsonBytes(strikes));
writer.finish();
