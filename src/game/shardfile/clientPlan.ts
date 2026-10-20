import { installClientAdventurePersistence } from '../quest/persistence';
import { installPracticeCourse } from '../practice/registration';
import { runtimeLookMaterials } from './runtimeProduct';
import { hasLentLook, lendLooks } from './lentLooks';
import { installClientMeadow } from './clientMeadow';
import { installClientPathRamps } from './pagePreparation';
import { installClientRiding } from '../riding/client';
import { installClientWildlife } from '../population/wildlife';
import { installClientFinds } from './clientFinds';
import { TIER } from '@wildshard/engine/core/tier';
import { SceneDressing } from './sceneDressing';
import { installClientPlaceSets } from './clientPlaceSets';
import { installClientCatalogue } from './clientCatalogue';
import { Color } from 'three';
import { syncPainterlySun,updatePainterly,setPainterlyLook,painterlyUniforms } from '@wildshard/engine/world/painterly';
import { wind } from '@wildshard/engine/world/steppeWind';
import { windUniforms } from '@wildshard/engine/world/TreeFactory';
import { installClientAudioScene, enterClientAudioScene } from '../audio/sceneDirector';
import { installClientWaterSurfaces } from './clientWaterSurfaces';
import { installClientBakedTiles } from './bakedTiles';
import { installClientCosmeticFinishes } from './clientCosmeticFinishes';
import { hasDeclaredClientPage } from '@wildshard/format/runtimeBinds';
import { installClientCues } from './clientCues';
import { installClientTrails } from './clientTrails';
import { clientNativeBook } from './clientNativeBook';
import { installWeatherFields } from './weatherFields';
import { installSceneMotion } from './sceneMotion';
import { installClientHeldMelee, enterClientHeldMelee } from './clientHeldMelee';
import { installClientSpeciesProgram } from './clientSpeciesProgram';
import { installClientQuestPage, finishClientQuestPage } from './clientQuestPage';
import { installClientPopulation } from './clientPopulation';
import { installClientBossFight } from './clientBossFight';
import { installClientBossTelegraph } from './clientBossTelegraph';
import { installClientPlayerEnter, enterClientPlayer } from './clientPlayerEnter';
import type { PlatformSectionName } from '@wildshard/format/sections';
import { installLightEmitters } from './lightEmitters';
import { buildYield } from '@wildshard/engine/core/workSlice';
import type { Scope } from '@wildshard/engine/app/scope';
import { parseClientPlan, type ClientFeatureKind, type ClientFeatureRow } from '@wildshard/format/clientPlan';
import { clientOwnershipRules } from '@wildshard/format/clientOwnership';
import { outputDescriptor } from './outputDescriptor';
import type { ShardContext } from '../plugin/context';
import { ProductError, type ShardProduct } from './shardProduct';
import { installWorldScenes } from './worldScenes';
import { clientSceneHandles, publishClientSceneHandles } from './clientSceneHandles';
import { installEnteredRuntimeService, retainsRuntimeServices } from '../shard/retainedHooks';

