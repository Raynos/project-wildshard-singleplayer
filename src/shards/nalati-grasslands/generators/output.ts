import { nalatiRenderTileProgram } from './renderTileProgram';
import {grassChannelBytes} from './grassRows';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import { nalatiOutputInputs } from './outputInputs';
import { nalatiSpeciesProgram } from './speciesProgram';
import { nalatiHeldSource, type NalatiHeldRows } from './heldMetadata';
import type { NalatiSpeciesSourceInputs } from './speciesPreparation';
import { nalatiModelPartsProgram } from './modelPartsProgram';
import { nalatiPaintedAtlasFile, nalatiPaintedGeometryFile, nalatiPaintedBindings, nalatiPaintedModelNames } from './modelBindings';
import { nalatiQuestProp } from './questProp';
import { nalatiBalbalSpecimen } from './balbalSpecimen';
import modelMetrics from '../data/modelMetrics.json' with { type: 'json' };
import { nalatiBakeBlob } from './placeBlobProgram';
import { nalatiPlacesProgram } from './placesProgram';
import { nalatiNativeShelters } from './shelters';
import { nalatiRuntimeRows } from './runtimeRows';
import { nalatiDecorativeProgram } from './decorativeProgram';
import { nalatiDressingProgram } from './dressingProgram';
import {AudioSceneSchema} from '@wildshard/format/audioScene';
import {AUDIO_SCENE as audioSceneInput} from './product';
import { nalatiPhysicsSources } from './physics';
import { nalatiPopulationMetadataBlob } from './populationMetadata';
import { nalatiScriptSections } from './scriptInventory';
import worldUpdates from '../data/worldUpdates.json' with {type:'json'};
import combatTargets from '../data/combatTargets.json' with {type:'json'};
import { HeldSlotsSchema } from '@wildshard/format/heldArms';
import { MountedSpecimenSeatSchema } from '@wildshard/format/mountedSpecimenRows';
import { CreatureGuestSchema, SpeciesActorsFileSchema } from '@wildshard/format/speciesBookRows';
import { PackedCreatureLooksSchema } from '@wildshard/format/speciesLooks';
import { wireProgram } from './returnProgramRows';
import practiceCard from '../data/practiceCard.json' with { type: 'json' };
import { NALATI_RIDING_SESSION } from './clientRiding';
import { nalatiMountedFigure } from './mountedFigure';
import { nalatiPoiPaintProgram } from './poiPaintProgram';
import { nalatiGeographyProgram } from './geographyProgram';
import { CAIRN, EAGLE_ROCK } from './layout';
import crowdProjection from '../data/crowdProjection.json' with {type:'json'};
import crowdNativeProjection from '../data/crowdNativeProjection.json' with {type:'json'};
import crowdView from '../data/crowdView.json' with { type: 'json' };
import { buildEliteEntryPageRows } from './eliteEntryRows';
import { nalatiStrikeRows, nalatiGoldenKingRows } from './kurganRows';
import { strike } from '@wildshard/sdk/species';
import { nalatiFindsCatalogue } from './finds';
import { coverSpecimenBlobs, nalatiCoverProgram } from './coverSpecimens';
import type { NalatiCover } from './coverBake.mjs';
import { TREE_SET } from './treeSet';
import { DRESSING_CONTACT_SOURCES, DRESSING_ATLAS_SOURCES, dressingCragDecoded, dressingSceneBlobs, nalatiDressingSpecimens } from './dressingScene';
import * as v from 'valibot';
import { makeCarriedQuestRows } from './carriedQuest';
import { CarriedQuestSchema } from '@wildshard/format/questSteps';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import bowPage from '../../../../public/assets/nalati/baked/recurve-pool.json' with {type:'json'};
import { HeldBowFileSchema, HeldFirearmPageSchema } from '@wildshard/format/weaponProfiles';
import { ArenaScriptFightFileSchema,ArenaScriptGeometrySchema } from '@wildshard/format/arenaScriptRows';
import { TimedEncountersSchema,CloudSpecimenSchema } from '@wildshard/format/encounterRows';
import strings from '../data/strings.json' with {type:'json'};
import nativeRide from '../data/nativeRiding.json' with { type: 'json' };
import skinFinishes from '../data/skinFinishes.json' with { type: 'json' };
import { nalatiDressingPlacementBlobs } from './dressingSchemas';
import { nalatiDressingPlacementProgram } from './dressingPlacementProgram';
import night from '../data/night.generated.json' with {type:'json'};
import ridingPrograms from '../behaviour/riding.generated.json' with { type: 'json' };
import arenaRoom from '../data/bossArenaRoom.json' with { type: 'json' };
import arenaView from '../data/kurganView.json' with { type: 'json' };
import arenaFire from '../data/arenaFire.json' with { type: 'json' };
import { horseCourseRows } from './courseScene';
import { RidingPracticeSchema } from '@wildshard/format/practiceCourseRows';
import weatherInput from '../behaviour/weather.generated.json' with { type: 'json' };
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
import { nalatiRifleRows } from './rifleRows';
import { NALATI_HULL_BOOK } from './riggedHulls';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import chapterStory from '../data/chapterStory.json' with { type: 'json' };
import { parseChapterStoryPresentation } from '@wildshard/format/questStory';
import { nalatiTamingPoseRows } from './tamingPoseRows';
import { nalatiSpearPool, SPEAR_POOL_NAME, type SpearPoolRows } from './spearPool';
import { headlessAssembly } from './nativeGroups';
import headlessBoot from '../data/headlessBoot.json' with { type: 'json' };
import titanFight from '../data/stormTitanFight.generated.json' with { type: 'json' };
import titanGeometry from '../data/stormTitanGeometry.generated.json' with { type: 'json' };
import { nalatiSabrePool, SABRE_POOL_NAME } from './sabrePool';
import { nalatiPersistenceRows } from './persistence';
import { bakeSheepBody } from './sheepBody';
import questContent from '../data/questContent.json' with {type:'json'};
import kokpar from '../data/kokpar.generated.json' with {type:'json'};
import chapterView from '../data/chapterView.json' with { type: 'json' };
import { peopleRows as peopleFrames } from './peopleRows.mjs';
import { nalatiPeopleBlobs } from './peopleBake';
import { nalatiTerrainSceneProgram } from './terrainSceneProgram';
import { nalatiCragRockProgram } from './cragRockProgram';
import { nalatiSprucePool, SPRUCE_POOL_NAME } from './sprucePool';
import { ChapterViewSchema } from '@wildshard/format/questPageComposition';
import namePanel from '../data/namePanel.json' with {type:'json'};
import { parsePanelDefinition } from '@wildshard/format/panelTemplate';
import weather from '../data/weather.json' with {type:'json'};
import { WATER_SURFACE } from './waterStrips';
import { parseWeatherProgram } from '@wildshard/format/weatherProgram';
import { ForestWeatherSchema } from '@wildshard/format/forestWeather';
import { NALATI_WEATHER_PAGE } from './weatherPage';
import { nameBlob, emitNamedBlobs, type NamedBlob } from '@wildshard/sdk/blobs';
import { SCRIPT_V2_REVISIONS } from '@wildshard/format/scriptAdmissionV2';
import { nalatiViewModules, nalatiViewSection } from './viewPrograms';
import { nalatiCreatureViews } from './creatureViews';
import { nalatiEliteViews } from './eliteViews';
import { nalatiTitanView } from './titanView';
import { nalatiTitanFireView } from './titanFireView';
import { nalatiTitanWhirlsView } from './titanWhirlsView';
import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import worldAssembly from '../data/worldAssembly.json' with { type: 'json' };
import { FixedDrawRowsSchema } from '@wildshard/format/fixedDraws';
import { postChainRows } from './postChain';
import { PANO_RIDGE_V } from './panoramaData';
import paintedTextures from '../data/paintedTextures.generated.json' with { type: 'json' };
import campCatalogue from '../data/campCatalogue.json' with { type: 'json' };
import campMaterials from '../data/campMaterials.json' with { type: 'json' };
import captureRows from '../data/staticCapture.json' with { type: 'json' };
import { nalatiGrassBake, type NalatiGrass } from './grassBake.mjs';
import geographyRows from '../data/geographySources.json' with {type:'json'};

