import * as v from 'valibot';
import {preparePrefetchIndex,type PrefetchIndexCache} from './prefetchIndexCore';

const hash=v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u));
const request=v.strictObject({kind:v.literal('prepare'),url:v.pipe(v.string(),v.url()),
  indexHashes:v.nullable(v.pipe(v.array(hash),v.maxLength(1024))),phone:v.boolean()});
const reply=v.variant('ok',[
  v.strictObject({kind:v.literal('cache-result'),id:v.pipe(v.number(),v.safeInteger(),v.minValue(1)),ok:v.literal(true),value:v.union([v.null(),v.boolean(),v.instance(Uint8Array)])}),
  v.strictObject({kind:v.literal('cache-result'),id:v.pipe(v.number(),v.safeInteger(),v.minValue(1)),ok:v.literal(false),error:v.string()}),
]);
let started=false,sequence=0;
const pending=new Map<number,{resolve:(value:unknown)=>void;reject:(error:Error)=>void}>();
function rpc(operation:{kind:'cache-get';hash:string}|{kind:'cache-put';hash:string;bytes:Uint8Array}):Promise<unknown> {
  const id=++sequence;
  return new Promise((resolve,reject)=>{
    pending.set(id,{resolve,reject});
    const transfer=operation.kind==='cache-put'&&operation.bytes.buffer instanceof ArrayBuffer?[operation.bytes.buffer]:[];
    self.postMessage({...operation,id},{transfer});
  });
}
const cache:PrefetchIndexCache={
  get:async key=>v.parse(v.nullable(v.instance(Uint8Array)),await rpc({kind:'cache-get',hash:key})),
  // Admission keeps its own borrowed source bytes while the existing cache
  // writer receives this independent transfer. No second writer is created.
  put:async(key,bytes)=>v.parse(v.boolean(),await rpc({kind:'cache-put',hash:key,bytes:bytes.slice()})),
};
self.onmessage=(event:MessageEvent<unknown>):void=>{
  const checked= v.safeParse(reply,event.data);
  if(checked.success) {
    const row=pending.get(checked.output.id);if(row===undefined)return;
    pending.delete(checked.output.id);
    if(checked.output.ok)row.resolve(checked.output.value);else row.reject(new Error(checked.output.error));
    return;
  }
  if(started)throw new Error('Prefetch index worker already preparing');
  const input=v.parse(request,event.data);started=true;
  if(new URL(input.url).origin!==self.location.origin)throw new Error('Prefetch index stays on this origin');
  const run=async():Promise<void>=>{
    try { self.postMessage({kind:'prepared',index:await preparePrefetchIndex(input,cache)},{transfer:[]}); }
    catch(error:unknown){self.postMessage({kind:'refused',error:error instanceof Error?error.message:String(error)},{transfer:[]});}
  };
  void run();
};
