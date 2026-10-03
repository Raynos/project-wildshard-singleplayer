// The engine's public API (GAME-NORMALIZATION 01 §0). F1's alias spike; F6 / F8 fill it.
export const ENGINE_API = 1;
export { isDev, onDev, setDev } from './core/devMode';
export { CHUNK_HALF, ROAD_LENGTH } from './core/config';
export { buildTerrain } from './world/terrainField';
export { installBounds } from './world/bounds';
export type { ExploreSpec } from './level/data';
export { App, type SystemsByPhase } from './app/app';
export { PHASES, inState, type AppState, type Phase, type RunCondition, type SystemSpec, type TickRateId } from './app/systems';
export { Scope, type Disposable3, type PhysicsHandle, type SoundHandle, type ScopeCensus } from './app/scope';
export { AssetService, type AssetCensus, type AssetRecord } from './app/assets';
export { Events, EVENT_FLUSH_LIMIT, type ListenerOptions } from './events/events';
export type { EventMap, AskMap, TagMap, Tag, FaultEvent, AskInput, AskOutput } from './events/maps';
export { hasTag } from './events/tags';
export { GameClock } from './core/clock';
export { Rng, RngService, fnv1a32, pageSeed, type RngStream, type RngStreams } from './core/rng';
export { app, gameplayRandom } from './app/runtime';
export { currentOwner, enterOwner, withOwner, asShell, onOwnerDispose } from './app/ownership';
export { resourceScope, pageScope } from './app/resources';
export { ownAudioSource } from './audio/ownership';
export { ambientTick } from './core/harnessTap';
export { retainCachedResources } from './app/cachedAssets';
export type { Ktx2Table } from './boot/gpuFiles';
export type { LoadFailure } from './core/errorReport';
export { retried } from './boot/retry';
export { LevelLoadError, type LevelDriver, type LevelStage } from './level/load';
export { resolveTierKnobs, needsTerrainCollider, type LevelSpec, type BootSpec, type LoadoutSpec, type EngineMechanism, type TierKnobMap, type TierKnobs, type TierOverrides } from './level/spec';
export { LevelRegistrations } from './level/registrations';
export type { LevelContext, LevelHooks, LevelAdapters, ResidentMemory, EngineRows, ContentRow, ContentRowMap, InputContextDef, HudVerbs, HudBand, VerbSlotOpts, DebugRowSpec, PlaygroundSpec, StringTable, TierKnobSchema } from './level/context';
export type { LookStrategy, LookComposeContext, LookComposition } from './render/look';
export { patchShader, takeForeignHook, setInheritedPatch, setProgramKey, hasProgramKey, PATCH_ORDER, type ShaderSource, type ShaderPatchFn, type ShaderPatchKey, type ShaderPatchOptions } from './render/shaderPatches';

export { boxInFrame, type BoxSpec } from './physics/box';
export type { Player } from './player/Player';

export { SaveStore, type SaveKeyDef, type SaveSlot, type SaveScope, type ImportReport, type CorruptSave } from './saves/store';
export { saves, persistHomeScreen } from './saves/runtime';
export { jsonSlot, jsonSchema, jsonRecord, saveStorage } from './saves/slots';

// Audio content ports: runtime implementations are loaded after manifest discovery.
export { loadAudio } from './audio/contentApi';
export type { ScoreSource, SetScore } from './audio/SetScore';
export type { CuePlayer, CueMap, CueOpts, CueBank, SampleClip } from './audio/Cues';
export type { ZoneWeights } from './audio/AmbienceBeds';
export type { LevelAudioProfile } from './audio/levelAudio';
export type { MusicState } from './audio/Music';
export { tap } from './core/harnessTap';
export { castRay, castSegment, floorBelow, lineOfSight } from './physics/query';

export { Equipment, type EquipmentRow, type EquipmentMeta, type EquipmentSlotMap, type EquipmentIconMap, type EquipmentTouchMap, type WeaponUi, type EquipContext, type BlockSet, type EquipmentId, type WeaponId, type ToolId } from './combat/Equipment';
export { Weapon, quiverState, type WeaponState, type AimInfo, type WeaponHooks } from './combat/Weapon';
export { Tool, type EquipmentAction } from './combat/Tool';
export { EquipmentService } from './combat/EquipmentService';
export type { EquipmentInput } from './input/equipmentInput';

