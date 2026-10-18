import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import rows from '../data/lightSpill.generated.json' with { type: 'json' };

/** Lossless float32 application channels; every part stays below the blob ceiling. */
export function spillBlobs(): NamedBlob[] {
  return rows.map(row => nameBlob(row.name, 'bin', Uint8Array.from(atob(row.packed), byte => byte.codePointAt(0) ?? 0),
    { decoded: row.decoded, gpu: row.decoded }));
}
