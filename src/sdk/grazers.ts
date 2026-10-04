import { parseRamGrazer, parseChallengeGrazer } from '@wildshard/game/shardfile/grazers';

/** Admitted rim-aware ram policy with named strikes and host-owned home, terrain and random stream. */
export type RamGrazerData = ReturnType<typeof parseRamGrazer>;
/** Validate ram-grazer data independently of a creature's native rig and collision recipes. */
export function ramGrazer(data: unknown): RamGrazerData { return parseRamGrazer(data); }
/** Admitted challenge policy with declared charge/close utility and renderer pose field bindings. */
export type ChallengeGrazerData = ReturnType<typeof parseChallengeGrazer>;
/** Validate a timed challenge grazer while retaining trusted navigation, actor phase and contact ownership. */
export function challengeGrazer(data: unknown): ChallengeGrazerData { return parseChallengeGrazer(data); }
