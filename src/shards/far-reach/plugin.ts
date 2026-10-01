import { ShardPlugin, type ShardContext } from '#game';
import { BOAR, BOAR_LOOK, installSilentScore, installForestAmbience } from '#kit';
import { Vector3 } from 'three';
import type { QuestState, Animal, Flags } from '#engine';
import { STRINGS } from './strings';
import { buildSkyWorld, FALLEN, type SkyWorld } from './world/build';
import { SKY_MANTA, SKY_MANTA_LOOK, mantaBrain, type MantaBrain } from './species/manta';
import { WarFan, type GustTarget } from './weapons/WarFan';
import { FAN_ROW } from './weapons/rows';
import { installQuest, QUEST_FLAG } from './quest/install';
import { ownPrimitives } from './world/resources';
import { installSkyCues } from './audio/cues';
import { BOARS, CLOUD_Y, MANTA_HOME } from './layout';

declare module '#engine' {
  interface ActionMap { 'farReach.gust': true }
  interface EquipmentSlotMap { 'far-reach-fan': true }
}

const GUST_ICON = '<svg viewBox="0 0 24 24"><path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

/** Sky Reach (E364 B): islands, rope and hover bridges, the war fan, the drift ray, and the fallen-bridge quest. */
export class FarReachPlugin extends ShardPlugin {
  readonly player = new Vector3(); fan: WarFan | null = null; quest: QuestState | null = null; flags: Flags | null = null; sky: SkyWorld | null = null;
  manta: Animal | null = null; ray: MantaBrain | null = null; fell = 0;
  /** Where each walking creature last stood on an island: a walker that strays over the void is put back (only a GUST throws one off). */
  readonly safe = new Map<Animal, Vector3>();
  /** Bodies a GUST threw: they slide until the push dies, and fall off an edge into the clouds. */
  readonly blown = new Map<Animal, Vector3>();
  override world(ctx: ShardContext): void {
    ctx.strings(STRINGS);
    this.sky = buildSkyWorld(ctx, () => this.isHovering(ctx), () => undefined);
    ctx.game.runtime?.interactables.push(this.sky.winch);
  }
  /** The collider gate reads the immediate mode, including before the update event. */
  isHovering(ctx: ShardContext): boolean { return ctx.app.player?.mode === 'board'; }
  override kit(ctx: ShardContext): void {
    ctx.rows.weapon(FAN_ROW);
    ctx.rows.species([{ ...BOAR, variants: [...BOAR.variants, { id: 'cliff', label: STRINGS.boar, weight: 0, rarity: 'common', scale: [0.9, 0.9], hp: 50 }] }, SKY_MANTA]);
    ctx.rows.speciesLook([BOAR_LOOK, SKY_MANTA_LOOK]);
    ctx.rows.spawnTable({ id: 'farReach.boars', table: { mode: 'each', rows: [{ item: { kind: 'boar', variant: 'cliff' }, weight: 1 }] } });
    const rt = ctx.game.runtime;
    if (rt) rt.buildEquipment = (targets) => {
      if (rt.world === null) throw new Error('Sky Reach equipment needs the world stage');
      this.fan = new WarFan(ctx.app, targets, (target) => rt.play?.animals.animals.find((a) => a.position === target.position)?.combatActor() ?? null, () => this.gustTargets(ctx));
      this.fan.onSwing = (gust) => { if (gust) rt.play?.cues.charge(FAN_ROW, 'heavy'); else rt.play?.cues.fire(FAN_ROW); };
      rt.world.game.camera.add(this.fan.model);
      return Promise.resolve({ primary: this.fan, secondary: null, rifle: null, install: () => undefined });
    };
  }
  /** Everything alive a GUST can throw. */
  gustTargets(ctx: ShardContext): GustTarget[] {
    const out: GustTarget[] = [];
    for (const a of ctx.game.runtime?.play?.animals.animals ?? []) {
      if (!a.alive) continue;
      out.push({ position: a.position, actor: a.combatActor(), push: (dir, power) => {
        if (a === this.manta) { mantaBrain(a).push(dir, power); return; }
        this.blown.set(a, dir.clone().setY(0).multiplyScalar(power));
      } });
    }
    return out;
  }
  override play(ctx: ShardContext): void {
    const rt = ctx.game.runtime, position = rt?.world?.player.position ?? this.player, sky = this.sky;
    if (sky === null) throw new Error('Sky Reach play before world');
    // API gap 8 (E364): a viewmodel added to the camera (the template's way) draws only while the camera is in the scene
    const view = rt?.world?.game;
    if (view?.camera.parent === null) { view.scene.add(view.camera); ctx.scope.onDispose(() => { view.camera.removeFromParent(); }); }
    if (rt?.play) { installSilentScore(rt.play.music, ctx.scope); installForestAmbience(rt.play.audio, ctx.scope); installSkyCues(rt.play.audio, rt.play.cues, ctx.scope); }
    const quest = installQuest(ctx, position); this.quest = quest.quest; this.flags = quest.flags;
    if (quest.saved) { sky.fallen.raise = 1; sky.fallen.raised = true; sky.fallen.pivot.rotation.x = sky.fallen.deck.pitch; sky.winch.label = STRINGS.fallen; }
    if (rt) rt.hooks.questFlags = () => this.quest?.isComplete ? ['farReach.complete'] : [];
    ctx.inputContext({ id: 'farReach.fan', actions: ['attack', 'heavy', 'lock', 'farReach.gust'], keys: { attack: ['Mouse0', 'KeyF'], heavy: ['Mouse2'], 'farReach.gust': ['KeyG'] },
      touch: { mode: 'melee', lockable: true, relabel: { r0: { label: STRINGS.swing, tone: 'rest' } }, verbs: { 'verb.1': { action: 'farReach.gust', label: STRINGS.gust, icon: GUST_ICON } } } });
    // the fallen bridge swings up over FALLEN.seconds once the winch is turned
    ctx.system({ id: 'farReach.bridge', phase: 'update', run: (dt) => {
      const f = sky.fallen; if (f.raised || f.raise <= 0) return;
      f.raise = Math.min(1, f.raise + dt / FALLEN.seconds); const e = f.raise * f.raise * (3 - 2 * f.raise);
      f.pivot.rotation.x = FALLEN.hang + (f.deck.pitch - FALLEN.hang) * e;
      if (f.raise >= 1) { f.raised = true; sky.winch.label = STRINGS.fallen; this.flags?.set(QUEST_FLAG); }
    } });
    // the hover bridges glow bright while you ride, and dim to a ghost on foot
    ctx.system({ id: 'farReach.hoverGlow', phase: 'late', run: (dt, t) => {
      const on = this.isHovering(ctx), glass = sky.glass;
      glass.opacity += ((on ? 0.82 : 0.3 + 0.08 * Math.sin(t * 3)) - glass.opacity) * Math.min(1, dt * 6);
      glass.emissiveIntensity += ((on ? 1.5 : 0.35) - glass.emissiveIntensity) * Math.min(1, dt * 6);
      for (const bridge of sky.hover) for (const crystal of bridge.crystals) crystal.rotation.y += dt * 1.2;
      sky.sails.rotation.z += dt * 0.6;
    } });
    // GUST pushes, and anything that ends up over the void falls into the clouds
    ctx.system({ id: 'farReach.edges', phase: 'update', run: (dt) => {
      for (const [a, v] of this.blown) {
        a.position.x += v.x * dt; a.position.z += v.z * dt; v.multiplyScalar(Math.max(0, 1 - dt * 3.5));
        if (v.lengthSq() < 0.05) this.blown.delete(a);
      }
      const ground = ctx.manifest.ground.terrain;
      for (const a of rt?.play?.animals.animals ?? []) {
        if (!a.alive || a === this.manta || ground === undefined) continue;
        const safe = this.safe.get(a);
        if (ground.heightAt(a.position.x, a.position.z) > CLOUD_Y) { if (safe) safe.copy(a.position); else this.safe.set(a, a.position.clone()); continue; }
        if (!this.blown.has(a) && safe) { a.position.x = safe.x; a.position.z = safe.z; continue; }
        this.blown.delete(a); this.safe.delete(a); this.fell++;
        ctx.app.combat.hit({ source: 'env', sourceTags: ['farReach.fall'], target: a.combatActor(), amount: 1e4, point: a.position.clone(), dir: new Vector3(0, -1, 0), throughWalls: true });
      }
    } });
    if (rt?.play) {
      for (const bridge of sky.hover) { const pin = document.createElement('span'); pin.textContent = STRINGS.hoverHint; ctx.hud.pin(bridge.deck.a.clone().setY(bridge.deck.a.y + 2.4), pin); }
      const animals = rt.play.animals, manta = animals.spawn('skyManta', MANTA_HOME.x, MANTA_HOME.z, 0, 'drift');
      this.manta = manta; this.ray = mantaBrain(manta);
      ctx.scope.onDispose(() => { animals.retire(manta); });
    }
    const spawner = ctx.app.encounters.spawn('farReach.boars', ctx.scope, { create: (entry, at) => rt?.play?.animals.spawn(entry.kind, at.x, at.z, at.yaw, entry.variant) ?? null,
      retire: (actor) => { if (actor) rt?.play?.animals.retire(actor); } });
    for (const at of BOARS) spawner.spawn({ tags: [] }, { ...at, yaw: 0 }, () => ctx.app.rng.stream('spawn').next());
    ctx.bag.tab({ id: 'notes', title: STRINGS.notes, icon: 'book', order: 50 });
    ctx.bag.fragment('notes', { id: 'farReach.notes', render: (host) => { const p = document.createElement('p'); p.textContent = STRINGS.note; host.append(p); } });
    ctx.debug.expose('farReach', this);
    if (this.fan) ownPrimitives(this.fan.model, ctx.scope);
  }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default FarReachPlugin;
