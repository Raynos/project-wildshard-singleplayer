import * as v from 'valibot';
import { TraversalSchema as schema, parseTraversal as parseData, type ShardTraversal as Data } from '@wildshard/game/shardfile/traversal';
/** Optional author tuning for the grid's interior board cap. */
export const TraversalSchema = v.pipe(schema);
/** Callback-free interior traversal tuning. */
export type ShardTraversal = Data;
/** Compile a lowered interior cap, bounded by the platform's 15 m/s ceiling. */
export function parseTraversal(input: unknown): Data { return parseData(input); }