const strikes = nalatiStrikeRows(), kingData = nalatiGoldenKingRows();

const {compiled:ridingCompiled,...ridingWire}=ridingPrograms;
const sheepBody = bakeSheepBody();
// Resolve author-only lair definitions into the admitted assembly, never runtime imports.
const {pageWildlife:_pageWildlife,pageGroups:_pageGroups,groupAdmission:_groupAdmission,...nativeConstants}=headlessAssembly.constants;
const eliteAssembly = { ...headlessAssembly, constants: { ...nativeConstants, pageElites: buildEliteEntryPageRows(), eliteDefs: Object.fromEntries(Object.entries(ecology.elites).filter(([id]) => ['aqbars', 'kokbori', 'argymaq'].includes(id)).map(([id, def]) => [id, {
  id: def.id, lair: def.lair, awareR: def.awareR, engageR: def.engageR, leashR: def.leashR, rule: def.rule, respawnMin: def.respawnMin,
}])), nativePopulation: {...ridingPrograms.population,driver:{...ridingPrograms.population.driver,projection:crowdNativeProjection}}, nativeRide: { ...nativeRide, speeds: ecology.modes.ride[0].gaits, roads: headlessBoot.roads } } };

/** Author weather once; page and native owners consume the same admitted numeric program. */
const cloudSpecimen = { name: 'storm-titan', pose: { rise: 1, bend: 0, kneel: 0, raise: .2, castL: 0, stride: 0, heartOpen: 0 }, ports: { place: { ...titanFight.TITAN_ARENA.titan, ground: { heightAt: [CAIRN.x, CAIRN.z] } } }, ...Object.fromEntries(['phone', 'desktop'].map(tier => [tier, { ...titanGeometry.body, geometry: { ...titanGeometry.body.geometry, eyes: titanGeometry.eyes }, poses: titanGeometry.poses, puffs: { ...titanGeometry.body.puffs, rows: (tier === 'phone' ? titanGeometry.phone : titanGeometry.desktop).puffs } }])) };
const { cues: nightCues, ...nightRows } = night;
// G613: the whole look as one row (game/looks/postGraphLook over its painted world, the manifest's render): the grade's
// post graph, then the painted world's fog, air, ground, grass and the panorama / key light / capture world rows
const lookRows = postChainRows(), painted = paintedTextures;
const postLook = (grassRows: NalatiGrass['rows']) => ({ ...lookRows.postGraph, painted: { fog: { ...painted.fog, ...lookRows.paintedFog, lut: lookRows.fogLut }, air: painted.air,
  ground: 'ground' in painted ? painted.ground : null, tiles: campMaterials, capture: captureRows, grass: { rows: grassRows, cards: painted.cards },
  world: { rows: 'world' in painted ? painted.world : null, panorama: 'panorama' in painted ? painted.panorama : null, key: 'key' in painted ? painted.key : null,
    ridge: PANO_RIDGE_V, ...lookRows.world } } });
