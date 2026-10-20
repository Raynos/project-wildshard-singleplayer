import { RoamingCombatSchema } from '@wildshard/format/roamingCombat';
import { PopulationProjectionSchema } from '@wildshard/format/populationProjection';
import { SceneDressingSchema } from '@wildshard/format/sceneDressing';
import { CueDirectorWireSchema } from '@wildshard/format/cueDirector';
import { ExchangeSchema } from '@wildshard/format/exchange';
import { ContractCatalogueSchema } from '@wildshard/format/contracts';
import { AchievementCounterDataSchema } from '@wildshard/format/achievementCounters';
import { PopulationShelterSchema } from '@wildshard/format/herdShelter';
import { PanelDefinitionSchema } from '@wildshard/format/panelTemplate';
import { HeldFinishesSchema } from '@wildshard/format/heldFinishes';
import { FigureCatalogueSchema } from '@wildshard/format/figures';
import { QuestStorySchema } from '@wildshard/format/questStory';
import { WeatherProgramSchema } from '@wildshard/format/weatherProgram';
import { NativePopulationRowsSchema } from '@wildshard/format/populationRoster';
import { ChapterDirectorSchema } from '@wildshard/format/chapterDirector';
import { EliteFeatureSchema } from '@wildshard/format/eliteFeature';
import { CoverAppearanceSchema } from '@wildshard/format/coverAppearance';
import { PageLifeSchema } from '@wildshard/format/pageLife';
import { InputActionSchema, InputKeysSchema } from '@wildshard/format/inputDeclarations';
import { BodySlotsSchema } from '@wildshard/format/bodySlots';
import { LimbRigSchema, LimbBlendSchema, BakedClipTable } from '@wildshard/format/limbRig';
import { LimbCollisionBake } from '@wildshard/format/limbCollision';
import { ToonArmsLookSchema } from '@wildshard/format/heldArms';
import { RoamingEncounterSchema, WakeEncounterSchema, BossEncounterPresentationSchema, NativeBossBindingSchema } from '@wildshard/format/bossEncounter';
import { BossProfileSchema, ArenaBossProfileSchema, RoamingBossProfileSchema, SpawnedBossProfileSchema, HeldBossProfileSchema, ScriptBossProfileSchema } from '@wildshard/format/bossProfiles';
import { NpcRowSchema, NpcMotionSchema, NpcDialogueRowSchema, QuestNpcBindingSchema, QuestNpcBindingsSchema } from '@wildshard/format/npcs';
import { WeaponProfileSchema, MeleeWeaponProfileSchema, BowWeaponProfileSchema, FirearmWeaponProfileSchema, ThrownWeaponProfileSchema, LashWeaponProfileSchema, ConeWeaponProfileSchema, HeldBowBaseSchema, HeldBowRowsSchema, HeldBowDefinitionSchema } from '@wildshard/format/weaponProfiles';
import { toJsonSchema, type JsonSchema } from '@valibot/to-json-schema';
import { finite, type GenericSchema } from 'valibot';
import { EdgeProfileSchema, EdgeProfilesSchema } from '@wildshard/format/edgeProfiles';
import { PlumbingSchema } from '@wildshard/format/plumbing';
import { StateSchema } from '@wildshard/format/state';
import { QuestStepRowsSchema, QuestServiceActionsSchema, QuestKillRowsSchema, QuestHintRowsSchema } from '@wildshard/format/questSteps';
import { SpeciesSchema } from '@wildshard/format/speciesPrograms';
import { BakedBuildingLookSchema, BuildingLifeLookSchema, BuildingLifeRowsSchema } from '@wildshard/format/buildings';
import { WorldSceneWeldSchema } from '@wildshard/format/worldSceneWeld';
import { WorldSceneModelsSchema } from '@wildshard/format/worldSceneModels';
import { WorldScenePlacementSchema } from '@wildshard/format/worldScenePlacement';
import { CommonsCostsSchema } from '@wildshard/format/commonsCosts';
import { SHARDFILE_ADMISSION_LIMITS } from '@wildshard/format/admissionLimits';

