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
