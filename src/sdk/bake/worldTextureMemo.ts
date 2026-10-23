// oxlint-disable-next-line import/no-nodejs-modules -- A trusted build-only cache owns its immutable encoder results.
import {lstatSync,mkdirSync,readFileSync,readdirSync,renameSync,rmSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keys, never author paths, select cache files.
import {join} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- A single atomic cache file contains bounded exact output bytes.
import {Buffer} from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Concurrent publishers use unique temporary files, without locks or waits.
import {randomBytes} from 'node:crypto';
import * as v from 'valibot';
import {hashImmutableBytes} from '../immutable';

const digest=v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u));
const Entry=v.strictObject({schema:v.literal(1),key:digest,hash:digest,bytes:v.pipe(v.string(),v.maxLength(33_333_336))});
const maximumWire=25_000_000,maximumEntry=33_334_000,maximumCache=128*1024*1024;
const filename=/^[a-f0-9]{64}\.json$/u;

function trim(directory:string):void {
 const rows=readdirSync(directory,{withFileTypes:true}).filter(row=>row.isFile()&&filename.test(row.name)).map(row=>{
  const path=join(directory,row.name),stat=lstatSync(path);return {path,size:stat.size,time:stat.mtimeMs};
 }).sort((a,b)=>b.time-a.time||a.path.localeCompare(b.path));
 let bytes=0,kept=0;
 for(const row of rows){
  if(kept>=128||bytes+row.size>maximumCache)rmSync(row.path,{force:true});
  else{bytes+=row.size;kept++;}
 }
}

/** Pure transform memo only. Every caller still admits the exact cached bytes.
 * Missing, corrupt or unwritable storage encodes normally; failed encodes never publish. */
export function cachedWorldTexture(directory:string|undefined,key:string,encode:()=>Uint8Array,admit:(bytes:Uint8Array)=>unknown):Uint8Array {
 v.parse(digest,key);
 const file=directory===undefined?undefined:join(directory,`${key}.json`);
 if(file!==undefined)try{
  const stat=lstatSync(file);
  if(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=maximumEntry){
   const saved=v.parse(Entry,JSON.parse(readFileSync(file,'utf8'))),bytes=Buffer.from(saved.bytes,'base64');
   if(saved.key===key&&bytes.length>0&&bytes.length<=maximumWire&&bytes.toString('base64')===saved.bytes&&hashImmutableBytes(bytes)===saved.hash){
    admit(bytes);return Uint8Array.from(bytes);
   }
  }
 }catch{/* A cache is never authority for an invalid or unavailable texture. */}
 const bytes=encode();admit(bytes);
 if(bytes.length===0||bytes.length>maximumWire)throw new Error('World texture memo wire cap exceeded');
 if(file!==undefined&&directory!==undefined){
  const temporary=`${file}.${randomBytes(8).toString('hex')}.tmp`;
  try{
   mkdirSync(directory,{recursive:true});
   writeFileSync(temporary,JSON.stringify({schema:1,key,hash:hashImmutableBytes(bytes),bytes:Buffer.from(bytes).toString('base64')}));
   renameSync(temporary,file);trim(directory);
  }catch{/* An optional memo write cannot turn a valid encode into a failure. */}
  finally{try{rmSync(temporary,{force:true});}catch{/* Failed cache cleanup leaves no reusable entry. */}}
 }
 return bytes;
}
