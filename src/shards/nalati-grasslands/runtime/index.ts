import { Elites } from '@wildshard/game/Elite';
import { ExternalElitePage } from '@wildshard/game/quest/elitePage';
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
import { grassBaseHeightAt } from '@wildshard/game/systems/looks/grassField';
import { buildNalatiWorld, type Nalati } from './state';
import { arsenal, prepareWeaponCatalogue, weaponCatalogue } from '../weapons/loadout';
import bowVariant from '../boot/bowVariant.generated.json' with { type: 'json' };
import { installQuestPageComposition } from '@wildshard/game/quest/pageComposition';
import people from '../boot/peopleFrames.generated.json' with { type: 'json' };
import { enteredAdventurePersistence } from '@wildshard/game/quest/chapterBindings';

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
    await arsenal.blade.prepare(ctx.product);
    await arsenal.polearm.prepare(ctx.product);
    await prepareWeaponCatalogue(ctx.product);
    publishEntryOwner(ctx.scope, 'mounted-arsenal', 'nalati.arsenal', arsenal);
    shell.objects['nalati'] = this.rt;
    // the probe's `shard` handles (E405 AG25), read when the probe installs (ride and wildlife arrive in later hooks)
    // `coats`: the baked coats' source (scripts/bake-coats.mjs --shard=nalati-grasslands); `grassBase`: the grass before
    // trampling the senses read (the authored physics rows sample it for the renderer-free field's check)
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, Object.defineProperties({ grassBase: (x: number, z: number) => grassBaseHeightAt(x, z) }, Object.fromEntries(['nalati', 'ride', 'wildlife'].map((key) => [key, { enumerable: true, get: () => shell.objects[key] }]))));
  }

  override kit(ctx: ShardContext): void {
    host(ctx);
    nalatiSpeciesCatalogue().install(ctx.rows);
  }

  override async play(ctx: ShardContext): Promise<void> {
    const { shell, world } = host(ctx), h = shell.play, rt = this.rt, mounted = entryOwner(ctx.scope, 'mounted-arsenal', 'nalati.arsenal'), kit = mounted.pageKit(ctx);
    if (h === null || rt === null || kit === null) throw new Error('Nalati gameplay requires its world, equipment and UI');
    const { animals, hud, audio, music, progress } = h;
    const persistence = enteredAdventurePersistence(ctx.scope);
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
    await part();
    ctx.scope.run(() => rt.boss.bind(ctx,kit,weaponCatalogue.model('goldenBow'),bowVariant));
    await part();
    const eliteScope = ctx.scope.child('Elites.bind');
    try { eliteScope.run(() => {
      const game = world.game, player = world.player, bar = new EliteBar();
      const owner = new Elites({ scene: game.scene, camera: game.camera, player,
        condition: rule => rt.elites.holds(rule), ownSkin: skin => { rt.elites.skins.add(skin); } }, bar, game.level.id, persistence.elites);
      const controllers = rt.eliteRows.borrowed.map(row => {
        const model = rt.eliteDrops.get(row.def.id); if (model === undefined) throw new Error('Missing elite drop model');
        return new ExternalElitePage(row, { game, player, animals, elites: owner }, rt.eliteProgram, model, row.mode === 'script' ? rt.eliteCharge : undefined, true);
      });
      owner.bindDeclaredEntry(rt.elites, rt.eliteRows, { construction: game.levelScope,
        entered: { scope: eliteScope, interactables: shell.interactables, hud, audio, music }, game, player, body: 'animals', animals,
        models: rt.eliteDrops, program: { id: 'elite.rules', scope: game.levelScope, value: rt.eliteProgram }, controllers,
        environment: wildEnv, clock: rt.weather.clock, weather: rt.weather.weather, ledges: rt.eliteLedges, rock: poiLayout.EAGLE_ROCK,
        patrol: rt.elitePatrol, wildlife, persistence, contacts: new StrikeRunner() });
    }); } catch (error) { eliteScope.dispose(); throw error; }
    await part();
    ctx.scope.run(() => rt.titan.bind(ctx,kit,mounted,weaponCatalogue.model('naizagai'),rt.skins));
    // Boss prewarming reserves its identity before the authored lairs materialize for strict restore.
    if (retainsRuntimeServices(ctx)) rt.elites.initialize(rt.eliteFrame());
    await part();
    await installQuestPageComposition(ctx, { chapterView: 'quests/content.json', story: 'quests/chapters.json' }, { taming: rt.ride?.taming ?? null, arena: rt.boss, fight: rt.titan, figures: people });
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default NalatiPlugin;
