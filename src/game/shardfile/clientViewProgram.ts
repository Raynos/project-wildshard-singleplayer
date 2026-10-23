/**
 * G600 L7: a declared view program (client plan `view.program`, format/viewProgram) on its entered world. It admits the
 * module's v2 view contract, lends the program its world (player, camera, registry floors), the entered objects its rows
 * name (entry-owner `object` loans) and the lent looks its channels write, and runs it in its rows' update system.
 */
import { admitScriptV2 } from '@wildshard/format/scriptAdmissionV2';
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import { viewProgram, type ViewSlots, type ViewTell } from '@wildshard/engine/script/viewProgram';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { speciesViewSlots } from '../population/speciesViewSlots';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardContext } from '../plugin/context';
import { entryOwner } from './entryOwners';
import { setLentParam } from './lentLooks';

const lentSlots = new WeakMap<Scope, Map<string, ViewSlots>>(), lentValues = new WeakMap<Scope, Map<string, (field: string) => number>>();
const lentCells = new WeakMap<Scope, Map<string, { value: number }>>(), lentTells = new WeakMap<Scope, Map<string, ViewTell>>();
/** An owner lends a native group's ordered actor slots to its scope's view programs (pools name the group). */
export function lendViewSlots(scope: Scope, group: string, slots: ViewSlots): void {
  let book = lentSlots.get(scope); if (book === undefined) { book = new Map(); lentSlots.set(scope, book); }
  if (book.has(group) || scope.disposed || scope.disposing) throw new Error(`View slots cannot be lent: ${group}`);
  const held = book; held.set(group, slots); scope.onDispose(() => { held.delete(group); });
}

/** An owner lends a numeric snapshot (named finite fields, read once a frame and never written back) to its scope's view programs. */
export function lendViewValues(scope: Scope, source: string, read: (field: string) => number): void {
  let book = lentValues.get(scope); if (book === undefined) { book = new Map(); lentValues.set(scope, book); }
  if (book.has(source) || scope.disposed || scope.disposing) throw new Error(`View values cannot be lent: ${source}`);
  const held = book; held.set(source, read); scope.onDispose(() => { held.delete(source); });
}

/** One lender book a scope: lend `value` as `id` for the scope's life (refused twice or once the scope is leaving). */
function lend<T>(books: WeakMap<Scope, Map<string, T>>, scope: Scope, id: string, value: T, what: string): void {
  let book = books.get(scope); if (book === undefined) { book = new Map(); books.set(scope, book); }
  if (book.has(id) || scope.disposed || scope.disposing) throw new Error(`View ${what} cannot be lent: ${id}`);
  const held = book; held.set(id, value); scope.onDispose(() => { held.delete(id); });
}
/** An owner lends a numeric cell its scope's view programs write (`cell` channels); it reads the cell after their frame. */
export function lendViewCell(scope: Scope, id: string, cell: { value: number }): void { lend(lentCells, scope, id, cell, 'cell'); }
/** An owner lends a ground tell its scope's view programs draw (`tell` channels). */
export function lendViewTell(scope: Scope, id: string, tell: ViewTell): void { lend(lentTells, scope, id, tell, 'tell'); }

export function installViewProgram(ctx: ShardContext, row: Extract<ClientFeatureRow, { kind: 'view.program' }>, module: Uint8Array): void {
  const world = ctx.game.runtime?.world;
  if (world === undefined || world === null) throw new Error('View program requires its entered world');
  const bytes = Uint8Array.from(module);
  admitScriptV2(bytes, { lane: 'view', ioBytes: row.rows.budget.ioBytes });
  // a pool group `species:<kind>` is every live actor of that kind (game/population/speciesViewSlots), one lender per group
  const species = new Map<string, ViewSlots>();
  const speciesPool = (group: string): ViewSlots | null => {
    if (!group.startsWith('species:')) return null;
    let slots = species.get(group);
    if (slots === undefined) {
      const count = row.rows.pools.find(pool => pool.group === group)?.count ?? 64;
      slots = speciesViewSlots(() => ctx.game.runtime?.play?.animals.animals ?? null, group.slice('species:'.length), count, terrainHeight);
      species.set(group, slots);
    }
    return slots;
  };
  const program = viewProgram(bytes, row.rows, { scope: ctx.scope, player: world.player, camera: world.game.camera,
    floor: piece => { const found = world.registry.get(piece); return found === undefined ? null : (x, z) => found.floor?.(x, z); },
    slots: group => lentSlots.get(ctx.scope)?.get(group) ?? speciesPool(group), values: source => lentValues.get(ctx.scope)?.get(source) ?? null, object: id => entryOwner(ctx.scope, 'object', id),
    cell: id => { const cell = lentCells.get(ctx.scope)?.get(id); if (cell === undefined) throw new Error(`View cell ${id} is not lent`); return cell; },
    tell: id => { const tell = lentTells.get(ctx.scope)?.get(id); if (tell === undefined) throw new Error(`View tell ${id} is not lent`); return tell; }, look: (look, param, value) => { setLentParam(look, param, value); } });
  if (program === null) return;
  ctx.system({ id: row.rows.system, phase: 'update', before: [...row.rows.before], run: (dt, time) => { program.frame(dt, time); } });
}