// the shape book (carvings, trophies, arena parts, ghost riders, painted places): its fixed draws, read by the world
const rifle = nalatiRifleRows();
const chapterContent = { figures: peopleFrames, npcs: questContent.npcs, places: questContent.places, program: kokpar.program, view: chapterView };
v.parse(ChapterViewSchema, chapterContent);
const {compiled:admissionCompiled,...admission}=admissionInput;
const {compiled:weatherCompiled,...weatherDecision}=weatherInput;
const weatherModule={name:'behaviour/nalati.weather.wasm',kind:'wasm' as const,source:weatherCompiled.source,options:{critical:true,script:{abi:1 as const,pages:weatherDecision.script.pages}}};
interface SpeciesEmissionRows { crackBytes: readonly number[]; looks: unknown; presentation: unknown; hullBook: unknown }
const emitSpeciesOutput = (speciesRows: SpeciesEmissionRows, { held: heldWeapons }: NalatiHeldRows, mounted: ReturnType<typeof nalatiMountedFigure>, cover: NalatiCover, grass: NalatiGrass, spear: SpearPoolRows) => {
  const {polearm:_polearm,blade:_blade,programs:_programs,program:_program,compiled:_compiled,...weaponPower}=heldWeapons;
  const sabre=nalatiSabrePool();
  return emitNamedBlobs([...grassChannelBytes().map(row=>nameBlob(row.name,'bin',row.bytes,{decoded:row.decoded})),nameBlob('audio/scene.json','json',new TextEncoder().encode(encodeCanonicalJson(audioSceneInput)),{critical:true,jsonSchema:namedJsonSchema(AudioSceneSchema)}),nalatiPopulationMetadataBlob(),nameBlob('look/post.json','json',new TextEncoder().encode(encodeCanonicalJson(postLook(grass.rows)))),nameBlob('world/meadow.json','json',new TextEncoder().encode(encodeCanonicalJson(headlessAssembly.constants.nativeField))),nameBlob('riding/session.json','json',new TextEncoder().encode(encodeCanonicalJson(NALATI_RIDING_SESSION))),nameBlob('actors/wildlife.json','json',new TextEncoder().encode(encodeCanonicalJson(headlessAssembly.constants.pageWildlife))),nameBlob('riding/mounted-figure.json','json',new TextEncoder().encode(encodeCanonicalJson(mounted)),{jsonSchema:namedJsonSchema(MountedSpecimenSeatSchema)}),nameBlob('models/cloud-specimen.json','json',new TextEncoder().encode(encodeCanonicalJson(cloudSpecimen)),{jsonSchema:namedJsonSchema(CloudSpecimenSchema)}),nameBlob('combat/timed-encounters.json','json',new TextEncoder().encode(encodeCanonicalJson({...nightRows,presentation:'night',program:{script:weatherDecision.script,bytes:weatherDecision.bytes},contact:{strike: strike(strikes.arrow),tags:['creature.ghost-rider','feel.blow','cover.checked'],origin:'player'}})),{jsonSchema:namedJsonSchema(TimedEncountersSchema)}),nameBlob('quests/finds.json','json',new TextEncoder().encode(encodeCanonicalJson(nalatiFindsCatalogue()))),...coverSpecimenBlobs(cover),nameBlob('world/weather-fx.json','json',new TextEncoder().encode(encodeCanonicalJson({...weatherPresentation.presentation,sky:weatherPresentation.sky}))),nameBlob('weapons/bow-page.json','json',new TextEncoder().encode(`${JSON.stringify(bowPage)}\n`),{jsonSchema:namedJsonSchema(HeldBowFileSchema)}),nameBlob('weapons/rifle-page.json','json',new TextEncoder().encode(encodeCanonicalJson(rifle)),{jsonSchema:namedJsonSchema(HeldFirearmPageSchema)}),nameBlob('weapons/rifle-model.json', 'json', new TextEncoder().encode(encodeCanonicalJson(rifle.rows))),nameBlob('quests/chapters.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseChapterStoryPresentation(chapterStory)))),nameBlob('weapons/spear.json','json',new TextEncoder().encode(encodeCanonicalJson({...spear,program:heldWeapons.programs.polearm,presentation:heldWeapons.polearm}))),nameBlob('sim/headless-boot.json','json',new TextEncoder().encode(encodeCanonicalJson({ ...headlessBoot, worldUpdates, combatTargets, hunt: { ...ecology.gameplay, ...ecology.species, sheepdog: { aggressive: false, walkSpeed: 1.4 }, [ecology.argymaq]: ecology.gameplay.horse }, admission, pasture, riding: ridingWire }))),nameBlob('combat/room-entry.json','json',new TextEncoder().encode(encodeCanonicalJson({room:{...arenaRoom,view:arenaView},encounter:{...kingData,definition:kingData.encounter,program:wireProgram(titanProgram.attack)}})),{jsonSchema:namedJsonSchema(v.strictObject({room:v.unknown(),encounter:v.unknown()}))}),nameBlob('combat/titan-fight.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ arenaScript: titanFight.TITAN_HOST, king: kingData, programs: {attack:wireProgram(titanProgram.attack),wind:wireProgram(titanProgram.wind)}, arenaRoom: { ...arenaRoom, view: arenaView }, arenaFire })),{jsonSchema:namedJsonSchema(ArenaScriptFightFileSchema)}),nameBlob('combat/titan-geometry.json', 'json', new TextEncoder().encode(encodeCanonicalJson(titanGeometry)),{jsonSchema:namedJsonSchema(ArenaScriptGeometrySchema)}),nameBlob('weapons/sabre.json','json',new TextEncoder().encode(encodeCanonicalJson({...sabre.rows,program:heldWeapons.programs.blade,power:{...weaponPower,program:heldWeapons.programs.power},parts:heldWeapons.blade}))),nameBlob(SABRE_POOL_NAME,'glb',sabre.glb),nameBlob('quests/persistence.json','json',new TextEncoder().encode(encodeCanonicalJson(nalatiPersistenceRows()))),nameBlob('actors/balbal-cracks.bin', 'bin', Uint8Array.from(speciesRows.crackBytes)),nameBlob('actors/sheep.bin', 'bin', sheepBody.bytes),nameBlob('actors/species-looks.json','json',new TextEncoder().encode(encodeCanonicalJson(v.parse(PackedCreatureLooksSchema,speciesRows.looks))),{jsonSchema:namedJsonSchema(PackedCreatureLooksSchema)}),nameBlob('actors/sheep.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ page: { world: { guard: {projection:crowdProjection}, slug: 'nalati-grasslands', hull: 'sheep', bounds: [-250, 250, -250, 250], rows: ecology.flocks.world, view: crowdView, material: { rim: .8, bands: .85 } }, specimen: { slug: 'nalati-grasslands', hull: 'sheep', bounds: [-250, 250, -250, 250], rows: ecology.flocks.specimen, view: crowdView, material: { rim: .8, bands: .85 } } }, species: speciesRows.presentation, draws:[{slot:'actors/sheep.bin',file:'actors/sheep.bin',channels:[],baked:{...sheepBody.row,expand:false}}], pivots: sheepBody.pivots, parts: sheepBody.parts, radius: sheepBody.radius })),{jsonSchema:namedJsonSchema(SpeciesActorsFileSchema)}),nameBlob('quests/content.json','json',new TextEncoder().encode(encodeCanonicalJson(chapterContent)),{jsonSchema:namedJsonSchema(ChapterViewSchema)}),nameBlob('quests/panels.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ name: parsePanelDefinition(namePanel) }))),nameBlob('world/forest-weather.json','json',new TextEncoder().encode(encodeCanonicalJson(v.parse(ForestWeatherSchema,NALATI_WEATHER_PAGE)))),nameBlob('world/weather.json','json',new TextEncoder().encode(encodeCanonicalJson({weather:parseWeatherProgram(weather),reactions:weatherDecision}))),nameBlob('world/water.json','json',new TextEncoder().encode(encodeCanonicalJson({ surface: WATER_SURFACE, terrain: terrainScene, placeSets: NALATI_PLACE_SETS, practice: horseCourseRows() })),{jsonSchema:namedJsonSchema(v.looseObject({practice:RidingPracticeSchema}))})]);
};
const taming = emitNamedBlobs([nameBlob('ride/rules.json','json',new TextEncoder().encode(encodeCanonicalJson(ridingWire))),nameBlob('sim/taming-poses.json', 'json', new TextEncoder().encode(encodeCanonicalJson(nalatiTamingPoseRows())))]);
const kokparModule={name:'behaviour/nalati.kokpar.wasm',kind:'wasm' as const,source:kokpar.compiled.source,options:{critical:true,script:{abi:1 as const,pages:kokpar.program.script.pages}}};
const admissionWitness={name:'behaviour/admission-witness.bin',kind:'bin' as const,source:'behaviour/admission-witness.generated.bin',options:{critical:true}};
const admissionModule={name:'behaviour/nalati.admission.wasm',kind:'wasm' as const,source:admissionCompiled.source,options:{dependencies:[admission.script.module.slice('blobs/wasm/'.length,-'.wasm'.length)],critical:true,script:{abi:2 as const,lane:'project' as const,pages:admission.v2.artifact.pages,ioBytes:admission.v2.artifact.ioBytes,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission}}};
// ABI1 witnesses are raw data dependencies, not additional executable modules.
const titanWitnesses=['titan','pasture'].map(name=>({name:`behaviour/${name}-witness.bin`,kind:'bin' as const,source:`behaviour/${name}-witness.generated.bin`,options:{critical:true}}));
const titanV2Module = {name:'behaviour/nalati.titan.attack.v2.wasm',kind:'wasm' as const,source:titanProgram.compiled.attack.source,options:{dependencies:[titanProgram.attack.script.module.slice('blobs/wasm/'.length,-'.wasm'.length)],critical:true,script:{abi:2 as const,lane:'project' as const,pages:titanProgram.attack.v2.artifact.pages,ioBytes:titanProgram.attack.v2.artifact.ioBytes,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission}}};
const ridingProjection=ridingPrograms.approach.v2;
const ridingWitness={name:'behaviour/riding-witness.bin',kind:'bin' as const,source:'behaviour/riding-witness.generated.bin',options:{critical:true}};
const ridingModule={name:'behaviour/nalati.mounts.wasm',kind:'wasm' as const,source:ridingCompiled.source,options:{dependencies:[ridingPrograms.approach.script.module.slice('blobs/wasm/'.length,-'.wasm'.length)],critical:true,script:{abi:2 as const,lane:'project' as const,pages:ridingProjection.artifact.pages,ioBytes:ridingProjection.artifact.ioBytes,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission}}};
const pastureProjection=pasture.v2;
const pastureModule = {name:'behaviour/nalati.pasture.wasm',kind:'wasm' as const,source:titanProgram.compiled.pasture.source,options:{dependencies:[titanProgram.wind.script.module.slice('blobs/wasm/'.length,-'.wasm'.length)],critical:true,script:{abi:2 as const,lane:'project' as const,pages:pastureProjection.artifact.pages,ioBytes:pastureProjection.artifact.ioBytes,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission}}};
const chargeModule = {name: 'behaviour/nalati.qara-charge.wasm', kind: 'wasm' as const, source: charge.compiled.source, options: {critical: true, script: {abi: 1 as const, pages: charge.script.pages}}};
const heldWitness={name:'behaviour/held-witness.bin',kind:'bin' as const,source:'behaviour/held-witness.generated.bin',options:{critical:true}};
function heldModule(held: NalatiHeldRows['held']): PhysicalOutput {
  const selected = held.program.v2.artifact;
  return {name:'behaviour/nalati.held-weapons.wasm',kind:'wasm',source:held.compiled.source,
    options:{dependencies:[held.program.script.module.slice('blobs/wasm/'.length,-'.wasm'.length)],critical:true,script:{abi:2,lane:'project',pages:selected.pages,ioBytes:selected.ioBytes,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission}}};
}
const geographySources=v.parse(v.array(v.object({name:v.string(),kind:v.literal('bin'),source:v.string(),options:v.object({decoded:v.pipe(v.number(),v.integer(),v.minValue(0))})})),geographyRows);
const shapeSourcesSchema = v.array(v.object({name:v.string(),kind:v.literal('bin'),source:v.string()}));
// N1b: the far ground's 16 L1 squares, two to a source-owned GLB: named files the painted ground reads
// beyond the 5 x 5 (game/looks/painterlyLook), not tile rows, so they spend none of the envelope's JSON node budget
const NALATI_L1_PAIRS=[0,1,2,3].flatMap(z=>[0,1].map(x=>({name:`world/terrain/ground-l1-${String(x)}-${String(z)}.glb`,kind:'glb' as const,source:`assets/world-terrain/ground-l1-${String(x)}-${String(z)}.generated.glb`})));
const audioFieldSources=Object.entries(audioSceneInput.fields.channels).map(([id,row])=>({name:row.data.file,kind:'bin' as const,source:`data/audio-${id}.bin`,options:{critical:true,decoded:row.count*4}}));
/** Keep the original intake order when fresh metadata supplies the existing shape locators. */
type PhysicalOutput = NonNullable<ProjectOutput['blobs']>[number];
const outputBlobs = <Floor extends NamedBlob>(shapeSources: readonly (PhysicalOutput | Floor)[], floors: readonly Floor[], carried: readonly (PhysicalOutput | Floor)[], carvings: readonly (PhysicalOutput | Floor)[], held: readonly (PhysicalOutput | Floor)[], render: readonly (PhysicalOutput | Floor)[], geography: readonly (PhysicalOutput | Floor)[], views: readonly (PhysicalOutput | Floor)[] = []): readonly (PhysicalOutput | Floor)[] => [{name:'held/slots.json',kind:'json' as const,source:'boot/mountedLoadout.json',options:{critical:true,jsonSchema:namedJsonSchema(HeldSlotsSchema)}},chargeModule,weatherModule,kokparModule,...audioFieldSources,...views,...nalatiPhysicsSources(),...geography,...DRESSING_CONTACT_SOURCES,...carried,...floors,...carvings,...DRESSING_ATLAS_SOURCES,...shapeSources,...titanWitnesses,titanV2Module,pastureModule,...held,ridingWitness,ridingModule,admissionWitness,admissionModule,{name:"practice/card.webp",kind:"image",source:"explore/playground-horse.webp"},...render];
/** Full original output template, with the defining species source supplied explicitly. */
export interface NalatiOutputRows {
  blobs: readonly PhysicalOutput[];
  platform: ReturnType<typeof emitPlatformSections>;
  namedFiles: ReturnType<typeof emitNamedBlobs>['files'][number][];
  assets: Map<string, Uint8Array>;
}
function outputRowsFrom(speciesRows: SpeciesEmissionRows, emitted: ReturnType<typeof emitSpeciesOutput>, heldRows: NalatiHeldRows, views: readonly NamedBlob[]): NalatiOutputRows {
  const { held: heldWeapons, stealth } = heldRows;
  return {blobs:outputBlobs<never>([], [], [], [], [heldWitness, heldModule(heldRows.held)], NALATI_L1_PAIRS, geographySources),platform:emitPlatformSections(new Map<PlatformDataSectionName, unknown>([['world/trees',TREE_SET],['world/scenes',{version:1,libraries:[],materials:[],steps:[],dressing:{phone:'world/dressing-phone.json',desktop:'world/dressing-desktop.json'}}],['ui/strings',strings],['client/plan',{version:1,features:[practiceCard,{kind:'view.program',id:'creature-views',rows:nalatiCreatureViews(),module:'views/nalati.creature-views.wasm'},{kind:'view.program',id:'elite-views',rows:nalatiEliteViews(ecology.externalElites.map(row=>row.def.id)),module:'views/nalati.elite-views.wasm'},{kind:'view.program',id:'titan-view',rows:nalatiTitanView(),module:'views/nalati.titan-view.wasm'},{kind:'view.program',id:'titan-fire-view',rows:nalatiTitanFireView(),module:'views/nalati.titan-fire-view.wasm'},{kind:'view.program',id:'titan-whirls-view',rows:nalatiTitanWhirlsView(),module:'views/nalati.titan-whirls-view.wasm'},{kind:'audio.cues',id:'night',stage:'world',clock:'owner',rows:nightCues},{kind:'world.scenes'},{kind:'species.program',catalogue:{owner:'nalati.species',actors:'actors/sheep.json',looks:'actors/species-looks.json'}},{kind:'state.adventure',file:'quests/persistence.json',id:'progress',progress:true},{kind:'world.meadow',file:'world/meadow.json'},{kind:'world.assembly',native:{groups:'nalati.world'},rows:worldAssembly},{kind:'world.updates',rows:worldUpdates},{kind:'combat.targets',rows:combatTargets,bindings:[{id:'night',kind:'timed-encounters',owner:'nalati.night'},{id:'titan',kind:'arena-room',owner:'nalati.titan'}]},{kind:'weather.forest',file:'world/forest-weather.json',owner:'nalati.weather',hud:true},{kind:'held.claims.prepare',id:'nalati.arsenal',source:{slots:'held/slots.json',library:'models/gear-book.json'}},{kind:'held.claims.install',claims:'nalati.arsenal',preparation:'world'},{kind:'debug.expose',name:'harness.shard.nalati-grasslands',objects:['ride','wildlife']},{kind:'debug.expose',name:'nalati.boss',source:{kind:'arena-room',owner:'nalati.king'}},{kind:'debug.expose',name:'nalati.ghosts',source:{kind:'timed-riders',owner:'nalati.night'}},{kind:'debug.expose',name:'nalati.dressing',source:{kind:'dressing'}},{kind:'taming.entry',riding:'nalati.riding',publish:'riding',object:'ride'},{kind:'arena-room.entry',owner:'nalati.titan',claims:'nalati.arsenal',reward:'naizagai',publish:'fight',equipment:'held-finishes'},{kind:'arena-room.entry',owner:'nalati.king',claims:'nalati.arsenal',reward:'goldenBow',publish:'arena'},{kind:'elite.entry',owner:'nalati.elites',adventure:'progress',body:'animals',rock:EAGLE_ROCK,taming:'riding'},{kind:'quest.chapter-view',chapterView:'quests/content.json',story:'quests/chapters.json',arena:'arena',fight:'fight',taming:'riding'},{kind:'world.paths',rows:{id:'paths',name:'Paths'}},{kind:'world.dressing'},{kind:'population.wildlife',publish:'wildlife',file:'actors/wildlife.json',crowd:{json:'actors/sheep.json',binary:'actors/sheep.bin'},navSteer:true,frame:{id:'shard.nalati.wildlife',after:['shard.nalati.boss'],before:['engine.creatures.update']}},{kind:'strings.register'},{kind:'world.sets',rows:NALATI_PLACE_SETS},{kind:'look.painterly',shadeTint:[.1,.16,.36],rimColor:[1.5,1.28,.95],wind:{x:1,z:.35,strength:1}},{kind:'audio.scene'},{kind:'world.water',rows:[{id:'river',surface:WATER_SURFACE,geometry:'world/water.glb'}]},{kind:'riding.session',file:'riding/session.json',owner:'nalati.riding'},headlessAssembly.constants.eliteEntry,headlessAssembly.constants.timedEntry,{kind:'stealth.entry',owner:'nalati.stealth',claims:'nalati.arsenal',riding:'nalati.riding',night:'nalati.night',bow:'bow',melee:'polearm',impactExclusion:4.5,debugRiding:'nalati.ride',frame:{id:'shard.nalati.stealth',after:['shard.nalati.wildlife'],before:['engine.creatures.update']}},{kind:'held.cosmetics'},{kind:'held.ranged-feel'},{kind:'bag.finds',id:'nalati.finds',quest:'tulpar',file:'quests/finds.json'},{kind:'content.catalogue',quests:true,finishes:false,weapons:[],ammunition:[],effects:[],compendiums:[],encounters:[]}]}],['held/finishes',{order:[],rows:{},cards:[],extras:{},cosmetics:skinFinishes}],...nalatiScriptSections(heldWeapons.program.v2),['player/stealth',stealth],['view/modules',nalatiViewSection(views, SCRIPT_V2_REVISIONS)],['explore/catalogue', EXPLORER_CATALOGUE],['look/rigged-hulls', NALATI_HULL_BOOK],['look/hull-book', speciesRows.hullBook],['look/colour-functions',{terrain:oliveColour}]])),namedFiles:[...emitted.files,...taming.files],assets:new Map([...emitted.assets,...taming.assets])};
}

