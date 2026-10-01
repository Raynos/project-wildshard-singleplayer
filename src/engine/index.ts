// The engine's public API (GAME-NORMALIZATION 01 §0). F1's alias spike; F6 / F8 fill it.
export const ENGINE_API = 1;
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
export { ownAudioSource } from './audio/ownership';
export { ambientTick } from './core/harnessTap';
export { retainCachedResources } from './app/cachedAssets';
export type { Ktx2Table } from './boot/gpuFiles';
export type { LoadFailure } from './core/errorReport';
export { LevelLoadError, type LevelDriver, type LevelStage } from './level/load';
export { resolveTierKnobs, needsTerrainCollider, type LevelSpec, type BootSpec, type LoadoutSpec, type EngineMechanism, type TierKnobs, type TierOverrides } from './level/spec';
export { LevelRegistrations } from './level/registrations';
export type { LevelContext, LevelHooks, LevelAdapters, EngineRows, ContentRow, ContentRowMap, InputContextDef, HudVerbs, HudBand, VerbSlotOpts, DebugRowSpec, PlaygroundSpec, StringTable, TierKnobSchema } from './level/context';
export type { LookStrategy, LookComposeContext, LookComposition } from './render/look';

export { boxInFrame, type BoxSpec } from './physics/box';
export type { Player } from './player/Player';

export { SaveStore, type SaveKeyDef, type SaveSlot, type SaveScope, type ImportReport, type CorruptSave } from './saves/store';
export { saves, persistHomeScreen } from './saves/runtime';
export { jsonSlot, jsonSchema, jsonRecord, saveStorage } from './saves/slots';

// Audio content ports: runtime implementations are loaded after manifest discovery.
export { loadAudio } from './audio/contentApi';
export type { ScoreSource, SetScore } from './audio/SetScore';
export type { CuePlayer, CueMap, CueOpts } from './audio/Cues';
export type { ZoneWeights } from './audio/AmbienceBeds';
export type { LevelAudioProfile } from './audio/levelAudio';
export type { IslandSfx } from './audio/IslandSfx';
export type { MusicState } from './audio/Music';
export { tap } from './core/harnessTap';
export { castRay, castSegment, floorBelow, lineOfSight } from './physics/query';

export { Equipment, type EquipmentRow, type EquipmentMeta, type WeaponUi, type EquipContext, type BlockSet, type EquipmentId, type WeaponId, type ToolId } from './combat/Equipment';
export { Weapon, quiverState, type WeaponState, type AimInfo, type WeaponHooks } from './combat/Weapon';
export { Tool, type EquipmentAction } from './combat/Tool';
export { EquipmentService } from './combat/EquipmentService';
export type { EquipmentInput } from './input/equipmentInput';

export type { IconId } from './ui/icons';
export type { KitEntry } from './ui/Menu';


// Combat simulation ports (E357 S1.3a); source formulas remain with their weapon families.
export { CombatPipeline, type Actor, type CombatTag, type DamageRequest, type DamageDealt, type DamageRuleDef, type DeathCause, type HealthAttributes, type StringKey } from './combat/pipeline';
export { PlayerHealth, type PlayerHealthPorts } from './combat/health';
export { EffectService } from './combat/effects/EffectService';
export { sourceMultiplier, matchesTag, type AttributeSet, type EffectDef, type EffectTarget, type EffectId, type ActiveEffect, type SourceMulDef, type CueId } from './combat/effects/types';
export { CombatCues, audioCueMap, resolveHitStop, type CombatCueMap, type CombatCueOpts, type HitStopProfile } from './combat/cues';

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
export { defineModel, type ModelContext, type ModelPart } from './models/model';
export { DayCycle, type DayCycleSpec, type DayCycleClock, type DayKeys, type DayPhase, type TimePick, type LightPreset } from './world/dayCycle';
export { Weather, type WeatherProfile, type WeatherNumbers } from './world/weather';

export { InputService, type Action } from './input/InputService';
export type { EquipmentHost } from './combat/view/EquipmentHost';
export type { TouchRelabel, DiscSpot } from './ui/hudSlots';

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
export { painterlyMaterial, syncPainterlySun, updatePainterly, setPainterlyLook, painterlyUniforms } from './world/painterly';
export { gloveFist, riderArm, placeArm, forearm } from './player/nalatiArms';
export { BUCKSKIN, HANDS_MATERIAL, WeaponHands, coatMaterialParams, holdDef, withHunterPalette, blendGrip, gripPose, type HandHold } from './player/hunterHands';
export { wind } from './world/steppeWind';
export { WIND_DIR, windGustAt } from './world/wind';
export { sticksIn } from './physics/query';
export { SHADOW_LAYER } from './core/shadowLayer';
export type { AmmoId, AmmoRow, ProjectileModification } from './combat/ammo';

export { Hfsm, type StateDef, type StateChange } from './ai/hfsm';
export { StrikeRunner, type StrikeSpec, type StrikeContext, type StrikeActor, type StrikePhase, type UtilityScore } from './ai/strikes';
export { canReach, type ReachActor } from './ai/reach';
export { AggressionDirector, AggressionService } from './ai/director';
export { BossBrain, type BossDefinition, type BossSaved, type BossPorts, type BossPresentation, type BossScript, type BossState } from './ai/BossBrain';
export { EliteBrain, type EliteDefinition, type EliteActor, type ElitePorts } from './ai/EliteBrain';
export { EncounterRegistry, type EncounterDefinition } from './ai/encounters';
