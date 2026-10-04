import { parseSkirmisher, parseScriptBrain } from '@wildshard/game/shardfile/brains';

/** Data-selected circling melee policy with host-owned perception and attack authority. */
export type SkirmisherData = ReturnType<typeof parseSkirmisher>;
/** Validate archetype data before admitting it into a shard's creature catalogue. */
export function skirmisher(data: unknown): SkirmisherData { return parseSkirmisher(data); }
/** Admitted custom AS policy with host-bound identity, observations, motion bounds and declared strikes. */
export type ScriptBrainData = ReturnType<typeof parseScriptBrain>;
/** Validate a bounded custom creature policy independently from a view or model recipe. */
export function scriptBrain(data: unknown): ScriptBrainData { return parseScriptBrain(data); }
