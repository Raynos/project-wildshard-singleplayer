import practiceCard from '../data/practiceCard.json' with { type: 'json' };
import { facadeWindowBlobs } from './facadeWindows';
import entryProof from '../data/entryProof.generated.json' with { type: 'json' };
import { heldGraphFiles } from './heldGraphFiles';
import { heldView } from './heldView';
import heldDecals from '../data/heldDecals.generated.json' with { type: 'json' };
import { parseFixedRows,FixedPracticeFileSchema } from './sections';
import sharedUniforms from '../data/sharedUniforms.json' with { type: 'json' };
import AO_TUNING from '../data/aoLook.json' with { type: 'json' };
import { postRows } from './postGraphs';
import viewmodelUniforms from '../data/viewmodelUniforms.json' with { type: 'json' };
import filamentRows from '../data/filament.json' with { type: 'json' };
import lightRows from '../data/light.json' with { type: 'json' };
import { filamentGeometry } from './filamentGeometry';
import { grappleCourseScene } from './courseScene';
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
import { spillBlobs } from './spillBlobs';
import { plainWeaveBytes, silkWeaveBytes } from './silkWeave';
import { NINE_SCENE_BLOBS, NINE_WORLD_SCENES } from './worldScenes';
import { nineWorldEntry } from './worldEntry';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';

const burstSchema = v.strictObject({ name: v.string(), shape: v.picklist(['flake', 'streak']), count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(24)), life: v.pipe(v.number(), v.minValue(0.001), v.maxValue(1)) });
const effectRows = v.parse(v.strictObject({ muzzle: burstSchema, bite: burstSchema, dock: burstSchema, sparks: burstSchema }), bursts);
const equipmentRows = { portraitFov: 78, aim: { ...aim, ribbon: filamentGeometry(aim.ropePoints), filament: filamentRows, filamentState: lightRows.haloState }, bursts: effectRows } satisfies GrappleRows;

// JSON numbers erase -0; the numeric reviver restores its original float32 sign bit.
const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value, (_key, entry: unknown) => typeof entry === 'number' && Object.is(entry, -0) ? '-0' : entry));
const halo = buildHalo();
/** Original float32 channels and material settings; the live halo shaders stay in fpArms. */
const viewmodel = buildViewmodelParts();
const emitted = emitNamedBlobs(NINE_SCENE_BLOBS.concat(lightVolumeBlobs(), spillBlobs(), layoutBlobs(), facadeWindowBlobs(), [
  ...Object.entries(heldDecals).map(([tier, row]) => nameBlob(`looks/jian-decal-${tier}.png`, 'image', Uint8Array.from(atob(row.png), character => character.codePointAt(0) ?? 0))),
  nameBlob('looks/silk-weave.r8', 'bin', silkWeaveBytes(), { decoded: 65_536, gpu: 87_381 }),
  nameBlob('looks/plain-weave.r8', 'bin', plainWeaveBytes(), { decoded: 65_536, gpu: 87_381 }),
  nameBlob('geometry/fixed-kits.json', 'json', json({ practice: parseFixedRows({ ...fixedKits, lantern, practice: grappleCourseScene(course) }).practice }),{jsonSchema:namedJsonSchema(FixedPracticeFileSchema)}),
  nameBlob('weapons/jian-cloth.json', 'json', json(Object.fromEntries(Object.entries(viewmodel).map(([name, geometry], i) => [name, { ...geometry.toJSON(), uuid: `96d3a000-0000-4000-8000-00000000002${i}` }])))),
  nameBlob('sim/headless-assembly.json', 'json', json(headlessAssembly)),
  nameBlob('sim/headless-constants.json', 'json', json({ ...headlessConstants, entryProof })),
  nameBlob('weapons/jian-row.json', 'json', json({ ...equipmentRows, view: heldView(), look: { shared: sharedUniforms, vm: viewmodelUniforms, post: postRows(), ao: AO_TUNING } }), { jsonSchema: { $schema: 'http://json-schema.org/draft-07/schema#', type: 'object', required: ['portraitFov', 'aim', 'bursts', 'look', 'view'], additionalProperties: false, properties: { view: namedJsonSchema(GraphArmsSchema), look: { type: 'object', required: ['shared', 'vm', 'post', 'ao'], additionalProperties: false, properties: { shared: { type: 'object' }, vm: { type: 'object' }, post: { type: 'object', required: ['bleed', 'reflect', 'haze'], additionalProperties: false, properties: { bleed: { type: 'object' }, reflect: { type: 'object' }, haze: { type: 'object' } } }, ao: { type: 'object' } } }, portraitFov: { type: 'number' }, aim: { type: 'object' }, bursts: { type: 'object', required: ['muzzle', 'bite', 'dock', 'sparks'], additionalProperties: false, properties: Object.fromEntries(['muzzle', 'bite', 'dock', 'sparks'].map(id => [id, { type: 'object', required: ['name', 'shape', 'count', 'life'], additionalProperties: false, properties: { name: { type: 'string' }, shape: { enum: ['flake', 'streak'] }, count: { type: 'integer', minimum: 1, maximum: 24 }, life: { type: 'number', exclusiveMinimum: 0, maximum: 1 } } }])) } } } }),
  nameBlob('weapons/jian-halo.json', 'json', json({ geometry: { ...halo.geo.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000001' }, material: { ...halo.mat.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000002' } })),
]));

export const output = { blobs: [{name:"practice/card.webp",kind:"image",source:"explore/playground-grapple.webp"}], namedFiles: emitted.files, assets: new Map([...emitted.assets, ...heldGraphFiles.assets]),
  platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([['world/scenes', { ...NINE_WORLD_SCENES, entry: nineWorldEntry() }], ['client/plan', {version:1,features:[practiceCard]}]])) };
