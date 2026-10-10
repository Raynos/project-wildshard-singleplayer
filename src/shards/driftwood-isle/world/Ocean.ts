/**
 * Ocean v2 — the faceted, stylized sea of an open-water shard (`ShardManifest.ocean`, Driftwood Isle; DRIFTWOOD-REMASTER
 * W1 + W2 + W3).
 *
 *   const ocean = new Ocean(sky).build();   // reads the manifest's OCEAN
 *   scene.add(ocean.group);                 // ocean.mesh is the surface
 *   ocean.foamAround(its registry piece);     // foam rings wherever a collider box pierces the surface (piles, rocks, hulls)
 *   game.onUpdate((dt) => ocean.update(dt));
 *
 * One mesh: a grid 2.75 m fine (phone: 4 m) over the chunk (plus a margin) that coarsens geometrically out to ~4 km.
 * - **waves** (W3): four Gerstner waves from `waves.ts` — the same function the boat / swimmer / debris call in TS —
 *   damped over the sand. E151: the lighting and the grade read the waves' analytic normal per pixel (banded into a few
 *   hard-edged tones), not the grid facet's — the phone's 4 m cells drew as big light / dark triangles (the banded
 *   look is the user's pick; the faceted and unbanded looks went in E162).
 * - **depth** (W1): a 512² sea-floor texture baked from the heightfield at build (R = floor height, G = obstacle
 *   proximity) — per-pixel depth with no depth pre-pass. Beer–Lambert: the water's opacity grows with the view path
 *   through it (depth / |V.y|), so the shallows are clear and the sand, coral and fish show from the pier, then turquoise,
 *   then deep blue. Premultiplied alpha: the lit water body + the reflection are added over the seabed.
 * - **light**: the water body goes through the shard's toon lighting (stylize.ts: lit band / blue-violet shade, so the
 *   pier's shadow lies on the water); on top, a Schlick-fresnel reflection of the sky dome's gradient and a crisp sun
 *   glint that sparkles facet by facet.
 * - **foam** (W2): a breaking band on the shore that breathes with the swell, lines that march in over the shallows,
 *   sparse caps on the highest crests, and rings around everything that stands in the water (`foamAround`).
 * Fogged through the shared atmosphere; transparent, drawn after the world (renderOrder 4). One draw call.
 *
 * SHARD-PLATFORM M3: the sea is the SDK faceted ocean (@wildshard/sdk/looks/facetedOcean); its GLSL is data
 * (data/oceanGlsl.ts), its patch id too (data/oceanLook.ts); the colours and depth are the manifest's OCEAN.
 */
import { FacetedOcean } from '@wildshard/sdk/looks/facetedOcean';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { OCEAN } from '../manifest';
import { islandKnobs } from '../tiers';
import { toonUniforms } from '../look/toon';
import { OCEAN_GLSL } from '../data/oceanGlsl';
import { OCEAN_PATCH } from '../data/oceanLook';

export class Ocean extends FacetedOcean {
  /** the grid is 2.75 m fine on desktop, 4 m on the phone (57 k -> 30 k verts) */
  constructor(sky: Sky) {
    super(sky, { glsl: OCEAN_GLSL, patchId: OCEAN_PATCH.id, patchKey: OCEAN_PATCH.key, cell: islandKnobs().oceanCell, light: toonUniforms }, OCEAN);
  }
}
