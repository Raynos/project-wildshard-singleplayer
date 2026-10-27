import { parseBossProfile as parse, type BossProfile } from '@wildshard/format/bossProfiles';

/** Admit data-only arena, roaming, spawned, held and script boss policies through the defining runtime schema.
 * This authoring boundary constructs no fight, body, level or service. */
export function parseBossProfile(input: unknown): BossProfile { return parse(input); }
