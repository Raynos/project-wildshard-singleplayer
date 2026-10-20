/** Counted custom model preparation and view hooks around declared page hosts. */
import { ShardPlugin, type ShardContext } from '@wildshard/game/plugin/context';
import { prepareForestPage, prepareForestPageLooks, forestFieldModels, type ForestPage } from '@wildshard/game/shardfile/forestPage';
import { prepareRangedPage, installRangedPage } from '@wildshard/game/loadout/rangedPage';
import { finishForestPageAudio } from '@wildshard/game/audio/forestPage';
import type { RangedPageRows } from '@wildshard/format/rangedPage';
import { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';
import { lendLooks } from '@wildshard/sdk/looks/lentLooks';
import { registerPackedGeometrySource } from '@wildshard/sdk/models/geometrySources';
import { PosedDraw } from '@wildshard/sdk/looks/posedInstances';
import { installPageLife } from '@wildshard/sdk/looks/pageLife';
import { HeldEquipment } from '@wildshard/game/plugin/heldEquipment';
import { installRuntimeAudioEntry } from '@wildshard/game/plugin/audio';
import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { declaredSpawnTables } from '@wildshard/engine/ai/encounters';
import { withPreparedScriptMemories } from '@wildshard/engine/script/host';
import { nextDrawnFrame, presenting } from '@wildshard/engine/core/framePacing';
import { macrotask, slicer } from '@wildshard/engine/boot/plan';
import { cutTerrain } from '@wildshard/engine/physics/terrain';
import { pineLooks, preparePineGrazers } from '../species/looks';
import { registerKing } from '../species/boss';
import { preloadKingKit } from './models/antlerKing';
import { admitPineView } from './world/context';
import { dressPineWater } from '../world/water';
import { updatePineForest } from '../world/treeFactory';
import { installPineLandmarks, type PineLandmarks } from './world/landmarks';
import { placeDrawnModels } from './world/drawnModels';
import { installPineQuest } from '../quest/index';
import { installWeather } from '../world/weather';
import { pineMemoryTrim } from './debug/options';
import { registerPineLap } from './dev/perfLap';
import type { CustomSections } from './productSections.generated.d.ts';

export class PineHollow extends ShardPlugin {
  private floor: ForestPage | null = null;
  private landmarks: PineLandmarks | null = null;
  override async world(ctx: ShardContext): Promise<void> {
    const rows = await ctx.product.json<RangedPageRows>('client/ranged-page.json'), finish = ctx.product.section('held/finishes').source;
    if (finish === undefined) throw new Error('Missing declared finish geometry');
    registerPackedGeometrySource(ctx.scope, rows.finishSource, { ...finish, label: 'held finishes' });
    registerPackedGeometrySource(ctx.scope, rows.collection.source, { url: ctx.product.url(rows.collection.pack.url), rows: rows.collection.pack.rows, label: 'trophy-wall' });
    await Promise.all([prepareRangedPage(ctx, rows), admitPineView(ctx.product)]);
    const input = await ctx.product.json('world/forest-page.json'), world = ctx.game.runtime?.world;
    if (world === undefined || world === null) throw new Error('Missing forest world');
    await prepareForestPageLooks(ctx, input); await dressPineWater(world.game);
    const wildlife = await PosedDraw.library(ctx.product, 'look/wildlife-draw.json');
    lendLooks(ctx.scope, await runtimeLookMaterials(ctx, ctx.product.shardfile, true, [wildlife.name]));
    const floor = this.floor = await prepareForestPage(ctx, input);
    const landmarks = this.landmarks = await installPineLandmarks(ctx, { sky: world.sky, registry: world.registry, cabins: floor.cabins, scenes: floor.resources });
    const cave = landmarks.crags?.cave;
    if (cave) { cutTerrain(world.physics, cave.terrainCuts()); await world.terrain.punchSliced(cave.holeTest(), slicer(30).due); }
    await floor.finish(); await placeDrawnModels(forestFieldModels(ctx, floor.rows.id), slicer(30).due);
    const runtime = ctx.game.runtime;
    if (runtime === undefined) throw new Error('Missing forest runtime');
    runtime.hooks.worldUpdate = (dt, time) => { updatePineForest(world.forest.factory, runtime.viewer()); floor.update(dt, time); };
  }
  override async kit(ctx: ShardContext): Promise<void> {
    const audio = ctx.app.audio; if (audio === null) throw new Error('Missing forest audio'); installRuntimeAudioEntry(ctx, 'kit', { audio });
    await preparePineGrazers(ctx.product); registerKing(); ctx.rows.species(ctx.product.section('actors/species-programs').page);
    ctx.rows.speciesLook(pineLooks(ctx.product.section<CustomSections['custom/thrallLook']>('custom/thrallLook')));
    ctx.rows.spawnTable(declaredSpawnTables(ctx.product.section('actors/species-programs').spawns));
    const held = await HeldEquipment.prepare(ctx.product); await preloadKingKit(); held.install(ctx);
  }
  override async play(ctx: ShardContext): Promise<void> {
    if (!retainsRuntimeServices(ctx)) return this.installPlay(ctx);
    const modules = await Promise.all(['behaviour/director.wasm'].map(name => ctx.product.file(name)));
    await withPreparedScriptMemories(modules, ctx.scope, () => presenting() ? nextDrawnFrame(ctx.scope) : macrotask(), () => this.installPlay(ctx));
  }
  private async installPlay(ctx: ShardContext): Promise<void> {
    const runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play, floor = this.floor, landmarks = this.landmarks;
    if (runtime === undefined || world === undefined || world === null || play === undefined || play === null || floor === null) throw new Error('Missing forest play services');
    const { game, player } = world, { animals, audio, music, hud } = play; installRuntimeAudioEntry(ctx, 'play', { audio, music });
    const rows = await ctx.product.json<RangedPageRows>('client/ranged-page.json'), page = await installRangedPage(ctx, { ...rows, shadowBatch: !pineMemoryTrim() });
    installEnteredRuntimeService(ctx, scope => { registerPineLap({ game, player, animals, music, hud, elites: page.fights.elites, king: page.fights.encounter }, scope); });
    const quest = await installPineQuest(ctx, { cabins: floor.cabins, landmarks, loadout: page.loadout, compendium: page.compendium });
    const ambience = await finishForestPageAudio(ctx, rows.id); quest.useSfx(ambience.sfx);
    landmarks?.crags?.cave.spots().forEach(spot => { ambience.addSpot({ zone: 'cave', ...spot, fade: 3 }); });
    await installWeather(ctx, await ctx.product.json('world/weather-observations.json'));
    const life = await installPageLife(ctx, await ctx.product.json(rows.life), page.compendium?.state ?? null, ambience.sfx);
    Object.assign(runtime.objects, { pineLife: life });
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, { cabins: floor.cabins, props: floor.props, streams: floor.streams, pineLife: life });
  }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default PineHollow;
