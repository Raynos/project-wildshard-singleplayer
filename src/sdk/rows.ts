import { RowsSchema as GameRowsSchema, parseRows as gameParseRows, speciesResolver as gameSpeciesResolver, simStrikes as gameSimStrikes, type ShardRows as GameShardRows } from '@wildshard/game/shardfile/rows';
import { isJsonData as gameIsJsonData } from '@wildshard/game/shardfile/json';

/** Numeric row declarations and registered view/presentation recipes. */
export type ShardRows = GameShardRows;
/** Validate row declarations without renderer or runtime code. */
export const RowsSchema: typeof GameRowsSchema = GameRowsSchema;
/** Parse author rows before JSON serialization can erase invalid closures. */
export function parseRows(input: unknown): ShardRows { return gameParseRows(input); }
/** Independent data-only check for functions, accessors, cycles and lossy JSON values. */
export function isJsonData(input: unknown): boolean { return gameIsJsonData(input); }
/** Resolve declared variant health, collision dimensions and motion multipliers. */
export const speciesResolver: typeof gameSpeciesResolver = gameSpeciesResolver;
/** Numeric strike catalogue suitable for the authoritative sim. */
export const simStrikes: typeof gameSimStrikes = gameSimStrikes;
