import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {islandDressing} from './islandDressing.ts';

const root=new URL('../../../../',import.meta.url),folder=new URL('public/assets/driftwood-isle/baked/',root);
const data=await islandDressing(url=>new Uint8Array(readFileSync(new URL(`public${url}`,root))));
mkdirSync(folder,{recursive:true});
const tiers={};
for(const row of data.tiers){
 const hash=createHash('sha256').update(row.cover.bytes).digest('hex'),file=`island-cover-${hash}.bin`;
 writeFileSync(new URL(file,folder),row.cover.bytes);
 tiers[row.tier]={clips:row.clips,cover:{url:`/assets/driftwood-isle/baked/${file}`,hash,bytes:row.cover.bytes.length,used:row.cover.used,floats:(row.cover.bytes.length-16)/4,rect:row.cover.rect}};
}
writeFileSync(new URL('../data/islandDressing.generated.json',import.meta.url),`${JSON.stringify(Object.fromEntries(Object.entries(tiers).map(([tier,row])=>[tier,row.clips])))}\n`);
console.log('Island dressing: native triangle runs and two cropped full cover grids');
console.log(`cover-files ${JSON.stringify(Object.fromEntries(Object.entries(tiers).map(([tier,row])=>[tier,row.cover])))}`);
