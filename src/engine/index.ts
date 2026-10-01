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

// Audio content ports: source selection, profile decoding and scoped playback.
export { SetScore, scoreFiles, decodeScore, type ScoreSource } from './audio/SetScore';
export { musicManifest, decodeStyle, shipped } from './audio/Stems';
export { CuePlayer, cueFiles, decodeCueSet, type CueMap, type CueOpts } from './audio/Cues';
export { AmbienceBeds, PositionalLoops, type ZoneWeights } from './audio/AmbienceBeds';
export type { LevelAudioProfile } from './audio/levelAudio';
export type { MusicState } from './audio/Music';
export { cachedBytes, decodeBytes } from './audio/preload';
export { MUSIC_STYLES, getMusicStyle, type MusicStyle } from './ui/Settings';
export { tap } from './core/harnessTap';
export { castRay } from './physics/query';
