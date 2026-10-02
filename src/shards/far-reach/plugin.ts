import { ShardPlugin, installLoot, type ShardContext } from '#game';
import { installSilentScore } from '#kit';
import type { Animal, Flags, QuestState } from '#engine';
import { BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial, Vector3, type Texture } from 'three';
import { STRINGS } from './strings';
import { GOATS, RAY_HOMES, ROC, ROOST_RAYS, UPDRAFT, WISP_HOMES, apothem, type Home } from './layout';
import { buildWorld, type BuiltWorld } from './world/build';
import { gustFx } from './world/windFx';
import { FALL_TIME } from './world/distant';
import { WarFan, inCone, GUST, type FanTarget } from './weapons/WarFan';
import { FAN_ROW } from './weapons/rows';
import { DRIFT_RAY, DRIFT_RAY_LOOK } from './species/driftRay';
import { SKY_GOAT, SKY_GOAT_LOOK } from './species/skyGoat';
import { GALE_WISP, GALE_WISP_LOOK } from './species/galeWisp';
import { GALE_WALL, STORM_ROC, STORM_ROC_LOOK, rocBrain } from './species/stormRoc';
import { bindPlayerPush, setHome } from './species/rig';
import { preloadSkyMeshes } from './world/meshes';
import { FAN_LEAF_URL } from './boot/files';
import { loadPainted } from './look/image';
import { meadow, type Meadow } from './world/meadow';
import { SUN_DIR } from './look/sun';
import { ROC_ID, StormRocBoss } from './combat/stormRoc';
import { BOSS_REWARD, FLAGS, installQuest, vaneFlag } from './quest/install';
import { installSkyCues } from './audio/cues';

declare module '#engine' {
  interface ActionMap { 'far.gust': true }
  interface EquipmentSlotMap { 'far-fan': true }
  interface TierKnobMap { 'far.meadowBlades': number }
}

/** The touch icons (council R1B-11: every primary and verb carries one): an open fan for SWING (the attack disc's own
 * 24 × 24 svg), wind curls for GUST (a whole svg before the verb's label). */
const SWING_ICON = '<path d="M12 19.5 4.2 9.8a10 10 0 0 1 15.6 0Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
  + '<path d="M12 19.5 8.6 7.6M12 19.5V6.8M12 19.5l3.4-11.9" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>';
const GUST_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5h10.5a3 3 0 1 0-3-3M3 12.5h14.5a3 3 0 1 1-3 3M3 16.5h7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
/** The updraft's upward push while you ride its column (m/s², G24). */
export const UPDRAFT_LIFT = 12;
/** How far above its island's deck a goat's spawn ray starts (metres): above the grass, below anything overhead. */
export const GOAT_SPAWN_ABOVE = 2;
/** How fast the winch lifts the fallen bridge (radians per second). */
export const RAISE_RATE = 0.55;
/** How close a GUST must reach a vane to turn it (metres; the cone is the fan's GUST cone, a little longer). */
export const VANE_REACH = GUST.reach + 2;

export class SkyReachPlugin extends ShardPlugin {
  readonly player = new Vector3();
  built: BuiltWorld | null = null; fan: WarFan | null = null; quest: QuestState | null = null; boss: StormRocBoss | null = null;
  rays: Animal[] = []; roostRays: Animal[] = []; goats: Animal[] = []; wisps: Animal[] = []; roc: Animal | null = null;
  /** Is the player riding the hoverboard? Hover decks and the updraft collide only then (ENGINE §5 `app.player.mode`). */
  private board: () => boolean = () => false;
  flags: Flags | null = null;
  /** The war fan's painted silk (loop 4), loaded behind the loading screen and owned by the level scope. */
  leaf: Texture | null = null;
  /** The near meadow that travels with the camera (loop 4). */
  meadow: Meadow | null = null;

