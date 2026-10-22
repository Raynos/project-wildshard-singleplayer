import { publishEntryOwner, entryOwner } from '@wildshard/game/shardfile/entryOwners';
import type { ShardContext } from '@wildshard/game/shard/context';
import { driftwoodWorld } from '../world/build';
import { bindClientPlaceSets } from '@wildshard/game/shardfile/clientPlaceSets';
import { prepareQuestPageComposition, installQuestPageComposition, type QuestPageComposition as Adventure } from '@wildshard/game/quest/pageComposition';
import { registerQuestPageWorld } from '@wildshard/game/quest/pageResources';
import type { QuestPageCompositionRows } from '@wildshard/format/questPageComposition';
import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';
import { residentWorldScope } from '@wildshard/game/shardfile/hybridPresentation';
import { castawayFigure } from '../runtime/models/people';
import { enteredTrader, traderOf } from '../runtime/models/trader';
import { sharedModelContext } from '@wildshard/engine/models/model';
import { place as placeModel } from '@wildshard/engine/models/place';
import { ownQuestTree } from '@wildshard/game/quest/chapter';
import { parseQuestTrader } from '@wildshard/game/quest/trader';
import { tradeCounter, trader as traderCard } from '../models/catalogue';
import { productHullBook } from '@wildshard/game/looks/speciesBook';

/** Prewarm the real hulls before the entered chapter can restore a saved altar. */
export async function installDriftwoodAdventure(ctx: ShardContext): Promise<Adventure> {
  const shell = ctx.game.runtime;
  const world = shell?.world, h = shell?.play;
  if (shell === undefined || world === undefined || world === null || h === undefined || h === null) throw new Error('Driftwood adventure requires the play host');
  // Saved used:altar restores the boss synchronously in Finale; resolve the hull before any quest restore/spawn.
  await productHullBook(ctx.product).packed.preload();
  if (ctx.scope.disposed) throw new Error('Driftwood Isle was unloaded during the creature mesh load');
  const { player } = world;
  const d = driftwoodWorld(shell);
  const rows = await ctx.product.json<QuestPageCompositionRows>('quests/page-composition.json');
  registerQuestPageWorld(ctx.scope, rows.world, { pois: { hut: { anchors: entryOwner(ctx.scope, 'site', 'hut') }, lookout: { anchors: entryOwner(ctx.scope, 'site', 'lookout') },
    wreck: { anchors: d.wreck.anchors }, shrine: { anchors: d.shrine.anchors }, cave: { anchors: d.cove.anchors } }, flock: d.gulls.flock });
  const placement = await prepareQuestPageComposition(ctx, rows);
  const scenes = await installWorldScenes(ctx, ctx.product.section('world/scenes'), residentWorldScope(ctx));
  const npc = castawayFigure(world.sky, placement.place(rows.speaker.feet), placement.place(rows.speaker.fire), scenes, ctx.scope);
  const stallPlacement = parseQuestTrader(await ctx.product.json(rows.files.stall)).placement;
  if (stallPlacement === undefined) throw new Error('Missing declared trader placement');
  const feet = placement.place(stallPlacement.feet), fx = Math.sin(feet.yaw), fz = Math.cos(feet.yaw), cx = feet.x + fx * stallPlacement.counterAhead, cz = feet.z + fz * stallPlacement.counterAhead;
  const rig = ctx.scope.run(() => {
    const context = { ...sharedModelContext(world.sky), specimenScope: ctx.scope };
    const figure = placeModel(enteredTrader(traderCard), [feet], { ctx: context, draw: 'single', registry: world.registry, piece: { id: rows.trader.figure, name: 'The trader' } });
    const counter = placeModel(tradeCounter, [{ x: cx, y: placement.floorAt(cx, cz), z: cz, yaw: feet.yaw }], { ctx: context, draw: 'single', registry: world.registry, piece: { id: rows.trader.counter, name: "The trader's counter", solidFloor: false } });
    ownQuestTree(figure.object, ctx.scope); ownQuestTree(counter.object, ctx.scope);
    const made = traderOf(figure.object); if (made === null) throw new Error('Missing entered trader figure'); made.companions.push(counter.object); return made;
  });
  ctx.scope.onDispose(() => { npc.dispose(); rig.dispose(); });
  ctx.system({ id: rows.systems.speakerPose, phase: 'update', before: [rows.systems.talks], run: (dt, time) => { npc.update(dt, time, player.position); } });
  ctx.system({ id: rows.systems.traderPose, phase: 'update', before: [rows.systems.trader], run: (dt, time) => { rig.update(dt, time, player.position); } });
  const adventure = await installQuestPageComposition(ctx, rows);
  publishEntryOwner(ctx.scope, 'quest', rows.id, adventure);
  installBridgeSway(ctx, { ...rows.sway, system: rows.systems.sway, before: rows.systems.before });
  const placed = [...entryOwner(ctx.scope, 'placed', 'piers.world-0'), d.boat.placed,
    ...['piers.world-1', 'piers.world-2', 'piers.world-3'].flatMap(id => entryOwner(ctx.scope, 'placed', id)), ...entryOwner(ctx.scope, 'placed', 'hut'), ...entryOwner(ctx.scope, 'placed', 'lookout'), d.shrine.placed, d.bushes.placed, d.palms.placed, d.rocks.placed, d.bridge.placed,
    ...d.trailside.placed, ...d.cover.placed, ...d.wreck.placed, ...d.cove.placed, adventure.zipline?.placed, ...adventure.kit.placed];
  // the named places' Sets: the client plan's `world.sets` rows (Wreck Cove's is the whole wreck and cove)
  await bindClientPlaceSets(ctx, new Map([['wreck', [...d.wreck.placed, ...d.cove.placed]]]), placed.filter(p => p !== undefined));
  return adventure;
}

/** G532(3): the rope deck remains listed shard view code until WASM-HOST. */
export interface BridgeSwayRows {
  readonly piece: string; readonly system: string; readonly before: readonly string[];
  readonly height: number; readonly ease: number; readonly threshold: number;
  readonly rate: number; readonly speed: number; readonly rollHz: number;
  readonly roll: number; readonly dipHz: number; readonly dip: number;
}

/** Keep the shipping camera projection on the entered bridge's actual floor. */
export function installBridgeSway(ctx: ShardContext, rows: BridgeSwayRows): void {
  const world = ctx.game.runtime?.world;
  if (world === undefined || world === null) throw new Error('Rope deck view requires its entered world');
  const bridge = world.registry.get(rows.piece);
  if (bridge === undefined) return;
  let sway = 0, bt = 0;
  ctx.system({ id: rows.system, phase: 'update', before: [...rows.before], run: dt => {
    const p = world.player.position, f = bridge.floor?.(p.x, p.z);
    const on = f !== undefined && Math.abs(p.y - f) < rows.height;
    sway += ((on ? 1 : 0) - sway) * Math.min(1, dt * rows.ease);
    if (sway < rows.threshold) return;
    bt += dt * (rows.rate + Math.hypot(world.player.velocity.x, world.player.velocity.z) * rows.speed);
    world.game.camera.rotation.z += Math.sin(bt * rows.rollHz) * rows.roll * sway;
    world.game.camera.position.y += Math.sin(bt * rows.dipHz) * rows.dip * sway;
  } });
}
