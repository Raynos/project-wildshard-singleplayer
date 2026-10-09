import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { NALATI_SPECIES, NALATI_LOOKS } from '../species/rows';
import { creatureRigs } from '../species/hulls';
import { STRINGS } from '../strings';
import { NALATI_FEATS } from '../feats';
import { renderFinds } from '@wildshard/game/bag/bag';
import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import { macrotask } from '@wildshard/engine/boot/plan';
import type { DamageRequest } from '@wildshard/engine/combat/pipeline';
import { pathRampDescs } from '@wildshard/engine/physics/paths';
import { setting, onSettingChange } from '@wildshard/engine/ui/Settings';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { Rifle } from './weapons/Rifle';
import { NALATI_GRASS_LAYOUT } from '../look/grassFieldLayout';
import { Vector3 } from 'three';
import { buildNalatiWorld, type Nalati } from './state';
import { withGeometryBake } from '@wildshard/engine/world/geometryBake';
import { withVoxelAOBake } from '@wildshard/engine/world/voxelAO';
import { buildNalatiLoadout, type NalatiLoadout } from '../weapons/loadout';
import { AR15, BOW, SABRE, SPEAR } from '../weapons/equipment';
import { installNalatiAdventure, CAPTIONED_EVENTS } from '../adventure';
import { nalatiFinds, skinRows } from '../bag';
import { horsePlayground } from '../playground/registration';
import source from '../shard.config';
import { bindNalatiPersistence, type NalatiPersistence } from './persistence';
import { bindNalatiItems } from './items';
import { bindRuntimeBoss } from '@wildshard/game/shardfile/hybridRows';

