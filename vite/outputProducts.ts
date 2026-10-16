import type { Plugin } from 'vite';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';

/** The app publishes data products, never their temporary TypeScript sources. */
export function outputProductsPlugin(): Plugin {
 let root=resolve('.');
 return {name:'wildshard-output-products',configResolved(config){root=config.root;},writeBundle(options){
  const sourceRoot=resolve(root,'out'),output=resolve(root,options.dir??'dist','shardfiles');rmSync(output,{recursive:true,force:true});
  if(!existsSync(sourceRoot))return;
  if(existsSync(resolve(sourceRoot,'catalog.json'))){mkdirSync(output,{recursive:true});cpSync(resolve(sourceRoot,'catalog.json'),resolve(output,'catalog.json'));}
  for(const entry of readdirSync(sourceRoot,{withFileTypes:true})){
   if(!entry.isDirectory()||entry.name.startsWith('.'))continue;
   const source=resolve(sourceRoot,entry.name);
   if(!existsSync(resolve(source,'shard.json')))continue;
   cpSync(source,resolve(output,entry.name),{recursive:true,filter:path=>basename(path)!=='runtime'&&basename(path)!=='.build-key'});
  }
 }};
}
