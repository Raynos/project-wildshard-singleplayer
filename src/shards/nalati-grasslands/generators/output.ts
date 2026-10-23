import { nalatiPhysicsSources } from './physics';
import { nalatiPopulationMetadataBlob } from './populationMetadata';
import { NALATI_SCRIPT_SECTIONS } from './scriptInventory';
import worldUpdates from '../data/worldUpdates.json' with {type:'json'};
import combatTargets from '../data/combatTargets.json' with {type:'json'};
import { MountedSpecimenSeatSchema } from '@wildshard/format/mountedSpecimenRows';
import { SpeciesActorsFileSchema } from '@wildshard/format/speciesBookRows';
import { PackedCreatureLooksSchema } from '@wildshard/format/speciesLooks';
import { wireProgram } from './returnProgramRows';
import practiceCard from '../data/practiceCard.json' with { type: 'json' };
import { NALATI_RIDING_SESSION } from './clientRiding';
import { MOUNTED_FIGURE } from './mountedFigure';
import { CAIRN, EAGLE_ROCK } from './layout';
import crowdProjection from '../data/crowdProjection.json' with {type:'json'};
import crowdNativeProjection from '../data/crowdNativeProjection.json' with {type:'json'};
import crowdView from '../data/crowdView.json' with { type: 'json' };
import { buildEliteEntryPageRows } from './eliteEntryRows';
import strikes from '../data/strikeProfiles.generated.json' with { type: 'json' };
import { strike } from '@wildshard/sdk/species';
import finds from '../data/finds.generated.json' with {type:'json'};
import { coverSpecimenBlobs } from './coverSpecimens';
import { TREE_SET } from './treeSet';
import { DRESSING_CONTACT_SOURCES, DRESSING_SPECIMEN_SOURCES, dressingSceneBlobs } from './dressingScene';
import * as v from 'valibot';
import { carriedQuestRows } from './carriedQuest';
import { CarriedQuestSchema } from '@wildshard/format/questSteps';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import bowPage from '../../../../public/assets/nalati/baked/recurve-pool.json' with {type:'json'};
import { HeldBowFileSchema, HeldFirearmPageSchema } from '@wildshard/format/weaponProfiles';
import { ArenaScriptFightFileSchema,ArenaScriptGeometrySchema } from '@wildshard/format/arenaScriptRows';
import { TimedEncountersSchema,CloudSpecimenSchema } from '@wildshard/format/encounterRows';
import strings from '../data/strings.json' with {type:'json'};
import nativeRide from '../data/nativeRiding.json' with { type: 'json' };
import skinFinishes from '../data/skinFinishes.json' with { type: 'json' };
import { nalatiDressingBlob } from './dressingSchemas';
import { packDressingTable } from './dressingTable';
import night from '../data/night.generated.json' with {type:'json'};
import ridingPrograms from '../behaviour/riding.generated.json' with { type: 'json' };
import kingData from '../data/goldenKing.generated.json' with { type: 'json' };
import heldWeapons from '../data/heldWeapons.generated.json' with {type:'json'};
import stealth from '../data/stealth.generated.json' with {type:'json'};
import arenaRoom from '../data/bossArenaRoom.json' with { type: 'json' };
import arenaView from '../data/kurganView.json' with { type: 'json' };
import arenaFire from '../data/arenaFire.json' with { type: 'json' };
import { horseCourseRows } from './courseScene';
import { RidingPracticeSchema } from '@wildshard/format/practiceCourseRows';
import speciesData from '../data/species.generated.json' with { type: 'json' };
import weatherDecision from '../behaviour/weather.generated.json' with { type: 'json' };
import weatherPresentation from '../data/weatherChannels.generated.json' with { type: 'json' };
import pasture from '../behaviour/pasture.generated.json' with { type: 'json' };
import charge from '../data/eliteCharge.generated.json' with {type:'json'};
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import admissionInput from '../behaviour/admission.generated.json' with {type:'json'};
import titanProgram from '../behaviour/titan.generated.json' with {type:'json'};
import { NALATI_PLACE_SETS } from './placeSets';
import terrainScene from '../data/terrainScene.json' with { type: 'json' };
import oliveColour from '../data/oliveColour.json' with { type: 'json' };
import { EXPLORER_CATALOGUE } from './explorerCatalogue';
import rifle from '../data/rifle.generated.json' with { type: 'json' };
import { NALATI_HULL_BOOK } from './riggedHulls';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import chapterStory from '../data/chapterStory.json' with { type: 'json' };
import { parseChapterStoryPresentation } from '@wildshard/format/questStory';
import tamingPoses from '../data/tamingPoses.generated.json' with { type: 'json' };
import spear from '../data/spear.generated.json' with { type: 'json' };
import { headlessAssembly } from './nativeGroups';
import headlessBoot from '../data/headlessBoot.json' with { type: 'json' };
import titanFight from '../data/stormTitanFight.generated.json' with { type: 'json' };
import titanGeometry from '../data/stormTitanGeometry.generated.json' with { type: 'json' };
import sabre from '../data/sabre.generated.json' with { type: 'json' };
import persistence from '../data/persistence.generated.json' with {type:'json'};
import dressboulder from '../data/dressing-boulder.generated.json' with {type:'json'};
import dressslab from '../data/dressing-slab.generated.json' with {type:'json'};
import dressstone from '../data/dressing-stone.generated.json' with {type:'json'};
import dressjuniper from '../data/dressing-juniper.generated.json' with {type:'json'};
import dressrose from '../data/dressing-rose.generated.json' with {type:'json'};
import dresswillow from '../data/dressing-willow.generated.json' with {type:'json'};
import dresslupin from '../data/dressing-lupin.generated.json' with {type:'json'};
import dressdaisy from '../data/dressing-daisy.generated.json' with {type:'json'};
import dressreed from '../data/dressing-reed.generated.json' with {type:'json'};
import dresslogs from '../data/dressing-logs.generated.json' with {type:'json'};
import dressstumps from '../data/dressing-stumps.generated.json' with {type:'json'};
import dressovoos from '../data/dressing-ovoos.generated.json' with {type:'json'};
import dresspoles from '../data/dressing-poles.generated.json' with {type:'json'};
import dressfences from '../data/dressing-fences.generated.json' with {type:'json'};
import dressgates from '../data/dressing-gates.generated.json' with {type:'json'};
import dressdrifts from '../data/dressing-drifts.generated.json' with {type:'json'};
import dresscolliders from '../data/dressing-colliders.generated.json' with {type:'json'};
import dressclutter from '../data/dressing-clutter.generated.json' with {type:'json'};
import { bakeSheepBody } from './sheepBody';
import questContent from '../data/questContent.json' with {type:'json'};
import kokpar from '../data/kokpar.generated.json' with {type:'json'};
import chapterView from '../data/chapterView.json' with { type: 'json' };
import peopleFrames from '../data/peopleFrames.generated.json' with { type: 'json' };
import { ChapterViewSchema } from '@wildshard/format/questPageComposition';
import namePanel from '../data/namePanel.json' with {type:'json'};
import { parsePanelDefinition } from '@wildshard/format/panelTemplate';
import weather from '../data/weather.json' with {type:'json'};
import water from '../data/water.generated.json' with {type:'json'};
import { parseWeatherProgram } from '@wildshard/format/weatherProgram';
import { ForestWeatherSchema } from '@wildshard/format/forestWeather';
import { NALATI_WEATHER_PAGE } from './weatherPage';
import { nameBlob, emitNamedBlobs } from '@wildshard/sdk/blobs';
import { SCRIPT_V2_REVISIONS } from '@wildshard/format/scriptAdmissionV2';
import creatureViewBytes from '../behaviour/creatureViews.generated.json' with { type: 'json' };
import { nalatiCreatureViews } from './creatureViews';
import eliteViewBytes from '../behaviour/eliteViews.generated.json' with { type: 'json' };
import { nalatiEliteViews } from './eliteViews';
import titanViewBytes from '../behaviour/titanView.generated.json' with { type: 'json' };
import { nalatiTitanView } from './titanView';
import titanFireViewBytes from '../behaviour/titanFireView.generated.json' with { type: 'json' };
import { nalatiTitanFireView } from './titanFireView';
import titanWhirlsViewBytes from '../behaviour/titanWhirlsView.generated.json' with { type: 'json' };
import { nalatiTitanWhirlsView } from './titanWhirlsView';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import worldTrophies from '../data/worldTrophies.json' with { type: 'json' };
import { FixedDrawRowsSchema } from '@wildshard/format/fixedDraws';
import shapeBook from '../data/shapeBook.generated.json' with { type: 'json' };
import { postChainRows } from './postChain';
import { PANO_RIDGE_V } from './panoramaData';
import paintedTextures from '../data/paintedTextures.generated.json' with { type: 'json' };
import specimenRows from '../data/specimens.generated.json' with { type: 'json' };
import captureRows from '../data/staticCapture.generated.json' with { type: 'json' };
import grassRows from '../data/grass.generated.json' with { type: 'json' };
import geographyRows from '../data/geographySources.json' with {type:'json'};

