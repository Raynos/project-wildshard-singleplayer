import { declaredSkyRows } from './brains';
import { installRuntimeLoot } from '@wildshard/game/loot/runtime';
import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import { installSilentScore } from '@wildshard/sdk/runtime/audio/silentScore';
import source from '../shard.config';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { QuestState } from '@wildshard/engine/quest/core';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import { BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial, MirroredRepeatWrapping, Vector3, type Texture } from 'three';
import { STRINGS } from '../data/strings';
import { CROWN, DAIS, GOATS, ISLES, RAY_HOMES, ROC, ROOST_RAYS, VANES, WISP_HOMES } from '../data/layout';
import { apothem } from '../layout';
import { buildWorld, type BuiltWorld } from '../world/build';
import { skyMoverViews } from './movers';
import { installDeclaredMovers, type MoverRuntime } from '@wildshard/game/shardfile/moverRuntime';
import { commandSocketLift } from '@wildshard/game/shardfile/socketLiftProof';
import { isletCalls, type IsletCalls } from '../world/risingIslet';
import { gustFx } from '../world/windFx';
import { RISING_ISLETS, type RisingIslet } from '../world/islets';
import { FALL_TIME } from '../world/distant';
import { WarFan } from '../weapons/WarFan';
import type { FanTarget } from '../weapons/fanStrikes';
import { turnVanes } from '../quest/vanes';
import { FAN_ROW } from '../weapons/rows';
import { DRIFT_RAY, DRIFT_RAY_LOOK } from '../species/driftRay';
import { SKY_GOAT, SKY_GOAT_LOOK } from '../species/skyGoat';
import { GALE_WISP, GALE_WISP_LOOK } from '../species/galeWisp';
import { STORM_ROC, STORM_ROC_LOOK, rocBrain } from '../species/stormRoc';
import { GALE_WALL } from './stormRocBrain';
import { bindPlayerPush, setHome } from '../species/rig';
import { preloadSkyMeshes } from '../world/meshes';
import { loadSkyBaked } from '../world/baked';
import { setIsleTextures } from '../world/isle';
import { setFirSheet } from '../world/fir';
import { setMillTextures } from '../world/mill';
import { FAN_LEAF_URL, TEX_URL } from '../boot/files';
import { loadPainted } from '../look/image';
import { setStormPaint } from '../world/storm';
import { rayWake } from '../world/rayWake';
import { meadow, type Meadow } from '../world/meadow';
import { heroStoneDiscs } from '../world/dressing';
import { SUN_DIR } from '../look/sun';
import { StormRocBoss } from '../combat/stormRoc';
import { BOSS_REWARD, ROC_ID } from './rocEncounter';
import { installQuest } from '../quest/install';
import { FLAGS, vaneFlag } from '../quest/flags';
import { installSkyCues } from './audio/cues';
import { installEnteredRuntimeInput, installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { bindRuntimeBoss } from '@wildshard/game/shardfile/hybridRows';
import { bindSkyActor } from './spawns';
import { bindSkyItems } from './items';
import { spawnSkyGoats } from '../species/goats';
import { UPDRAFT_LIFT, inUpdraft } from './updraft';

declare module '@wildshard/engine/input/InputService' {
  interface ActionMap { 'far.gust': true }
}
declare module '@wildshard/engine/level/spec' {
  interface TierKnobMap { 'far.meadowBlades': number }
}
declare module '@wildshard/engine/combat/Equipment' {
  interface EquipmentSlotMap { 'far-fan': true }
}

/** The touch icons (council R1B-11: every primary and verb carries one): an open fan for SWING (the attack disc's own
 * 24 × 24 svg), wind curls for GUST (a whole svg before the verb's label). */
const SWING_ICON = '<path d="M12 19.5 4.2 9.8a10 10 0 0 1 15.6 0Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
  + '<path d="M12 19.5 8.6 7.6M12 19.5V6.8M12 19.5l3.4-11.9" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>';
const GUST_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5h10.5a3 3 0 1 0-3-3M3 12.5h14.5a3 3 0 1 1-3 3M3 16.5h7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
/** How far above its island's deck a goat's spawn ray starts (metres): above the grass, below anything overhead. */
export const GOAT_SPAWN_ABOVE = 2;
/** How fast the winch lifts the fallen bridge (radians per second). */
export const RAISE_RATE = 0.55;

/** Every runtime collection is a finite authored roster; refuse overflow instead of silently dropping content. */
const MAX_RUNTIME_ROWS = 64;
function boundedRows<T>(rows: readonly T[]): readonly T[] {
  if (rows.length > MAX_RUNTIME_ROWS) throw new RangeError('Sky runtime roster exceeds its finite row bound');
  return rows;
}
const WINCH_FLAGS = [FLAGS.notes, FLAGS.roost, FLAGS.vanes, ...VANES.map(v => vaneFlag(v.id))];

export class SkyReachPlugin extends ShardPlugin {
  readonly player = new Vector3();
  built: BuiltWorld | null = null; fan: WarFan | null = null; quest: QuestState | null = null; boss: StormRocBoss | null = null;
  rays: Animal[] = []; roostRays: Animal[] = []; goats: Animal[] = []; wisps: Animal[] = []; roc: Animal | null = null;
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

  override async world(ctx: ShardContext): Promise<void> {
    ctx.strings(STRINGS);
    // The generated models (C6) load behind the loading screen; the world and the creature looks read them synchronously.
    // and the world pieces baked offline (SF72, world/baked.ts)
    await Promise.all([preloadSkyMeshes(), loadSkyBaked()]);
    // the fan's painted silk; without it (offline, a test page) the fan keeps its plain teal, as the models keep their code stand-ins
    const leaf = await loadPainted(FAN_LEAF_URL, 'far.fan-leaf');
    if (leaf !== null) { this.leaf = leaf; ctx.scope.own(leaf); }
    this.board = () => ctx.app.player?.mode === 'board';
    // the islands' painted rock and meadow (E392): sampled in world space by world/isle.ts
    // and the windmill's stone, canvas and ivy (world/mill.ts)
    const [rock, meadowTex, branches, millStone, millCanvas, millIvy, vortex] = await Promise.all([loadPainted(TEX_URL.rock, 'far.rock', true), loadPainted(TEX_URL.meadow, 'far.meadow', true), loadPainted(TEX_URL.branches, 'far.branches'),
      loadPainted(TEX_URL.millStone, 'far.mill-stone', true), loadPainted(TEX_URL.millCanvas, 'far.mill-canvas'), loadPainted(TEX_URL.millIvy, 'far.mill-ivy'),
      loadPainted(TEX_URL.stormeye, 'far.stormeye')]);
    const textures = [rock, meadowTex, branches, millStone, millCanvas, millIvy, vortex];
    for (let i = 0; i < 7; i++) { const texture = textures[i]; if (texture !== null && texture !== undefined) ctx.scope.own(texture); }
    // the storm's painted underside (E399, mockup D's vortex seen from below), mirrored past its edge
    if (vortex !== null) { vortex.wrapS = MirroredRepeatWrapping; vortex.wrapT = MirroredRepeatWrapping; vortex.needsUpdate = true; }
    setStormPaint(vortex);
    setMillTextures({ stone: millStone, canvas: millCanvas, ivy: millIvy });
    setFirSheet(branches);
    setIsleTextures({ rock, meadow: meadowTex });
    this.built = buildWorld(ctx);
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
  private brainPolicies: ReturnType<typeof declaredSkyRows> | null = null;
  /** Actual instantiated declared policies, for the SF27 activation receipt; no actor state is changed. */
  brainWitness(): { id: string; kind: string; family: string | null }[] {
    return [...this.rays, ...this.roostRays, ...this.goats, ...this.wisps].map(actor => ({ id: actor.entityId, kind: actor.kind, family: this.brainPolicies?.witness(actor) ?? null }));
  }
  override kit(ctx: ShardContext): void {
    ctx.rows.weapon(FAN_ROW);
    this.brainPolicies = declaredSkyRows();
    ctx.rows.species([{ ...DRIFT_RAY, ...this.brainPolicies.rows[0] }, { ...SKY_GOAT, ...this.brainPolicies.rows[1] },
      { ...GALE_WISP, ...this.brainPolicies.rows[2] }, STORM_ROC]); ctx.rows.speciesLook([DRIFT_RAY_LOOK, SKY_GOAT_LOOK, GALE_WISP_LOOK, STORM_ROC_LOOK]);
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
  override async play(ctx: ShardContext): Promise<void> {
    const rt = ctx.game.runtime, built = this.built, fan = this.fan, position = rt?.world?.player.position ?? this.player;
    if (built === null || fan === null) throw new Error('Sky Reach: world and kit must run before play');
    const host = ctx.app.equipmentHost, toast = (text: string): void => { rt?.play?.hud.toast(text); };
    if (host !== null) { host.viewmodel.add(fan.model); ctx.scope.onDispose(() => { fan.model.removeFromParent(); }); }
    fan.stowed = () => this.board();
    // G24: the wisp's burst and the Roc's gale wall shove the player (`app.player.impulse`).
    const push = (v: Vector3): void => { ctx.app.player?.impulse(v); };
    if (retainsRuntimeServices(ctx)) installEnteredRuntimeService(ctx, scope => {
      bindPlayerPush(push); scope.onDispose(() => { bindPlayerPush(null); });
    });
    else { bindPlayerPush(push); ctx.scope.onDispose(() => { bindPlayerPush(null); }); }
    if (rt?.play) {
      const play = rt.play;
      if (retainsRuntimeServices(ctx)) installEnteredRuntimeService(ctx, scope => {
        if (source.audio.score === 'silent') installSilentScore(play.music, scope);
        installSkyCues(play.audio, play.cues, scope);
      });
      else { if (source.audio.score === 'silent') installSilentScore(rt.play.music, ctx.scope); installSkyCues(rt.play.audio, rt.play.cues, ctx.scope); }
    }
    const loot = installRuntimeLoot(ctx, { gear: (purse) => ({ coins: purse.coins }), finds: null, marks: null,
      charted: () => false, chime: () => { rt?.play?.cues.cue('cue.swap'); } });
    const { quest, flags, burst, finished, persistence } = installQuest(ctx, position, loot?.purse ? (share) => { loot.purse?.add(share); } : undefined);
    persistence.bindProgress(rt?.play?.progress);
    this.quest = quest; this.flags = flags; this.questFinished = finished;
    if (rt) rt.hooks.questFlags = () => quest.isComplete ? [FLAGS.complete] : [];

    const showGust = (): boolean => ctx.app.state === 'play' && !this.board();
    if (retainsRuntimeServices(ctx)) installEnteredRuntimeInput(ctx, { id: 'far.fan', actions: ['attack', 'heavy', 'lock', 'far.gust'], keysFrom: 'weapon.melee', keys: { 'far.gust': ['KeyG'] },
      touch: { mode: 'melee', lockable: true, relabel: { r0: { label: STRINGS.swing, icon: SWING_ICON } },
        verbs: { 'verb.1': { action: 'far.gust', label: STRINGS.gust, icon: GUST_ICON, show: showGust } } } },
    { rows: [{ group: 'combat', id: 'far.gust', label: STRINGS.gustBinding, actions: ['far.gust'] }] });
    else {
    ctx.inputContext({ id: 'far.fan', actions: ['attack', 'heavy', 'lock', 'far.gust'], keysFrom: 'weapon.melee', keys: { 'far.gust': ['KeyG'] },
      touch: { mode: 'melee', lockable: true, relabel: { r0: { label: STRINGS.swing, icon: SWING_ICON } },
        verbs: { 'verb.1': { action: 'far.gust', label: STRINGS.gust, icon: GUST_ICON, show: showGust } } } });
    // the gust in the key-bindings table, under Combat (E418: G worked but was listed nowhere), while the shard is loaded
    ctx.app.input.bindings.describe({ rows: [{ group: 'combat', id: 'far.gust', label: STRINGS.gustBinding, actions: ['far.gust'] }] }, ctx.scope);
    }

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
    // like an animal's, so a constant feed holds about UPDRAFT_LIFT / 3.5 m/s) floats you off the ramp to the high step.
    const lift = new Vector3();
    ctx.system({ id: 'far.updraft', phase: 'fixed.pre', run: (dt) => {
      const p = position; if (!this.board()) return;
      // inside the column (runtime/updraft.ts, the headless host's same rule)
      if (inUpdraft(p.x, p.y, p.z)) ctx.app.player?.impulse(lift.set(0, UPDRAFT_LIFT * dt, 0));
    } });

    const moverPose = (id: string): ReturnType<MoverRuntime['pose']> => {
      const movers = this.movers; if (movers === null) throw new Error('Sky mover pose requested outside its installed lifetime');
      return movers.pose(id);
    };
    const vanes = boundedRows(built.vanes).map(vane => ({ vane, flag: vaneFlag(vane.id) }));
    // Dressing: the hover decks glow while you ride; the mill and the turned vanes spin; the updraft's rings rise.
    ctx.system({ id: 'far.dressing', phase: 'update', run: (dt, t) => {
      const riding = this.board();
      built.hoverDeck.emissiveIntensity = riding ? 0.9 + Math.sin(t * 4) * 0.15 : 0.25; built.hoverDeck.opacity = riding ? 0.75 : 0.16;
      const cam = rt.world?.game.camera; if (cam && this.meadow) this.meadow.update(cam.position, t);
      // SF49-g (G183): the Rising Islets ride their movers (behaviour/islet.as, in the fixed step); draw them and their chains
      const movers = this.movers; if (movers !== null) { built.islets.update(moverPose); this.isletCalls?.update(moverPose); }
      built.millHub.rotation.z += dt * 0.35; FALL_TIME.value = t; built.storm.update(dt, t); built.wind.update(t);
      for (let i = 0; i < MAX_RUNTIME_ROWS; i++) {
        const row = vanes[i]; if (row === undefined) break;
        row.vane.rotor.rotation.y += dt * (flags.has(row.flag) ? 6 : 0.25);
      }
    } });

    // GUST: a cone of wind streaks and petals leaves the fan (style bible §7); a vane inside the cone starts turning (step 3).
    const fxRandom = ctx.app.rng.stream('cosmetic'), gustView = gustFx(() => fxRandom.next());
    const gustObjects = boundedRows(gustView.objects);
    for (let i = 0; i < MAX_RUNTIME_ROWS; i++) { const object = gustObjects[i]; if (object === undefined) break; ctx.root.add(object); }
    ctx.scope.onDispose(() => { gustView.dispose(); });
    fan.onGust = (from, dir) => {
      gustView.fire(from.clone().addScaledVector(dir, 0.2).setY(from.y - 0.25), dir); rt.play?.cues.charge(FAN_ROW, 'heavy');
      this.gustVanes(from, dir, toast);
    };
    ctx.system({ id: 'far.gust', phase: 'update', run: (dt) => { gustView.update(dt); } });

    // Creatures: each one knows its home (an island or a flying circle).
    const animals = rt.play?.animals;
    const rayHomes = boundedRows(RAY_HOMES);
    for (let i = 0; i < MAX_RUNTIME_ROWS; i++) { const home = rayHomes[i]; if (home === undefined) break; const a = bindSkyActor(ctx, `far.ray.${String(i)}`, home).spawn(); if (a) this.rays.push(a); }
    // each free ray trails its luminous wake (world/rayWake.ts; proposal B's ray beside the mill)
    const wakes = this.rays.map((ray) => { const w = rayWake(); ctx.root.add(w.mesh); ctx.scope.own(w.mesh.geometry); ctx.scope.own(w.mesh.material); ctx.scope.onDispose(() => { w.mesh.removeFromParent(); }); return { ray, w }; });
    boundedRows(wakes);
    ctx.system({ id: 'far.rayWake', phase: 'late', run: (dt) => {
      const cam = rt.world?.game.camera; if (!cam) return;
      for (let i = 0; i < MAX_RUNTIME_ROWS; i++) { const row = wakes[i]; if (row === undefined) break; row.w.update(row.ray.position, row.ray.alive, cam.position, dt); }
    } });
    const roostHomes = boundedRows(ROOST_RAYS);
    for (let i = 0; i < MAX_RUNTIME_ROWS; i++) { const home = roostHomes[i]; if (home === undefined) break; const a = bindSkyActor(ctx, `far.roost.${String(i)}`, home).spawn(); if (a) this.roostRays.push(a); }
    // The goats walk their island's deck (G26): the spawn lands them on the first WORLD floor under `fromY`. That ray
    // finds the islands only once physics has stepped (in `play` it hits nothing and the goat lands on the −1000 m
    // analytic floor), so they spawn on the first fixed step.
    const goatSpawns = boundedRows(GOATS).map((g, index) => ({
      body: bindSkyActor(ctx, `far.goat.${String(index)}`, { x: g.isle.x, z: g.isle.z, r: apothem(g.isle), y: g.isle.y }),
      placement: { fromY: g.isle.y + GOAT_SPAWN_ABOVE } }));
    let goatsDue = !retainsRuntimeServices(ctx);
    ctx.system({ id: 'far.goats', phase: 'fixed.post', run: () => {
      if (!goatsDue) return; goatsDue = false;
      for (let i = 0; i < MAX_RUNTIME_ROWS; i++) {
        const g = goatSpawns[i]; if (g === undefined) break;
        const a = g.body.spawn(g.placement);
        if (a) this.goats.push(a);
      }
    } });
    const wispHomes = boundedRows(WISP_HOMES);
    for (let i = 0; i < MAX_RUNTIME_ROWS; i++) { const home = wispHomes[i]; if (home === undefined) break; const a = bindSkyActor(ctx, `far.wisp.${String(i)}`, home).spawn(); if (a) this.wisps.push(a); }
    this.roc = bindRuntimeBoss(ctx, source, ROC_ID, undefined, { identity: 'runtime' }).spawn();
    if (this.roc !== null) setHome(this.roc, ROC);
    // Preserve the shipping identity order: deferred goats follow the Roc. Retained restore runs before any tick;
    // these flat island tops have an authored exact height, so initialization needs no physics step or quest update.
    if (retainsRuntimeServices(ctx) && animals !== undefined) this.goats.push(...spawnSkyGoats(animals, (index, y) => {
      const row = goatSpawns[index]; if (row === undefined) throw new Error('Missing Sky goat home');
      return row.body.spawn({ y });
    }));
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
        const slate = 'vec3 farSlate(vec3 c){ float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float gold = (1.0 - smoothstep(0.06, 0.12, c.b / max(c.r, 1e-3))) * smoothstep(0.2, 0.3, c.r); float brown = clamp((c.r - c.b) / max(c.r, 1e-3) * 1.6 - 0.3, 0.0, 1.0) * (1.0 - smoothstep(0.55, 0.75, c.g / max(c.r, 1e-3))) * (1.0 - gold); return mix(c, vec3(0.085, 0.09, 0.11) + vec3(l) * vec3(0.82, 0.9, 1.05) * 1.1, brown * 0.95); }';
        shader.fragmentShader = `${slate}\n${shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb = farSlate(diffuseColor.rgb);').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance = farSlate(totalEmissiveRadiance);')}`;
      }, { key: (prior) => `${prior}|far.roc-slate`, scope: ctx.scope });
    }
    }
    ctx.scope.onDispose(() => {
      const retiring = boundedRows([...this.rays, ...this.roostRays, ...this.goats, ...this.wisps, ...(this.roc ? [this.roc] : [])]);
      for (let i = 0; i < MAX_RUNTIME_ROWS; i++) { const animal = retiring[i]; if (animal === undefined) break; animals?.retire(animal); }
    });
    // Step 2: the roost is clear when its three rays are down.
    const isDead = (animal: Animal): boolean => !animal.alive;
    ctx.system({ id: 'far.roost', phase: 'update', run: () => {
      if (flags.has(FLAGS.notes) && !flags.has(FLAGS.roost) && this.roostRays.length > 0 && this.roostRays.every(isDead)) flags.set(FLAGS.roost);
    } });

    // The boss: the Storm Roc on the crown, the shared BossBar, 25 coins once.
    const boss = new StormRocBoss(ctx, position, this.roc, () => {
      if (flags.has(FLAGS.roc)) { toast(STRINGS.rocDown); return; }
      flags.set(FLAGS.roc); persistence.facts('far-reach.roc', ROC_ID); burst(BOSS_REWARD, STRINGS.bossReward);
    }, persistence.boss);
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
