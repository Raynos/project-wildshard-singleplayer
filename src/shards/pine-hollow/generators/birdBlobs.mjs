// Preserve both bird tiers and their posed bakes; maps are the exact existing KTX2 producer outputs.
import {readFileSync} from 'node:fs';
import {glbKtx2Key} from '../../../../scripts/ktx2-settings.mjs';
import {namedBlobOutput} from '../../../../scripts/named-blob-output.mjs';
import {split,geometry,texture} from './glbParts.mjs';

const project=new URL('../',import.meta.url),root=new URL('../../../../',import.meta.url);
const read=url=>new Uint8Array(readFileSync(new URL(`public${url}`,root)));
const cache=JSON.parse(readFileSync(new URL('scripts/bake-ktx2.cache.json',root),'utf8'));
const rows=JSON.parse(readFileSync(new URL('data/ambientBirds.generated.json',project),'utf8'));
const blobs=namedBlobOutput(project,'pine-bird-blob-inputs','assets/bird-blobs');
for(const tier of ['desktop','phone']){
 const suffix=tier==='phone'?'.phone':'',url=`/assets/pine-hollow/life/birds${suffix}.glb`,bytes=read(url),encoded=cache[glbKtx2Key(bytes,'v2.50.0')];
 if(typeof encoded!=='string'||!encoded.startsWith('/assets/gpu/pine-hollow/life/'))throw new Error(`Missing existing bird KTX2 bake: ${url}`);
 blobs.add(`models/life/birds${suffix}.base.ktx2`,'ktx2',texture(split(read(encoded)),'base'));
 blobs.add(`models/life/birds${suffix}.glb`,'glb',geometry(split(bytes)),url);
 const posed=tier==='phone'?rows.geometry.replace(/\.glb$/u,'.phone.glb'):rows.geometry;
 blobs.add(`models/life/birds-rest${suffix}.glb`,'glb',read(posed),posed);
}
blobs.finish(new URL('data/birdBlobs.generated.json',project));