const {compiled:ridingCompiled,...ridingWire}=ridingPrograms;
const {polearm:_polearm,blade:_blade,programs:_programs,program:_program,compiled:_compiled,...weaponPower}=heldWeapons;
const sheepBody = bakeSheepBody();
// Resolve author-only lair definitions into the admitted assembly, never runtime imports.
const {pageWildlife:_pageWildlife,pageGroups:_pageGroups,groupAdmission:_groupAdmission,...nativeConstants}=headlessAssembly.constants;
const eliteAssembly = { ...headlessAssembly, constants: { ...nativeConstants, pageElites: buildEliteEntryPageRows(), trophies: worldTrophies, eliteDefs: Object.fromEntries(Object.entries(ecology.elites).filter(([id]) => ['aqbars', 'kokbori', 'argymaq'].includes(id)).map(([id, def]) => [id, {
  id: def.id, lair: def.lair, awareR: def.awareR, engageR: def.engageR, leashR: def.leashR, rule: def.rule, respawnMin: def.respawnMin,
}])), nativePopulation: {...ridingPrograms.population,driver:{...ridingPrograms.population.driver,projection:crowdNativeProjection}}, nativeRide: { ...nativeRide, speeds: ecology.modes.ride[0].gaits, roads: headlessBoot.roads } } };

