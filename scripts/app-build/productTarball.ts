import {readFileSync, readdirSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {writeTar} from '@wildshard/format/tar';

/** One built product as the tarball `wildshard pack` writes (J86: first-party shards take the same road), without its
 *  build key and runtime sources, which never ship. */
export function productTarball(product: string): Uint8Array {
  const files = new Map<string, Uint8Array>();
  for (const row of readdirSync(product, {recursive: true, withFileTypes: true})) {
    if (!row.isFile()) continue;
    const path = relative(product, join(row.parentPath, row.name)).split(sep).join('/');
    if (path === '.build-key' || path.startsWith('runtime/')) continue;
    files.set(path, readFileSync(join(product, path)));
  }
  return writeTar(files);
}
