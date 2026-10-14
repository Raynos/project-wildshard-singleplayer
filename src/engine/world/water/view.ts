/** where a water surface is seen from: the player's eye, or Explore's top-down map shot */
export type WaterView = 'eye' | 'top-down';

/**
 * The World Explorer map's top-down shot (src/engine/explore/MiniMap.ts, EXPLORE-V2 V3): 1 while it renders. Straight down the
 * Fresnel term is its 2 % floor, so the pond showed its near-black deep body: a black hole on the map. For the shot the
 * surface reflects like a map reads water: most of the clock's sky over the pond (dawn, noon, night follow on their own).
 * The shared photoreal water's (../waterSurface.ts) uniform; node-safe so a manifest's water rows can name the hook.
 */
export const waterView = { uTopDown: { value: 0 } };

/** the reflect hook of a body drawn with the shared photoreal water (waterSurface.ts): the pond, the creek */
export function surfaceReflect(view: WaterView): void { waterView.uTopDown.value = view === 'top-down' ? 1 : 0; }
