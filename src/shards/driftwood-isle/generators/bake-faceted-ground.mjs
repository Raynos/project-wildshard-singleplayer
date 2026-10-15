// The faceted ground (generators/facetedGround.ts) baked on the real authored ground, bound exactly as the reef and
// island-dressing producers bind it; two hash-named static GLBs, the grid and the slab (data/groundFiles.ts).
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readNativeTerrain} from '@wildshard/sdk/bake/terrain';
import {bindLevelSelection} from '@wildshard/engine/level/selection';
import {HeightfieldBinding,bindHeightfield} from '@wildshard/engine/world/Heightfield';
import manifest from '../discovery.generated';
import {OCEAN} from '../world/sites';
import {GROUND_LOOK} from '../data/groundLook.ts';
import {facetedGroundGlbs} from './facetedGround.ts';
import {driftwoodGroundBytes} from './groundRows.ts';

const root=new URL('../../../../',import.meta.url),folder=new URL('public/assets/driftwood-isle/baked/',root);
mkdirSync(folder,{recursive:true});
const terrain=manifest.ground.terrain;if(terrain===undefined)throw new Error('Native island ground is required');
const level={id:manifest.slug,ground:{terrain},spawn:manifest.spawn,sky:manifest.sky,atmosphere:manifest.atmosphere,grade:manifest.grade,
 budgets:{},mechanisms:[],fight:{},boot:{files:[]},audio:{ambience:'none',score:'none'},loadout:{weapons:[],tools:[],start:[]},species:[],spawns:[],minimap:{},kitLook:'toon'};
const restoreLevel=bindLevelSelection(level),binding=new HeightfieldBinding(level);
binding.install(readNativeTerrain(driftwoodGroundBytes()));const restoreGround=bindHeightfield(binding);
let glbs;
try{glbs=facetedGroundGlbs(binding.field,GROUND_LOOK,OCEAN.level);}
finally{restoreGround();restoreLevel();}
const files={};
for(const [part,bytes] of Object.entries(glbs)){
 const file=`ground-${createHash('sha256').update(bytes).digest('hex')}.glb`;
 writeFileSync(new URL(file,folder),bytes);files[part]=`/assets/driftwood-isle/baked/${file}`;
}
console.log(`ground-files ${JSON.stringify(files)}`);
