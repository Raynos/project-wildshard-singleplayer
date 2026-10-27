/** Original per-tier hero PBR payloads, with the duplicate vertex data removed. GR8: the program compacts them from its
 *  sources (pineSources.ts) and names them as product files; each material row's aliases map the original public URL to
 *  its compacted file's product name, which the client loads through the product's URL for it. */
import {compactMaterialGlb} from './materialGlb.mjs';
import rows from '../data/heroRows.json' with {type:'json'};

/** The GPU twin tables the candidates come from (read as the program's sources, not imported). */
export const HERO_TABLES=['ktx2.generated.ts','data/astc6.generated.json'];
const tables=sources=>{
 const text=new TextDecoder().decode(sources.bytes(HERO_TABLES[0]));
 return{gpu:JSON.parse(text.slice(text.indexOf(' = {')+3,text.lastIndexOf('}')+1)),astc:JSON.parse(new TextDecoder().decode(sources.bytes(HERO_TABLES[1])))};
};

/** One hero GLB: a source's fine (or phone) tier, or its coarse `-lod1` LOD. */
export function heroModelSource(id,phone=false){return `${rows.directory}/${id}/${id}${phone?'.phone':''}.glb`;}
/** The hero GLBs the rest shapes are cut from: each source's fine and phone tier and its coarse LOD. */
export function heroModelSources(){return rows.sources.flatMap(id=>[heroModelSource(id),heroModelSource(id,true),heroModelSource(`${id}-lod1`)]);}

/** Every material payload a hero row may load (original, phone and GPU twins per tier); the sources keep those that exist. */
export function heroMaterialCandidates(sources){
 const {gpu,astc}=tables(sources),urls=[];
 for(const source of rows.sources)for(const id of [source,`${source}-lod1`]){
  const original=heroModelSource(id),phone=original.replace('.glb','.phone.glb');
  for(const url of [original,phone,gpu.desktop[original],gpu.desktop[phone],gpu.phone[original],gpu.phone[phone],astc[original],astc[phone]])
   if(typeof url==='string'&&!urls.includes(url))urls.push(url);
 }
 return urls;
}
/** The folders the candidates live in, listed for which exist. */
export function heroMaterialFolders(sources){return [...new Set(heroMaterialCandidates(sources).map(url=>url.slice(0,url.lastIndexOf('/',url.lastIndexOf('/')-1)+1)))];}

/** A compacted payload's product file name. */
const productName=url=>`models/hero-materials/${url.slice('/assets/'.length)}`;
/** Each existing payload's original URL mapped to its compacted file's product name. */
export function heroMaterialAliases(sources){
 return Object.fromEntries(heroMaterialCandidates(sources).filter(url=>sources.has(url)).map(url=>[url,productName(url)]));
}
/** The compacted payloads by product name. */
export function heroMaterialFiles(sources){
 return Object.keys(heroMaterialAliases(sources)).map(url=>[productName(url),new Uint8Array(compactMaterialGlb(Buffer.from(sources.bytes(url))))]);
}