/** Author weather once; page and native owners consume the same admitted numeric program. */
const dressing = { boulder: dressboulder, slab: dressslab, stone: dressstone, juniper: dressjuniper, rose: dressrose, willow: dresswillow, lupin: dresslupin, daisy: dressdaisy, reed: dressreed, logs: dresslogs, stumps: dressstumps, ovoos: dressovoos, poles: dresspoles, fences: dressfences, gates: dressgates, drifts: dressdrifts, colliders: dresscolliders, clutter: dressclutter };
const cloudSpecimen = { name: 'storm-titan', pose: { rise: 1, bend: 0, kneel: 0, raise: .2, castL: 0, stride: 0, heartOpen: 0 }, ports: { place: { ...titanFight.TITAN_ARENA.titan, ground: { heightAt: [CAIRN.x, CAIRN.z] } } }, ...Object.fromEntries(['phone', 'desktop'].map(tier => [tier, { ...titanGeometry.body, geometry: { ...titanGeometry.body.geometry, eyes: titanGeometry.eyes }, poses: titanGeometry.poses, puffs: { ...titanGeometry.body.puffs, rows: (tier === 'phone' ? titanGeometry.phone : titanGeometry.desktop).puffs } }])) };
const { cues: nightCues, ...nightRows } = night;
// G613: the whole look as one row (game/looks/postGraphLook over its painted world, the manifest's render): the grade's
// post graph, then the painted world's fog, air, ground, grass and the panorama / key light / capture world rows
const lookRows = postChainRows(), painted = paintedTextures;
const postLook = { ...lookRows.postGraph, painted: { fog: { ...painted.fog, ...lookRows.paintedFog, lut: lookRows.fogLut }, air: painted.air,
  ground: 'ground' in painted ? painted.ground : null, tiles: specimenRows.materials, capture: captureRows, grass: { rows: grassRows, cards: painted.cards },
  world: { rows: 'world' in painted ? painted.world : null, panorama: 'panorama' in painted ? painted.panorama : null, key: 'key' in painted ? painted.key : null,
    ridge: PANO_RIDGE_V, ...lookRows.world } } };
