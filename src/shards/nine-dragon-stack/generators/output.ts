import { SIGN_ATLAS_SOURCES } from './signAtlasSources';
import strings from '../data/strings.json' with { type: 'json' };
import practiceCard from '../data/practiceCard.json' with { type: 'json' };
import heldPrimary from '../data/heldPrimary.json' with { type: 'json' };
import { facadeWindowBlobs } from './facadeWindows';
import entryProof from '../data/entryProof.generated.json' with { type: 'json' };
import { heldGraphFiles } from './heldGraphFiles';
import { heldView } from './heldView';
import {CAST_BINARY_SOURCES} from './castSources';
import heldDecals from '../data/heldDecals.generated.json' with { type: 'json' };
import { parseFixedRows,FixedPracticeFileSchema } from './sections';
import { postRows } from './postGraphs';
import { postGraphRow } from './composite';
import { NINE_FRAME_CHANNELS, NINE_FRAME_GROUP } from './frameChannels';
import viewmodelUniforms from '../data/viewmodelUniforms.json' with { type: 'json' };
import filamentRows from '../data/filament.json' with { type: 'json' };
import lightRows from '../data/light.json' with { type: 'json' };
import { filamentGeometry } from './filamentGeometry';
import { grappleCourseScene, NINE_PRACTICE_MODULE } from './courseScene';
import course from '../data/grappleCourse.json' with { type: 'json' };
import * as v from 'valibot';
import { GraphArmsSchema } from '@wildshard/format/graphArmsRows';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import type { GrappleRows } from '../data/grappleTypes';
import aim from '../data/grapple.json' with { type: 'json' };
import bursts from '../data/burstFields.json' with { type: 'json' };
import { layoutBlobs } from './layoutBlobs';
import { nameBlob, emitNamedBlobs } from '@wildshard/sdk/blobs';
import { buildHalo } from './jianHalo';
import { buildViewmodelParts } from './viewmodelParts';
import { headlessConstants } from './headless';
import headlessAssembly from '../data/headlessAssembly.json' with { type: 'json' };
import fixedKits from '../data/fixedKits.generated.json' with { type: 'json' };
import { lightVolumeBlobs } from './lightVolumes';
import lantern from '../data/lantern.json' with { type: 'json' };
import { plainWeaveBytes, silkWeaveBytes } from './silkWeave';
import { LAYOUT_PLACEMENT_BLOBS, NINE_SCENE_BLOBS, NINE_WORLD_SCENES } from './worldScenes';
import { nineWorldEntry } from './worldEntry';
import { nineWorldAssembly } from './worldAssembly';
import { nineMoversView } from './moversView';
import moversModule from '../behaviour/movers.generated.json' with { type: 'json' };
import { SCRIPT_V2_REVISIONS } from '@wildshard/format/scriptAdmissionV2';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';

/** Complete output ownership before the author CLI resolves the remaining file adapters. */
export interface NineOutput extends ProjectOutput {
  readonly blobs: NonNullable<ProjectOutput['blobs']>;
  readonly namedFiles: NonNullable<ProjectOutput['namedFiles']>;
  readonly assets: ReadonlyMap<string, Uint8Array>;
  readonly platform: ReturnType<typeof emitPlatformSections>;
}

const burstSchema = v.strictObject({ name: v.string(), shape: v.picklist(['flake', 'streak']), count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(24)), life: v.pipe(v.number(), v.minValue(0.001), v.maxValue(1)) });
const effectRows = v.parse(v.strictObject({ muzzle: burstSchema, bite: burstSchema, dock: burstSchema, sparks: burstSchema }), bursts);
const equipmentRows = { portraitFov: 78, aim: { ...aim, ribbon: filamentGeometry(aim.ropePoints), filament: filamentRows, filamentState: lightRows.haloState }, bursts: effectRows } satisfies GrappleRows;

// JSON numbers erase -0; the numeric reviver restores its original float32 sign bit.
const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value, (_key, entry: unknown) => typeof entry === 'number' && Object.is(entry, -0) ? '-0' : entry));
const halo = buildHalo();
/** Original float32 channels and material settings; the live halo shaders stay in fpArms. */
const viewmodel = buildViewmodelParts();
// the movers view module (behaviour/movers.as, bake-movers-view.mjs), run by the client plan's view.program
const MOVERS_WASM = {name:'views/movers.wasm',kind:'wasm' as const,source:moversModule.compiled.source,options:
  { critical: true, script: { abi: 2 as const, lane: 'view' as const, pages: 1, ioBytes: 4096, compilerRevision: SCRIPT_V2_REVISIONS.compiler, admissionRevision: SCRIPT_V2_REVISIONS.admission } }};