import { StalkerSchema, GuardianPatternsSchema, SkirmisherSchema, ScriptBrainSchema, GuardianSchema, PerchHunterSchema } from '@wildshard/format/brains';
import { DiverSchema, OrbitDiverSchema, PatrolDiverSchema, BurstFlyerSchema } from '@wildshard/format/flyers';
import { RamGrazerSchema, ChallengeGrazerSchema, GrazerSchema } from '@wildshard/format/grazers';
import { GroupBrainSchema } from '@wildshard/format/groupBrains';
import { CreaturesSchema, CreatureHomeSchema } from '@wildshard/format/creatures';
import { FlockSchema } from '@wildshard/format/crowds';
import { EncountersSchema } from '@wildshard/format/encounters';
import { AudioMusicSchema, AudioSamplesSchema, AudioZonesSchema } from '@wildshard/format/audioProfiles';
import { AudioRoutingSchema } from '@wildshard/format/audioRouting';
import { AudioDataSchema } from '@wildshard/format/audio';
import { LedgerFactSchema, LedgerRulesSchema } from '@wildshard/format/ledger';
import { DirectorSchema } from '@wildshard/format/director';
import { DirectorStagesSchema } from '@wildshard/format/directorStages';
import { LogicalStateSchema, MigrationsSchema } from '@wildshard/format/migrations';
import { TraversalSchema } from '@wildshard/format/traversal';
import { RuntimeBindsSchema } from '@wildshard/format/runtimeBinds';
import { RuntimeSpawnsSchema } from '@wildshard/format/runtimeSpawns';
import { SkinPoseLayerSchema } from '@wildshard/format/skinLayers';
import { PresentationSchema } from '@wildshard/format/presentation';
import { MeshCollisionSchema } from '@wildshard/format/meshCollision';
import { ScriptBindingsSchema } from '@wildshard/format/scripts';
import { ActorMovesSchema } from '@wildshard/format/actorMoves';
import { DecisionScriptsSchema } from '@wildshard/format/decisionScripts';
import { HooksSchema } from '@wildshard/format/hooks';
import { TerrainSchema } from '@wildshard/format/terrain';
import { WaterSchema } from '@wildshard/format/water';
import { AccentSchema, ACCENT_IDS } from '@wildshard/format/accent';
import { ItemsSchema, ItemFamilyNameSchema } from '@wildshard/format/items';
import { TargetsSchema } from '@wildshard/format/targets';
import { QuestDataSchema } from '@wildshard/format/quests';
import { QuestGraphSchema } from '@wildshard/format/questGraph';
import { InteractionRowsSchema, QuestPageInteractionsSchema } from '@wildshard/format/questInteractions';
import { QuestHostSchema } from '@wildshard/format/questHost';

import { RowsSchema } from '@wildshard/format/rows';
import { MoversSchema } from '@wildshard/format/movers';
import { ModesSchema, ZiplineModeSchema, UpdraftModeSchema, RideGaitsSchema, RideModeSchema, GrappleModeSchema, TraverseModeSchema } from '@wildshard/format/modes';
import { MoverMotionSchema, MoverTrackSchema, MoverTriggerSchema, MoverDriverSchema } from '@wildshard/format/moverMotion';
import { SocketLiftSchema } from '@wildshard/format/socketLift';
import { PortalLinkSchema } from '@wildshard/format/portalLink';
import { EntrywaysSchema } from '@wildshard/format/entryways';
import { NavigationSchema } from '@wildshard/format/navigation';
import { NativeGroundSchema } from '@wildshard/format/nativeGround';
import { UiSchema } from '@wildshard/format/ui';
import { ClientScriptsSchema } from '@wildshard/format/clientScripts';
import { ClientChannelsSchema, ClientChannelProgramSchema, PrivateSceneSchema, WorldSceneSchema, NumericPoseSchema } from '@wildshard/format/clientChannels';

import { ForestLifeSchema } from '@wildshard/format/ambientLife';

import { MemoryMeasurementSchema, RuntimeCostSchema, RegionalSimCostSchema } from '@wildshard/format/runtimeCost';
import { RuntimeSchema } from '@wildshard/format/runtime';
import { ClientCheckpointSchema, ItemCheckpointStatesSchema, LogicalClientCheckpointSchema } from '@wildshard/format/clientState';
import { LiftRiderSchema } from '@wildshard/format/liftRider';
import { WeaponHooksSchema } from '@wildshard/format/weaponHooks';
import { ScriptSpeciesSchema } from '@wildshard/format/speciesScripts';
import { EliteScriptSchema } from '@wildshard/format/eliteScripts';
import { SkinLookParametersSchema, SkinClipParametersSchema, ShardSkinFileSchema } from '@wildshard/format/skins';
import { SkinClipNameSchema, SkinRowSchema, SkinBindingSchema } from '@wildshard/format/skinData';

import { ShardNaturalSchema, ShardFiniteSchema, ShardHashSchema, ShardReferenceSchema, ShardReferencesSchema, ShardNamesSchema, CellBoundsSchema, IdentitySchema, RequiresSchema, BudgetsSchema, SimSchema, AuthorCapsSchema, ServerBudgetSchema, FilesSchema, TilesSchema, LibrarySchema, CriticalSchema, FarSchema, SpawnSchema } from '@wildshard/format/shardSections';

