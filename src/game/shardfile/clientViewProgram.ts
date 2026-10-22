/**
 * G600 L7: a declared view program (client plan `view.program`, format/viewProgram) on its entered world. It admits the
 * module's v2 view contract, lends the program its world (player, camera, registry floors), the entered objects its rows
 * name (entry-owner `object` loans) and the lent looks its channels write, and runs it in its rows' update system.
 */
import { admitScriptV2 } from '@wildshard/format/scriptAdmissionV2';
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import { viewProgram } from '@wildshard/engine/script/viewProgram';
import type { ShardContext } from '../plugin/context';
import { entryOwner } from './entryOwners';
import { setLentParam } from './lentLooks';

export function installViewProgram(ctx: ShardContext, row: Extract<ClientFeatureRow, { kind: 'view.program' }>, module: Uint8Array): void {
  const world = ctx.game.runtime?.world;
  if (world === undefined || world === null) throw new Error('View program requires its entered world');
  const bytes = Uint8Array.from(module);
  admitScriptV2(bytes, { lane: 'view', ioBytes: row.rows.budget.ioBytes });
  const program = viewProgram(bytes, row.rows, { scope: ctx.scope, player: world.player, camera: world.game.camera,
    floor: piece => { const found = world.registry.get(piece); return found === undefined ? null : (x, z) => found.floor?.(x, z); },
    object: id => entryOwner(ctx.scope, 'object', id), look: (look, param, value) => { setLentParam(look, param, value); } });
  if (program === null) return;
  ctx.system({ id: row.rows.system, phase: 'update', before: [...row.rows.before], run: dt => { program.frame(dt); } });
}
