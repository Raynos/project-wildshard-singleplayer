import { WIRE_CELL } from './wireLimits';
import { isJsonData } from './json';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const coordinates = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item));

/** Spatial AABBs and cell rectangles use one cell envelope, wherever a section nests them.
 * Navigation voxel envelopes and model-local culling spheres have distinct typed contracts;
 * they are not visual cell AABBs. Admission of their placed draws checks actual world bounds. */
export function assertCellBounds(input: unknown, section = 'shardfile'): void {
  if (!isJsonData(input)) throw new Error('Cell bounds require plain JSON data');
  // T10: the walk keeps its path as a stack of steps and spells it only for a refusal (a string per node, and a pair array
  // and a corner array per object, were most of this walk in a Pine crossing's product admission at phone 4x)
  const steps: (string | number)[] = [];
  const path = (): string => { let text = section; for (const step of steps) text += typeof step === 'number' ? `[${String(step)}]` : `.${step}`; return text; };
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) { const child: unknown = value[i]; if (typeof child === 'object' && child !== null) { steps.push(i); visit(child); steps.pop(); } }
      return;
    }
    if (!record(value)) return;
    const min = value['min'], max = value['max'];
    if (coordinates(min) && coordinates(max) && (min.some((n, axis) => n > (max[axis] ?? -Infinity)) || min[0] < -WIRE_CELL.half || max[0] > WIRE_CELL.half || min[2] < -WIRE_CELL.half || max[2] > WIRE_CELL.half || min[1] < -WIRE_CELL.below || max[1] > WIRE_CELL.above)) throw new Error(`Out-of-cell bounds: ${path()}`);
    const x0 = value['x0'], x1 = value['x1'], z0 = value['z0'], z1 = value['z1'];
    if (finite(x0) && finite(x1) && finite(z0) && finite(z1) && (Math.abs(x0) > WIRE_CELL.half || Math.abs(x1) > WIRE_CELL.half || Math.abs(z0) > WIRE_CELL.half
      || Math.abs(z1) > WIRE_CELL.half || x0 > x1 || z0 > z1)) throw new Error(`Out-of-cell bounds: ${path()}`);
    for (const key of Object.keys(value)) { const child = value[key]; if (typeof child === 'object' && child !== null) { steps.push(key); visit(child); steps.pop(); } }
  };
  visit(input);
}
