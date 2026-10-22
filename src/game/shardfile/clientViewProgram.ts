/**
 * G600 L7: a declared view program (client plan `view.program`, format/viewProgram) on its entered world. It admits the
 * module's v2 view contract, lends the program its world (player, camera, registry floors), the entered objects its rows
 * name (entry-owner `object` loans) and the lent looks its channels write, and runs it in its rows' update system.
 */
import { admitScriptV2 } from '@wildshard/format/scriptAdmissionV2';
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import { viewProgram, type ViewSlots } from '@wildshard/engine/script/viewProgram';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardContext } from '../plugin/context';
import { entryOwner } from './entryOwners';
import { setLentParam } from './lentLooks';

const lentSlots = new WeakMap<Scope, Map<string, ViewSlots>>();
/** An owner lends a native group's ordered actor slots to its scope's view programs (pools name the group). */
export function lendViewSlots(scope: Scope, group: string, slots: ViewSlots): void {
  let book = lentSlots.get(scope); if (book === undefined) { book = new Map(); lentSlots.set(scope, book); }
  if (book.has(group) || scope.disposed || scope.disposing) throw new Error(`View slots cannot be lent: ${group}`);
  const held = book; held.set(group, slots); scope.onDispose(() => { held.delete(group); });
}

export function installViewProgram(ctx: ShardContext, row: Extract<ClientFeatureRow, { kind: 'view.program' }>, module: Uint8Array): void {
  const world = ctx.game.runtime?.world;
  if (world === undefined || world === null) throw new Error('View program requires its entered world');
  const bytes = Uint8Array.from(module);
  admitScriptV2(bytes, { lane: 'view', ioBytes: row.rows.budget.ioBytes });
  const program = viewProgram(bytes, row.rows, { scope: ctx.scope, player: world.player, camera: world.game.camera,
    floor: piece => { const found = world.registry.get(piece); return found === undefined ? null : (x, z) => found.floor?.(x, z); },
    slots: group => lentSlots.get(ctx.scope)?.get(group) ?? null, object: id => entryOwner(ctx.scope, 'object', id), look: (look, param, value) => { setLentParam(look, param, value); } });
  if (program === null) return;
  ctx.system({ id: row.rows.system, phase: 'update', before: [...row.rows.before], run: dt => { program.frame(dt); } });
}
