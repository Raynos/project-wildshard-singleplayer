import { GridAssembly } from '../src/game/grid/assembly';
import { roadLayout } from '../src/game/grid/roadLayout';
import { CHUNK_HALF } from '../src/engine/core/config';

/** One actual world-space camera and target; light is an existing Debug time pick. */
export interface AerialHeroPose {
  readonly id: string;
  readonly name: string;
  readonly mode: 'grid';
  readonly eye: { readonly x: number; readonly y: number; readonly z: number };
  readonly target: { readonly x: number; readonly y: number; readonly z: number };
  readonly downDegrees: number;
  readonly timePick: 'midday' | 'golden' | 'sunset';
}

/** Fifteen G332 round-2 views, derived from the shipping layout, never a staged scene. */
export function aerialHeroPlan(): { junction: string; surrounding: readonly string[]; poses: AerialHeroPose[] } {
  const grid = new GridAssembly({ developer: true, devserver: false });
  const template = grid.cells.find(cell => cell.slug === '_template');
  if (template === undefined) throw new Error('Aerial shoot requires the real template cell');
  const layout = roadLayout(grid, slug => slug);
  const candidates = layout.junctions.filter(junction => junction.roundabout);
  candidates.sort((a, b) => Math.hypot(a.centre.x - template.origin.x, a.centre.z - template.origin.z)
    - Math.hypot(b.centre.x - template.origin.x, b.centre.z - template.origin.z));
  const junction = candidates.at(0);
  if (junction === undefined) throw new Error('No central roundabout');
  const target = { ...junction.centre, y: 0 };
  const poses: AerialHeroPose[] = [];
  const add = (id: string, name: string, eye: AerialHeroPose['eye'], timePick: AerialHeroPose['timePick'], sweep = 0): void => {
    // The sweep is a small real aim change, not a moved shard or altered lens.
    const dx = target.x - eye.x, dz = target.z - eye.z;
    const look = { x: eye.x + dx * Math.cos(sweep) - dz * Math.sin(sweep), y: target.y,
      z: eye.z + dx * Math.sin(sweep) + dz * Math.cos(sweep) };
    poses.push({ id, name, mode: 'grid', eye, target: look, timePick,
      downDegrees: Math.atan2(eye.y - look.y, Math.hypot(eye.x - look.x, eye.z - look.z)) * 180 / Math.PI });
  };
  for (const [id, height, down, heading, time] of [
    ['A', 30, 45, 45, 'golden'], ['B', 60, 55, 135, 'golden'],
    ['C', 90, 60, 225, 'midday'], ['D', 120, 65, 315, 'sunset'],
    ['E', 150, 70, 45, 'golden'], ['F', 100, 50, 100, 'sunset'],
  ] as const) {
    const radius = height / Math.tan(down * Math.PI / 180), angle = heading * Math.PI / 180;
    add(id, 'Free aerial', { x: target.x + radius * Math.sin(angle), y: height, z: target.z + radius * Math.cos(angle) }, time);
  }
  const centre = template.origin;
  const corner = { x: centre.x + Math.sign(target.x - centre.x) * CHUNK_HALF,
    z: centre.z + Math.sign(target.z - centre.z) * CHUNK_HALF };
  const midpoint = { x: (corner.x + centre.x) / 2, z: (corner.z + centre.z) / 2 };
  for (const [group, label, at, heights] of [
    ['E2', 'Template corner', corner, [45, 75, 100]],
    ['M', 'Corner-centre midpoint', midpoint, [70, 110, 150]],
    ['T', 'Template centre', centre, [80, 115, 150]],
  ] as const) {
    for (const [index, height] of heights.entries()) {
      add(`${group}-${String.fromCodePoint(97 + index)}`, label, { x: at.x, y: height, z: at.z },
        index === 1 ? 'midday' : index === 2 ? 'sunset' : 'golden', (index - 1) * 3 * Math.PI / 180);
    }
  }
  return { junction: junction.id, surrounding: grid.cells.filter(cell =>
    Math.abs(cell.origin.x - target.x) < grid.pitch && Math.abs(cell.origin.z - target.z) < grid.pitch).map(cell => cell.instance), poses };
}

/** One G332 round-3 desktop-landscape view: an actual eye aimed exactly at the roundabout, so it sits at frame centre. */
export interface LandscapeHeroPose {
  readonly id: string;
  readonly name: string;
  readonly mode: 'grid';
  readonly eye: { readonly x: number; readonly y: number; readonly z: number };
  readonly target: { readonly x: number; readonly y: number; readonly z: number };
  readonly downDegrees: number;
  /** Compass of the eye around the roundabout; 45° is M-b's corner–centre diagonal over the template. */
  readonly headingDegrees: number;
  /** Where each surrounding cell's centre falls in frame: left / centre / right of the roundabout, nearer or farther. */
  readonly placement: readonly { readonly instance: string; readonly side: 'left' | 'centre' | 'right'; readonly depth: 'near' | 'far' }[];
  /** G344: a capture-time vertical field of view for this shot only (the game's CAMERA_FOV never changes); absent = the game's own */
  readonly fovDegrees?: number;
  /** G344: which frame the shot is for (the square portrait band, or the desktop landscape); absent = landscape (round 3) */
  readonly aspect?: 'square' | 'landscape';
}

