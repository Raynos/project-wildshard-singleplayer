/** Exact input/tool closure. Read-only: never authorizes a build. */
import { readFileSync, readdirSync, lstatSync, realpathSync, existsSync, statSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, PREVIEW } from '../selected-native-color-view/build.mjs';
import { exactInventory } from '../selected-native-color-view/identity.mjs';
import { checkSource, checkOriginalHost, assertExactClosure } from './source-gate.mjs';
export const BUILD_REVIEW='docs/reviews/conch-tent-shadow-build.md';
export const CHROME='tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const canonical=value=>JSON.stringify(value,(_key,item)=>item && typeof item==='object' && !Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
export function installedInventory(root=ROOT) {
  const files={}, links={}, visited=new Set();
  const visit=path=>{
    const key=relative(root,path), entry=lstatSync(path);
    if(entry.isSymbolicLink()) {
      const actual=realpathSync(path), target=relative(root,actual);
      if(target.startsWith('../') || target==='..') throw new Error(`Dependency escapes repository: ${key}`);
      links[key]=target; visit(actual); return;
    }
    if(visited.has(path))return; visited.add(path);
    if(entry.isDirectory())for(const child of readdirSync(path).sort())visit(join(path,child));
    else if(entry.isFile())files[key]=hash(readFileSync(path));
    else throw new Error(`Unsupported dependency: ${key}`);
  };
  visit(resolve(root,'node_modules'));
  for(const pkg of ['engine','game','sdk','commons','format']) {
    const path=resolve(root,'src',pkg,'node_modules'); if(existsSync(path))visit(path);
  }
  return {files,links};
}
export function closure() {
  const source=checkSource(), original=checkOriginalHost();
  return {schema:'wildshard.conch.tent-diagnostic.inputs.v1',nodeVersion:process.version,
    nodeExecutableSha256:hash(readFileSync(process.execPath)),source:source.files,
    reviewSha256:hash(readFileSync(resolve(ROOT,BUILD_REVIEW))),installed:installedInventory(),
    browserLaneShimSha256:hash(readFileSync(resolve(ROOT,'tmp/dot-audit/bin/lockf'))),
    browser:exactInventory(resolve(ROOT,'tmp/dot-audit/tools/chrome-headless-shell-linux64')),
    originalIdentitySha256:hash(canonical(original)),product:exactInventory(resolve(ROOT,PREVIEW)),
    native:source.admitted.manifest};
}
export function assertIdentity(expected,actual) {
  if(canonical(expected)!==canonical(actual))throw new Error('Exact diagnostic input/tool identity changed');
}
export function bytesUnder(path) {
  if(!existsSync(path))return 0;
  const item=lstatSync(path); if(item.isSymbolicLink())throw new Error('Output symlink');
  if(item.isFile())return statSync(path).size;
  return readdirSync(path).reduce((n,f)=>n+bytesUnder(join(path,f)),0);
}
export { assertExactClosure };