export type { IconId, IconMap } from './ui/icons';
export type { KitEntry, SkinRow } from './ui/Menu';


// Combat simulation ports (E357 S1.3a); source formulas remain with their weapon families.
export { CombatPipeline, type CombatTarget, type Actor, type CombatTag, type DamageRequest, type DamageDealt, type DamageRuleDef, type DeathCause, type FallCause, type HealthAttributes, type StringKey } from './combat/pipeline';
export { PlayerHealth, type PlayerHealthPorts, type PlayerMode } from './combat/health';
export { EffectService } from './combat/effects/EffectService';
export { sourceMultiplier, matchesTag, type AttributeSet, type EffectDef, type EffectTarget, type EffectId, type ActiveEffect, type SourceMulDef, type CueId } from './combat/effects/types';
export { CombatCues, audioCueMap, resolveHitStop, type CombatCueMap, type CombatCueOpts, type HitStopProfile } from './combat/cues';

export { blocks } from './blocks';

// Public weapon-family building blocks and visual ports (E357 C4).
export { melee, aimRay, fovForAspect } from './combat/blocks/melee';
export { viewmodel, type DrawingBuffer, type LookSpring, type LookLag } from './render/viewmodelFeel';
export type { Game } from './core/Game';
export type { Sky } from './world/Sky';
export type { Forest } from './world/forest/Forest';
export type { Targets, TargetAnimal, TargetHit } from './combat/types';
export type { Move, Key, Trail, SwordWorld, SwordRig, SwordArms, SwordFraming, SwordMoveSet } from './combat/view/melee';
export { BladeGlow } from './player/bladeGlow';
export { dodgeFx, dodgeEnv } from './player/dodge';
export { getAimTargets, lockOn, meleeLock, targetRadius, type AimTarget } from './player/AimTargets';
export { bladeBlocked, bladeContact, type Clang } from './player/MeleeSweep';
export { worldTime } from './core/time';
export { CameraFX } from './player/CameraFX';
export { Impacts } from './fx/Impacts';
export { defineModel, type ModelContext, type ModelPart, type ModelDef } from './models/model';
export { DayCycle, type DayCycleSpec, type DayCycleClock, type DayKeys, type DayPhase, type TimePick, type LightPreset } from './world/dayCycle';
export { Weather, type WeatherProfile, type WeatherNumbers } from './world/weather';

export { InputService, type Action, type ActionMap, type TouchVerb, type TouchVerbSpec } from './input/InputService';
export type { EquipmentHost } from './combat/view/EquipmentHost';
export { hudSlots, type TouchRelabel, type DiscSpot } from './ui/hudSlots';

// Ranged family mechanisms and visual ports (E357 S2.2).
export type { ImpactSurface } from './combat/Weapon';
export { Projectiles, projectileFlightStep, type ProjectileKind, type ProjectileWorld, type ShotOpts, type WindField } from './combat/view/projectile';
export { DropArc } from './combat/view/DropArc';
export { ads as blendAds } from './combat/blocks/ads';
export { brassFloor, stepBrass, type BrassCase } from './combat/view/brass';
export { hitscan, type HitscanProfile, type HitscanResult } from './combat/view/hitscan';
export { HitLine, makeFlashTexture } from './combat/view/firearmFx';
export { Puffs, worldHit, impactSurfaceOf, FOV_HIP, FOV_ADS, fovForAspect as rangedFovForAspect, dataTexture, viewmodelTexSet, remapUV, makeCord, makeBoltAtlas, fixIBL, VIEWMODEL_GROUP, viewmodelMaterial, isMesh, box, cyl, edgeWear, whiteColors, stripExtra, TRACER_ORDER, TRACER_RED, clamp01, sstep, startViewmodelTextures, viewmodelTexturesReady, type TexSet, type CrossbowWorld, type CrossbowOptions, type RangedWorld, type RangedOptions } from './combat/view/ranged';
export { getSetting, getNumber, onNumber, onSettingChange, setting } from './ui/Settings';
export { LightPool } from './fx/LightPool';
export { ParticlePool, pointScale, type ParticlePoolSpec, type ParticleAttr } from './fx/ParticlePool';
export { voxelAO, aoTint, hemisphere, type VoxelAOParams, type HemiRing, type HemiDir } from './world/voxelAO';
export { log, beam, rope, sagLine, rock, plank, tris, wobble, pole, blob, mergeVerticesByPos, lathe, revolve, revolveUV } from './world/geometryKit';
export { painterlyMaterial, syncPainterlySun, updatePainterly, setPainterlyLook, painterlyUniforms } from './world/painterly';
export { ARM_PAL, gloveFist, riderArm, placeArm, forearm } from './player/nalatiArms';
export { wind } from './world/steppeWind';
export { WIND_DIR, windGustAt } from './world/wind';
export { sticksIn } from './physics/query';
export { SHADOW_LAYER } from './core/shadowLayer';
export type { AmmoId, AmmoRow, ProjectileModification } from './combat/ammo';