/** One shot aimed exactly at `target` from `headingDegrees` round it, `distance` metres away on the ground, `height` up. */
function aimedPose(target: LandscapeHeroPose['target'], cells: readonly { readonly instance: string; readonly origin: { readonly x: number; readonly z: number } }[],
  shot: { id: string; name: string; headingDegrees: number; height: number; distance: number; fovDegrees?: number; aspect?: 'square' | 'landscape' }): LandscapeHeroPose {
  const angle = shot.headingDegrees * Math.PI / 180;
  const eye = { x: target.x + shot.distance * Math.sin(angle), y: shot.height, z: target.z + shot.distance * Math.cos(angle) };
  // three.js right axis for a camera looking along f with +y up is (-f.z, 0, f.x).
  const fx = target.x - eye.x, fz = target.z - eye.z;
  const placement = cells.map(cell => {
    const dx = cell.origin.x - target.x, dz = cell.origin.z - target.z;
    const across = dx * -fz + dz * fx, along = dx * fx + dz * fz;
    // Within 20° of the line of sight reads as centre.
    const side = Math.abs(Math.atan2(across, along)) < Math.PI / 9 || Math.abs(Math.atan2(across, -along)) < Math.PI / 9
      ? 'centre' as const : across < 0 ? 'left' as const : 'right' as const;
    return { instance: cell.instance, side, depth: along > 0 ? 'far' as const : 'near' as const, across };
  }).sort((a, b) => a.across - b.across).map(({ instance, side, depth }) => ({ instance, side, depth }));
  return { id: shot.id, name: shot.name, mode: 'grid', eye, target, headingDegrees: shot.headingDegrees,
    downDegrees: Math.atan2(eye.y - target.y, Math.hypot(fx, fz)) * 180 / Math.PI, placement,
    ...(shot.fovDegrees === undefined ? {} : { fovDegrees: shot.fovDegrees }), ...(shot.aspect === undefined ? {} : { aspect: shot.aspect }) };
}

/** Round 3 (Jake on M-b: "we need to capture this on desktop landscape"): M-b's spot, a tilt down, and headings around it. */
export function landscapeHeroPlan(): { junction: string; surrounding: readonly string[]; poses: LandscapeHeroPose[] } {
  const round2 = aerialHeroPlan();
  const mb = round2.poses.find(pose => pose.id === 'M-b');
  if (mb === undefined) throw new Error('Round 3 starts from round 2 M-b');
  const grid = new GridAssembly({ developer: true, devserver: false });
  const cells = grid.cells.filter(cell => round2.surrounding.includes(cell.instance));
  const target = mb.target;
  const radius = Math.hypot(mb.eye.x - target.x, mb.eye.z - target.z);
  const poses: LandscapeHeroPose[] = [];
  const add = (id: string, name: string, headingDegrees: number, height: number, distance = radius): void => {
    poses.push(aimedPose(target, cells, { id, name, headingDegrees, height, distance }));
  };
  add('L-a', 'M-b spot, landscape', 45, mb.eye.y);
  add('L-b', 'M-b spot, tilted down', 45, 135);
  add('L-c', 'Swung toward Pine', 25, 120);
  add('L-d', 'Swung toward Nalati', 65, 120);
  add('L-e', 'Down the road, 2 × 2', 0, 120, 200);
  return { junction: round2.junction, surrounding: round2.surrounding, poses };
}

/** G344's phone-1x lens: about 70° across a 16:9 frame (43° vertical) and 62° each way for the square, a ~26 mm lens. */
export const HERO_1X_FOV = { landscape: 43, square: 62 } as const;

/**
 * G344 (Jake on L-b: "it looks like 0.5x zoom … too fisheye"): the interim L-b re-shot at a phone-1x field of view, as
 * a square for the portrait centre band (G341 B) and a landscape for desktop (A). Same roundabout, same 45° heading over
 * the template; the narrower lens steps the camera back along L-b's line (and lower in angle, so a strip of sky stays),
 * so Pine (left), Nalati (right), Driftwood (far) and template-2 (near) still fit. `slant` is the eye-to-roundabout
 * distance; each aspect has a pick and two neighbours (farther, steeper).
 */
export function squareHeroPlan(): { junction: string; surrounding: readonly string[]; poses: LandscapeHeroPose[] } {
  const round3 = landscapeHeroPlan();
  const lb = round3.poses.find(pose => pose.id === 'L-b');
  if (lb === undefined) throw new Error('G344 starts from round 3 L-b');
  const grid = new GridAssembly({ developer: true, devserver: false });
  const cells = grid.cells.filter(cell => round3.surrounding.includes(cell.instance));
  const poses: LandscapeHeroPose[] = [];
  for (const [id, name, aspect, slant, down] of [
    ['SQ-a', 'Square, L-b line stepped back', 'square', 600, 28],
    ['SQ-b', 'Square, farther back', 'square', 700, 28],
    ['SQ-c', 'Square, higher and steeper', 'square', 600, 34],
    ['LS-a', 'Landscape, L-b line stepped back', 'landscape', 520, 21],
    ['LS-b', 'Landscape, farther back', 'landscape', 600, 21],
    ['LS-c', 'Landscape, higher and steeper', 'landscape', 520, 26],
  ] as const) {
    const radians = down * Math.PI / 180;
    poses.push(aimedPose(lb.target, cells, { id, name, headingDegrees: lb.headingDegrees, aspect, fovDegrees: HERO_1X_FOV[aspect],
      height: Math.round(slant * Math.sin(radians)), distance: Math.round(slant * Math.cos(radians)) }));
  }
  return { junction: round3.junction, surrounding: round3.surrounding, poses };
}
