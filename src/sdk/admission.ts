import { SHARDFILE_ADMISSION_LIMITS as gameLimits } from '@wildshard/game/shardfile/admissionLimits';
import { preflightShardfile as preflight } from '@wildshard/game/shardfile/preflight';

/** Shared source, collection, identifier, text and distinct wire ceilings for author output and client intake. */
export const SHARDFILE_ADMISSION_LIMITS = Object.freeze({ ...gameLimits });
/** Check bounded plain JSON and declared wire totals before opening any immutable asset. Full validation follows separately. */
export function preflightShardfile(input: unknown): void { preflight(input); }
