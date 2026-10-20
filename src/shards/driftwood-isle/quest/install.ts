import { declaredLootEconomy } from '@wildshard/game/shard/declaredRows';
import { installRuntimeLoot } from '@wildshard/game/loot/runtime';
import type { ShardContext } from '@wildshard/game/shard/context';
import { Sword } from '@wildshard/game/weapons/Sword';
import { driftwoodWorld } from '../world/build';
import { registerPlaceSets } from '@wildshard/engine/models/sets';
import type { PlaceSets } from '../runtime/productSections.generated.d.ts';
import { prepareQuestPageComposition, installQuestPageComposition, questPagePanelHold, type QuestPageComposition as Adventure } from '@wildshard/game/quest/pageComposition';
import { registerQuestPageWorld } from '@wildshard/game/quest/pageResources';
import type { QuestPageCompositionRows } from '@wildshard/format/questPageComposition';
import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';
import { residentWorldScope } from '@wildshard/game/shardfile/hybridPresentation';
import { castawayFigure } from '../runtime/models/people';
import { trader, tradeCounter, traderOf } from '../runtime/models/trader';
import { modelContext } from '@wildshard/engine/models/model';
import { place as placeModel } from '@wildshard/engine/models/place';
import { ownQuestTree } from '@wildshard/game/quest/chapter';
import { parseQuestTrader } from '@wildshard/game/quest/trader';
import { installDeclaredCollectionKeepsakes } from '@wildshard/game/compendium/keepsakes';
import { COLLECTIONS } from '../runtime/boot/blobAssets';
import { captainHat, sailclothCape } from '../runtime/models/captainHat';
import { driftwoodRows } from '../runtime/boot/rows';
import { installItemEffects } from '@wildshard/game/loadout/effects';
import { driftwoodLootPresentation } from '../loot/presentation';
import { installQuestHints } from '@wildshard/game/quest/hints';
import { preloadCaptainMesh } from '../species/captainMesh';
import { preloadCreatureBodies } from '../species/bodies';

