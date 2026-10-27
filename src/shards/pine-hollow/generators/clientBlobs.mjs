// Retain original producer payloads; expose only the client's required immutable inputs.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {namedBlobOutput} from '../../../../scripts/named-blob-output.mjs';
import {leverDetailPool} from './crossbowPool.ts';
import {HANDS_POOL,HANDS_POOL_NAME} from './handsPoolProduct.ts';

const project=new URL('../',import.meta.url),root=new URL('../../../../',import.meta.url);
const json=path=>JSON.parse(readFileSync(new URL(path,project),'utf8'));
const blobs=namedBlobOutput(project,'pine-client-blobs');
const add=(name,kind,url)=>blobs.add(name,kind,new Uint8Array(readFileSync(new URL(`public${url}`,root))),url);
const painted=json('data/paintedTextures.json');
for(const [key,row]of Object.entries(painted.textures))add(`textures/painted/${key}.${row.url.split('.').at(-1)}`,'image',row.url);
const trophies=json('data/trophyMounts.json');
add('models/trophies/mounts.bin','bin',trophies.url);
const details=json('data/leverDetails.json');
// GR8: the rifle's detail pool is built here (no scheduler job, no stored GLB), under its declared URL alias
blobs.add('models/held/lever-details.glb','glb',leverDetailPool(),details.pool.url);
// GR8: the hands pool is built here too (no scheduler job, no stored GLB), under its retired SHA-256 URL as the alias
blobs.add(HANDS_POOL_NAME,'glb',HANDS_POOL.glb,`/assets/pine-hollow/baked/${createHash('sha256').update(HANDS_POOL.glb).digest('hex')}.glb`);
blobs.finish(new URL('data/clientBlobs.generated.json',project));
console.info(`Pine client inputs: immutable sources under ${fileURLToPath(project)}`);
