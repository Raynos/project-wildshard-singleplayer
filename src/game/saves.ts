import * as v from 'valibot';
import { app, type SaveSlot } from '#engine';
import type { ShardSlug } from './shard/shards.generated';

const finite = v.pipe(v.number(), v.finite());
const numbers = v.record(v.string(), finite);
const strings = v.array(v.string());
const define = <S extends v.GenericSchema>(key: string, schema: S, initial: () => v.InferOutput<S>): SaveSlot<v.InferOutput<S>> => app.saves.define({ key, scope: 'shard', version: 1, schema, initial });
export const progressSave = define('progress', v.object({ counts: numbers, earned: strings, title: v.nullable(v.string()), playS: v.optional(finite, 0) }), () => ({ counts: {}, earned: [], title: null, playS: 0 }));
export const inventorySave = define('inventory', v.object({ counts: numbers, order: strings }), () => ({ counts: {}, order: [] }));
export const purseSave = define('purse', v.pipe(finite, v.minValue(0)), () => 0);
export const ownedSave = define('owned', v.object({ owned: strings, worn: strings }), () => ({ owned: [], worn: [] }));
export const bountySave = define('bounty', numbers, () => ({}));
export const compendiumSave = define('compendium', v.record(v.string(), v.object({ s: finite, n: finite, t: finite, b: finite })), () => ({}));
export const bossesSave = define('bosses', v.record(v.string(), v.object({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: finite })), () => ({}));
export const elitesSave = define('elites', v.record(v.string(), v.object({ timer: finite, discovered: v.boolean(), skinTaken: v.boolean(), kills: finite, retired: v.boolean() })), () => ({}));
/** The public game wrapper constrains saves to the generated registry's slug union. */
export function shardSave<T>(slot: SaveSlot<T>, slug: ShardSlug): { read: () => T; write: (data: T) => void; reset: () => void } {
  return { read: () => slot.read(slug), write: (data) => { slot.write(data, slug); }, reset: () => { slot.reset(slug); } };
}
/** Legacy actor APIs accept strings until their shard phase; normalize the old identifier at this boundary. */
export function saveSlug(id: string): string { return id.replace(/^chunk:\/\/local\//u, ''); }
