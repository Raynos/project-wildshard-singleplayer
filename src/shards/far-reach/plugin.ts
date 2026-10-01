import { ShardPlugin, type ShardContext } from '#game';
import { installSilentScore, installForestAmbience } from '#kit';
import { Vector3 } from 'three';
import type { Animal, QuestState } from '#engine';
import { STRINGS } from './strings';
import { buildWorld, type SkyWorld } from './world/build';
import { DRIFT_RAY, DRIFT_RAY_LOOK, rayBrain } from './species/driftRay';
import { WarFan } from './weapons/WarFan';
import { FAN_ROW } from './weapons/rows';
import { installQuest } from './quest/install';
import { GUST_CUE, installSkyCues } from './audio/cues';
import { RAY } from './layout';

declare module '#engine' {
  interface TierKnobMap { 'far.farIsles': number }
  interface ActionMap { 'far.gust': true }
  interface EquipmentSlotMap { 'far-fan': true }
}

/** Sky Reach: floating islands, rope and hover bridges, the war fan, the drift ray and the fallen bridge. */
export class SkyReachPlugin extends ShardPlugin {
  readonly player = new Vector3(); sky: SkyWorld | null = null; fan: WarFan | null = null; quest: QuestState | null = null; ray: Animal | null = null;
  override world(ctx: ShardContext): void {
    ctx.strings(STRINGS); ctx.tiers.knobs({ id: 'far', defaults: { 'far.farIsles': 8 } });
    const far = ctx.manifest.tiers?.[ctx.app.render?.tier ?? 'phone']?.['far.farIsles'] ?? 8;
    this.sky = buildWorld(ctx, far);
    ctx.game.runtime?.interactables.push(this.sky.winch);
  }
  override kit(ctx: ShardContext): void {
    ctx.rows.weapon(FAN_ROW); ctx.rows.species(DRIFT_RAY); ctx.rows.speciesLook(DRIFT_RAY_LOOK);
    const rt = ctx.game.runtime;
    if (rt) rt.buildEquipment = (targets) => {
      const animals = (): readonly Animal[] => rt.play?.animals.animals ?? [];
      this.fan = new WarFan(ctx.app, targets, { animals, actorFor: (target) => animals().find((a) => a.position === target.position)?.combatActor() ?? null,
        onGust: (gusted) => { const animal = animals().find((a) => a === gusted); if (animal?.kind === 'driftRay') rayBrain(animal).gusted(); } });
      this.fan.onSwing = (heavy) => { if (heavy) rt.play?.cues.charge(FAN_ROW, 'heavy'); else rt.play?.cues.fire(FAN_ROW); };
      this.fan.onGustCue = () => { rt.play?.cues.cue(GUST_CUE); };
      return Promise.resolve({ primary: this.fan, secondary: null, rifle: null, install: () => undefined });
    };
  }
  override play(ctx: ShardContext): void {
    const host = ctx.app.equipmentHost, fan = this.fan, world = this.sky;
    if (host !== null && fan !== null) { host.viewmodel.add(fan.model); ctx.scope.onDispose(() => { fan.model.removeFromParent(); }); }
    const rt = ctx.game.runtime, position = rt?.world?.player.position ?? this.player;
    if (rt?.play) { installSilentScore(rt.play.music, ctx.scope); installForestAmbience(rt.play.audio, ctx.scope); installSkyCues(rt.play.audio, rt.play.cues, ctx.scope); }
    ctx.inputContext({ id: 'far.fan', actions: ['attack', 'heavy', 'lock', 'far.gust'], keysFrom: 'weapon.melee', keys: { 'far.gust': ['KeyG'] },
      touch: { mode: 'melee', lockable: true, relabel: { r0: { label: STRINGS.swing, tone: 'rest' } },
        verbs: { 'verb.1': { action: 'far.gust', label: STRINGS.gust, icon: '', show: () => ctx.app.state === 'play' && this.fan?.enabled === true } } } });
    if (world) {
      this.quest = installQuest(ctx, world, position).quest;
      if (rt) rt.hooks.questFlags = () => this.quest?.isComplete ? ['far.complete'] : [];
      const tag = document.createElement('span'); tag.textContent = STRINGS.winch.toUpperCase();
      ctx.hud.pin(() => world.bridge.raised < 1 ? world.winchAt : null, tag);
      const hover = world.hover;
      ctx.system({ id: 'far.world', phase: 'update', run: (dt, t) => {
        world.sails.rotation.z += dt * 0.6;
        // the hover glass brightens under a board rider: the bridge is "on" only for them
        const on = ctx.app.player?.mode === 'board' ? 1 : 0, pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
        hover.glass.emissiveIntensity += ((on ? 0.9 : 0.2 + pulse * 0.1) - hover.glass.emissiveIntensity) * Math.min(1, dt * 6);
        hover.glass.opacity = on ? 0.6 : 0.4; hover.crystal.emissiveIntensity = on ? 1.6 : 0.6 + pulse * 0.4;
      } });
    }
    this.ray = rt?.play?.animals.spawn('driftRay', RAY.x, RAY.z, 0, 'common') ?? null;
    ctx.scope.onDispose(() => { if (this.ray) rt?.play?.animals.retire(this.ray); this.ray = null; });
    ctx.debug.expose('farReach', this);
  }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default SkyReachPlugin;
