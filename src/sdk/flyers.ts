import { parseOrbitDiver, parsePatrolDiver, parseBurstFlyer } from '@wildshard/game/shardfile/flyers';
import { parsePhasedRaptor } from '@wildshard/game/shardfile/phasedRaptors';

/** Admitted orbit/stalk/dive tuning with a stable home and named sphere strike. */
export type OrbitDiverData = ReturnType<typeof parseOrbitDiver>;
/** Validate an overhead diver while retaining native flight and collision authority. */
export function orbitDiver(data: unknown): OrbitDiverData { return parseOrbitDiver(data); }
/** Admitted player-circle/home-patrol swoop with a held-memory binding. */
export type PatrolDiverData = ReturnType<typeof parsePatrolDiver>;
/** Validate a patrol diver independently of its creature rig and native flight recipe. */
export function patrolDiver(data: unknown): PatrolDiverData { return parsePatrolDiver(data); }
/** Admitted drift/dart/contact burst tuning with host-authorized player impulse data. */
export type BurstFlyerData = ReturnType<typeof parseBurstFlyer>;
/** Validate a burst flyer without publishing a contact, random draw or player impulse. */
export function burstFlyer(data: unknown): BurstFlyerData { return parseBurstFlyer(data); }
/** Admitted phased raptor tuning (SF27, the Storm Roc's shape): perch, take-off, lap and a closing move and strike per phase. */
export type PhasedRaptorData = ReturnType<typeof parsePhasedRaptor>;
/** Validate a phased raptor's declaration before its brain exists; its strikes are named, its perch placed by its shard. */
export function phasedRaptor(data: unknown): PhasedRaptorData { return parsePhasedRaptor(data); }
