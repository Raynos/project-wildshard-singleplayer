// Retain original producer payloads; expose only the client's required immutable inputs.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {namedBlobOutput} from '../../../../scripts/named-blob-output.mjs';

const project=new URL('../',import.meta.url),root=new URL('../../../../',import.meta.url);
const json=path=>JSON.parse(readFileSync(new URL(path,project),'utf8'));
const blobs=namedBlobOutput(project,'pine-client-blobs');
const add=(name,kind,url)=>blobs.add(name,kind,new Uint8Array(readFileSync(new URL(`public${url}`,root))),url);
const painted=json('data/paintedTextures.generated.json');
for(const [key,row]of Object.entries(painted.textures))add(`textures/painted/${key}.${row.url.split('.').at(-1)}`,'image',row.url);
const trophies=json('data/trophyMounts.json');
add('models/trophies/mounts.bin','bin',trophies.url);
const details=json('data/leverDetails.json');
add('models/held/lever-details.glb','glb',details.pool.url);
const hands=json('data/handsPool.generated.json');
add('models/held/hands.glb','glb',hands.pool.url);
blobs.finish(new URL('data/clientBlobs.generated.json',project));
console.info(`Pine client inputs: immutable sources under ${fileURLToPath(project)}`);
