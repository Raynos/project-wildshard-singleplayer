import { parseSkirmisher } from '@wildshard/game/shardfile/brains';

/** Data-selected circling melee policy with host-owned perception and attack authority. */
export type SkirmisherData = ReturnType<typeof parseSkirmisher>;
/** Validate archetype data before admitting it into a shard's creature catalogue. */
export function skirmisher(data: unknown): SkirmisherData { return parseSkirmisher(data); }