// the shape book (carvings, trophies, arena parts, ghost riders, painted places): its fixed draws, read by the world
const chapterContent = { figures: peopleFrames, npcs: questContent.npcs, places: questContent.places, program: kokpar.program, view: chapterView };
v.parse(ChapterViewSchema, chapterContent);
const {compiled:admissionCompiled,...admission}=admissionInput;
const emitted=emitNamedBlobs([nalatiPopulationMetadataBlob(),nameBlob('models/shape-book.json','json',new TextEncoder().encode(encodeCanonicalJson(shapeBook.draws)),{jsonSchema:namedJsonSchema(FixedDrawRowsSchema)}),nameBlob('look/post.json','json',new TextEncoder().encode(encodeCanonicalJson(postLook))),nameBlob('world/meadow.json','json',new TextEncoder().encode(encodeCanonicalJson(headlessAssembly.constants.nativeField))),nameBlob('riding/session.json','json',new TextEncoder().encode(encodeCanonicalJson(NALATI_RIDING_SESSION))),nameBlob('actors/wildlife.json','json',new TextEncoder().encode(encodeCanonicalJson(headlessAssembly.constants.pageWildlife))),nameBlob('riding/mounted-figure.json','json',new TextEncoder().encode(encodeCanonicalJson(MOUNTED_FIGURE)),{jsonSchema:namedJsonSchema(MountedSpecimenSeatSchema)}),nameBlob('models/cloud-specimen.json','json',new TextEncoder().encode(encodeCanonicalJson(cloudSpecimen)),{jsonSchema:namedJsonSchema(CloudSpecimenSchema)}),nameBlob('combat/timed-encounters.json','json',new TextEncoder().encode(encodeCanonicalJson({...nightRows,presentation:'night',program:{script:weatherDecision.script,bytes:weatherDecision.bytes},contact:{strike: strike(strikes.arrow),tags:['creature.ghost-rider','feel.blow','cover.checked'],origin:'player'}})),{jsonSchema:namedJsonSchema(TimedEncountersSchema)}),nameBlob('quests/finds.json','json',new TextEncoder().encode(encodeCanonicalJson(finds))),...coverSpecimenBlobs(),nameBlob('quests/carried.json','json',new TextEncoder().encode(encodeCanonicalJson(carriedQuestRows)),{jsonSchema:namedJsonSchema(CarriedQuestSchema)}),...dressingSceneBlobs(),nameBlob('world/weather-fx.json','json',new TextEncoder().encode(encodeCanonicalJson({...weatherPresentation.presentation,sky:weatherPresentation.sky}))),nameBlob('weapons/bow-page.json','json',new TextEncoder().encode(`${JSON.stringify(bowPage)}\n`),{jsonSchema:namedJsonSchema(HeldBowFileSchema)}),nameBlob('weapons/rifle-page.json','json',new TextEncoder().encode(encodeCanonicalJson(rifle)),{jsonSchema:namedJsonSchema(HeldFirearmPageSchema)}),nameBlob('weapons/rifle-model.json', 'json', new TextEncoder().encode(encodeCanonicalJson(rifle.rows))),nameBlob('quests/chapters.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseChapterStoryPresentation(chapterStory)))),nameBlob('weapons/spear.json','json',new TextEncoder().encode(encodeCanonicalJson({...spear,program:heldWeapons.programs.polearm,presentation:heldWeapons.polearm}))),nameBlob('sim/headless-assembly.json','json',new TextEncoder().encode(encodeCanonicalJson(eliteAssembly))),nameBlob('sim/headless-boot.json','json',new TextEncoder().encode(encodeCanonicalJson({ ...headlessBoot, worldUpdates, combatTargets, hunt: { ...ecology.gameplay, ...ecology.species, sheepdog: { aggressive: false, walkSpeed: 1.4 }, [ecology.argymaq]: ecology.gameplay.horse }, admission, pasture, riding: ridingWire }))),nameBlob('combat/titan-fight.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ arenaScript: titanFight.TITAN_HOST, king: kingData, programs: {attack:wireProgram(titanProgram.attack),wind:wireProgram(titanProgram.wind)}, arenaRoom: { ...arenaRoom, view: arenaView }, arenaFire })),{jsonSchema:namedJsonSchema(ArenaScriptFightFileSchema)}),nameBlob('combat/titan-geometry.json', 'json', new TextEncoder().encode(encodeCanonicalJson(titanGeometry)),{jsonSchema:namedJsonSchema(ArenaScriptGeometrySchema)}),nameBlob('weapons/sabre.json','json',new TextEncoder().encode(encodeCanonicalJson({...sabre,program:heldWeapons.programs.blade,power:{...weaponPower,program:heldWeapons.programs.power},parts:heldWeapons.blade}))),nameBlob('quests/persistence.json','json',new TextEncoder().encode(encodeCanonicalJson(persistence))),...Object.entries(dressing).map(([key, rows]) => key === 'stone' || key === 'daisy' ? nameBlob(`world/dressing-${key}.bin`, 'bin', packDressingTable(rows)) : nalatiDressingBlob(`world/dressing-${key}.json`, 'json', new TextEncoder().encode(encodeCanonicalJson(rows)))),nameBlob('actors/balbal-cracks.bin', 'bin', Uint8Array.from(speciesData.crackBytes)),nameBlob('actors/sheep.bin', 'bin', sheepBody.bytes),nameBlob('actors/species-looks.json','json',new TextEncoder().encode(encodeCanonicalJson(v.parse(PackedCreatureLooksSchema,speciesData.looks))),{jsonSchema:namedJsonSchema(PackedCreatureLooksSchema)}),nameBlob('actors/sheep.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ page: { world: { guard: {projection:crowdProjection}, slug: 'nalati-grasslands', hull: 'sheep', bounds: [-250, 250, -250, 250], rows: ecology.flocks.world, view: crowdView, material: { rim: .8, bands: .85 } }, specimen: { slug: 'nalati-grasslands', hull: 'sheep', bounds: [-250, 250, -250, 250], rows: ecology.flocks.specimen, view: crowdView, material: { rim: .8, bands: .85 } } }, species: speciesData.presentation, draws:[{slot:'actors/sheep.bin',file:'actors/sheep.bin',channels:[],baked:{...sheepBody.row,expand:false}}], pivots: sheepBody.pivots, parts: sheepBody.parts, radius: sheepBody.radius })),{jsonSchema:namedJsonSchema(SpeciesActorsFileSchema)}),nameBlob('quests/content.json','json',new TextEncoder().encode(encodeCanonicalJson(chapterContent)),{jsonSchema:namedJsonSchema(ChapterViewSchema)}),nameBlob('quests/panels.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ name: parsePanelDefinition(namePanel) }))),nameBlob('world/forest-weather.json','json',new TextEncoder().encode(encodeCanonicalJson(v.parse(ForestWeatherSchema,NALATI_WEATHER_PAGE)))),nameBlob('world/weather.json','json',new TextEncoder().encode(encodeCanonicalJson({weather:parseWeatherProgram(weather),reactions:weatherDecision}))),nameBlob('world/water.json','json',new TextEncoder().encode(encodeCanonicalJson({ surface: water.surface, terrain: terrainScene, placeSets: NALATI_PLACE_SETS, practice: horseCourseRows() })),{jsonSchema:namedJsonSchema(v.looseObject({practice:RidingPracticeSchema}))})]);
const taming = emitNamedBlobs([nameBlob('ride/rules.json','json',new TextEncoder().encode(encodeCanonicalJson(ridingWire))),nameBlob('sim/taming-poses.json', 'json', new TextEncoder().encode(encodeCanonicalJson(tamingPoses)))]);
const creatureViews = nameBlob('views/nalati.creature-views.wasm', 'wasm', Uint8Array.from(atob(creatureViewBytes.bytes), byte => byte.codePointAt(0) ?? 0),
  { critical: true, script: { abi: 2, lane: 'view', pages: 1, ioBytes: creatureViewBytes.ioBytes, compilerRevision: SCRIPT_V2_REVISIONS.compiler, admissionRevision: SCRIPT_V2_REVISIONS.admission } });
