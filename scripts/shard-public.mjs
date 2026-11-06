// S2: a gathered shard keeps its published files in its own folder. The site still serves them from public/ at
// the same URLs with the same bytes: `pnpm gen` rewrites these gitignored aliases first, before anything walks public/.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** The shards gathered so far. Open Plots follows; its products share one source folder. */
export const GATHERED_SHARDS = Object.freeze(['_template', 'blender-template', 'ink-cel-valley', 'pastel-plain', 'sunscar-dunes', 'far-reach', 'driftwood-isle', 'nalati-grasslands']);

/** Where the entry crawl's record lives for a shard: its own folder once gathered, else its public folder.
 * @param {string} root @param {string} slug */
export const entryReadsFile = (root, slug) => GATHERED_SHARDS.includes(slug)
  ? resolve(root, 'src/shards', slug, 'look/entry-reads.json')
  : resolve(root, 'public/assets', slug, 'entry-reads.json');

/** Copy every gathered shard's published files to their public aliases. @param {string} root */
export function publishShardFiles(root) {
  for (const slug of GATHERED_SHARDS) {
    const alias = resolve(root, 'public/assets', slug, 'entry-reads.json');
    mkdirSync(dirname(alias), { recursive: true });
    copyFileSync(entryReadsFile(root, slug), alias);
  }
}
