// Driftwood's sea grid (per tier) and sea floor (generators/oceanGrid.ts) baked on the real authored ground, bound
// exactly as the faceted-ground producer binds it; hash-named build outputs (data/oceanFiles.ts).
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readNativeTerrain} from '@wildshard/sdk/bake/terrain';
import {bindLevelSelection} from '@wildshard/engine/level/selection';
import {HeightfieldBinding,bindHeightfield,inChunk} from '@wildshard/engine/world/Heightfield';
import {terrainHeight} from '@wildshard/engine/world/terrainHeight';
import manifest from '../discovery.generated';
import {OCEAN} from '../world/sites';
import {ISLAND_KNOBS} from '../tiers.ts';
import {oceanGridGlb,seaFloor} from './oceanGrid.ts';
import {driftwoodGroundBytes} from './groundRows.ts';

const root=new URL('../../../../',import.meta.url),folder=new URL('public/assets/driftwood-isle/baked/',root);
mkdirSync(folder,{recursive:true});
const terrain=manifest.ground.terrain;if(terrain===undefined)throw new Error('Native island ground is required');
const level={id:manifest.slug,ground:{terrain},spawn:manifest.spawn,sky:manifest.sky,atmosphere:manifest.atmosphere,grade:manifest.grade,
 budgets:{},mechanisms:[],fight:{},boot:{files:[]},audio:{ambience:'none',score:'none'},loadout:{weapons:[],tools:[],start:[]},species:[],spawns:[],minimap:{},kitLook:'toon'};
const restoreLevel=bindLevelSelection(level),binding=new HeightfieldBinding(level);
binding.install(readNativeTerrain(driftwoodGroundBytes()));const restoreGround=bindHeightfield(binding);
const emit=(bytes,extension)=>{const file=`ocean-${createHash('sha256').update(bytes).digest('hex')}.${extension}`;writeFileSync(new URL(file,folder),bytes);return `/assets/driftwood-isle/baked/${file}`;};
const files={level:OCEAN.level};
try{
 const ground={heightAt:terrainHeight,inChunk};
 for(const tier of ['phone','desktop'])files[tier]=emit(oceanGridGlb(ground,ISLAND_KNOBS[tier].oceanCell,OCEAN.level,OCEAN.deepDepth),'glb');
 const floor=seaFloor(ground);files.floor=emit(new Uint8Array(floor.buffer,floor.byteOffset,floor.byteLength),'bin');
}finally{restoreGround();restoreLevel();}
console.log(`ocean-files ${JSON.stringify(files)}`);
