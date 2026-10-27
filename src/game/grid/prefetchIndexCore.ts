import {SHARDFILE_ADMISSION_LIMITS as limits} from '@wildshard/format/admissionLimits';
import {readOutputDownloadIndex,type OutputDownloadIndex} from '@wildshard/format/outputDownload';
import {readContentResponse} from '@wildshard/engine/boot/readContentResponse';
import {contentHash} from '../shardfile/contentStore';
import {yieldTask} from '@wildshard/engine/core/workSlice';
import {readCheckedOutputIndex} from '../shardfile/outputIndexChecks';

export interface PrefetchIndexRequest {readonly url:string;readonly indexHashes:readonly string[]|null;readonly phone:boolean}
export interface PrefetchIndexCache {get:(hash:string)=>Promise<Uint8Array|null>;put:(hash:string,bytes:Uint8Array,keep:boolean)=>Promise<boolean>}

/** Index decode and phone admission run together off the page. Only the small
 * download schedule returns; complete source/receipt/section objects stay here. */
export async function preparePrefetchIndex(request:PrefetchIndexRequest,content:PrefetchIndexCache):Promise<OutputDownloadIndex|null> {
  const read=async(path:string,maximum:number):Promise<Uint8Array>=>{
    if(!Number.isSafeInteger(maximum)||maximum<0||maximum>32*1024*1024)throw new Error('Invalid prefetch body size');
    return readContentResponse(await fetch(path,{cache:'no-store'}),maximum);
  };
  const bytes=await read(request.url,limits.sourceBytes);
  if(request.indexHashes!==null&&!request.indexHashes.includes(await contentHash(bytes)))return null;
  const input:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  const index=request.indexHashes===null?await readCheckedOutputIndex(input):readOutputDownloadIndex(input);
  if(!request.phone||request.indexHashes===null)return index;
  const [{isBuildValidatedOutput,resolveOutputDescriptor},{tierProductFilesPaced}]=await Promise.all([
    import('../shardfile/outputDescriptor'),import('../shardfile/productCost'),
  ]);
  const base=new URL('.',request.url).href;
  const source=await resolveOutputDescriptor(input,{offline:false,firstParty:true,hash:contentHash,
    pause:yieldTask,
    read:(path,maximum)=>read(new URL(path,base).href,maximum),
    cached:hash=>content.get(hash),store:(hash,body)=>content.put(hash,body,true)});
  if(!isBuildValidatedOutput(source))return index;
  const kept=new Set((await tierProductFilesPaced(source,'phone',yieldTask)).map(file=>file.hash));
  return {...index,files:index.files.filter(file=>kept.has(file.hash))};
}