export { Hfsm, type StateDef, type StateChange } from './ai/hfsm';
export { TickScheduler, type TickBand, type TickRate, type TickActor, type InterruptReason } from './app/scheduler';
export { StrikeRunner, type StrikeSpec, type StrikeContext, type StrikeActor, type StrikePhase, type UtilityScore } from './ai/strikes';
export { canReach, type ReachActor } from './ai/reach';
export { AggressionDirector, AggressionService } from './ai/director';
export { BossBrain, type BossDefinition, type BossSaved, type BossPorts, type BossPresentation, type BossScript, type BossState } from './ai/BossBrain';
export { EliteBrain, type EliteDefinition, type EliteActor, type ElitePorts } from './ai/EliteBrain';
export { EncounterRegistry, type EncounterDefinition } from './ai/encounters';
export type { SkyBackdrop, SkyBackdropContext, SkyBackdropFactory, SkyBackdropTargets, SkyBackdropPost } from './render/look';
export type { OptionValue } from './ui/Settings';

export { attachFogUniforms, fogUniforms, weatherFog, type WeatherFog, type WeatherFogSpec } from './world/Atmosphere';
export { preloadBakedTextures, loadBakedSky, loadLUT } from './boot/bakedApi';
export { fetchLut, LUT_SIZE } from './render/lut';
export { lin } from './math/color';

export type { RGB } from './level/data';
export { compassDir, type ScheduleSeg } from './world/dayCycle';

// Authored static content and gameplay host ports (E357 S2.1).
export { loadPBR, loadGLTF, pbrMaterial, type PBRSet } from './core/assets';
export { SEED } from './core/config';
export { terrainHeight as heightAt } from './world/terrainHeight';
export { boxDesc, type ColliderDesc } from './world/registry';
export { TIER_CONFIG } from './core/tier';
export { macrotask, slicer } from './boot/plan';
export type { StepRunner } from './boot/plan';
export { twoSidedPositions, type WeldBuild } from './models/weld';
export type { Interactable } from './world/interact/types';
export type { World } from './core/bootstrap';
export type { AnimalManager } from './entities/AnimalManager';
export type { Audio, StepSurface } from './audio/Audio';
export type { Music } from './audio/Music';
export type { HUD } from './ui/HUD';
export type { GameMenu, GameMenuOptions } from './ui/Menu';
export type { FullMap } from './ui/Map';
export type { SkinDef } from './player/Skins';
export { loadWorldContent } from './contentApi';
export type { Animal } from './entities/Animal';
export { installRangedFeel, type RangedFeelProfile } from './combat/view/rangedFeel';

export { inspectBrain, pinBrain, brainInspection, type BrainInspection } from './ai/inspect';
export { installAiDebug, type AiDebugHost, type AiDebugView } from './ai/view/DebugOverlay';

export { WeightedTable, type WeightedRow, type TableDrop, type TableSpec } from './ai/weighted';

export { QuestState, QuestLine, lineFor, validateQuest, CHIP_MAX, type QuestDef, type QuestStep, type QuestMarker, type NpcDef, type DialogueEntry } from './quest/core';
export type { QuestChip, NpcTalk } from './quest/view';
export { loadQuest } from './quest/contentApi';

