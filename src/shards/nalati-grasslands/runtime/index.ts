import { prepareNalatiSpecies } from '../species/presentation';
import { prepareStormTitan } from '../combat/stormTitan';
import { prepareSabre, prepareSpear } from '../weapons/nativeMelee';

import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { NALATI_SPECIES, NALATI_LOOKS, prepareGoldenKing } from '../species/rows';
import NALATI_FEATS from '../data/feats.json' with { type: 'json' };
import type { AchievementDef } from '@wildshard/game/achievements';
import { renderFinds } from '@wildshard/game/bag/bag';
import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import { enteredOwner, withOwner } from '@wildshard/engine/app/ownership';
import { macrotask } from '@wildshard/engine/boot/plan';
import type { DamageRequest } from '@wildshard/engine/combat/pipeline';
import { pathRampDescs } from '@wildshard/engine/physics/paths';
import { setting, onSettingChange } from '@wildshard/engine/ui/Settings';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { HeldFirearm } from '@wildshard/game/plugin/heldFirearm';
import { FirearmWeaponProfileSchema, parseHeldFirearmRows, parseHeldFirearmView } from '@wildshard/format/weaponProfiles';
import { parse } from 'valibot';
import rifleRows from '../data/rifle.generated.json' with { type: 'json' };
import bootMetadata from '../bootMetadata.generated.json' with { type: 'json' };
import { RIVER } from '../world/geography';
import { prepareGrassV2 } from '../look/field';
import { Vector3 } from 'three';
import { buildNalatiWorld, type Nalati } from './state';
import { withGeometryBake } from '@wildshard/engine/world/geometryBake';
import { withVoxelAOBake } from '@wildshard/engine/world/voxelAO';
import { buildNalatiLoadoutSliced, type NalatiLoadout } from '../weapons/loadout';
import { readItemEquipment } from '@wildshard/game/plugin/nativeItems';
import { bindRuntimeEquipment } from '@wildshard/game/plugin/headless';
import { installNalatiQuestView } from '../quest/kokpar';
import { nalatiFinds, skinRows } from '../bag';
import { horsePlayground } from '../playground/registration';
import { bindAdventurePersistence, readAdventurePersistence, type AdventurePersistence as NalatiPersistence } from '@wildshard/game/quest/persistence';
import { horseNamesSave, tulparSave } from '../ride/saves';
import { nalatiSkinsSave } from '../weapons/saves';
import { bindRuntimeBoss } from '@wildshard/game/shardfile/hybridRows';
import { lookGraphMaterials } from '@wildshard/game/plugin/shaderFamily';
import { hasLentLook, lendLooks } from '@wildshard/sdk/looks/lentLooks';

function host(ctx: ShardContext): ShardRuntime {
  const rt = ctx.game.runtime;
  if (rt === undefined) throw new Error('Nalati plugin requires its world host');
  if (rt.world === null || rt.step === null) throw new Error('Nalati plugin requires counted world steps');
  return rt;
}

function readFeat(feat: (typeof NALATI_FEATS)[number]): AchievementDef {
  const icon = feat.icon;
  if (icon !== 'laurel' && icon !== 'ghost') throw new Error(`Unknown Nalati feat icon ${icon}`);
  return { ...feat, icon };
}

export class NalatiPlugin extends ShardPlugin {
  private rt: Nalati | null = null;
  private loadout: NalatiLoadout | null = null;
  private persistence: NalatiPersistence | null = null;
  private runtime(): Nalati { if (this.rt === null) throw new Error('Nalati world hook has not run'); return this.rt; }

