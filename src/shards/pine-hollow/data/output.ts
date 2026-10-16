import {parseAmbientLife} from '@wildshard/format/ambientLife';
import {parseClientChannels,parsePrivateScene} from '@wildshard/format/clientChannels';
import pickups from './skinPickups.json' with {type:'json'};
import {PINE_FEATS,PINE_BAG_ITEMS} from './questInventory';
import {PINE_LIFE} from './ambientLife';
import playback from './heldPlayback.json' with {type:'json'};
import inputs from './heldInputs.json' with {type:'json'};
import sights from './heldSights.json' with {type:'json'};
import leverPlayback from './leverPlayback.json' with {type:'json'};
import leverDetails from './leverDetails.json' with {type:'json'};
import toolPlayback from './heldToolPlayback.json' with {type:'json'};
import painted from './paintedTextures.generated.json' with {type:'json'};
import trophies from './trophyMounts.json' with {type:'json'};
import crossbow from './crossbowPool.generated.json' with {type:'json'};
import hands from './handsPool.generated.json' with {type:'json'};
import client from './clientBlobs.generated.json' with {type:'json'};
import held from './heldBlobs.generated.json' with {type:'json'};
import night from '../behaviour/night.generated.json' with {type:'json'};
import director from '../behaviour/director.json' with {type:'json'};
import king from './kingBlobs.generated.json' with {type:'json'};
import creatures from './creatureBlobs.generated.json' with {type:'json'};
import rigs from './rigBlobs.generated.json' with {type:'json'};
import birds from './birdBlobs.generated.json' with {type:'json'};
import crags from './cragBlobs.generated.json' with {type:'json'};
import streams from './streamBlobs.generated.json' with {type:'json'};
import kingKit from './kingKit.generated.json' with {type:'json'};

const names:Readonly<Record<string,string>>={...client.byUrl,...held.byUrl,...king.byUrl,...birds.byUrl,...crags.byUrl,...streams.byUrl};
function named(url:string):string{const name=names[url];if(name===undefined)throw new Error(`Pine output has no named blob: ${url}`);return name;}
const values:Readonly<Record<string,unknown>>={
 'custom/skinPickups':pickups,
 'custom/questInventory':{feats:PINE_FEATS,items:PINE_BAG_ITEMS},
 'custom/ambientLife':PINE_LIFE,
 'custom/heldPlayback':playback,'custom/heldInputs':inputs,'custom/heldSights':sights,'custom/leverPlayback':leverPlayback,
 'custom/leverDetails':{...leverDetails,pool:{...leverDetails.pool,url:named(leverDetails.pool.url)}},
 'custom/heldToolPlayback':toolPlayback,
 'custom/paintedTextures':{...painted,textures:Object.fromEntries(Object.entries(painted.textures).map(([key,row])=>[key,{...row,url:named(row.url)}])),urls:painted.urls.map(named)},
 'custom/trophyMounts':{...trophies,url:named(trophies.url)},
 'custom/crossbowPool':{...crossbow,pool:{...crossbow.pool,url:named(crossbow.pool.url)}},
 'custom/handsPool':{...hands,pool:{...hands.pool,url:named(hands.pool.url)}},
 'custom/kingKit':{...kingKit,pool:{...kingKit.pool,url:named(kingKit.pool.url)}},
};

// Semantic host laws are kept in their defining public parsers. The serialized
// custom schema checks structure; publication also checks the runtime registry.
parseAmbientLife(PINE_LIFE);
parsePrivateScene(crossbow.hierarchy);
function checkPrograms(value:unknown):void{
 if(Array.isArray(value)){for(const row of value)checkPrograms(row);return;}
 if(typeof value!=='object'||value===null)return;
 if('nodes' in value&&'channels' in value&&'reads' in value)parseClientChannels([value]);
 else for(const child of Object.values(value))checkPrograms(child);
}
for(const value of [playback,inputs,sights,leverPlayback,toolPlayback])checkPrograms(value);
function withGeometryCosts(row:(typeof client.blobs)[number]){
 if(row.name!=='models/trophies/mounts.bin')return row;
 return {...row,options:{decoded:trophies.rows.bytes,gpu:trophies.rows.bytes,
  triangles:trophies.rows.geometries.reduce((sum,geometry)=>sum+geometry.count/3,0),draws:trophies.rows.geometries.length}};
}
/** Authored input rows, never imported by a client runtime. */
export const PINE_OUTPUT={
 blobs:[...client.blobs.map(withGeometryCosts),...held.blobs,...king.blobs,...creatures.blobs,...rigs.blobs,...birds.blobs,...crags.blobs,...streams.blobs,
 {name:'behaviour/night.wasm',kind:'wasm' as const,source:`assets/${night.module}`,options:{script:{abi:0 as const}}},
 {name:'behaviour/director.wasm',kind:'wasm' as const,source:`assets/${director.module}`,options:{script:{abi:0 as const}}}],
 custom:values,
};
