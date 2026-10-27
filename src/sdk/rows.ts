import { RowsSchema as GameRowsSchema, parseRows as gameParseRows, type ShardRows as GameShardRows } from '@wildshard/format/rows';
import { isJsonData as gameIsJsonData } from '@wildshard/format/json';
import { parseItems as gameParseItems, type ShardItems as GameShardItems } from '@wildshard/format/items';
import { parseClientChannels as gameParseClientChannels, type ClientChannelProgram as GameClientChannelProgram } from '@wildshard/format/clientChannels';

/** Numeric row declarations and registered view/presentation recipes. */
export type ShardRows = GameShardRows;
/** Validate row declarations without renderer or runtime code. */
export const RowsSchema: typeof GameRowsSchema = GameRowsSchema;
/** Parse author rows before JSON serialization can erase invalid closures. */
export function parseRows(input: unknown): ShardRows { return gameParseRows(input); }
/** Independent data-only check for functions, accessors, cycles and lossy JSON values. */
export function isJsonData(input: unknown): boolean { return gameIsJsonData(input); }
/** An admitted item catalogue (the `items` section). */
export type ShardItems = GameShardItems;
/** Validate an item catalogue before it is serialized (GR8: a shard program calls this instead of a bake script). */
export function parseItems(input: unknown): ShardItems { return gameParseItems(input); }
/** One admitted client channel program. */
export type ClientChannelProgram = GameClientChannelProgram;
/** Validate client channel programs before they are serialized. */
export function parseClientChannels(input: unknown): ClientChannelProgram[] { return gameParseClientChannels(input); }
