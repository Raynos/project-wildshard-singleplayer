#!/usr/bin/env node
/** One new root-reviewed host build, copying the exact public product without rebaking. */
import { readFileSync, writeFileSync, existsSync, lstatSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, DIRECTORY, ORIGINAL, REVIEW, admitPublic4, verifyProduct, inventory, hash, canonical, same } from './admission.mjs';
import { closure } from './manifest.mjs';
import { fixtureResolver, virtualTables } from './host-plugin.mjs';
import { assertHeavyLease } from '../../../../scripts/heavy-lane-lease.mjs';
export const PIN='tmp/conch-public4-tent-attempt1/reviewed-build-pin.json';
export const DIST='tmp/conch-public4-tent-dist-attempt1';
export const EVIDENCE='tmp/conch-public4-tent-attempt1/capture';
export const RECEIPT='public4-tent-host-files.json';
export const MAX_BYTES=192*1024*1024;
export function safeNew(path) {
 for(let p=path;p!==dirname(p);p=dirname(p))if(existsSync(p)&&lstatSync(p).isSymbolicLink())throw new Error('Symlink in output path');
 if(existsSync(path))throw new Error(`Preserve existing output: ${path}`);
}
function bytes(path) {
 if(!existsSync(path))return 0;const stat=lstatSync(path);if(stat.isSymbolicLink())throw new Error('Output symlink');
 return stat.isFile()?stat.size:readdirSync(path).reduce((sum,name)=>sum+bytes(join(path,name)),0);
}
export function budget() {const n=bytes(resolve(ROOT,DIST))+bytes(resolve(ROOT,'tmp/conch-public4-tent-attempt1'));if(n>MAX_BYTES)throw new Error(`Candidate output budget exceeded: ${n}`);return n;}
export function validatePin(pin,current) {
 if(pin.schema!=='wildshard.conch.public4-tent.pin.v1'||pin.buildAllowed!==true||pin.acceptance!==false||pin.review!==REVIEW||typeof pin.rootGo!=='string'||!pin.rootGo.trim())throw new Error('Missing fresh root-reviewed public4-tent permission');
 same(pin.inputs,current);return pin;
}
/** Root only after separate review. Neither build nor tests call this implicitly. */
export function pinReviewed(rootGo) {
 const target=resolve(ROOT,PIN);safeNew(target);safeNew(resolve(ROOT,DIST));safeNew(resolve(ROOT,EVIDENCE));
 const inputs=closure(),pin={schema:'wildshard.conch.public4-tent.pin.v1',buildAllowed:true,acceptance:false,review:REVIEW,rootGo,createdAt:new Date().toISOString(),inputs};
 validatePin(pin,inputs);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,canonical(pin)+'\n',{flag:'wx'});budget();return pin;
}
export function checkPin() {return validatePin(JSON.parse(readFileSync(resolve(ROOT,PIN))),closure());}
export function verifyHost() {
 const pin=checkPin(),dist=resolve(ROOT,DIST),actual=inventory(dist),receipt=JSON.parse(readFileSync(join(dist,RECEIPT)));
 delete actual[RECEIPT];
 if(receipt.schema!=='wildshard.conch.public4-tent.host.v1'||receipt.pinSha256!==hash(canonical(pin))||receipt.acceptance!==false)throw new Error('Invalid public4-tent output receipt');
 same(receipt.entries,['control.html','tent.html']);same(receipt.files,actual);verifyProduct(dist);budget();return {pinSha256:hash(canonical(pin)),hostSha256:hash(canonical(receipt)),files:actual};
}
export async function buildHost() {
 assertHeavyLease('build');const pin=checkPin(),dist=resolve(ROOT,DIST);safeNew(dist);
 const admitted=admitPublic4(),original=resolve(ROOT,ORIGINAL),{build}=await import('vite');
 const {rapierAlias,rapierPreviewPlugin}=await import('../../../../vite/rapier.ts');
 const {starterArmClipsTableSource}=await import('../../../../scripts/gen-starter-arm-clips.mjs');
 const {starterEffectsTableSource}=await import('../../../../scripts/gen-starter-effects.mjs');
 const sizes={},versions={};
 for(const path of Object.keys(admitted.pin.files)){const data=readFileSync(join(original,path));sizes['/'+path]=data.length;versions['/'+path]=hash(data).slice(0,8);}
 const tables=new Map([
  [resolve(ROOT,'src/game/systems/viewmodel/clips.generated'),starterArmClipsTableSource()],
  [resolve(ROOT,'src/game/systems/effects/starter.generated'),starterEffectsTableSource()],
  [resolve(ROOT,'src/game/boot/bytes.generated'),`export const PUBLIC_BYTES=${JSON.stringify(sizes)};`],
  [resolve(ROOT,'src/game/boot/versions.generated'),`export const ASSET_VERSIONS=${JSON.stringify(versions)};`],
 ]);
 await build({root:ROOT,configFile:false,publicDir:false,base:'/',resolve:{alias:rapierAlias},
  define:{__DEVSERVER__:true,__BUILD_ID__:JSON.stringify('conch-public4-tent-normal-clock-unaccepted'),__SAVE_NAMESPACES__:'[]',__SHARDFILE_VALIDATOR__:JSON.stringify(admitted.validation.revision),__SHARDFILE_VERDICTS__:JSON.stringify([admitted.validation])},
  plugins:[fixtureResolver(ROOT),rapierPreviewPlugin(),virtualTables(tables),{name:'public4-tent-label',transformIndexHtml(html,context){const label=context.filename.endsWith('/control.html')?'PCF control':'tent candidate';return html.replace('Wildshard practice demo',`Conch4 ${label} · UNACCEPTED`).replace('Developer arena · rejected meshes',`Conch4 ${label} · UNACCEPTED`).replace('These five creature meshes were rejected. Approved replacement art is still in progress.',`Exact public Conch4 · ${label} · normal clocks. Selected-model and phone acceptance not established.`);}}],
  build:{outDir:dist,emptyOutDir:false,target:'es2022',sourcemap:false,cssCodeSplit:false,rolldownOptions:{input:{tent:resolve(ROOT,DIRECTORY,'candidate.html'),control:resolve(ROOT,DIRECTORY,'control.html')}}}});
 copyFileSync(join(dist,DIRECTORY,'candidate.html'),join(dist,'index.html'));
 copyFileSync(join(dist,DIRECTORY,'candidate.html'),join(dist,'tent.html'));
 copyFileSync(join(dist,DIRECTORY,'control.html'),join(dist,'control.html'));
 for(const path of Object.keys(admitted.pin.files)){mkdirSync(dirname(join(dist,path)),{recursive:true});copyFileSync(join(original,path),join(dist,path));}
 verifyProduct(dist);same(pin,checkPin());budget();
 writeFileSync(join(dist,RECEIPT),canonical({schema:'wildshard.conch.public4-tent.host.v1',pinSha256:hash(canonical(pin)),acceptance:false,entries:['control.html','tent.html'],files:inventory(dist)})+'\n',{flag:'wx'});
 return verifyHost();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(resolve('.')!==ROOT)throw new Error('Run from repository root');
 const[action,go,...extra]=process.argv.slice(2);if(extra.length)throw new Error('Unexpected arguments');
 if(action==='--pin-reviewed'&&go)console.log(JSON.stringify({pin:PIN,sha256:hash(canonical(pinReviewed(go)))}));
 else if(go)throw new Error('Unexpected argument');
 else if(action==='--check-source')console.log(JSON.stringify({sourceSha256:hash(canonical(closure())),buildAllowed:false}));
 else if(action==='--check-pin')console.log(JSON.stringify({pinSha256:hash(canonical(checkPin()))}));
 else if(action==='--build')console.log(JSON.stringify(await buildHost()));
 else if(action==='--verify-host')console.log(JSON.stringify(verifyHost()));
 else throw new Error('Use --check-source | --pin-reviewed "root GO" | --check-pin | --build | --verify-host');
}
