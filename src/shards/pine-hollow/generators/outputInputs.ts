import { PINE_HELD_BOW } from './longbow';
import { HANDS_MATERIAL, COAT_MATERIAL } from './handsLook';
import {parseClientChannels,parsePrivateScene} from '@wildshard/format/clientChannels';
import playback from '../data/heldPlayback.json' with {type:'json'};
import inputs from '../data/heldInputs.json' with {type:'json'};
import sights from '../data/heldSights.json' with {type:'json'};
import leverPlayback from '../data/leverPlayback.json' with {type:'json'};
import leverDetails from '../data/leverDetails.json' with {type:'json'};
import toolPlayback from '../data/heldToolPlayback.json' with {type:'json'};
import painted from '../data/paintedTextures.json' with {type:'json'};
import trophies from '../data/trophyMounts.json' with {type:'json'};
import { crossbowPool } from './crossbowPool';
import { CROSSBOW_ROWS } from './crossbowRows';
import { nameMeshoptBlob } from '@wildshard/sdk/blobs';
import { HANDS_POOL } from './handsPoolProduct';
import { CLIENT_BY_URL } from './clientInputs';

// GR8: built by the program, not read from a scheduler job's output
const hands: typeof HANDS_POOL.rows = HANDS_POOL.rows;

// GR8: the held crossbow pool is built here and named as a `meshopt: true` source is (no scheduler job, no stored file)
const CROSSBOW = crossbowPool(), CROSSBOW_NAME = 'models/held/crossbow-pool.glb';
/** The pool's GLB, published beside the client blobs. */
export const CROSSBOW_BLOB: Awaited<ReturnType<typeof nameMeshoptBlob>> = await nameMeshoptBlob(CROSSBOW_NAME, CROSSBOW.glb);
const crossbow: Omit<ReturnType<typeof crossbowPool>['rows'], 'rows'> & { rows: typeof CROSSBOW_ROWS } = { ...CROSSBOW.rows, rows: CROSSBOW_ROWS };
const names:Readonly<Record<string,string>>={...CLIENT_BY_URL};
function named(url:string):string{const name=names[url];if(name===undefined)throw new Error(`Pine output has no named blob: ${url}`);return name;}
const values: { 'custom/heldPlayback': typeof playback; 'custom/heldInputs': typeof inputs; 'custom/heldSights': typeof sights; 'custom/leverPlayback': typeof leverPlayback; 'custom/leverDetails': typeof leverDetails; 'custom/heldToolPlayback': typeof toolPlayback; 'custom/paintedTextures': { textures: Record<string, { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; } | { url: string; srgb: boolean; repeat: boolean; }>; urls: typeof painted.urls; chalk: typeof painted.chalk; }; 'custom/trophyMounts': { url: string; notice: string; sha256: string; rows: typeof trophies.rows; slots: typeof trophies.slots; }; 'custom/crossbowPool': typeof crossbow; 'custom/handsPool': { pool: typeof hands.pool; hands: typeof hands.hands; heldBow: typeof PINE_HELD_BOW; presentation: { hands: typeof HANDS_MATERIAL; coat: typeof COAT_MATERIAL; }; }; }={
 'custom/heldPlayback':playback,'custom/heldInputs':inputs,'custom/heldSights':sights,'custom/leverPlayback':leverPlayback,
 'custom/leverDetails':{...leverDetails,pool:{...leverDetails.pool,url:named(leverDetails.pool.url)}},
 'custom/heldToolPlayback':toolPlayback,
 'custom/paintedTextures':{...painted,textures:Object.fromEntries(Object.entries(painted.textures).map(([key,row])=>[key,{...row,url:named(row.url)}])),urls:painted.urls.map(named)},
 'custom/trophyMounts':{...trophies,url:named(trophies.url)},
 'custom/crossbowPool':{...crossbow,pool:{...crossbow.pool,url:CROSSBOW_NAME}},
 'custom/handsPool':{pool:hands.pool,hands:hands.hands,heldBow:PINE_HELD_BOW,
   presentation:{hands:HANDS_MATERIAL,coat:COAT_MATERIAL}},
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
/** Authored input rows, never imported by a client runtime. */
export const PINE_OUTPUT: { custom: typeof values; }={
 custom:values,
};