export function nalatiOutputRows(speciesRows: SpeciesEmissionRows, held: NalatiHeldRows, paint: unknown, cover: NalatiCover, grass: NalatiGrass, spear: SpearPoolRows, views: readonly NamedBlob[]): NalatiOutputRows {
  return outputRowsFrom(speciesRows, emitSpeciesOutput(speciesRows, held, nalatiMountedFigure(paint), cover, grass, spear), held, views);
}

// The CLI always invokes prepareOutput; no stale generated template is evaluated.
export const output: NalatiOutputRows = { blobs: [], platform: emitPlatformSections(new Map()), namedFiles: [], assets: new Map() };

const shelterScalar = v.pipe(v.number(), v.finite());
const shelterPlacesSchema = v.object({ rows: v.array(v.object({ colliders: v.array(v.object({
  x: shelterScalar, z: shelterScalar, hw: shelterScalar, hd: shelterScalar, yTop: shelterScalar, yBottom: shelterScalar,
})) })) });

const speciesInputSchema = v.object({
  body: v.object({ bytes: v.number(), bodies: v.array(v.object({ key: v.string(), bones: v.array(v.looseObject({ name: v.string() })),
    dims: v.unknown(), fur: v.array(v.array(v.number())), hard: v.array(v.array(v.number())), eye: v.array(v.array(v.number())) })) }),
  admission: v.looseObject({ script: v.record(v.string(), v.unknown()), bytes: v.string(), compiled: v.optional(v.unknown()), v2: v.optional(v.unknown()) }),
  strike: v.unknown(), kingPose: v.object({ programs: v.unknown(), group: v.string() }),
});
const speciesOutputSchema = v.object({ packedBodies: v.object({ file: v.string(), bytes: v.pipe(v.number(), v.safeInteger(), v.minValue(1)) }), crackBytes: v.array(v.number()), looks: v.unknown(), presentation: v.unknown(), hullBook: v.unknown(),
  program: v.object({ script: v.object({ module: v.string(), pages: v.number() }), bytes: v.string(),
    v2: v.object({ artifact: v.object({ pages: v.pipe(v.number(), v.safeInteger(), v.minValue(1)) }) }) }),
  compiled: v.object({ bytes: v.pipe(v.number(), v.safeInteger(), v.minValue(0)) }), witnessBytes: v.number() });
