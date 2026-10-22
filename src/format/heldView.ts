import * as v from 'valibot';
import { ToonArmsLookSchema } from './heldArms';
import { GraphArmsSchema } from './graphArmsRows';

/** G601 C10: a held view (first-person arms and what they hold) as one row family, its look kind choosing how its rig is
 *  dressed: `toon` (toon-family looks, two blades and swimming hands lit by the day) or `graph` (graph looks with their
 *  maps, weave, decals, pendants, swing trail and per-frame writes). Rig, socket and material ids only; no callbacks. */
export const HeldViewSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('toon'), ...ToonArmsLookSchema.entries }),
  v.strictObject({ kind: v.literal('graph'), ...GraphArmsSchema.entries }),
]);
export type HeldViewRow = v.InferOutput<typeof HeldViewSchema>;
/** Admit a held view before its rig loads or any look is borrowed. */
export function parseHeldView(input: unknown): HeldViewRow { return v.parse(HeldViewSchema, input); }
