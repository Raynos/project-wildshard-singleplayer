import { bakeSpill as platformBakeSpill, type Emitter as PlatformEmitter } from '@wildshard/game/systems/looks/vertexSpill';

/** Something that glows: its colour, face size, reflection power and spill strength. */
export type Emitter = PlatformEmitter;
/** Bakes emitters' light spill into merged geometry's `aSpill` attribute (SHARD-PLATFORM M3, vertex light spill). */
export const bakeSpill: typeof platformBakeSpill = platformBakeSpill;
