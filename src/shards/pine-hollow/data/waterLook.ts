/**
 * Pine Hollow's photoreal water (PINE-HOLLOW-REMASTER PH-L9; SHARD-PLATFORM W2 C2) as SF59 material graphs: the pond, the
 * creek and beaver pool, the dam's trickle and the rain's puddles wear two programs (still and running water; otherwise the
 * four ids differ only in their params), lent with Pine's other looks (built at build time: generators/lookMaterials.ts) and worn by world/water.ts. No extra render pass:
 *
 *   · REFLECTION = the scene's environment (the clock's sky) along the rippled reflected ray, Fresnel F0 0.02 (water's
 *     ior 1.333). Where the reflected ray would hit the shore instead of the sky its radiance is the forest's: on the pond an
 *     analytic SKYLINE probe (a lent 1-D texture round the pond's centre: per azimuth the height, distance and albedo of the
 *     tallest thing on the horizon, intersected per pixel as a cylinder); on running water a plain elevation cutoff.
 *   · RIPPLES: three scales of one lent tiling normal map drift downwind, their strength and the roughness follow the wind's
 *     gusts; on running water the map rides the flow (uv.y is travel time, so it scrolls downstream at one rate everywhere).
 *     Rain adds rings up close and a rougher surface far off (`rain`, 0 … 1).
 *   · BODY: the per-vertex depth gives the opacity (Beer–Lambert, `kAbs` per metre) and tint (peaty shallow → dark deep);
 *     blended as `a = F + aBody − F·aBody` so the Fresnel reflection is never scaled away by the alpha.
 *   · FOAM: the map's alpha thresholded by a per-vertex amount (the dam, the fall, the plunge ring) plus a broken scum line
 *     at the shore, lit as a white diffuse layer. WET LINE: vertices just above the water (depth < 0) draw a dark glossy film.
 *
 * The lighting stage owns the whole light: the sun's diffuse and GGX glint (shadowed), the sky's diffuse and its reflection
 * (`radiance`, swapped for the forest where occluded, its crowns lit by the scene's sun light, `skyLightColour`); each term
 * is divided by the alpha so the straight-alpha blend writes (spec + body · aBody) over the bed. Vertex data: `uv` (running
 * water only: across metres, travel seconds; still water maps world x / z), `aWater` vec4 = (depth m (< 0 the wet film), flowing 0 | 1, foam 0..1, kAbs per m (< 0 a foam-only
 * overlay)). Fogged half as much as the air (`vertex.scale.fog`).
 */

/** the look.materials ids: the pond (skyline), the creek and beaver pool, the dam's trickle (fading), the rain's puddles */
export const WATER_LOOKS = { pond: 'pine-water-pond', creek: 'pine-water-creek', trickle: 'pine-water-trickle', puddle: 'pine-water-puddle' } as const;

export type WaterLook = keyof typeof WATER_LOOKS;

/** the drawn surfaces as water-surface rows (G466 H7, @wildshard/sdk/looks/waterSurface; world/water.ts draws them): the
 *  creek, fall and plunge ring after the pond, the beaver pool with it, the dam's trickle, the rain's puddles */
export const WATER_SURFACES = {
  creek: { look: WATER_LOOKS.creek, name: 'creek-waterfall', renderOrder: 6 }, pool: { look: WATER_LOOKS.creek, name: 'beaver-pool', renderOrder: 5 },
  trickle: { look: WATER_LOOKS.trickle, name: 'beaver-pool-trickle', renderOrder: 6 }, puddle: { look: WATER_LOOKS.puddle, name: 'puddles', renderOrder: 4 },
} as const;

/** the skyline texture's encoding: R = occluder top above the water (/ top m), G = its distance (/ dist m), B = the
 *  bank's albedo where the ground is the occluder (/ bank; 0 = a tree crown, drawn with the forest's albedo) */
export const SKYLINE = { top: 80, dist: 400, bins: 512, bank: 0.5, earth: 0.12, rock: 0.3 } as const;
