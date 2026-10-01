import { ShardPlugin, installLoot, type ShardContext } from '#game';
import { installSilentScore } from '#kit';
import { Vector3 } from 'three';
import type { Animal, QuestState } from '#engine';
import { STRINGS } from './strings';
import { buildWorld, type SignalFire } from './world/build';
import { ownPrimitives } from './world/resources';
import { DUNE_RAY, DUNE_RAY_LOOK } from './species/duneRay';
import { Bullwhip } from './weapons/Bullwhip';
import { WHIP_ROW } from './weapons/rows';
import { installQuest } from './quest/install';
import { installSunscarCues } from './audio/cues';
import { RAY_HOME } from './layout';

declare module '#engine' {
  interface EquipmentSlotMap { 'sunscar-whip': true }
}

/** The ray comes back this long after it falls. */
const RAY_RESPAWN = 25;

export class SignalDunesPlugin extends ShardPlugin {
  readonly player = new Vector3(); whip: Bullwhip | null = null; quest: QuestState | null = null;
  fire: SignalFire | null = null; ray: Animal | null = null;
  override world(ctx: ShardContext): void {
    ctx.strings(STRINGS);
    this.fire = buildWorld(ctx);
  }
  override kit(ctx: ShardContext): void {
    ctx.rows.weapon(WHIP_ROW);
    ctx.rows.species(DUNE_RAY); ctx.rows.speciesLook(DUNE_RAY_LOOK);
    const rt = ctx.game.runtime;
    if (rt) rt.buildEquipment = (targets) => {
      this.whip = new Bullwhip(ctx.app, targets, (target) => {
        const animal = rt.play?.animals.animals.find((a) => a.position === target.position) ?? null;
        return animal === null ? null : { actor: animal.combatActor(), animal };
      });
      this.whip.onSwing = (heavy) => { if (heavy) rt.play?.cues.charge(WHIP_ROW, 'heavy'); else rt.play?.cues.fire(WHIP_ROW); };
      return Promise.resolve({ primary: this.whip, secondary: null, rifle: null, install: () => undefined });
    };
  }
  override play(ctx: ShardContext): void {
    const host = ctx.app.equipmentHost, whip = this.whip;
    if (host !== null && whip !== null) { host.viewmodel.add(whip.model); ownPrimitives(whip.model, ctx.scope); }
    ctx.inputContext({ id: 'sunscar.whip', actions: ['attack', 'heavy', 'lock'], keysFrom: 'weapon.melee', touch: { mode: 'melee', lockable: true, relabel: {} } });
    const rt = ctx.game.runtime, position = rt?.world?.player.position ?? this.player;
    if (rt?.play) { installSilentScore(rt.play.music, ctx.scope); installSunscarCues(rt.play.audio, rt.play.cues, ctx.scope); }
    const loot = rt?.play && rt.world ? installLoot({ ctx, manifest: ctx.manifest, owned: rt.play.owned, scene: rt.world.game.scene,
      player: rt.world.player, camera: rt.world.game.camera, animals: () => rt.play?.animals.animals ?? [], menu: rt.play.menu,
      presentation: { gear: (purse) => ({ coins: purse.coins }), finds: null, marks: null, charted: () => false, chime: () => { rt.play?.cues.cue('cue.swap'); } } }) : null;
    const fire = this.fire;
    if (fire) this.quest = installQuest(ctx, position, fire, loot?.purse ? (share) => { loot.purse?.add(share); } : undefined).quest;
    if (rt) rt.hooks.questFlags = () => this.quest?.isComplete ? ['sunscar.complete'] : [];
    // The dune ray: one at a time, back RAY_RESPAWN seconds after it falls.
    const animals = rt?.play?.animals;
    const spawnRay = (): void => { this.ray = animals?.spawn('duneRay', RAY_HOME.x, RAY_HOME.z, 0, 'dusk') ?? null; };
    let respawnIn = -1;
    spawnRay();
    ctx.on('actor.died', ({ actor }) => { if (actor.tags.includes('creature.duneRay')) respawnIn = RAY_RESPAWN; });
    ctx.system({ id: 'sunscar.ray', phase: 'update', run: (dt) => {
      if (respawnIn < 0) return;
      respawnIn -= dt;
      if (respawnIn <= 0) { respawnIn = -1; if (this.ray) animals?.retire(this.ray); spawnRay(); }
    } });
    ctx.scope.onDispose(() => { if (this.ray) animals?.retire(this.ray); this.ray = null; });
    ctx.debug.expose('sunscar', this);
  }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default SignalDunesPlugin;
