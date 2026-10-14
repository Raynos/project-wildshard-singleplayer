import { bindPlayerImpulse } from '@wildshard/game/shardfile/dataCreaturePorts';
import { SKY_RUNTIME_ROWS } from '../data/runtimeRows';
import { SKY_WORLD_PREPARATION } from '../data/worldTextures';
import { ROC_STRIKES } from '../data/brains';
import type { ScopedLoot } from '@wildshard/game/loot/runtime';
import type { ShardContext } from '@wildshard/game/shard/context';
import { worldBuildYield } from '@wildshard/game/shard/plugin';
import source from '../shard.config';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { ROC_SLATE_EDITS } from '../data/paintLook';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import { BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial, Vector3, type Texture } from 'three';
import { STRINGS } from '../data/strings';
import { CROWN, DAIS, ROC, VANES } from '../data/layout';
import { buildWorld, type BuiltWorld } from '../world/build';
import { SKY_MOVER_BINDING, SKY_NATIVE_MOVER_OWNERS } from '../data/moverBindings';
import { installDeclaredMovers, type MoverRuntime } from '@wildshard/game/plugin/mover';
import { createMeleeScriptDriver, startMeleeSecondary } from '@wildshard/game/plugin/simulation';
import { effectField } from '@wildshard/sdk/looks/effectField';
import { UPDRAFT_AXIS, WIND_FIELDS, WIND_LOOKS } from '../data/windLook';
import { RISING_ISLETS } from '../data/islets.generated';
import type { RisingIslet } from '../data/isletDesign';
import { createFan, type WarFanWeapon, type ConeFanTarget } from './weapons/heldFan';
import { paintFanLeaf } from '../weapons/fanModel';
import { turnVanes } from '../quest/vanes';
import { FAN_ROW, FAN_PRESENTATION } from '../data/equipment';
import { preloadSkyMeshes } from '../world/meshes';
import { loadSkyBaked, skyMeadowBlades } from '../world/baked';
import { adoptIsleTile } from '../world/isle';
import { setSkyLooks, skyLook } from '../world/looks';
import { setMillTextures } from '../world/mill';
import { wakeRibbon } from './looks/wakeRibbon';
import { RAY_WAKE } from '../data/rayWakeLook';
import { meadow } from '../world/meadow';
import { bindDeclaredFight, bindPageQuestStages, bindClientChannels } from '@wildshard/game/plugin/ui';
import { ROC_ID } from '../data/rocFight';
import { installQuest } from '../quest/install';
import { FLAGS, vaneFlag } from '../quest/flags';
import { HybridRuntimePlugin, bindRuntimeMelee, type HybridRuntimeRows } from '@wildshard/game/plugin/headless';
import { bindRuntimeProductProps, prepareClientWorld, runtimeProduct } from '@wildshard/game/shardfile/runtimeProduct';

declare module '@wildshard/engine/input/InputService' {
  interface ActionMap { 'far.gust': true }
}
declare module '@wildshard/engine/level/spec' {
  interface TierKnobMap { 'far.meadowBlades': number }
}
declare module '@wildshard/engine/combat/Equipment' {
  interface EquipmentSlotMap { 'far-fan': true }
}

/** Every runtime collection is a finite authored roster; refuse overflow instead of silently dropping content. */
const MAX_RUNTIME_ROWS = 64;
function boundedRows<T>(rows: readonly T[]): readonly T[] {
  if (rows.length > MAX_RUNTIME_ROWS) throw new RangeError('Sky runtime roster exceeds its finite row bound');
  return rows;
}
const WINCH_FLAGS = [FLAGS.notes, FLAGS.roost, FLAGS.vanes, ...VANES.map(v => vaneFlag(v.id))];

const GALE_WALL = ROC_STRIKES[1];

export class SkyReachPlugin extends HybridRuntimePlugin {
  built: BuiltWorld | null = null; fan: WarFanWeapon | null = null;
  /** Is the player riding the hoverboard? The fan stows and the decks glow then; the hover decks and the updraft are
   *  `mode: 'board'` pieces, which collide only then (SF34, ENGINE §5 `app.player.mode`). */
  private board: () => boolean = () => false;
  flags: Flags | null = null;
  /** Sets the quest as a player has it at the crown (capture staging, `stage`). */
  private questFinished: (() => void) | null = null;
  private movers: MoverRuntime | null = null;
  /** SF8c: the Rising Islets' RIDE / CALL prompts (world/risingIslet.ts). */
  private isletCalls: ReturnType<typeof bindClientChannels> | null = null;
  /** The war fan's painted silk (loop 4), loaded behind the loading screen and owned by the level scope. */
  leaf: Texture | null = null;

