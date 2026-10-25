import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import * as v from 'valibot';
import { readOutputDownloadIndex } from '../src/format/outputDownload';

const TILE = 256;
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const plot = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path fill="#69704f" d="M0 0h256v256H0z"/><path fill="none" stroke="#a6ad90" stroke-width="3" d="M10 10h236v236H10z"/><path stroke="#a6ad90" stroke-width="9" d="M128 0v256M0 128h256"/><path fill="none" stroke="#818a67" stroke-width="2" d="M28 28h78v78H28zM150 28h78v78h-78zM28 150h78v78H28zM150 150h78v78h-78z"/></svg>');

/** Read only the validated product's map section and its hash-checked image, never a runtime or its libraries. */
export function productMapBytes(root: string, slug: string): Uint8Array | null {
  if (!/^_?[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) throw new Error('Invalid atlas product');
  const folder = resolve(root, 'out', slug), index = readOutputDownloadIndex(JSON.parse(readFileSync(resolve(folder, 'shard.json'), 'utf8')));
  const row = index.sections.find(section => section.name === 'look/map');
  if (row === undefined) return null;
  const bytes = readFileSync(resolve(folder, row.path));
  if (bytes.length !== row.bytes || hash(bytes) !== row.hash) throw new Error('Atlas map section differs from its product');
  const { map } = v.parse(v.object({ map: v.exactOptional(v.nullable(v.object({ image: v.string() }))) }), JSON.parse(bytes.toString('utf8')));
  if (map === null || map === undefined) return null;
  const file = index.files.find(candidate => candidate.hash === map.image);
  if (file === undefined) throw new Error('Atlas map is absent from its product');
  const image = readFileSync(resolve(folder, file.path));
  if (image.length !== file.compressed || hash(image) !== file.hash) throw new Error('Atlas image differs from its product');
  return image;
}

/** Pack every declared product once. Repeated cells share its tile; missing map declarations get an explicit plot diagram. */
export async function bakeWorldMapAtlas(products: readonly string[], read: (slug: string) => Uint8Array | null): Promise<{
  readonly bytes: Uint8Array; readonly width: number; readonly height: number; readonly tileSize: number; readonly slugs: readonly string[];
}> {
  const slugs = [...new Set(products)].sort();
  if (slugs.length === 0 || slugs.length > 75) throw new Error('Invalid atlas product count');
  const columns = Math.ceil(Math.sqrt(slugs.length)), width = columns * TILE, height = Math.ceil(slugs.length / columns) * TILE;
  const inputs: { input: Buffer; left: number; top: number }[] = [];
  for (const [i, slug] of slugs.entries()) inputs.push({ input: await sharp(read(slug) ?? plot, { limitInputPixels: 4096 * 4096 })
    .resize(TILE, TILE, { fit: 'fill' }).png().toBuffer(), left: (i % columns) * TILE, top: Math.floor(i / columns) * TILE });
  const bytes = await sharp({ create: { width, height, channels: 3, background: '#0b1016' } }).composite(inputs).webp({ quality: 85 }).toBuffer();
  if (bytes.length > 1_000_000) throw new Error('World map atlas exceeds its wire cap');
  return { bytes, width, height, tileSize: TILE, slugs };
}

/** Build one up-front map asset from all grid placements, including Developer overrides. No generated source handoff. */
export function worldMapAtlasPlugin(): Plugin {
  let atlas: Awaited<ReturnType<typeof bakeWorldMapAtlas>> | undefined, fileName = '';
  return { name: 'wildshard-world-map-atlas', apply: 'build', async config(config) {
    const root = resolve(config.root ?? '.');
    const row = v.object({ slug: v.string() }), catalogue = v.parse(v.object({ grid: v.object({ cells: v.array(row), developer: v.array(row), devserver: v.array(row) }) }),
      JSON.parse(readFileSync(resolve(root, 'src/game/grid/singleplayer.json'), 'utf8'))).grid;
    atlas = await bakeWorldMapAtlas([...catalogue.cells, ...catalogue.developer, ...catalogue.devserver].map(cell => cell.slug), slug => productMapBytes(root, slug));
    fileName = `assets/world-map-${hash(atlas.bytes).slice(0, 16)}.webp`;
    return { define: { __GRID_MAP_ATLAS__: JSON.stringify({ url: `/${fileName}`, compressed: atlas.bytes.length,
      width: atlas.width, height: atlas.height, tileSize: atlas.tileSize, slugs: atlas.slugs }) } };
  }, generateBundle() { if (atlas === undefined) throw new Error('World map atlas was not built'); this.emitFile({ type: 'asset', fileName, source: atlas.bytes }); } };
}
