import { RowsSchema as GameRowsSchema, parseRows as gameParseRows, type ShardRows as GameShardRows } from '@wildshard/format/rows';
import { isJsonData as gameIsJsonData } from '@wildshard/format/json';
import { parseItems as gameParseItems, type ShardItems as GameShardItems } from '@wildshard/format/items';
import { parseClientChannels as gameParseClientChannels, type ClientChannelProgram as GameClientChannelProgram } from '@wildshard/format/clientChannels';
import { parseEliteFeature as gameParseEliteFeature, type EliteFeatureRows as GameEliteFeatureRows } from '@wildshard/format/eliteFeature';
import { parseSpawnScript as gameParseSpawnScript, spawnScriptRegistries as gameSpawnScriptRegistries, type SpawnScriptRows as GameSpawnScriptRows } from '@wildshard/format/spawnScripts';
import type { DecisionRegistries as GameDecisionRegistries } from '@wildshard/format/decisionBindings';
import { JournalRowSchema as GameJournalRowSchema, journalRowRules as gameJournalRowRules, type JournalRow as GameJournalRow } from '@wildshard/format/compendiumRows';
import { parseContractCatalogue as gameParseContractCatalogue, type ContractCatalogue as GameContractCatalogue } from '@wildshard/format/contracts';
import { parseAmbientLife as gameParseAmbientLife, type AmbientLifeData as GameAmbientLife } from '@wildshard/format/ambientLife';
import { parsePageLife as gameParsePageLife, type PageLifeRows as GamePageLifeRows } from '@wildshard/format/pageLife';
import { PopulationEnvironmentSchema as GamePopulationEnvironmentSchema, type PopulationEnvironmentRows as GamePopulationEnvironment } from '@wildshard/format/populationEnvironment';
import { FigureCatalogueSchema as GameFigureCatalogueSchema, type FigureCatalogueRow as GameFigureCatalogue } from '@wildshard/format/figures';
import * as v from 'valibot';
import { ItemCatalogue } from '@wildshard/game/loadout/itemCatalogue';

/** Resolve admitted equipment presentation without lending a catalogue or weapon service. */
export function equipmentRows(input: unknown, id: string): ReturnType<ItemCatalogue['equipment']> { return new ItemCatalogue(input).equipment(id); }

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
/** A spawn script's admitted rows (its ABI-1 script, slots, sites, strikes and moves), as the decision compiler reads them. */
export type SpawnScript = GameSpawnScriptRows;
/** Admit an authored spawn script; the decision compiler builds its module from these rows (spawnRegistries). */
export function parseSpawnScript(input: unknown): SpawnScript { return gameParseSpawnScript(input); }
/** A decision script's registry ids by kind. */
export type DecisionRegistries = GameDecisionRegistries;
/** One admitted compendium journal row. */
export type JournalRow = GameJournalRow;
/** Validate a journal row and its cross references before it is serialized (GR8: a shard program calls this). */
export function parseJournalRow(input: unknown): JournalRow {
  const row = v.parse(GameJournalRowSchema, input), errors = gameJournalRowRules(row);
  if (errors.length > 0) throw new Error(errors.join(', '));
  return row;
}
/** One admitted contract catalogue (the board's rows and its programme row). */
export type ContractCatalogue = GameContractCatalogue;
/** Validate a contract catalogue before it is serialized (GR8: a shard program calls this instead of a bake script). */
export function parseContractCatalogue(input: unknown): ContractCatalogue { return gameParseContractCatalogue(input); }
/** One admitted forest community (a shard's ambient life policy). */
export type AmbientLife = GameAmbientLife;
/** Validate an ambient life policy before its page rows are built. */
export function parseAmbientLife(input: unknown): AmbientLife { return gameParseAmbientLife(input); }
/** One page's admitted life rows (flocks, foragers, carcasses, guide, harvest). */
export type PageLifeRows = GamePageLifeRows;
/** Validate a page's life rows before they are serialized (GR8: a shard program calls this). */
export function parsePageLife(input: unknown): PageLifeRows { return gameParsePageLife(input); }
/** One admitted population environment (the habitat a roster's herds read). */
export type PopulationEnvironment = GamePopulationEnvironment;
/** Validate a population environment before it is serialized (GR8: a shard program calls this). */
export function parsePopulationEnvironment(input: unknown): PopulationEnvironment { return v.parse(GamePopulationEnvironmentSchema, input); }
/** One admitted figure catalogue (people's figures, anchors, skins and cards). */
export type FigureCatalogue = GameFigureCatalogue;
/** Validate a figure catalogue before it is serialized (GR8: a shard program calls this). */
export function parseFigureCatalogue(input: unknown): FigureCatalogue { return v.parse(GameFigureCatalogueSchema, input); }
