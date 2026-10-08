import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, renameSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { linkNodeModules } from '../link-node-modules.mjs';
import { createServer } from 'node:net';

/** @param {string} root @param {string} sha */
export function exportTree(root, sha) {
  const dir=realpathSync(mkdtempSync(join(tmpdir(),'wildshard-parity-'))), ign=join(dir,'ign'); mkdirSync(ign); // canonical (E432)
  execFileSync('git',['init','-q',ign]);
  const patterns=execFileSync('git',['show',`${sha}:.vercelignore`],{cwd:root,encoding:'utf8'}); writeFileSync(join(dir,'ignore'),patterns);
  const paths=execFileSync('git',['ls-tree','-r','--name-only',sha],{cwd:root,encoding:'utf8'}).trim().split('\n');
  const ignored=execFileSync('git',['-C',ign,'-c',`core.excludesFile=${join(dir,'ignore')}`,'check-ignore','--no-index','--stdin'],{input:paths.join('\n'),encoding:'utf8'}).trim().split('\n');
  const excluded=new Set(ignored), keep=paths.filter((p)=>p.startsWith('test/parity/') || !excluded.has(p));
  const tree=join(dir,'tree');mkdirSync(tree);
  const archive=execFileSync('git',['archive',sha,'--',...keep],{cwd:root,maxBuffer:1024**3});
  execFileSync('tar',['-x','-C',tree],{input:archive,maxBuffer:1024**3});
  linkNodeModules(root,tree); // E432: @wildshard/* → this export
  return {tree,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}
/** @returns {Promise<number>} */
async function freePort() { const s=createServer();await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',()=>resolve(undefined));}); const a=s.address();if(!a || typeof a==='string') throw new Error('no preview port'); await new Promise((resolve,reject)=>{s.close((e)=>{if(e)reject(e);else resolve(undefined);});});return a.port; }
/** @param {string} tree @param {string} sha @param {boolean} [built] */
export async function serve(tree,sha,built=false) {
  if(!built)buildTree(tree,sha);
  const port=await freePort(), child=spawn('pnpm',['exec','vite','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:tree,stdio:['ignore','pipe','pipe'],detached:true});
  let startup='';child.stdout.on('data',(chunk)=>{startup+=String(chunk);});child.stderr.on('data',(chunk)=>{startup+=String(chunk);});
  const url=`http://127.0.0.1:${port}`;
  const close=()=> {if(child.pid) {try {process.kill(-child.pid,'SIGTERM');} catch { /* already stopped */ }} };
  try {for(let i=0;i<300;i++){if(child.exitCode!==null) throw new Error(`preview exited: ${startup}`);try {if((await fetch(`${url}/version.json`)).ok) return {url,close};}catch {/* preview starting */} await new Promise((resolve)=>{setTimeout(resolve,100);});} throw new Error(`preview never served: ${startup}`);}catch(e){close();throw e;}
}
/** @param {string} path @returns {unknown} */
export function readJson(path) {return existsSync(path) ? JSON.parse(readFileSync(path,'utf8')) : undefined;}

/** Content identity excludes harness / baseline / non-build documents, but includes every other exported build input.
 * @param {string} root @param {string} sha */
export function runtimeTree(root,sha) {
  const patterns=execFileSync('git',['show',`${sha}:.vercelignore`],{cwd:root,encoding:'utf8'});
  const entries=execFileSync('git',['ls-tree','-r',sha],{cwd:root,encoding:'utf8',maxBuffer:16*1024**2}).trim().split('\n');
  const temp=mkdtempSync(join(tmpdir(),'parity-key-'));
  try {
    execFileSync('git',['init','-q',temp]);writeFileSync(join(temp,'ignore'),patterns);
    const paths=entries.map((entry)=>entry.split('\t')[1]??'');
    const check=execFileSync('git',['-C',temp,'-c',`core.excludesFile=${join(temp,'ignore')}`,'check-ignore','--no-index','--stdin'],{input:paths.join('\n'),encoding:'utf8'});
    const ignored=new Set(check.trim().split('\n'));
    const inputs=entries.filter((entry)=>{const path=entry.split('\t')[1]??'';return !ignored.has(path)&&!path.startsWith('test/')&&!path.startsWith('scripts/parity/')&&path!=='scripts/parity.mjs';});
    return createHash('sha256').update(`parity-build-v2-shardfiles\n${process.version}\n${patterns}\n${inputs.join('\n')}`).digest('hex');
  } finally {rmSync(temp,{recursive:true,force:true});}
}

/** Atomic cache publication + process-owned directory lock; an interrupted build is never a hit.
 * Target-SHA parity metadata is exported separately even on a runtime-cache hit.
 * @param {string} root @param {string} sha @param {string} [cacheRoot]
 * @param {(tree:string,sha:string)=>void|Promise<void>} [build] */
export async function cachedTree(root,sha,cacheRoot=join(homedir(),'.cache/wildshard-parity'),build=buildTree) {
  const key=runtimeTree(root,sha),dir=join(cacheRoot,key),lock=`${dir}.lock`,started=performance.now();
  mkdirSync(cacheRoot,{recursive:true});
  const valid=()=>existsSync(join(dir,'ready.json'))&&existsSync(join(dir,'tree/dist/version.json'));
  let owned=false;
  while(!owned) {
    try {mkdirSync(lock);writeFileSync(join(lock,'pid'),String(process.pid));owned=true;} catch(error) {
      if(!(error instanceof Error)||!('code' in error)||error.code!=='EEXIST')throw error;
      const pid=readJsonNumber(join(lock,'pid'));
      if(pid){try{process.kill(pid,0);}catch{rmSync(lock,{recursive:true,force:true});continue;}}
      else if(Date.now()-statSync(lock).mtimeMs>1000){rmSync(lock,{recursive:true,force:true});continue;}
      if(performance.now()-started>240000)throw new Error('infrastructure: parity cache lock exceeded4min',{cause:error});
      await new Promise((resolve)=>{setTimeout(resolve,100);});
    }
  }
  const hit=valid(); let lease='';
  try {
    if(!hit) {
      let exported=/** @type {ReturnType<typeof exportTree>|undefined} */(undefined);
      try {
        exported=exportTree(root,sha);await build(exported.tree,sha);
        rmSync(dir,{recursive:true,force:true});mkdirSync(dir);
        renameSync(exported.tree,join(dir,'tree'));writeFileSync(join(dir,'ready.json'),JSON.stringify({key,sha}));
      } finally {exported?.cleanup();}
    }
    // Readers and eviction share the entry lock. Keep active previews safe until cleanup, including cache hits.
    const users=`${dir}.users`;mkdirSync(users,{recursive:true});lease=mkdtempSync(join(users,`${process.pid}-`));
  } finally {rmSync(lock,{recursive:true,force:true});}
  const fixtures=mkdtempSync(join(tmpdir(),'parity-fixtures-'));
  try {
    const archive=execFileSync('git',['archive',sha,'--','test/parity'],{cwd:root,maxBuffer:64*1024**2});
    execFileSync('tar',['-x','-C',fixtures],{input:archive,maxBuffer:64*1024**2});
    return {tree:join(dir,'tree'),fixtures,hit,key,cleanup:()=>{rmSync(fixtures,{recursive:true,force:true});rmSync(lease,{recursive:true,force:true});}};
  }catch(error){rmSync(fixtures,{recursive:true,force:true});rmSync(lease,{recursive:true,force:true});throw error;}
}
/** @param {string} path */
function readJsonNumber(path) {try{return Number(readFileSync(path,'utf8'));}catch{return 0;}}

/** @param {string} tree @param {string} sha */
function buildTree(tree,sha) {
  const options={cwd:tree,env:{...process.env,VERCEL_GIT_COMMIT_SHA:sha},stdio:'pipe',maxBuffer:16*1024**2};
  // Historical oracle commits may predate these generators. Current products must exist before Vite copies public/.
  for(const script of ['scripts/gen.mjs','scripts/build-shardfiles.mjs'])if(existsSync(join(tree,script)))execFileSync('node',[script],options);
  execFileSync('pnpm',['exec','vite','build'],options);
}
