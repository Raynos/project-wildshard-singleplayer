import { parseManifestMetadata, type ManifestMetadata } from '@wildshard/format/minimap';
import { hashImmutableBytes } from './immutable';
import { nameBlob, type NamedBlob } from './blobs';

/** Build-only image inputs. Every non-data image is resolved by orchestration
 * before packing, never by runtime source imports or network fallback. */
export function manifestImages(metadata: ManifestMetadata): readonly { readonly name: string; readonly url: string }[] {
  const rows = [
    ...Object.entries(metadata.card).map(([name,url])=>({name:`card-${name}`,url})),
    {name:'map',url:metadata.minimap.image},
    ...Object.entries(metadata.explore.art).map(([name,url])=>({name:`explore-${name}`,url})),
    ...(metadata.explore.compare?.flatMap((row,index)=>[{name:`compare-${index}-live`,url:row.live},{name:`compare-${index}-target`,url:row.image}])??[]),
  ];
  const hdri=metadata.sky.hdri;
  if(hdri!==undefined&&(hdri.startsWith('/')||hdri.startsWith('data:image/')))rows.push({name:'sky',url:hdri});
  const horizon=metadata.horizonStrips;
  if(horizon!==undefined){rows.push({name:'horizon-day',url:horizon.day},{name:'horizon-night',url:horizon.night});if(horizon.phone!==undefined)rows.push({name:'horizon-phone-day',url:horizon.phone.day},{name:'horizon-phone-night',url:horizon.phone.night});}
  return rows;
}

/** Prepare complete plain level metadata and one charged named blob per distinct
 * image. Exact image bytes survive; identical card/art/map images share one
 * entry. Project declaration intake, not this packer, performs library admission. */
export function packManifestImages(folder: string, input: unknown, images: ReadonlyMap<string,Uint8Array>): { readonly manifest: ManifestMetadata; readonly blobs: readonly NamedBlob[] } {
  if(!/^(?:_[a-z]+|[a-z][a-z0-9-]*)$/u.test(folder))throw new Error('Invalid output folder');
  const metadata=parseManifestMetadata(input,folder), packed=new Map<string,NamedBlob>(), urls=new Map<string,string>();
  for(const row of manifestImages(metadata)){
    if(row.url.startsWith('data:image/')){urls.set(row.url,row.url);continue;}
    if(urls.has(row.url))continue;
    const bytes=images.get(row.url);if(bytes===undefined)throw new Error(`Manifest image bytes are missing: ${row.url}`);
    const hash=hashImmutableBytes(bytes);let blob=packed.get(hash);
    if(blob===undefined){blob=nameBlob(`ui/images/${row.name}`,'image',bytes);packed.set(hash,blob);}
    urls.set(row.url,`/shardfiles/${folder}/${blob.file.path}`);
  }
  const image=(url:string):string=>{const value=urls.get(url);if(value===undefined)throw new Error('Manifest image was not packed');return value;};
  const compare=metadata.explore.compare?.map(row=>({...row,live:image(row.live),image:image(row.image)}));
  const horizon=metadata.horizonStrips;
  const hdri=metadata.sky.hdri;
  const manifest=parseManifestMetadata({...metadata,card:{thumb:image(metadata.card.thumb),portrait:image(metadata.card.portrait),landscape:image(metadata.card.landscape)},
    minimap:{...metadata.minimap,image:image(metadata.minimap.image)},
    explore:{...metadata.explore,art:{world:image(metadata.explore.art.world),models:image(metadata.explore.art.models),sets:image(metadata.explore.art.sets),practice:image(metadata.explore.art.practice)},...(compare===undefined?{}:{compare})},
    sky:{...metadata.sky,...(hdri===undefined||!urls.has(hdri)?{}:{hdri:image(hdri)})},
    ...(horizon===undefined?{}:{horizonStrips:{...horizon,day:image(horizon.day),night:image(horizon.night),...(horizon.phone===undefined?{}:{phone:{day:image(horizon.phone.day),night:image(horizon.phone.night)}})}}),
  },folder);
  return{manifest,blobs:[...packed.values()]};
}
