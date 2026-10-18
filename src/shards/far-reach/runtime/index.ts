import { plumbingKnob } from '@wildshard/game/shard/declaredPlumbing';
import SKY_RUNTIME_ROWS from '../data/runtimeRows.generated.json' with { type: 'json' };
import preparation from '../boot/worldTextures.generated.json' with { type: 'json' };
import type { ShardContext } from '@wildshard/game/shard/context';
import { worldBuildYield } from '@wildshard/game/shard/plugin';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import { BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial, Vector3, type Texture } from 'three';
import { buildWorld, type BuiltWorld } from '../world/build';
import { effectField, type EffectFieldRow } from '@wildshard/engine/fx/effectField';
import windRows from '../data/wind.generated.json' with { type: 'json' };
import { FAN_HELD_OWNERS, type WarFanWeapon } from './weapons/heldFan';
import { paintFanLeaf } from '../weapons/fanModel';
import { SKY_LIBRARY, preloadSkyMeshes, HERO_LIBRARY } from '../world/meshes';
import { loadSkyBaked, skyMeadowBlades } from '../world/baked';
import { adoptIsleTile } from '../world/isle';
import { wakeRibbon } from './looks/wakeRibbon';
import RAY_WAKE from '../data/rayWake.generated.json' with { type: 'json' };
import { meadow } from '../world/meadow';
import { bindQuestPageInteractions, bindClientChannels } from '@wildshard/game/plugin/ui';
import { HybridRuntimePlugin, type HybridRuntimeRows } from '@wildshard/game/plugin/headless';
import { bindRuntimeProductProps, prepareClientWorld, type ClientWorldPreparation } from '@wildshard/game/shardfile/runtimeProduct';

const { UPDRAFT_AXIS, WIND_FIELDS, WIND_LOOKS } = windRows;


// The authored catalogue bounds both view rosters; each contains fewer than 64 rows.
const MAX_RUNTIME_ROWS = 64;


export class SkyReachPlugin extends HybridRuntimePlugin {
  built: BuiltWorld | null = null; declare readonly fan: WarFanWeapon | null;
  /** Is the player riding the hoverboard? The fan stows and the decks glow then; the hover decks and the updraft are
   *  `mode: 'board'` pieces, which collide only then (SF34, ENGINE §5 `app.player.mode`). */
  private board: () => boolean = () => false;
  flags: Flags | null = null;
  /** The war fan's painted silk (loop 4), loaded behind the loading screen and owned by the level scope. */
  leaf: Texture | null = null;

  protected rows(product: ShardProduct): HybridRuntimeRows {
    const program = product.section('actors/species-programs').program;
    const stages = product.section('quests/directors').directors?.find(row => row.id === SKY_RUNTIME_ROWS.fight.stages.id);
    if (program === undefined || stages === undefined) throw new Error('Missing admitted species program or boss stages');
    return { ...SKY_RUNTIME_ROWS, strings: product.section('ui/strings'), fight: { ...SKY_RUNTIME_ROWS.fight, stages }, species: { ...SKY_RUNTIME_ROWS.species, program }, owners: { ...FAN_HELD_OWNERS, heldStyle: { paint: paintFanLeaf }, models: HERO_LIBRARY, looks: { mapped: SKY_LIBRARY.mappedLook } } }; }

