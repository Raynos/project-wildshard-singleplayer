import * as v from 'valibot';
import {pageScope} from '@wildshard/engine/app/resources';
import {readOutputDownloadIndex,type OutputDownloadIndex} from '@wildshard/format/outputDownload';
import type {PrefetchIndexRequest,PrefetchIndexCache} from './prefetchIndexCore';

const hash=v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u));
const message=v.variant('kind',[
  v.strictObject({kind:v.literal('prepared'),index:v.unknown()}),
  v.strictObject({kind:v.literal('refused'),error:v.string()}),
  v.strictObject({kind:v.literal('cache-get'),id:v.pipe(v.number(),v.safeInteger(),v.minValue(1)),hash}),
  v.strictObject({kind:v.literal('cache-put'),id:v.pipe(v.number(),v.safeInteger(),v.minValue(1)),hash,
    bytes:v.pipe(v.instance(Uint8Array),v.check(bytes=>bytes.length<=25_000_000))}),
]);

/** A short-lived admission worker borrows the existing content-cache writer
 * through transfers. Page code never sees complete decoded product bodies. */
export async function readPrefetchIndex(request:PrefetchIndexRequest,content:PrefetchIndexCache):Promise<OutputDownloadIndex|null> {
  let worker:Worker;
  try {
    if(typeof Worker==='undefined')throw new Error('No Worker');
    worker=new Worker(new URL('prefetchIndex.worker.ts',import.meta.url),{type:'module',name:'prefetch-index'});
  }catch {
    // Unsupported workers retain the original checked admission, not an
    // unchecked schedule. This fallback is also the renderer-free Node path.
    return (await import('./prefetchIndexCore')).preparePrefetchIndex(request,content);
  }
  let scope:ReturnType<typeof pageScope.child>;
  try { scope=pageScope.child('prefetch-index'); }catch(error){worker.terminate();throw error;}
  try {
    return await new Promise<OutputDownloadIndex|null>((resolve,reject)=>{
      let finished=false;
      const fail=(error:Error):void=>{if(!finished){finished=true;reject(error);}};
      scope.onDispose(()=>{worker.terminate();fail(new Error('Prefetch index owner ended'));});
      scope.listen(window,'pagehide',()=>{scope.dispose();});
      scope.listen(worker,'error',event=>{event.preventDefault();fail(new Error('Prefetch index worker failed'));});
      scope.listen(worker,'messageerror',()=>{fail(new Error('Prefetch index transfer failed'));});
      scope.listen(worker,'message',event=>{
        if(!(event instanceof MessageEvent)){fail(new Error('Invalid prefetch index message'));return;}
        const row=v.safeParse(message,event.data);if(!row.success){fail(new Error('Invalid prefetch index reply'));return;}
        const value=row.output;
        if(value.kind==='refused'){fail(new Error(value.error));return;}
        if(value.kind==='prepared') {
          try {
            const index=value.index===null?null:readOutputDownloadIndex({format:'wildshard.shardfile',formatVersion:2,...v.parse(v.record(v.string(),v.unknown()),value.index)});
            finished=true;resolve(index);
          }catch(error){fail(error instanceof Error?error:new Error(String(error)));}
          return;
        }
        const respond=async():Promise<void>=>{
          try {
            const result=value.kind==='cache-get'?await content.get(value.hash):await content.put(value.hash,value.bytes,true);
            if(finished||scope.disposed)return;
            const transfer=result instanceof Uint8Array&&result.buffer instanceof ArrayBuffer?[result.buffer]:[];
            worker.postMessage({kind:'cache-result',id:value.id,ok:true,value:result},{transfer});
          }catch(error){if(!finished&&!scope.disposed)worker.postMessage({kind:'cache-result',id:value.id,ok:false,error:String(error)},{transfer:[]});}
        };
        void respond();
      });
      worker.postMessage({kind:'prepare',...request},{transfer:[]});
    });
  }finally{scope.dispose();}
}