/** JSON Schema plus explicit admission checks that JSON Schema cannot express. */
export interface FormatJsonSchema extends JsonSchema {
  'x-wildshard-checks'?: string[];
  'x-wildshard-string-length'?: 'utf16-code-units';
}

const plumbing = PlumbingSchema.pipe[2];
const input = plumbing.entries.input.pipe[0].item;
const debug = plumbing.entries.debug.pipe[0].item;
// These identities are the defining schemas, not message-based permissions for arbitrary author code.
const customSchemas = new Map<object, JsonSchema>([
  [InputActionSchema.options[1], { type: 'string', maxLength: 128, pattern: '^[a-z][a-zA-Z0-9-]*(?:\\.[a-zA-Z0-9-]+)+$' }],
  [input.entries.id, { type: 'string', maxLength: 128, pattern: '^[a-z][a-z0-9-]*(?:\\.[a-z][a-zA-Z0-9-]*)+$' }],
  [debug.entries.ask, { type: 'string', pattern: '^E[1-9][0-9]*$' }],
]);
// Exact fixed-palette validator; a caller's new custom schema receives no bridge.
customSchemas.set(AccentSchema.pipe[2], { type: 'string', enum: [...ACCENT_IDS] });
// Template-literal item identities keep their exact native predicates; only these defining schema objects bridge.
const itemRows = ItemsSchema.pipe[2].entries.rows.pipe[0].item;
const weaponRow = itemRows.options[0], toolRow = itemRows.options[1];
customSchemas.set(weaponRow.entries.id, { type: 'string', maxLength: 128, pattern: '^weapon\\.[a-z][a-zA-Z0-9.-]*$' });
customSchemas.set(toolRow.entries.id, { type: 'string', maxLength: 128, pattern: '^tool\\.[a-z][a-zA-Z0-9.-]*$' });
customSchemas.set(weaponRow.entries.slot, { type: 'string', maxLength: 128, pattern: '^declared\\.weapon\\.[a-z][a-zA-Z0-9.-]*$' });
customSchemas.set(weaponRow.entries.light.entries.tags.pipe[0].item, { type: 'string', maxLength: 128, pattern: '^[a-z][a-zA-Z0-9.-]*\\.[a-zA-Z0-9.-]+$' });
customSchemas.set(ConeWeaponProfileSchema.entries.gust.entries.tags.pipe[0].item, { type: 'string', maxLength: 128, pattern: '^[a-z][a-zA-Z0-9.-]*\\.[a-zA-Z0-9.-]+$' });
customSchemas.set(weaponRow.entries.light.entries.effect.wrapped, { type: 'string', pattern: '^effect\\.[a-z][a-zA-Z0-9.-]*$' });
customSchemas.set(toolRow.entries.action.wrapped, { type: 'string', pattern: '^[a-z][a-zA-Z0-9.-]*\\.[a-zA-Z0-9.-]+$' });
// The namespaced combat tag validator is the exact defining row object.
customSchemas.set(RowsSchema.pipe[2].entries.strikes.pipe[0].item.entries.tags.pipe[0].item, { type: 'string', maxLength: 128, pattern: '^[a-z][a-zA-Z0-9.-]*\\.[a-zA-Z0-9.-]+$' });
const unicodeRegexes = new Set<object>([
  plumbing.entries.namespace.pipe[1],
  InputKeysSchema.pipe[0].item.pipe[1],
  debug.entries.reviewBy.pipe[1],
]);
const stateField = StateSchema.pipe[0].entries.shared.pipe[0].item;
unicodeRegexes.add(stateField.entries.name.pipe[1]);
unicodeRegexes.add(CommonsCostsSchema.pipe[0].key.pipe[1]);
const edge = EdgeProfileSchema.pipe[0];
const finiteNumbers = new Set<object>([
  edge.entries.heights.item.pipe[1],
  stateField.entries.default.options[1].pipe[1],
  ...edge.entries.colours.item.items.map(channel => channel.pipe[1]),
]);