const eliteViews = nameBlob('views/nalati.elite-views.wasm', 'wasm', Uint8Array.from(atob(eliteViewBytes.bytes), byte => byte.codePointAt(0) ?? 0),
  { critical: true, script: { abi: 2, lane: 'view', pages: 1, ioBytes: eliteViewBytes.ioBytes, compilerRevision: SCRIPT_V2_REVISIONS.compiler, admissionRevision: SCRIPT_V2_REVISIONS.admission } });
const titanView = nameBlob('views/nalati.titan-view.wasm', 'wasm', Uint8Array.from(atob(titanViewBytes.bytes), byte => byte.codePointAt(0) ?? 0),
  { critical: true, script: { abi: 2, lane: 'view', pages: 1, ioBytes: titanViewBytes.ioBytes, compilerRevision: SCRIPT_V2_REVISIONS.compiler, admissionRevision: SCRIPT_V2_REVISIONS.admission } });
const titanFireView = nameBlob('views/nalati.titan-fire-view.wasm', 'wasm', Uint8Array.from(atob(titanFireViewBytes.bytes), byte => byte.codePointAt(0) ?? 0),
  { critical: true, script: { abi: 2, lane: 'view', pages: titanFireViewBytes.pages, ioBytes: titanFireViewBytes.ioBytes, compilerRevision: SCRIPT_V2_REVISIONS.compiler, admissionRevision: SCRIPT_V2_REVISIONS.admission } });
