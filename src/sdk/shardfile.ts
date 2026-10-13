import * as v from 'valibot';
import { ShardfileSchema as GameSchema, parseShardfile as parse, shardfileRules as rules, type Shardfile as GameShardfile } from '@wildshard/format/shardSchema';
import { assertStateCompatibility as assertCompatibility } from '@wildshard/format/product';

/** Author-facing serialisable renderer-neutral shardfile contract. */
export type Shardfile = GameShardfile;
/** Author-facing strict schema, sharing the client's validator without a barrel.
 * Its explicit contract also bounds composite declaration emission as new sections are added. */
export const ShardfileSchema: v.GenericSchema<unknown, Shardfile> = v.pipe(GameSchema);
/** Parse untrusted author output using the same contract as the client. */
export function parseShardfile(input: unknown): Shardfile { return parse(input); }
/** Inspect semantic author errors using the client contract. */
export function shardfileRules(input: Shardfile): string[] { return rules(input); }
/** Refuse saved-state identity changes between two validated revisions of the same shard. */
export function assertStateCompatibility(previous: Shardfile, next: Shardfile): void { assertCompatibility(previous, next); }
