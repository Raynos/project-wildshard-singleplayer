/**
 * Driftwood Isle's trail dressing as rows (SHARD-PLATFORM M3): the rope fences, the plank steps, the trestle flights and the
 * lettered signs that world/trailsideLayout.ts turns into the TrailsideSpec the fixed bake admits. Pure data: a fence
 * either lists its posts' line (`path`) or a path's centreline (`centre`) and the distance its line runs to the centre's
 * left (`offset`, negative = right); `spacing` is its post spacing (default 2.6 m).
 */

/** A fence row: its posts' line, or a centreline and the offset of its line from it, and the post spacing. */
export interface FenceRow { path?: [number, number][]; centre?: [number, number][]; offset?: number; spacing?: number }

/** The trailside rows: fences, plank steps (from → to, width default 2.4 m), trestle flights (top / bottom, width default
 *  1.8 m) and signs (arrow boards top down: heading in radians, 0 = +z, and the place lettered on it). */
export interface TrailsideRows {
  fences: FenceRow[];
  steps: { from: [number, number]; to: [number, number]; width?: number }[];
  flights: { top: [number, number]; bottom: [number, number]; width?: number }[];
  signs: { x: number; z: number; arrows: { toward: number; label?: string }[] }[];
}

/** The island's trailside rows, in the bake's order. */
export const TRAILSIDE_ROWS: TrailsideRows = {
  fences: [
    // both sides of the plateau ramp (the path runs x = −30 from z = −142 up to −104)
    { path: [[-36, -144], [-36, -128], [-36, -112], [-35, -100]] },
    { path: [[-24, -144], [-24, -128], [-24, -112], [-25, -100]] },
    // the plateau's seaward rim, from the ramp top round the south-east
    { path: [[-20, -98], [-6, -100], [6, -94], [14, -82], [18, -68], [16, -52]] },
    // the headland ramp's outer (south-east) edge, 1.8 m off the steps' centreline (x = z), clear of their 2.4 m
    { path: [[41.3, 38.7], [51.3, 48.7], [61.3, 58.7], [71.3, 68.7], [81.3, 78.7]] },
    // (M4) rope fences along the other paths' open stretches: both sides of the shrine approach, the wreck path's
    // seaward side, the pier landing's dune path, the hut → lookout path over the flats
    { centre: [[-72, 20], [-80, 45], [-88, 70], [-94, 88]], offset: 3.4 },
    { centre: [[-72, 20], [-80, 45], [-88, 70], [-94, 88]], offset: -3.4 },
    { centre: [[62, 0], [80, -1.5], [100, -2], [124, 1.5]], offset: -3.4, spacing: 3.2 },
    // the pier's landing (Pier landing: the deck steps down onto the sand at z ≈ −152): rope fences lead off it
    { path: [[2.9, -151], [2.9, -146], [-1.5, -141], [-10, -138]] },
    { path: [[-2.9, -151], [-6.5, -147.5], [-15, -146], [-22, -142]] },
    { centre: [[-8, -50], [14, -24], [17, 8]], offset: 3.4, spacing: 3.2 },
  ],
  steps: [
    { from: [-30, -140], to: [-30, -106] },
    { from: [46, 46], to: [86, 86] },
  ],
  // the hut plateau's rim where the lookout and shrine paths leave it: a 12 m cliff each, inside the Blender cove
  // (its ground is baked, so no grading there — PHYSICS.md §P9b, the user's pick: trestle stairs). Lines found by a
  // search for the lowest stair (≤ 35°) whose treads never sink into the rock.
  flights: [
    { top: [10.8, -27.8], bottom: [15.4, -8.6] },
    { top: [-52, -30], bottom: [-61.7, -5.9] },
  ],
  // E318 (Jake: "letter them"): each board names the place it points to, along the path you take there (the boards
  // pointed south, at the pier and the plateau's rim, before: 2.9 / 2.5 rad are world (sin, cos) ≈ (0.2, −1))
  signs: [
    // pier landing (on the sand): ← the hut, up the fenced path west; ↗ the lookout on the headland, in sight from here
    { x: 5, z: -150, arrows: [{ toward: -1.27, label: 'HUT' }, { toward: 0.35, label: 'LOOKOUT' }] },
    // hut fork: ↗ the lookout and the wreck (one path to the fork at the bridge's foot), ↖ the shrine
    { x: -14, z: -62, arrows: [{ toward: 0.45, label: 'LOOKOUT' }, { toward: 0.75, label: 'WRECK' }, { toward: -0.87, label: 'SHRINE' }] },
  ],
};
