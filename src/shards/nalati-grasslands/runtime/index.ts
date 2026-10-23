import { Elites } from '@wildshard/game/Elite';
import { EliteBar } from '@wildshard/engine/ui/EliteBar';
import { StrikeRunner } from '@wildshard/engine/ai/strikes';
import { wildEnv } from '@wildshard/game/population/pageGroups';
import poiLayout from '../boot/poiLayout.generated.json' with { type: 'json' };
import { entryOwner, publishEntryOwner } from '@wildshard/game/shardfile/entryOwners';
import type { SpeciesActorsFileRows } from '@wildshard/format/speciesBookRows';
import { nalatiSpeciesCatalogue, prepareNalatiSpecies } from '../species/presentation';
import { productSpeciesCatalogue } from '@wildshard/game/looks/speciesBook';

import { retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { NALATI_DEFINITIONS } from '../species/definitions';
import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import { enteredOwner, withOwner } from '@wildshard/engine/app/ownership';
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
    const actorRows = await ctx.product.json<SpeciesActorsFileRows>('actors/sheep.json');
    prepareNalatiSpecies(productSpeciesCatalogue(ctx.product, actorRows.species, await ctx.product.json('actors/species-looks.json'), NALATI_DEFINITIONS));
    this.rt = await step('props', (progress) => buildNalatiWorld(world, ctx, progress));
    const arsenal=HeldClaims.fromProductSlots(ctx.product,slots,'models/gear-book.json');
    await arsenal.prepareSlotSources(ctx);
    publishEntryOwner(ctx.scope, 'claims', 'nalati.arsenal', arsenal);
    shell.objects['nalati'] = this.rt;
    // the probe's `shard` handles (E405 AG25), read when the probe installs (ride and wildlife arrive in later hooks)
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, Object.defineProperties({}, Object.fromEntries(['nalati', 'ride', 'wildlife'].map((key) => [key, { enumerable: true, get: () => shell.objects[key] }]))));
  }

  override kit(ctx: ShardContext): void {
    host(ctx);
    nalatiSpeciesCatalogue().install(ctx.rows);
  }

  override async play(ctx: ShardContext): Promise<void> {
    const { shell, world } = host(ctx), h = shell.play, rt = this.rt, mounted = entryOwner(ctx.scope, 'claims', 'nalati.arsenal'), kit = mounted.pageKit(ctx);
    if (h === null || rt === null || kit === null) throw new Error('Nalati gameplay requires its world, equipment and UI');
    const { animals, hud, audio, music, progress } = h;
    const persistence = entryOwner(ctx.scope, 'adventure', 'progress');
    persistence.bindProgress(progress);
    // SF67: the play installation a part a task (the ride, the bosses, the elites, the camp people were one ~290 ms task at
    // 4x CPU). What ran before the first yield (the King's binding, the ride, the ride's director) runs under the owner the
    // call began with, as it did.
    const part = async (): Promise<void> => { await macrotask(); if (ctx.scope.disposed) throw new Error('Nalati was unloaded during play installation'); };
    const own = enteredOwner(), owned = <T>(fn: () => T): T => (own === null ? fn() : withOwner(own, fn));
    await part(); // not in the page's play-stage task
    const wildlife = rt.wildlife;
    if (wildlife === null) throw new Error('Nalati creatures have not been built');
    owned(() => { rt.bindPlay(kit); });
    await part();
    const ride = rt.ride;
    if (ride !== null) { shell.interactables.push(ride.interactable); publishEntryOwner(ctx.scope, 'taming', 'riding', ride.taming); }
    Object.assign(shell.objects, { wildlife, ride });
    ctx.on('weather.changed', (state) => { hud.setWeather(state); });
    await part();
    ctx.scope.run(() => rt.boss.bind(ctx,kit,mounted.model('goldenBow')));
    publishEntryOwner(ctx.scope, 'arena-room', 'arena', rt.boss);
    await part();
    const eliteScope = ctx.scope.child('Elites.bind');
    try { eliteScope.run(() => {
      const game = world.game, player = world.player, bar = new EliteBar();
      const owner = new Elites({ scene: game.scene, camera: game.camera, player,
        condition: rule => rt.elites.holds(rule), ownSkin: skin => { rt.elites.skins.add(skin); } }, bar, game.level.id, persistence.elites);
      owner.bindDeclaredEntry(rt.elites, rt.eliteRows, { construction: game.levelScope,
        entered: { scope: eliteScope, interactables: shell.interactables, hud, audio, music }, game, player, body: 'animals', animals,
        models: rt.eliteDrops, program: { id: 'elite.rules', scope: game.levelScope, value: rt.eliteProgram }, fight: rt.eliteCharge,
        environment: wildEnv, clock: rt.weather.clock, weather: rt.weather.weather, ledges: rt.eliteLedges, rock: poiLayout.EAGLE_ROCK,
        patrol: rt.elitePatrol, wildlife, persistence, contacts: new StrikeRunner() });
    }); } catch (error) { eliteScope.dispose(); throw error; }
    await part();
    ctx.scope.run(() => rt.titan.bind(ctx,kit,mounted,mounted.model('naizagai'),rt.skins));
    publishEntryOwner(ctx.scope, 'arena-script', 'fight', rt.titan);
    // Boss prewarming reserves its identity before the authored lairs materialize for strict restore.
    if (retainsRuntimeServices(ctx)) rt.elites.initialize(rt.eliteFrame());
    await part();
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default NalatiPlugin;
