import { parseRamGrazer, parseChallengeGrazer, parseGrazer } from '@wildshard/format/grazers';

/** Admitted rim-aware ram policy with named strikes and host-owned home, terrain and random stream. */
export type RamGrazerData = ReturnType<typeof parseRamGrazer>;
/** Validate ram-grazer data independently of a creature's native rig and collision recipes. */
export function ramGrazer(data: unknown): RamGrazerData { return parseRamGrazer(data); }
/** Admitted challenge policy with declared charge/close utility and renderer pose field bindings. */
export type ChallengeGrazerData = ReturnType<typeof parseChallengeGrazer>;
/** Validate a timed challenge grazer while retaining trusted navigation, actor phase and contact ownership. */
export function challengeGrazer(data: unknown): ChallengeGrazerData { return parseChallengeGrazer(data); }

/** Admitted parametric grazer row, with a wandering-ram or circular-challenge attack pattern. */
export type GrazerData = ReturnType<typeof parseGrazer>;
/** Emit validated grazer data; the game host supplies existing body and contact recipes. */
export function grazer(data: unknown): GrazerData { return parseGrazer(data); }
