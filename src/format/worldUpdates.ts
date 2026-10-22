import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const order = { system: id, before: v.pipe(v.array(id), v.maxLength(16)), after: v.exactOptional(v.pipe(v.array(id), v.maxLength(16))) };
/** Native owner/registration glue only. Rows never contain a clock, phase, math law or callback. */
export const WorldUpdatesSchema = v.pipe(v.unknown(), v.check(isJsonData, 'World updates require plain JSON data'), v.array(v.variant('kind', [
  v.strictObject({ kind: v.literal('wind'), ...order }),
  v.strictObject({ kind: v.literal('painted-world'), ...order, world: id, weather: id }),
  v.strictObject({ kind: v.literal('rope-deck'), ...order, deck: id, chain: id }),
  v.strictObject({ kind: v.literal('toon-look'), ...order, look: id }),
  v.strictObject({ kind: v.literal('buildings'), ...order, owner: id }),
])), v.minLength(1), v.maxLength(32));
export type WorldUpdatesRows = v.InferOutput<typeof WorldUpdatesSchema>;
