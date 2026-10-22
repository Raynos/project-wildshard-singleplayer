// Portable V8 entries share relative module paths across disposable producer trees.
import {mkdirSync,symlinkSync} from 'node:fs';
import {resolve} from 'node:path';

/** Keep physical cache files outside the disposable tree. The private alias
 * gives Node the same relative paths in every isolated producer; absolute
 * temporary names must never create another complete cache per job.
 * Source/output identities and publication checks remain the generator's.
 * Missing/unavailable cache storage, explicit disable and coverage stay cold.
 * @param {string} tree @param {Record<string,string|undefined>} [env]
 * @returns {Record<string,string|undefined>} */
export function generationNodeEnvironment(tree,env=process.env) {
  const cold={...env,NODE_DISABLE_COMPILE_CACHE:'1'};
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major<24||major===24&&minor<12)return cold;
  if(env.NODE_COMPILE_CACHE===undefined||env.NODE_DISABLE_COMPILE_CACHE!==undefined||env.NODE_V8_COVERAGE!==undefined)return cold;
  try {
    const storage=resolve(env.NODE_COMPILE_CACHE,'generation-portable');
    mkdirSync(storage,{recursive:true});
    const alias=resolve(tree,'node_modules','.generation-node-compile');
    symlinkSync(storage,alias,'dir');
    return {...env,NODE_COMPILE_CACHE:alias,NODE_COMPILE_CACHE_PORTABLE:'1'};
  } catch {return cold;}
}
