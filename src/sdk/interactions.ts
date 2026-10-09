import * as v from 'valibot';
import { InteractionRowsSchema as schema, parseInteractionRows as parseRows, type InteractionRowsData as Data } from '@wildshard/game/quest/interactionRows';

/** Declared interaction rows: transient marks, prompt / crack rows at named spots with ordered needs and their sets (SF72). */
export const InteractionRowsSchema = v.pipe(schema);
/** Validated interaction rows, run by the platform in the browser and the renderer-free host alike. */
export type InteractionRows = Data;
/** Compile authored interaction rows; an unknown field, a duplicate id or act, or an empty `sets` refuses. */
export function parseInteractionRows(input: unknown): Data { return parseRows(input); }
