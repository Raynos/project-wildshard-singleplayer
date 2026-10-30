// Pure compression results only; file selection, admission and wire ceilings
// always run over the current product. No filename or timestamp is an input.
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {brotliCompressSync,constants} from 'node:zlib';

/** @param {string|Uint8Array} value */
const hash=value=>createHash('sha256').update(value).digest('hex');
const codec=JSON.stringify({schema:'served-brotli/1',node:process.version,platform:process.platform,arch:process.arch,brotli:process.versions.brotli,zlib:process.versions.zlib,quality:3});

/** A content-addressed memo of min(Brotli(q3,size hint), original bytes).
 * Corrupt, missing or unwritable cache state never changes compression.
 * The memory bound retains integers, never the admitted file bodies. */
export class BrotliSizeCache {
  /** @type {Map<string,number>} */
  memory=new Map();
  /** @param {string} directory */
  constructor(directory){this.directory=resolve(directory);}
  /** @param {Uint8Array} bytes */
  bytes(bytes){
    const key=hash(`${codec}\0${bytes.byteLength}\0${hash(bytes)}`),prior=this.memory.get(key);
    if(prior!==undefined)return prior;
    const file=resolve(this.directory,`${key}.json`);
    try{
      const text=readFileSync(file,'utf8');
      if(text.length>512)throw new Error('Oversized compression memo');
      const saved=/** @type {unknown} */(JSON.parse(text));
      if(typeof saved==='object'&&saved!==null&&'key' in saved&&saved.key===key&&'bytes' in saved
        &&typeof saved.bytes==='number'&&Number.isSafeInteger(saved.bytes)&&saved.bytes>=0&&saved.bytes<=bytes.byteLength
        &&'seal' in saved&&saved.seal===hash(JSON.stringify({key,bytes:saved.bytes})))return this.remember(key,saved.bytes);
    }catch{ /* An optional cache miss still runs the original compressor. */ }
    const encoded=brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:3,[constants.BROTLI_PARAM_SIZE_HINT]:bytes.byteLength}});
    const result=Math.min(encoded.byteLength,bytes.byteLength),body={key,bytes:result};
    const temporary=resolve(this.directory,`${key}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`);
    try{
      mkdirSync(this.directory,{recursive:true});
      writeFileSync(temporary,JSON.stringify({...body,seal:hash(JSON.stringify(body))}),{flag:'wx'});
      renameSync(temporary,file);
    }catch{ /* Read-only/full disks cannot waive or fail the wire check. */ }
    finally{try{rmSync(temporary,{force:true});}catch{ /* Own temporary file only. */ }}
    return this.remember(key,result);
  }
  /** @param {string} key @param {number} bytes */
  remember(key,bytes){if(this.memory.size>=4096)this.memory.clear();this.memory.set(key,bytes);return bytes;}
}
