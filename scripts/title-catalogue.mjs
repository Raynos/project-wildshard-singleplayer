import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

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
}
