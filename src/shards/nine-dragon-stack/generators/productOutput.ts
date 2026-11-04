import type { NineSourceSigns } from './signsProgram';
import strings from '../data/strings.json' with { type: 'json' };
import practiceCard from '../data/practiceCard.json' with { type: 'json' };
import heldPrimary from '../data/heldPrimary.json' with { type: 'json' };
import { facadeWindowBlobs } from './facadeWindows';
import { kitKindFiles } from './kitKindGraphs';
import { crowdGraphFile } from './crowdGraph';
import type { NineHeldInputs } from './heldGraphFiles';
import { heldView } from './heldView';
import type { NineSourceCasts } from './castsProgram';
import { parseFixedPractice, parseFilamentRows, parseHaloState } from './sections';
import { postRows } from './postGraphs';
import { postGraphRow } from './composite';
import { NINE_FRAME_CHANNELS, NINE_FRAME_GROUP } from './frameChannels';
import viewmodelUniforms from '../data/viewmodelUniforms.json' with { type: 'json' };
import filamentRows from '../data/filament.json' with { type: 'json' };
import lightRows from '../data/light.json' with { type: 'json' };
import { filamentGeometry } from './filamentGeometry';
import { grappleCourseScene } from './courseScene';
import type { NinePracticeProgram } from './practiceProgram';
import course from '../data/grappleCourse.json' with { type: 'json' };
import { namedJsonSchema, registeredJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import type { GrappleRows } from '../data/grappleTypes';
import aim from '../data/grapple.json' with { type: 'json' };
import { nameBlob, emitNamedBlobs, type BlobOptions, type NamedBlob } from '@wildshard/sdk/blobs';
import { JIAN_GEOMETRY } from './jianGeometry';
import grappleProfile from '../data/grappleProfile.json' with { type: 'json' };
import portals from '../data/portals.json' with { type: 'json' };
import physicsRows from '../data/physicsRows.json' with { type: 'json' };
import { recordedPhysicsPoints } from '@wildshard/sdk/bake/contactRows';
import { lightVolumeBlobs } from './lightVolumes';
import { plainWeaveBytes, silkWeaveBytes } from './silkWeave';
import type { NineSlabScenes } from './slabs';
import type { NineSourceWorld } from './worldProgram';
import { nineWorldEntry } from './worldEntry';
import { nineWorldAssembly } from './worldAssembly';
import { nineMoversView } from './moversView';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import { nineRefinementFiles, nineSlabSourceFiles } from './refinementAdmission';
import { nineDemandFiles } from './demandAdmission';
import { nineExplorerDeclarations, NINE_HELD_CARDS } from './explorerDeclarations';
import heldCards from '../data/heldCards.json' with { type: 'json' };

/** Complete output ownership before the author CLI resolves the remaining file adapters. */
export interface NineOutput extends ProjectOutput {
  readonly blobs: NonNullable<ProjectOutput['blobs']>;
  readonly namedFiles: NonNullable<ProjectOutput['namedFiles']>;
  readonly assets: ReadonlyMap<string, Uint8Array>;
  readonly platform: ReturnType<typeof emitPlatformSections>;
}

type ViewContract = Extract<NonNullable<BlobOptions['script']>, { abi: 2 }>;

/** Remaining file adapters supply these rows; the factory never imports their outputs. */
export interface NineOutputInputs {
  readonly casts: NineSourceCasts;
  readonly signs: NineSourceSigns;
  readonly courseProgram: NinePracticeProgram;
  readonly ownedWorld: NineSourceWorld; readonly scenes: NineSlabScenes;
  readonly held: NineHeldInputs;
  readonly construction: Parameters<typeof nineWorldAssembly>[0];
  readonly scriptRevisions: { readonly compiler: ViewContract['compilerRevision']; readonly admission: ViewContract['admissionRevision'] };
  readonly graphArmsSchema: ReturnType<typeof namedJsonSchema>;
  readonly bursts: GrappleRows['bursts'];
  readonly entryProof: { readonly lanes: number; readonly steps: number; readonly portalTransfers: number };
  readonly decals: { readonly sources: Readonly<Record<'phone' | 'desktop', { readonly width: number; readonly height: number; readonly png: string }>> }
    | { readonly blobs: readonly NamedBlob[] };
}

type PlatformDataSectionName = Parameters<typeof emitPlatformSections>[0] extends ReadonlyMap<infer Name, unknown> ? Name : never;

// JSON numbers erase -0; the numeric reviver restores its original float32 sign bit.
const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value, (_key, entry: unknown) => typeof entry === 'number' && Object.is(entry, -0) ? '-0' : entry));
/** Emit owned module bytes directly while the remaining legacy adapters are migrated. */
export function nineOutput(movers: { readonly hash: string } & ({ readonly bytes: Uint8Array } | { readonly source: string }),
  inputs: NineOutputInputs): NineOutput {
const heldGraphFiles = inputs.held.files, { LAYOUT_PLACEMENT_BLOBS, NINE_SCENE_BLOBS, NINE_WORLD_SCENES } = inputs.scenes;
const explorer = nineExplorerDeclarations(inputs.scenes);
const fine = nineSlabSourceFiles(NINE_WORLD_SCENES.libraries, inputs.scenes.NINE_REFINEMENT_SOURCE);
const sourceAssets = new Map<string, Uint8Array>();
for (const [hash, bytes] of inputs.ownedWorld.assets) if (!fine.has(hash)) sourceAssets.set(hash, bytes);
const MOVERS_OPTIONS = { critical: true, script: { abi: 2 as const, lane: 'view' as const, pages: 1, ioBytes: 4096, compilerRevision: inputs.scriptRevisions.compiler, admissionRevision: inputs.scriptRevisions.admission } };
const equipmentRows = { portraitFov: 78, aim: { ...aim, ribbon: filamentGeometry(aim.ropePoints), filament: parseFilamentRows(filamentRows), filamentState: parseHaloState(lightRows.haloState) }, bursts: inputs.bursts } satisfies GrappleRows;


const rawMovers = 'bytes' in movers ? [nameBlob('views/movers.wasm', 'wasm', movers.bytes, MOVERS_OPTIONS)] : [];
const moverSources = 'source' in movers ? [{ name: 'views/movers.wasm', kind: 'wasm' as const, source: movers.source, options: MOVERS_OPTIONS }] : [];
const { decals } = inputs;
const decalSources = 'sources' in decals ? Object.entries(decals.sources).map(([tier, row]) => ({ name: `looks/jian-decal-${tier}.png`, kind: 'image' as const, source: row.png })) : [];
const decalBlobs = 'blobs' in decals ? decals.blobs : [];
if (rawMovers.some(row => row.file.hash !== movers.hash)) throw new Error('Nine movers bytes differ from module hash');
const volumes = lightVolumeBlobs(inputs.ownedWorld.layout, inputs.signs.atlas);
const emitted = emitNamedBlobs(NINE_SCENE_BLOBS.concat(LAYOUT_PLACEMENT_BLOBS, volumes, facadeWindowBlobs(inputs.ownedWorld.layout), [
  nameBlob(NINE_HELD_CARDS, 'json', json(heldCards),{jsonSchema:registeredJsonSchema('models/held-cards.json')}),
  nameBlob('looks/silk-weave.r8', 'bin', silkWeaveBytes(), { decoded: 65_536, gpu: 87_381 }),
  nameBlob('looks/plain-weave.r8', 'bin', plainWeaveBytes(), { decoded: 65_536, gpu: 87_381 }),
  nameBlob('geometry/fixed-kits.json', 'json', json(parseFixedPractice({ practice: grappleCourseScene(course, inputs.courseProgram) })),{jsonSchema:registeredJsonSchema('geometry/fixed-kits.json')}),
  ...JIAN_GEOMETRY.blobs,
  nameBlob('weapons/jian-row.json', 'json', json({ ...equipmentRows, view: heldView(inputs.held), look: { vm: viewmodelUniforms, post: { ...postGraphRow(postRows()), channels: { group: NINE_FRAME_GROUP, programs: NINE_FRAME_CHANNELS } } } }), { jsonSchema: { $schema: 'http://json-schema.org/draft-07/schema#', type: 'object', required: ['portraitFov', 'aim', 'bursts', 'look', 'view'], additionalProperties: false, properties: { view: inputs.graphArmsSchema, look: { type: 'object', required: ['vm', 'post'], additionalProperties: false, properties: { vm: { type: 'object' }, post: { type: 'object', required: ['passes', 'sides', 'composite', 'inputs', 'uniforms', 'sky'] } } }, portraitFov: { type: 'number' }, aim: { type: 'object' }, bursts: { type: 'object', required: ['muzzle', 'bite', 'dock', 'sparks'], additionalProperties: false, properties: Object.fromEntries(['muzzle', 'bite', 'dock', 'sparks'].map(id => [id, { type: 'object', required: ['name', 'shape', 'count', 'life'], additionalProperties: false, properties: { name: { type: 'string' }, shape: { enum: ['flake', 'streak'] }, count: { type: 'integer', minimum: 1, maximum: 24 }, life: { type: 'number', exclusiveMinimum: 0, maximum: 1 } } }])) } } } }),
], rawMovers, decalBlobs, inputs.casts.blobs,
  // The source baker still admits these complete rows before compiling native
  // sign pools; no runtime reads their duplicate JSON files.
  inputs.signs.blobs.filter(row => row.file.name !== 'signs/atlas-phone.json' && row.file.name !== 'signs/atlas-desktop.json'),
  [inputs.courseProgram.blob]));

return { late: [...nineRefinementFiles(NINE_WORLD_SCENES.libraries), ...nineDemandFiles(emitted.files, [...volumes.map(volume => volume.file), ...NINE_SCENE_BLOBS.filter(blob => blob.file.name?.startsWith('world/slabs/')).map(blob => blob.file)])], blobs: [...moverSources,{name:"practice/card.webp",kind:"image",source:"explore/playground-grapple.webp"},...decalSources], namedFiles: emitted.files, assets: new Map([...emitted.assets, ...heldGraphFiles.assets, ...kitKindFiles().map(row => [row.file.hash, row.bytes] as const), [crowdGraphFile().file.hash, crowdGraphFile().bytes], ...sourceAssets]),
  platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([['explore/catalogue', explorer.catalogue], ['ui/strings', strings], ['world/scenes', { ...NINE_WORLD_SCENES, entry: nineWorldEntry(inputs.scenes) }], ['held/arms', heldPrimary], ['actors/return-scripts',[inputs.courseProgram.script]], ['view/modules', [{ id: 'nine.movers', module: `blobs/wasm/${movers.hash}.wasm`, side: 'view', ...MOVERS_OPTIONS.script }]], ['client/plan', {version:1,features:[explorer.sets, practiceCard, {kind:'strings.register'}, {kind:'world.assembly', rows: nineWorldAssembly(inputs.construction, inputs.scenes), entered: { root: 'nine.root', blocks: ['pieces'] }}, {kind:'view.program', id:'movers', rows: nineMoversView(), module: 'views/movers.wasm'}, {kind:'world.runtime-hooks',overhead:[],bounds:{x:[-250,250],z:[-250,250],outer:{maxAbsXZ:200,floor:-20}}}, {kind:'held.claims.prepare',id:'held.primary'}, {kind:'held.claims.install',claims:'held.primary'}, {kind:'held.claims.enter',claims:'held.primary',grapple:{item:'tool.fei-zhua',profile:grappleProfile,hooks:recordedPhysicsPoints(physicsRows.hooks),presentation:'weapons/jian-row.json'}}, {kind:'portal.ride',rows:{director:portals.director,trigger:portals.trigger,fade:portals.fade,veil:portals.veil,landings:portals.landings}}]}]])) };
}

