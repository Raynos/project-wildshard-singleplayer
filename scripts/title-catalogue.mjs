import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { shardFolders } from './gen-shards.mjs';
import { shardProducts } from './shard-outputs.mjs';
import { productManifestPath } from './authored-manifest.mjs';
import { pathToFileURL } from 'node:url';
import { legacyInventory } from './legacy-shards.mjs';

/** Emit data and image imports only, never a shard's executable discovery graph.
 * @param {readonly import('../src/game/shard/titleList').TitleManifest[]} rows */
export function titleCatalogueSource(rows) {
  /** @type {Map<string, string>} */
  const images = new Map();
  /** @param {string} value */
  const image = value => {
    if (!value.startsWith('/src/')) return JSON.stringify(value);
    let name = images.get(value);
    if (name === undefined) { name = `image${images.size}`; images.set(value, name); }
    return name;
  };
  const entries = rows.map(row => {
    const { card, ...data } = row;
    return `{...${JSON.stringify(data)},card:{thumb:${image(card.thumb)},portrait:${image(card.portrait)},landscape:${image(card.landscape)}}}`;
  });
  return `${[...images].map(([path, name]) => `import ${name} from ${JSON.stringify(path)};`).join('\n')}\nexport const TITLE_MANIFESTS=[${entries.join(',\n')}];\n`;
}

/** Run only in the existing build-time loader after discovery is current. */
export async function readTitleCatalogue() {
  const { shards } = await import('../src/game/shard/list.ts');
  const { titleMetadata } = await import('../src/game/shard/titleList.ts');
  return titleCatalogueSource(shards().map(titleMetadata));
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.stdout.write(`TITLE-CATALOGUE ${JSON.stringify(await readTitleCatalogue())}\n`);
  const identities=Object.fromEntries(Object.entries(legacyInventory(process.cwd()).shards).map(([copy,row])=>[copy,row.primary]));
  process.stdout.write(`TITLE-SELECTION ${JSON.stringify(selectionCatalogueSource(selectionModules(process.cwd()),identities))}\n`);
}

/** The same discovered modules and original placement rows, without importing them.
 * @param {string} root
 * @returns {{slug:string,file:string,placement?:{grid:[number,number],size:[number,number,number],instance:string}}[]} */
export function selectionModules(root) {
  if (!existsSync(resolve(root,'src/shards'))) return [];
  const path=resolve(root,'src/game/grid/singleplayer.json');
  /** @type {{slug:string,cell:[number,number],size:[number,number,number],instance:string}[]} */
  const placements=existsSync(path)?JSON.parse(readFileSync(path,'utf8')).placements:[];
  return shardProducts(root,shardFolders(root)).map(product=>{
    const placement=placements.find(row=>row.slug===product.slug);
    const row={slug:product.slug,file:productManifestPath(root,product)};
    if(placement===undefined)return row;
    return {slug:row.slug,file:row.file,placement:{grid:placement.cell,size:placement.size,instance:placement.instance}};
  });
}
/** A separate lazy composition bank: the cold title imports none of these modules.
 * @param {ReturnType<typeof selectionModules>} rows
 * @param {Readonly<Record<string,string>>} identities */
export function selectionCatalogueSource(rows, identities = {}) {
  return `export const LEGACY_CONTENT_IDENTITIES=${JSON.stringify(identities)};\nexport const SHARD_LOADERS={${rows.map(row=>`${JSON.stringify(row.slug)}:()=>import(${JSON.stringify(`/${row.file}`)}).then(({default:manifest})=>${row.placement===undefined?'manifest':`({...manifest,placement:${JSON.stringify(row.placement)}})`})`).join(',')}};\n`;
}