export type ClientPhase = 'world' | 'kit' | 'play';
interface ClientFeature {
  readonly phase: ClientPhase;
  readonly rank: number;
  readonly lifetime: 'resident' | 'entered';
  readonly sections: readonly PlatformSectionName[];
  readonly install: (ctx: ShardContext, row: ClientFeatureRow, resident: Scope) => Promise<void> | void;
  readonly play?: { readonly rank: number; readonly install: ClientFeature['install'] };
}
/** Compiled-in client-only registry. Adding a kind requires its strict format schema and a reviewed platform host. */
export const CLIENT_FEATURES: Readonly<Record<ClientFeatureKind, ClientFeature>> = {
  'content.catalogue': { phase: 'kit', rank: 15, lifetime: 'entered',
    // Item/quest/journal envelopes are root data; finishes are streamed separately.
    sections: ['held/finishes'], install: installClientCatalogue },
  'state.adventure': { phase: 'world', rank: 5, lifetime: 'entered', sections: [], install: installClientAdventurePersistence },
  'world.meadow': { phase: 'world', rank: 46, lifetime: 'entered', sections: [], install: installClientMeadow },
  'world.paths': { phase: 'kit', rank: 0, lifetime: 'entered', sections: [], install: installClientPathRamps },
  'riding.session': { phase: 'world', rank: 49, lifetime: 'entered', sections: [], install: installClientRiding },
  'practice.course': { phase: 'play', rank: 100, lifetime: 'entered', sections: [], install: installPracticeCourse },
  'population.wildlife': { phase: 'world', rank: 49, lifetime: 'entered', sections: [], install: installClientWildlife },
  'world.water': {phase:'world',rank:42,lifetime:'entered',sections:[],install:installClientWaterSurfaces},
  'world.baked': { phase: 'world', rank: 43, lifetime: 'resident', sections: [], install: installClientBakedTiles },
  'audio.scene': {phase:'world',rank:48,lifetime:'entered',sections:[],install:installClientAudioScene,play:{rank:30,install:enterClientAudioScene}},
  'look.painterly': {phase:'world',rank:10,lifetime:'entered',sections:[],install:(ctx,row)=>{
    if(row.kind!=='look.painterly')throw new Error('Invalid painterly feature');
    const world=ctx.game.runtime?.world;if(world===undefined||world===null)throw new Error('Painterly look requires its world');
    const apply=()=>{syncPainterlySun(world.sky);setPainterlyLook({shadeTint:new Color(...row.shadeTint),rimColor:new Color(...row.rimColor),wind:row.wind});};
    if(retainsRuntimeServices(ctx))installEnteredRuntimeService(ctx,apply);else apply();
    ctx.system({id:'client.painterly',phase:'update',after:['main.world'],before:['engine.creatures.update'],run:dt=>{updatePainterly(dt);painterlyUniforms.uPWind.value.set(wind.dirX,wind.dirZ,windUniforms.uWindStrength.value);}});
  }},
  'world.sets': {phase:'world',rank:47,lifetime:'entered',sections:[],install:installClientPlaceSets},
  'strings.register': { phase: 'world', rank: 0, lifetime: 'entered', sections: ['ui/strings'],
    install: ctx => {
      const rows = ctx.product.section('ui/strings');
      if (!retainsRuntimeServices(ctx)) { ctx.strings(rows); return; }
      installEnteredRuntimeService(ctx, scope => { ctx.app.levelRegistrations.strings(rows, scope); });
    } },
  'world.dressing': {phase:'world',rank:45,lifetime:'entered',sections:['world/scenes'],install:async(ctx)=>{
    const rows=ctx.product.section('world/scenes').dressing;if(rows===undefined)throw new Error('Dressing feature requires its scene rows');
    await SceneDressing.install(ctx,await ctx.product.json<unknown>(rows[TIER]));
  }},
  'world.scenes': { phase: 'world', rank: 20, lifetime: 'resident', sections: ['world/scenes'],
    install: async (ctx, _row, resident) => {
      const value = await installWorldScenes(ctx, ctx.product.section('world/scenes'), resident);
      publishClientSceneHandles(ctx.product, resident, value);
    } },
  'light.emitters': { phase: 'world', rank: 30, lifetime: 'resident', sections: ['world/scenes'],
    install: async (ctx, row, resident) => {
      if (row.kind !== 'light.emitters') throw new Error('Invalid emitter feature');
      await installLightEmitters(ctx, row.rows, clientSceneHandles(ctx.product, resident), resident);
    } },
  'motion.channels': { phase: 'world', rank: 40, lifetime: 'entered', sections: ['world/scenes'],
    install: (ctx, row, resident) => {
      if (row.kind !== 'motion.channels') throw new Error('Invalid scene motion feature');
      installSceneMotion(ctx, row.rows, clientSceneHandles(ctx.product, resident));
    } },
  'bag.finds': {phase:'play',rank:95,lifetime:'entered',sections:[],install:installClientFinds},
  'held.cosmetics': {phase:'kit',rank:30,lifetime:'entered',sections:['held/finishes'],install:installClientCosmeticFinishes},
  'held.melee': { phase: 'kit', rank: 10, lifetime: 'entered', sections: ['look/painted'], install: installClientHeldMelee,
    play: { rank: 20, install: enterClientHeldMelee } },
  'player.enter': { phase: 'world', rank: 50, lifetime: 'entered', sections: [], install: installClientPlayerEnter,
    play: { rank: 25, install: enterClientPlayer } },
  'species.program': { phase: 'kit', rank: 20, lifetime: 'entered', sections: ['actors/species-programs', 'sim/scripts', 'sim/runtime-plan'], install: installClientSpeciesProgram },
  'quest.page': { phase: 'play', rank: 10, lifetime: 'entered', sections: ['world/scenes', 'world/targets', 'look/painted'], install: installClientQuestPage,
    play: { rank: 80, install: finishClientQuestPage } },
  'boss.spawned': { phase: 'play', rank: 50, lifetime: 'entered', sections: ['sim/runtime-plan'], install: installClientBossFight },
  'population.homes': { phase: 'play', rank: 60, lifetime: 'entered', sections: ['sim/runtime-plan', 'sim/scripts'], install: installClientPopulation },
  'boss.held': { phase: 'play', rank: 70, lifetime: 'entered', sections: ['sim/runtime-plan'], install: installClientBossFight },
  'boss.telegraph': { phase: 'play', rank: 75, lifetime: 'entered', sections: ['sim/runtime-plan', 'actors/strikes'], install: installClientBossTelegraph },
  'weather.fields': { phase: 'play', rank: 40, lifetime: 'entered', sections: [],
    install: (ctx, row) => {
      if (row.kind !== 'weather.fields') throw new Error('Invalid weather feature');
      installWeatherFields(ctx, row.rows, row.quest);
    } },
  'audio.cues': { phase: 'play', rank: 30, lifetime: 'entered', sections: ['world/scenes'], install: installClientCues },
  'fx.trail': { phase: 'play', rank: 90, lifetime: 'entered', sections: ['world/scenes'], install: installClientTrails },
  'debug.expose': { phase: 'play', rank: 100, lifetime: 'entered', sections: [], install: (ctx, row) => {
    if (row.kind !== 'debug.expose' || ctx.game.runtime === undefined) throw new Error('Client debug feature requires its runtime');
    if (hasDeclaredClientPage(ctx.product.shardfile)) {
      const book = clientNativeBook(ctx); ctx.debug.expose(row.name, Object.assign(book, { stage: book.capture }));
    } else ctx.debug.expose(row.name, ctx.game.runtime);
  } },
};
export interface AdmittedClientPlan { readonly features: readonly ClientFeatureRow[] }
/** Validate the whole plan and all required sections before the first feature can mutate the page. */
export function admitClientPlan(input: unknown, product: ShardProduct): AdmittedClientPlan {
  try {
    const plan = parseClientPlan(input);
    const sections = new Map(outputDescriptor(product.shardfile)?.sections);
    for (const name of ['world/scenes', 'actors/species-programs', 'sim/runtime-plan', 'sim/scripts', 'look/painted'] as const)
      if (product.has(name)) sections.set(name, product.section(name));
    sections.set('client/plan', plan);
    const errors = clientOwnershipRules(product.shardfile, sections); if (errors.length > 0) throw new Error(errors.join('; '));
    if (plan.features.some(row => row.kind === 'light.emitters') && !plan.features.some(row => row.kind === 'world.scenes')) throw new Error('Emitters require the scene feature');
    if (plan.features.some(row => row.kind === 'motion.channels') && !plan.features.some(row => row.kind === 'world.scenes')) throw new Error('Motion requires the scene feature');
    if(plan.features.some(row=>row.kind==='held.cosmetics')&&product.section('held/finishes').cosmetics===undefined)throw new Error('Cosmetic feature requires declared finishes');
    for (const row of plan.features) if (row.kind === 'world.baked') for (const baked of row.rows) {
      const files = [baked.glb, ...baked.lightmaps.flatMap(map => [map.source.phone, map.source.desktop]), ...(baked.instances === null ? [] : [baked.instances.table, baked.instances.protos, baked.instances.plan.phone.source, baked.instances.plan.desktop.source])];
      const looks = [baked.look, ...Object.values(baked.instances?.looks ?? {}).map(slot => slot.look)];
      if (files.some(file => 'file' in file && !product.hasFile(file.file)) || looks.some(look => product.shardfile.look.materials[look] === undefined)) throw new Error('Baked tiles require their admitted files and look');
    }
    for(const row of plan.features)if(row.kind==='world.water')for(const water of row.rows){if(!product.hasFile(water.geometry)||product.shardfile.look.materials[water.surface.look]===undefined||water.surface.floor!==undefined)throw new Error('Water requires declared geometry and look without floor textures');}
    for (const row of plan.features) if ((row.kind === 'state.adventure' || row.kind === 'world.meadow') && !product.hasFile(row.file)) throw new Error('World services require their admitted data files');
    for (const row of plan.features) if (row.kind === 'riding.session' && (!product.hasFile(row.file) || !plan.features.some(feature => feature.kind === 'population.wildlife'))) throw new Error('Riding requires its admitted session file and wildlife feature');
    for (const row of plan.features) if (row.kind === 'population.wildlife' && [row.file, row.crowd.json, row.crowd.binary].some(file => !product.hasFile(file))) throw new Error('Wildlife requires its admitted population and crowd files');
    if(plan.features.some(row=>row.kind==='audio.scene')&&product.shardfile.audio.scene===undefined)throw new Error('Audio scene requires its declared profile');
    if(plan.features.some(row=>row.kind==='world.dressing')){const rows=product.section('world/scenes').dressing;if(rows===undefined||!product.hasFile(rows.phone)||!product.hasFile(rows.desktop))throw new Error('Dressing requires both declared tier files');}
    if (plan.features.some(row => row.kind === 'weather.fields' && !product.shardfile.quests.quests.some(quest => quest.id === row.quest))) throw new Error('Weather fields require their declared quest');
    for(const row of plan.features)if(row.kind==='bag.finds'&&(!product.hasFile(row.file)||!product.shardfile.quests.quests.some(quest=>quest.id===row.quest)))throw new Error('Finds require their admitted file and quest');
    for (const row of plan.features) {
      const required = row.kind === 'content.catalogue' ? [
        ...(row.finishes || row.effects.includes('finishes') ? CLIENT_FEATURES[row.kind].sections : []),
        ...(row.economy === true ? ['economy/loot'] as const : []),
      ] : CLIENT_FEATURES[row.kind].sections;
      for (const name of required) {
        if (!product.has(name)) throw new Error(`Missing feature section ${name}`);
        product.section(name); // A listed stream section is not an admitted boot dependency.
      }
    }
    return { features: plan.features };
  } catch (error) { throw new ProductError(product.slug, 'client/plan', 'schema', error instanceof Error ? error.message : 'Invalid client plan'); }
}
/** Run a platform-ordered phase with bounded frame-budget pauses. Resident scene construction is cached by its host. */
export async function installClientPhase(ctx: ShardContext, plan: AdmittedClientPlan, phase: ClientPhase, resident: Scope, lifetime?: 'resident' | 'entered'): Promise<void> {
  const rows = plan.features.flatMap(row => {
    const feature = CLIENT_FEATURES[row.kind];
    if (lifetime !== undefined && feature.lifetime !== lifetime) return [];
    return [...(feature.phase === phase ? [{ row, rank: feature.rank, install: feature.install }] : []),
      ...(phase === 'play' && feature.play !== undefined ? [{ row, ...feature.play }] : [])];
  }).sort((a, b) => a.rank - b.rank || (a.row.kind === 'debug.expose' ? a.row.name : a.row.kind).localeCompare(b.row.kind === 'debug.expose' ? b.row.name : b.row.kind));
  // The platform's look phase precedes every entered world step, including
  // trusted runtimes whose data client intentionally skips presentation.
  if (phase === 'world' && lifetime !== 'resident' && rows.length > 0) {
    if (ctx.scope.disposed || resident.disposed) throw new Error('Client feature owner is disposed');
    const missing = Object.keys(ctx.product.shardfile.look.materials).filter(id => !hasLentLook(id));
    if (missing.length > 0) lendLooks(ctx.scope, await runtimeLookMaterials(ctx, ctx.product.shardfile, true, missing));
  }
  for (const { row, install } of rows) {
    if (ctx.scope.disposed || resident.disposed) throw new Error('Client feature owner is disposed');
    await install(ctx, row, resident);
    await buildYield(ctx.scope);
  }
}
