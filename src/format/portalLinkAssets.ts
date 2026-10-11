import type { ShardProps } from '@wildshard/format/props';
import type { ShardMeshCollision } from '@wildshard/format/meshCollision';

import { parsePortalLink, type PortalLink } from '@wildshard/format/portalLink';

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
