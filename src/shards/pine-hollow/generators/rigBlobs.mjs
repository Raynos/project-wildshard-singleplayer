// Split existing creature assets into admitted geometry and the exact KTX2 maps already shipped by bake-ktx2.
import {readFileSync} from 'node:fs';
import {PINE_HULLS} from '../data/creatureHulls.ts';
import {glbKtx2Key} from '../../../../scripts/ktx2-settings.mjs';
import {namedBlobOutput} from '../../../../scripts/named-blob-output.mjs';
import {split,geometry,texture} from './glbParts.mjs';

const project=new URL('../',import.meta.url),root=new URL('../../../../',import.meta.url);
const read=url=>new Uint8Array(readFileSync(new URL(`public${url}`,root)));
const cache=JSON.parse(readFileSync(new URL('scripts/bake-ktx2.cache.json',root),'utf8'));
// Retained bake identity: extracting existing outputs does not require the encoder on build machines.
const encoder='v2.50.0';
const blobs=namedBlobOutput(project,'pine-rig-blob-inputs','assets/rig-blobs');
for(const tier of ['desktop','phone'])for(const hull of PINE_HULLS.rigs){
 const name=`${hull}${tier==='phone'?'.phone':''}`,url=`/assets/pine-hollow/creatures/${name}.rigged.glb`,bytes=read(url),encoded=cache[glbKtx2Key(bytes,encoder)];
 if(typeof encoded!=='string'||!encoded.startsWith('/assets/gpu/pine-hollow/creatures/'))throw new Error(`Missing existing creature KTX2 bake: ${url}`);
 const raw=split(bytes),baked=split(read(encoded));
 blobs.add(`models/creatures/${name}.base.ktx2`,'ktx2',texture(baked,'base'));
 blobs.add(`models/creatures/${name}.normal.ktx2`,'ktx2',texture(baked,'normal'));
 blobs.add(`models/creatures/${name}.rigged.glb`,'glb',geometry(raw),url);
}
blobs.finish(new URL('data/rigBlobs.generated.json',project));
