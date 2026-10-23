import { entryOwner, publishEntryOwner } from '@wildshard/game/shardfile/entryOwners';

import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import { macrotask } from '@wildshard/engine/boot/plan';
import { buildNalatiWorld, type Nalati } from './state';
import { HeldClaims } from '@wildshard/game/loadout/claims';
import slots from '../boot/mountedLoadout.generated.json' with { type:'json' };

function host(ctx: ShardContext) {
  const shell = ctx.game.runtime;
  if (shell === undefined) throw new Error('Nalati plugin requires its world host');
  const { world, step } = shell;
  if (world === null || step === null) throw new Error('Nalati plugin requires counted world steps');
  return { shell, world, step };
}

export class NalatiPlugin extends ShardPlugin {
  private rt: Nalati | null = null;

  override async world(ctx: ShardContext): Promise<void> {
    const { shell, world, step } = host(ctx);
    await step('cabins', () => undefined);
    const species = entryOwner(ctx.scope, 'species', 'nalati.species');
    this.rt = await step('props', (progress) => buildNalatiWorld(world, ctx, species, progress));
    const arsenal=HeldClaims.fromProductSlots(ctx.product,slots,'models/gear-book.json');
    await arsenal.prepareSlotSources(ctx);
    publishEntryOwner(ctx.scope, 'claims', 'nalati.arsenal', arsenal);
    shell.objects['nalati'] = this.rt;
    // the probe's `shard` handles (E405 AG25), read when the probe installs (ride and wildlife arrive in later hooks)
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, Object.defineProperties({}, Object.fromEntries(['nalati', 'ride', 'wildlife'].map((key) => [key, { enumerable: true, get: () => shell.objects[key] }]))));
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
