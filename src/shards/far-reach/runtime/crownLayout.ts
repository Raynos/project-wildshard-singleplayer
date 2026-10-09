import { DAIS } from '../layout';

/**
 * The storm crown's arena (loop 4; mockup D, `art/far-reach/round-11-review/mockup-D-crown-arena.jpg`): a ring of seven
 * weathered standing stones carved with pale wind glyphs, a gap facing the crown bridge (the arena's way in, +z), sagging
 * pennant ropes between their tops, and a low round dais of fitted stone with a compass rose inlaid in its top. It
 * replaces the loop-1 hexagonal pillars that read as one stray post from the arena's entrance.
 */
/** The ring stands close round the dais (loop 5: at the crown's centre and 12.5 m out the arena's entrance framed one stone; at 7.8 m it frames five to seven). */
export const CROWN_RING = { radius: 8, stones: 5, width: 1.4, depth: 0.8 } as const;
/** Stone heights (metres), one per stone round the ring; tallest opposite the entrance, framing the dais. */
const HEIGHTS = [3.6, 4.3, 5.0, 4.4, 3.7] as const;

export interface Stone { readonly x: number; readonly z: number; readonly h: number; readonly yaw: number }
/** The stones in world space (the colliders and the meadow's holes read the same list). */
export function crownStones(): Stone[] {
  const n = CROWN_RING.stones;
  // E392 (mockup D): an arc behind the dais, from the left round to the right, open toward the bridge (+z) so the
  // arena's entrance looks across the dais to the stones, the cloud sea and the sun between them
  // E399 (mockup D, the portrait frame from the entrance): five stones on an 8 m arc behind the dais, 1.15 pi to 1.85 pi,
  // all in the frame and spaced so the cloud sea and the far isles show between them
  const from = Math.PI * 1.15, to = Math.PI * 1.85;
  return Array.from({ length: n }, (_, i) => {
    const a = from + (to - from) * (i / (n - 1)), x = DAIS.x + Math.cos(a) * CROWN_RING.radius, z = DAIS.z + Math.sin(a) * CROWN_RING.radius;
    // each stone's carved face turns to the dais
    return { x, z, h: HEIGHTS[i] ?? 4, yaw: Math.atan2(DAIS.x - x, DAIS.z - z) };
  });
}

