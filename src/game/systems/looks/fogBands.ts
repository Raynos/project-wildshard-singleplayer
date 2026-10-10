// fogBands — the window of layered fog bands a ray from the eye can reach (SHARD-PLATFORM M3, ex Nine Dragon's
// look/style.ts Shared.bandWindow, E283). Each band is a Vector4 whose x is its height and y its half-width unit; a band
// reaches 3 units either side of its height. With the bands running top to bottom, a ray going down from the eye reaches
// no band before the first whose bottom is at or under the eye, and a ray going up none after the last whose top is at or
// over it, so a fog program walks only that window, in the same order, with the same test on each: the same fog, bit for
// bit. The window is off (z 0) when the bands stop running top to bottom.
//
//   fogBandWindow(u.uBands.value, u.uCam.value.y, u.uBandWin.value);   // after every eye write
import type { Vector3, Vector4 } from 'three';

/** Write the band window for an eye at height `eyeY` into `out`: x the first band going down, y the last going up, z 1 when the bands are ordered. */
export function fogBandWindow(bands: readonly Vector4[], eyeY: number, out: Vector3): void {
  const B = bands, cy = eyeY;
  let ordered = true, down = B.length, up = -1;
  for (let k = 0; k < B.length; k++) {
    const b = B[k], prev = B[k - 1];
    if (b === undefined) continue;
    if (prev !== undefined && (b.x + 3 * b.y > prev.x + 3 * prev.y || b.x - 3 * b.y > prev.x - 3 * prev.y)) ordered = false;
    if (down === B.length && b.x - 3 * b.y <= cy) down = k;
    if (b.x + 3 * b.y >= cy) up = k;
  }
  out.set(down, up, ordered ? 1 : 0);
}
