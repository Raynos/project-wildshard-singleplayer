import {namedBlobOutput} from '../../../../scripts/named-blob-output.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MeshStandardMaterial} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {staticGlb} from '@wildshard/sdk/bake/glb';
import {readNativeTerrain} from '@wildshard/sdk/bake/terrain';
import {Rng} from '@wildshard/engine/core/rng';
import {bindLevelSelection} from '@wildshard/engine/level/selection';
import {HeightfieldBinding,bindHeightfield} from '@wildshard/engine/world/Heightfield';
import {terrainHeight} from '@wildshard/engine/world/terrainHeight';
import { WRECK } from './worldSites';
import manifest from '../discovery.generated';
import {REEF_SPECIMENS,REEF_MODEL_SEED} from './reefSpecimenRows.ts';
import {LAGOON_REEF,reefLayoutJson,scatterLagoon} from './reefScatter.ts';
import {reefGeometry} from './reef.ts';
import {driftwoodGroundBytes} from './groundRows.ts';
import {foliageTransport} from './hibiscusTransport.ts';

const root=new URL('../../../../',import.meta.url),folder=new URL('public/assets/driftwood-isle/baked/',root);
mkdirSync(folder,{recursive:true});
const files={coral:{},weed:{},star:{}},blobs=namedBlobOutput(new URL('../',import.meta.url),'driftwood-reef-blobs');
const emit=(bytes,extension,name)=>{const hash=createHash('sha256').update(bytes).digest('hex'),file=`reef-${hash}.${extension}`;writeFileSync(new URL(file,folder),bytes);const url=`/assets/driftwood-isle/baked/${file}`;blobs.add(name,extension,bytes,url);return url;};
// The lagoon scatter and weld run on the real authored ground, bound exactly as the island-dressing producer binds it.
const terrain=manifest.ground.terrain;if(terrain===undefined)throw new Error('Native island ground is required');
const level={id:manifest.slug,ground:{terrain},spawn:manifest.spawn,sky:manifest.sky,atmosphere:manifest.atmosphere,grade:manifest.grade,
 budgets:{},mechanisms:[],fight:{},boot:{files:[]},audio:{ambience:'none',score:'none'},loadout:{weapons:[],tools:[],start:[]},species:[],spawns:[],minimap:{},kitLook:'toon'};
const restoreLevel=bindLevelSelection(level),binding=new HeightfieldBinding(level);
binding.install(readNativeTerrain(driftwoodGroundBytes()));const restoreGround=bindHeightfield(binding);
try{
 // The lagoon's layout (world/Seabed.ts reads it): 360 copies, the wreck kept clear, welded in scatter order from one stream.
 const layout=scatterLagoon(manifest.seed,360,[{x:WRECK.x,z:WRECK.z,r:18}]),rng=new Rng(LAGOON_REEF.buildSeed);
 writeFileSync(new URL('src/shards/driftwood-isle/data/reefLayout.generated.json',root),reefLayoutJson(layout));
 const originals=layout.items.map(p=>{
  if(p.kind!=='coral'&&p.kind!=='weed'&&p.kind!=='star')throw new Error('Unknown authored reef kind');
  return reefGeometry(p.kind,{s:p.s,rot:p.rot,v:p.v},rng).translate(p.x,terrainHeight(p.x,p.z),p.z);
 });
 const geometry=mergeGeometries(originals,false),vertices=geometry.getAttribute('position').count;
 try{files.world=emit(foliageTransport(geometry,originals,{vertices,indices:0,output:vertices,runs:[{start:0,count:vertices}]},0x31464552,['position','color','aSway']),'bin','world/reef.bin');}
 finally{geometry.dispose();for(const shape of originals)shape.dispose();}
}finally{restoreGround();restoreLevel();}
// Explorer cards: each authored default and variant, from the model's own seed, loaded only when selected.
for(const kind of ['coral','weed','star']){
 const row=REEF_SPECIMENS[kind];
 for(const variant of [{id:'default',params:row.defaults},...row.variants.map(v=>({id:v.id,params:{...row.defaults,...v.params}}))]){
  const shape=reefGeometry(kind,variant.params,new Rng(REEF_MODEL_SEED)),material=new MeshStandardMaterial();
  try{files[kind][variant.id]=emit(staticGlb([{geometry:shape,material,customAttributes:{_SWAY:'aSway'},compactIndex:true}],`reef-${kind}`),'glb',`models/reef/${kind}/${variant.id}.glb`);}
  finally{shape.dispose();material.dispose();}
 }
}
console.log(`reef-files ${JSON.stringify(files)}`);

blobs.finish(new URL('../data/reefBlobs.generated.json',import.meta.url));
