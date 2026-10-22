/**
 * World-assembly stages for a painterly level's graphics (G613 / G602; folded into the core WorldAssembly host's ordered
 * stages):
 * - `fixed-draws`: the world's original fixed-draw library (WorldAssemblyPorts `draws`, never a second book) loaded once a
 *   page, then lent as the `fixed-draws` entry owner `id` for the stages and consumers after it
 * - `painted-reseed`: the painted world's grass bakes its fine mask again (game/looks/postGraphLook `world`, the slug its
 *   look built it under), before the dressing regrows around what landed
 * - `painted-world`: the painted world wires its painterly world (panorama, key light, static capture) under the native
 *   level scope over the construction scope's exact loans (its weather rig's painted sky, named object groups, casters,
 *   optionally the native forest) and lends it there as the `painted-world` entry owner `id` and its dome as object
 *   `id`; `paintedWorldUpdate` moves it each frame from that weather rig at the world-updates slot that names it
 * All refuse a world that has left or is leaving, before any work; no stage slices or yields (the construction's own
 * checkpoints do). Client-only presentation.
 */
import type { Object3D, Scene } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { FixedDraws } from '../models/fixedDraws';
import { paintedWorldOf } from '../looks/postGraphLook';
import { entryOwner, publishEntryOwner } from './entryOwners';

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

/** The world stage's original owners a painted world draws into (the construction context's). */
export interface PaintedWorldStagePorts {
  /** the construction scope: the loans are read from it and the painted world is lent in it */
  readonly scope: Scope;
  /** the native level scope the painterly world allocates under (its grade loan, panorama, key light, capture); it may
   *  retire independently of the construction scope */
  readonly nativeScope: Scope;
  readonly renderer: Renderer; readonly scene: Scene; readonly sky: SkyRig;
  /** the native world's forest group (a caster of the static capture), when the world has one */
  readonly forest: Object3D | null;
  /** the level's daytime saturation the key light eases from */
  readonly daySaturation: number;
}
/** A `painted-world` stage's row: its painted world, the weather rig it follows, its named groups and its casters. */
export interface PaintedWorldStageRow {
  readonly id: string; readonly world: string; readonly weather: string;
  readonly groups: readonly { readonly name: string; readonly object: string }[];
  readonly casters: readonly string[]; readonly forest: boolean;
}

/** The construction scope's loans a painted world reads: its weather rig, that rig's painted sky and dome, the named
 *  groups and the casters, in row order. */
function stageLoans(scope: Scope, stage: PaintedWorldStageRow): readonly unknown[] {
  const rig = entryOwner(scope, 'world-weather', stage.weather), painted = rig.sky;
  if (painted === null) throw new Error(`Weather ${stage.weather} has no painted sky`);
  return [rig, painted, painted.dome, ...stage.groups.map(row => entryOwner(scope, 'object', row.object)), ...stage.casters.map(id => entryOwner(scope, 'object', id))];
}

/** Wire the painted world under the native level scope over the construction scope's exact loans and lend it; nothing is
 *  published when either scope left, or any port or loan was replaced, while it built. */
export async function installPaintedWorldStage(ports: PaintedWorldStagePorts, stage: PaintedWorldStageRow): Promise<void> {
  const { scope, nativeScope, renderer, scene, sky, forest, daySaturation } = ports;
  if (!live(scope) || !live(nativeScope)) throw new Error('A painted-world stage needs a live world');
  const loans = stageLoans(scope, stage), rig = entryOwner(scope, 'world-weather', stage.weather), painted = rig.sky;
  if (painted === null) throw new Error(`Weather ${stage.weather} has no painted sky`);
  if (stage.forest && forest === null) throw new Error('A painted-world stage names a forest the world does not have');
  const groups = Object.fromEntries(stage.groups.map(row => [row.name, entryOwner(scope, 'object', row.object)]));
  const casters = [...stage.casters.map(id => entryOwner(scope, 'object', id)), ...(stage.forest && forest !== null ? [forest] : [])];
  const world = await paintedWorldOf(stage.world).wire({ renderer, scene, scope: nativeScope, sky, stars: painted.dome, groups, casters, daySaturation });
  const kept = live(scope) && live(nativeScope) && ports.scope === scope && ports.nativeScope === nativeScope && ports.renderer === renderer
    && ports.scene === scene && ports.sky === sky && ports.forest === forest && ports.daySaturation === daySaturation;
  const again = kept ? stageLoans(scope, stage) : [];
  if (!kept || again.length !== loans.length || again.some((value, at) => value !== loans[at])) {
    throw new Error('The world left or replaced its owners while its painted world built');
  }
  if (world === null) throw new Error(`Painted world ${stage.world} declares no world rows`);
  publishEntryOwner(scope, 'painted-world', stage.id, world);
  publishEntryOwner(scope, 'object', stage.id, world.panorama.dome);
}

/** The painted world `world`'s frame, from the weather rig `weather` (the look it painted, its sun, its overcast). */
export function paintedWorldUpdate(scope: Scope, row: { readonly world: string; readonly weather: string }): (dt: number) => void {
  const world = entryOwner(scope, 'painted-world', row.world), rig = entryOwner(scope, 'world-weather', row.weather), painted = rig.sky;
  if (painted === null) throw new Error(`Weather ${row.weather} has no painted sky`);
  return (dt) => { world.update(dt, { look: painted.look, sunElevation: painted.clock.sunElevation, overcast: rig.weather.overcast }); };
}
