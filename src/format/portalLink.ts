import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
const coordinate = v.pipe(v.number(), v.finite(), v.minValue(-250), v.maxValue(250));
const point = v.tuple([coordinate, coordinate, coordinate]);
const node = v.strictObject({ id, at: point, floor: id,
  yaw: v.optional(v.pipe(v.number(), v.finite(), v.minValue(-Math.PI), v.maxValue(Math.PI)), 0) });
/** Two explicit directed links and a walked static route; no URL, author callback or arbitrary teleport target. */
export const PortalLinkSchema = v.pipe(v.strictObject({ road: node, destination: node, exit: node,
  links: v.pipe(v.array(v.strictObject({ from: id, to: id })), v.length(2)),
  route: v.pipe(v.array(point), v.minLength(2), v.maxLength(32)),
}), v.check(row => new Set([row.road.id, row.destination.id, row.exit.id]).size === 3 && row.road.at[1] === 0,
'portal nodes must be distinct and the road portal must stand at y=0'),
v.check(row => row.links.some(link => link.from === row.road.id && link.to === row.destination.id)
  && row.links.some(link => link.from === row.exit.id && link.to === row.road.id), 'unknown or unbound portal link'),
v.check(row => row.route[0]?.every((value, axis) => value === row.destination.at[axis]) === true
  && row.route.at(-1)?.every((value, axis) => value === row.exit.at[axis]) === true,
'portal route must walk from destination to exit'));
/** A road deck, admitted arrival floor and exit back to that deck, all in cell-local coordinates. */
export type PortalLink = v.InferOutput<typeof PortalLinkSchema>;
/** Refuse executable author objects before reading or serialising their fields. */
export function parsePortalLink(input: unknown): PortalLink {
  if (!isJsonData(input)) throw new Error('Portal links must be JSON data only');
  return v.parse(PortalLinkSchema, input);
}
