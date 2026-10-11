import { parseDiver, parseOrbitDiver, parsePatrolDiver, parseBurstFlyer } from '@wildshard/format/flyers';

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

/** Admitted orbit, patrol or burst data for the shared diver archetype. */
export type DiverData = ReturnType<typeof parseDiver>;
/** Emit validated flight-pattern data, leaving bodies and contacts with the native host. */
export function diver(data: unknown): DiverData { return parseDiver(data); }
