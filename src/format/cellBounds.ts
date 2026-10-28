import { WIRE_CELL } from './wireLimits';
import { isJsonData, isJsonDataSteps } from './json';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const coordinates = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item));

/** Spatial AABBs and cell rectangles use one cell envelope, wherever a section nests them.
 * Navigation voxel envelopes and model-local culling spheres have distinct typed contracts;
 * they are not visual cell AABBs. Admission of their placed draws checks actual world bounds. */
export function assertCellBounds(input: unknown, section = 'shardfile'): void {
  if (!isJsonData(input)) throw new Error('Cell bounds require plain JSON data');
  // T10: builtin iteration (Object.entries) and eager path strings stay: a hand-rolled walk was slower in cold page code
  // (dc806989b0, Chromium phone 4x Pine drive)
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) { const child: unknown = value[i]; if (typeof child === 'object' && child !== null) visit(child, `${path}[${i}]`); } return; }
    if (!record(value)) return;
    const min = value['min'], max = value['max'];
    if (coordinates(min) && coordinates(max) && (min.some((n, axis) => n > (max[axis] ?? -Infinity)) || min[0] < -WIRE_CELL.half || max[0] > WIRE_CELL.half || min[2] < -WIRE_CELL.half || max[2] > WIRE_CELL.half || min[1] < -WIRE_CELL.below || max[1] > WIRE_CELL.above)) throw new Error(`Out-of-cell bounds: ${path}`);
    const rect = [value['x0'], value['x1'], value['z0'], value['z1']];
    if (rect.every((n): n is number => typeof n === 'number' && Number.isFinite(n)) && (rect.some(n => Math.abs(n) > WIRE_CELL.half) || (rect[0] ?? 0) > (rect[1] ?? 0) || (rect[2] ?? 0) > (rect[3] ?? 0))) throw new Error(`Out-of-cell bounds: ${path}`);
    for (const [key, child] of Object.entries(value)) if (typeof child === 'object' && child !== null) visit(child, `${path}.${key}`);
  };
  visit(input, section);
}

/** `assertCellBounds` in steps of `every` visited objects (T10: product admission in a drive's drawn frames): the same fence,
 *  the same checks in the same pre-order and the same refusal messages. The value must not change between steps. */
export function* assertCellBoundsSteps(input: unknown, section = 'shardfile', every = 4096): Generator<void, void> {
  if (!(yield* isJsonDataSteps(input, every))) throw new Error('Cell bounds require plain JSON data');
  // pre-order through a stack: an array's object children and a record's object fields are pushed in reverse
  const values: unknown[] = [input], paths: string[] = [section];
  let since = 0;
  for (let value = values.pop(), path = paths.pop(); path !== undefined; value = values.pop(), path = paths.pop()) {
    if (++since >= every) { since = 0; yield; }
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--) { const child: unknown = value[i]; if (typeof child === 'object' && child !== null) { values.push(child); paths.push(`${path}[${i}]`); } }
      continue;
    }
    if (!record(value)) continue;
    const min = value['min'], max = value['max'];
    if (coordinates(min) && coordinates(max) && (min.some((n, axis) => n > (max[axis] ?? -Infinity)) || min[0] < -WIRE_CELL.half || max[0] > WIRE_CELL.half || min[2] < -WIRE_CELL.half || max[2] > WIRE_CELL.half || min[1] < -WIRE_CELL.below || max[1] > WIRE_CELL.above)) throw new Error(`Out-of-cell bounds: ${path}`);
    const rect = [value['x0'], value['x1'], value['z0'], value['z1']];
    if (rect.every((n): n is number => typeof n === 'number' && Number.isFinite(n)) && (rect.some(n => Math.abs(n) > WIRE_CELL.half) || (rect[0] ?? 0) > (rect[1] ?? 0) || (rect[2] ?? 0) > (rect[3] ?? 0))) throw new Error(`Out-of-cell bounds: ${path}`);
    const entries = Object.entries(value);
    for (let i = entries.length - 1; i >= 0; i--) { const entry = entries[i]; if (entry !== undefined && typeof entry[1] === 'object' && entry[1] !== null) { values.push(entry[1]); paths.push(`${path}.${entry[0]}`); } }
  }
}
