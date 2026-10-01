import { ShardPlugin, installLoot, type ShardContext } from '#game';
import { installSilentScore } from '#kit';
import type { Animal, QuestState } from '#engine';
import { DoubleSide, Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';
import { STRINGS } from './strings';
import { RAY_HOMES } from './layout';
import { buildWorld, type BuiltWorld } from './world/build';
import { WarFan, type FanTarget } from './weapons/WarFan';
import { FAN_ROW } from './weapons/rows';
import { DRIFT_RAY, DRIFT_RAY_LOOK } from './species/driftRay';
import { FLAGS, installQuest } from './quest/install';
import { installSkyCues } from './audio/cues';

declare module '#engine' {
  interface ActionMap { 'far.gust': true }
  interface EquipmentSlotMap { 'far-fan': true }
}

/** How fast the winch lifts the fallen bridge (radians per second). */
export const RAISE_RATE = 0.55;

export class SkyReachPlugin extends ShardPlugin {
  readonly player = new Vector3();
  built: BuiltWorld | null = null; fan: WarFan | null = null; quest: QuestState | null = null; rays: Animal[] = [];
  /** Is the player riding the hoverboard? The hover decks collide only then (ENGINE §5 `app.player.mode`). */
  private board: () => boolean = () => false;

  override world(ctx: ShardContext): void {
    ctx.strings(STRINGS);
    this.board = () => ctx.app.player?.mode === 'board';
    this.built = buildWorld(ctx, () => this.board());
    ctx.game.runtime?.interactables.push(this.built.winch);
  }
  override kit(ctx: ShardContext): void {
    ctx.rows.weapon(FAN_ROW); ctx.rows.species(DRIFT_RAY); ctx.rows.speciesLook(DRIFT_RAY_LOOK);
    const rt = ctx.game.runtime;
    const targets = (): readonly FanTarget[] => (rt?.play?.animals.animals ?? []).map((a) => ({ position: a.position, actor: a.combatActor(), impulse: (v: Vector3) => { a.impulse(v); } }));
    this.fan = new WarFan(ctx.app, targets);
    if (rt) rt.buildEquipment = () => {
      const fan = this.fan; if (fan === null) throw new Error('Sky Reach: the war fan was not built');
      fan.onSwing = (heavy) => { if (heavy) rt.play?.cues.charge(FAN_ROW, 'heavy'); else rt.play?.cues.fire(FAN_ROW); };
      return Promise.resolve({ primary: fan, secondary: null, rifle: null, install: () => undefined });
    };
  }
  override play(ctx: ShardContext): void {
    const rt = ctx.game.runtime, built = this.built, fan = this.fan, position = rt?.world?.player.position ?? this.player;
    if (built === null || fan === null) throw new Error('Sky Reach: world and kit must run before play');
    const host = ctx.app.equipmentHost;
    if (host !== null) { host.viewmodel.add(fan.model); ctx.scope.onDispose(() => { fan.model.removeFromParent(); }); }
    if (rt?.play) { installSilentScore(rt.play.music, ctx.scope); installSkyCues(rt.play.audio, rt.play.cues, ctx.scope); }
    const loot = rt?.play && rt.world ? installLoot({ ctx, manifest: ctx.manifest, owned: rt.play.owned, scene: rt.world.game.scene,
      player: rt.world.player, camera: rt.world.game.camera, animals: () => rt.play?.animals.animals ?? [], menu: rt.play.menu,
      presentation: { gear: (purse) => ({ coins: purse.coins }), finds: null, marks: null, charted: () => false, chime: () => { rt.play?.cues.cue('cue.swap'); } } }) : null;
    const { quest, flags } = installQuest(ctx, position, loot?.purse ? (share) => { loot.purse?.add(share); } : undefined);
    this.quest = quest;
    if (rt) rt.hooks.questFlags = () => quest.isComplete ? [FLAGS.complete] : [];

    ctx.inputContext({ id: 'far.fan', actions: ['attack', 'heavy', 'lock', 'far.gust'], keysFrom: 'weapon.melee', keys: { 'far.gust': ['KeyG'] },
      touch: { mode: 'melee', lockable: true, relabel: { r0: { label: STRINGS.swing, icon: '', tone: 'rest' } },
        verbs: { 'verb.1': { action: 'far.gust', label: STRINGS.gust, icon: '', show: () => ctx.app.state === 'play' } } } });

    // The winch: raise the fallen bridge, then it collides and the quest's first step is done.
    const pin = document.createElement('span'); pin.textContent = STRINGS.winchPin; ctx.hud.pin(built.winchAt, pin);
    if (flags.has(FLAGS.raised)) this.finishRaise(built);
    ctx.system({ id: 'far.winch', phase: 'update', run: (dt) => {
      if (built.state.raising && !built.state.raised) {
        built.fallen.rotation.x = Math.min(0, built.fallen.rotation.x + dt * RAISE_RATE);
        if (built.fallen.rotation.x >= 0) { this.finishRaise(built); flags.set(FLAGS.raised); rt?.play?.hud.toast(STRINGS.raised); }
      }
      pin.style.visibility = built.state.raised ? 'hidden' : 'visible';
    } });

    // The hover deck glows brighter while you ride the board; the mill turns.
    ctx.system({ id: 'far.dressing', phase: 'update', run: (dt, t) => {
      const riding = this.board();
      built.hoverDeck.emissiveIntensity = riding ? 0.9 + Math.sin(t * 4) * 0.15 : 0.25;
      built.hoverDeck.opacity = riding ? 0.75 : 0.5;
      built.millHub.rotation.z += dt * 0.35;
    } });

    // GUST: a thin wind ring that leaves the fan and widens.
    const ring = new Mesh(new RingGeometry(0.92, 1, 40), new MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false, fog: false }));
    ring.visible = false; ctx.root.add(ring); ctx.scope.own(ring.geometry); ctx.scope.own(ring.material); ctx.scope.onDispose(() => { ring.removeFromParent(); });
    let ringAge = 1; const ringDir = new Vector3();
    fan.onGust = (from, dir) => { ringAge = 0; ringDir.copy(dir); ring.position.copy(from).addScaledVector(dir, 1.6); ring.lookAt(from.clone().addScaledVector(dir, 4)); rt?.play?.cues.charge(FAN_ROW, 'heavy'); };
    ctx.system({ id: 'far.gust', phase: 'update', run: (dt) => {
      ringAge += dt; const k = Math.min(1, ringAge / 0.45); ring.visible = k < 1;
      if (ring.visible) { ring.position.addScaledVector(ringDir, dt * 14); ring.scale.setScalar(0.6 + k * 3.2); ring.material.opacity = 0.32 * (1 - k); }
    } });

    const animals = rt?.play?.animals;
    if (animals) for (const home of RAY_HOMES) {
      this.rays.push(animals.spawn('driftRay', home.x + home.r, home.z, 0, 'dusk'));
    }
    ctx.scope.onDispose(() => { for (const ray of this.rays) animals?.retire(ray); this.rays = []; });
    ctx.debug.expose('farReach', this);
  }
  /** Snap the fallen bridge up (the winch's end state, also restored from a save). */
  private finishRaise(built: BuiltWorld): void { built.fallen.rotation.x = 0; built.state.raised = true; built.state.raising = false; built.winch.label = STRINGS.raised; }
  /** Turn the winch (captures and tests use this through `__wildshard.shard.farReach`). */
  raise(): void { if (this.built && !this.built.state.raised) this.built.state.raising = true; }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default SkyReachPlugin;
