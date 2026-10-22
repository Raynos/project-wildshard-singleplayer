/**
 * World-assembly stages for a painterly level's graphics (G613 / G602; folded into the core WorldAssembly host's ordered
 * stages):
 * - `fixed-draws`: the world's original fixed-draw library (WorldAssemblyPorts `draws`, never a second book) loaded once a
 *   page, then lent as the `fixed-draws` entry owner `id` for the stages and consumers after it
 * - `painted-reseed`: the painted world's grass bakes its fine mask again (game/looks/paintedWorld `world`, the slug its
 *   look built it under), before the dressing regrows around what landed
 * Both refuse a world that has left or is leaving, before any work; no stage slices or yields (the construction's own
 * checkpoints do). Client-only presentation.
 */
import type { Scope } from '@wildshard/engine/app/scope';
import type { FixedDraws } from '../models/fixedDraws';
import { paintedWorldOf } from '../looks/paintedWorld';
import { publishEntryOwner } from './entryOwners';

/** one load a page per library, as a level's own loader kept (a re-entered world reuses it; a failed load stays failed) */
const loads = new WeakMap<FixedDraws, Promise<void>>();

function live(scope: Scope): boolean { return !scope.disposed && !scope.disposing; }

/** Load the world's original fixed-draw library once and lend it as `id`; nothing is published for a world that left or
 *  replaced its library or scope while the load ran. */
export async function installFixedDrawsStage(ports: { readonly scope: Scope; readonly draws?: FixedDraws }, stage: { readonly id: string }): Promise<void> {
  const scope = ports.scope, draws = ports.draws;
  if (draws === undefined) throw new Error('A fixed-draws stage needs the world\'s original fixed-draw library');
  if (!live(scope)) throw new Error('A fixed-draws stage needs a live world');
  const read = draws.load;
  let load: Promise<void> | undefined;
  if (!draws.ready) {
    load = loads.get(draws);
    if (load === undefined) { load = draws.load(); loads.set(draws, load); }
    await load;
  }
  if (!live(scope) || ports.scope !== scope || ports.draws !== draws || draws.load !== read || (load !== undefined && loads.get(draws) !== load)) {
    throw new Error('The world left or replaced its fixed-draw library while it loaded');
  }
  publishEntryOwner(scope, 'fixed-draws', stage.id, draws);
}

/** The painted world `world` (the slug its look built it under) bakes its grass's fine mask again, for a live world. */
export function installPaintedReseedStage(scope: Scope, stage: { readonly world: string }): void {
  if (!live(scope)) throw new Error('A painted-reseed stage needs a live world');
  paintedWorldOf(stage.world).grass.reseed();
}
