import { ShardPlugin, installLoot, type ShardContext } from '#game';
import { installSilentScore } from '#kit';
import { DoubleSide, Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';
import type { Animal, Interactable, QuestState } from '#engine';
import { STRINGS } from './strings';
import { buildWorld, type SkyWorld } from './world/build';
import { DRIFT_RAY, DRIFT_RAY_LOOK } from './species/driftRay';
import { WarFan } from './weapons/WarFan';
import { FAN_ROW } from './weapons/rows';
import { installQuest } from './quest/install';
import { RAY } from './layout';
import { installSkyCues } from './audio/cues';

declare module '#engine' {
  interface ActionMap { 'far.gust': true }
  interface EquipmentSlotMap { 'war-fan': true }
}

/** seconds the winch takes to haul the fallen bridge up */
export const RAISE_SECONDS = 3;
const FALLEN_TILT = 1.35;

export class SkyReachPlugin extends ShardPlugin {
  readonly player = new Vector3();
  world_: SkyWorld | null = null; fan: WarFan | null = null; quest: QuestState | null = null; ray: Animal | null = null;
  winch: Interactable | null = null; raising = false;
  override world(ctx: ShardContext): void {
    ctx.strings(STRINGS);
    const built = buildWorld(ctx, () => { this.raise(); });
    this.world_ = built; this.winch = built.winch;
    ctx.game.runtime?.interactables.push(built.winch);
  }
  /** The winch: starts the lift once; the `far.bridge` system finishes it. */
  raise(): void {
    const w = this.world_; if (w === null || this.raising || w.bridge.lift >= 1) return;
    this.raising = true; if (this.winch) this.winch.label = STRINGS.winchBusy;
  }
  override kit(ctx: ShardContext): void {
    ctx.rows.weapon(FAN_ROW); ctx.rows.species(DRIFT_RAY); ctx.rows.speciesLook(DRIFT_RAY_LOOK);
    ctx.rows.feat({ id: 'far.firstQuest', name: STRINGS.quest, goal: STRINGS.raise, count: 1, event: 'far.quest', title: STRINGS.quest, icon: 'glyph' });
    const rt = ctx.game.runtime;
    if (rt) rt.buildEquipment = (targets) => {
      this.fan = new WarFan(ctx.app, targets, (target) => rt.play?.animals.animals.find((a) => a.position === target.position)?.combatActor() ?? null,
        () => rt.play?.animals.animals ?? []);
      this.fan.onSwing = (heavy) => { if (heavy) rt.play?.cues.charge(FAN_ROW, 'heavy'); else rt.play?.cues.fire(FAN_ROW); };
      return Promise.resolve({ primary: this.fan, secondary: null, rifle: null });
    };
  }
  override play(ctx: ShardContext): void {
    const rt = ctx.game.runtime, position = rt?.world?.player.position ?? this.player, w = this.world_;
    const host = ctx.app.equipmentHost, fan = this.fan;
    if (host !== null && fan !== null) { host.viewmodel.add(fan.model); ctx.scope.onDispose(() => { fan.model.removeFromParent(); }); }
    if (rt?.play) { installSilentScore(rt.play.music, ctx.scope); installSkyCues(rt.play.audio, rt.play.cues, ctx.scope); }
    const loot = rt?.play && rt.world ? installLoot({ ctx, manifest: ctx.manifest, owned: rt.play.owned, scene: rt.world.game.scene,
      player: rt.world.player, camera: rt.world.game.camera, animals: () => rt.play?.animals.animals ?? [], menu: rt.play.menu,
      presentation: { gear: (purse) => ({ coins: purse.coins }), finds: null, marks: null, charted: () => false, chime: () => { rt.play?.cues.cue('cue.swap'); } } }) : null;
    const { quest, flags } = installQuest(ctx, position, loot?.purse ? (share) => { loot.purse?.add(share); } : undefined);
    this.quest = quest;
    if (rt) rt.hooks.questFlags = () => this.quest?.isComplete ? ['far.complete'] : [];

    // The fallen bridge: hangs under Sunrest's rim until the winch hauls it up; a raised bridge stays up (a saved flag).
    const pinEl = document.createElement('span'); pinEl.textContent = STRINGS.pin;
    if (w !== null) {
      if (flags.has('far.bridge')) { w.bridge.lift = 1; pinEl.style.visibility = 'hidden'; if (this.winch) this.winch.label = STRINGS.bridgeUp; }
      w.bridge.pivot.rotation.x = FALLEN_TILT * (1 - w.bridge.lift);
      ctx.hud.pin(w.winchAt, pinEl);
      ctx.system({ id: 'far.bridge', phase: 'update', run: (dt) => {
        w.blades.rotation.z += dt * 0.7;
        const board = ctx.app.player?.mode === 'board';
        w.hoverGlow.emissiveIntensity = board ? 1.8 : 0.7; w.hoverGlow.opacity = board ? 0.75 : 0.5;
        if (!this.raising) return;
        w.bridge.lift = Math.min(1, w.bridge.lift + dt / RAISE_SECONDS);
        const eased = 1 - (1 - w.bridge.lift) ** 2; w.bridge.pivot.rotation.x = FALLEN_TILT * (1 - eased);
        if (w.bridge.lift < 1) return;
        this.raising = false; pinEl.style.visibility = 'hidden'; if (this.winch) this.winch.label = STRINGS.bridgeUp;
        flags.set('far.bridge'); rt?.play?.hud.toast(STRINGS.bridgeUp);
      } });
    }

    // The war fan: SWING relabels the attack disc, GUST takes the first verb slot (G on a keyboard).
    ctx.inputContext({ id: 'far.fan', actions: ['attack', 'heavy', 'lock', 'far.gust'], keysFrom: 'weapon.melee', keys: { 'far.gust': ['KeyG'] },
      touch: { mode: 'melee', lockable: true, relabel: { r0: { label: STRINGS.swing, tone: 'ready' } },
        verbs: { 'verb.1': { action: 'far.gust', label: STRINGS.gust, icon: '', show: () => ctx.app.state === 'play' } } } });
    const scene = rt?.world?.game.scene;
    if (fan !== null && scene !== undefined) {
      const ring = new Mesh(new RingGeometry(0.93, 1, 40), new MeshBasicMaterial({ color: 0xfff4ea, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }));
      ring.visible = false; scene.add(ring); ctx.scope.own(ring.geometry); ctx.scope.own(ring.material); ctx.scope.onDispose(() => { ring.removeFromParent(); });
      let age = 1; const at = new Vector3(), dir = new Vector3();
      fan.onGust = (from, d) => { at.copy(from); dir.copy(d); age = 0; rt?.play?.cues.charge(FAN_ROW, 'heavy'); };
      ctx.system({ id: 'far.gust', phase: 'update', run: (dt) => {
        age += dt; const k = age / 0.5; ring.visible = k < 1; if (!ring.visible) return;
        ring.position.copy(at).addScaledVector(dir, 1.5 + k * 7); ring.lookAt(ring.position.clone().add(dir));
        ring.scale.setScalar(0.6 + k * 4); ring.material.opacity = 0.32 * (1 - k);
      } });
    }

    // The drift ray: one circles Sunrest; a new one glides in 30 s after a kill.
    const animals = rt?.play?.animals;
    const spawnRay = (): void => { if (animals) this.ray = animals.spawn('driftRay', RAY.x + RAY.radius, RAY.z, Math.PI / 2, 'dusk'); };
    spawnRay();
    ctx.on('actor.died', ({ actor }) => { if (actor.tags.includes('creature.driftRay')) ctx.scope.timeout(30000, () => { if (this.ray && animals) animals.retire(this.ray); spawnRay(); }); });
    ctx.scope.onDispose(() => { if (this.ray && animals) animals.retire(this.ray); this.ray = null; });
    ctx.debug.expose('farReach', this);
  }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default SkyReachPlugin;