  override async world(ctx: ShardContext): Promise<void> {
    ctx.strings(STRINGS);
    // The generated models (C6) load behind the loading screen; the world and the creature looks read them synchronously.
    await preloadSkyMeshes();
    // the fan's painted silk; without it (offline, a test page) the fan keeps its plain teal, as the models keep their code stand-ins
    const leaf = await loadPainted(FAN_LEAF_URL, 'far.fan-leaf');
    if (leaf !== null) { this.leaf = leaf; ctx.scope.own(leaf); }
    this.board = () => ctx.app.player?.mode === 'board';
    this.built = buildWorld(ctx, () => this.board());
    const blades = ctx.manifest.tiers?.phone?.['far.meadowBlades'] ?? 0;
    ctx.tiers.knobs({ id: 'far', defaults: { 'far.meadowBlades': blades } });
    const field = meadow(SUN_DIR, ctx.manifest.tiers?.[ctx.app.render?.tier ?? 'phone']?.['far.meadowBlades'] ?? blades);
    this.meadow = field; ctx.root.add(field.mesh); ctx.scope.own(field.mesh.geometry); ctx.scope.own(field.mesh.material);
    ctx.scope.onDispose(() => { field.mesh.removeFromParent(); });
    ctx.game.runtime?.interactables.push(this.built.winch, this.built.notes);
  }
  override kit(ctx: ShardContext): void {
    ctx.rows.weapon(FAN_ROW);
    ctx.rows.species([DRIFT_RAY, SKY_GOAT, GALE_WISP, STORM_ROC]); ctx.rows.speciesLook([DRIFT_RAY_LOOK, SKY_GOAT_LOOK, GALE_WISP_LOOK, STORM_ROC_LOOK]);
    ctx.rows.encounter({ id: ROC_ID, displayName: STRINGS.roc });
    const rt = ctx.game.runtime;
    // The shared combat-target query (ENGINE §19): world creatures in play, the Practice Arena's dummies while it is open.
    const targets = (): readonly FanTarget[] => ctx.app.combat.targets().filter((t) => t.hittable);
    this.fan = new WarFan(ctx.app, targets);
    if (this.leaf !== null) this.fan.setLeaf(this.leaf);
    if (rt) rt.buildEquipment = () => {
      const fan = this.fan; if (fan === null) throw new Error('Sky Reach: the war fan was not built');
      fan.onSwing = (heavy) => { if (heavy) rt.play?.cues.charge(FAN_ROW, 'heavy'); else rt.play?.cues.fire(FAN_ROW); };
      return Promise.resolve({ primary: fan, secondary: null, rifle: null, install: () => undefined });
    };
  }
  override play(ctx: ShardContext): void {
    const rt = ctx.game.runtime, built = this.built, fan = this.fan, position = rt?.world?.player.position ?? this.player;
    if (built === null || fan === null) throw new Error('Sky Reach: world and kit must run before play');
    const host = ctx.app.equipmentHost, toast = (text: string): void => { rt?.play?.hud.toast(text); };
    if (host !== null) { host.viewmodel.add(fan.model); ctx.scope.onDispose(() => { fan.model.removeFromParent(); }); }
    fan.stowed = () => this.board();
    // G24: the wisp's burst and the Roc's gale wall shove the player (`app.player.impulse`).
    bindPlayerPush((v) => { ctx.app.player?.impulse(v); }); ctx.scope.onDispose(() => { bindPlayerPush(null); });
    if (rt?.play) { installSilentScore(rt.play.music, ctx.scope); installSkyCues(rt.play.audio, rt.play.cues, ctx.scope); }
    const loot = rt?.play && rt.world ? installLoot({ ctx, manifest: ctx.manifest, owned: rt.play.owned, scene: rt.world.game.scene,
      player: rt.world.player, camera: rt.world.game.camera, animals: () => rt.play?.animals.animals ?? [], menu: rt.play.menu,
      presentation: { gear: (purse) => ({ coins: purse.coins }), finds: null, marks: null, charted: () => false, chime: () => { rt.play?.cues.cue('cue.swap'); } } }) : null;
    const { quest, flags, burst } = installQuest(ctx, position, loot?.purse ? (share) => { loot.purse?.add(share); } : undefined);
    this.quest = quest; this.flags = flags;
    if (rt) rt.hooks.questFlags = () => quest.isComplete ? [FLAGS.complete] : [];

    ctx.inputContext({ id: 'far.fan', actions: ['attack', 'heavy', 'lock', 'far.gust'], keysFrom: 'weapon.melee', keys: { 'far.gust': ['KeyG'] },
      touch: { mode: 'melee', lockable: true, relabel: { r0: { label: STRINGS.swing, icon: SWING_ICON } },
        verbs: { 'verb.1': { action: 'far.gust', label: STRINGS.gust, icon: GUST_ICON, show: () => ctx.app.state === 'play' && !this.board() } } } });

    // Step 1: the keeper's notes.
    built.notes.onInteract = () => { flags.set(FLAGS.notes); toast(STRINGS.notesToast); };
    // Step 4: the winch answers only once the roost is quiet and the vanes turn (the notes say so).
    const unlocked = (): boolean => flags.has(FLAGS.roost) && flags.has(FLAGS.vanes);
    built.winch.onInteract = () => { if (built.state.raised) return; if (unlocked()) built.state.raising = true; else toast(STRINGS.winchLocked); };
    // the world pins, chip, map and minimap marks are the quest presentation's (quest/install.ts)
    if (flags.has(FLAGS.raised)) this.finishRaise(built);
    ctx.system({ id: 'far.winch', phase: 'update', run: (dt) => {
      if (built.state.raising && !built.state.raised) {
        built.fallen.rotation.x = Math.min(0, built.fallen.rotation.x + dt * RAISE_RATE);
        if (built.fallen.rotation.x >= 0) { this.finishRaise(built); flags.set(FLAGS.raised); toast(STRINGS.raised); }
      }
    } });

    // The updraft lifts (G24): riding the board up the wind column, a steady upward push (`app.player.impulse`, decaying
    // like an animal's, so a constant feed holds about UPDRAFT_LIFT / 3.5 m/s) floats you off the ramp to the high step.
    const lift = new Vector3();
    ctx.system({ id: 'far.updraft', phase: 'fixed.pre', run: (dt) => {
      const p = position; if (!this.board()) return;
      const inside = Math.abs(p.x - UPDRAFT.x) < UPDRAFT.width / 2 + 0.5 && p.z < UPDRAFT.z0 && p.z > UPDRAFT.z1 && p.y < UPDRAFT.y1 + 0.5;
      if (inside) ctx.app.player?.impulse(lift.set(0, UPDRAFT_LIFT * dt, 0));
    } });

    // Dressing: the hover decks glow while you ride; the mill and the turned vanes spin; the updraft's rings rise.
    ctx.system({ id: 'far.dressing', phase: 'update', run: (dt, t) => {
      const riding = this.board();
      built.hoverDeck.emissiveIntensity = riding ? 0.9 + Math.sin(t * 4) * 0.15 : 0.5; built.hoverDeck.opacity = riding ? 0.75 : 0.5;
      const cam = rt?.world?.game.camera; if (cam && this.meadow) this.meadow.update(cam.position, t);
      built.millHub.rotation.z += dt * 0.35; FALL_TIME.value = t; built.storm.update(dt, t); built.wind.update(t);
      for (const v of built.vanes) v.rotor.rotation.y += dt * (flags.has(vaneFlag(v.id)) ? 6 : 0.25);
    } });

    // GUST: a cone of wind streaks and petals leaves the fan (style bible §7); a vane inside the cone starts turning (step 3).
    const fxRandom = ctx.app.rng.stream('cosmetic'), gustView = gustFx(() => fxRandom.next());
    for (const o of gustView.objects) ctx.root.add(o);
    ctx.scope.onDispose(() => { gustView.dispose(); });
    fan.onGust = (from, dir) => {
      gustView.fire(from.clone().addScaledVector(dir, 0.2).setY(from.y - 0.25), dir); rt?.play?.cues.charge(FAN_ROW, 'heavy');
      this.gustVanes(from, dir, toast);
    };
    ctx.system({ id: 'far.gust', phase: 'update', run: (dt) => { gustView.update(dt); } });

    // Creatures: each one knows its home (an island or a flying circle).
    const animals = rt?.play?.animals;
    const spawn = (kind: string, variant: string, home: Home, x: number, z: number, placement?: { fromY: number }): Animal | null => {
      if (!animals) return null; const a = animals.spawn(kind, x, z, 0, variant, placement); setHome(a, home); return a;
    };
    for (const home of RAY_HOMES) { const a = spawn('driftRay', 'dusk', home, home.x + home.r, home.z); if (a) this.rays.push(a); }
    for (const home of ROOST_RAYS) { const a = spawn('driftRay', 'dusk', home, home.x + home.r, home.z); if (a) this.roostRays.push(a); }
    // The goats walk their island's deck (G26): the spawn lands them on the first WORLD floor under `fromY`. That ray
    // finds the islands only once physics has stepped (in `play` it hits nothing and the goat lands on the −1000 m
    // analytic floor), so they spawn on the first fixed step.
    let goatsDue = true;
    ctx.system({ id: 'far.goats', phase: 'fixed.post', run: () => {
      if (!goatsDue) return; goatsDue = false;
      for (const g of GOATS) {
        const a = spawn('skyGoat', 'cloud', { x: g.isle.x, z: g.isle.z, r: apothem(g.isle), y: g.isle.y }, g.isle.x + g.dx, g.isle.z + g.dz, { fromY: g.isle.y + GOAT_SPAWN_ABOVE });
        if (a) this.goats.push(a);
      }
    } });
    for (const home of WISP_HOMES) { const a = spawn('galeWisp', 'gale', home, home.x + home.r, home.z); if (a) this.wisps.push(a); }
    this.roc = spawn('stormRoc', 'storm', ROC, ROC.x + ROC.r, ROC.z);
    ctx.scope.onDispose(() => { for (const a of [...this.rays, ...this.roostRays, ...this.goats, ...this.wisps, ...(this.roc ? [this.roc] : [])]) animals?.retire(a); });
    // Step 2: the roost is clear when its three rays are down.
    ctx.system({ id: 'far.roost', phase: 'update', run: () => {
      if (flags.has(FLAGS.notes) && !flags.has(FLAGS.roost) && this.roostRays.length > 0 && this.roostRays.every((a) => !a.alive)) flags.set(FLAGS.roost);
    } });

    // The boss: the Storm Roc on the crown, the shared BossBar, 25 coins once.
    const boss = new StormRocBoss(ctx, position, this.roc, () => {
      if (flags.has(FLAGS.roc)) { toast(STRINGS.rocDown); return; }
      flags.set(FLAGS.roc); burst(BOSS_REWARD, STRINGS.bossReward);
    });
    this.boss = ctx.app.encounters.boss(ROC_ID, boss, ctx.scope); this.boss.arm();
    ctx.answer('death.checkpoint', (value) => boss.onPlayerDeath() || value === true);
    ctx.system({ id: 'far.boss', phase: 'update', run: (dt, t) => { boss.update(dt, t); } });
    // Phase 2's gale wall: a pale sheet of wind that thickens over the windup along the lane it will sweep.
    const wall = new Mesh(new BoxGeometry(GALE_WALL.shape.kind === 'lane' ? GALE_WALL.shape.width : 6, 5, 0.4),
      new MeshBasicMaterial({ color: 0xc8f1f8, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, fog: false }));
    wall.visible = false; ctx.root.add(wall); ctx.scope.own(wall.geometry); ctx.scope.own(wall.material); ctx.scope.onDispose(() => { wall.removeFromParent(); });
    ctx.system({ id: 'far.galeWall', phase: 'update', run: () => {
      const roc = this.roc, body = roc ? rocBrain(roc) : null;
      wall.visible = body?.current === GALE_WALL && roc?.alive === true;
      if (!wall.visible || roc === null || body === null) return;
      const k = Math.min(1, body.windup / GALE_WALL.windup), sweep = Math.max(0, body.windup - GALE_WALL.windup) / GALE_WALL.active, reach = 26 * Math.min(1, sweep);
      wall.position.set(roc.position.x + Math.sin(body.aim) * (2 + reach), position.y + 2.5, roc.position.z + Math.cos(body.aim) * (2 + reach));
      // a faint veil that thickens over the windup (loop 5: at 0.42 a wall you stand in filled the frame with white)
      wall.rotation.y = body.aim; wall.material.opacity = 0.06 + 0.16 * k;
    } });
    ctx.debug.expose('farReach', this);
  }
  /** A GUST from `from` along `dir` turns every vane it reaches (quest step 3, once the notes are read). */
  gustVanes(from: Vector3, dir: Vector3, toast: (text: string) => void = () => undefined): number {
    const built = this.built, flags = this.flags; if (built === null || flags === null || !flags.has(FLAGS.notes)) return 0;
    let turned = 0;
    for (const v of built.vanes) {
      if (flags.has(vaneFlag(v.id)) || !inCone(from, dir, v.at, VANE_REACH, GUST.halfAngle + 0.15)) continue;
      flags.set(vaneFlag(v.id)); turned++; toast(STRINGS.vaneTurned);
    }
    return turned;
  }
  /** Snap the crown bridge up (the winch's end state, also restored from a save). */
  private finishRaise(built: BuiltWorld): void { built.fallen.rotation.x = 0; built.state.raised = true; built.state.raising = false; built.winch.label = STRINGS.raised; }
  /** Turn the winch, ignoring the lock (captures and tests use this through `__wildshard.shard.farReach`). */
  raise(): void { if (this.built && !this.built.state.raised) this.built.state.raising = true; }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default SkyReachPlugin;