// Only the exact retained defining roots grant action bridges. A caller's new check or transform never joins.
const wireRoots: Readonly<Record<string, GenericSchema>> = {
  'roamingCombat.RoamingCombat': RoamingCombatSchema,
  'populationProjection.PopulationProjection': PopulationProjectionSchema,
  'sceneDressing.SceneDressing': SceneDressingSchema,
  'clientChannels.NumericPose': NumericPoseSchema,
  'questInteractions.QuestPageInteractions': QuestPageInteractionsSchema,
  'cueDirector.CueDirectorWire': CueDirectorWireSchema,
  'questSteps.QuestHintRows': QuestHintRowsSchema,
  'questSteps.QuestKillRows': QuestKillRowsSchema,
  'questSteps.QuestServiceActions': QuestServiceActionsSchema,
  'exchange.Exchange': ExchangeSchema,
  'contracts.ContractCatalogue': ContractCatalogueSchema,
  'achievementCounters.AchievementCounterData': AchievementCounterDataSchema,
  'herdShelter.PopulationShelter': PopulationShelterSchema,
  'panelTemplate.PanelDefinition': PanelDefinitionSchema,
  'heldFinishes.HeldFinishes': HeldFinishesSchema,
  'figures.FigureCatalogue': FigureCatalogueSchema,
  'questStory.QuestStory': QuestStorySchema,
  'weatherProgram.WeatherProgram': WeatherProgramSchema,
  'populationRoster.NativePopulationRows': NativePopulationRowsSchema,
  'chapterDirector.ChapterDirector': ChapterDirectorSchema,
  'eliteFeature.EliteFeature': EliteFeatureSchema,
  'coverAppearance.CoverAppearance': CoverAppearanceSchema,
  'pageLife.PageLife': PageLifeSchema,
  'worldSceneWeld.WorldSceneWeld': WorldSceneWeldSchema,
  'worldSceneModels.WorldSceneModels': WorldSceneModelsSchema,
  'worldScenePlacement.WorldScenePlacement': WorldScenePlacementSchema,
  'clientChannels.WorldScene': WorldSceneSchema,
  'buildings.BuildingLifeRows': BuildingLifeRowsSchema,
  'bodySlots.BodySlots': BodySlotsSchema,
  'limbRig.LimbRig': LimbRigSchema,
  'limbRig.LimbBlend': LimbBlendSchema,
  'limbRig.BakedClipTable': BakedClipTable,
  'limbCollision.LimbCollisionBake': LimbCollisionBake,
  'plumbing.Plumbing': PlumbingSchema,
  'heldArms.ToonArmsLook': ToonArmsLookSchema,
  'npcs.QuestNpcBinding': QuestNpcBindingSchema,
  'questHost.QuestHost': QuestHostSchema,
  'npcs.QuestNpcBindings': QuestNpcBindingsSchema,
  'npcs.NpcRow': NpcRowSchema,
  'npcs.NpcMotion': NpcMotionSchema,
  'npcs.NpcDialogueRow': NpcDialogueRowSchema,
  'bossProfiles.BossProfile': BossProfileSchema,
  'bossProfiles.ArenaBossProfile': ArenaBossProfileSchema,
  'bossProfiles.RoamingBossProfile': RoamingBossProfileSchema,
  'bossProfiles.SpawnedBossProfile': SpawnedBossProfileSchema,
  'bossProfiles.HeldBossProfile': HeldBossProfileSchema,
  'bossProfiles.ScriptBossProfile': ScriptBossProfileSchema,
  'bossEncounter.RoamingEncounter': RoamingEncounterSchema,
  'bossEncounter.WakeEncounter': WakeEncounterSchema,
  'bossEncounter.BossEncounterPresentation': BossEncounterPresentationSchema,
  'bossEncounter.NativeBossBinding': NativeBossBindingSchema,
  'weaponProfiles.WeaponProfile': WeaponProfileSchema,
  'weaponProfiles.MeleeWeaponProfile': MeleeWeaponProfileSchema,
  'weaponProfiles.BowWeaponProfile': BowWeaponProfileSchema,
  'weaponProfiles.FirearmWeaponProfile': FirearmWeaponProfileSchema,
  'weaponProfiles.ThrownWeaponProfile': ThrownWeaponProfileSchema,
  'weaponProfiles.LashWeaponProfile': LashWeaponProfileSchema,
  'weaponProfiles.ConeWeaponProfile': ConeWeaponProfileSchema,
  'weaponProfiles.HeldBowBase': HeldBowBaseSchema,
  'weaponProfiles.HeldBowRows': HeldBowRowsSchema,
  'weaponProfiles.HeldBowDefinition': HeldBowDefinitionSchema,
  'brains.Skirmisher': SkirmisherSchema,
  'brains.Stalker': StalkerSchema,
  'brains.ScriptBrain': ScriptBrainSchema,
  'brains.Guardian': GuardianSchema,
  'brains.GuardianPatterns': GuardianPatternsSchema,
  'brains.PerchHunter': PerchHunterSchema,
  'flyers.Diver': DiverSchema,
  'flyers.OrbitDiver': OrbitDiverSchema,
  'flyers.PatrolDiver': PatrolDiverSchema,
  'flyers.BurstFlyer': BurstFlyerSchema,
  'grazers.Grazer': GrazerSchema,
  'grazers.RamGrazer': RamGrazerSchema,
  'grazers.ChallengeGrazer': ChallengeGrazerSchema,
  'groupBrains.GroupBrain': GroupBrainSchema,
  'creatures.Creatures': CreaturesSchema,
  'creatures.CreatureHome': CreatureHomeSchema,
  'crowds.Flock': FlockSchema,
  'encounters.Encounters': EncountersSchema,
  'audioProfiles.AudioMusic': AudioMusicSchema,
  'audioProfiles.AudioSamples': AudioSamplesSchema,
  'audioProfiles.AudioZones': AudioZonesSchema,
  'audioRouting.AudioRouting': AudioRoutingSchema,
  'audio.AudioData': AudioDataSchema,
  'ledger.LedgerFact': LedgerFactSchema,
  'ledger.LedgerRules': LedgerRulesSchema,
  'director.Director': DirectorSchema,
  'directorStages.DirectorStages': DirectorStagesSchema,
  'migrations.LogicalState': LogicalStateSchema,
  'migrations.Migrations': MigrationsSchema,
  'traversal.Traversal': TraversalSchema,
  'runtimeBinds.RuntimeBinds': RuntimeBindsSchema,
  'runtimeSpawns.RuntimeSpawns': RuntimeSpawnsSchema,
  'skinLayers.SkinPoseLayer': SkinPoseLayerSchema,
  'presentation.Presentation': PresentationSchema,
  'meshCollision.MeshCollision': MeshCollisionSchema,
  'scripts.ScriptBindings': ScriptBindingsSchema,
  'actorMoves.ActorMoves': ActorMovesSchema,
  'decisionScripts.DecisionScripts': DecisionScriptsSchema,
  'hooks.Hooks': HooksSchema,
  'terrain.Terrain': TerrainSchema,
  'water.Water': WaterSchema,
  'accent.Accent': AccentSchema,
  'items.ItemFamilyName': ItemFamilyNameSchema,
  'items.Items': ItemsSchema,
  'targets.Targets': TargetsSchema,
  'quests.QuestData': QuestDataSchema,
  'questGraph.QuestGraph': QuestGraphSchema,
  'questSteps.QuestStepRows': QuestStepRowsSchema,
  'speciesPrograms.Species': SpeciesSchema,
  'buildings.BakedBuildingLook': BakedBuildingLookSchema,
  'buildings.BuildingLifeLook': BuildingLifeLookSchema,
  'questInteractions.InteractionRows': InteractionRowsSchema,
  'rows.Rows': RowsSchema,
  'movers.Movers': MoversSchema,
  'modes.Modes': ModesSchema,
  'modes.ZiplineMode': ZiplineModeSchema,
  'modes.UpdraftMode': UpdraftModeSchema,
  'modes.RideGaits': RideGaitsSchema,
  'modes.RideMode': RideModeSchema,
  'modes.GrappleMode': GrappleModeSchema,
  'modes.TraverseMode': TraverseModeSchema,
  'moverMotion.MoverMotion': MoverMotionSchema,
  'moverMotion.MoverTrack': MoverTrackSchema,
  'moverMotion.MoverTrigger': MoverTriggerSchema,
  'moverMotion.MoverDriver': MoverDriverSchema,
  'socketLift.SocketLift': SocketLiftSchema,
  'portalLink.PortalLink': PortalLinkSchema,
  'entryways.Entryways': EntrywaysSchema,
  'navigation.Navigation': NavigationSchema,
  'nativeGround.NativeGround': NativeGroundSchema,
  'ui.Ui': UiSchema,
  'clientScripts.ClientScripts': ClientScriptsSchema,
  'clientChannels.ClientChannels': ClientChannelsSchema,
  'clientChannels.ClientChannelProgram': ClientChannelProgramSchema,
  'clientChannels.PrivateScene': PrivateSceneSchema,
  'ambientLife.ForestLife': ForestLifeSchema,
  'runtimeCost.MemoryMeasurement': MemoryMeasurementSchema,
  'runtimeCost.RuntimeCost': RuntimeCostSchema,
  'runtimeCost.RegionalSimCost': RegionalSimCostSchema,
  'runtime.Runtime': RuntimeSchema,
  'clientState.ClientCheckpoint': ClientCheckpointSchema,
  'clientState.ItemCheckpointStates': ItemCheckpointStatesSchema,
  'clientState.LogicalClientCheckpoint': LogicalClientCheckpointSchema,
  'liftRider.LiftRider': LiftRiderSchema,
  'weaponHooks.WeaponHooks': WeaponHooksSchema,
  'speciesScripts.ScriptSpecies': ScriptSpeciesSchema,
  'eliteScripts.EliteScript': EliteScriptSchema,
  'skins.SkinLookParameters': SkinLookParametersSchema,
  'skins.SkinClipParameters': SkinClipParametersSchema,
  'skins.ShardSkinFile': ShardSkinFileSchema,
  'skinData.SkinClipName': SkinClipNameSchema,
  'skinData.SkinRow': SkinRowSchema,
  'skinData.SkinBinding': SkinBindingSchema,
  'shardSections.ShardNatural': ShardNaturalSchema,
  'shardSections.ShardFinite': ShardFiniteSchema,
  'shardSections.ShardHash': ShardHashSchema,
  'shardSections.ShardReference': ShardReferenceSchema,
  'shardSections.ShardReferences': ShardReferencesSchema,
  'shardSections.ShardNames': ShardNamesSchema,
  'shardSections.CellBounds': CellBoundsSchema,
  'shardSections.Identity': IdentitySchema,
  'shardSections.Requires': RequiresSchema,
  'shardSections.Budgets': BudgetsSchema,
  'shardSections.Sim': SimSchema,
  'shardSections.AuthorCaps': AuthorCapsSchema,
  'shardSections.ServerBudget': ServerBudgetSchema,
  'shardSections.Files': FilesSchema,
  'shardSections.Tiles': TilesSchema,
  'shardSections.Library': LibrarySchema,
  'shardSections.Critical': CriticalSchema,
  'shardSections.Far': FarSchema,
  'shardSections.Spawn': SpawnSchema,
 };
