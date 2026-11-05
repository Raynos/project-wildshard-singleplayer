import type { SimHost } from '../sim';

/** The tick command a named interaction is, as its owner reads it. */
export interface InteractRoute { readonly actorId: string; readonly value: number }
/** Where a net act lands in a host's tick commands. A shard's systems file these as they install; a room only reads them. */
export interface ActRoutes {
  /** Interaction row id to its tick command. A row a lash runs is not here: no client asks for it by name. */
  readonly interactions: Map<string, InteractRoute>;
  /** The script actor a player's loadout picks its slot from, on a shard with a native loadout. */
  equip: string | null;
}
const routes = new WeakMap<SimHost, ActRoutes>();
/** One host's routes (P1-E5.2c). */
export function actRoutes(host: SimHost): ActRoutes {
  let held = routes.get(host);
  if (held === undefined) { held = { interactions: new Map(), equip: null }; routes.set(host, held); }
  return held;
}