// Hunting simulation rows and their separate rendering adapters (E357 S2.3).
export { deriveSpecies, type SpeciesRow, type SpeciesVariant } from './ai/species';
export type { SpeciesFlight } from './ai/flight';
export { speciesWithLook, type SpeciesLook, type CreatureHull, type EyeSpot } from './entities/species/look';
export { registerSpecies, setCreatureSoundDefaults, speciesDef, variantDef, hasSpecies, type SpeciesDef, type VariantDef, type AnimalSpecies, type BoneDef, type CreatureSoundDefaults } from './entities/species/registry';
export type { HuntTuning } from './entities/AnimalManager';
export { loft, tube, skinPlain, S, boneIndex, srgb, mix, sstep as speciesSstep, paintNoise, setShag, isLowPoly, registerToonPaint, toonPaint, paletteColors, type Paint, type ToonPaint, type RGB as SpeciesRGB } from './entities/species/loft';
export { crestSpikes } from './entities/lowpoly';

export { fxMaterial, annulus, FX, type FxMaterial, type FxMode } from './fx/groundFx';

export { TreeFactory, patchFade, patchWind, type TreeVariant, type FadeBand } from './world/TreeFactory';

// Audio graph mechanisms are content-independent and safe at the public data boundary.
export { AmbienceZones, type ZoneVoice } from './audio/ambience';
export { panFromYaw, loopAt } from './audio/util';
export type { VoicePool, VoiceTable, SampleVoice, SamplePolicy } from './audio/Voices';

// E357 S3.2: a level look's hooks (LookStrategy fog / replace compose / terrain painter / grass) and what a painter builds from
export type { LookReplaceContext, LookChain, FogModel, TerrainPainter, PainterField, GrassDriver, GrassLayer, ExtendLook, ReplaceLook, SkyDressing } from './render/look';
export type { MinimapPalette, MapOverlay, MapPoi } from './ui/Minimap';
export { addFogUniforms } from './world/Atmosphere';
export { CHUNK_SIZE, CHUNK_DEPTH, TERRAIN_RES } from './core/config';
export { Noise2D, smoothstep, clamp, lerp } from './core/noise';
export type { Terrain } from './world/Terrain';

export { loadTexture, loadPBRArray } from './core/assets';
export { loadBakedCards, exportCardTextures } from './world/BakedCards';
export { markGpuOnly } from './core/gpuOnly';
export { treeSetOf, TREE_SPECS } from './world/forest/treeSpec';
export { BARK_LAYERS, loadTreeSetGeometry, patchBarkArrays, patchCardCrownTop, patchImpostorCrownTop, standIn, treeSetUrls } from './world/forest/treeSet';
export { PUBLIC_BYTES } from './boot/bytes.generated';
export { markUnload } from './boot/lastEnd';
export { setTitleArrival } from './boot/titleArrival';
export type { TreeSpeciesTraits, TreeSetVariant } from './world/forest/treeSpecies';

export type { AnimalSound, HoofSurface, ImpactKind } from './audio/Audio';

export { audioRandom } from './audio/util';


export { authoredTargets, type RayTargets } from './combat/targets';
export { windUniforms } from './world/TreeFactory';
export { loadMeadow } from './meadowApi';
export type { PlaygroundHost, Playground } from './practice/playground/Playground';
export { pathRampDescs } from './physics/paths';
export { AnalyticsSink, type AnalyticsEvent, type AnalyticsMap, type AnalyticsBatch } from './analytics';
export { SpeciesService } from './entities/species/look';
export { TIER, buildTier } from './core/tier';
export type { RigAnimCtx, FurStyle } from './entities/species/registry';
export { EncounterService, type SpawnTableRow, type SpawnEntry, type SpawnContext, type SpawnPoint, type Spawner } from './ai/encounters';
export type { SlotAudio, StyleBank, StemSting, BossPhase } from './audio/Stems';
export type { MusicStyle } from './ui/Settings';
export { Synth } from './audio/synth';
export { installScore, type Score, type Arrangement, type Segment, type NoteEv, type ChordEv, type MixEv, type LayerId, type MixKey, type Mode, type ChordName } from './audio/score/score';

