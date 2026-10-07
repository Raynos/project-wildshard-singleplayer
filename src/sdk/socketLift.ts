import * as v from 'valibot';
import { SocketLiftSchema as schema, parseSocketLift as parseData, type SocketLift as Data } from '@wildshard/game/shardfile/socketLift';
/** Bounded data-only link from a road socket through an admitted lift to playable ground. */
export const SocketLiftSchema = v.pipe(schema);
/** The platform resolves mover/gate ids, commands and collision; authors supply no callbacks. */
export type SocketLift = Data;
/** Validate the lift declaration before building its world and immutable assets. */
export function parseSocketLift(input: unknown): Data { return parseData(input); }
