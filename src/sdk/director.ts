import { parseDirector } from '@wildshard/game/shardfile/director';

/** Typed director data with bounded observations, payloads and reserved grid subscriptions. */
export type DirectorData = ReturnType<typeof parseDirector>;
/** Validate before admitting a bounded module or installing a fixed-step director. */
export function director(data: unknown): DirectorData { return parseDirector(data); }
