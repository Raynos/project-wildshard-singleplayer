import { type parseStalker, parseSkirmisher, parseGuardian, parsePerchHunter } from '@wildshard/format/brains';

/** Data-selected circling melee policy with host-owned perception and attack authority. */
export type SkirmisherData = ReturnType<typeof parseSkirmisher>;
/** Validate archetype data before admitting it into a shard's creature catalogue. */
export function skirmisher(data: unknown): SkirmisherData { return parseSkirmisher(data); }
/** Data-selected interior guardian, with native floor and rise/sink completion ports. */
export type GuardianData = ReturnType<typeof parseGuardian>;
/** Validate an interior guardian policy independently of its native view recipe. */
export function guardian(data: unknown): GuardianData { return parseGuardian(data); }
/** Perch/ground policy retaining trusted perch selection and vertical motion recipes. */
export type PerchHunterData = ReturnType<typeof parsePerchHunter>;
/** Validate a bounded perch hunter's decision parameters. */
export function perchHunter(data: unknown): PerchHunterData { return parsePerchHunter(data); }


/** Admitted circling-melee pattern of the shared stalker archetype. */
export type StalkerData = ReturnType<typeof parseStalker>;
