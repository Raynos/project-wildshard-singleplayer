import type { Plugin } from 'vite';
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';

/** The app publishes data products, never their temporary TypeScript sources. */
export function outputProductsPlugin(): Plugin {
 return {name:'wildshard-output-products',writeBundle(options){
  const output=resolve(options.dir??'dist','shardfiles');rmSync(output,{recursive:true,force:true});
  if(!existsSync('out'))return;
  for(const entry of readdirSync('out',{withFileTypes:true})){
   if(!entry.isDirectory()||entry.name.startsWith('.'))continue;
   const source=resolve('out',entry.name);
   if(!existsSync(resolve(source,'shard.json')))continue;
   cpSync(source,resolve(output,entry.name),{recursive:true,filter:path=>basename(path)!=='runtime'&&basename(path)!=='.build-key'});
  }
 }};
}