  protected readonly rows: HybridRuntimeRows = { ...SKY_RUNTIME_ROWS, source };

  protected override async build(ctx: ShardContext): Promise<void> {
    // The generated models (C6) load behind the loading screen; the world and the creature looks read them synchronously.
    // and the world pieces baked offline (SF72, world/baked.ts)
    await Promise.all([preloadSkyMeshes(() => worldBuildYield(ctx, 4)), loadSkyBaked()]);
    const compiled = await prepareClientWorld(ctx, source, SKY_WORLD_PREPARATION);
    this.leaf = compiled.painted.get('leaf') ?? null; this.board = () => ctx.app.player?.mode === 'board';
    setMillTextures({ stone: compiled.painted.get('millStone') ?? null });
    // op-hitch41: in work slices (a grid cell builds Sky Reach on the road, in play: one 366 ms task on the Simulator,
    // then the meadow's 59 ms in the same frame); the meadow starts on a task of its own
    // the static islands from the shardfile's props tiles (runtime.binds props; generators/isleProps.ts), every tile resident
    const isles = new Map<string, Mesh>();
    await bindRuntimeProductProps(ctx.scope, source, { props: (tile) => { adoptIsleTile(tile, isles); } })
      .catch((e: unknown) => { console.error('[far-reach] the island tiles did not load; they stand undrawn:', e); });
    // the shard's look materials (look.materials, material graphs switched on for Sky, G387): the rope decks, the hover frames,
    // the shacks' kinds, the dressing's clumps and flowers, the falls (world/looks.ts)
    // and the looks over a model's own map (meshMap: the crown dais, the lantern, the keeper, the posts), each bound to it on its one compiled graph
    const looks = compiled.materials, deck = compiled.material('deck-wood'), frame = compiled.material('hover-frame');
    setSkyLooks(looks, compiled.bindMeshMap);
    this.built = await buildWorld(ctx, () => worldBuildYield(ctx, 4), isles, { deck, frame, channels: source.clientChannels ?? [] });
    await worldBuildYield(ctx, 4);
    const blades = ctx.manifest.tiers?.phone?.['far.meadowBlades'] ?? 0;
    ctx.tiers.knobs({ id: 'far', defaults: { 'far.meadowBlades': blades } });
    const field = meadow(skyMeadowBlades(), skyLook('meadow'), ctx.manifest.tiers?.[ctx.app.render?.tier ?? 'phone']?.['far.meadowBlades'] ?? blades);
    ctx.root.add(field.group); ctx.scope.onDispose(field.dispose);
    ctx.game.runtime?.interactables.push(this.built.winch, this.built.notes);
  }
  protected override prepare(ctx: ShardContext): void {
    // The shared combat-target query (ENGINE §19): world creatures in play, the Practice Arena's dummies while it is open.
    const targets = (): readonly ConeFanTarget[] => ctx.app.combat.targets().filter((t) => t.hittable);
    const row = source.items.rows.find(item => item.id === 'weapon.far-reach.fan');
    if (row?.kind !== 'weapon' || row.contacts === undefined) throw new Error('Sky fan needs admitted contact rows');
    this.fan = createFan(ctx.app, targets, row.contacts);
    if (this.leaf !== null) paintFanLeaf(this.fan.parts, this.leaf);
  }
  protected override arm(): WarFanWeapon { const fan = this.fan; if (fan === null) throw new Error('Sky Reach: the war fan was not built'); return fan; }
  protected override armed(): WarFanWeapon | null { return this.fan; }
  protected override enter(): void {
    if (this.fan !== null) this.fan.stowed = () => this.board();
    // G24: the wisp's burst and the Roc's gale wall shove the player (`app.player.impulse`).
  }
  protected override async install(ctx: ShardContext, loot: ScopedLoot | null): Promise<void> {
    const rt = ctx.game.runtime, built = this.built, fan = this.fan, position = rt?.world?.player.position ?? this.player;
    if (built === null || fan === null) throw new Error('Sky Reach: world and kit must run before play');
    const toast = (text: string): void => { rt?.play?.hud.toast(text); };
    const { quest, flags, burst, finished, persistence } = installQuest(ctx, position, loot?.purse ? (share) => { loot.purse?.add(share); } : undefined);
    persistence.bindProgress(rt?.play?.progress);
    this.quest = quest; this.flags = flags; this.questFinished = finished;
    await worldBuildYield(ctx, 4);

    // Step 1: the keeper's notes.
    built.notes.onInteract = () => { flags.set(FLAGS.notes); toast(STRINGS.notesToast); };
    // Step 4: the winch answers only once the roost is quiet and the vanes turn (the notes say so).
    const unlocked = (): boolean => flags.has(FLAGS.roost) && flags.has(FLAGS.vanes);
    built.winch.onInteract = () => { if (built.state.raised) return; if (unlocked()) this.movers?.command('far.winch.bridge', 1); else toast(STRINGS.winchLocked); };
    // the world pins, chip, map and minimap marks are the quest presentation's (quest/install.ts)
    if (rt?.world === null || rt?.world === undefined) throw new Error('Sky movers need their world host');
    const questStages = bindPageQuestStages(ctx, source, { flags, actor: this.actor.bind(this),
      observations: new Map([['winch-up', () => built.state.raised]]) });
    const channelRows = source.clientChannels?.filter(row => row.connectors === undefined);
    if (channelRows === undefined) throw new Error('Missing admitted Sky mover views');
    const channels = bindClientChannels(channelRows, { targets: new Map([['winch', built.fallen]]), nativeOwners: SKY_NATIVE_MOVER_OWNERS, observed: (_id, frame) => {
      const previouslyRaised = built.state.raised;
      if (frame.value === undefined || frame.turn === undefined) throw new Error('Missing winch channel observations');
      built.state.raised = frame.value !== 0; built.state.raising = frame.turn === 1;
      if (!previouslyRaised && built.state.raised) {
        built.winch.label = STRINGS.raised;
        if (!flags.has(FLAGS.raised)) { questStages.advance('far.quest.raised'); toast(STRINGS.raised); }
      }
    } });
    const product = runtimeProduct(source);
    const items = await createMeleeScriptDriver(source.items, 'actor.player', hash => product.assets.read(hash), source.identity.seed);
    this.movers = await installDeclaredMovers(ctx, rt.world, { data: source.movers, modules: new Map(), views: channels.movers,
      admitted: product.assets.retained, read: hash => product.assets.read(hash), systemId: SKY_MOVER_BINDING.systemId,
      composition: { modules: items.modules, roles: [items.role()], seed: items.seed },
      permissions: () => new Map([[SKY_MOVER_BINDING.winch, Number(flags.has(FLAGS.roost)) + Number(flags.has(FLAGS.vanes)) * 2]]),
      onDispose: () => { this.movers = null; } });
    await worldBuildYield(ctx, 4);
    const host = this.movers.scriptHost, hooks = items.hooks(host), fanRow = source.items.rows.find(item => item.id === 'weapon.far-reach.fan');
    if (fanRow?.kind !== 'weapon' || fanRow.secondary === undefined) throw new Error('Sky fan needs its admitted secondary');
    const secondary = fanRow.secondary, hook = hooks.get(fanRow.id);
    if (hook === undefined) throw new Error('Sky fan needs its admitted gust hook');
    const native = fan.row;
    bindRuntimeMelee(ctx, source, {presentation:FAN_PRESENTATION,icon:()=> 'sword',hooks,create:(row,spec,ports)=>{
      if(ports.contacts===undefined||ports.secondary===undefined||ports.hook===undefined)throw new Error('Fan requires admitted contacts and composed hook');
      fan.bindSecondary(family=>startMeleeSecondary(family,hook,{tick:host.currentTick,dt:1/60,action:secondary.code,move:secondary.move}),spec.charge);
      fan.row={...row,legacySlot:'far-fan',meta:native.meta};return fan;
    }});
    if (flags.has(FLAGS.raised)) this.movers.command('far.winch.bridge', 3);
    // SF8c socketLift: the Rising Islets answer the normal INTERACT through the platform's command (islet + road gate)
    channels.bindPrompts({ socketLifts: { entryways: source.entryways, runtime: () => this.movers } });
    rt.interactables.push(...channels.interactables); this.isletCalls = channels;
    // The updraft lifts (G24): riding the board up the wind column, a steady upward push (`app.player.impulse`, decaying
    // like an animal's, so a constant feed holds about updraft.lift / 3.5 m/s) floats you off the ramp to the high step.
    const updraft = source.modes?.traverse.find(row => row.id === 'far.updraft');
    if (updraft?.kind !== 'updraft') throw new Error('Sky Reach requires its admitted updraft row');
    ctx.system({ id: updraft.id, phase: 'fixed.pre', run: bindPlayerImpulse(velocity => { ctx.app.player?.impulse(velocity); }).column(updraft, () => position, this.board) });

    await worldBuildYield(ctx, 4);
    const moverPose = (id: string): ReturnType<MoverRuntime['pose']> => {
      const movers = this.movers; if (movers === null) throw new Error('Sky mover pose requested outside its installed lifetime');
      return movers.pose(id);
    };
    const vanes = boundedRows(built.vanes).map(vane => ({ vane, flag: vaneFlag(vane.id) }));
    const eye = new Vector3();
    // Dressing: the hover decks glow while you ride; the mill and the turned vanes spin; the updraft's rings rise.
    ctx.system({ id: 'far.dressing', phase: 'update', run: (dt, t) => {
      const riding = this.board();
      built.hoverDeck.emissiveIntensity = riding ? 0.9 + Math.sin(t * 4) * 0.15 : 0.25; built.hoverDeck.opacity = riding ? 0.75 : 0.16;
      // SF49-g (G183): the Rising Islets ride their movers (fixed ride driver, in the fixed step); draw them and their chains
      const movers = this.movers; if (movers !== null) { built.islets.updateMovers(moverPose); this.isletCalls?.updateMovers(moverPose); }
      built.millHub.rotation.z += dt * 0.35; built.storm.update(dt, t);
      for (let i = 0; i < MAX_RUNTIME_ROWS; i++) {
        const row = vanes[i]; if (row === undefined) break;
        row.vane.rotor.rotation.y += dt * (flags.has(row.flag) ? 6 : 0.25);
      }
    } });

    // The wind's seeded fields (data/windLook.ts), moved by their graphs: the updraft's spiral up the ramp, and GUST, a cone
    // of streaks and petals leaving the fan (style bible §7); a vane inside the cone starts turning (step 3).
    const wind = (key: keyof typeof WIND_FIELDS): ReturnType<typeof effectField> => {
      const look = skyLook(WIND_LOOKS[key]); if (look === undefined) throw new Error(`Sky Reach: look.materials lacks ${WIND_LOOKS[key]}`);
      const field = effectField(WIND_FIELDS[key], look); ctx.root.add(field.object); ctx.scope.own(field.geometry); ctx.scope.onDispose(() => { field.object.removeFromParent(); }); return field;
    };
    const axis = [new Vector3(...UPDRAFT_AXIS.at), new Vector3(...UPDRAFT_AXIS.aim)] as const, fxRandom = ctx.app.rng.stream('cosmetic'), gust = [wind('gustStreaks'), wind('gustPetals')] as const;
    wind('updraftStreaks').place(...axis); wind('updraftLeaves').place(...axis);
    fan.onGust = (from, dir) => {
      const at = from.clone().addScaledVector(dir, 0.2).setY(from.y - 0.25), salt = fxRandom.next(); gust[0].burst(at, dir, salt); gust[1].burst(at, dir, salt);
      rt.play?.cues.charge(FAN_ROW, 'heavy'); this.gustVanes(from, dir, toast);
    };
    ctx.system({ id: 'far.gust', phase: 'update', run: (dt) => { gust[0].update(dt); gust[1].update(dt); } });

    // Creatures: each one knows its home (an island or a flying circle). The goats walk their island's deck (G26): their
    // spawn ray lands them on the first WORLD floor under `fromY`, which finds the islands only once physics has stepped
    // (in `play` it hits nothing and the goat lands on the -1000 m analytic floor), so they land late, after the Roc.
    await worldBuildYield(ctx, 4);
    await this.populate(ctx, source, {}, () => worldBuildYield(ctx, 4));
    // each free ray trails its luminous wake (data/rayWakeLook.ts on @wildshard/sdk/looks/wakeRibbon; proposal B's ray beside the mill)
    const wakes = this.actors('rays').map((ray) => { const w = wakeRibbon(RAY_WAKE); ctx.root.add(w.mesh); ctx.scope.own(w.mesh.geometry); ctx.scope.onDispose(() => { w.mesh.removeFromParent(); }); return { ray, w }; });
    boundedRows(wakes);
    ctx.system({ id: 'far.rayWake', phase: 'late', run: (dt) => {
      const cam = rt.world?.game.camera; if (!cam) return;
      // each wake in the level's own frame (it stands at the root): inside a grid cell the root is at the cell's render offset
      for (let i = 0; i < MAX_RUNTIME_ROWS; i++) { const row = wakes[i]; if (row === undefined) break; row.w.update(row.ray.position, row.ray.alive, row.w.mesh.worldToLocal(cam.getWorldPosition(eye)), dt); }
    } });
    // the Roc's plumage to mockup D (E399 round 6, seat A: 'a slate / white split'; the generated texture's wings and back are
    // a warm brown): the browns turn slate grey, the white head and belly and the yellow beak and talons stay
    const painted = this.actor(ROC_ID);
    if (painted !== null) {
      const materials = boundedRows(Array.isArray(painted.mesh.material) ? painted.mesh.material : [painted.mesh.material]);
      for (let i = 0; i < MAX_RUNTIME_ROWS; i++) { const mat = materials[i]; if (mat === undefined) break;
      patchShader(mat, 'far.roc-slate', PATCH_ORDER.decorate, (shader) => {
        // (round 7, seat B: the wings measured unchanged: the model's self-light feeds the painted texture back as emissive,
        // so the emission is recoloured too; linear values, the brown test scaled for them)
        // (round 8, seats B and C: the mids still 117,64,51 against the mockup's slate 86,71,80: the paint's near-black darks kept
        // their luminance) a slate floor under the darks, the lighter feathers keeping their bands
        // (E410, 'no gold beak shows': in linear light the gold beak and toes (g/r ~0.47) passed the brown test and turned
        // slate) the gold keeps: blue under a tenth of red, bright; in the map only the beak and the toes are (15 k texels)
        editShader(shader, ROC_SLATE_EDITS);
      }, { key: (prior) => `${prior}|far.roc-slate`, scope: ctx.scope });
    }
    }
    await worldBuildYield(ctx, 4);
    // Step 2: the roost is clear when its three rays are down.

    // The boss: the Storm Roc on the crown, the shared BossBar, 25 coins once.
    const fight = bindDeclaredFight(ctx, this.rows.fight, { kind: 'held', player: position, held: this.actor(ROC_ID), catalogue: this.populationCatalogue,
      flags, facts: persistence.facts, reward: burst, armed: true, record: { saved: persistence.boss.read(), persist: persistence.boss.write } });
    this.populationControl = fight.control; this.presentedBoss = fight.boss;
    // Phase 2's gale wall: a pale sheet of wind that thickens over the windup along the lane it will sweep.
    const wall = new Mesh(new BoxGeometry(GALE_WALL.shape.kind === 'lane' ? GALE_WALL.shape.width : 6, 5, 0.4),
      new MeshBasicMaterial({ color: 0xc8f1f8, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, fog: false }));
    wall.visible = false; ctx.root.add(wall); ctx.scope.own(wall.geometry); ctx.scope.own(wall.material); ctx.scope.onDispose(() => { wall.removeFromParent(); });
    ctx.system({ id: 'far.galeWall', phase: 'update', run: () => {
      const roc = this.actor(ROC_ID), body = this.populationControl;
      wall.visible = body?.current?.id === GALE_WALL.id && roc?.alive === true;
      if (!wall.visible || roc === null || body === null) return;
      const k = Math.min(1, body.windup / GALE_WALL.windup), sweep = Math.max(0, body.windup - GALE_WALL.windup) / GALE_WALL.active, reach = 26 * Math.min(1, sweep);
      wall.position.set(roc.position.x + Math.sin(body.aim) * (2 + reach), position.y + 2.5, roc.position.z + Math.cos(body.aim) * (2 + reach));
      // a faint veil that thickens over the windup (loop 5: at 0.42 a wall you stand in filled the frame with white)
      wall.rotation.y = body.aim; wall.material.opacity = 0.06 + 0.16 * k;
    } });
  }
  /**
   * Fight state for a capture (E399, shard-progress `stage`, through `__wildshard.shard.farReach`): only what a player
   * reaches in play. 'roc-stalk': the Storm Roc, first phase, at a point ON its 13 m circle over the dais (the far side,
   * 3 m west), turning in on a stalk toward a player at the arena's entrance (mockup D): its circle's height, a spot every
   * lap passes and every stalk from there starts at. 'quest-crown':
   * the quest as a player has it in the arena (finished, the bridge raised, its reward paid; council round 1's should-fix),
   * staged on the shot before so its toasts are long gone.
   */
  stage(name: string): void {
    const body = this.populationControl;
    if (name === 'quest-crown') { this.questFinished?.(); if (this.built !== null) this.finishRaise(this.built); }
    // 'quest-winch' (round 8, X4: the route as ordinary play): the quest as a player has it when the winch unlocks, the notes
    // read, the roost quiet and the three vanes turning; the bridge is still down, the winch raises it in play
    if (name === 'quest-winch' && this.flags !== null) {
      const flags = boundedRows(WINCH_FLAGS);
      for (let i = 0; i < MAX_RUNTIME_ROWS; i++) { const flag = flags[i]; if (flag === undefined) break; this.flags.set(flag); }
    }
    // and a strike in the storm behind it (its lightning comes every 3.5-8 s; mockup D shows a bolt), just before the frame
    // 'roc-lap' (round 7, the lead's ruling for mock-D): the Roc's rest lap round the dais, set so that after D's 1.5 s
    // settle (steady circling, a steady bank) it is on the lap's north-east quarter, turning in toward the arena view and banking along it (tried at
    // -1.2 / -1.45 / -1.7 / -1.85 / -2.07: east of this it leaves the frame, west of it it crosses side-on)
    // ('roc-lap@<radians>' places it at another point of the same lap)
    if (name.startsWith('roc-lap')) { this.built?.storm.strike(0.5); if (body !== null) body.stageLap(Number(name.split('@')[1] ?? -2.64)); }
    if (name === 'roc-opening') { this.built?.storm.strike(1.0); if (body !== null) body.stageOpening(); }
    if (name === 'roc-stalk') this.built?.storm.strike(0.15);
    if (name === 'roc-stalk' && body !== null) body.stageStalk({ x: DAIS.x - 3, z: DAIS.z - Math.sqrt(ROC.r * ROC.r - 9) }, { x: CROWN.x, z: CROWN.z + CROWN.r });
  }
  /** A GUST from `from` along `dir` turns every vane it reaches (quest step 3, once the notes are read). */
  gustVanes(from: Vector3, dir: Vector3, toast: (text: string) => void = () => undefined): number {
    const built = this.built, flags = this.flags; if (built === null || flags === null) return 0;
    return turnVanes(flags, boundedRows(built.vanes), from, dir, () => { toast(STRINGS.vaneTurned); });
  }
  /** Snap the crown bridge up (the winch's end state, also restored from a save). */
  private finishRaise(_built: BuiltWorld): void { this.movers?.command('far.winch.bridge', 3); }
  /** SF49-g: the four Rising Islet entries' data (walks and captures read their routes here). */
  get islets(): readonly Omit<RisingIslet, 'at'>[] { return RISING_ISLETS; }
  /** SF49-g: an entry's islet deck centre now (captures, walks and tests read it through `__wildshard.shard.farReach`). */
  isletAt(edge: string): { x: number; y: number; z: number } | null {
    const movers = this.movers; if (movers === null) return null;
    return movers.data.some((m) => m.id === `far.islet.${edge}`) ? movers.pose(`far.islet.${edge}`).position : null;
  }
  /** SF8c: does an entry's road gate close the socket right now (the islet is away from the road)? */
  isletGateShut(edge: string): boolean | null {
    const movers = this.movers; if (movers === null) return null;
    return movers.data.some((m) => m.id === `far.islet.${edge}.gate`) ? movers.pose(`far.islet.${edge}.gate`).enabled : null;
  }
  /** SF8c: press an entry's RIDE (1) / road CALL (2) / gate-isle CALL (3) prompt, exactly as INTERACT does (walks and
   *  captures use this through `__wildshard.shard.farReach`). */
  interactIslet(edge: string, action: 1 | 2 | 3): void {
    const index = RISING_ISLETS.findIndex((entry) => entry.edge === edge);
    this.isletCalls?.interactables[index * 3 + action - 1]?.onInteract();
  }
  /** Turn the winch, ignoring the lock (captures and tests use this through `__wildshard.shard.farReach`). */
  raise(): void { if (this.built && !this.built.state.raised) this.movers?.command('far.winch.bridge', 2); }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default SkyReachPlugin;
