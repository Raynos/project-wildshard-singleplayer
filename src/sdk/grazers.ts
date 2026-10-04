import { parseRamGrazer } from '@wildshard/game/shardfile/grazers';

/** Admitted rim-aware ram policy with named strikes and host-owned home, terrain and random stream. */
export type RamGrazerData = ReturnType<typeof parseRamGrazer>;
/** Validate ram-grazer data independently of a creature's native rig and collision recipes. */
export function ramGrazer(data: unknown): RamGrazerData { return parseRamGrazer(data); }
