// G348: the shards a placeholder bake serves, found from their own data, never a table here. A shard opts in by declaring
// `PLACEHOLDER` in `src/shards/<slug>/data/placeholder.ts` (schema `@wildshard/format/placeholderSource`): its far look
// (and its grid or model parts when its land is not a height field), its ground source and its tree stand-ins.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Every shard folder with a declared placeholder row, sorted by folder name: `{ slug, dir, source }`. */
export async function placeholderShards(root) {
  const { placeholderSource } = await import(pathToFileURL(join(root, 'src/format/placeholderSource.ts')).href);
  const out = [];
  for (const slug of readdirSync(join(root, 'src/shards')).sort()) {
    const file = join(root, 'src/shards', slug, 'data/placeholder.ts');
    if (!existsSync(file)) continue;
    const { PLACEHOLDER } = await import(pathToFileURL(file).href);
    out.push({ slug, dir: join(root, 'src/shards', slug), source: placeholderSource(slug, PLACEHOLDER) });
  }
  return out;
}

/** One shard's declared placeholder row (`{}` when it declares none). */
export async function placeholderOf(root, slug) {
  const file = join(root, 'src/shards', slug, 'data/placeholder.ts');
  const { placeholderSource } = await import(pathToFileURL(join(root, 'src/format/placeholderSource.ts')).href);
  return placeholderSource(slug, existsSync(file) ? (await import(pathToFileURL(file).href)).PLACEHOLDER : undefined);
}

/**
 * The height grid a shard's placeholders stand on, when it declares no grid of its own: its baked `terrain.bin`, else its
 * shardfile terrain collider (`data/terrain.json`'s `terrain.collider`, a tile in its `assets/`).
 */
export function placeholderGridBytes(root, dir, slug) {
  const baked = join(root, 'public/assets/baked', slug, 'terrain.bin');
  if (existsSync(baked)) return { kind: 'baked', bytes: readFileSync(baked) };
  const row = JSON.parse(readFileSync(join(dir, 'data/terrain.json'), 'utf8'));
  const collider = row?.terrain?.collider;
  if (typeof collider !== 'string') throw new Error(`${slug}: no terrain.bin and no shardfile terrain collider`);
  return { kind: 'collider', bytes: readFileSync(join(dir, 'assets', collider)) };
}
