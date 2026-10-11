import * as v from 'valibot';
import generatedFronts from '../data/fronts.generated.json' with { type: 'json' };
import generatedFloors from '../data/floorBoxes.generated.json' with { type: 'json' };

const finite = v.pipe(v.number(), v.finite());
const extent = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const Box = v.strictObject({ kind: v.literal('box'), x: finite, y: finite, z: finite,
  hx: extent, hy: extent, hz: extent, surface: v.literal('stone') });
type Shape = v.InferOutput<typeof Box>;
const group = (length: number) => v.pipe(v.array(Box), v.length(length));
const fronts = v.parse(group(10), generatedFronts);
const floors = v.parse(v.strictObject({ street: group(1), stairTop: group(1), well: group(5), stairLandings: group(2), guard: group(2) }), generatedFloors);
function copy(rows: readonly Shape[]): Shape[] {
  return rows.map(({ kind, x, y, z, hx, hy, hz, surface }) => ({ kind, x, y, z, hx, hy, hz, surface }));
}

/** Fresh front descriptors for the existing world piece; generated source arrays remain unowned. */
export function frontBoxes(): Shape[] { return copy(fronts); }
/** Fresh descriptors for one original floor/guard group; the caller retains its existing collider owner. */
export function floorBoxes(name: keyof typeof floors): Shape[] { return copy(floors[name]); }
