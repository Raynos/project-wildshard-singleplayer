import * as v from 'valibot';
import { isJsonData } from './json';

const name = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
const coordinate = v.pipe(v.number(), v.finite(), v.minValue(-250), v.maxValue(250));
const point = v.tuple([coordinate, coordinate, coordinate]);
const approach = v.pipe(v.strictObject({
  colliders: v.pipe(v.array(name), v.minLength(1), v.maxLength(32)),
  route: v.pipe(v.array(point), v.minLength(2), v.maxLength(16)),
}), v.check(row => new Set(row.colliders).size === row.colliders.length
  && row.route.every(position => position[1] === 0 && Math.abs(position[0]) <= 240 && Math.abs(position[2]) <= 240),
'unique static approach colliders and road-height route inside the ten metre inset'));
/** A bounded entry ride names admitted mover/gate rows and feet-level stops; the route is walked, never teleported. */
export const SocketLiftSchema = v.pipe(v.strictObject({ mover: name, gate: name,
  roadStop: point, topStop: point, route: v.pipe(v.array(point), v.minLength(2), v.maxLength(32)),
  rideTicks: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(3600)), approach: v.exactOptional(approach),
}), v.check(row => row.mover !== row.gate && row.roadStop[1] === 0 && row.topStop[1] > 0
  && row.route[0]?.every((value, axis) => value === row.topStop[axis]) === true,
'socket lift requires distinct mover/gate, road height zero and an onward route starting at its top stop'));
/** Data-only lift link; gameplay commands and physics remain platform-owned. */
export type SocketLift = v.InferOutput<typeof SocketLiftSchema>;
/** Parse without invoking an accessor or serializer from an author object. */
export function parseSocketLift(input: unknown): SocketLift {
  if (!isJsonData(input)) throw new Error('Socket lift must be JSON data only');
  return v.parse(SocketLiftSchema, input);
}
