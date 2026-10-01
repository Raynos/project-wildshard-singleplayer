import { ShardPlugin, installLoot, type ShardContext } from '#game';
import { installSilentScore } from '#kit';
import { Vector3 } from 'three';
import type { Animal } from '#engine';
import { STRINGS } from './strings';
import { buildWorld, type BuiltWorld } from './world/build';
import { DUNE_RAY, DUNE_RAY_LOOK } from './species/duneRay';
import { Bullwhip } from './weapons/Bullwhip';
import { WHIP_ROW } from './weapons/rows';
import { installQuest, type DuneQuest } from './quest/install';
import { installDuneCues } from './audio/cues';
import { RAY_HOME, TOWER } from './layout';
import { ownPrimitives } from './world/resources';

declare module '#engine' {
  interface EquipmentSlotMap { 'sunscar-whip': true }
}

export class SignalDunesPlugin extends ShardPlugin {
  readonly player = new Vector3(); whip: Bullwhip | null = null; quest: DuneQuest | null = null; built: BuiltWorld | null = null; ray: Animal | null = null;

  override world(ctx: ShardContext): void {
    ctx.strings(STRINGS);
    this.built = buildWorld(ctx, () => { this.quest?.lightFire(); });
    ctx.game.runtime?.interactables.push(this.built.brazier);
  }

  override kit(ctx: ShardContext): void {
    ctx.rows.weapon(WHIP_ROW); ctx.rows.species(DUNE_RAY); ctx.rows.speciesLook(DUNE_RAY_LOOK);
    const rt = ctx.game.runtime;
    if (rt) rt.buildEquipment = (targets) => {
      this.whip = new Bullwhip(ctx.app, targets, (target) => rt.play?.animals.animals.find((a) => a.position === target.position)?.combatActor() ?? null);
      this.whip.onSwing = (heavy) => { if (heavy) rt.play?.cues.charge(WHIP_ROW, 'heavy'); else rt.play?.cues.fire(WHIP_ROW); };
      return Promise.resolve({ primary: this.whip, secondary: null, rifle: null, install: () => undefined });
    };
  }

  override play(ctx: ShardContext): void {
    const rt = ctx.game.runtime, position = rt?.world?.player.position ?? this.player, built = this.built, whip = this.whip;
    // The whip draws in the engine's viewmodel pass; the scope takes it down.
    const host = ctx.app.equipmentHost;
    if (host !== null && whip !== null) { host.viewmodel.add(whip.model); ctx.scope.onDispose(() => { whip.model.removeFromParent(); }); }
    if (whip) ownPrimitives(whip.model, ctx.scope);
    ctx.inputContext({ id: 'sunscar.whip', actions: ['attack', 'heavy', 'lock'], keysFrom: 'weapon.melee', touch: { mode: 'melee', lockable: true, relabel: {} } });
    if (rt?.play) { installSilentScore(rt.play.music, ctx.scope); installDuneCues(rt.play.audio, rt.play.cues, ctx.scope); }
    const loot = rt?.play && rt.world ? installLoot({ ctx, manifest: ctx.manifest, owned: rt.play.owned, scene: rt.world.game.scene,
      player: rt.world.player, camera: rt.world.game.camera, animals: () => rt.play?.animals.animals ?? [], menu: rt.play.menu,
      presentation: { gear: (purse) => ({ coins: purse.coins }), finds: null, marks: null, charted: () => false, chime: () => { rt.play?.cues.cue('cue.swap'); } } }) : null;
    if (built) {
      this.quest = installQuest(ctx, built.firePoint, position, loot?.purse ? (share) => { loot.purse?.add(share); } : undefined);
      if (this.quest.wasLit) { built.light(); this.quest.lightFire(); }
      const pin = document.createElement('span'); pin.textContent = STRINGS.tower; ctx.hud.pin(new Vector3(TOWER.x, built.firePoint.y + 4, TOWER.z), pin);
      const { tower } = built;
      ctx.system({ id: 'sunscar.fire', phase: 'update', run: (_dt, t) => {
        if (!tower.fire.visible) return;
        tower.flames.forEach((flame, i) => { flame.scale.set(1 + Math.sin(t * 9 + i) * 0.08, 1 + Math.sin(t * 13 + i * 2.1) * 0.18, 1); flame.rotation.y = t * (0.6 + i * 0.3); });
        tower.light.intensity = 115 + Math.sin(t * 17) * 12 + Math.sin(t * 7.3) * 9;
      } });
    }
    if (rt) rt.hooks.questFlags = () => this.quest?.quest.isComplete ? ['sunscar.signal.done'] : [];
    const animals = rt?.play?.animals;
    this.ray = animals?.spawn('duneRay', RAY_HOME.x, RAY_HOME.z, 0, 'adult') ?? null;
    ctx.scope.onDispose(() => { if (this.ray) animals?.retire(this.ray); this.ray = null; });
    ctx.debug.expose('sunscar', this);
  }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default SignalDunesPlugin;
