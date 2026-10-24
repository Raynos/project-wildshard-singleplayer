#!/usr/bin/env node
// T2/QW3: tests consume layer declarations; local no-change checks reuse a cache.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** The cache is local tooling state, never a CI input or a source exclusion.
 * @param {{readonly CI?:string,readonly GITHUB_ACTIONS?:string}} [environment] */
export function rootTypecheckArguments(environment=process.env) {
  return environment.CI || environment.GITHUB_ACTIONS ? ['--noEmit']
    : ['--noEmit','--incremental','--tsBuildInfoFile','node_modules/.cache/ws-root.tsbuildinfo'];
}

if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  if(process.argv.length!==2){console.error('typecheck-root: expected no arguments');process.exit(2);}
  const root=resolve(import.meta.dirname,'..'),args=rootTypecheckArguments();
  if(args.includes('--incremental'))mkdirSync(resolve(root,'node_modules/.cache'),{recursive:true});
  const result=spawnSync(resolve(root,'node_modules/.bin/tsc'),args,{cwd:root,stdio:'inherit'});
  if(result.error!==undefined)console.error(result.error.message);
  process.exitCode=result.status??1;
}
