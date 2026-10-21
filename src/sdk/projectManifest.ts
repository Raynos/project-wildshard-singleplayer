import { parseManifestMetadata, type ManifestMetadata } from '@wildshard/format/minimap';
import { hashImmutableBytes } from './immutable';
import { nameBlob, type NamedBlob } from './blobs';
import { STILL_IMAGE_LIMITS } from '@wildshard/format/stillImage';

/** Explicit author-side file intake. URL prefixes are mapped by the caller;
 * the SDK knows no repository layout and never resolves a runtime source URL. */
export interface ProjectManifestSource {
  readonly folder: string;
  readonly file?: string;
  /** SF88g: an output's composed manifest (its folder's manifest.json with the output's overrides), in place of `file`. */
  readonly composed?: unknown;
  readonly imageRoots: readonly { readonly prefix: string; readonly directory: string }[];
}

/** Read bounded author JSON and its images only through declared local roots.
 * Symlink/traversal escapes, missing images and ambiguous prefixes refuse. File
 * services are loaded only here, so the in-memory packer stays config-safe. */
export async function readManifestSource(source: ProjectManifestSource, declared?: unknown): Promise<{ readonly authored: ManifestMetadata; readonly manifest: ManifestMetadata; readonly blobs: readonly NamedBlob[] }> {
  const [fs, paths, reader] = await Promise.all([
    // oxlint-disable-next-line import/no-nodejs-modules -- Explicit author file intake owns its bounded disk reads.
    import('node:fs'),
    // oxlint-disable-next-line import/no-nodejs-modules -- Resolve images beneath caller-declared filesystem roots.
    import('node:path'),
    import('./sourceReader'),
  ]);
  if (source.imageRoots.length > 32) throw new Error('Too many manifest image roots');
  const roots = source.imageRoots.map(root => {
    if (!/^\/(?:[a-zA-Z0-9_-]+\/)+$/u.test(root.prefix)) throw new Error('Manifest image root needs a bounded absolute URL prefix');
    return { prefix: root.prefix, directory: fs.realpathSync(root.directory) };
  });
  const input = source.composed ?? (source.file === undefined ? declared : reader.readShardfileSource(source.file));
  if (input === undefined) throw new Error('Manifest intake requires an explicit file or declared level metadata');
  const authored = parseManifestMetadata(input, source.folder), images = new Map<string, Uint8Array>();
  for (const { url } of manifestImages(authored)) {
    if (url.startsWith('data:image/') || images.has(url)) continue;
    const matches = roots.filter(root => url.startsWith(root.prefix)), root = matches[0];
    if (matches.length !== 1 || root === undefined) throw new Error(`Manifest image needs exactly one declared root: ${url}`);
    const tail = url.slice(root.prefix.length);
    if (/[\\%?#]/u.test(tail) || tail.includes(String.fromCodePoint(0)) || tail.split('/').some(part => part === '' || part === '.' || part === '..')) throw new Error(`Manifest image path escapes its root: ${url}`);
    const file = fs.realpathSync(paths.resolve(root.directory, tail));
    if (!file.startsWith(`${root.directory}${paths.sep}`)) throw new Error(`Manifest image path escapes its root: ${url}`);
    images.set(url, reader.readBoundedFile(file, STILL_IMAGE_LIMITS.bytes));
  }
  return { authored, ...packManifestImages(source.folder, authored, images) };
}

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
