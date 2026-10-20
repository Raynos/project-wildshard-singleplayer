// Retain the shipping encounter arithmetic offline; native owners consume only admitted JSON.
import { resolve } from 'node:path';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { parseBossProfile } from '@wildshard/format/bossProfiles';
import { strike } from '@wildshard/sdk/species';
import * as layout from './kurganLayout.ts';
import { GOLDEN_KING_BOSS_PROFILE } from './goldenKingArena.ts';
import { KING_ENCOUNTER, KING_REWARD, KING_TUNING } from './goldenKingFight.ts';
import { GOLDEN_KING_POSE } from './goldenKingPose.ts';
import { NALATI_STRIKE_ROWS } from './strikeProfiles.ts';

const root = resolve(import.meta.dirname, '../../../..');
const strikes = Object.fromEntries(Object.entries(NALATI_STRIKE_ROWS).map(([name, row]) =>
  [name, Array.isArray(row) ? row.map(value => strike(value)) : strike(row)]));
const writer = byteWriter(process.argv.includes('--check'), 'nalati-kurgan');
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/kurganLayout.generated.json'), jsonBytes(layout));
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/goldenKing.generated.json'), jsonBytes({
  profile: parseBossProfile(GOLDEN_KING_BOSS_PROFILE), encounter: KING_ENCOUNTER, reward: KING_REWARD, tuning: KING_TUNING,
  page: { profile: GOLDEN_KING_BOSS_PROFILE, body: 'nalati.golden-king', identity: 'runtime',
    add: { kind: 'balbal', variant: 'warrior', memory: { floorY: layout.DUNGEON.y, emergeT: 1.9,
      minX: layout.DUNGEON.x - layout.CH + .9, maxX: layout.DUNGEON.x + layout.CH - .9,
      minZ: layout.DUNGEON.z - layout.CH + .9, maxZ: layout.DUNGEON.z + layout.CH - .9 } },
    damageTag: 'boss.golden-king', maxZ: layout.DUNGEON.z + layout.CH - 1.1,
    reward: [layout.DUNGEON.x + layout.PEDESTAL.x, layout.DUNGEON.y + layout.PEDESTAL.h + .02, layout.DUNGEON.z + layout.PEDESTAL.z],
    respawn: [layout.DUNGEON.x + layout.CHECKPOINT.x, layout.DUNGEON.y, layout.DUNGEON.z + layout.CHECKPOINT.z], yaw: layout.CHECKPOINT.yaw,
    presentation: { reach: KING_TUNING.reach, ringMax: KING_TUNING.ringMax, beamRadius: KING_TUNING.beamRadius },
    cuts: strikes.cuts, hazards: { sunburst: strikes.sunburst, sand: strikes.sand, beam: strikes.beam } },
}));
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/strikeProfiles.generated.json'), jsonBytes(strikes));
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/goldenKingPose.generated.json'), jsonBytes(GOLDEN_KING_POSE));
writer.finish();
