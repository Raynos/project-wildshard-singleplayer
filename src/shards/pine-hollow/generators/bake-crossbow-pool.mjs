import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {crossbowPool} from './crossbowPool.ts';
import {CROSSBOW_ROWS} from './crossbowRows.ts';
import {namedBlobOutput} from '../../../../scripts/named-blob-output.mjs';

const made=crossbowPool(),out=new URL('../../../../public/assets/pine-hollow/baked/',import.meta.url);
const hash=createHash('sha256').update(made.glb).digest('hex');
if(hash!=='f2082acfcfb9c9bdce0a6af1745f44de33d38c89ed6fd261f5d6dc346ec46159')throw new Error('Held pool hash changed; update the declared generation output');
mkdirSync(out,{recursive:true});writeFileSync(new URL(`${hash}.glb`,out),made.glb);
made.rows.pool.url=`/assets/pine-hollow/baked/${hash}.glb`;
const blobs=namedBlobOutput(new URL('../',import.meta.url),'pine-held-blobs');
blobs.add('models/held/crossbow-pool.glb','glb',made.glb,made.rows.pool.url);
writeFileSync(new URL('../data/crossbowPool.generated.json',import.meta.url),`${JSON.stringify({...made.rows,rows:CROSSBOW_ROWS})}\n`);
blobs.finish(new URL('../data/heldBlobs.generated.json',import.meta.url));
