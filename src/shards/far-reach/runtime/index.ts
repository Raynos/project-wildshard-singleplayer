import { declaredSkyRows } from './brains';
import type { ScopedLoot } from '@wildshard/game/loot/runtime';
import type { ShardContext } from '@wildshard/game/shard/context';
import { worldBuildYield } from '@wildshard/game/shard/plugin';
import source from '../shard.config';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { ROC_SLATE_EDITS } from '../data/paintLook';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import { BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial, MirroredRepeatWrapping, Vector3, type Texture } from 'three';
import { STRINGS } from '../data/strings';
import { GUST_ICON, SWING_ICON } from '../data/icons';
import { CROWN, DAIS, ISLES, ROC, VANES } from '../data/layout';
import { SKY_FLOCK_GROUPS, SKY_FLOCK_ROWS } from '../data/spawns';
import { buildWorld, type BuiltWorld } from '../world/build';
import { skyMoverViews } from './movers';
import { UpdraftDriver, installDeclaredMovers, type MoverRuntime } from '@wildshard/game/plugin/mover';
import { commandSocketLift } from '@wildshard/game/plugin/simulation';
import { isletCalls, type IsletCalls } from '../world/risingIslet';
import { gustFx } from './looks/windFx';
import { GUST_FX } from '../data/windLook';
import { RISING_ISLETS } from '../world/islets';
import type { RisingIslet } from '../data/isletDesign';
import { WarFan, type WarFanWeapon } from '../weapons/WarFan';
import { loadSkyFan } from '../weapons/fanShapes';
import type { ConeFanTarget } from './weapons/coneStrikes';
import { paintFanLeaf } from '../weapons/fanModel';
import { turnVanes } from '../quest/vanes';
import { FAN_ROW } from '../weapons/rows';
import { DRIFT_RAY_LOOK } from '../species/driftRay';
import { SKY_GOAT_LOOK } from '../species/skyGoat';
import { GALE_WISP_LOOK } from '../species/galeWisp';
import { STORM_ROC_LOOK, rocBrain } from '../species/stormRoc';
import { GALE_WALL } from './stormRocBrain';
import { bindPlayerPush, setHome } from '../species/rig';
import { preloadSkyMeshes } from '../world/meshes';
import { loadSkyBaked } from '../world/baked';
import { loadSkyBridges } from '../world/shapes';
import { adoptIsleTile, setIsleTextures } from '../world/isle';
import { setSkyLooks } from '../world/looks';
import { loadSkyMillModel, setMillTextures } from '../world/mill';
import { FAN_LEAF_URL, TEX_URL } from '../data/files';
import { loadPainted } from '../look/image';
import { setStormPaint } from '../world/storm';
import { wakeRibbon } from './looks/wakeRibbon';
import { RAY_WAKE } from '../data/rayWakeLook';
import { meadow, type Meadow } from '../world/meadow';
import { heroStoneDiscs } from '../world/dressing';
import { SUN_DIR } from '../look/sun';
import { StormRocBoss } from '../combat/stormRoc';
import { installBossView } from '@wildshard/game/plugin/ui';
import { BOSS_REWARD, ROC_ID } from '../data/rocFight';
import { installQuest } from '../quest/install';
import { FLAGS, vaneFlag } from '../quest/flags';
import { installSkyCues } from './audio/cues';
import { installEnteredRuntimeService } from '@wildshard/game/shard/retainedHooks';
import { HybridRuntimePlugin, bindRuntimeHomes, type HybridRuntimeRows, type RuntimeHomes } from '@wildshard/game/plugin/headless';
import { bindRuntimeProductProps, runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';
import { bindSkyItems } from './items';

declare module '@wildshard/engine/input/InputService' {
  interface ActionMap { 'far.gust': true }
}
declare module '@wildshard/engine/level/spec' {
  interface TierKnobMap { 'far.meadowBlades': number }
}
declare module '@wildshard/engine/combat/Equipment' {
  interface EquipmentSlotMap { 'far-fan': true }
}

/** How far above its island's deck a goat's spawn ray starts (metres): above the grass, below anything overhead. */
export const GOAT_SPAWN_ABOVE = 2;
const SKY_HOMES = new Map(SKY_FLOCK_ROWS.map(row => [row.id, row.home]));
const GOAT_FLOORS = new Map(SKY_FLOCK_GROUPS.goats.map(row => [row.id, { fromY: row.home.y + GOAT_SPAWN_ABOVE, y: row.home.y }]));

/** Every runtime collection is a finite authored roster; refuse overflow instead of silently dropping content. */
const MAX_RUNTIME_ROWS = 64;
function boundedRows<T>(rows: readonly T[]): readonly T[] {
  if (rows.length > MAX_RUNTIME_ROWS) throw new RangeError('Sky runtime roster exceeds its finite row bound');
  return rows;
}
const WINCH_FLAGS = [FLAGS.notes, FLAGS.roost, FLAGS.vanes, ...VANES.map(v => vaneFlag(v.id))];

export class SkyReachPlugin extends HybridRuntimePlugin {
  built: BuiltWorld | null = null; fan: WarFanWeapon | null = null; boss: StormRocBoss | null = null;
  /** The 13 declared bodies (data/spawns.ts), held by the platform's home keeper in their shipping allocation order. */
  private kept: RuntimeHomes | null = null;
  private bodies(rows: readonly { readonly id: string }[]): Animal[] { return rows.flatMap(row => this.kept?.held(row.id) ?? []); }
  get roc(): Animal | null { return this.kept?.held(ROC_ID) ?? null; }
  /** Is the player riding the hoverboard? The fan stows and the decks glow then; the hover decks and the updraft are
   *  `mode: 'board'` pieces, which collide only then (SF34, ENGINE §5 `app.player.mode`). */
  private board: () => boolean = () => false;
  flags: Flags | null = null;
  /** Sets the quest as a player has it at the crown (capture staging, `stage`). */
  private questFinished: (() => void) | null = null;
  private movers: MoverRuntime | null = null;
  /** SF8c: the Rising Islets' RIDE / CALL prompts (world/risingIslet.ts). */
  private isletCalls: IsletCalls | null = null;
  /** The war fan's painted silk (loop 4), loaded behind the loading screen and owned by the level scope. */
  leaf: Texture | null = null;
  /** The near meadow that travels with the camera (loop 4). */
  meadow: Meadow | null = null;

  protected readonly rows: HybridRuntimeRows = { expose: 'farReach', strings: STRINGS, weapon: FAN_ROW, encounters: { id: ROC_ID, displayName: STRINGS.roc }, complete: FLAGS.complete,
    audio: source.audio, cues: installSkyCues, species: () => {
      const policies = declaredSkyRows();
      return { rows: policies.rows, looks: [DRIFT_RAY_LOOK, SKY_GOAT_LOOK, GALE_WISP_LOOK, STORM_ROC_LOOK], witness: policies.witness };
    } };

  protected override async build(ctx: ShardContext): Promise<void> {
    // The generated models (C6) load behind the loading screen; the world and the creature looks read them synchronously.
    // and the world pieces baked offline (SF72, world/baked.ts)
    await Promise.all([preloadSkyMeshes(), loadSkyBaked(), loadSkyBridges(), loadSkyFan(), loadSkyMillModel()]);
    // the fan's painted silk; without it (offline, a test page) the fan keeps its plain teal, as the models keep their code stand-ins
    const leaf = await loadPainted(FAN_LEAF_URL, 'far.fan-leaf');
    if (leaf !== null) { this.leaf = leaf; ctx.scope.own(leaf); }
    this.board = () => ctx.app.player?.mode === 'board';
    // the islands' painted rock and meadow (E392): sampled in world space by world/isle.ts
    // and the windmill's stone, canvas and ivy (world/mill.ts)
    const [rock, meadowTex, millStone, millCanvas, millIvy, vortex] = await Promise.all([loadPainted(TEX_URL.rock, 'far.rock', true), loadPainted(TEX_URL.meadow, 'far.meadow', true),
      loadPainted(TEX_URL.millStone, 'far.mill-stone', true), loadPainted(TEX_URL.millCanvas, 'far.mill-canvas'), loadPainted(TEX_URL.millIvy, 'far.mill-ivy'),
      loadPainted(TEX_URL.stormeye, 'far.stormeye')]);
    const textures = [rock, meadowTex, millStone, millCanvas, millIvy, vortex];
    for (let i = 0; i < 6; i++) { const texture = textures[i]; if (texture !== null && texture !== undefined) ctx.scope.own(texture); }
    // the storm's painted underside (E399, mockup D's vortex seen from below), mirrored past its edge
    if (vortex !== null) { vortex.wrapS = MirroredRepeatWrapping; vortex.wrapT = MirroredRepeatWrapping; vortex.needsUpdate = true; }
    setStormPaint(vortex);
    setMillTextures({ stone: millStone, canvas: millCanvas, ivy: millIvy });
    setIsleTextures({ rock, meadow: meadowTex });
    // op-hitch41: in work slices (a grid cell builds Sky Reach on the road, in play: one 366 ms task on the Simulator,
    // then the meadow's 59 ms in the same frame); the meadow starts on a task of its own
    // the static islands from the shardfile's props tiles (runtime.binds props; generators/isleProps.ts), every tile resident
    const isles = new Map<string, Mesh>();
    await bindRuntimeProductProps(ctx.scope, source, { props: (tile) => { adoptIsleTile(tile, isles); } })
      .catch((e: unknown) => { console.error('[far-reach] the island tiles did not load; they stand undrawn:', e); });
    // the shard's look materials (look.materials, material graphs switched on for Sky, G387): the rope decks, the hover frames,
    // the shacks' kinds, the dressing's clumps and flowers, the falls (world/looks.ts)
    const looks = (await runtimeLookMaterials(ctx, source, true)).materials, deck = looks.get('deck-wood'), frame = looks.get('hover-frame');
    if (deck === undefined || frame === undefined) throw new Error('Sky Reach: look.materials lacks deck-wood or hover-frame');
    setSkyLooks(looks);
    this.built = await buildWorld(ctx, () => worldBuildYield(ctx), isles, { deck, frame });
    await worldBuildYield(ctx);
    const blades = ctx.manifest.tiers?.phone?.['far.meadowBlades'] ?? 0;
    ctx.tiers.knobs({ id: 'far', defaults: { 'far.meadowBlades': blades } });
    const field = meadow(SUN_DIR, ctx.manifest.tiers?.[ctx.app.render?.tier ?? 'phone']?.['far.meadowBlades'] ?? blades, ISLES, heroStoneDiscs());
    this.meadow = field; ctx.root.add(field.mesh); ctx.scope.own(field.mesh.geometry); ctx.scope.own(field.mesh.material); ctx.scope.own(field.atlas);
    ctx.scope.onDispose(() => { field.mesh.removeFromParent(); });
    const runtime = ctx.game.runtime;
    // SF49-g (G183 / G194): the four Rising Islet entries are the only way in, from the cell's edges: the whole cell is in bounds
    if (runtime !== undefined) runtime.hooks.levelBounds = () => ({ x0: -250, x1: 250, z0: -250, z1: 250, floor: -8 });
    runtime?.interactables.push(this.built.winch, this.built.notes);
  }
  protected override witnessed(): Animal[] { return this.bodies([...SKY_FLOCK_GROUPS.rays, ...SKY_FLOCK_GROUPS.roost, ...SKY_FLOCK_GROUPS.goats, ...SKY_FLOCK_GROUPS.wisps]); }
  protected override prepare(ctx: ShardContext): void {
    // The shared combat-target query (ENGINE §19): world creatures in play, the Practice Arena's dummies while it is open.
    const targets = (): readonly ConeFanTarget[] => ctx.app.combat.targets().filter((t) => t.hittable);
    this.fan = new WarFan(ctx.app, targets);
    if (this.leaf !== null) paintFanLeaf(this.fan.parts, this.leaf);
  }
  protected override arm(): WarFanWeapon { const fan = this.fan; if (fan === null) throw new Error('Sky Reach: the war fan was not built'); return fan; }
  protected override armed(): WarFanWeapon | null { return this.fan; }
  protected override enter(ctx: ShardContext): void {
    if (this.fan !== null) this.fan.stowed = () => this.board();
    // G24: the wisp's burst and the Roc's gale wall shove the player (`app.player.impulse`).
    const push = (v: Vector3): void => { ctx.app.player?.impulse(v); };
    installEnteredRuntimeService(ctx, scope => { bindPlayerPush(push); scope.onDispose(() => { bindPlayerPush(null); }); });
  }
  protected override async install(ctx: ShardContext, loot: ScopedLoot | null): Promise<void> {
    const rt = ctx.game.runtime, built = this.built, fan = this.fan, position = rt?.world?.player.position ?? this.player;
    if (built === null || fan === null) throw new Error('Sky Reach: world and kit must run before play');
    const toast = (text: string): void => { rt?.play?.hud.toast(text); };
    const { quest, flags, burst, finished, persistence } = installQuest(ctx, position, loot?.purse ? (share) => { loot.purse?.add(share); } : undefined);
    persistence.bindProgress(rt?.play?.progress);
    this.quest = quest; this.flags = flags; this.questFinished = finished;

    const showGust = (): boolean => ctx.app.state === 'play' && !this.board();
    const fanInput: Parameters<ShardContext['inputContext']>[0] = { id: 'far.fan', actions: ['attack', 'heavy', 'lock', 'far.gust'], keysFrom: 'weapon.melee', keys: { 'far.gust': ['KeyG'] },
      touch: { mode: 'melee', lockable: true, relabel: { r0: { label: STRINGS.swing, icon: SWING_ICON } },
        verbs: { 'verb.1': { action: 'far.gust', label: STRINGS.gust, icon: GUST_ICON, show: showGust } } } };
    // the gust in the key-bindings table, under Combat (E418: G worked but was listed nowhere), while the shard is loaded
    const gustRow: Parameters<ShardContext['app']['input']['bindings']['describe']>[0] = { rows: [{ group: 'combat', id: 'far.gust', label: STRINGS.gustBinding, actions: ['far.gust'] }] };
    this.input(ctx, fanInput, gustRow);

    // Step 1: the keeper's notes.
    bindSkyItems(ctx, fan);
    built.notes.onInteract = () => { flags.set(FLAGS.notes); toast(STRINGS.notesToast); };
    // Step 4: the winch answers only once the roost is quiet and the vanes turn (the notes say so).
    const unlocked = (): boolean => flags.has(FLAGS.roost) && flags.has(FLAGS.vanes);
    built.winch.onInteract = () => { if (built.state.raised) return; if (unlocked()) this.movers?.command('far.winch.bridge', 1); else toast(STRINGS.winchLocked); };
    // the world pins, chip, map and minimap marks are the quest presentation's (quest/install.ts)
    if (rt?.world === null || rt?.world === undefined) throw new Error('Sky movers need their world host');
    this.movers = await installDeclaredMovers(ctx, rt.world, skyMoverViews(built, () => Number(flags.has(FLAGS.roost)) + Number(flags.has(FLAGS.vanes)) * 2, () => {
      built.winch.label = STRINGS.raised;
      if (!flags.has(FLAGS.raised)) { flags.set(FLAGS.raised); toast(STRINGS.raised); }
    }, () => { this.movers = null; }));
    if (flags.has(FLAGS.raised)) this.movers.command('far.winch.bridge', 3);
    // SF8c socketLift: the Rising Islets answer the normal INTERACT through the platform's command (islet + road gate)
    const lifts = new Map(source.entryways.flatMap((row) => (row.kind === 'socketLift' && row.lift !== undefined ? [[row.edge, row.lift] as const] : [])));
    const calls = isletCalls((entry, action) => { const movers = this.movers, lift = lifts.get(entry.edge); if (movers !== null && lift !== undefined) commandSocketLift(movers, lift, action); });
    rt.interactables.push(...calls.interactables); this.isletCalls = calls;
    // The updraft lifts (G24): riding the board up the wind column, a steady upward push (`app.player.impulse`, decaying
    // like an animal's, so a constant feed holds about updraft.lift / 3.5 m/s) floats you off the ramp to the high step.
    const updraft = source.modes?.traverse.find(row => row.id === 'far.updraft');
    if (updraft?.kind !== 'updraft') throw new Error('Sky Reach requires its admitted updraft row');
    const force = new UpdraftDriver(updraft), lift = new Vector3();
    ctx.system({ id: 'far.updraft', phase: 'fixed.pre', run: (dt) => {
      force.step(dt, position, this.board(), lift.set(0, 0, 0));
      if (lift.y !== 0) ctx.app.player?.impulse(lift);
    } });

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
      // the eye in the level's own frame (G321; the meadow stands at its root): inside a grid cell the root is at the cell's
      // render offset and the page camera in the page's frame; standalone the root is the origin and this is the camera's own
      const cam = rt.world?.game.camera; if (cam && this.meadow) this.meadow.update(this.meadow.mesh.worldToLocal(cam.getWorldPosition(eye)), t);
      // SF49-g (G183): the Rising Islets ride their movers (fixed ride driver, in the fixed step); draw them and their chains
      const movers = this.movers; if (movers !== null) { built.islets.update(moverPose); this.isletCalls?.update(moverPose); }
      built.millHub.rotation.z += dt * 0.35; built.storm.update(dt, t); built.wind.update(t);
      for (let i = 0; i < MAX_RUNTIME_ROWS; i++) {
        const row = vanes[i]; if (row === undefined) break;
        row.vane.rotor.rotation.y += dt * (flags.has(row.flag) ? 6 : 0.25);
      }
    } });

    // GUST: a cone of wind streaks and petals leaves the fan (style bible §7); a vane inside the cone starts turning (step 3).
    const fxRandom = ctx.app.rng.stream('cosmetic'), gustView = gustFx(GUST_FX, () => fxRandom.next());
    const gustObjects = boundedRows(gustView.objects);
    for (let i = 0; i < MAX_RUNTIME_ROWS; i++) { const object = gustObjects[i]; if (object === undefined) break; ctx.root.add(object); }
    ctx.scope.onDispose(() => { gustView.dispose(); });
    fan.onGust = (from, dir) => {
      gustView.fire(from.clone().addScaledVector(dir, 0.2).setY(from.y - 0.25), dir); rt.play?.cues.charge(FAN_ROW, 'heavy');
      this.gustVanes(from, dir, toast);
    };
    ctx.system({ id: 'far.gust', phase: 'update', run: (dt) => { gustView.update(dt); } });

    // Creatures: each one knows its home (an island or a flying circle). The goats walk their island's deck (G26): their
    // spawn ray lands them on the first WORLD floor under `fromY`, which finds the islands only once physics has stepped
    // (in `play` it hits nothing and the goat lands on the -1000 m analytic floor), so they land late, after the Roc.
    this.kept = bindRuntimeHomes(ctx, source, { system: 'far.creatures', held: { order: SKY_FLOCK_ROWS.map(row => row.id), settle: 'far.goats',
      dress: (animal, id) => { const home = SKY_HOMES.get(id); if (home !== undefined) setHome(animal, home); },
      late: id => GOAT_FLOORS.get(id) } });
    // each free ray trails its luminous wake (data/rayWakeLook.ts on @wildshard/sdk/looks/wakeRibbon; proposal B's ray beside the mill)
    const wakes = this.bodies(SKY_FLOCK_GROUPS.rays).map((ray) => { const w = wakeRibbon(RAY_WAKE); ctx.root.add(w.mesh); ctx.scope.own(w.mesh.geometry); ctx.scope.own(w.mesh.material); ctx.scope.onDispose(() => { w.mesh.removeFromParent(); }); return { ray, w }; });
    boundedRows(wakes);
    ctx.system({ id: 'far.rayWake', phase: 'late', run: (dt) => {
      const cam = rt.world?.game.camera; if (!cam) return;
      // each wake in the level's own frame (it stands at the root), as the meadow's eye
      for (let i = 0; i < MAX_RUNTIME_ROWS; i++) { const row = wakes[i]; if (row === undefined) break; row.w.update(row.ray.position, row.ray.alive, row.w.mesh.worldToLocal(cam.getWorldPosition(eye)), dt); }
    } });
    // the Roc's plumage to mockup D (E399 round 6, seat A: 'a slate / white split'; the generated texture's wings and back are
    // a warm brown): the browns turn slate grey, the white head and belly and the yellow beak and talons stay
    if (this.roc !== null) {
      const materials = boundedRows(Array.isArray(this.roc.mesh.material) ? this.roc.mesh.material : [this.roc.mesh.material]);
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
    // Step 2: the roost is clear when its three rays are down.
    const isDead = (animal: Animal): boolean => !animal.alive, roost = this.bodies(SKY_FLOCK_GROUPS.roost);
    ctx.system({ id: 'far.roost', phase: 'update', run: () => {
      if (flags.has(FLAGS.notes) && !flags.has(FLAGS.roost) && roost.length > 0 && roost.every(isDead)) flags.set(FLAGS.roost);
    } });

    // The boss: the Storm Roc on the crown, the shared BossBar, 25 coins once.
    const boss = new StormRocBoss(ctx, position, this.roc, () => {
      if (flags.has(FLAGS.roc)) { toast(STRINGS.rocDown); return; }
      flags.set(FLAGS.roc); persistence.facts('far-reach.roc', ROC_ID); burst(BOSS_REWARD, STRINGS.bossReward);
    }, persistence.boss);
    this.boss = installBossView(ctx, ROC_ID, boss, true).boss;
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
    const roc = this.roc, body = roc ? rocBrain(roc) : null;
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
  get islets(): readonly RisingIslet[] { return RISING_ISLETS; }
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
