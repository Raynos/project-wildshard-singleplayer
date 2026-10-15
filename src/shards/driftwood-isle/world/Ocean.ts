/**
 * Ocean v2 — the faceted, stylized sea of an open-water shard (`ShardManifest.ocean`, Driftwood Isle; DRIFTWOOD-REMASTER
 * W1 + W2 + W3).
 *
 *   const ocean = new Ocean(sky).build();   // reads the manifest's OCEAN
 *   scene.add(ocean.group);                 // ocean.mesh is the surface
 *   ocean.foamAround(its registry piece);     // foam rings wherever a collider box pierces the surface (piles, rocks, hulls)
 *   game.onUpdate((dt) => ocean.update(dt));
 *
 * One mesh: a grid 2.75 m fine (phone: 4 m) over the chunk (plus a margin) that coarsens geometrically out to ~4 km
 * (baked: generators/oceanGrid.ts).
 * - **waves** (W3): four Gerstner waves from `waves.ts` — the same function the boat / swimmer / debris call in TS —
 *   damped over the sand. E151: the lighting and the grade read the waves' analytic normal per pixel (banded into a few
 *   hard-edged tones), not the grid facet's — the phone's 4 m cells drew as big light / dark triangles (the banded
 *   look is the user's pick; the faceted and unbanded looks went in E162).
 * - **depth** (W1): a 512² sea-floor texture baked from the heightfield offline (R = floor height, G = obstacle
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
 * SHARD-PLATFORM M3: the sea is the faceted ocean (runtime/looks/facetedOcean.ts); its surface is a look.materials graph
 * (data/oceanLook.ts); the colours and depth are the manifest's OCEAN.
 */
import { FacetedOcean, type FacetedOceanBake } from '../runtime/looks/facetedOcean';
import { createOwnedGeometry as modelGeometry } from '@wildshard/engine/models/ownedGeometry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { buildTier } from '@wildshard/engine/core/tier';
import { OCEAN } from '../world/sites';
import { OCEAN_FILES } from '../data/oceanFiles';
import { dayLight } from '../look/toon';

/** this build's baked sea, loaded: the grid is 2.75 m fine on desktop, 4 m on the phone (57 k -> 30 k verts; tiers.ts
 *  oceanCell), and the sea floor's heights */
export async function loadOcean(): Promise<FacetedOceanBake> {
  const grid = modelGeometry(OCEAN_FILES[buildTier()], { _depth: 'aDepth', _seed: 'aSeed' });
  const [, floor] = await Promise.all([grid.load(), fetch(OCEAN_FILES.floor, { cache: 'force-cache' }).then(async (r) => {
    if (!r.ok) throw new Error(`Baked sea floor load failed (${String(r.status)})`);
    return new Uint16Array(await r.arrayBuffer());
  })]);
  return { level: OCEAN_FILES.level, grid: grid.take(), floor };
}

export class Ocean extends FacetedOcean {
  constructor(_sky: Sky) {
    super({ light: dayLight }, OCEAN);
  }
}
