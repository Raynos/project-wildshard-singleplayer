import * as v from 'valibot';
import { isJsonData } from './json';
import type { ShardProps } from './props';
import type { ShardMeshCollision } from './meshCollision';

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
/** One canonical edge and its fully bound data link. */
export interface PortalLinkEntry { edge: 'north' | 'east' | 'south' | 'west'; portal: PortalLink }
/** Select only explicit portal entries; a missing link never becomes an executable fallback. */
export function portalLinkEntries(entries: readonly { edge: PortalLinkEntry['edge']; kind?: string | undefined; portal?: PortalLink }[]): PortalLinkEntry[] {
  return entries.flatMap(entry => {
    if (entry.kind !== 'portalLink') return [];
    if (entry.portal === undefined) throw new Error('Missing portal link declaration');
    return [{ edge: entry.edge, portal: entry.portal }];
  });
}
/** Only permanently active authored colliders can bind a portal floor; moving/hidden panels and platform floors cannot. */
export function portalLinkRules(entries: readonly PortalLinkEntry[], source: { props: ShardProps | null; meshCollision: ShardMeshCollision | null; targets?: { panels: readonly { colliders: readonly string[] }[] }; movers?: readonly { id: string }[] }): string[] {
  const controlled = new Set([...source.targets?.panels.flatMap(row => row.colliders) ?? [], ...source.movers?.map(row => row.id) ?? []]);
  const floors = new Set([...source.props?.colliders.filter(row => row.initialActive && row.panel === null && !controlled.has(row.id)).map(row => row.id) ?? [],
    ...source.meshCollision?.tiles.map(row => `mesh.tile.${row.x}.${row.z}`).filter(key => !controlled.has(key)) ?? []]);
  const nodes = new Map<string, string>(), outgoing = new Set<string>(), errors: string[] = [];
  for (const entry of entries) {
    try {
      const portal = parsePortalLink(entry.portal), [x, y, z] = portal.road.at;
      const cross = entry.edge === 'north' || entry.edge === 'south' ? x : z;
      const along = entry.edge === 'north' || entry.edge === 'south' ? z : x;
      const sign = entry.edge === 'north' || entry.edge === 'east' ? 1 : -1;
      if (cross !== 0 || y !== 0 || sign * along < 235.5 || sign * along > 249.5) throw new Error('Road portal must be centred on its road-level entry deck');
      for (const endpoint of [portal.road, portal.destination, portal.exit]) {
        if (!floors.has(endpoint.floor)) throw new Error('Portal floor must bind an active permanent static collider');
        const signature = JSON.stringify(endpoint), prior = nodes.get(endpoint.id);
        if (prior !== undefined && prior !== signature) throw new Error('Conflicting shared portal node');
        nodes.set(endpoint.id, signature);
      }
      for (const link of portal.links) {
        if (outgoing.has(link.from)) throw new Error('Portal has more than one outgoing link');
        outgoing.add(link.from);
      }
    } catch (error) { errors.push(error instanceof Error ? error.message : 'Invalid portal link'); }
  }
  return errors;
}