  protected override async build(ctx: ShardContext): Promise<void> {
    const source = ctx.product.shardfile;
    const STRINGS = ctx.product.strings(['raised', 'turnWinch']);
    // The generated models (C6) load behind the loading screen; the world and the creature looks read them synchronously.
    // and the world pieces baked offline (SF72, world/baked.ts)
    await Promise.all([preloadSkyMeshes(() => worldBuildYield(ctx, 4)), loadSkyBaked()]);
    const compiled = await prepareClientWorld(ctx, source, preparation as ClientWorldPreparation, SKY_LIBRARY);
    this.leaf = compiled.painted.get('leaf') ?? null; this.board = () => ctx.app.player?.mode === 'board';
    // op-hitch41: in work slices (a grid cell builds Sky Reach on the road, in play: one 366 ms task on the Simulator,
    // then the meadow's 59 ms in the same frame); the meadow starts on a task of its own
    // the static islands from the shardfile's props tiles (runtime.binds props; generators/isleProps.ts), every tile resident
    const isles = new Map<string, Mesh>();
    await bindRuntimeProductProps(ctx.scope, source, { props: (tile) => { adoptIsleTile(tile, isles); } })
      .catch((e: unknown) => { console.error('[far-reach] the island tiles did not load; they stand undrawn:', e); });
    // the shard's look materials (look.materials, material graphs switched on for Sky, G387): the rope decks, the hover frames,
    // the shacks' kinds, the dressing's clumps and flowers, the falls (world/looks.ts)
    // and the looks over a model's own map (meshMap: the crown dais, the lantern, the keeper, the posts), each bound to it on its one compiled graph
    const deck = compiled.material('deck-wood'), frame = compiled.material('hover-frame');
    const built = this.built = await buildWorld(ctx, () => worldBuildYield(ctx, 4), isles, { deck, frame, channels: source.clientChannels ?? [] });
    await worldBuildYield(ctx, 4);
    const field = meadow(skyMeadowBlades(), SKY_LIBRARY.look('meadow'), plumbingKnob(source.plumbing, ctx.app.render?.tier ?? 'phone', 'far.meadowBlades', 'number'));
    ctx.root.add(field.group); ctx.scope.onDispose(field.dispose);
    const channelRows = source.clientChannels?.filter(row => row.connectors === undefined);
    if (channelRows === undefined) throw new Error('Missing admitted Sky mover views');
    this.keepClientChannels(ctx, bindClientChannels(channelRows, { targets: new Map([['winch', built.fallen]]), nativeOwners: SKY_RUNTIME_ROWS.clientMotion.nativeOwners, bindings: [built.islets], observed: (_id, observation) => {
      if (observation.value === undefined || observation.turn === undefined) throw new Error('Missing winch channel observations');
      built.state.raised = observation.value !== 0; built.state.raising = observation.turn === 1;
      built.winch.label = built.state.raised ? STRINGS.raised : STRINGS.turnWinch;
    } }));
  }
  protected override async install(ctx: ShardContext): Promise<void> {
    const source = ctx.product.shardfile;
    const { runtime: rt, position, quest } = this.pageEntry(ctx), built = this.built, fan = this.fan, motion = this.clientMotion, channels = this.clientChannels;
    if (built === null || fan === null || motion === null || channels === null || rt?.world === undefined || rt.world === null) throw new Error('Sky Reach: world and kit must run before play');
    const toast = (text: string): void => { rt.play?.hud.toast(text); };
    const { flags } = quest; this.flags = flags;
    await worldBuildYield(ctx, 4);

    const page = bindQuestPageInteractions(source, { flags, toast, interactables:rt.interactables,
      owners: new Map<string,unknown>([['world',built],['plugin',this]]) }, ctx.product.section('world/targets'));
    page.bindWorldTargets(fan);
    // the world pins, chip, map and minimap marks are the quest presentation's (data/questPage.ts)
    await worldBuildYield(ctx, 4);
    const host = motion.scriptHost; this.bindHeldActions(ctx, channels.hooks, () => host.currentTick);
    // SF8c socketLift: the Rising Islets answer the normal INTERACT through the platform's command (islet + road gate)
    rt.interactables.push(...channels.interactables);

    await worldBuildYield(ctx, 4);
        const eye = new Vector3();
    // Dressing: the hover decks glow while you ride; the mill and the turned vanes spin; the updraft's rings rise.
    ctx.system({ id: 'far.dressing', phase: 'update', run: (dt, t) => {
      const riding = this.board();
      built.hoverDeck.emissiveIntensity = riding ? 0.9 + Math.sin(t * 4) * 0.15 : 0.25; built.hoverDeck.opacity = riding ? 0.75 : 0.16;
      // SF49-g (G183): the Rising Islets ride their movers (fixed ride driver, in the fixed step); draw them and their chains
      built.millHub.rotation.z += dt * 0.35;
      for (let i = 0; i < MAX_RUNTIME_ROWS; i++) {
        const vane = built.vanes[i]; if (vane === undefined) break;
        vane.rotor.rotation.y += dt * (flags.has(vane.flag) ? 6 : 0.25);
      }
    } });

    // The wind's seeded fields (data/windLook.ts), moved by their graphs: the updraft's spiral up the ramp, and GUST, a cone
    // of streaks and petals leaving the fan (style bible §7); a vane inside the cone starts turning (step 3).
    const wind = (key: keyof typeof WIND_FIELDS): ReturnType<typeof effectField> => {
      const look = SKY_LIBRARY.look(WIND_LOOKS[key]); if (look === undefined) throw new Error(`Sky Reach: look.materials lacks ${WIND_LOOKS[key]}`);
      const field = effectField(WIND_FIELDS[key] as EffectFieldRow, look); ctx.root.add(field.object); ctx.scope.own(field.geometry); ctx.scope.onDispose(() => { field.object.removeFromParent(); }); return field;
    };
    const axis = [new Vector3(...UPDRAFT_AXIS.at), new Vector3(...UPDRAFT_AXIS.aim)] as const, fxRandom = ctx.app.rng.stream('cosmetic'), gust = [wind('gustStreaks'), wind('gustPetals')] as const;
    wind('updraftStreaks').place(...axis); wind('updraftLeaves').place(...axis);
    fan.onGust = (from, dir) => {
      const at = from.clone().addScaledVector(dir, 0.2).setY(from.y - 0.25), salt = fxRandom.next(); gust[0].burst(at, dir, salt); gust[1].burst(at, dir, salt);
      rt.play?.cues.charge(SKY_RUNTIME_ROWS.weapon, 'heavy');
    };
    ctx.system({ id: 'far.gust', phase: 'update', run: (dt) => { gust[0].update(dt); gust[1].update(dt); } });

    // Creatures: each one knows its home (an island or a flying circle). The goats walk their island's deck (G26): their
    // spawn ray lands them on the first WORLD floor under `fromY`, which finds the islands only once physics has stepped
    // (in `play` it hits nothing and the goat lands on the -1000 m analytic floor), so they land late, after the Roc.
    await worldBuildYield(ctx, 4);
    await this.populate(ctx, source, {}, () => worldBuildYield(ctx, 4));
    // each free ray trails its luminous wake (data/rayWakeLook.ts on @wildshard/sdk/looks/wakeRibbon; proposal B's ray beside the mill)
    const wakes = this.actors('rays').map((ray) => { const w = wakeRibbon(RAY_WAKE); ctx.root.add(w.mesh); ctx.scope.own(w.mesh.geometry); ctx.scope.onDispose(() => { w.mesh.removeFromParent(); }); return { ray, w }; });
    ctx.system({ id: 'far.rayWake', phase: 'late', run: (dt) => {
      const cam = rt.world?.game.camera; if (!cam) return;
      // each wake in the level's own frame (it stands at the root): inside a grid cell the root is at the cell's render offset
      for (let i = 0; i < MAX_RUNTIME_ROWS; i++) { const row = wakes[i]; if (row === undefined) break; row.w.update(row.ray.position, row.ray.alive, row.w.mesh.worldToLocal(cam.getWorldPosition(eye)), dt); }
    } });
    await worldBuildYield(ctx, 4);
    // Step 2: the roost is clear when its three rays are down.

    // The boss: the Storm Roc on the crown, the shared BossBar, 25 coins once.
    await this.bindPageFight(ctx);
    // Phase 2's gale wall: a pale sheet of wind that thickens over the windup along the lane it will sweep.
    const GALE_WALL = ctx.product.section('actors/strikes').find(row => row.id === 'far.roc.galeWall');
    if (GALE_WALL === undefined) throw new Error('Missing admitted gale-wall strike');
    const wall = new Mesh(new BoxGeometry(GALE_WALL.shape.kind === 'lane' ? GALE_WALL.shape.width : 6, 5, 0.4),
      new MeshBasicMaterial({ color: 0xc8f1f8, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, fog: false }));
    wall.visible = false; ctx.root.add(wall); ctx.scope.own(wall.geometry); ctx.scope.own(wall.material); ctx.scope.onDispose(() => { wall.removeFromParent(); });
    ctx.system({ id: 'far.galeWall', phase: 'update', run: () => {
      const roc = this.actor(SKY_RUNTIME_ROWS.fight.id), body = this.populationControl;
      wall.visible = body?.current?.id === GALE_WALL.id && roc?.alive === true;
      if (!wall.visible || roc === null || body === null) return;
      const k = Math.min(1, body.windup / GALE_WALL.windup), sweep = Math.max(0, body.windup - GALE_WALL.windup) / GALE_WALL.active, reach = 26 * Math.min(1, sweep);
      wall.position.set(roc.position.x + Math.sin(body.aim) * (2 + reach), position.y + 2.5, roc.position.z + Math.cos(body.aim) * (2 + reach));
      // a faint veil that thickens over the windup (loop 5: at 0.42 a wall you stand in filled the frame with white)
      wall.rotation.y = body.aim; wall.material.opacity = 0.06 + 0.16 * k;
    } });
  }
  /** Snap the crown bridge up (the winch's end state, also restored from a save). */
  /** Borrowed capture command on the actual bridge owner. */
  finishRaise(): void { if (this.built !== null) this.clientChannels?.runtime?.command('far.winch.bridge', 3); }

}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default SkyReachPlugin;
