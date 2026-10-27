import elites from '../behaviour/elites.generated.json' with {type:'json'};
import { PINE_HELD_BOW } from './longbow';
import { HANDS_MATERIAL, COAT_MATERIAL } from './handsLook';
import {parseClientChannels,parsePrivateScene} from '@wildshard/format/clientChannels';
import journal from '../data/journalBlobs.generated.json' with {type:'json'};
import playback from '../data/heldPlayback.json' with {type:'json'};
import inputs from '../data/heldInputs.json' with {type:'json'};
import sights from '../data/heldSights.json' with {type:'json'};
import leverPlayback from '../data/leverPlayback.json' with {type:'json'};
import leverDetails from '../data/leverDetails.json' with {type:'json'};
import toolPlayback from '../data/heldToolPlayback.json' with {type:'json'};
import painted from '../data/paintedTextures.generated.json' with {type:'json'};
import trophies from '../data/trophyMounts.json' with {type:'json'};
import { crossbowPool } from './crossbowPool';
import { CROSSBOW_ROWS } from './crossbowRows';
import { nameMeshoptBlob } from '@wildshard/sdk/blobs';
import hands from '../data/handsPool.generated.json' with {type:'json'};
import client from '../data/clientBlobs.generated.json' with {type:'json'};
import night from '../behaviour/night.generated.json' with {type:'json'};
import director from '../behaviour/director.json' with {type:'json'};
import king from '../data/kingBlobs.generated.json' with {type:'json'};
import creatures from '../data/creatureBlobs.generated.json' with {type:'json'};
import rigs from '../data/rigBlobs.generated.json' with {type:'json'};
import birds from '../data/birdBlobs.generated.json' with {type:'json'};
import streams from '../data/streamBlobs.generated.json' with {type:'json'};
import kingKit from '../data/kingKit.generated.json' with {type:'json'};

// GR8: the held crossbow pool is built here and named as a `meshopt: true` source is (no scheduler job, no stored file)
const CROSSBOW = crossbowPool(), CROSSBOW_NAME = 'models/held/crossbow-pool.glb';
/** The pool's GLB, published beside the client blobs. */
export const CROSSBOW_BLOB: Awaited<ReturnType<typeof nameMeshoptBlob>> = await nameMeshoptBlob(CROSSBOW_NAME, CROSSBOW.glb);
const crossbow = { ...CROSSBOW.rows, rows: CROSSBOW_ROWS };
const names:Readonly<Record<string,string>>={...client.byUrl,...king.byUrl,...birds.byUrl,...streams.byUrl};
function named(url:string):string{const name=names[url];if(name===undefined)throw new Error(`Pine output has no named blob: ${url}`);return name;}
const values: { 'custom/heldPlayback': typeof playback; 'custom/heldInputs': typeof inputs; 'custom/heldSights': typeof sights; 'custom/leverPlayback': typeof leverPlayback; 'custom/leverDetails': typeof leverDetails; 'custom/heldToolPlayback': typeof toolPlayback; 'custom/paintedTextures': { textures: Record<string, { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; }>; urls: typeof painted.urls; chalk: typeof painted.chalk; }; 'custom/trophyMounts': { url: string; notice: string; sha256: string; rows: typeof trophies.rows; slots: typeof trophies.slots; }; 'custom/crossbowPool': typeof crossbow; 'custom/handsPool': { pool: typeof hands.pool; hands: typeof hands.hands; heldBow: typeof PINE_HELD_BOW; presentation: { hands: typeof HANDS_MATERIAL; coat: typeof COAT_MATERIAL; }; }; 'custom/kingKit': typeof kingKit; }={
 'custom/heldPlayback':playback,'custom/heldInputs':inputs,'custom/heldSights':sights,'custom/leverPlayback':leverPlayback,
 'custom/leverDetails':{...leverDetails,pool:{...leverDetails.pool,url:named(leverDetails.pool.url)}},
 'custom/heldToolPlayback':toolPlayback,
 'custom/paintedTextures':{...painted,textures:Object.fromEntries(Object.entries(painted.textures).map(([key,row])=>[key,{...row,url:named(row.url)}])),urls:painted.urls.map(named)},
 'custom/trophyMounts':{...trophies,url:named(trophies.url)},
 'custom/crossbowPool':{...crossbow,pool:{...crossbow.pool,url:CROSSBOW_NAME}},
 'custom/handsPool':{pool:{...hands.pool,url:named(hands.pool.url)},hands:hands.hands,heldBow:PINE_HELD_BOW,
   presentation:{hands:HANDS_MATERIAL,coat:COAT_MATERIAL}},
 'custom/kingKit':{...kingKit,pool:{...kingKit.pool,url:named(kingKit.pool.url)}},
};

// Semantic host laws are kept in their defining public parsers. The serialized
// custom schema checks structure; publication also checks the runtime registry.
parsePrivateScene(crossbow.hierarchy);
function checkPrograms(value:unknown):void{
 if(Array.isArray(value)){for(const row of value)checkPrograms(row);return;}
 if(typeof value!=='object'||value===null)return;
 if('nodes' in value&&'channels' in value&&'reads' in value)parseClientChannels([value]);
 else for(const child of Object.values(value))checkPrograms(child);
}
for(const value of [playback,inputs,sights,leverPlayback,toolPlayback])checkPrograms(value);
function withGeometryCosts(row:(typeof client.blobs)[number]): (typeof client.blobs)[number] | { options: { decoded: number; gpu: number; triangles: number; draws: number; }; name: string; kind: string; source: string; }{
 if(row.name!=='models/trophies/mounts.bin')return row;
 return {...row,options:{decoded:trophies.rows.bytes,gpu:trophies.rows.bytes,
  triangles:trophies.rows.geometries.reduce((sum,geometry)=>sum+geometry.count/3,0),draws:trophies.rows.geometries.length}};
}
/** Authored input rows, never imported by a client runtime. */
export const PINE_OUTPUT: { blobs: ((typeof journal.blobs)[number] | ReturnType<typeof withGeometryCosts> | (typeof king.blobs)[number] | (typeof creatures.blobs)[number] | (typeof rigs.blobs)[number] | (typeof birds.blobs)[number] | (typeof streams.blobs)[number] | { name: string; kind: "wasm"; source: string; options: { critical: boolean; script: { abi: 1; pages: number; }; }; } | { name: string; kind: "wasm"; source: string; options: { script: { abi: 0; }; }; })[]; custom: typeof values; }={
 blobs:[...journal.blobs,...client.blobs.map(withGeometryCosts),...king.blobs,...creatures.blobs,...rigs.blobs,...birds.blobs,...streams.blobs,
 ...elites.fights.map(fight => ({name:`behaviour/elites/${fight.def.id}.wasm`,kind:'wasm' as const,source:`assets/${fight.program.script.module.slice('blobs/wasm/'.length, -'.wasm'.length)}`,options:{critical:true,script:{abi:1 as const,pages:1}}})),
 {name:'behaviour/night.wasm',kind:'wasm' as const,source:`assets/${night.script.module.slice('blobs/wasm/'.length, -'.wasm'.length)}`,options:{critical:true,script:{abi:1 as const,pages:1}}},
 {name:'behaviour/director.wasm',kind:'wasm' as const,source:`assets/${director.module}`,options:{script:{abi:0 as const}}}],
 custom:values,
};
