import { readNamedBlob, type NamedBlob } from '../../src/sdk/blobs';
import { SIGN_ATLAS_SOURCES } from '../../src/shards/nine-dragon-stack/generators/signAtlasSources';
/** Exercise the same bounded file intake as the product writer. */
export async function nineSignBlobs(): Promise<NamedBlob[]> {
  return Promise.all(SIGN_ATLAS_SOURCES.map(row => readNamedBlob('src/shards/nine-dragon-stack', row.name, row.source, row.kind, row.options)));
}