const wireChecks = new Map<object, string>();
const wireFinite = new Set<object>();
const wireRegexes = new Set<object>();
function rememberActions(value: unknown, path: string, seen: WeakSet<object>): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) return;
  seen.add(value);
  const kind: unknown = Reflect.get(value, 'kind'), type: unknown = Reflect.get(value, 'type');
  if (kind === 'schema' && type === 'lazy') {
    const getter: unknown = Reflect.get(value, 'getter');
    if (typeof getter === 'function') {
      const nested: unknown = Reflect.apply(getter, undefined, [undefined]);
      rememberActions(nested, `${path}.wrapped`, seen);
    }
  }
  if (kind === 'validation') {
    if (type === 'check' && !wireChecks.has(value)) wireChecks.set(value, path);
    else if (type === 'finite') wireFinite.add(value);
    else if (type === 'regex') {
      const regex: unknown = Reflect.get(value, 'requirement');
      if (regex instanceof RegExp && regex.flags === 'u') wireRegexes.add(value);
    }
  }
  for (const [key, child] of Object.entries(value)) rememberActions(child, `${path}.${key}`, seen);
}
for (const [key, schema] of Object.entries(wireRoots)) {
  const module = key.slice(0, key.indexOf('.')), binding = key.slice(key.indexOf('.') + 1);
  rememberActions(schema, `@wildshard/format/${module}#${binding}Schema`, new WeakSet());
}
// A composed quest host shares this exact check object; its nested path must not rename the defining public check.
wireChecks.set(DirectorStagesSchema.pipe[1], '@wildshard/format/directorStages#DirectorStagesSchema.pipe.1');

