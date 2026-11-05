import * as v from 'valibot';
import type { BossSaved } from '@wildshard/engine/ai/BossBrain';

/** A boss row's two durable flags: beaten (its record's `defeated`) and paid (its record's `rewardTaken`). */
export interface BossRowFlagNames { readonly defeated: string; readonly paid: string }
/** The shard flags a boss record reads and writes. */
export interface BossRowFlags { has: (flag: string) => boolean; set: (flag: string) => void }

/** A boss row's record kept on the shard's own flags (no save of its own): `saved` to start from, `persist` to write. */
export function bossFlagRecord(flags: BossRowFlags, names: BossRowFlagNames): { saved: BossSaved; persist: (value: BossSaved) => void } {
  const defeated = flags.has(names.defeated);
  return { saved: { defeated, rewardTaken: flags.has(names.paid), kills: defeated ? 1 : 0 },
    persist: (value) => { if (value.defeated) flags.set(names.defeated); if (value.rewardTaken) flags.set(names.paid); } };
}

const finite = v.pipe(v.number(), v.finite());
const RecordSchema = v.strictObject({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: v.pipe(finite, v.integer(), v.minValue(0)) });
/** Strict shared durable record, including the original ordered JSON fields. */
export function parseBossRecord(input: unknown): BossSaved { return v.parse(RecordSchema, input); }
/** Browser record policy; the state owner or flags remain the sole writer. */
export type BossRecordRow = { readonly kind: 'state'; readonly key: string; readonly actor: string; readonly jsonError: string; readonly writeError: string }
  | { readonly kind: 'flags'; readonly names: BossRowFlagNames; readonly actor: string };
