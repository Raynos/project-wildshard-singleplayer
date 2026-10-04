import { DATA_LOOK_DAY, dataLook } from '@wildshard/engine/render/dataLook';
import type { LookStrategy } from '@wildshard/engine/render/look';
import type { Shardfile } from './schema';

/**
 * A shardfile's file reference → its URL: products sit beside the page that embeds `shard.json` (the SDK build writes
 * local and commons files under their hash), so the reference resolves against the document.
 */
export function shardfileFileUrl(ref: string): string { return `./${ref.replace(/^commons:/u, '')}`; }

/** A shardfile's look section → the engine's data look (SF10b): its day keys on the engine clock and its LUT file. */
export function shardfileLook(look: Shardfile['look']): LookStrategy {
  return dataLook({ day: look.day ?? DATA_LOOK_DAY, dayOverride: look.dayOverride, keys: look.keys, lut: look.grade.lut === null ? null : shardfileFileUrl(look.grade.lut) });
}
