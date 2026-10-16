/** Native ground admission uses the shipping capsule across every entry lane, `walk` m in from its edge: the engine's
 *  edge walk's 50 m (physics/edgeEntries.ts), the depth the prop scatter keeps clear (../generators/propRows.ts). */
export const ENTRY_WALK = { lanes: 23, walk: 50, start: 249.55, maxTicks: 600 } as const;
