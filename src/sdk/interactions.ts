import * as v from 'valibot';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import { InteractionRules as Rules, InteractionRowsSchema as schema, parseInteractionRows as parseRows, type InteractionRowsData as Data } from '@wildshard/game/quest/interactionRows';

/** Declared interaction rows: transient marks, prompt / crack rows at named spots with ordered needs and their sets (SF72). */
export const InteractionRowsSchema = v.pipe(schema);
/** Validated interaction rows, run by the platform in the browser and the renderer-free host alike. */
export type InteractionRows = Data;
/** Compile authored interaction rows; an unknown field, a duplicate id or act, or an empty `sets` refuses. */
export function parseInteractionRows(input: unknown): Data { return parseRows(input); }

/** Create the shared flag/mark law without installing a clock, renderer or persistence owner. */
export function interactionRules(flags: Pick<Flags, 'has' | 'set'>, data: Data): Rules { return new Rules(flags, data); }