export { ENGINE_STRINGS, engineString, installEngineStrings, type EngineStringKey } from './strings';
export { RopeChain, type RopeChainSpec } from './physics/ropeChain';
export { WorldRegistry } from './world/registry';
export { WaterBodies, swellBody, type WaterBody } from './world/water/body';

export type { ThinkCtx, EnemyWorld, AnimalDims, VariantMods } from './entities/species/registry';
export { NO_FUR, lookAngles, smooth01, bump, step, clamp as rigClamp, squashBody } from './entities/species/rigs';
export { BossBar } from './ui/BossBar';

export { pondGrid } from './world/pondGrid';

export { GroupBrain, type GroupMember } from './ai/GroupBrain';

export { CreatureBrain } from './ai/CreatureBrain';
export type { BossDef } from './ai/bossDefinition';

export { setShapeFn, type Station } from './entities/species/loft';

export { setEliteBrain, setEliteDamage, setEliteAct, eliteThink, eliteDamageMul, eliteAct } from './entities/eliteBrain';

export { EliteBar } from './ui/EliteBar';

export { terrainNormal, terrainWaterLevel } from './world/terrainHeight';

export type { GroupName } from './physics/groups';

export { activeRegistry } from './world/registry';

export { practiceRoom } from './core/practiceRoom';


export { Flags } from './world/interact/flags';
export type { Interactables, InteractEvent } from './world/interact/Interactables';
export type { PoiId, Place } from './world/interact/types';
export type { MapPoi as FullMapPoi, MapQuest } from './ui/Map';
export type { MapMark } from './ui/Minimap';
export type { FirstHints } from './ui/FirstHints';
export { modelContext } from './models/model';

export { activeBodies, type Body, type BodySpec } from './physics/bodies';
export { groups } from './physics/groups';
export { waveHeight } from './world/waves';

export { impact, synthKit } from './audio/gen';
export { icon, registerIcons, iconParts } from './ui/icons';
export { registerPickupLook, type PickupLook, type PickupPart } from './world/interact/types';
export { interactParts, pickupModel } from './world/interact/kit';
export { LowPolyKit } from './world/lowpolyKit';

export { loadRigFile, loadRig, bindRig, ClipChannel, AnimMachine, type ClipName, type SocketName, type RigContract, type RigBake, type RigRef, type RigInstance, type AnimMachineDef, type AnimState, type AnimService } from './anim/index';
export { activeLevel, selectedLevel, onLevelChange, configureLevel } from './level/selection';

export { type Renderer, probeRenderer, isRenderer } from './render/renderer';

export type { Feedback } from './ui/Feedback';
export type { Explore } from './explore/Explore';
export type { ExploreMode } from './explore/Explore';
export type { PlaygroundId } from './practice/playground/catalog';
export type { Bucket } from './core/frameCost';
export type { TitleArrival } from './boot/titleArrival';
export { loadBootRuntime, type BootRuntime } from './boot/contentApi';
export { levelSequenceDriver, type LevelSequence, type LevelBoundary } from './boot';
export type { StepProgress } from './boot/plan';
export type { TrainingArena } from './practice/TrainingArena';
export { buildHoverboard } from './render/hoverboardGeometry';
export { installGameplayInput, weaponInputContext } from './input/gameplay';

export { uiScope, mountUi } from './ui/ownership';

export { UiLayers, type UiLayer, type UiView, type UiHandle } from './ui/layers';

export { TabRegistry, type TabId, type TabSpec, type TabFragment } from './ui/tabs';
export { weaponActionGate } from './input/weaponActions';
export { listenDom } from './input/dom';

export { registerGlobalDebugAction, type GlobalDebugActionSpec } from './ui/authoredDebugRows';

export { live, listModel, type RosterEntry } from './models/live';

export { SlashTrail, type SlashTrailProfile } from './combat/view/slashTrail';

export type { SkyRig } from './world/skyRig';
export type { SkyBackdropView } from './world/skyBackdrop';
