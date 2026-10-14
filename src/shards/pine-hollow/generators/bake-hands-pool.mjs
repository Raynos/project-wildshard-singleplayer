import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {handsPool} from './handsPool.ts';

const made=await handsPool(),out=new URL('../../../../public/assets/pine-hollow/baked/',import.meta.url);
const hash=createHash('sha256').update(made.glb).digest('hex');
if(hash!=='9500ccf884a8bf642237d00c950f96c6aa81e6b06307d7f517adf0c7e4ae5020')throw new Error(`Hands pool hash changed (${hash}); update the declared generation output`);
mkdirSync(out,{recursive:true});writeFileSync(new URL(`${hash}.glb`,out),made.glb);
made.rows.pool.url=`/assets/pine-hollow/baked/${hash}.glb`;
writeFileSync(new URL('../data/handsPool.generated.json',import.meta.url),`${JSON.stringify(made.rows)}\n`);