/**
 * Convert an author schema with the official converter, refusing every unrecognised custom check or transform.
 * The extracted format checks have explicit bridges. Plumbing's cross-field checks remain named mandatory
 * admission checks; Valibot string bounds use UTF-16 code units, unlike JSON Schema's Unicode code points.
 * The custom-section bridge uses draft-07; existing wire documents keep draft-2020-12.
 * This structural document never replaces the defining format parser's admission verdict.
 */
export function formatJsonSchema(schema: GenericSchema, target: 'draft-07' | 'draft-2020-12' = 'draft-2020-12'): FormatJsonSchema {
  return toJsonSchema(schema, {
    target, errorMode: 'throw', typeMode: 'output',
    overrideSchema: ({ valibotSchema }) => customSchemas.get(valibotSchema),
    overrideAction: ({ valibotAction, jsonSchema, errors }) => {
      if (valibotAction === EdgeProfileSchema.pipe[1]) {
        // Both arrays must have the same native sample count; bound each branch exactly.
        return { ...jsonSchema, anyOf: [256, 257].map(count => ({ properties: {
          heights: { minItems: count, maxItems: count }, colours: { minItems: count, maxItems: count },
        } })) };
      }
      if (valibotAction === PlumbingSchema.pipe[3]) {
        return { ...jsonSchema, 'x-wildshard-checks': ['@wildshard/format/plumbing#plumbingRules'] } satisfies FormatJsonSchema;
      }
      if (valibotAction === StateSchema.pipe[1]) {
        return { ...jsonSchema, 'x-wildshard-checks': ['@wildshard/format/state#stateRules'] } satisfies FormatJsonSchema;
      }
      if (valibotAction === CommonsCostsSchema.pipe[1]) {
        return { ...jsonSchema, maxProperties: SHARDFILE_ADMISSION_LIMITS.commons };
      }
      // Only the defining query form derives an omitted collider reference from its required sampling file.
      if (valibotAction === TerrainSchema.options[1].pipe[1]) return {
        ...jsonSchema, required: [...jsonSchema.required ?? [], 'collider'],
        'x-wildshard-checks': ['@wildshard/format/terrain#TerrainSchema.options.1.pipe.1'],
      } satisfies FormatJsonSchema;
      // The retained clip transform returns its input unchanged; identity is checked against its defining object.
      if (valibotAction === SkinClipNameSchema.pipe[2]) return jsonSchema;
      const check = wireChecks.get(valibotAction);
      if (check !== undefined) {
        const before = (jsonSchema as FormatJsonSchema)['x-wildshard-checks'] ?? [];
        return { ...jsonSchema, 'x-wildshard-checks': [...before, check] } satisfies FormatJsonSchema;
      }
      // JSON numbers cannot contain NaN or infinity. The existing ASCII regexes only use the Unicode flag.
      if (valibotAction.reference === finite || finiteNumbers.has(valibotAction) || unicodeRegexes.has(valibotAction) || wireFinite.has(valibotAction) || wireRegexes.has(valibotAction)) return jsonSchema;
      if (errors === undefined && jsonSchema.type === 'string' &&
          (valibotAction.type === 'min_length' || valibotAction.type === 'max_length')) {
        return { ...jsonSchema, 'x-wildshard-string-length': 'utf16-code-units' } satisfies FormatJsonSchema;
      }
      return undefined;
    },
  });
}

