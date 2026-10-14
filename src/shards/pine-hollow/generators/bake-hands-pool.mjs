import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {handsPool} from './handsPool.ts';

const made=handsPool(),out=new URL('../../../../public/assets/pine-hollow/baked/',import.meta.url);
const hash=createHash('sha256').update(made.glb).digest('hex');
if(hash!=='e9ca424824e8b66289cd3593b2fa66b7e9c7a546d03fe289ec404af59d7d90b2')throw new Error(`Hands pool hash changed (${hash}); update the declared generation output`);
mkdirSync(out,{recursive:true});writeFileSync(new URL(`${hash}.glb`,out),made.glb);
made.rows.pool.url=`/assets/pine-hollow/baked/${hash}.glb`;
writeFileSync(new URL('../data/handsPool.generated.json',import.meta.url),`${JSON.stringify(made.rows)}\n`);