function admitSpeciesInput(input: unknown): NalatiSpeciesSourceInputs {
  // Validate in place: the native packer preserves the upstream metadata assignment order.
  if (!v.is(speciesInputSchema, input)) throw new Error('Invalid species source metadata');
  return input;
}

/** Share the defining species cache between the header and output through one product context. */
export async function prepareSpecies(ctx: ProjectGenerationContext): Promise<{
  readonly rows: v.InferOutput<typeof speciesOutputSchema>;
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly held: NalatiHeldRows;
}> {
  const files = await nalatiSpeciesProgram(ctx, admitSpeciesInput, input => v.parse(CreatureGuestSchema, input), () => 'actors/bodies.bin');
  const metadata = files.get('species.json'), witness = files.get('held-witness.bin');
  if (metadata === undefined || witness === undefined) throw new Error('Missing owned species metadata or witness');
  const metadataRows: unknown = JSON.parse(new TextDecoder().decode(metadata));
  const held = nalatiHeldSource(metadataRows), module = files.get('held-weapons.wasm');
  if (module === undefined || held.held.compiled.bytes !== module.byteLength
    || held.held.compiled.hash !== hashImmutableBytes(module) || held.held.program.v2.artifact.hash !== hashImmutableBytes(module)
    || held.held.program.script.module !== `blobs/wasm/${hashImmutableBytes(witness)}.wasm`) throw new Error('Held source metadata differs from owned executable bytes');
  const rows = v.parse(speciesOutputSchema, metadataRows);
  const bank = files.get('bodies.bin');
  if (bank === undefined || rows.packedBodies.file !== 'actors/bodies.bin') throw new Error('Species body locator differs from named output');
  if (rows.witnessBytes !== witness.byteLength) throw new Error('Species witness cost differs from owned bytes');
  return { rows, files, held };
}