const namedSchemas = new WeakMap<GenericSchema, Readonly<Record<string, unknown>>>();
/** Build-only draft-07 structure for a named JSON producer's defining schema.
 * Like the custom-section bridge, omit documentation annotations that Ajv does
 * not implement; the producer and defining reader retain semantic admission.
 * Unknown checks and transforms still refuse conversion. Never infer from data. */
export function namedJsonSchema(schema: GenericSchema): Readonly<Record<string, unknown>> {
  const previous = namedSchemas.get(schema);
  if (previous !== undefined) return previous;
  const structural = (value: unknown): unknown => {
    if (typeof value === 'string' && value.startsWith('#/$defs/')) return value.replace('#/$defs/', '#/definitions/');
    if (Array.isArray(value)) return value.map(structural);
    if (typeof value !== 'object' || value === null) return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => key !== 'x-wildshard-checks' && key !== 'x-wildshard-string-length')
      .map(([key, child]) => [key === '$defs' ? 'definitions' : key, structural(child)]));
  };
  const wire = structural(formatJsonSchema(schema, 'draft-07'));
  if (typeof wire !== 'object' || wire === null || Array.isArray(wire)) throw new Error('Named JSON requires a defining object schema');
  const result: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(wire));
  namedSchemas.set(schema, result);
  return result;
}

/** The migrated wire roots, generated from their defining Valibot schemas; whole-shard extraction remains open. */
export function formatJsonSchemas(): Readonly<Record<string, FormatJsonSchema>> {
  const document = (name: string, schema: GenericSchema): FormatJsonSchema => {
    try { return {
      ...formatJsonSchema(schema), title: name,
      $comment: 'DO-NOT-EDIT: generated from @wildshard/format by scripts/gen-format-schema.mjs. Structural schema; named checks and UTF-16 bounds still require the defining Valibot parser.',
    }; } catch (error) { throw new Error(`Format schema ${name}: ${String(error)}`, { cause: error }); }
  };
  return { 'edge-profiles': document('edge-profiles', EdgeProfilesSchema), plumbing: document('plumbing', PlumbingSchema),
    state: document('state', StateSchema), 'commons-costs': document('commons-costs', CommonsCostsSchema),
    ...Object.fromEntries(Object.entries(wireRoots).map(([name, schema]) => [name, document(name, schema)])) };
}

