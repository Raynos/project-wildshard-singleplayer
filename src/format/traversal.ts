import * as v from 'valibot';
/** Authors may lower the grid's 14 m/s interior board cap; the highway remains platform-owned at 30 m/s. */
export const TraversalSchema = v.strictObject({ hoverCap: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0.1), v.maxValue(14)), 14) });
