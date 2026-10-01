/// <reference types="vite/client" />
// oxlint-disable-next-line typescript/triple-slash-reference -- Ambient module scripts have no exports to import; scripts need their declarations.
/// <reference path="../../src/engine/types/n8ao.d.ts" />
// oxlint-disable-next-line typescript/triple-slash-reference -- Ambient module scripts have no exports to import; scripts need their declarations.
/// <reference path="../../src/engine/types/meshopt-simplifier.d.ts" />
// oxlint-disable-next-line typescript/triple-slash-reference -- Ambient module scripts have no exports to import; scripts need their declarations.
/// <reference path="../../src/engine/physics/rapier-bg.d.ts" />
export type { WsSw } from '../../src/engine/boot/sw';
export type { PrefetchHandle } from '../../src/engine/boot/shardPrefetch';
/** E357 F2: the runtime owns the contract, so scripts cannot silently drift from it. */
export type {
  WildshardProbe, HarnessPins, ProbeWorld, ProbePose, WalkLeg, WalkResult,
  Fingerprint, GameplayState, SoundLog, Saves, GpuBytes, CombatTarget, Vec3, ProbeNav,
} from '../../src/engine/debug/probe';
