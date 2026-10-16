// The extras bake remains the geometry owner; expose its exact tiered outputs to the shardfile writer.
import {readFileSync} from 'node:fs';
import {namedBlobOutput} from '../../../../scripts/named-blob-output.mjs';

const project=new URL('../',import.meta.url),root=new URL('../../../../',import.meta.url);
const blobs=namedBlobOutput(project,'pine-creature-blob-inputs','assets/creature-blobs');
for(const tier of ['desktop','phone']){
 const file=`thrall-extras${tier==='phone'?'.phone':''}.glb`,url=`/assets/pine-hollow/creatures/${file}`;
 blobs.add(`models/creatures/${file}`,'glb',new Uint8Array(readFileSync(new URL(`public${url}`,root))),url);
}
blobs.finish(new URL('data/creatureBlobs.generated.json',project));
