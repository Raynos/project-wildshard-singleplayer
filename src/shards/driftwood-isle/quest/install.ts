import { declaredLootEconomy } from '@wildshard/game/shard/declaredRows';
import { installRuntimeLoot, enteredLootPresentation } from '@wildshard/game/loot/runtime';
import type { ShardContext } from '@wildshard/game/shard/context';
import { Sword } from '@wildshard/game/weapons/Sword';
import { driftwoodWorld } from '../world/build';
import { bindClientPlaceSets } from '@wildshard/game/shardfile/clientPlaceSets';
import { prepareQuestPageComposition, installQuestPageComposition, type QuestPageComposition as Adventure } from '@wildshard/game/quest/pageComposition';
import { registerQuestPageWorld } from '@wildshard/game/quest/pageResources';
import type { QuestPageCompositionRows } from '@wildshard/format/questPageComposition';
import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';
import { residentWorldScope } from '@wildshard/game/shardfile/hybridPresentation';
import { castawayFigure } from '../runtime/models/people';
import { enteredTrader, traderOf } from '../runtime/models/trader';
import { sharedModelContext, type ModelDef } from '@wildshard/engine/models/model';
import { place as placeModel } from '@wildshard/engine/models/place';
import { ownQuestTree } from '@wildshard/game/quest/chapter';
import { parseQuestTrader } from '@wildshard/game/quest/trader';
import { installDeclaredCollectionKeepsakes } from '@wildshard/game/compendium/keepsakes';
import { COLLECTIONS } from '../runtime/boot/blobAssets';
import { captainHat, sailclothCape, tradeCounter, trader as traderCard } from '../models/catalogue';
import { driftwoodRows } from '../runtime/boot/rows';
import { installItemEffects } from '@wildshard/game/loadout/effects';
import { preloadCreatureBodies } from '../species/bodies';

/** Prewarm the real hulls before the entered chapter can restore a saved altar. */
export async function installDriftwoodAdventure(ctx: ShardContext): Promise<Adventure> {
  const shell = ctx.game.runtime;
  const world = shell?.world, h = shell?.play;
  if (shell === undefined || world === undefined || world === null || h === undefined || h === null) throw new Error('Driftwood adventure requires the play host');
  // Saved used:altar restores the boss synchronously in Finale; resolve the hull before any quest restore/spawn.
  await preloadCreatureBodies();
  if (ctx.scope.disposed) throw new Error('Driftwood Isle was unloaded during the creature mesh load');
  const { player } = world;
  const d = driftwoodWorld(shell);
  const rows = await ctx.product.json<QuestPageCompositionRows>('quests/page-composition.json');
  registerQuestPageWorld(ctx.scope, rows.world, { pois: { hut: { anchors: d.hut.anchors }, lookout: { anchors: d.lookout.anchors },
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
  installBridgeSway(ctx, { ...rows.sway, system: rows.systems.sway, before: rows.systems.before });
  const placed = [d.pier.placed, d.boat.placed, ...d.jetties.map((j) => j.placed), d.hut.placed, d.lookout.placed, d.shrine.placed, d.bushes.placed, d.palms.placed, d.rocks.placed, d.bridge.placed,
    ...d.trailside.placed, ...d.cover.placed, ...d.wreck.placed, ...d.cove.placed, adventure.zipline?.placed, ...adventure.kit.placed];
  // the named places' Sets: the client plan's `world.sets` rows (Wreck Cove's is the whole wreck and cove)
  await bindClientPlaceSets(ctx, new Map([['wreck', [...d.wreck.placed, ...d.cove.placed]]]), placed.filter(p => p !== undefined));
  const swords = h.weapons.list.map(({ id }) => h.weapons.get(id)).filter((w): w is Sword => w instanceof Sword);
  const economy = declaredLootEconomy(ctx.product.section('economy/loot').rows.loot);
  installItemEffects(ctx);
  const cosmetics = new Map([['hat', captainHat], ['cape', sailclothCape]] as const);
  const modelSources = sharedModelContext(world.sky);
  const bindCosmetic = (model: ModelDef<Record<string, unknown>>): ModelDef<Record<string, unknown>> => ({ ...model,
    build: (_context, params, rng) => model.build({ ...modelSources, specimenScope: ctx.scope }, params, rng) });
  await installDeclaredCollectionKeepsakes(ctx, driftwoodRows('custom/collections').keepsakes, economy,
    new Map([['collection', { adventure, world, play: h, swords, catalogue: COLLECTIONS,
      models: new Map([...cosmetics].map(([id, model]) => [id, bindCosmetic(model)])) }]]));
  const presentation = enteredLootPresentation(ctx, 'driftwood.loot');
  installRuntimeLoot(ctx, presentation, { shop: await ctx.product.json(rows.files.stall), minimap: true, before: rows.systems.before.filter(id => id !== 'game.loot') });
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
