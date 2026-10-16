/**
 * The Antler King fight's two effect looks as SF59 material graphs (SHARD-PLATFORM W2 C3; the shardfile's
 * `look.materials`, compiled by runtime/index.ts and worn by runtime/antlerKing.ts), ported from the fight's old fog
 * shader and the shared FX program's flame mode:
 *
 * - `fog`: the arena's fog wall, an open cylinder round the clearing (uv.x around, uv.y up). Drifting value noise, thick at
 *   the foot and thin at the top; `colour` is the scene fog's this frame (×1.15), `alpha` the wall's seal. Alpha, unfogged.
 * - `flame`: a fallen lantern burning on the ground, drawn on the SDK effect field's crossed streak quads stood upright
 *   (uv.x up the flame, uv.y across): a flickering tongue, hot white low in its core. `alpha` the burn. Additive, unfogged.
 */

/** the look.materials ids the fight's effects wear */
export const KING_FX_LOOKS = { fog: 'pine-king-fog', flame: 'pine-king-flame' } as const;