const titanWhirlsView = nameBlob('views/nalati.titan-whirls-view.wasm', 'wasm', Uint8Array.from(atob(titanWhirlsViewBytes.bytes), byte => byte.codePointAt(0) ?? 0),
  { critical: true, script: { abi: 2, lane: 'view', pages: titanWhirlsViewBytes.pages, ioBytes: titanWhirlsViewBytes.ioBytes, compilerRevision: SCRIPT_V2_REVISIONS.compiler, admissionRevision: SCRIPT_V2_REVISIONS.admission } });
const creatureViewModule = emitNamedBlobs([creatureViews, eliteViews, titanView, titanFireView, titanWhirlsView]);
const kokparModule = emitNamedBlobs([nameBlob('behaviour/nalati.kokpar.wasm', 'wasm', Uint8Array.from(atob(kokpar.program.bytes), byte => byte.codePointAt(0) ?? 0), { critical: true, script: { abi: 1, pages: 1 } })]);
const admissionModule={name:'behaviour/nalati.admission.wasm',kind:'wasm' as const,source:admissionCompiled.source,options:{critical:true,script:{abi:2 as const,lane:'project' as const,pages:admission.v2.artifact.pages,ioBytes:admission.v2.artifact.ioBytes,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission}}};
const weatherModule = emitNamedBlobs([nameBlob('behaviour/nalati.weather.wasm', 'wasm', Uint8Array.from(atob(weatherDecision.bytes), byte => byte.codePointAt(0) ?? 0), { critical: true, script: { abi: 1, pages: 1 } })]);
// ABI1 witnesses are raw data dependencies, not additional executable modules.
const titanWitnesses=['titan','pasture'].map(name=>({name:`behaviour/${name}-witness.bin`,kind:'bin' as const,source:`behaviour/${name}-witness.generated.bin`}));
const titanV2Module = {name:'behaviour/nalati.titan.attack.v2.wasm',kind:'wasm' as const,source:titanProgram.compiled.attack.source,options:{dependencies:[titanProgram.attack.script.module.slice('blobs/wasm/'.length,-'.wasm'.length)],critical:true,script:{abi:2 as const,lane:'project' as const,pages:titanProgram.attack.v2.artifact.pages,ioBytes:titanProgram.attack.v2.artifact.ioBytes,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission}}};
const ridingProjection=ridingPrograms.approach.v2;
const ridingWitness={name:'behaviour/riding-witness.bin',kind:'bin' as const,source:'behaviour/riding-witness.generated.bin'};
const ridingModule={name:'behaviour/nalati.mounts.wasm',kind:'wasm' as const,source:ridingCompiled.source,options:{dependencies:[ridingPrograms.approach.script.module.slice('blobs/wasm/'.length,-'.wasm'.length)],critical:true,script:{abi:2 as const,lane:'project' as const,pages:ridingProjection.artifact.pages,ioBytes:ridingProjection.artifact.ioBytes,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission}}};
const pastureProjection=pasture.v2;
const pastureModule = {name:'behaviour/nalati.pasture.wasm',kind:'wasm' as const,source:titanProgram.compiled.pasture.source,options:{dependencies:[titanProgram.wind.script.module.slice('blobs/wasm/'.length,-'.wasm'.length)],critical:true,script:{abi:2 as const,lane:'project' as const,pages:pastureProjection.artifact.pages,ioBytes:pastureProjection.artifact.ioBytes,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission}}};
const chargeModule = emitNamedBlobs([nameBlob('behaviour/nalati.qara-charge.wasm', 'wasm', Uint8Array.from(atob(charge.bytes), byte => byte.codePointAt(0) ?? 0), { critical: true, script: { abi: 1, pages: 1 } })]);
const heldProjection = heldWeapons.program.v2;
const heldWitness={name:'behaviour/held-witness.bin',kind:'bin' as const,source:'behaviour/held-witness.generated.bin'};
const heldModule = {name:'behaviour/nalati.held-weapons.wasm',kind:'wasm' as const,source:heldWeapons.compiled.source,
  options:{dependencies:[heldWeapons.program.script.module.slice('blobs/wasm/'.length,-'.wasm'.length)],critical:true,script:{abi:2 as const,lane:'project' as const,pages:heldProjection.artifact.pages,ioBytes:heldProjection.artifact.ioBytes,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission}}};
