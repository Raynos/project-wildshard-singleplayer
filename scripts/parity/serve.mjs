import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

/** @param {string} root @param {string} sha */
export function exportTree(root, sha) {
  const dir=mkdtempSync(join(tmpdir(),'wildshard-parity-')), ign=join(dir,'ign'); mkdirSync(ign);
  execFileSync('git',['init','-q',ign]);
  const patterns=execFileSync('git',['show',`${sha}:.vercelignore`],{cwd:root,encoding:'utf8'}); writeFileSync(join(dir,'ignore'),patterns);
  const paths=execFileSync('git',['ls-tree','-r','--name-only',sha],{cwd:root,encoding:'utf8'}).trim().split('\n');
  const ignored=execFileSync('git',['-C',ign,'-c',`core.excludesFile=${join(dir,'ignore')}`,'check-ignore','--no-index','--stdin'],{input:paths.join('\n'),encoding:'utf8'}).trim().split('\n');
  const excluded=new Set(ignored), keep=paths.filter((p)=>p.startsWith('test/parity/') || !excluded.has(p));
  const tree=join(dir,'tree');mkdirSync(tree);
  const archive=execFileSync('git',['archive',sha,'--',...keep],{cwd:root,maxBuffer:1024**3});
  execFileSync('tar',['-x','-C',tree],{input:archive,maxBuffer:1024**3});
  symlinkSync(join(root,'node_modules'),join(tree,'node_modules'),'dir');
  return {tree,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}
/** @returns {Promise<number>} */
async function freePort() { const s=createServer();await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',()=>resolve(undefined));}); const a=s.address();if(!a || typeof a==='string') throw new Error('no preview port'); await new Promise((resolve,reject)=>{s.close((e)=>{if(e)reject(e);else resolve(undefined);});});return a.port; }
/** @param {string} tree @param {string} sha */
export async function serve(tree,sha) {
  execFileSync('pnpm',['exec','vite','build'],{cwd:tree,env:{...process.env,VERCEL_GIT_COMMIT_SHA:sha},stdio:'pipe',maxBuffer:16*1024**2});
  const port=await freePort(), child=spawn('pnpm',['exec','vite','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:tree,stdio:'ignore',detached:true});
  const url=`http://127.0.0.1:${port}`;
  const close=()=> {if(child.pid) {try {process.kill(-child.pid,'SIGTERM');} catch { /* already stopped */ }} };
  try {for(let i=0;i<100;i++){if(child.exitCode!==null) throw new Error('preview exited');try {if((await fetch(`${url}/version.json`)).ok) return {url,close};}catch {/* preview starting */} await new Promise((resolve)=>{setTimeout(resolve,100);});} throw new Error('preview never served');}catch(e){close();throw e;}
}
/** @param {string} path @returns {unknown} */
export function readJson(path) {return existsSync(path) ? JSON.parse(readFileSync(path,'utf8')) : undefined;}
