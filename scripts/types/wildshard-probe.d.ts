/// <reference types="vite/client" />
// oxlint-disable-next-line typescript/triple-slash-reference -- Ambient module scripts have no exports to import; scripts need their declarations.
/// <reference path="../../src/engine/client/types/n8ao.d.ts" />
// oxlint-disable-next-line typescript/triple-slash-reference -- Ambient module scripts have no exports to import; scripts need their declarations.
/// <reference path="../../src/engine/client/types/meshopt-simplifier.d.ts" />
// oxlint-disable-next-line typescript/triple-slash-reference -- Ambient module scripts have no exports to import; scripts need their declarations.
/// <reference path="../../src/engine/shared/physics/rapier-bg.d.ts" />
// oxlint-disable-next-line typescript/triple-slash-reference -- Ambient module scripts have no exports to import; scripts need their declarations.
/// <reference path="../../src/engine/client/boot/swGlobal.d.ts" />
import type { EngineProbe as ScriptProbe, HarnessPins as ScriptPins } from '../../src/engine/client/debug/probe';
import type { INPUT_CONTEXTS } from '../../src/game/client/inputContexts';

export type ScriptInputContexts = typeof INPUT_CONTEXTS;
export type { WsSw } from '../../src/engine/client/boot/sw';
export type { PrefetchHandle } from '../../src/engine/client/boot/shardPrefetch';
/** E357 F2: the runtime owns the contract, so scripts cannot silently drift from it. */
export type { EngineProbe as WildshardProbe } from '../../src/engine/client/debug/probe';
export type {
  HarnessPins, ProbeWorld, ProbePose, WalkLeg, WalkResult,
  Fingerprint, GameplayState, SoundLog, Saves, GpuBytes, CombatTarget, Vec3, ProbeNav,
} from '../../src/engine/client/debug/probe';

/** Capture scripts access these handles only after ws:ready. */
declare global { interface Window {
  __wildshard: ScriptProbe;
  __wildshardHarness?: ScriptPins;
  __frameFloorGridDocumentToken?: string;
  __frameFloorGridOriginDrift?: { deltaMs: number; maximumAbsoluteMs: number };
} }
