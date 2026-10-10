/** A sampled fence polyline and its post spacing. */
export interface FenceSpec { path: [number, number][]; spacing?: number }
/** A terrain-following line of plank steps. */
export interface StepsSpec { from: [number, number]; to: [number, number]; width?: number }
/** a trestle stair down a cliff the path crosses: straight from the top (on the upper ground) to the bottom (on the path below) */
/** A trestle flight from lower ground to upper ground. */
export interface FlightSpec { top: [number, number]; bottom: [number, number]; width?: number }
/** A sign location and its lettered arrow headings. */
export interface SignSpec { x: number; z: number; /** arrow boards, top down: heading in radians (0 = +z: world (sin, cos)) and the place lettered on it */ arrows: { toward: number; label?: string }[] }
/** The authored trail dressing layout admitted by the fixed bake. */
export interface TrailsideSpec { fences: FenceSpec[]; steps: StepsSpec[]; signs: SignSpec[]; flights?: FlightSpec[] }

/** a polyline moved `d` m to its left (negative: right), for fences either side of a path's centreline */
function offset(path: [number, number][], d: number): [number, number][] {
  return path.map(([x, z], i) => {
    const a = path[Math.max(0, i - 1)] ?? [x, z], b = path[Math.min(path.length - 1, i + 1)] ?? [x, z];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [x - (dz / l) * d, z + (dx / l) * d];
  });
}

/** The original island fence, plank, sign and trestle layout. */
export function islandTrailsideSpec(): TrailsideSpec {
    return {
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
        { path: offset([[-72, 20], [-80, 45], [-88, 70], [-94, 88]], 3.4) },
        { path: offset([[-72, 20], [-80, 45], [-88, 70], [-94, 88]], -3.4) },
        { path: offset([[62, 0], [80, -1.5], [100, -2], [124, 1.5]], -3.4), spacing: 3.2 },
        // the pier's landing (Pier landing: the deck steps down onto the sand at z ≈ −152): rope fences lead off it
        { path: [[2.9, -151], [2.9, -146], [-1.5, -141], [-10, -138]] },
        { path: [[-2.9, -151], [-6.5, -147.5], [-15, -146], [-22, -142]] },
        { path: offset([[-8, -50], [14, -24], [17, 8]], 3.4), spacing: 3.2 },
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
  }

/** A flight's frame: along (bottom → top) and across unit vectors, its width, tread count, run and rise per tread. */
export function flightOf(f: FlightSpec, heightAt: (x: number, z: number) => number): { ux: number; uz: number; sx: number; sz: number; len: number; yb: number; yt: number; w: number; m: number; run: number; rise: number } {
  const dx = f.top[0] - f.bottom[0], dz = f.top[1] - f.bottom[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  const yb = heightAt(f.bottom[0], f.bottom[1]), yt = heightAt(f.top[0], f.top[1]) + 0.02;
  // risers ≤ 0.28 m and treads ≥ 0.36 m deep (the character's stair rule, below)
  const m = Math.max(1, Math.ceil((yt - yb) / 0.28));
  return { ux, uz, sx: uz, sz: -ux, len, yb, yt, w: f.width ?? 1.8, m, run: len / m, rise: (yt - yb) / m };
}

/** Layout identity with explicit defaults, independent of property insertion order. */
export function trailsideSpecKey(spec: TrailsideSpec): string {
  return JSON.stringify({
    fences: spec.fences.map(f => [f.path, f.spacing ?? 2.6]),
    steps: spec.steps.map(s => [s.from, s.to, s.width ?? 2.4]),
    signs: spec.signs.map(s => [s.x, s.z, s.arrows.map(a => [a.toward, a.label ?? ''])]),
    flights: (spec.flights ?? []).map(f => [f.top, f.bottom, f.width ?? 1.8]),
  });
}
