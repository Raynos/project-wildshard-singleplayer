import { WIRE_CELL } from './wireLimits';
import { isJsonData } from './json';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const coordinates = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item));

/** Spatial AABBs and cell rectangles use one cell envelope, wherever a section nests them.
 * Navigation voxel envelopes and model-local culling spheres have distinct typed contracts;
 * they are not visual cell AABBs. Admission of their placed draws checks actual world bounds. */
export function assertCellBounds(input: unknown, section = 'shardfile'): void {
  if (!isJsonData(input)) throw new Error('Cell bounds require plain JSON data');
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) visit(value[i], `${path}[${i}]`); return; }
    if (!record(value)) return;
    const min = value['min'], max = value['max'];
    if (coordinates(min) && coordinates(max) && (min.some((n, axis) => n > (max[axis] ?? -Infinity)) || min[0] < -WIRE_CELL.half || max[0] > WIRE_CELL.half || min[2] < -WIRE_CELL.half || max[2] > WIRE_CELL.half || min[1] < -WIRE_CELL.below || max[1] > WIRE_CELL.above)) throw new Error(`Out-of-cell bounds: ${path}`);
    const rect = [value['x0'], value['x1'], value['z0'], value['z1']];
    if (rect.every((n): n is number => typeof n === 'number' && Number.isFinite(n)) && (rect.some(n => Math.abs(n) > WIRE_CELL.half) || (rect[0] ?? 0) > (rect[1] ?? 0) || (rect[2] ?? 0) > (rect[3] ?? 0))) throw new Error(`Out-of-cell bounds: ${path}`);
    for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
  };
  visit(input, section);
}
