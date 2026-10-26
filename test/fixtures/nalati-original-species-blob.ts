import { nameBlob, type BlobSourceOptions, type NamedBlob, type NamedBlobKind } from '../../src/sdk/blobs';
import { originalSpeciesOutput } from './nalati-original-species';
import pins from './nalati-species-files.json' with { type: 'json' };

interface OriginalDeclaration {
  readonly name: string;
  readonly kind: NamedBlobKind;
  readonly source: string;
  readonly options?: BlobSourceOptions;
}

/** Only the five frozen historical species publications are source-built oracle inputs.
 * Other declarations retain their ordinary strict raw-file reader; no failed read falls back here. */
export function originalSpeciesBlob(row: OriginalDeclaration): NamedBlob | undefined {
  const pin = pins.find(value => value.path === `src/shards/nalati-grasslands/${row.source}`);
  if (pin === undefined) return undefined;
  return nameBlob(row.name, row.kind, originalSpeciesOutput(pin.path), row.options);
}
