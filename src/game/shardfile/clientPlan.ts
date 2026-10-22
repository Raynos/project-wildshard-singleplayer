import { installClientAdventurePersistence } from '../quest/persistence';
import { timeClientPreparation } from './preparationTiming';
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
import { installHeldRangedFeel } from '../plugin/heldEquipment';
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

export type ClientPhase = 'world' | 'kit' | 'prepare-play' | 'play';
interface ClientFeature {
  readonly phase: ClientPhase;
  readonly rank: number;
  readonly lifetime: 'resident' | 'entered';
  readonly sections: readonly PlatformSectionName[];
  readonly install: (ctx: ShardContext, row: ClientFeatureRow, resident: Scope) => Promise<void> | void;
  readonly play?: { readonly rank: number; readonly install: ClientFeature['install'] };
  readonly preparePlay?: { readonly rank: number; readonly install: ClientFeature['install'] };
}
/** Compiled-in client-only registry. Adding a kind requires its strict format schema and a reviewed platform host. */
export const CLIENT_FEATURES: Readonly<Record<ClientFeatureKind, ClientFeature>> = {
  'content.catalogue': { phase: 'kit', rank: 15, lifetime: 'entered',
    // Item/quest/journal envelopes are root data; finishes are streamed separately.
    sections: ['held/finishes'], install: installClientCatalogue },
  'state.adventure': { phase: 'world', rank: 5, lifetime: 'entered', sections: [], install: installClientAdventurePersistence },
  'world.meadow': { phase: 'world', rank: 46, lifetime: 'entered', sections: [], install: installClientMeadow },
  'held.ranged-page': { phase: 'world', rank: 60, lifetime: 'entered', sections: ['held/finishes'],
    install: async (ctx, row) => {
      if (row.kind !== 'held.ranged-page') throw new Error('Invalid ranged page feature');
      const { prepareRangedPage } = await import('../loadout/rangedPage');
      await prepareRangedPage(ctx, await ctx.product.json(row.file));
    }, preparePlay: { rank: 10, install: async (ctx, row) => {
      if (row.kind !== 'held.ranged-page') throw new Error('Invalid ranged page feature');
      const { installEntryRangedPage } = await import('./clientQuestComposition');
      await installEntryRangedPage(ctx, row);
    } } },
  'world.bind-sets': { phase: 'play', rank: -10, lifetime: 'entered', sections: [], install: async (ctx, row) => {
    if (row.kind !== 'world.bind-sets') throw new Error('Invalid named-place binding feature');
    const { bindEnteredClientPlaceSets } = await import('./clientPlaceSets');
    await bindEnteredClientPlaceSets(ctx, row);
  } },
  'quest.continuation': { phase: 'play', rank: 0, lifetime: 'entered', sections: [], install: async (ctx, row) => {
    if (row.kind !== 'quest.continuation') throw new Error('Invalid quest continuation feature');
    const { installQuestContinuationFile } = await import('../quest/continuation');
    await installQuestContinuationFile(ctx, row.file);
  } },
  'quest.world': { phase: 'prepare-play', rank: 15, lifetime: 'entered', sections: [], install: async (ctx, row) => {
    if (row.kind !== 'quest.world') throw new Error('Invalid quest world feature');
    const { prepareQuestWorldEntry } = await import('./questWorld');
    await prepareQuestWorldEntry(ctx, row.file, row.ambient);
  } },
  'quest.reference': { phase: 'world', rank: 55, lifetime: 'entered', sections: [], install: async (ctx, row) => {
    if (row.kind !== 'quest.reference') throw new Error('Invalid quest reference feature');
    const { installEntryQuestReference } = await import('./clientQuestComposition');
    installEntryQuestReference(ctx, row.id);
  } },
  'quest.composition': { phase: 'prepare-play', rank: 20, lifetime: 'entered', sections: [], install: async (ctx, row) => {
    if (row.kind !== 'quest.composition') throw new Error('Invalid quest composition feature');
    const { installEntryQuestComposition } = await import('./clientQuestComposition');
    await installEntryQuestComposition(ctx, row);
  } },
  'quest.spawns': { phase: 'prepare-play', rank: 30, lifetime: 'entered', sections: [], install: async (ctx, row) => {
    if (row.kind !== 'quest.spawns') throw new Error('Invalid quest spawns feature');
    const { installDeclaredQuestSpawns } = await import('../quest/chapterDirector');
    const { publishEntryOwner } = await import('./entryOwners');
    const custom = (name: string): name is `custom/${string}` => name.startsWith('custom/');
    if (!custom(row.source)) throw new Error('Invalid quest spawn source');
    publishEntryOwner(ctx.scope, 'quest-spawns', row.id, await installDeclaredQuestSpawns(ctx, { ...row, source: row.source }));
  } },
  'held.claims.prepare': { phase: 'kit', rank: -30, lifetime: 'entered', sections: ['held/arms'], install: async (ctx, row) => {
    if (row.kind !== 'held.claims.prepare') throw new Error('Invalid claims preparation feature');
    const { prepareHeldClaimsEntry } = await import('./heldClaimsEntry');
    await prepareHeldClaimsEntry(ctx, row.id);
  } },
  'population.product-creatures': { phase: 'kit', rank: -20, lifetime: 'entered', sections: ['actors/species-programs'], install: async ctx => {
    const { installProductCreatures } = await import('../population/productCreatures');
    const { pageDecisionAuthority } = await import('./borrowedDecisions');
    const authority = await pageDecisionAuthority(ctx);
    if (ctx.scope.disposed || ctx.scope.disposing) throw new Error('Client feature owner is disposed');
    await installProductCreatures(ctx, authority);
  } },
  'held.claims.install': { phase: 'kit', rank: -10, lifetime: 'entered', sections: ['held/arms'], install: async (ctx, row) => {
    if (row.kind !== 'held.claims.install') throw new Error('Invalid claims installation feature');
    const { installHeldClaimsEntry } = await import('./heldClaimsEntry');
    installHeldClaimsEntry(ctx, row.claims);
  } },
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
  'held.ranged-feel': {phase:'play',rank:30,lifetime:'entered',sections:[],install:installHeldRangedFeel},
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
  'audio.cues': { phase: 'world', rank: 48, lifetime: 'entered', sections: ['world/scenes'],
    install: (ctx, row) => { if (row.kind === 'audio.cues' && row.stage === 'world') installClientCues(ctx, row); },
    play: { rank: 30, install: (ctx, row) => { if (row.kind === 'audio.cues' && row.stage !== 'world') installClientCues(ctx, row); } } },
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
    const prepare = plan.features.find(row => row.kind === 'held.claims.prepare'), install = plan.features.find(row => row.kind === 'held.claims.install');
    if ((prepare !== undefined || install !== undefined) && (prepare?.kind !== 'held.claims.prepare' || install?.kind !== 'held.claims.install' || prepare.id !== install.claims)) throw new Error('Held claims require one matching preparation and installation');
    if (plan.features.some(row => row.kind === 'population.product-creatures')) {
      if (!product.hasFile('actors/creature-install.json')) throw new Error('Product creatures require their admitted install rows');
      // Compatibility owners already live in the admitted product; they are not new client feature schemas.
      for (const name of ['economy/loot', 'look/hull-book'] as const) {
        if (!product.has(name)) throw new Error('Product creatures require their admitted legacy owners');
        product.section(name);
      }
    }
    for (const row of plan.features) if (row.kind === 'world.bind-sets') {
      if (!plan.features.some(feature => feature.kind === 'world.sets')) throw new Error('Named-place binding requires its declared sets');
      if (row.quest !== undefined && !plan.features.some(feature => feature.kind === 'quest.composition' && feature.id === row.quest)) throw new Error('Named-place binding requires its declared quest');
    }
    const sections = new Map(outputDescriptor(product.shardfile)?.sections);
    for (const name of ['world/scenes', 'actors/species-programs', 'sim/runtime-plan', 'sim/scripts', 'look/painted'] as const)
      if (product.has(name)) sections.set(name, product.section(name));
    sections.set('client/plan', plan);
    const errors = clientOwnershipRules(product.shardfile, sections); if (errors.length > 0) throw new Error(errors.join('; '));
    if (plan.features.some(row => row.kind === 'light.emitters') && !plan.features.some(row => row.kind === 'world.scenes')) throw new Error('Emitters require the scene feature');
    if (plan.features.some(row => row.kind === 'motion.channels') && !plan.features.some(row => row.kind === 'world.scenes')) throw new Error('Motion requires the scene feature');
    if(plan.features.some(row=>row.kind==='held.cosmetics')&&product.section('held/finishes').cosmetics===undefined)throw new Error('Cosmetic feature requires declared finishes');
    if(plan.features.some(row=>row.kind==='held.ranged-feel')&&!product.shardfile.items.rows.some(row=>row.kind==='weapon'&&row.equipment?.rangedFeel!==undefined))throw new Error('Ranged feel requires admitted equipment feedback rows');
    for (const row of plan.features) if (row.kind === 'world.baked') for (const baked of row.rows) {
      const files = [baked.glb, ...baked.lightmaps.flatMap(map => [map.source.phone, map.source.desktop]), ...(baked.instances === null ? [] : [baked.instances.table, baked.instances.protos, baked.instances.plan.phone.source, baked.instances.plan.desktop.source])];
      const looks = [baked.look, ...Object.values(baked.instances?.looks ?? {}).map(slot => slot.look)];
      if (files.some(file => 'file' in file && !product.hasFile(file.file)) || looks.some(look => product.shardfile.look.materials[look] === undefined)) throw new Error('Baked tiles require their admitted files and look');
    }
    for(const row of plan.features)if(row.kind==='world.water')for(const water of row.rows){
      if(product.shardfile.look.materials[water.surface.look]===undefined)throw new Error('Water requires its declared look');
      if('geometry' in water){if(!product.hasFile(water.geometry)||water.surface.floor!==undefined)throw new Error('Water requires declared geometry and look without floor textures');continue;}
      // O7: a drawn row's files are admitted product files or immutable assets; its floor, dry rects and foam fit its surface
      const draw=water.draw,files=[draw.grid.phone,draw.grid.desktop,...(draw.floor===undefined?[]:[draw.floor])];
      if(files.some(file=>'file' in file&&!product.hasFile(file.file)))throw new Error('Water requires its admitted draw files');
      if((water.surface.floor===undefined)!==(draw.floor===undefined)||(draw.foam.length>0&&draw.floor===undefined))throw new Error('Water floor and foam require a floored surface and its baked floor');
      if(draw.dry.length>(water.surface.dry?.slots??0))throw new Error('Water clips more dry rectangles than its surface has slots');
    }
    for (const row of plan.features) if (row.kind === 'held.ranged-page' && !product.hasFile(row.file)) throw new Error('Ranged page requires its admitted data file');
    for (const row of plan.features) if ((row.kind === 'state.adventure' || row.kind === 'world.meadow') && !product.hasFile(row.file)) throw new Error('World services require their admitted data files');
    for (const row of plan.features) if (row.kind === 'riding.session' && (!product.hasFile(row.file) || !plan.features.some(feature => feature.kind === 'population.wildlife'))) throw new Error('Riding requires its admitted session file and wildlife feature');
    for (const row of plan.features) if (row.kind === 'population.wildlife' && [row.file, row.crowd.json, row.crowd.binary].some(file => !product.hasFile(file))) throw new Error('Wildlife requires its admitted population and crowd files');
    if(plan.features.some(row=>row.kind==='audio.scene')&&product.shardfile.audio.scene===undefined)throw new Error('Audio scene requires its declared profile');
    if(plan.features.some(row=>row.kind==='world.dressing')){const rows=product.section('world/scenes').dressing;if(rows===undefined||!product.hasFile(rows.phone)||!product.hasFile(rows.desktop))throw new Error('Dressing requires both declared tier files');}
    if (plan.features.some(row => row.kind === 'weather.fields' && !product.shardfile.quests.quests.some(quest => quest.id === row.quest))) throw new Error('Weather fields require their declared quest');
    for(const row of plan.features)if(row.kind==='bag.finds'&&(!product.hasFile(row.file)||!product.shardfile.quests.quests.some(quest=>quest.id===row.quest)))throw new Error('Finds require their admitted file and quest');
    for (const row of plan.features) {
      if (row.kind === 'quest.continuation' && !product.hasFile(row.file)) throw new Error('Quest continuation requires its admitted data file');
      if ((row.kind === 'quest.world' || row.kind === 'quest.composition' || row.kind === 'held.ranged-page') && !product.hasFile(row.file)) throw new Error('Entry preparation requires its admitted data file');
      if (row.kind === 'quest.composition') {
        if (row.figures !== undefined && [row.figures.file, 'people/catalogue.json', 'models/world-scenes.json'].some(file => !product.hasFile(file))) throw new Error('Quest figures require their admitted data and catalogues');
        if (row.reference !== undefined && !plan.features.some(feature => feature.kind === 'quest.reference' && feature.id === row.reference)) throw new Error('Quest composition requires its declared reference');
      }
      if (row.kind === 'quest.reference' && !plan.features.some(feature => feature.kind === 'quest.composition' && feature.reference === row.id)) throw new Error('Quest reference requires its declared composition');
      if (row.kind === 'quest.spawns') {
        const custom = (name: string): name is `custom/${string}` => name.startsWith('custom/');
        if (!custom(row.source)) throw new Error('Invalid quest spawn source');
        if (!product.has(row.source)) throw new Error('Quest spawns require their admitted source section');
        product.section(row.source);
        if (!plan.features.some(owner => owner.kind === 'quest.composition' && owner.id === row.quest && owner.equipment?.animals === row.animals && owner.equipment.sounds === row.sounds)) throw new Error('Quest spawns require their declared composition owners');
      }
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
      ...(phase === 'play' && feature.play !== undefined ? [{ row, ...feature.play }] : []),
      ...(phase === 'prepare-play' && feature.preparePlay !== undefined ? [{ row, ...feature.preparePlay }] : [])];
  }).sort((a, b) => a.rank - b.rank || (a.row.kind === 'debug.expose' ? a.row.name : a.row.kind).localeCompare(b.row.kind === 'debug.expose' ? b.row.name : b.row.kind));
  // The platform's look phase precedes every entered world step, including
  // trusted runtimes whose data client intentionally skips presentation.
  if (phase === 'world' && lifetime !== 'resident' && rows.length > 0) {
    if (ctx.scope.disposed || ctx.scope.disposing || resident.disposed || resident.disposing) throw new Error('Client feature owner is disposed');
    const missing = Object.keys(ctx.product.shardfile.look.materials).filter(id => !hasLentLook(id));
    if (missing.length > 0) await timeClientPreparation(ctx.product.slug, 'world.looks', async () => {
      lendLooks(ctx.scope, await runtimeLookMaterials(ctx, ctx.product.shardfile, true, missing));
    });
  }
  for (const { row, install } of rows) {
    if (ctx.scope.disposed || ctx.scope.disposing || resident.disposed || resident.disposing) throw new Error('Client feature owner is disposed');
    await timeClientPreparation(ctx.product.slug, `${phase}.${row.kind}`, () => install(ctx, row, resident));
    await buildYield(ctx.scope);
  }
}
