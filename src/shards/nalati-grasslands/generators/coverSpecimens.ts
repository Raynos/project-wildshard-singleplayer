import { nameSpecimenBook } from '@wildshard/sdk/bake/specimenCatalogue';
import { nameBlob } from '@wildshard/sdk/blobs';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { COVER_INPUTS, coverBinName, nalatiCoverBake, type NalatiCover } from './coverBake.mjs';
import { GEAR_BOOK } from './gear';
import { reinsCardBinary } from './reinsCard';

/** the flock's sheep: the painted model (generators/bake-model-paint.mjs) in the painted creatures' material */
const SHEEP = { key: 'sheep', model: { id: 'nalati-grasslands/sheep', name: 'Fat-tailed sheep', file: 'src/shards/nalati-grasslands/generators/coverSpecimens.ts',
  category: 'creatures', pipeline: ['trellis', 'code'], surface: 'flesh', defaults: {} }, source: { kind: 'asset', asset: {
  url: '/assets/nalati/baked/painted-models/sheep.glb', phoneUrl: '/assets/nalati/baked/painted-models/sheep.phone.glb', geometrySlot: 0, materialSlot: 0,
  material: { id: 'nalati-model:sheep|near|0.35|0.8||ffffff', family: 'painterly', rim: 0.35, bands: 0.8, floor: 0.2 } } } };

/** The Explorer admits the prepared ambient cards, the baked reins card and the sheep without a shard builder module; the
 *  gear book (one for both tiers) is the held gear's catalogue, read by the Explorer and the entered arsenal alike. */
/** GR6: the cover at build time (the retired nalati-cover job's construction) over its committed inputs, read through the
 *  build cache. */
export async function nalatiCoverProgram(ctx:Pick<ProjectGenerationContext,'cached'>):Promise<NalatiCover> {
  const files=await ctx.cached({id:'cover-sources',inputs:COVER_INPUTS},read=>new Map(COVER_INPUTS.map(url=>{
    const bytes=read.get(url);if(bytes===undefined||bytes.length===0)throw new Error(`Missing cover input ${url}`);return[url.slice(1),bytes];})));
  // a cached file name is relative (the input URL without its leading slash)
  return nalatiCoverBake(url=>{const bytes=files.get(url.slice(1));if(bytes===undefined)throw new Error(`Missing cover input ${url}`);return bytes;});
}
export function coverSpecimenBlobs(cover:NalatiCover):ReturnType<typeof nameBlob>[] {
  const reins=reinsCardBinary(),row=reins.book.rows[0];
  if(row?.source.kind!=='file')throw new Error('Missing native reins declaration');
  const binary=nameBlob(row.source.file,'bin',reins.bytes);
  const book=(name:string,input:unknown,dependencies:readonly string[]=[],tier?:'phone'|'desktop')=>nameSpecimenBook(name,input,{dependencies,...(tier===undefined?{}:{tier})});
  const packed=(['phone','desktop']as const).map(tier=>{const bytes=cover.bins.get(coverBinName(tier));if(bytes===undefined)throw new Error(`Missing ${tier} cover shapes`);return nameBlob(coverBinName(tier),'bin',bytes,{tier,decoded:cover.rows[tier].packed.bytes});});
  return[binary,...packed,...(['phone','desktop']as const).map((tier,i)=>book(`models/cover-${tier}.json`,{rows:[...cover.rows[tier].catalogue,...reins.book.rows,SHEEP],packed:cover.rows[tier].packed,materials:cover.rows.materials},[binary.file.hash,...(packed[i]===undefined?[]:[packed[i].file.hash])],tier)),
    book('models/gear-book.json',GEAR_BOOK)];
}
