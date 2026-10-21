import { DeclaredBodyOpsSchema, type DeclaredBodyOpsRows } from './bodySlots';
import {StealthRowsSchema,type StealthRows} from './stealth';
import { PaintedLookSchema, type PaintedLookRow } from './paintedLook';
import { ColourFunctionBookSchema, type ColourFunctionBook } from './colourFunction';
import { RiggedHullBookSchema, type RiggedHullBook } from './riggedHulls';
import { HullLookBookSchema, type HullLookBookRows } from './speciesLooks';
import { ExplorerCatalogueSchema, type ExplorerCatalogue } from './explorerCatalogue';
import { ToonLookSchema, type ToonLookRow } from './toonLook';
import { KEYED_SKY, type KeyedSkyStyle } from './keyedSky';
import { ClientPlanSchema, type ClientPlan } from './clientPlan';
import { SpawnScriptsSchema, type SpawnScriptRows } from './spawnScripts';
import { WorldScenesSchema, type WorldScenesSection } from './worldScenes';
import { HeldArmsSchema, type HeldArmsRows } from './heldArms';
import { LoadoutSchema, type LoadoutRows } from './loadout';
import { HeldFinishesSchema, type HeldFinishesRows } from './heldFinishes';
import { HeldGearSchema, type HeldGearRows } from './heldGear';
import * as v from 'valibot';
import { HeldEquipmentSchema, type HeldEquipmentRows } from './heldEquipment';
import { CompletionSchema, type CompletionRows } from './completion';
import { SpeciesProgramsSchema, type SpeciesPrograms } from './speciesPrograms';
import { CreatureStrikesSchema, type CreatureStrikes } from './creatures';
import { ActorMovesSchema, type ActorMoves } from './actorMoves';
import { DecisionScriptsSchema, type DecisionScripts } from './decisionScripts';
import { UiStringsSchema, type UiStrings } from './uiStrings';
import { WorldPhysicsSchema, type WorldPhysics } from './worldPhysics';
import { WorldTargetsSchema, type WorldTargets } from './worldTargets';
import { NativeRuntimePlanSchema, type NativeRuntimePlanData } from './nativeRuntimePlan';

/** New plain-value sections supplement the unchanged v1 model assembled from the older section envelopes. */
export interface PlatformDataSections {
  'player/stealth':StealthRows;
  'explore/catalogue': ExplorerCatalogue;
  'look/rigged-hulls': RiggedHullBook;
  'look/hull-book': HullLookBookRows;
  'look/toon': ToonLookRow;
  'look/painted': PaintedLookRow;
  'look/colour-functions': ColourFunctionBook;
  'look/keyed-sky': KeyedSkyStyle;
  'client/plan': ClientPlan;
  'held/arms': HeldArmsRows;
  'held/gear': HeldGearRows;
  'held/finishes': HeldFinishesRows;
  'held/loadout': LoadoutRows;
  'held/equipment': HeldEquipmentRows;
  'ui/completion': CompletionRows;
  'sim/runtime-plan': NativeRuntimePlanData;
  'actors/species-programs': SpeciesPrograms;
  'actors/moves': ActorMoves;
  'actors/spawn-scripts': SpawnScriptRows[];
  'actors/return-scripts': DecisionScripts;
  'actors/strikes': CreatureStrikes;
  'sim/scripts': DecisionScripts;
  'sim/bodies': DeclaredBodyOpsRows;
  'ui/strings': UiStrings;
  'world/physics': WorldPhysics;
  'world/targets': WorldTargets;
  'world/scenes': WorldScenesSection;
}

