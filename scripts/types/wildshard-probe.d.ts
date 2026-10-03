/// <reference types="vite/client" />
// oxlint-disable-next-line typescript/triple-slash-reference -- Ambient module scripts have no exports to import; scripts need their declarations.
/// <reference path="../../src/engine/types/n8ao.d.ts" />
// oxlint-disable-next-line typescript/triple-slash-reference -- Ambient module scripts have no exports to import; scripts need their declarations.
/// <reference path="../../src/engine/types/meshopt-simplifier.d.ts" />
// oxlint-disable-next-line typescript/triple-slash-reference -- Ambient module scripts have no exports to import; scripts need their declarations.
/// <reference path="../../src/engine/physics/rapier-bg.d.ts" />
import type { EngineProbe as ScriptProbe, HarnessPins as ScriptPins } from '../../src/engine/debug/probe';
import type { INPUT_CONTEXTS } from '../../src/game/inputContexts';

export type ScriptInputContexts = typeof INPUT_CONTEXTS;
export type { WsSw } from '../../src/engine/boot/sw';
export type { PrefetchHandle } from '../../src/engine/boot/shardPrefetch';
/** E357 F2: the runtime owns the contract, so scripts cannot silently drift from it. */
export type { EngineProbe as WildshardProbe } from '../../src/engine/debug/probe';
export type {
  HarnessPins, ProbeWorld, ProbePose, WalkLeg, WalkResult,
  Fingerprint, GameplayState, SoundLog, Saves, GpuBytes, CombatTarget, Vec3, ProbeNav,
} from '../../src/engine/debug/probe';

/** Capture scripts access these handles only after ws:ready. */
declare global { interface Window { __wildshard: ScriptProbe; __wildshardHarness?: ScriptPins } }
