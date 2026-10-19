import { resolve } from 'node:path';
import { DIRECTORY, verifyEntries } from './admission.mjs';
/** Resolve only the two byte-checked relocated original source fixtures. */
export function fixtureResolver(root) {
 verifyEntries(root);
 const fixtures=new Set(['candidate-entry.ts','candidate-practiceBoot.ts','control-entry.ts','control-practiceBoot.ts'].map(p=>resolve(root,DIRECTORY,p)));
 return {name:'conch-public4-tent-exact-fixtures',enforce:'pre',async resolveId(source,importer) {
  if(!fixtures.has(importer)||!source.startsWith('.'))return null;
  return this.resolve(resolve(root,'src',source),importer,{skipSelf:true});
 }};
}
/** Preserve the TypeScript extension on virtual modules for the compiler. */
export function virtualTables(tables) {
 const prefix='\0conch-public4-tent:';
 return {name:'conch-public4-tent-tables',enforce:'pre',resolveId(source,importer) {
  const path=source.startsWith('/')?source:importer&&source.startsWith('.')?resolve(importer,'..',source):null;
  const key=path?.replace(/\.ts$/u,'');return tables.has(key)?prefix+key+'.ts':null;
 },load(id){return id.startsWith(prefix)?tables.get(id.slice(prefix.length).replace(/\.ts$/u,'')):null;}};
}