const geographySources=v.parse(v.array(v.object({name:v.string(),kind:v.literal('bin'),source:v.string(),options:v.object({decoded:v.pipe(v.number(),v.integer(),v.minValue(0))})})),geographyRows);
const grassSources = v.parse(v.array(v.object({name:v.string(),kind:v.literal('bin'),source:v.string(),options:v.object({decoded:v.pipe(v.number(),v.integer(),v.minValue(0))})})),grassRows.sources);
const shapeSources = v.parse(v.array(v.object({name:v.string(),kind:v.literal('bin'),source:v.string()})),shapeBook.sources);
// N1b: the far ground's 16 L1 squares, two to a GLB (generators/bake-render-tiles.mjs): named files the painted ground reads
// beyond the 5 x 5 (game/looks/painterlyLook), not tile rows, so they spend none of the envelope's JSON node budget
const NALATI_L1_PAIRS=[0,1,2,3].flatMap(z=>[0,1].map(x=>({name:`world/terrain/ground-l1-${String(x)}-${String(z)}.glb`,kind:'glb' as const,source:`assets/world-terrain/ground-l1-${String(x)}-${String(z)}.generated.glb`})));
export const output={blobs:[...nalatiPhysicsSources(),...geographySources,...DRESSING_CONTACT_SOURCES,...DRESSING_SPECIMEN_SOURCES,...grassSources,...shapeSources,...titanWitnesses,titanV2Module,pastureModule,heldWitness,heldModule,ridingWitness,ridingModule,admissionModule,{name:"practice/card.webp",kind:"image",source:"explore/playground-horse.webp"},{"name":"world/terrain/ground.glb","kind":"glb","source":"assets/world-terrain/ground.generated.glb"},{"name":"world/terrain/slab.glb","kind":"glb","source":"assets/world-terrain/slab.generated.glb"},...NALATI_L1_PAIRS,{"name":"world/water.glb","kind":"glb","source":"assets/world-terrain/water.generated.glb"}],platform:emitPlatformSections(new Map<PlatformDataSectionName, unknown>([['world/trees',TREE_SET],['world/scenes',{version:1,libraries:[],materials:[],steps:[],dressing:{phone:'world/dressing-phone.json',desktop:'world/dressing-desktop.json'}}],['ui/strings',strings],['client/plan',{version:1,features:[practiceCard,{kind:'view.program',id:'creature-views',rows:nalatiCreatureViews(),module:'views/nalati.creature-views.wasm'},{kind:'view.program',id:'elite-views',rows:nalatiEliteViews(ecology.externalElites.map(row=>row.def.id)),module:'views/nalati.elite-views.wasm'},{kind:'view.program',id:'titan-view',rows:nalatiTitanView(),module:'views/nalati.titan-view.wasm'},{kind:'view.program',id:'titan-fire-view',rows:nalatiTitanFireView(),module:'views/nalati.titan-fire-view.wasm'},{kind:'view.program',id:'titan-whirls-view',rows:nalatiTitanWhirlsView(),module:'views/nalati.titan-whirls-view.wasm'},{kind:'audio.cues',id:'night',stage:'world',clock:'owner',rows:nightCues},{kind:'world.scenes'},{kind:'state.adventure',file:'quests/persistence.json',id:'progress'},{kind:'world.meadow',file:'world/meadow.json'},{kind:'weather.forest',file:'world/forest-weather.json',owner:'nalati.weather'},{kind:'held.claims.install',claims:'nalati.arsenal',preparation:'world'},{kind:'taming.entry',riding:'nalati.riding',publish:'riding',object:'ride'},{kind:'arena-room.entry',owner:'nalati.titan',claims:'nalati.arsenal',reward:'naizagai',publish:'fight',equipment:'held-finishes'},{kind:'arena-room.entry',owner:'nalati.king',claims:'nalati.arsenal',reward:'goldenBow',publish:'arena'},{kind:'elite.entry',owner:'nalati.elites',adventure:'progress',body:'animals',rock:EAGLE_ROCK,taming:'riding'},{kind:'quest.chapter-view',chapterView:'quests/content.json',story:'quests/chapters.json',arena:'arena',fight:'fight',taming:'riding'},{kind:'world.paths',rows:{id:'paths',name:'Paths'}},{kind:'world.dressing'},{kind:'population.wildlife',file:'actors/wildlife.json',crowd:{json:'actors/sheep.json',binary:'actors/sheep.bin'},navSteer:true,frame:{id:'shard.nalati.wildlife',after:['shard.nalati.boss'],before:['engine.creatures.update']}},{kind:'strings.register'},{kind:'world.sets',rows:NALATI_PLACE_SETS},{kind:'look.painterly',shadeTint:[.1,.16,.36],rimColor:[1.5,1.28,.95],wind:{x:1,z:.35,strength:1}},{kind:'audio.scene'},{kind:'world.water',rows:[{id:'river',surface:water.surface,geometry:'world/water.glb'}]},{kind:'riding.session',file:'riding/session.json',owner:'nalati.riding'},{kind:'held.cosmetics'},{kind:'held.ranged-feel'},{kind:'bag.finds',id:'nalati.finds',quest:'tulpar',file:'quests/finds.json'},{kind:'content.catalogue',quests:true,finishes:false,weapons:[],ammunition:[],effects:[],compendiums:[],encounters:[]}]}],['held/finishes',{order:[],rows:{},cards:[],extras:{},cosmetics:skinFinishes}],...NALATI_SCRIPT_SECTIONS,['player/stealth',stealth],['view/modules',[{id:'nalati.creature-views',module:creatureViews.file.path,side:'view',...creatureViews.script},{id:'nalati.elite-views',module:eliteViews.file.path,side:'view',...eliteViews.script},{id:'nalati.titan-view',module:titanView.file.path,side:'view',...titanView.script},{id:'nalati.titan-fire-view',module:titanFireView.file.path,side:'view',...titanFireView.script},{id:'nalati.titan-whirls-view',module:titanWhirlsView.file.path,side:'view',...titanWhirlsView.script}]],['explore/catalogue', EXPLORER_CATALOGUE],['look/rigged-hulls', NALATI_HULL_BOOK],['look/hull-book', speciesData.hullBook],['look/colour-functions',{terrain:oliveColour}]])),namedFiles:[...creatureViewModule.files,...weatherModule.files,...emitted.files,...taming.files,...kokparModule.files,...chargeModule.files],assets:new Map([...creatureViewModule.assets,...weatherModule.assets,...emitted.assets,...taming.assets,...kokparModule.assets,...chargeModule.assets])};
