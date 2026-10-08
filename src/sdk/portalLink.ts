import * as v from 'valibot';
import { PortalLinkSchema as schema, parsePortalLink as parseData, type PortalLink as Data } from '@wildshard/game/shardfile/portalLink';
/** Exact bounded directed entry links, static floor bindings and the walked arrival-to-exit route. */
export const PortalLinkSchema = v.pipe(schema);
/** Renderer-neutral portal declaration in cell-local coordinates. */
export type PortalLink = Data;
/** Validate data before assigning an entry's portal link; no author callbacks or arbitrary destinations. */
export function parsePortalLink(input: unknown): PortalLink { return parseData(input); }