/** Prewarm the real hulls before the entered chapter can restore a saved altar. */
export async function installDriftwoodAdventure(ctx: ShardContext): Promise<Adventure> {
  const shell = ctx.game.runtime;
  const world = shell?.world, h = shell?.play;
  if (shell === undefined || world === undefined || world === null || h === undefined || h === null) throw new Error('Driftwood adventure requires the play host');
  // Saved used:altar restores the boss synchronously in Finale; resolve the hull before any quest restore/spawn.
  await Promise.all([preloadCaptainMesh(), preloadCreatureBodies()]);
  if (ctx.scope.disposed) throw new Error('Driftwood Isle was unloaded during the creature mesh load');
  const { player } = world;
  const d = driftwoodWorld(shell);
  const rows = await ctx.product.json<QuestPageCompositionRows>('quests/page-composition.json');
  registerQuestPageWorld(ctx.scope, rows.world, { pois: { hut: d.hut === null ? null : { anchors: d.hut.anchors },
    lookout: d.lookout === null ? null : { anchors: d.lookout.anchors }, wreck: d.wreck === null ? null : { anchors: d.wreck.anchors },
    shrine: d.shrine === null ? null : { anchors: d.shrine.anchors }, cave: d.cove === null ? null : { anchors: d.cove.anchors } }, flock: d.gulls?.flock ?? null });
  const placement = await prepareQuestPageComposition(ctx, rows);
  const scenes = await installWorldScenes(ctx, ctx.product.section('world/scenes'), residentWorldScope(ctx));
  const npc = castawayFigure(world.sky, placement.place(rows.speaker.feet), placement.place(rows.speaker.fire), scenes, ctx.scope);
  const stallPlacement = parseQuestTrader(await ctx.product.json(rows.files.stall)).placement;
  if (stallPlacement === undefined) throw new Error('Missing declared trader placement');
  const feet = placement.place(stallPlacement.feet), fx = Math.sin(feet.yaw), fz = Math.cos(feet.yaw), cx = feet.x + fx * stallPlacement.counterAhead, cz = feet.z + fz * stallPlacement.counterAhead;
  const rig = ctx.scope.run(() => {
    const context = modelContext(world.sky);
    const figure = placeModel(trader, [feet], { ctx: context, draw: 'single', registry: world.registry, piece: { id: rows.trader.figure, name: 'The trader' } });
    const counter = placeModel(tradeCounter, [{ x: cx, y: placement.floorAt(cx, cz), z: cz, yaw: feet.yaw }], { ctx: context, draw: 'single', registry: world.registry, piece: { id: rows.trader.counter, name: "The trader's counter", solidFloor: false } });
    ownQuestTree(figure.object, ctx.scope); ownQuestTree(counter.object, ctx.scope);
    const made = traderOf(figure.object); if (made === null) throw new Error('Missing entered trader figure'); made.companions.push(counter.object); return made;
  });
  ctx.scope.onDispose(() => { npc.dispose(); rig.dispose(); });
  ctx.system({ id: rows.systems.speakerPose, phase: 'update', before: [rows.systems.talks], run: (dt, time) => { npc.update(dt, time, player.position); } });
  ctx.system({ id: rows.systems.traderPose, phase: 'update', before: [rows.systems.trader], run: (dt, time) => { rig.update(dt, time, player.position); } });
  const adventure = await installQuestPageComposition(ctx, rows);
  if (adventure.places === null) throw new Error('Driftwood adventure requires its discovery catalogue');
  h.fullMap.setPois(adventure.places.mapPois, { tally: true });
  shell.hooks.adventureFlags = () => adventure.flags.all.slice().sort();
  const placed = [d.pier?.placed, d.boat?.placed, ...d.jetties.map((j) => j.placed), d.hut?.placed, d.lookout?.placed, d.shrine?.placed, d.bushes?.placed, d.palms?.placed, d.rocks?.placed, d.bridge?.placed,
    ...(d.trailside?.placed ?? []), ...(d.cover?.placed ?? []), ...(d.wreck?.placed ?? []), ...(d.cove?.placed ?? []), adventure.zipline?.placed, ...adventure.kit.placed];
  const wreck = [...(d.wreck?.placed ?? []), ...(d.cove?.placed ?? [])];
  registerPlaceSets(await ctx.product.json<PlaceSets>('world/place-sets.json'), { file: 'src/shards/driftwood-isle/data/placeSets.json', members: row => {
    const def = adventure.content.places.find(place => `driftwood-isle/${place.id}` === row.place);
    if (def === undefined) throw new Error(`places: no named place ${row.place}`);
    return row.explicit === undefined ? { near: { placed, ...adventure.place(def.at), r: def.r, mode: 'bounds' } } : { whole: row.explicit === 'wreck' ? wreck : [] };
  } });
  const swords = h.weapons.list.map(({ id }) => h.weapons.get(id)).filter((w): w is Sword => w instanceof Sword);
  const effects = ctx.app.effects, health = ctx.app.player;
  if (effects === null || health === null) throw new Error('Driftwood adventure requires the player effects');
  const economy = declaredLootEconomy(ctx.product.section('economy/loot').rows.loot);
  installItemEffects(ctx);
  await installDeclaredCollectionKeepsakes(ctx, driftwoodRows('custom/collections').keepsakes, economy,
    new Map([['collection', { adventure, world, play: h, swords, catalogue: COLLECTIONS,
      models: new Map([['hat', captainHat], ['cape', sailclothCape]]) }]]));
  const presentation = await driftwoodLootPresentation({ economy, adventure, owned: h.owned, health, audio: h.audio, scope: ctx.scope,
    toast: (text) => { h.hud.toast(text); }, hold: questPagePanelHold(ctx, { restartOnClose: true, stow: true, resumeSwimming: true }) });
  installRuntimeLoot(ctx, presentation, { minimap: true, before: rows.systems.before.filter(id => id !== 'game.loot') });
  if (h.firstHints !== undefined) {
    const hintRows: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/hints.json')));
    installQuestHints(ctx, hintRows, new Map([['quest', { hints: h.firstHints, animals: h.animals, player, ui: ctx.app.ui }]]));
  }
  return adventure;
}
