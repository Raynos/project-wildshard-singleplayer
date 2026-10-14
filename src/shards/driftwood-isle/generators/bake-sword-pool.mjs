import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {swordPool} from './swordPool.ts';

const made=swordPool(),out=new URL('../../../../public/assets/driftwood-isle/baked/',import.meta.url);
const hash=createHash('sha256').update(made.glb).digest('hex');
if(hash!=='c00e6ad0f0384c1208d5b56a125f21793bd209ed59cfce9acd9e65c96a5bc981')throw new Error('Held pool hash changed; update the declared generation output');
mkdirSync(out,{recursive:true});writeFileSync(new URL(`${hash}.glb`,out),made.glb);
made.rows.url=`/assets/driftwood-isle/baked/${hash}.glb`;
writeFileSync(new URL('../data/swordPool.generated.json',import.meta.url),`${JSON.stringify(made.rows)}\n`);
