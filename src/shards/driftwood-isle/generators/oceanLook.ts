// SHARD-PLATFORM W2c: the graphs are built only at build time (generators/oceanGraphs.ts → data/lookMaterials.generated.json).

/**
 * Driftwood's open sea (runtime/looks/facetedOcean.ts, world/Ocean.ts) as an SF59 material graph (SHARD-PLATFORM W2 C2;
 * the shardfile's `look.materials`, compiled by the hybrid runtime with the reef and the pools). The toon family's light
 * model (the catalogue's live toon look, following the day clock: game/looks/toonLook.ts `followToonLook`) without its caustics
 * (`toonCaustics: false`: none on the sea surface itself), double-sided in one pass, alpha blended, depth written.
 *
 * - **vertex**: the shared Gerstner swell (`gerstner`, the same coefficients the boats and swimmers read) on the frame's
 *   wave clock (`clock`, the runtime's), damped over the sand from the vertex's still depth (`aDepth`, waves.ts
 *   `seaDamp`), plus a small lateral wobble per vertex (`aSeed`) so the grid never reads as a grid. The lighting normal
 *   is the waves' own smooth normal (`gerstnerNormal` at the rest point, E151), not the grid facet's.
 * - **water body**: the sea floor under the pixel from the lent sea-floor texture (`tSea`: R floor height, G obstacle
 *   proximity; off the chunk the edge's floor sinks over 260 m), Beer–Lambert opacity from the view path through the
 *   column, turquoise lagoon → cobalt by still depth, graded by the per-pixel wave normal in hard 10 % steps one pixel
 *   wide (fwidth), tinted deep teal-blue at night (`night`, the day clock's toon night).
 * - **foam** (W2): three thin broken lace lines breathing with the swell along the shore, rings round whatever stands in
 *   the water (from the G proximity field, wobbled wider than a texel), sparse caps on the highest crests out deep.
 * - **reflection and glint**, added after lighting through `emissive`: a Schlick-fresnel reflection of the fog ramp's
 *   horizon → zenith and a crisp sun glint that sparkles cell by cell; foam reads sun white. From below (W4): Snell's
 *   window, the sky inside ~49° of straight up, the deep water's mirror outside it.
 * - **edges**: discarded outside the level's open-water square less its inset (`waterHalf`, `edgeInset`) and inside the
 *   four dry entry sockets (`dry0` … `dry3`: minX, minZ, maxX, maxZ; an empty rectangle clips nothing); faded out over
 *   the last 300 m before the painted horizon (`seaEnd`).
 *
 * The classic sea was premultiplied (lit body × alpha + reflection); straight alpha with `emissive` = reflection / alpha
 * is the same colour after the fog epilogue and the blend.
 */

/** the look.materials id the sea wears */
export const OCEAN_LOOK = 'driftwood-ocean';
/** the dry rectangles the sea can clip (params `dry0` … `dry3`) */
export const OCEAN_DRY_SLOTS = 4;
/** an empty dry rectangle (min past max): clips nothing */
export const OCEAN_NO_DRY: readonly [number, number, number, number] = [1e9, 1e9, -1e9, -1e9];

/** the sea-floor texture's resolution (texels per side; generators/oceanGrid.ts bakes it) */
export const SEA_RES = 512;

/** the sea as a water-surface row (G466 H7, @wildshard/sdk/looks/waterSurface; world/Ocean.ts draws it) */
export const OCEAN_SURFACE = { look: OCEAN_LOOK, name: OCEAN_LOOK, renderOrder: 4, culled: false, waves: true,
  bind: { clock: 'clock', waterHalf: 'waterHalf', chunkHalf: 'chunkHalf' },
  floor: { texture: 'tSea', res: SEA_RES, foamReach: 3, foamBand: 0.3 }, dry: { prefix: 'dry', slots: OCEAN_DRY_SLOTS, none: OCEAN_NO_DRY } } as const;
