import { ShardPlugin, installLoot, type ShardContext } from '#game';
import { installSilentScore, installForestAmbience } from '#kit';
import { Vector3 } from 'three';
import type { Animal, Interactable, QuestState } from '#engine';
import { STRINGS } from './strings';
import { buildWorld, type BuiltWorld } from './world/build';
import { DUNE_RAY, DUNE_RAY_LOOK, rayBrain, type DuneRayBrain } from './species/duneRay';
import { SignalWhip } from './weapons/SignalWhip';
import { WHIP_ROW } from './weapons/rows';
import { installQuest } from './quest/install';
import { RAY, TOWER } from './layout';
import { installSunscarCues } from './audio/cues';
import { BAND, DUSK, LIGHT } from './look/sky';
import { ownPrimitives } from './world/resources';

declare module '#engine' {
  interface EquipmentSlotMap { 'signal-bullwhip': true }
}

export class SunscarDunesPlugin extends ShardPlugin {
  readonly player = new Vector3(); whip: SignalWhip | null = null; quest: QuestState | null = null;
  built: BuiltWorld | null = null; beacon: Interactable | null = null; ray: Animal | null = null;
  private light: () => void = () => undefined;
  override world(ctx: ShardContext): void {
    ctx.strings(STRINGS);
    this.built = buildWorld(ctx, () => { this.light(); }); this.beacon = this.built.beacon;
    ctx.game.runtime?.interactables.push(this.built.beacon);
  }
  override kit(ctx: ShardContext): void {
    ctx.rows.weapon(WHIP_ROW); ctx.rows.species(DUNE_RAY); ctx.rows.speciesLook(DUNE_RAY_LOOK);
    const rt = ctx.game.runtime;
    if (rt) rt.buildEquipment = (targets) => {
      if (rt.world === null) throw new Error('Signal Dunes equipment needs the world stage');
      this.whip = new SignalWhip(ctx.app, targets, (target) => rt.play?.animals.animals.find((a) => a.position === target.position)?.combatActor() ?? null);
      this.whip.onSwing = (heavy) => { if (heavy) rt.play?.cues.charge(WHIP_ROW, 'heavy'); else rt.play?.cues.fire(WHIP_ROW); };
      return Promise.resolve({ primary: this.whip, secondary: null, rifle: null, install: () => undefined });
    };
  }
  override play(ctx: ShardContext): void {
    const host = ctx.app.equipmentHost, whip = this.whip;
    if (host !== null && whip !== null) { host.viewmodel.add(whip.model); ctx.scope.onDispose(() => { whip.model.removeFromParent(); }); }
    const rt = ctx.game.runtime, position = rt?.world?.player.position ?? this.player;
    if (rt?.play) { installSilentScore(rt.play.music, ctx.scope); installForestAmbience(rt.play.audio, ctx.scope); installSunscarCues(rt.play.audio, rt.play.cues, ctx.scope); }
    const loot = rt?.play && rt.world ? installLoot({ ctx, manifest: ctx.manifest, owned: rt.play.owned, scene: rt.world.game.scene,
      player: rt.world.player, camera: rt.world.game.camera, animals: () => rt.play?.animals.animals ?? [], menu: rt.play.menu,
      presentation: { gear: (purse) => ({ coins: purse.coins }), finds: null, marks: null, charted: () => false, chime: () => { rt.play?.cues.cue('cue.swap'); } } }) : null;
    const signal = installQuest(ctx, position, loot?.purse ? (share) => { loot.purse?.add(share); } : undefined);
    this.quest = signal.quest; this.light = signal.light;
    if (signal.wasLit) this.built?.light();
    if (rt) rt.hooks.questFlags = () => this.quest?.isComplete ? ['sunscar.complete'] : [];
    // the whip's own context carries the melee defaults (LMB / F light, RMB heavy); the held weapon's context is pushed by the shell
    ctx.inputContext({ id: 'sunscar.whip', actions: ['attack', 'heavy', 'lock'], keysFrom: 'weapon.melee', touch: { mode: 'melee', lockable: true, relabel: {} } });
    if (this.built) { const pin = document.createElement('span'); pin.textContent = STRINGS.tower; ctx.hud.pin(this.built.beaconAt, pin); }
    const animals = rt?.play?.animals;
    this.ray = animals?.spawn('duneRay', RAY.x, RAY.z, 0, 'dusk') ?? null;
    ctx.scope.onDispose(() => { if (this.ray) animals?.retire(this.ray); this.ray = null; });
    ctx.debug.expose('sunscar', this); ctx.debug.expose('sunscarLight', { DUSK, LIGHT, BAND });
    if (this.whip) ownPrimitives(this.whip.model, ctx.scope);
  }
  /** The ray's brain, for captures and tests (`__wildshard.shard.sunscar.rayBrain()`). */
  rayBrain(): DuneRayBrain | null { return this.ray ? rayBrain(this.ray) : null; }
  /** Where the fire is: captures and the walk test aim here. */
  get tower(): { x: number; z: number } { return TOWER; }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default SunscarDunesPlugin;