function host(ctx: ShardContext): ShardRuntime {
  const rt = ctx.game.runtime;
  if (rt === undefined) throw new Error('Nalati plugin requires its world host');
  if (rt.world === null || rt.step === null) throw new Error('Nalati plugin requires counted world steps');
  return rt;
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
    this.persistence = bindNalatiPersistence(ctx, source, world.chunk.slug);
    ctx.strings(STRINGS);
    ctx.strings({ 'respawn.default': 'respawning on the north road', 'cause.ride': 'Thrown from the saddle', 'cause.ride.text': 'Thrown from the saddle', 'cause.lightning': 'Struck by lightning', 'cause.lightning.text': 'Struck by lightning', 'cause.stormTitan': 'the Storm Titan' });
    const { Grass } = await import('@wildshard/engine/world/Grass');
    await import('@wildshard/game/systems/looks/trample');
    (await import('@wildshard/game/systems/looks/grassField')).configureGrassField(NALATI_GRASS_LAYOUT, ctx.scope);
    // the grass step also builds the shared mote / mist / needle field the steppe has always carried (main.ts built it for
    // every forest shard before the plugin split; R2: dropping it lost a Points, two InstancedMeshes and three textures)
    const { grass, particles } = await step('grass', async () => {
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
    this.rt = await step('props', (progress) => withGeometryBake('/assets/nalati/baked/geometry.bin', () => withVoxelAOBake('/assets/nalati/baked/voxel-ao.bin', () => buildNalatiWorld(world, ctx, progress, this.persistence ?? undefined))));
    const rt = this.rt;
    // the ramps sit on the live (baked) heightfield the capsule walks, not the analytic TERRAIN field (R2: the analytic
    // heights laid 9 fewer ramps)
    const ground = await import('@wildshard/engine/world/Heightfield');
    registry.add({ id: 'paths', name: 'Paths', category: 'ground', file: 'src/engine/physics/paths.ts', surface: 'ground', colliders: pathRampDescs(ground.TRAILS, heightAt, (x, z) => ground.normalAt(x, z)[1], { carried: (x, z) => registry.floorAt(x, z) !== undefined }) });
    shell.hooks.animalsReady = (animals) => { rt.attachAnimals(animals); };
    shell.menu = { skins: () => skinRows(rt.skins), onWearSkin: (id) => { rt.skins.toggle(id); }, skinsTitle: 'Skins' };
    Object.assign(shell.objects, { nalati: rt, grass, particles });
    // the probe's `shard` handles (E405 AG25), read when the probe installs (ride and wildlife arrive in later hooks)
    // `coats`: the baked coats' source (scripts/bake-coats.mjs --shard=nalati-grasslands)
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, Object.defineProperties({ coats: () => creatureRigs.coatSources() }, Object.fromEntries(['nalati', 'ride', 'wildlife'].map((key) => [key, { enumerable: true, get: () => shell.objects[key] }]))));
    installEnteredRuntimeService(ctx, (scope) => { ctx.app.registerDayCycle(rt.weather.clock, scope); });
    if (!world.params.has('time')) rt.weather.clock.setTime(setting('time'));
    installEnteredRuntimeService(ctx, (scope) => { scope.onDispose(onSettingChange('time', (value) => { rt.weather.clock.setTime(value); })); });
  }

  override kit(ctx: ShardContext): void {
    const shell = host(ctx), world = shell.world;
    if (world === null) throw new Error('Nalati equipment requires a world');
    ctx.rows.species(NALATI_SPECIES);
    ctx.rows.speciesLook(NALATI_LOOKS);
    ctx.rows.feat(NALATI_FEATS);
    ctx.rows.weapon([BOW, SABRE, SPEAR, AR15]);
    shell.buildEquipment = (targets, nolock) => {
      const kit = buildNalatiLoadout(world, targets, nolock);
      this.loadout = kit;
      const rifle = new Rifle(world, targets, { row: AR15, allowUnlocked: nolock, muzzleLight: true });
      bindNalatiItems(ctx, { bow: kit.bow, sabre: kit.sabre, spear: kit.spear, rifle });
      return Promise.resolve({ primary: kit.base, rifle, secondary: null, extras: kit.extras, order: ['bow', 'sabre', 'spear'], install: (weapons) => { kit.install(weapons); } });
    };
  }

  override async play(ctx: ShardContext): Promise<void> {
    const shell = host(ctx), world = shell.world, h = shell.play, rt = this.runtime(), kit = this.loadout;
    if (world === null || h === null || kit === null) throw new Error('Nalati gameplay requires its equipment and UI');
    const { player, game, sky, params, chunk, registry } = world;
    const { animals, weapons, hud, audio, music, progress, fullMap } = h;
    const persistence = this.persistence;
    if (persistence === null) throw new Error('Nalati declared progression has not been bound');
    persistence.bindProgress(progress);
    const king = bindRuntimeBoss(ctx, source, 'nalati.golden-king', undefined, { identity: 'runtime' });
    const wildlife = rt.wildlife;
    if (wildlife === null) throw new Error('Nalati creatures have not been built');
    const hurt = (tag: DamageRequest['sourceTags'][number], amount: number, cause: DamageRequest['cause'], toast?: string): void => {
      const target = ctx.app.player;
      if (target === null) return;
      ctx.app.combat.hit({ source: 'env', sourceTags: [tag, 'feel.jolt', 'cover.checked'], target, amount, point: player.position.clone(), dir: new Vector3(), ...(cause === undefined ? {} : { cause }), ...(toast === undefined ? {} : { toast }) });
    };
    rt.bindPlay({ kit, health01: () => { const attributes = ctx.app.player?.attributes; return attributes === undefined ? 1 : attributes.health / attributes.maxHealth; }, toast: (text) => { hud.toast(text); }, flash: () => { hud.damageFlash(); }, hurt: (amount) => { hurt('env.ride', amount, { kind: 'env.ride', label: 'Thrown from the saddle', text: 'Thrown from the saddle' }); } });
    const ride = rt.ride;
    if (ride !== null) await ride.raid.installDirector(ctx, () => player.position);
    if (ride !== null) shell.interactables.push(ride.interactable);
    Object.assign(shell.objects, { wildlife, ride });
    ctx.on('weather.changed', (state) => { hud.setWeather(state); });
    rt.sound?.bind(audio, music, animals, wildlife);
    installEnteredRuntimeService(ctx, (scope) => {
      h.cues.use((id, options) => options.surface === undefined ? rt.sound?.fire(id) === true : rt.sound?.impact(id, options.surface === 'flesh' || options.surface === 'wood' ? options.surface : 'ground', options.pan ?? 0, options.gain ?? 1) === true, scope);
    });
    rt.weather.bind({ audio, hurt: (amount, why) => { hurt('env.lightning', amount, { kind: 'env.lightning', label: 'Struck by lightning', text: 'Struck by lightning' }, why); } });
    const common = { animals, setWeaponsEnabled: (on: boolean) => { weapons.setEnabled(on); }, refill: () => { kit.refill(); }, interactables: shell.interactables, params,
      toast: (text: string) => { hud.toast(text); }, feed: (text: string) => { hud.killFeed(text); }, pickupHum: (on: boolean) => { audio.pickupHum(on); },
      music: (event: 'death' | 'pickup' | 'victory' | 'phase' | 'intro') => { if (event === 'death' || event === 'pickup') music.sting(event); else if (event === 'victory') music.sting('chunk'); else music.combat(1); } };
    ctx.scope.run(() => rt.boss.bind({ ...common, persistence: persistence.bosses, spawnKing: () => king.spawn(), bow: kit.bow, upgradeBow: (power) => { kit.upgradeBow(weapons, power); } }));
    ctx.scope.run(() => rt.elites.bind({ persistence: persistence.elites, animals, wildlife, taming: ride?.taming ?? null, ghosts: null, interactables: shell.interactables, params,
      toast: common.toast, feed: common.feed, record: (kind, variant) => { persistence.kill(kind, variant); persistence.feat(kind); }, pickupHum: common.pickupHum,
      sound: (name, at) => { audio.animal(name, at, player.position, player.yaw); }, sting: (event) => { if (event === 'kill') music.sting('chunk'); else music.combat(event === 'phase2' ? 1 : 0.8); } }));
    ctx.scope.run(() => rt.titan.bind({ ...common, persistence: persistence.bosses, wildlife, ride, get sabre() { return kit.sabre; }, upgradeSabre: (power) => { kit.upgradeSabre(weapons, power); },
      hurt: (amount, why) => { hurt('boss.storm-titan', amount, { kind: 'storm-titan', label: 'the Storm Titan' }, why); },
      record: (kind, variant) => { persistence.kill(kind, variant); persistence.feat(kind); }, ownSkin: (id) => { rt.skins.own(id); } }));
    // Boss prewarming reserves its identity before the authored lairs materialize for strict restore.
    if (retainsRuntimeServices(ctx)) rt.elites.initialize();
    if (ride !== null) ride.taming.onBonded = () => { persistence.feat('tame'); };
    ctx.on('player.died', () => { if (ride?.mounted === true) ride.mount.dismount(); });
    ctx.on('player.respawned', () => { kit.refill(); });
    const health = ctx.app.player;
    installEnteredRuntimeService(ctx, (scope) => {
      health?.checkpoint(scope, () => rt.boss.onPlayerDeath(), () => ctx.app.player === health);
      health?.checkpoint(scope, () => rt.titan.onPlayerDeath(), () => ctx.app.player === health);
    });
    ctx.answer('feat.toast', (value) => ({ ...value, allowed: value.allowed && (value.event === undefined || !CAPTIONED_EVENTS.has(value.event)) }));
    const quest = installNalatiAdventure({ ctx, game, sky, player, chunk, prompts: shell.interactables, registry, hud, audio, music, progress, persistence, fullMap, ride, animals, nalati: rt, params });
    await quest?.people.ready;
    if (ctx.scope.disposed) throw new Error('Nalati was unloaded during the camp people model load');
    if (quest !== null) { ctx.bag.fragment('finds', { id: 'nalati.finds', render: (panel) => { renderFinds(panel, nalatiFinds(quest.flags)); } }); shell.hooks.questFlags = () => quest.flags.all.slice().sort(); }
    ctx.playground(horsePlayground(ride));
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default NalatiPlugin;
