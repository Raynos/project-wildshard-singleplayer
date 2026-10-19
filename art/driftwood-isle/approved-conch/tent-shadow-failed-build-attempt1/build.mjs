#!/usr/bin/env node
/** One opt-in build; fresh root pin required. Never changes old hosts or product. */
import { readFileSync, writeFileSync, existsSync, lstatSync, mkdirSync, copyFileSync, cpSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, PREVIEW } from '../selected-native-color-view/build.mjs';
import { exactInventory } from '../selected-native-color-view/identity.mjs';
import { DIRECTORY, FUTURE_PIN, FUTURE_DIST } from './source-gate.mjs';
import { fixtureResolver } from './host-plugin.mjs';
import { closure, canonical, hash, assertIdentity, BUILD_REVIEW, bytesUnder, assertExactClosure } from './manifest.mjs';
import { assertHeavyLease } from '../../../../scripts/heavy-lane-lease.mjs';
export const EVIDENCE='tmp/conch-tent-shadow-attempt1/capture';
export const HOST_RECEIPT='tent-host-files.json';
export const MAX_BYTES=80*1024*1024;
export function safeNew(path) {
  for(let parent=path;parent!==dirname(parent);parent=dirname(parent))
    if(existsSync(parent)&&lstatSync(parent).isSymbolicLink())throw new Error('Symlink in output path');
  if(existsSync(path))throw new Error(`Preserve existing output: ${path}`);
}
export function budget() {
  const bytes=bytesUnder(resolve(ROOT,FUTURE_DIST))+bytesUnder(resolve(ROOT,'tmp/conch-tent-shadow-attempt1'));
  if(bytes>MAX_BYTES)throw new Error(`Diagnostic budget exceeded: ${bytes}`); return bytes;
}
export function pinReviewed(rootGo) {
  if(typeof rootGo!=='string'||!rootGo.trim())throw new Error('Root GO reference required');
  const path=resolve(ROOT,FUTURE_PIN);safeNew(path);
  const pin={schema:'wildshard.conch.tent-diagnostic.pin.v1',buildAllowed:true,rootGo,review:BUILD_REVIEW,
    acceptance:false,createdAt:new Date().toISOString(),inputs:closure()};
  mkdirSync(dirname(path),{recursive:true});writeFileSync(path,canonical(pin)+'\n',{flag:'wx'});budget();return pin;
}
export function checkPin() {
  const pin=JSON.parse(readFileSync(resolve(ROOT,FUTURE_PIN)));
  if(pin.schema!=='wildshard.conch.tent-diagnostic.pin.v1'||pin.buildAllowed!==true||pin.acceptance!==false||pin.review!==BUILD_REVIEW||!pin.rootGo?.trim())throw new Error('Missing reviewed new diagnostic permission');
  assertIdentity(pin.inputs,closure());return pin;
}
export function verifyHost() {
  const pin=checkPin(), actual=exactInventory(resolve(ROOT,FUTURE_DIST));
  const receipt=JSON.parse(readFileSync(resolve(ROOT,FUTURE_DIST,HOST_RECEIPT)));
  delete actual[HOST_RECEIPT];
  if(receipt.schema!=='wildshard.conch.tent-diagnostic.host.v1'||receipt.pinSha256!==hash(canonical(pin))||receipt.acceptance!==false)throw new Error('Invalid diagnostic host receipt');
  assertExactClosure(receipt.files,actual);budget();return {pinSha256:hash(canonical(pin)),hostSha256:hash(canonical(receipt)),files:actual};
}
export async function buildHost() {
  assertHeavyLease('build'); const pin=checkPin(), dist=resolve(ROOT,FUTURE_DIST);safeNew(dist);
  const {build}=await import('vite');
  const {rapierAlias,rapierPreviewPlugin}=await import('../../../../vite/rapier.ts');
  const {starterArmClipsTableSource}=await import('../../../../scripts/gen-starter-arm-clips.mjs');
  const {starterEffectsTableSource}=await import('../../../../scripts/gen-starter-effects.mjs');
  const preview=resolve(ROOT,PREVIEW),product=join(preview,'product');
  const metadata=JSON.parse(readFileSync(join(preview,'pack/metadata.json'))),validation=JSON.parse(readFileSync(join(product,'validation.json')));
  const assets=['assets/models/driftwood-fp/fp-arms.glb','assets/physics/rapier.wasm'];
  const bytes={},versions={};
  const include=(url,path)=>{const data=readFileSync(path);bytes[url]=data.length;versions[url]=hash(data).slice(0,8);};
  for(const asset of assets)include('/'+asset,resolve(ROOT,'public',asset));
  include(metadata.file,join(preview,'pack/payload.bin'));
  for(const path of Object.keys(exactInventory(product)))include('/practice-product/'+path,join(product,path));
  const tables=new Map([
    [resolve(ROOT,'src/game/systems/viewmodel/clips.generated'),starterArmClipsTableSource()],
    [resolve(ROOT,'src/game/systems/effects/starter.generated'),starterEffectsTableSource()],
    [resolve(ROOT,'src/game/boot/bytes.generated'),`export const PUBLIC_BYTES=${JSON.stringify(bytes)};`],
    [resolve(ROOT,'src/game/boot/versions.generated'),`export const ASSET_VERSIONS=${JSON.stringify(versions)};`],
  ]);
  await build({root:ROOT,configFile:false,publicDir:false,base:'/',resolve:{alias:rapierAlias},
    define:{__DEVSERVER__:true,__BUILD_ID__:JSON.stringify('conch-first-use-tent-diagnostic-unaccepted'),__SAVE_NAMESPACES__:'[]',
      __SHARDFILE_VALIDATOR__:JSON.stringify(validation.revision),__SHARDFILE_VERDICTS__:JSON.stringify([validation])},
    plugins:[fixtureResolver(ROOT),rapierPreviewPlugin(),{name:'conch-diagnostic-tables',enforce:'pre',
      resolveId(source,importer){const path=source.startsWith('/')?source:importer&&source.startsWith('.')?resolve(dirname(importer),source):null;
        const key=path?.replace(/\.ts$/u,'');return tables.has(key)?'\0conch-diagnostic:'+key:null;},
      load(id){return id.startsWith('\0conch-diagnostic:')?tables.get(id.slice('\0conch-diagnostic:'.length)):null;}}],
    build:{outDir:dist,emptyOutDir:false,target:'es2022',sourcemap:false,cssCodeSplit:false,
      rolldownOptions:{input:{control:resolve(ROOT,DIRECTORY,'control.html'),tent:resolve(ROOT,DIRECTORY,'tent.html')}}}});
  for(const variant of ['control','tent'])copyFileSync(join(dist,DIRECTORY,variant+'.html'),join(dist,variant+'.html'));
  const source='selected-source-21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a.glb';
  copyFileSync(resolve(ROOT,'art/driftwood-isle/approved-conch/selected-geometry-admission/conch-study.glb'),join(dist,source));
  cpSync(product,join(dist,'practice-product'),{recursive:true,errorOnExist:true,force:false});
  for(const [target,from] of [...assets.map(asset=>[asset,resolve(ROOT,'public',asset)]),[metadata.file.slice(1),join(preview,'pack/payload.bin')]]) {
    mkdirSync(dirname(join(dist,target)),{recursive:true});copyFileSync(from,join(dist,target));
  }
  assertIdentity(pin,checkPin());budget();
  writeFileSync(join(dist,HOST_RECEIPT),canonical({schema:'wildshard.conch.tent-diagnostic.host.v1',pinSha256:hash(canonical(pin)),
    acceptance:false,entries:['control.html','tent.html'],files:exactInventory(dist)})+'\n',{flag:'wx'});
  return verifyHost();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if(resolve('.')!==ROOT)throw new Error('Run from repository root');
  const [action,go,...extra]=process.argv.slice(2);if(extra.length)throw new Error('Unexpected arguments');
  if(action==='--pin-reviewed'&&go)console.log(JSON.stringify({pin:FUTURE_PIN,sha256:hash(canonical(pinReviewed(go)))}));
  else if(go)throw new Error('Unexpected argument');
  else if(action==='--check-source')console.log(JSON.stringify({inputSha256:hash(canonical(closure())),buildAllowed:false}));
  else if(action==='--check-pin')console.log(JSON.stringify({pinSha256:hash(canonical(checkPin()))}));
  else if(action==='--build')console.log(JSON.stringify(await buildHost()));
  else if(action==='--verify-host')console.log(JSON.stringify(verifyHost()));
  else throw new Error('Use --check-source | --pin-reviewed "root GO reference" | --check-pin | --build | --verify-host');
}
