import { entryOwner } from '@wildshard/game/shardfile/entryOwners';

import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import { macrotask } from '@wildshard/engine/boot/plan';
import { buildNalatiWorld, type Nalati } from './state';

function host(ctx: ShardContext) {
  const shell = ctx.game.runtime;
  if (shell === undefined) throw new Error('Nalati plugin requires its world host');
  const { world, step } = shell;
  if (world === null || step === null) throw new Error('Nalati plugin requires counted world steps');
  return { shell, world, step };
}

export class NalatiPlugin extends ShardPlugin {
  private rt: Nalati | null = null;

  override world(ctx: ShardContext): void {
    const { shell, world } = host(ctx);
    this.rt = buildNalatiWorld(world, ctx);
    shell.objects['nalati'] = this.rt;
    // the probe's `shard` handles (E405 AG25), read when the probe installs (ride and wildlife arrive in later hooks)
  }

  override async play(ctx: ShardContext): Promise<void> {
    const { shell } = host(ctx), h = shell.play, rt = this.rt, mounted = entryOwner(ctx.scope, 'claims', 'nalati.arsenal'), kit = mounted.pageKit(ctx);
    if (h === null || rt === null || kit === null) throw new Error('Nalati gameplay requires its world, equipment and UI');
    // SF67: the play installation a part a task (the ride, the bosses, the elites, the camp people were one ~290 ms task at
    // 4x CPU). What ran before the first yield (the King's binding, the ride, the ride's director) runs under the owner the
    // call began with, as it did.
    const part = async (): Promise<void> => { await macrotask(); if (ctx.scope.disposed) throw new Error('Nalati was unloaded during play installation'); };
    await part(); // not in the page's play-stage task
    const wildlife = rt.wildlife;
    if (wildlife === null) throw new Error('Nalati creatures have not been built');
    await part();
    Object.assign(shell.objects, { wildlife });
    await part();
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default NalatiPlugin;
