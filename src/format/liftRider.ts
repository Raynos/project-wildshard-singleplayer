import * as v from 'valibot';

/** Stable edge identity only: no historical pose, native handle or author function enters a rider checkpoint. */
export const LiftRiderSchema = v.nullable(v.picklist(['north', 'east', 'south', 'west']));
/** A rider reloads at its admitted road boarding point; other player progress keeps its existing save policy. */
export type LiftRider = v.InferOutput<typeof LiftRiderSchema>;
