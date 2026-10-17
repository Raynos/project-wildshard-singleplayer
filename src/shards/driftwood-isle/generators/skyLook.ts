// G466 C2: the graphs are authored graph JSON (data/lookGraphs.json).

/**
 * Driftwood's faceted sky (DRIFTWOOD-REMASTER L2, the user's pick D2) as two SF59 material graphs (SHARD-PLATFORM W2 C2;
 * the shardfile's `look.materials`, compiled through the runtime look catalogue by the sky backdrop on the page renderer, before the
 * world stage, so the dome is drawn and PMREM'd from its first frame): unlit, unfogged, no depth write.
 *
 * - **dome** (`SKY_DOME_LOOK`): a saturated zenith → pale horizon gradient by the view direction's height, the colour
 *   below the horizon, a thin bright band on it, a glow round the sun (dimmed at night) and, at night, stars on a hashed
 *   cell grid (twinkle-free). The backdrop draws it back-faced with no depth test, behind everything.
 * - **cumulus** (`SKY_CLOUD_LOOK`): one icosahedron instanced per puff row (`aPuff` its centre and radius, `aLump` its
 *   lump phases and the cut its base is flattened at; data/cumulusPuffs.json), lumped and squashed in the vertex stage,
 *   turned slowly about the dome's centre on the frame clock (a full turn in ~3 h), faceted by derivative normals, lit in
 *   a two-band sun ramp (lit / shade), darker flat bellies, a silver-lining fresnel on rims facing away from the eye
 *   when the sun is behind them, the lowest puffs melting into the horizon haze.
 *
 * The palette is params (linear RGB, pre-tonemap, as the day clock blends it): the clock writes them every frame through
 * the compiled graphs' checked `setParam`; `night` 0 … 1; `sunDir` the unit direction toward the sun (or the moon).
 */

/** the look.materials id of the dome */
export const SKY_DOME_LOOK = 'driftwood-sky-dome';
/** the look.materials id of the cumulus ring */
export const SKY_CLOUD_LOOK = 'driftwood-sky-cumulus';
