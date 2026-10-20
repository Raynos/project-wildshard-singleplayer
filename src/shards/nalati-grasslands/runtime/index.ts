import { enterClientAudioScene } from '@wildshard/game/audio/sceneDirector';
import { prepareNalatiSpecies,prepareGoldenKing } from '../species/presentation';
import { arsenal,prepareSabre,prepareSpear } from '../weapons/nativeMelee';

import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { nalatiSpecies,nalatiLooks } from '../species/catalogue';
import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import { enteredOwner, withOwner } from '@wildshard/engine/app/ownership';
import { macrotask } from '@wildshard/engine/boot/plan';
import { installPagePathRamps } from '@wildshard/game/shardfile/pagePreparation';
import { setting, onSettingChange } from '@wildshard/engine/ui/Settings';
import { prepareGrassV2 } from '../look/field';
import { installPageMeadow } from '@wildshard/game/shardfile/clientMeadow';
import { grassBaseHeightAt } from '@wildshard/game/systems/looks/grassField';
import { buildNalatiWorld, type Nalati } from './state';
import { withGeometryBake } from '@wildshard/engine/world/geometryBake';
import { withVoxelAOBake } from '@wildshard/engine/world/voxelAO';
import { prepareWeaponCatalogue, weaponCatalogue } from '../weapons/loadout';
import bowVariant from '../boot/bowVariant.generated.json' with { type: 'json' };
import { installNalatiQuestView } from '../quest/kokpar';
import { horsePlayground } from '../playground/registration';
import { bindAdventurePersistence, readAdventurePersistence, type AdventurePersistence as NalatiPersistence } from '@wildshard/game/quest/persistence';
import { lookGraphMaterials } from '@wildshard/game/plugin/shaderFamily';
import { hasLentLook, lendLooks } from '@wildshard/sdk/looks/lentLooks';

function host(ctx: ShardContext): ShardRuntime {
  const rt = ctx.game.runtime;
  if (rt === undefined) throw new Error('Nalati plugin requires its world host');
  if (rt.world === null || rt.step === null) throw new Error('Nalati plugin requires counted world steps');
  return rt;
}

export class NalatiPlugin extends ShardPlugin {
  private rt: Nalati | null = null;
  private persistence: NalatiPersistence | null = null;
  private runtime(): Nalati { if (this.rt === null) throw new Error('Nalati world hook has not run'); return this.rt; }

  override async world(ctx: ShardContext): Promise<void> {
    const shell = host(ctx), world = shell.world, step = shell.step;
    if (world === null || step === null) throw new Error('Nalati world requires counted boot steps');
    const { game, registry } = world;
    // the look.materials graphs (data/lookGraphs.json: the camp smoke), compiled and lent before the places draw on them
    lendLooks(ctx.scope, await lookGraphMaterials(ctx.scope, game, ctx.product.shardfile, Object.keys(ctx.product.shardfile.look.materials).filter(id=>!hasLentLook(id))));
    this.persistence = bindAdventurePersistence(ctx, ctx.product.shardfile, await readAdventurePersistence(ctx), world.chunk.slug);
    const meadow=await ctx.product.json<{constants:{nativeField:unknown}}>('sim/headless-assembly.json');
    await prepareGrassV2(macrotask);
    const {grass,particles}=await installPageMeadow(ctx,meadow.constants.nativeField);
    await step('cabins', () => undefined);
    if (ctx.product.shardfile.clientChannels === undefined) throw new Error('Missing Golden King pose rows');
    const actorRows = await ctx.product.json<{ species: unknown }>('actors/sheep.json');
    await prepareNalatiSpecies(actorRows.species, ctx.product.shardfile.clientChannels ?? [], await ctx.product.file('actors/balbal-cracks.bin'));
    prepareGoldenKing(ctx.product.shardfile.clientChannels.filter(row => row.id.startsWith('king.')));
    this.rt = await step('props', (progress) => withGeometryBake('/assets/nalati/baked/geometry.bin', () => withVoxelAOBake('/assets/nalati/baked/voxel-ao.bin', () => buildNalatiWorld(world, ctx, progress, this.persistence ?? undefined))));
    await prepareSabre(ctx.product);
    await prepareSpear(ctx.product);
    await prepareWeaponCatalogue();
    const rt = this.rt;
    installPagePathRamps(registry, { id: 'paths', name: 'Paths' });
    Object.assign(shell.objects, { nalati: rt, grass, particles });
    // the probe's `shard` handles (E405 AG25), read when the probe installs (ride and wildlife arrive in later hooks)
    // `coats`: the baked coats' source (scripts/bake-coats.mjs --shard=nalati-grasslands); `grassBase`: the grass before
    // trampling the senses read (the authored physics rows sample it for the renderer-free field's check)
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, Object.defineProperties({ grassBase: (x: number, z: number) => grassBaseHeightAt(x, z) }, Object.fromEntries(['nalati', 'ride', 'wildlife'].map((key) => [key, { enumerable: true, get: () => shell.objects[key] }]))));
    installEnteredRuntimeService(ctx, (scope) => { ctx.app.registerDayCycle(rt.weather.clock, scope); });
    if (!world.params.has('time')) rt.weather.clock.setTime(setting('time'));
    installEnteredRuntimeService(ctx, (scope) => { scope.onDispose(onSettingChange('time', (value) => { rt.weather.clock.setTime(value); })); });
  }

  override kit(ctx: ShardContext): void {
    const shell = host(ctx), world = shell.world;
    if (world === null) throw new Error('Nalati equipment requires a world');
    ctx.rows.species(nalatiSpecies());
    ctx.rows.speciesLook(nalatiLooks());
    arsenal.installPage(ctx);
  }

  override async play(ctx: ShardContext): Promise<void> {
    const shell = host(ctx), world = shell.world, h = shell.play, rt = this.runtime(), kit = arsenal.pageKit(ctx);
    if (world === null || h === null || kit === null) throw new Error('Nalati gameplay requires its equipment and UI');
    const { animals, hud, audio, music, progress } = h;
    const persistence = this.persistence;
    if (persistence === null) throw new Error('Nalati declared progression has not been bound');
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
    if (ride !== null) shell.interactables.push(ride.interactable);
    Object.assign(shell.objects, { wildlife, ride });
    ctx.on('weather.changed', (state) => { hud.setWeather(state); });
    enterClientAudioScene(ctx);
    rt.weather.bindPlay();
    await part();
    ctx.scope.run(() => rt.boss.bind(ctx,kit,weaponCatalogue.model('goldenBow'),bowVariant));
    await part();
    ctx.scope.run(() => rt.elites.bind({ persistence, animals, wildlife, taming: ride?.taming ?? null, interactables: shell.interactables, hud, audio, music }));
    await part();
    ctx.scope.run(() => rt.titan.bind(ctx,kit,arsenal,weaponCatalogue.model('naizagai'),rt.skins));
    // Boss prewarming reserves its identity before the authored lairs materialize for strict restore.
    if (retainsRuntimeServices(ctx)) rt.elites.initialize();
    ctx.on('player.died', () => { if (ride?.mounted === true) ride.mount.dismount(); });
    ctx.on('player.respawned', () => { kit.refill(); });
    const health = ctx.app.player;
    installEnteredRuntimeService(ctx, (scope) => {
      health?.checkpoint(scope, () => rt.boss.onPlayerDeath(), () => ctx.app.player === health);
      health?.checkpoint(scope, () => rt.titan.onPlayerDeath(), () => ctx.app.player === health);
    });
    await part();
    await installNalatiQuestView(ctx, rt, persistence);
    ctx.playground(horsePlayground(ctx));
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default NalatiPlugin;