/** JSON-only declaration discovery. Rules describe admission; this document never grants admission. */
export interface SchemaDeclaration {
  kind: string;
  rules: { kind: string; requirement?: string | number | boolean; message?: string }[];
  properties?: Record<string, SchemaDeclaration>;
  items?: SchemaDeclaration[];
  item?: SchemaDeclaration;
  alternatives?: SchemaDeclaration[];
  wrapped?: SchemaDeclaration;
  optional?: boolean;
  default?: string | number | boolean | null | object;
  value?: string | number | boolean;
  values?: (string | number | boolean)[];
  key?: SchemaDeclaration;
  valueSchema?: SchemaDeclaration;
  rest?: SchemaDeclaration;
}

function declarationOf(value: unknown): SchemaDeclaration {
  if (typeof value !== 'object' || value === null) throw new Error('Expected a defining schema');
  const read = (key: string): unknown => Reflect.get(value, key);
  const type = read('type');
  if (typeof type !== 'string') throw new Error('Expected a defining schema type');
  const pipeline = read('pipe');
  if (Array.isArray(pipeline)) {
    const schemas = pipeline.filter((part: unknown) => typeof part === 'object' && part !== null && Reflect.get(part, 'kind') === 'schema');
    const base: unknown = schemas.at(-1);
    if (base === undefined) throw new Error('Missing pipeline schema');
    const declaration = declarationOf(base);
    for (const part of pipeline) {
      if (typeof part !== 'object' || part === null || Reflect.get(part, 'kind') === 'schema') continue;
      const kind: unknown = Reflect.get(part, 'type'), requirement: unknown = Reflect.get(part, 'requirement'), message: unknown = Reflect.get(part, 'message');
      if (typeof kind !== 'string') throw new Error('Missing admission rule type');
      declaration.rules.push({ kind,
        ...(requirement instanceof RegExp ? { requirement: requirement.source } : typeof requirement === 'number' || typeof requirement === 'string' || typeof requirement === 'boolean' ? { requirement } : {}),
        ...(typeof message === 'string' ? { message } : {}),
      });
    }
    return declaration;
  }
  const declaration: SchemaDeclaration = { kind: type, rules: [] };
  const entries = read('entries'), items = read('items'), item = read('item'), alternatives = read('options'), wrapped = read('wrapped');
  if (typeof entries === 'object' && entries !== null) declaration.properties = Object.fromEntries(Object.entries(entries).map(([key, schema]) => [key, declarationOf(schema)]));
  if (Array.isArray(items)) declaration.items = items.map(declarationOf);
  if (typeof item === 'object' && item !== null) declaration.item = declarationOf(item);
  if (Array.isArray(alternatives)) {
    if (alternatives.every((option: unknown) => typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean')) declaration.values = alternatives;
    else declaration.alternatives = alternatives.map(declarationOf);
  }
  if (typeof wrapped === 'object' && wrapped !== null) declaration.wrapped = declarationOf(wrapped);
  for (const [source, target] of [['key', 'key'], ['value', 'valueSchema'], ['rest', 'rest']] as const) {
    const child = read(source);
    if (typeof child === 'object' && child !== null) declaration[target] = declarationOf(child);
  }
  if (type === 'optional' || type === 'exact_optional') declaration.optional = true;
  const fallback = read('default'), literal = read('literal');
  if (fallback === null || typeof fallback === 'string' || typeof fallback === 'number' || typeof fallback === 'boolean' || typeof fallback === 'object') declaration.default = structuredClone(fallback);
  if (typeof literal === 'string' || typeof literal === 'number' || typeof literal === 'boolean') declaration.value = literal;
  return declaration;
}

/** Inspect every defining field, tuple and union without reaching into Valibot; semantic rules remain mandatory. */
export function schemaDeclaration(schema: GenericSchema): SchemaDeclaration { return declarationOf(schema); }

/** Select an existing JSON document field by RFC 6901 pointer; malformed escapes and absent fields refuse. */
export function schemaAt(document: object, pointer = ''): unknown {
  if (pointer === '') return document;
  if (!pointer.startsWith('/')) throw new Error('Schema pointer must be empty or start with /');
  let value: unknown = document;
  for (const token of pointer.slice(1).split('/')) {
    if (/~(?![01])/u.test(token)) throw new Error('Invalid schema pointer escape');
    const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
    if (typeof value !== 'object' || value === null || !Object.hasOwn(value, key)) throw new Error(`Unknown schema pointer: ${pointer}`);
    value = Reflect.get(value, key);
  }
  return value;
}