/** Defining parsers for the first independently authored platform sections. */
export const PLATFORM_DATA_SECTIONS: Readonly<{ [Name in keyof PlatformDataSections]: { readonly schema: v.GenericSchema<unknown, PlatformDataSections[Name]> } }> = {
  'player/stealth':{schema:StealthRowsSchema},
  'explore/catalogue': { schema: ExplorerCatalogueSchema },
  'look/rigged-hulls': { schema: RiggedHullBookSchema },
  'look/hull-book': { schema: HullLookBookSchema },
  'look/toon': { schema: ToonLookSchema },
  'look/painted': { schema: PaintedLookSchema },
  'look/colour-functions': { schema: ColourFunctionBookSchema },
  'look/keyed-sky': { schema: KEYED_SKY },
  'client/plan': { schema: ClientPlanSchema },
  'held/arms': { schema: HeldArmsSchema },
  'held/gear': { schema: HeldGearSchema },
  'held/finishes': { schema: HeldFinishesSchema },
  'held/loadout': { schema: LoadoutSchema },
  'held/equipment': { schema: HeldEquipmentSchema },
  'ui/completion': { schema: CompletionSchema },
  'sim/runtime-plan': { schema: NativeRuntimePlanSchema },
  'actors/species-programs': { schema: SpeciesProgramsSchema },
  'actors/moves': { schema: ActorMovesSchema },
  'actors/spawn-scripts': { schema: SpawnScriptsSchema },
  'actors/return-scripts': { schema: DecisionScriptsSchema },
  'actors/strikes': { schema: CreatureStrikesSchema },
  'sim/scripts': { schema: DecisionScriptsSchema },
  'sim/bodies': { schema: DeclaredBodyOpsSchema },
  'ui/strings': { schema: UiStringsSchema },
  'world/physics': { schema: WorldPhysicsSchema },
  'world/targets': { schema: WorldTargetsSchema },
  'world/scenes': { schema: WorldScenesSchema },
} as const;

/** An explicitly declared new platform-section name; no shard-private name is inferred. */
export type PlatformDataSectionName = keyof PlatformDataSections;

/** Parse the named section without treating its plain payload as fields of the v1 Shardfile. */
export function parsePlatformDataSection(name:'player/stealth',value:unknown):StealthRows;
export function parsePlatformDataSection(name: 'explore/catalogue', value: unknown): ExplorerCatalogue;
export function parsePlatformDataSection(name: 'look/rigged-hulls', value: unknown): RiggedHullBook;
export function parsePlatformDataSection(name: 'look/hull-book', value: unknown): HullLookBookRows;
export function parsePlatformDataSection(name: 'look/toon', value: unknown): ToonLookRow;
export function parsePlatformDataSection(name: 'look/painted', value: unknown): PaintedLookRow;
export function parsePlatformDataSection(name: 'look/colour-functions', value: unknown): ColourFunctionBook;
export function parsePlatformDataSection(name: 'look/keyed-sky', value: unknown): KeyedSkyStyle;
export function parsePlatformDataSection(name: 'client/plan', value: unknown): ClientPlan;
export function parsePlatformDataSection(name: 'held/arms', value: unknown): HeldArmsRows;
export function parsePlatformDataSection(name: 'held/loadout', value: unknown): LoadoutRows;
export function parsePlatformDataSection(name: 'held/finishes', value: unknown): HeldFinishesRows;
export function parsePlatformDataSection(name: 'held/gear', value: unknown): HeldGearRows;
export function parsePlatformDataSection(name: 'held/equipment', value: unknown): HeldEquipmentRows;
export function parsePlatformDataSection(name: 'actors/species-programs', value: unknown): SpeciesPrograms;
export function parsePlatformDataSection(name: 'actors/moves', value: unknown): ActorMoves;
export function parsePlatformDataSection(name: 'actors/strikes', value: unknown): CreatureStrikes;
export function parsePlatformDataSection(name: 'actors/spawn-scripts', value: unknown): SpawnScriptRows[];
export function parsePlatformDataSection(name: 'actors/return-scripts' | 'sim/scripts', value: unknown): DecisionScripts;
export function parsePlatformDataSection(name: 'sim/bodies', value: unknown): DeclaredBodyOpsRows;
export function parsePlatformDataSection(name: 'ui/completion', value: unknown): CompletionRows;
export function parsePlatformDataSection(name: 'ui/strings', value: unknown): UiStrings;
export function parsePlatformDataSection(name: 'world/physics', value: unknown): WorldPhysics;
export function parsePlatformDataSection(name: 'world/scenes', value: unknown): WorldScenesSection;
export function parsePlatformDataSection(name: 'world/targets', value: unknown): WorldTargets;
export function parsePlatformDataSection(name: 'sim/runtime-plan', value: unknown): NativeRuntimePlanData;
export function parsePlatformDataSection(name: PlatformDataSectionName, value: unknown): PlatformDataSections[PlatformDataSectionName];
export function parsePlatformDataSection(name: PlatformDataSectionName, value: unknown): PlatformDataSections[PlatformDataSectionName] {
  return v.parse(PLATFORM_DATA_SECTIONS[name].schema, value);
}