  override async world(ctx: ShardContext): Promise<void> {
    const shell = host(ctx), world = shell.world, step = shell.step;
    if (world === null || step === null) throw new Error('Nalati world requires counted boot steps');
    const { game, sky, forest, registry } = world;
    // the look.materials graphs (data/lookGraphs.json: the camp smoke), compiled and lent before the places draw on them
    lendLooks(ctx.scope, await lookGraphMaterials(ctx.scope, game, ctx.product.shardfile, Object.keys(ctx.product.shardfile.look.materials).filter(id=>!hasLentLook(id))));
    this.persistence = bindAdventurePersistence(ctx, ctx.product.shardfile, await readAdventurePersistence(ctx), world.chunk.slug, {
      names: () => horseNamesSave.read(ctx.product.shardfile.identity.slug),
      cosmetics: () => nalatiSkinsSave.read(ctx.product.shardfile.identity.slug),
      bond: () => tulparSave.read(ctx.product.shardfile.identity.slug),
    });
    const { Grass } = await import('@wildshard/engine/world/Grass');
    await import('@wildshard/game/systems/looks/trample');
    const grassField = await import('@wildshard/game/systems/looks/grassField');
    grassField.configureGrassField({ ...bootMetadata.grassLayout, riverZ: RIVER.z, riverHalf: RIVER.half }, ctx.scope);
    // the grass step also builds the shared mote / mist / needle field the steppe has always carried (main.ts built it for
    // every forest shard before the plugin split; R2: dropping it lost a Points, two InstancedMeshes and three textures)
    const { grass, particles } = await step('grass', async () => {
      await prepareGrassV2(macrotask); // SF67: the blade rings' height texture and field lattice a slice at a time
      const field = new Grass(sky, forest).build();
      await macrotask();
      const { Particles } = await import('@wildshard/game/systems/looks/particles');
      const motes = new Particles(sky, forest).build();
      game.scene.add(field.group, motes.group);
      return { grass: field, particles: motes };
    });
    shell.overhead.push(grass.group, particles.group);
    shell.hooks.worldUpdate = (dt) => { grass.update(dt, shell.viewer()); particles.update(dt, shell.viewer(), game.camera); };
    await step('cabins', () => undefined);
    if (ctx.product.shardfile.clientChannels === undefined) throw new Error('Missing Golden King pose rows');
    const actorRows = await ctx.product.json<{ species: unknown }>('actors/sheep.json');
    await prepareNalatiSpecies(actorRows.species, ctx.product.shardfile.clientChannels ?? [], await ctx.product.file('actors/balbal-cracks.bin'));
    prepareGoldenKing(ctx.product.shardfile.clientChannels.filter(row => row.id.startsWith('king.')));
    await prepareStormTitan(ctx.product);
    this.rt = await step('props', (progress) => withGeometryBake('/assets/nalati/baked/geometry.bin', () => withVoxelAOBake('/assets/nalati/baked/voxel-ao.bin', () => buildNalatiWorld(world, ctx, progress, this.persistence ?? undefined))));
    await prepareSabre(ctx.product);
    await prepareSpear(ctx.product);
    const rt = this.rt;
    // the ramps sit on the live (baked) heightfield the capsule walks, not the analytic TERRAIN field (R2: the analytic
    // heights laid 9 fewer ramps)
    const ground = await import('@wildshard/engine/world/Heightfield');
    registry.add({ id: 'paths', name: 'Paths', category: 'ground', file: 'src/engine/physics/paths.ts', surface: 'ground', colliders: pathRampDescs(ground.TRAILS, heightAt, (x, z) => ground.normalAt(x, z)[1], { carried: (x, z) => registry.floorAt(x, z) !== undefined }) });
    shell.hooks.animalsBuilt = async (animals) => { await rt.attachAnimalsSliced(animals, macrotask); }; // SF67: a task apart per wildlife group
    shell.menu = { skins: () => skinRows(rt.skins), onWearSkin: (id) => { rt.skins.toggle(id); }, skinsTitle: 'Skins' };
    Object.assign(shell.objects, { nalati: rt, grass, particles });
    // the probe's `shard` handles (E405 AG25), read when the probe installs (ride and wildlife arrive in later hooks)
    // `coats`: the baked coats' source (scripts/bake-coats.mjs --shard=nalati-grasslands); `grassBase`: the grass before
    // trampling the senses read (the authored physics rows sample it for the renderer-free field's check)
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, Object.defineProperties({ grassBase: (x: number, z: number) => grassField.grassBaseHeightAt(x, z) }, Object.fromEntries(['nalati', 'ride', 'wildlife'].map((key) => [key, { enumerable: true, get: () => shell.objects[key] }]))));
    installEnteredRuntimeService(ctx, (scope) => { ctx.app.registerDayCycle(rt.weather.clock, scope); });
    if (!world.params.has('time')) rt.weather.clock.setTime(setting('time'));
    installEnteredRuntimeService(ctx, (scope) => { scope.onDispose(onSettingChange('time', (value) => { rt.weather.clock.setTime(value); })); });
  }

  override kit(ctx: ShardContext): void {
    const shell = host(ctx), world = shell.world;
    if (world === null) throw new Error('Nalati equipment requires a world');
    ctx.rows.species(NALATI_SPECIES);
    ctx.rows.speciesLook(NALATI_LOOKS);
    ctx.rows.feat(NALATI_FEATS.map(readFeat));
    ctx.rows.weapon(['weapon.bow', 'weapon.sabre', 'weapon.spear', 'weapon.rifle'].map(id => readItemEquipment(ctx.product.shardfile.items, id)));
    shell.buildEquipment = async (targets, nolock) => {
      const kit = await buildNalatiLoadoutSliced(world, targets, nolock, macrotask, ctx.product.shardfile.items); // SF67: a task apart per weapon
      this.loadout = kit;
      await macrotask();
      const rifleItem = ctx.product.shardfile.items.rows.find(row => row.id === 'weapon.rifle');
      const profile = { ...parse(FirearmWeaponProfileSchema, rifleItem?.kind === 'weapon' ? rifleItem.profile : undefined), ...rifleRows.feel };
      const rifle = new HeldFirearm(world, targets, { row: readItemEquipment(ctx.product.shardfile.items, 'weapon.rifle'), allowUnlocked: nolock, muzzleLight: true,
        profile, view: parseHeldFirearmView(rifleRows.view), rows: parseHeldFirearmRows(rifleRows.rows), model: {} });
      bindRuntimeEquipment(ctx, ctx.product.shardfile, [kit.bow, kit.sabre, kit.spear, rifle].map(weapon => {
        const item = ctx.product.shardfile.items.rows.find(row => row.id === weapon.row.id);
        return { id: weapon.row.id, weapon, profile: item?.kind === 'weapon' ? item.profile : undefined };
      }));
      return { primary: kit.base, rifle, secondary: null, extras: kit.extras, order: ['bow', 'sabre', 'spear'], install: (weapons) => { kit.install(weapons); } };
    };
  }

  override async play(ctx: ShardContext): Promise<void> {
    const shell = host(ctx), world = shell.world, h = shell.play, rt = this.runtime(), kit = this.loadout;
    if (world === null || h === null || kit === null) throw new Error('Nalati gameplay requires its equipment and UI');
    const { player, params } = world;
    const { animals, weapons, hud, audio, music, progress } = h;
    const persistence = this.persistence;
    if (persistence === null) throw new Error('Nalati declared progression has not been bound');
    persistence.bindProgress(progress);
    // SF67: the play installation a part a task (the ride, the bosses, the elites, the camp people were one ~290 ms task at
    // 4x CPU). What ran before the first yield (the King's binding, the ride, the ride's director) runs under the owner the
    // call began with, as it did.
    const part = async (): Promise<void> => { await macrotask(); if (ctx.scope.disposed) throw new Error('Nalati was unloaded during play installation'); };
    const own = enteredOwner(), owned = <T>(fn: () => T): T => (own === null ? fn() : withOwner(own, fn));
    await part(); // not in the page's play-stage task
    const king = owned(() => bindRuntimeBoss(ctx, ctx.product.shardfile, 'nalati.golden-king', undefined, { identity: 'runtime' }));
    const wildlife = rt.wildlife;
    if (wildlife === null) throw new Error('Nalati creatures have not been built');
    const hurt = (tag: DamageRequest['sourceTags'][number], amount: number, cause: DamageRequest['cause'], toast?: string): void => {
      const target = ctx.app.player;
      if (target === null) return;
      ctx.app.combat.hit({ source: 'env', sourceTags: [tag, 'feel.jolt', 'cover.checked'], target, amount, point: player.position.clone(), dir: new Vector3(), ...(cause === undefined ? {} : { cause }), ...(toast === undefined ? {} : { toast }) });
    };
    owned(() => { rt.bindPlay({ kit, health01: () => { const attributes = ctx.app.player?.attributes; return attributes === undefined ? 1 : attributes.health / attributes.maxHealth; }, toast: (text) => { hud.toast(text); }, flash: () => { hud.damageFlash(); }, hurt: (amount) => { hurt('env.ride', amount, { kind: 'env.ride', label: 'Thrown from the saddle', text: 'Thrown from the saddle' }); } }); });
    await part();
    const ride = rt.ride;
    if (ride !== null) shell.interactables.push(ride.interactable);
    Object.assign(shell.objects, { wildlife, ride });
    ctx.on('weather.changed', (state) => { hud.setWeather(state); });
    installEnteredRuntimeService(ctx,scope=>{rt.sound?.bind(audio,music,animals,scope);const previous=Object.getOwnPropertyDescriptor(wildlife,'onSound');const emit=(name:string,position:Vector3):void=>{rt.sound?.emit(name,position);};wildlife.onSound=emit;scope.onDispose(()=>{if(wildlife.onSound===emit){if(previous===undefined)delete wildlife.onSound;else Object.defineProperty(wildlife,'onSound',previous);}});});
    installEnteredRuntimeService(ctx, (scope) => {
      h.cues.use((id, options) => options.surface === undefined ? rt.sound?.fire(id) === true : rt.sound?.impact(id, options.surface === 'flesh' || options.surface === 'wood' ? options.surface : 'ground', options.pan ?? 0, options.gain ?? 1) === true, scope);
    });
    rt.weather.bind({ audio, hurt: (amount, why) => { hurt('env.lightning', amount, { kind: 'env.lightning', label: 'Struck by lightning', text: 'Struck by lightning' }, why); } });
    const common = { animals, setWeaponsEnabled: (on: boolean) => { weapons.setEnabled(on); }, refill: () => { kit.refill(); }, interactables: shell.interactables, params,
      toast: (text: string) => { hud.toast(text); }, feed: (text: string) => { hud.killFeed(text); }, pickupHum: (on: boolean) => { audio.pickupHum(on); },
      music: (event: 'death' | 'pickup' | 'victory' | 'phase' | 'intro') => { if (event === 'death' || event === 'pickup') music.sting(event); else if (event === 'victory') music.sting('chunk'); else music.combat(1); } };
    await part();
    ctx.scope.run(() => rt.boss.bind({ ...common, persistence: persistence.bosses, spawnKing: () => king.spawn(), bow: kit.bow, upgradeBow: (power) => { kit.upgradeBow(weapons, power); } }));
    await part();
    ctx.scope.run(() => rt.elites.bind({ persistence: persistence.elites, animals, wildlife, taming: ride?.taming ?? null, ghosts: null, interactables: shell.interactables, params,
      toast: common.toast, feed: common.feed, record: (kind, variant) => { persistence.kill(kind, variant); persistence.feat(kind); }, pickupHum: common.pickupHum,
      sound: (name, at) => { audio.animal(name, at, player.position, player.yaw); }, sting: (event) => { if (event === 'kill') music.sting('chunk'); else music.combat(event === 'phase2' ? 1 : 0.8); } }));
    await part();
    ctx.scope.run(() => rt.titan.bind({ ...common, persistence: persistence.bosses, wildlife, ride, get sabre() { return kit.sabre; }, upgradeSabre: (power) => { kit.upgradeSabre(weapons, power); },
      hurt: (amount, why) => { hurt('boss.storm-titan', amount, { kind: 'storm-titan', label: 'the Storm Titan' }, why); },
      record: (kind, variant) => { persistence.kill(kind, variant); persistence.feat(kind); }, ownSkin: (id) => { rt.skins.own(id); } }));
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
    const flags = await installNalatiQuestView(ctx, rt, persistence);
    ctx.bag.fragment('finds', { id: 'nalati.finds', render: panel => { renderFinds(panel, nalatiFinds(flags)); } }); shell.hooks.questFlags = () => flags.all.slice().sort();
    ctx.playground(horsePlayground(ride, ctx));
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default NalatiPlugin;
