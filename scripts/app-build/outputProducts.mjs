import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';

/** The app publishes its data products, never their temporary TypeScript sources: each built product's folder under
 *  `<root>/out` (one with a shard.json) goes to `<outDir>/shardfiles`, without its runtime sources or its build key. */
export function copyOutputProducts(root, outDir) {
  const products = resolve(root, 'out'), shardfiles = resolve(outDir, 'shardfiles');
  rmSync(shardfiles, { recursive: true, force: true });
  if (!existsSync(products)) return;
  for (const entry of readdirSync(products, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const source = resolve(products, entry.name);
    if (!existsSync(resolve(source, 'shard.json'))) continue;
    cpSync(source, resolve(shardfiles, entry.name), { recursive: true, filter: path => basename(path) !== 'runtime' && basename(path) !== '.build-key' });
  }
}
