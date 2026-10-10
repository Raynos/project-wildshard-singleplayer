// G292: pinned raw assets use the same verified cache as their generated outputs, never a second temp cache.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { bakeInputHashes } from './bake-input-hashes.mjs';
import { runGenerationJob } from './generation-cache.mjs';

const limit=64*1024*1024;
/** Fetch a bounded pinned raw input; the expected digest, not an upstream mutable API response, is authoritative.
 * @param {{path:string,url:string,sha256:string}[]} sources @param {string} [cacheDir] */
export async function externalGenerationInputs(sources,cacheDir) {
  const files=[];
  for(const source of sources) {
    const url=new URL(source.url);
    if(url.protocol!=='https:' && !(url.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname))) throw new Error('Generation source requires HTTPS');
    const result=await runGenerationJob(import.meta.dirname,{id:'pinned-source',inputs:bakeInputHashes(import.meta.dirname,['generation-sources.mjs']),command:['fetch',source.url],outputs:[source.path],platform:'portable',tools:{sha256:source.sha256}},{...(cacheDir===undefined?{}:{cacheDir}),generate:async directory=>{
      const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
      if(!response.ok || response.body===null) throw new Error(`Generation source HTTP ${String(response.status)}: ${source.url}`);
      const reader=response.body.getReader(),chunks=[];let length=0;
      try {for(;;){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>limit)throw new Error('Generation source exceeds 64 MiB');chunks.push(next.value);}}
      finally {await reader.cancel();}
      const bytes=Buffer.concat(chunks);
      if(createHash('sha256').update(bytes).digest('hex')!==source.sha256) throw new Error(`Generation source digest changed: ${source.path}`);
      const file=resolve(directory,source.path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,bytes);
    }});
    files.push({path:source.path,file:resolve(result.directory,source.path)});
  }
  return files;
}

/** Bind encoder executable bytes and version output to the job key. Commands run without a shell.
 * @param {string[][]} commands @returns {Record<string,string>} */
export function generationTools(commands) {
  const versions={};
  for(const command of commands) {
    const executable=command[0];if(command.length===0 || executable.length===0)throw new Error('Missing generation tool');
    const file=(process.env.PATH ?? '').split(delimiter).map(dir=>resolve(dir,executable)).find(candidate=>existsSync(candidate));
    if(file===undefined)throw new Error(`Missing generation tool ${executable}`);
    const output=execFileSync(realpathSync(file),command.slice(1),{maxBuffer:1024*1024});
    const digest=createHash('sha256').update(readFileSync(realpathSync(file))).update(output).digest('hex');
    Object.assign(versions,{[JSON.stringify(command)]:digest});
  }
  return versions;
}
