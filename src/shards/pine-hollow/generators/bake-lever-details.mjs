import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {leverDetailPool} from './crossbowPool.ts';

const glb=leverDetailPool(),hash=createHash('sha256').update(glb).digest('hex');
if(hash!=='621ad7aae8c997f8249f86d55d90a4faa95c9d1aba612d7c51837d34908beb52')throw new Error('Rifle details changed; regenerate the declared output');
const out=new URL('../../../../public/assets/pine-hollow/baked/',import.meta.url);
mkdirSync(out,{recursive:true});writeFileSync(new URL(`${hash}.glb`,out),glb);