/** The grass at build time over the native lattice and the dressing placements it keeps out of (GR6). */
async function nalatiGrassProgram(ctx: ProjectGenerationContext): Promise<NalatiGrass> {
  const lattice = '/assets/baked/nalati-grasslands/terrain.bin';
  const files = await ctx.cached({ id: 'grass-lattice', inputs: [lattice] }, inputs => {
    const bytes = inputs.get(lattice); if (bytes === undefined || bytes.length === 0) throw new Error('Missing Nalati native lattice');
    return new Map([['lattice.bin', bytes]]);
  });
  const bytes = files.get('lattice.bin'); if (bytes === undefined) throw new Error('Missing Nalati native lattice');
  return nalatiGrassBake(bytes, await nalatiDressingPlacementProgram(ctx));
}
/** Own the existing scene binaries through the injected build reader, with unchanged admission costs. */
export async function prepareOutput(ctx: ProjectGenerationContext): Promise<NalatiOutputRows> {
  const { rows: speciesRows, files: species, held: heldRows } = await prepareSpecies(ctx);
  const speciesFile = (name: string): Uint8Array => {
    const bytes = species.get(name); if (bytes === undefined) throw new Error(`Missing owned species output: ${name}`);
    return bytes;
  };
  const speciesBank = nameBlob('actors/bodies.bin', 'bin', speciesFile('bodies.bin'), { decoded: speciesRows.packedBodies.bytes });
  const renderFiles = await nalatiRenderTileProgram(ctx);
  const renderPairs = NALATI_L1_PAIRS.map(row => {
    const bytes = renderFiles.get(row.source);
    if (bytes === undefined) throw new Error(`Missing owned render pair ${row.name}`);
    return nameBlob(row.name, row.kind, bytes);
  });
  const geographyFiles = await nalatiGeographyProgram(ctx);
  const ownedGeography = geographySources.map(row => {
    const bytes = geographyFiles.get(row.source);
    if (bytes === undefined) throw new Error(`Missing owned geography channel ${row.source}`);
    return nameBlob(row.name, row.kind, bytes, row.options);
  });
  const paintFiles = await nalatiPoiPaintProgram(ctx), paintDocument = paintFiles.get('data/poiPaint.json');
  if (paintDocument === undefined) throw new Error('Missing owned POI paint metadata');
  const paintRows: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(paintDocument));
  const cover = await nalatiCoverProgram(ctx), grass = await nalatiGrassProgram(ctx), spear = nalatiSpearPool(), freshEmission = emitSpeciesOutput(speciesRows, heldRows, nalatiMountedFigure(paintRows), cover, grass, spear.rows);
  // GR6: the grass lattices and scenes are built here; their blocks ship as named product files
  const grassBlobs = grass.rows.sources.map(row => { const bytes = grass.files.get(row.name); if (bytes === undefined) throw new Error(`Missing grass block ${row.name}`); return nameBlob(row.name, 'bin', bytes, row.options); });
  // GR6: the five view modules compile from their authored sources (viewPrograms.ts) before the template names them
  const views = await nalatiViewModules(ctx, SCRIPT_V2_REVISIONS);
  const template = outputRowsFrom(speciesRows, freshEmission, heldRows, views), platform = template.platform;
  const executable = heldModule(heldRows.held);
  const held = [nameBlob(heldWitness.name, 'bin', speciesFile('held-witness.bin'), heldWitness.options),
    nameBlob(executable.name, 'wasm', speciesFile('held-weapons.wasm'), executable.options)];
  const placements = emitNamedBlobs(nalatiDressingPlacementBlobs(await nalatiDressingPlacementProgram(ctx)));
  const placeFiles = await nalatiPlacesProgram(ctx), placeBytes = placeFiles.get('places.bin');
  if (placeBytes === undefined) throw new Error('Missing owned native places binary');
  const placeDocument = placeFiles.get('places.json');
  if (placeDocument === undefined) throw new Error('Missing owned native places metadata');
  const placesMetadata: unknown = JSON.parse(new TextDecoder().decode(placeDocument));
  const nativeShelters = nalatiNativeShelters(v.parse(shelterPlacesSchema, placesMetadata));
  const runtime = nalatiRuntimeRows({ places: placesMetadata, paint: paintRows });
  const propGeometry = placeFiles.get('placeParts.json'), propBytes = placeFiles.get('actor:goat.bin');
  if (propGeometry === undefined || propBytes === undefined) throw new Error('Missing owned native quest prop');
  const geometry = v.parse(v.record(v.string(), v.unknown()), JSON.parse(new TextDecoder().decode(propGeometry)));
  const specimenDocument = placeFiles.get('placeSpecimens.json');
  if (specimenDocument === undefined) throw new Error('Missing owned native specimen metadata');
  const packedSpecimens: unknown = JSON.parse(new TextDecoder().decode(specimenDocument));
  const specimenRows = nalatiDressingSpecimens(campCatalogue, campMaterials, packedSpecimens);
  const specimenBytes = placeFiles.get('specimens.bin');
  if (specimenBytes === undefined) throw new Error('Missing owned native specimen bank');
  const specimenFile = 'models/specimens/camp.bin';
  const specimenBank = nameBlob(specimenFile, 'bin', specimenBytes, { decoded: specimenRows.packed.bytes });
  specimenRows.packed.bin = { file: specimenFile, bytes: specimenBytes.byteLength };
  const poiMaterial = specimenRows.materials['poi'], balbalAsset = specimenRows.assets['balbal'];
  if (poiMaterial === undefined || balbalAsset === undefined) throw new Error('Missing admitted native specimen bindings');
  const carried = makeCarriedQuestRows(nalatiQuestProp(geometry['actor:goat'], poiMaterial));
  const carriedBlob = nameBlob('quests/carried.json', 'json', new TextEncoder().encode(encodeCanonicalJson(carried)), { jsonSchema: namedJsonSchema(CarriedQuestSchema) });
  const propBlob = nameBlob('models/specimens/quest-prop.bin', 'bin', propBytes);
  const bare = placeFiles.get('actor:balbal:0:2977.bin'), capped = placeFiles.get('actor:balbal:1:2977.bin');
  if (bare === undefined || capped === undefined) throw new Error('Missing owned native balbal carvings');
  const balbal = nalatiBalbalSpecimen(geometry['actor:balbal:0:2977'], geometry['actor:balbal:1:2977'], balbalAsset,
    poiMaterial, v.parse(v.number(), modelMetrics.sizes.balbal[1]));
  const carvings = [bare, capped].map((bytes, index) => nameBlob(`models/specimens/balbal-${String(index)}.bin`, 'bin', bytes));
  const byteCount = v.pipe(v.number(), v.integer(), v.minValue(0));
  const costs = v.parse(v.object({ places: v.object({ bytes: byteCount }), dressing: v.object({ bytes: byteCount }) }), runtime.runtime);
  const places = nameBlob('world/places.bin', 'bin', placeBytes, { decoded: costs.places.bytes });
  const shapeBook = v.parse(v.object({ draws: FixedDrawRowsSchema, sources: shapeSourcesSchema }), runtime.shapeBook);
  const shapeDraws = shapeBook.draws.map(row => 'lane' in row ? { ...row, lane: { file: 'world/places.bin', offset: row.lane.offset } } : row);
  const ownedMetadata = emitNamedBlobs([nameBlob('sim/headless-assembly.json', 'json', new TextEncoder().encode(encodeCanonicalJson({
    ...eliteAssembly, constants: { ...eliteAssembly.constants, nativeShelters },
  }))), nameBlob('models/shape-book.json', 'json', new TextEncoder().encode(encodeCanonicalJson(shapeDraws)),
    { jsonSchema: namedJsonSchema(FixedDrawRowsSchema) })]);
  const cragRows = await nalatiCragRockProgram(ctx), crags = await nalatiBakeBlob(ctx, 'crags', dressingCragDecoded(cragRows)), people = await nalatiPeopleBlobs(ctx);
  // GR6: the slab and the water mesh ship; the painted ground draws from its tiles, so its whole mesh feeds only the map
  const terrainDraws = (await nalatiTerrainSceneProgram(ctx)).filter(blob => blob.file.name !== 'world/terrain/ground.glb');
  terrainDraws.push(nameBlob(SPRUCE_POOL_NAME, 'glb', nalatiSprucePool()), nameBlob(SPEAR_POOL_NAME, 'glb', spear.glb));
  const dressingFiles = await nalatiDressingProgram(ctx), dressingBytes = dressingFiles.get('dressing.bin');
  if (dressingBytes === undefined) throw new Error('Missing owned native dressing binary');
  const dressingBlob = nameBlob('world/dressing.bin', 'bin', dressingBytes, { decoded: costs.dressing.bytes });
  const decorativeFiles = await nalatiDecorativeProgram(ctx), decorativeBytes = decorativeFiles.get('decorative.json');
  if (decorativeBytes === undefined) throw new Error('Missing owned decorative profiles');
  const profiles: unknown = JSON.parse(new TextDecoder().decode(decorativeBytes));
  const sceneBlobs = dressingSceneBlobs(profiles,runtime.runtime,balbal,specimenRows,paintRows,cover.rows,cragRows);
  const coverNames = new Set(['models/cover-phone.json', 'models/cover-desktop.json']);
  const books = [...freshEmission.files.filter(file => file.name !== undefined && coverNames.has(file.name)).map(file => {
    const bytes = freshEmission.assets.get(file.hash);
    if (bytes === undefined) throw new Error('Missing original Nalati cover book');
    return { file, bytes };
  }), ...sceneBlobs.filter(blob => blob.file.kind === 'json')];
  const documents = books.map(blob => ({ blob, rows: JSON.parse(new TextDecoder().decode(blob.bytes)) as unknown }));
  const parts = await nalatiModelPartsProgram(ctx, nalatiPaintedModelNames(documents.map(row => row.rows)));
  const modelFiles = new Map<string, NamedBlob>();
  for (const [file, bytes] of parts) {
    if (file.endsWith('.ktx2')) {
      const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      let width = header.getUint32(20, true), height = header.getUint32(24, true), gpu = 0;
      for (;;) {
        gpu += width * height * 4;
        if (width === 1 && height === 1) break;
        width = Math.max(1, Math.floor(width / 2)); height = Math.max(1, Math.floor(height / 2));
      }
      const name = nalatiPaintedAtlasFile(bytes);
      modelFiles.set(name, nameBlob(name, 'ktx2', bytes, { gpu }));
    } else {
      const name = nalatiPaintedGeometryFile(file, bytes); modelFiles.set(name, nameBlob(name, 'glb', bytes));
    }
  }
  const modelBlobs = [...modelFiles.values()];
  const ownedBooks = new Map(documents.map(({ blob, rows }) => {
    const name = blob.file.name;
    if (name === undefined) throw new Error('Missing named Nalati model book');
    const owned = nameBlob(name, 'json', new TextEncoder().encode(encodeCanonicalJson(nalatiPaintedBindings(rows, parts))), {
      critical: blob.file.critical, dependencies: blob.file.dependencies,
      ...(blob.file.jsonSchema === undefined ? {} : { jsonSchema: blob.file.jsonSchema }),
    });
    return [name, owned] as const;
  }));
  const sourceFiles = freshEmission.files.map(file => file.name === undefined ? file : ownedBooks.get(file.name)?.file ?? file);
  const scenes = emitNamedBlobs(sceneBlobs.map(blob => blob.file.name === undefined ? blob : ownedBooks.get(blob.file.name) ?? blob));
  const namedFiles = [...sourceFiles.filter(file => file.name !== 'quests/carried.json'), carriedBlob.file, ...ownedMetadata.files, ...placements.files, ...scenes.files].sort((a, b) => (a.name ?? '') < (b.name ?? '') ? -1 : (a.name ?? '') > (b.name ?? '') ? 1 : 0);
  const sources = await nalatiOutputInputs(ctx, outputBlobs(shapeBook.sources.map(row => {
    const bytes = paintFiles.get(row.source);
    if (bytes === undefined) throw new Error(`Missing owned paint shape ${row.source}`);
    return nameBlob(row.name, row.kind, bytes);
  }), runtime.floors.map(floor => nameBlob(floor.name, 'bin', floor.bytes)), [propBlob], carvings, held, renderPairs, ownedGeography, views));
  return { ...template, platform, blobs: [], namedFiles: [...sources.map(source => source.file), ...modelBlobs.map(source => source.file), ...namedFiles, ...taming.files, places.file, crags.file, dressingBlob.file, specimenBank.file, speciesBank.file, ...people.map(blob => blob.file), ...terrainDraws.map(blob => blob.file), ...grassBlobs.map(blob => blob.file)], assets: new Map([...template.assets, ...freshEmission.assets, ...[...ownedBooks.values()].map(blob => [blob.file.hash, blob.bytes] as const), ...sources.map(source => [source.file.hash, source.bytes] as const), ...modelBlobs.map(source => [source.file.hash, source.bytes] as const), ...ownedMetadata.assets, ...placements.assets, ...scenes.assets, [carriedBlob.file.hash, carriedBlob.bytes], [places.file.hash, places.bytes], [crags.file.hash, crags.bytes], [dressingBlob.file.hash, dressingBlob.bytes], [specimenBank.file.hash, specimenBank.bytes], [speciesBank.file.hash, speciesBank.bytes], ...people.map(blob => [blob.file.hash, blob.bytes] as const), ...terrainDraws.map(blob => [blob.file.hash, blob.bytes] as const), ...grassBlobs.map(blob => [blob.file.hash, blob.bytes] as const)]) };
}
