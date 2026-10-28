import * as v from 'valibot';
import { CreatureStrikeSchema } from '@wildshard/format/creatures';
import { readSpecies } from '@wildshard/format/speciesPrograms';
import { SocketRigCreatureSchema } from '@wildshard/format/socketRigCreature';

/** The same strict portable strike admission used by native and page population rows. */
export const StrikeSchema: typeof CreatureStrikeSchema = CreatureStrikeSchema;
/** Serializable native strike accepted by the SDK, without an authored callback. */
export type StrikeData = v.InferOutput<typeof StrikeSchema>;
/** Validate a serializable native strike before its trusted engine adapter is constructed. */
export function strike(data: unknown): StrikeData { return v.parse(StrikeSchema, data); }
/** Gameplay-only species fields; the defining declaration lives in the format layer. */
export type SpeciesData = ReturnType<typeof readSpecies>;
/** Refuse malformed species data before registration, actor construction or view creation. */
export function species(data: unknown): SpeciesData { return readSpecies(data); }

/** Admit a socket-dressed creature card, coat and model metadata without constructing a live body. */
export function socketRigCreatureRows(input: unknown): v.InferOutput<typeof SocketRigCreatureSchema> { return v.parse(SocketRigCreatureSchema, input); }
