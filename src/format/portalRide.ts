/** Complete fixed portal policy carried by the declared portal.ride owner. */
import * as v from 'valibot';

export interface DeclaredPortalRideRows {
  readonly director: string;
  readonly trigger: { readonly front: number; readonly back: number; readonly half: number; readonly feet: number; readonly reach: number };
  readonly fade: { readonly out: number; readonly hold: number; readonly in: number };
  readonly veil: { readonly cls: string; readonly style: Readonly<Record<string, string>> };
  readonly landings: readonly { readonly node: string; readonly fact: string }[];
}
const finite = v.pipe(v.number(), v.finite());
const nonnegative = v.pipe(finite, v.minValue(0)), positive = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
/** The original full numeric ride contract and detached veil declaration.
 * Native director/traversal checks still run before allocating the page owner. */
export const DeclaredPortalRideSchema: v.GenericSchema<DeclaredPortalRideRows> = v.strictObject({
  director: id,
  trigger: v.strictObject({ front: nonnegative, back: nonnegative, half: nonnegative, feet: nonnegative, reach: nonnegative }),
  fade: v.strictObject({ out: positive, hold: nonnegative, in: positive }),
  veil: v.strictObject({ cls: id, style: v.pipe(v.record(id, v.pipe(v.string(), v.maxLength(4096))), v.maxEntries(128)) }),
  landings: v.pipe(v.array(v.strictObject({ node: id, fact: id })), v.maxLength(256)),
});
