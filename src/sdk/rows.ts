import { RowsSchema as GameRowsSchema, parseRows as gameParseRows, type ShardRows as GameShardRows } from '@wildshard/format/rows';
import { isJsonData as gameIsJsonData } from '@wildshard/format/json';
import { parseItems as gameParseItems, type ShardItems as GameShardItems } from '@wildshard/format/items';
import { parseClientChannels as gameParseClientChannels, type ClientChannelProgram as GameClientChannelProgram } from '@wildshard/format/clientChannels';
import { parseEliteFeature as gameParseEliteFeature, type EliteFeatureRows as GameEliteFeatureRows } from '@wildshard/format/eliteFeature';
import { spawnScriptRegistries as gameSpawnScriptRegistries } from '@wildshard/format/spawnScripts';
import type { DecisionRegistries as GameDecisionRegistries } from '@wildshard/format/decisionBindings';

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
/** One admitted elite encounter feature (its fights and their spawn programs). */
export type EliteFeature = GameEliteFeatureRows;
/** Validate an elite feature before it is serialized or its fights compiled. */
export function parseEliteFeature(input: unknown): EliteFeature { return gameParseEliteFeature(input); }
/** The registry ids a spawn program's generated ABI header uses (GR8: a shard program compiles its guests with them). */
export function spawnRegistries(program: Parameters<typeof gameSpawnScriptRegistries>[0]): DecisionRegistries { return gameSpawnScriptRegistries(program); }
/** A decision script's registry ids by kind. */
export type DecisionRegistries = GameDecisionRegistries;