const PRACTICE_WASM={name:'behaviour/practice.wasm',kind:'wasm' as const,source:NINE_PRACTICE_MODULE.source,options:{critical:true,script:{abi:1 as const,pages:NINE_PRACTICE_MODULE.script.pages}}};
/** Emit owned module bytes directly while the remaining legacy adapters are migrated. */
export function nineOutput(movers?: { readonly hash: string; readonly bytes: Uint8Array }): NineOutput {
const rawMovers = movers === undefined ? [] : [nameBlob('views/movers.wasm', 'wasm', movers.bytes, MOVERS_WASM.options)];
if (rawMovers.some(row => row.file.hash !== movers?.hash)) throw new Error('Nine movers bytes differ from module hash');
const emitted = emitNamedBlobs(NINE_SCENE_BLOBS.concat(LAYOUT_PLACEMENT_BLOBS, lightVolumeBlobs(), layoutBlobs(), facadeWindowBlobs(), [
  nameBlob('looks/silk-weave.r8', 'bin', silkWeaveBytes(), { decoded: 65_536, gpu: 87_381 }),
  nameBlob('looks/plain-weave.r8', 'bin', plainWeaveBytes(), { decoded: 65_536, gpu: 87_381 }),
  nameBlob('geometry/fixed-kits.json', 'json', json({ practice: parseFixedRows({ ...fixedKits, lantern, practice: grappleCourseScene(course) }).practice }),{jsonSchema:namedJsonSchema(FixedPracticeFileSchema)}),
  nameBlob('weapons/jian-cloth.json', 'json', json(Object.fromEntries(Object.entries(viewmodel).map(([name, geometry], i) => [name, { ...geometry.toJSON(), uuid: `96d3a000-0000-4000-8000-00000000002${i}` }])))),
  nameBlob('sim/headless-assembly.json', 'json', json(headlessAssembly)),
  nameBlob('sim/headless-constants.json', 'json', json({ ...headlessConstants, entryProof })),
  nameBlob('weapons/jian-row.json', 'json', json({ ...equipmentRows, view: heldView(), look: { vm: viewmodelUniforms, post: { ...postGraphRow(postRows()), channels: { group: NINE_FRAME_GROUP, programs: NINE_FRAME_CHANNELS } } } }), { jsonSchema: { $schema: 'http://json-schema.org/draft-07/schema#', type: 'object', required: ['portraitFov', 'aim', 'bursts', 'look', 'view'], additionalProperties: false, properties: { view: namedJsonSchema(GraphArmsSchema), look: { type: 'object', required: ['vm', 'post'], additionalProperties: false, properties: { vm: { type: 'object' }, post: { type: 'object', required: ['passes', 'sides', 'composite', 'inputs', 'uniforms', 'sky'] } } }, portraitFov: { type: 'number' }, aim: { type: 'object' }, bursts: { type: 'object', required: ['muzzle', 'bite', 'dock', 'sparks'], additionalProperties: false, properties: Object.fromEntries(['muzzle', 'bite', 'dock', 'sparks'].map(id => [id, { type: 'object', required: ['name', 'shape', 'count', 'life'], additionalProperties: false, properties: { name: { type: 'string' }, shape: { enum: ['flake', 'streak'] }, count: { type: 'integer', minimum: 1, maximum: 24 }, life: { type: 'number', exclusiveMinimum: 0, maximum: 1 } } }])) } } } }),
  nameBlob('weapons/jian-halo.json', 'json', json({ geometry: { ...halo.geo.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000001' }, material: { ...halo.mat.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000002' } })),
], rawMovers));

return { blobs: [...(movers === undefined ? [MOVERS_WASM] : []),PRACTICE_WASM,{name:"practice/card.webp",kind:"image",source:"explore/playground-grapple.webp"},...CAST_BINARY_SOURCES,...SIGN_ATLAS_SOURCES,...Object.entries(heldDecals).map(([tier,row])=>({name:`looks/jian-decal-${tier}.png`,kind:'image' as const,source:row.png}))], namedFiles: emitted.files, assets: new Map([...emitted.assets, ...heldGraphFiles.assets]),
  platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([['ui/strings', strings], ['world/scenes', { ...NINE_WORLD_SCENES, entry: nineWorldEntry() }], ['held/arms', heldPrimary], ['actors/return-scripts',[NINE_PRACTICE_MODULE.script]], ['view/modules', [{ id: 'nine.movers', module: `blobs/wasm/${movers?.hash ?? moversModule.compiled.hash}.wasm`, side: 'view', ...MOVERS_WASM.options.script }]], ['client/plan', {version:1,features:[practiceCard, {kind:'strings.register'}, {kind:'world.assembly', rows: nineWorldAssembly(), entered: { root: 'nine.root', blocks: ['pieces'] }}, {kind:'view.program', id:'movers', rows: nineMoversView(), module: 'views/movers.wasm'}, {kind:'world.runtime-hooks',overhead:[],bounds:{x:[-250,250],z:[-250,250],outer:{maxAbsXZ:200,floor:-20}}}, {kind:'held.claims.prepare',id:'held.primary'}, {kind:'held.claims.install',claims:'held.primary'}, {kind:'held.claims.enter',claims:'held.primary',grapple:{item:'tool.fei-zhua',source:'sim/headless-constants.json',presentation:'weapons/jian-row.json'}}, {kind:'portal.ride',source:'sim/headless-constants.json'}]}]])) };
}

/** Retained sidecar authority until the source entry returns its own output. */
export const output = nineOutput();
