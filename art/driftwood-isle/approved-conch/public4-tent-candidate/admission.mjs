/** Exact public Conch4 bytes only. No product factory or admission exception. */
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { admitConchReadable } from '../../../../scripts/conch-readable-admission.mjs';
import { practiceBootFixture, practiceEntryFixture, practiceHtmlFixture, DIRECTORY } from './fixture.mjs';
import { assertCallOrder } from '../tent-shadow-diagnostic/fixture.mjs';
export { DIRECTORY };
export const ROOT=resolve(import.meta.dirname,'../../../..');
export const ORIGINAL='tmp/conch-readable-preview-dist-build2';
export const PREVIEW='tmp/conch-readable-preview/motion4-build2';
export const REVIEW='docs/reviews/conch-public4-tent-candidate.md';
export const hash=data=>createHash('sha256').update(data).digest('hex');
export const canonical=value=>JSON.stringify(value,(_key,item)=>item && typeof item==='object' && !Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
export function same(a,b) { if(canonical(a)!==canonical(b))throw new Error('Exact public4 identity mismatch'); }
export function inventory(directory) {
 const result={};
 const visit=(path,prefix='')=>{
  if(lstatSync(path).isSymbolicLink())throw new Error('Symlink in exact closure');
  for(const item of readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
   const key=prefix+item.name,child=join(path,item.name);
   if(item.isSymbolicLink())throw new Error('Symlink in exact closure');
   if(item.isDirectory())visit(child,key+'/');else if(item.isFile())result[key]=hash(readFileSync(child));else throw new Error('Unsupported closure file');
  }
 };visit(directory);return result;
}
export function productPin(root=ROOT) {return JSON.parse(readFileSync(resolve(root,DIRECTORY,'public-product.json')));}
export function verifyProduct(directory,root=ROOT) {
 const pin=productPin(root),actual=inventory(join(directory,'practice-product'));
 const expected=Object.fromEntries(Object.entries(pin.files).filter(([p])=>p.startsWith('practice-product/')).map(([p,v])=>[p.slice(17),v]));
 same(expected,actual);
 for(const [path,digest] of Object.entries(pin.files)) {
  if(path.startsWith('/')||path.split('/').includes('..'))throw new Error('Unsafe public file');
  if(hash(readFileSync(join(directory,path)))!==digest)throw new Error(`Changed public4 file: ${path}`);
 }
 const indexBytes=readFileSync(join(directory,'practice-product/shard.json')),index=JSON.parse(indexBytes);
 const validation=JSON.parse(readFileSync(join(directory,'practice-product/validation.json')));
 if(index.build.sourceHash!==pin.sourceHash || validation.indexHash!==hash(indexBytes)||typeof validation.revision!=='string')throw new Error('Public4 validation mismatch');
 for(const file of index.files)if(actual[file.path]!==file.hash)throw new Error('Product blob hash mismatch');
 return {pin,validation,files:actual};
}
export function verifyEntries(root=ROOT) {
 const read=p=>readFileSync(resolve(root,p),'utf8');
 for(const [variant,name] of [['tent','candidate'],['control','control']])for(const [file,source,fn] of [[`${name}-practiceBoot.ts`,'src/practiceBoot.ts',practiceBootFixture],[`${name}-entry.ts`,'src/practice.ts',practiceEntryFixture],[`${name}.html`,'practice.html',practiceHtmlFixture]])same(read(`${DIRECTORY}/${file}`),fn(read(source),variant));
 assertCallOrder(read('src/game/practiceDemo/startPracticeDemo.ts'),read('src/practiceContent.ts'));
}
export function admitPublic4(root=ROOT) {
 const admitted=admitConchReadable(root),pin=productPin(root),read=p=>readFileSync(resolve(root,p));
 same(pin,JSON.parse(read('practice/shared-arena/pins.json')).enemies.conch);
 if(pin.mode!=='motion4'||pin.kind!=='conch-duelist'||pin.candidate!==admitted.manifest.candidate)throw new Error('Wrong public4 tuple');
 const metadataBytes=read(`${PREVIEW}/pack/metadata.json`),metadata=JSON.parse(metadataBytes),payload=read(`${PREVIEW}/pack/payload.bin`),preview=JSON.parse(read(`${PREVIEW}/preview.json`));
 same(metadata,admitted.metadata);same(preview.sourceFreeze,admitted.manifest);same(preview.admission,admitted.receipt);
 if(!payload.equals(admitted.payload)||preview.metadataSha256!==hash(metadataBytes)||preview.packedSha256!==hash(payload)||preview.bodyFile!==metadata.file||preview.sourceHash!==pin.sourceHash||preview.mode!==pin.mode||preview.candidate!==pin.candidate||preview.runtimeAcceptance!==false||preview.visualAcceptance!==false||preview.colliderAcceptance!==false)throw new Error('Public4 native metadata/payload mismatch');
 if(!read(`${ORIGINAL}/${metadata.file.slice(1)}`).equals(payload)||!read(`${ORIGINAL}/conch-preview.json`).equals(read(`${PREVIEW}/preview.json`)))throw new Error('Public4 host/native mismatch');
 const product=verifyProduct(resolve(root,ORIGINAL),root);
 same(inventory(resolve(root,PREVIEW,'product')),product.files);verifyEntries(root);
 return {metadata,pin,validation:product.validation,buildAllowed:false};
}
